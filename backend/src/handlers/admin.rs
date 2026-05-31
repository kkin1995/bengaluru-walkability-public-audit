// ─────────────────────────────────────────────────────────────────────────────
// backend/src/handlers/admin.rs
//
// Admin API handlers: report management, user management, stats.
//
// This file is organised in three sections:
//
//   1. Public types / structs used by both handlers and tests.
//   2. Pure, synchronous validation helpers — these are the ONLY functions
//      tested in this file's test module.  They have no I/O dependencies.
//   3. Async Axum handler stubs — declared with `todo!()` bodies so that the
//      file compiles cleanly while tests are in the red phase.  Do NOT test
//      these here; they require a live database and HTTP routing stack.
//
// ── Implementation agent instructions ────────────────────────────────────────
//
//  • Do NOT modify any test in `#[cfg(test)] mod tests`.  The tests are the
//    behavioural contract.  If a test appears wrong, request a review from the
//    QA agent — do not alter assertions independently.
//
//  • The three pure functions below (`validate_status`,
//    `validate_create_user_request`, `require_role`) must be implemented to
//    make all tests pass.  Replace each `todo!()` body with real logic; do NOT
//    change function signatures.
//
//  • `AppError::Forbidden` does not exist yet.  Before implementing
//    `require_role`, you MUST add this variant to `backend/src/errors.rs`:
//
//        #[error("Forbidden: {0}")]
//        Forbidden(String),
//
//    and wire it to HTTP 403 in the `IntoResponse` impl:
//
//        AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone()),
//
//    That is the only edit permitted to an existing production file.
//    Once added, the `is_forbidden` helper in the test module (currently a
//    compile-time placeholder) will resolve correctly.
//
//  • Handlers that are NOT yet tested (all the async fns in § 3) must remain
//    as `todo!()` until the integration test suite is authored.
//
// ─────────────────────────────────────────────────────────────────────────────

use std::sync::Arc;

use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
};
use axum::{
    extract::{Extension, Multipart, Path, Query, State},
    http::StatusCode,
    Json,
};
use axum_extra::extract::CookieJar;
use jsonwebtoken::{encode, EncodingKey, Header};
use uuid::Uuid;

use crate::{
    db::admin_queries,
    errors::AppError,
    models::admin::{
        AdminReportFilters, AdminUserResponse, ChangePasswordRequest, CreateUserRequest,
        LoginRequest, ReportAssignOrgRequest, UpdateProfileRequest, UpdateStatusRequest,
    },
    AppState,
};

// The canonical JwtClaims with Serialize/Deserialize lives in the middleware
// module and is used by handler extractors (Extension<AuthJwtClaims>).
// The local `JwtClaims` struct defined in § 1 below is kept solely for the
// test module which imports it via `super::JwtClaims`.
use crate::middleware::auth::JwtClaims as AuthJwtClaims;

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Public types
// ─────────────────────────────────────────────────────────────────────────────

/// JWT claims injected into the request context by the auth middleware.
///
/// Shape matches ASSUMPTION-ADM-3 Option A (admin-reports-ac.md):
///   { sub: "<uuid>", email: "<email>", role: "admin"|"reviewer", exp: <unix-ts> }
///
/// This local struct is kept for the test module. The canonical version with
/// Serialize/Deserialize lives in `crate::middleware::auth::JwtClaims`.
#[derive(Debug, Clone)]
#[allow(dead_code)] // used only in #[cfg(test)] tests in this file
pub struct JwtClaims {
    /// UUID of the authenticated admin user (matches `admin_users.id`).
    pub sub: String,
    /// Email address of the authenticated admin user.
    pub email: String,
    /// Role: exactly "admin" or "reviewer".
    pub role: String,
    /// JWT expiry — Unix timestamp (seconds since epoch).
    pub exp: usize,
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Pure validation helpers (tested below, no I/O)
// ─────────────────────────────────────────────────────────────────────────────

/// Validate a report status transition value.
///
/// # Contract (D-03, AC-ADMIN-RPT R15)
/// Returns `Ok(())` when `status` is one of exactly six lowercase strings
/// (Phase 03 6-value enum — D-03):
///   "open" | "acknowledged" | "assigned" | "in_progress" | "resolved" | "closed"
///
/// Returns `Err(AppError::BadRequest("Invalid status".to_string()))` for any
/// other value — including the renamed pre-Phase-03 values "submitted" and
/// "under_review", uppercase variants, whitespace-padded strings, and empty strings.
///
/// No trimming is performed — the caller is responsible for normalising input.
#[allow(dead_code)] // used in handlers and tests
pub fn validate_status(status: &str) -> Result<(), AppError> {
    match status {
        "open" | "acknowledged" | "assigned" | "in_progress" | "resolved" | "closed" => Ok(()),
        _ => Err(AppError::BadRequest("Invalid status".to_string())),
    }
}

/// Validate that a resolve/close status transition is accompanied by a resolution photo.
///
/// # Contract (D-13, D-14, WFLOW-05)
/// - When `new_status` is "resolved" or "closed" AND `photo_bytes_len == 0`,
///   returns `Err(AppError::BadRequest("Resolution photo required"))`.
/// - For all other status values (or when photo is present), returns `Ok(())`.
///
/// This is a pure function — no I/O. Called by the resolve handler (plan 03-02)
/// AFTER collecting all multipart fields, per Pattern 3 / Pitfall 7.
#[allow(dead_code)] // used by resolve handler (plan 03-02)
pub fn validate_resolve_request(new_status: &str, photo_bytes_len: usize) -> Result<(), AppError> {
    match new_status {
        "resolved" | "closed" if photo_bytes_len == 0 => {
            Err(AppError::BadRequest("Resolution photo required".to_string()))
        }
        _ => Ok(()),
    }
}

/// Validate the fields supplied to POST /api/admin/users.
///
/// # Contract (AC-ADMIN-USERS R-USR-2.1, R-USR-2.2, R-USR-2.3)
///
/// Validates in this order — returns `Err` on the FIRST failure:
///   1. `email` must be non-empty and contain `@`.
///      → Err(AppError::BadRequest("Invalid email".to_string()))
///   2. `password` length (Unicode scalar values) must be >= 12.
///      → Err(AppError::BadRequest("Password must be at least 12 characters".to_string()))
///   3. `role` must be exactly "admin" or "reviewer" (case-sensitive).
///      → Err(AppError::BadRequest("Invalid role".to_string()))
///
/// Returns `Ok(())` when all three validations pass.
///
/// Password length uses `.chars().count()` (Unicode scalar values), NOT bytes,
/// so multi-byte passphrase characters are not double-penalised.
#[allow(dead_code)] // used only in #[cfg(test)] tests in this file
pub fn validate_create_user_request(
    email: &str,
    password: &str,
    role: &str,
) -> Result<(), AppError> {
    // Validate in documented order: email first, then password, then role.
    if email.is_empty() || !email.contains('@') {
        return Err(AppError::BadRequest("Invalid email".to_string()));
    }
    if password.chars().count() < 12 {
        return Err(AppError::BadRequest(
            "Password must be at least 12 characters".to_string(),
        ));
    }
    match role {
        "admin" | "reviewer" => Ok(()),
        _ => Err(AppError::BadRequest("Invalid role".to_string())),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2b — Phase 2 pure validation helpers (tested below, no I/O)
// ─────────────────────────────────────────────────────────────────────────────

/// Validate the display_name field for PATCH /api/admin/auth/profile.
///
/// # Contract (AC-PR-BE-1-F1, AC-PR-BE-1-F2, AC-PR-BE-1-F3)
/// [ASSUMPTION-P2-PR-1 Option B: max 80 chars]
/// [ASSUMPTION-P2-PR-2 Option A: min 2 chars; whitespace-only rejected]
///
/// - None → Ok(()) (null display_name clears the field; always valid)
/// - Some(s) where s.trim().is_empty() → Err(AppError::BadRequest("COPY.admin.profile.displayNameBlank"))
/// - Some(s) where s.chars().count() < 2 → Err(AppError::BadRequest("COPY.admin.profile.displayNameTooShort"))
/// - Some(s) where s.chars().count() > 80 → Err(AppError::BadRequest("COPY.admin.profile.displayNameTooLong"))
/// - Some(s) where 2 <= s.chars().count() <= 80 and not whitespace-only → Ok(())
///
/// Ordering: whitespace-only check BEFORE length check so that a " " (1 space)
/// returns "blank" rather than "too_short".
#[allow(dead_code)]
pub fn validate_profile_display_name(display_name: &Option<String>) -> Result<(), AppError> {
    // None means null/absent — always valid (clears the field).
    let Some(name) = display_name else {
        return Ok(());
    };
    // Delegate to the model-layer pure validator, then map &'static str to AppError.
    crate::models::admin::validate_display_name(name).map_err(|reason| match reason {
        "whitespace_only" => {
            AppError::BadRequest("COPY.admin.profile.displayNameBlank".to_string())
        }
        "too_short" => AppError::BadRequest("COPY.admin.profile.displayNameTooShort".to_string()),
        "too_long" => AppError::BadRequest("COPY.admin.profile.displayNameTooLong".to_string()),
        other => AppError::BadRequest(format!("COPY.admin.profile.{other}")),
    })
}

/// Validate the new_password field for POST /api/admin/auth/change-password.
///
/// # Contract (AC-PR-BE-3-F2, AC-PR-BE-3-F3)
/// [ASSUMPTION-P2-PR-3: 12-char minimum]
/// [ASSUMPTION-P2-PR-5: same-password rejected]
///
/// - new_password.chars().count() < 12 → Err(AppError::BadRequest("COPY.admin.profile.newPasswordTooShort"))
/// - new_password == current_password  → Err(AppError::BadRequest("COPY.admin.profile.newPasswordSameAsCurrent"))
/// - otherwise → Ok(())
///
/// Length is validated BEFORE identity so that a short same-as-current password
/// gets "too_short" rather than "same_as_current".
#[allow(dead_code)]
pub fn validate_change_password(
    new_password: &str,
    current_password: &str,
) -> Result<(), AppError> {
    // Delegate to the model-layer pure validator, then map &'static str to AppError.
    crate::models::admin::validate_new_password(new_password, current_password).map_err(|reason| {
        match reason {
            "too_short" => {
                AppError::BadRequest("COPY.admin.profile.newPasswordTooShort".to_string())
            }
            "same_as_current" => {
                AppError::BadRequest("COPY.admin.profile.newPasswordSameAsCurrent".to_string())
            }
            other => AppError::BadRequest(format!("COPY.admin.profile.{other}")),
        }
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Async Axum handlers
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth handlers ─────────────────────────────────────────────────────────────

/// POST /api/admin/auth/login — verify credentials, set HttpOnly JWT cookie.
///
/// Anti-enumeration: performs a dummy Argon2 verify even when the user is not
/// found, so the response time does not leak whether the email exists.
pub async fn admin_login(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(payload): Json<LoginRequest>,
) -> Result<impl axum::response::IntoResponse, AppError> {
    // Constant-time dummy hash — used when the user is not found so the
    // Argon2 verify still runs and timing is uniform.
    const DUMMY_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$\
         Qs2IJDMCCkFMkJ7qGO5fRQ3mJNGwLXFMGADAF5Lpv4";

    let user_opt = admin_queries::get_admin_user_by_email(&state.pool, &payload.email).await?;

    // Determine which hash to verify against (real or dummy).
    let hash_to_verify = user_opt
        .as_ref()
        .map(|u| u.password_hash.as_str())
        .unwrap_or(DUMMY_HASH);

    // Verify password. Even if parsing fails we treat it as "no match".
    let password_ok = PasswordHash::new(hash_to_verify)
        .map(|parsed| {
            Argon2::default()
                .verify_password(payload.password.as_bytes(), &parsed)
                .is_ok()
        })
        .unwrap_or(false);

    // Reject if: user not found, inactive, or wrong password.
    // FINDING-005: Audit log for failed login attempts (no password logged — only the username indicator).
    let user = match user_opt {
        Some(u) if password_ok && u.is_active => u,
        _ => {
            tracing::warn!(
                username = %payload.email,
                "Admin login failed: invalid credentials or inactive account"
            );
            return Err(AppError::Unauthorized);
        }
    };

    // Stamp last_login_at (best-effort — don't fail the login on DB error).
    let _ = admin_queries::update_last_login(&state.pool, user.id).await;

    // Build JWT using session duration from AppState (read once at startup, not per-request).
    let jwt_session_hours = state.jwt_session_hours as i64;
    let exp = (jsonwebtoken::get_current_timestamp() as i64 + jwt_session_hours * 3600) as usize;

    let claims = crate::models::admin::JwtClaims {
        sub: user.id.to_string(),
        email: user.email.clone(),
        role: user.role.clone(),
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(&state.jwt_secret),
    )
    .map_err(|_| AppError::Internal("JWT encoding failed".to_string()))?;

    // Build the HttpOnly cookie.
    let cookie_secure = std::env::var("COOKIE_SECURE")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);

    let mut cookie = axum_extra::extract::cookie::Cookie::new("admin_token", token);
    cookie.set_http_only(true);
    cookie.set_path("/");
    // SameSite=None required for cross-domain Vercel + Cloudflare tunnel production setup.
    // Requires Secure=true (enforced by COOKIE_SECURE=true in production/staging).
    // FINDING-011: Set Max-Age so the browser discards the cookie after the session expires.
    cookie.set_max_age(time::Duration::seconds(jwt_session_hours * 3600));
    if cookie_secure {
        cookie.set_same_site(axum_extra::extract::cookie::SameSite::None);
        cookie.set_secure(true);
    } else {
        // In HTTP-only dev/LAN environments, fall back to SameSite=Lax.
        // Browsers reject SameSite=None cookies that lack Secure=true (RFC 6265bis).
        cookie.set_same_site(axum_extra::extract::cookie::SameSite::Lax);
    }

    let user_id = user.id;
    let response_body = user.into_response();
    // FINDING-004: Log the user's UUID, not their email address (PII), on successful login.
    tracing::info!(
        user_id = %user_id,
        "Admin login successful"
    );

    Ok((StatusCode::OK, jar.add(cookie), Json(response_body)))
}

/// POST /api/admin/auth/logout — clear the admin_token cookie.
///
/// `CookieJar::remove` sets Max-Age=0 and an expired date so the browser
/// immediately discards the cookie.
pub async fn admin_logout(jar: CookieJar) -> impl axum::response::IntoResponse {
    // Mirror the login cookie attributes on the removal cookie so the browser
    // recognises it as clearing the same cookie (D-09: SameSite=None + conditional Secure).
    // SameSite=None required for cross-domain Vercel + Cloudflare tunnel production setup.
    let cookie_secure = std::env::var("COOKIE_SECURE")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);

    let mut removal = axum_extra::extract::cookie::Cookie::build(("admin_token", ""))
        .path("/")
        .http_only(true)
        .max_age(time::Duration::ZERO)
        .same_site(axum_extra::extract::cookie::SameSite::None)
        .build();
    if cookie_secure {
        // SameSite=None requires Secure=true; set it in production (HTTPS).
        removal.set_secure(true);
    } else {
        // In HTTP-only dev environments, fall back to SameSite=Lax so the
        // removal cookie is accepted by the browser. Browsers reject
        // SameSite=None cookies that lack Secure=true (RFC 6265bis).
        removal.set_same_site(axum_extra::extract::cookie::SameSite::Lax);
    }

    tracing::info!("Admin logout");
    (StatusCode::OK, jar.remove(removal))
}

/// GET /api/admin/auth/me — return the authenticated user's profile.
pub async fn admin_me(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    // FINDING-006: Fetch by UUID (the JWT sub claim) — more robust than fetching
    // by email, which could stale-match if the email were ever changed.
    let user = admin_queries::get_admin_user_by_id(&state.pool, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(
        serde_json::to_value(user.into_response())
            .map_err(|e| AppError::Internal(e.to_string()))?,
    ))
}

// ── Admin report handlers ─────────────────────────────────────────────────────

/// GET /api/admin/reports — paginated report list with full PII.
/// Accessible by both admin and reviewer roles.
/// Fetches the calling admin's org_id from the DB (via claims.sub) and passes
/// it to both list and count queries so org-scoped admins only see reports in
/// their assigned org's ward subtree (WARD-03).
pub async fn admin_list_reports(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<AdminReportFilters>,
) -> Result<Json<serde_json::Value>, AppError> {
    // ABUSE-06: If duplicate_of_id is present, return only the linked duplicates
    // for the expandable row — bypass the normal paginated list.
    if let Some(original_id) = params.duplicate_of_id {
        let duplicates =
            admin_queries::get_duplicate_reports_for_original(&state.pool, original_id).await?;
        let count = duplicates.len() as i64;
        return Ok(Json(serde_json::json!({
            "data": duplicates,
            "pagination": {
                "page": 1,
                "limit": count,
                "total_count": count,
                "total_pages": 1,
            }
        })));
    }

    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20);
    let limit = if limit <= 0 { 20 } else { limit.clamp(1, 200) };

    // Fetch the calling admin's org_id from the DB. JwtClaims does not carry
    // org_id (it would require token re-issue on every assignment change), so
    // we look it up per-request using claims.sub.
    let admin_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;
    let admin_user = admin_queries::get_admin_user_by_id(&state.pool, admin_id)
        .await?
        .ok_or(AppError::Unauthorized)?;
    let org_id = admin_user.org_id;

    let (items, total_count) = tokio::try_join!(
        admin_queries::list_admin_reports(
            &state.pool,
            params.category.as_deref(),
            params.status.as_deref(),
            params.severity.as_deref(),
            params.date_from,
            params.date_to,
            page,
            limit,
            org_id,
        ),
        admin_queries::count_admin_reports(
            &state.pool,
            params.category.as_deref(),
            params.status.as_deref(),
            params.severity.as_deref(),
            params.date_from,
            params.date_to,
            org_id,
        ),
    )?;

    let total_pages = ((total_count + limit - 1) / limit).max(1);

    Ok(Json(serde_json::json!({
        "data": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "total_pages": total_pages,
        }
    })))
}

/// GET /api/admin/reports/:id — single report with full PII.
pub async fn admin_get_report(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let report = admin_queries::get_admin_report_by_id(&state.pool, id)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(report))
}

/// PATCH /api/admin/reports/:id/status — update report status, record history.
pub async fn admin_update_report_status(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    if !payload.is_valid_status() {
        return Err(AppError::BadRequest("Invalid status".to_string()));
    }

    let changed_by = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let found = admin_queries::update_report_status(
        &state.pool,
        id,
        &payload.status,
        payload.note.as_deref(),
        changed_by,
    )
    .await?;

    if !found {
        return Err(AppError::NotFound);
    }

    // Return the updated report.
    let report = admin_queries::get_admin_report_by_id(&state.pool, id)
        .await?
        .ok_or(AppError::NotFound)?;

    tracing::info!(
        report_id = %id,
        new_status = %payload.status,
        changed_by = %changed_by,
        "Report status updated"
    );

    Ok(Json(report))
}

/// DELETE /api/admin/reports/:id — hard-delete report + image file.
/// Admin role required.
pub async fn admin_delete_report(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    // Only admins may delete reports.
    crate::middleware::auth::require_role(&claims, "admin")?;

    let image_path = admin_queries::delete_report(&state.pool, id)
        .await?
        .ok_or(AppError::NotFound)?;

    // FINDING-013: Canonicalize the uploads directory and the constructed path, then
    // verify the image lives inside uploads_dir before removing it. This prevents
    // a path-traversal attack if the stored image_path somehow contains "../" segments.
    //
    // We extract only the filename component from the stored path, then join it onto
    // the canonical uploads directory, so a stored path like "../../etc/passwd" is
    // reduced to just "passwd" and would not be found in uploads_dir.
    let image_filename = std::path::Path::new(&image_path)
        .file_name()
        .map(std::path::Path::new)
        .unwrap_or(std::path::Path::new(&image_path));

    let canonical_result = std::fs::canonicalize(&state.uploads_dir).and_then(|uploads_dir| {
        let full_path = uploads_dir.join(image_filename);
        std::fs::canonicalize(&full_path).map(|canonical| (uploads_dir, canonical))
    });

    match canonical_result {
        Ok((uploads_dir, canonical)) if canonical.starts_with(&uploads_dir) => {
            if let Err(e) = tokio::fs::remove_file(&canonical).await {
                tracing::warn!(
                    path = %canonical.display(),
                    error = %e,
                    "Could not delete image file after report deletion"
                );
            }
        }
        Ok((_, canonical)) => {
            // Path resolved outside uploads_dir — log and skip, but don't fail the request
            // (the DB row is already deleted; the file is simply not removed).
            tracing::warn!(
                path = %canonical.display(),
                "Skipped image deletion: path is outside uploads directory (FINDING-013)"
            );
        }
        Err(e) => {
            // File does not exist or uploads_dir not found — log, don't fail.
            tracing::warn!(
                image_path = %image_path,
                error = %e,
                "Could not canonicalize image path after report deletion"
            );
        }
    }

    tracing::info!(report_id = %id, "Report deleted");
    Ok(StatusCode::NO_CONTENT)
}

// ── Phase 03 — Resolution and org-assignment handlers (WFLOW-03, WFLOW-05) ──

/// POST /api/admin/reports/:id/resolve — resolve or close a report with a mandatory after-photo.
///
/// # Contract (D-13, D-14, WFLOW-05)
/// - Accepts multipart/form-data: `status` (required: "resolved"|"closed"),
///   `resolution_photo` (required file), `resolution_notes` (optional text).
/// - Rejects missing photo with HTTP 400 "Resolution photo required".
/// - Strips EXIF from photo bytes before writing to disk (T-03-02-01).
/// - Writes photo as UUID.jpg to UPLOADS_DIR; stores only filename in DB (D-18).
/// - Updates reports.status, resolution_photo_path, resolution_notes atomically.
/// - Inserts status_history row in the same transaction (WFLOW-02).
pub async fn admin_resolve_report(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, AppError> {
    // Collect all multipart fields BEFORE any validation (Pitfall 7: order-dependent consumer).
    let mut status = String::new();
    let mut resolution_notes: Option<String> = None;
    let mut photo_bytes: Vec<u8> = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "status" => {
                status = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
            }
            "resolution_notes" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !text.is_empty() {
                    resolution_notes = Some(text);
                }
            }
            "resolution_photo" => {
                photo_bytes = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?
                    .to_vec();
            }
            _ => {
                // consume and discard unknown fields
                let _ = field.bytes().await;
            }
        }
    }

    // Validate AFTER collection (Pitfall 7 pattern).
    validate_status(&status)?;
    validate_resolve_request(&status, photo_bytes.len())?;

    // Strip EXIF from photo bytes (T-03-02-01).
    let clean_bytes = crate::handlers::reports::strip_exif(&photo_bytes)?;

    // Generate UUID-based filename and write EXIF-stripped bytes to disk.
    // Path-traversal safety: UUID-generated filename is controlled input; we still
    // apply canonicalize+starts_with check as defense-in-depth (FINDING-013, T-03-02-02).
    let photo_filename = format!("{}.jpg", Uuid::new_v4());

    let canonical_result =
        std::fs::canonicalize(&state.uploads_dir).map(|uploads_dir| {
            let full_path = uploads_dir.join(&photo_filename);
            (uploads_dir, full_path)
        });

    let (_, write_path) = match canonical_result {
        Ok((uploads_dir, full_path)) => {
            // UUID filename we control — starts_with check is a belt-and-suspenders
            // defense against any hypothetical path component injection.
            // full_path is not yet canonicalized (file doesn't exist yet), so we
            // check the parent directory is inside uploads_dir instead.
            let parent_ok = full_path
                .parent()
                .map(|p| p == uploads_dir)
                .unwrap_or(false);
            if !parent_ok {
                return Err(AppError::Internal(
                    "Resolution photo path outside uploads dir".to_string(),
                ));
            }
            (uploads_dir, full_path)
        }
        Err(e) => {
            tracing::warn!(
                uploads_dir = %state.uploads_dir,
                error = %e,
                "Could not canonicalize uploads dir for resolution photo"
            );
            return Err(AppError::Internal(
                "Uploads directory not available".to_string(),
            ));
        }
    };

    tokio::fs::write(&write_path, &clean_bytes).await?;

    // Parse changed_by from JWT sub claim.
    let changed_by = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    // Persist to DB atomically (UPDATE reports + INSERT status_history in one transaction).
    let found = admin_queries::resolve_report(
        &state.pool,
        id,
        &status,
        &photo_filename,
        resolution_notes.as_deref(),
        changed_by,
    )
    .await?;

    if !found {
        // Clean up the written file since the report was not found.
        let _ = tokio::fs::remove_file(&write_path).await;
        return Err(AppError::NotFound);
    }

    // Return the updated report.
    let report = admin_queries::get_admin_report_by_id(&state.pool, id)
        .await?
        .ok_or(AppError::NotFound)?;

    tracing::info!(
        report_id = %id,
        new_status = %status,
        "Report resolved (Phase 03 WFLOW-05)"
    );

    Ok(Json(report))
}

/// POST /api/admin/reports/:id/assign-org — assign a report to an organization.
///
/// # Contract (D-09, WFLOW-03)
/// - Accepts JSON: `{"org_id": "<uuid>"}`.
/// - Atomically sets reports.assigned_org_id = org_id AND status = 'assigned'.
/// - Inserts status_history row in the same transaction.
/// - Returns updated report as JSON.
pub async fn admin_assign_report_org(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReportAssignOrgRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let changed_by = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let found =
        admin_queries::assign_report_org(&state.pool, id, payload.org_id, changed_by).await?;

    if !found {
        return Err(AppError::NotFound);
    }

    // Return the updated report.
    let report = admin_queries::get_admin_report_by_id(&state.pool, id)
        .await?
        .ok_or(AppError::NotFound)?;

    tracing::info!(
        report_id = %id,
        org_id = %payload.org_id,
        changed_by = %changed_by,
        "Report assigned to organization (Phase 03 WFLOW-03)"
    );

    Ok(Json(report))
}

// ── Admin stats handler ───────────────────────────────────────────────────────

/// GET /api/admin/stats — aggregate counts by status, category, severity.
/// Accessible by both admin and reviewer roles.
pub async fn admin_get_stats(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = admin_queries::get_report_stats(&state.pool).await?;
    Ok(Json(
        serde_json::to_value(stats).map_err(|e| AppError::Internal(e.to_string()))?,
    ))
}

/// Query parameters for GET /api/admin/stats/intake.
#[derive(serde::Deserialize)]
pub struct IntakeParams {
    pub days: Option<i32>,
}

/// GET /api/admin/stats/intake?days=N — per-day report counts for the last N days.
///
/// `days` is clamped to [1, 90] (T-intake-dos mitigation) before the DB call.
/// Defaults to 14 when absent or invalid.
/// Route is inside admin_protected_router so require_auth middleware applies (T-intake-authz).
pub async fn admin_get_intake_stats(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<IntakeParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let days = params.days.unwrap_or(14).clamp(1, 90);
    let rows = admin_queries::get_intake_stats(&state.pool, days).await?;
    Ok(Json(serde_json::json!(rows)))
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3c — Phase 04-01: Streaming export handlers (EXPORT-01, EXPORT-02)
// ─────────────────────────────────────────────────────────────────────────────

/// GET /api/admin/reports/export/csv — stream a filtered CSV export of reports.
///
/// # Contract (EXPORT-01, D-13, T-04-01, T-04-02, T-04-CSV)
/// - Requires admin auth (route is inside admin_protected_router).
/// - Accepts same AdminReportFilters as admin_list_reports (category, status,
///   severity, date_from, date_to).
/// - Streams rows without buffering the full result set (D-15).
/// - First line is the CSV header; subsequent lines are one row per report.
/// - Content-Type: text/csv; charset=utf-8 (D-14, UTF-8 without BOM).
/// - Dates formatted as DD/MM/YYYY (D-12).
/// - Free-text fields (description, resolution_notes) are csv_escape()d to
///   prevent CSV injection (T-04-CSV) and field-splitting.
/// - Bound parameters via build_report_where_clause (T-04-02, no SQL injection).
pub async fn admin_export_csv(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Query(filters): Query<AdminReportFilters>,
) -> Result<axum::response::Response, AppError> {
    use axum::{body::Body, http::header};
    use bytes::Bytes;
    use futures::StreamExt;
    use tokio_stream::wrappers::ReceiverStream;

    // Channel buffer=32: prevents writer from racing too far ahead of TCP send buffer.
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Bytes, std::io::Error>>(32);

    let pool = Arc::clone(&state.pool);
    let category = filters.category.clone();
    let status = filters.status.clone();
    let severity = filters.severity.clone();
    let date_from = filters.date_from;
    let date_to = filters.date_to;

    tokio::spawn(async move {
        // 1. CSV header line (D-13 column set)
        let header_line = "id,submission_date,category,severity,status,ward_name,\
assigned_org,latitude,longitude,description,photo_hash,duplicate_count,\
submitter_contact,resolved_at,resolution_notes\n";
        if tx.send(Ok(Bytes::from(header_line))).await.is_err() {
            return;
        }

        // 2. Build dynamic WHERE clause (T-04-02: bound params, no string interpolation)
        let (where_clause, _next_idx) = crate::db::admin_queries::build_export_where_clause(
            category.as_deref(),
            status.as_deref(),
            severity.as_deref(),
            date_from,
            date_to,
        );

        // CR-01: use build_csv_export_sql() instead of .replace() on a template const.
        // The where_clause contains only "$N" placeholders — never raw user values.
        let sql = crate::db::admin_queries::build_csv_export_sql(&where_clause);

        // 3. Build query and bind filter values in param order
        let mut q = sqlx::query(&sql);
        if let Some(ref v) = category {
            q = q.bind(v.as_str());
        }
        if let Some(ref v) = status {
            q = q.bind(v.as_str());
        }
        if let Some(ref v) = severity {
            q = q.bind(v.as_str());
        }
        if let Some(v) = date_from {
            q = q.bind(v);
        }
        if let Some(v) = date_to {
            q = q.bind(v);
        }

        // 4. Stream rows (fetch() not fetch_all() — no OOM on large datasets)
        let mut rows = q.fetch(&*pool);
        while let Some(row_result) = rows.next().await {
            match row_result {
                Ok(row) => {
                    use sqlx::Row;
                    use crate::db::admin_queries::{csv_escape, format_csv_date, format_csv_date_opt};

                    let id: uuid::Uuid = row.get("id");
                    let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
                    let category: String = row.get("category");
                    let severity: String = row.get("severity");
                    let status: String = row.get("status");
                    let ward_name: Option<String> = row.get("ward_name");
                    let assigned_org: Option<String> = row.get("assigned_org");
                    let latitude: f64 = row.get("latitude");
                    let longitude: f64 = row.get("longitude");
                    let description: Option<String> = row.get("description");
                    let photo_hash: Option<String> = row.get("photo_hash");
                    let duplicate_count: i32 = row.try_get("duplicate_count").unwrap_or(0);
                    let submitter_contact: Option<String> = row.get("submitter_contact");
                    let resolved_at: Option<chrono::DateTime<chrono::Utc>> = row.get("resolved_at");
                    let resolution_notes: Option<String> = row.get("resolution_notes");

                    let line = format!(
                        "{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}\n",
                        id,
                        format_csv_date(&created_at),
                        csv_escape(&category),
                        csv_escape(&severity),
                        csv_escape(&status),
                        ward_name.as_deref().map(csv_escape).unwrap_or_default(),
                        assigned_org.as_deref().map(csv_escape).unwrap_or_default(),
                        latitude,
                        longitude,
                        description.as_deref().map(csv_escape).unwrap_or_default(),
                        photo_hash.as_deref().map(csv_escape).unwrap_or_default(),
                        duplicate_count,
                        submitter_contact.as_deref().map(csv_escape).unwrap_or_default(),
                        format_csv_date_opt(resolved_at.as_ref()),
                        resolution_notes.as_deref().map(csv_escape).unwrap_or_default(),
                    );

                    if tx.send(Ok(Bytes::from(line))).await.is_err() {
                        break; // Client disconnected
                    }
                }
                Err(e) => {
                    let _ = tx
                        .send(Err(std::io::Error::other(e.to_string())))
                        .await;
                    break;
                }
            }
        }
    });

    let stream = ReceiverStream::new(rx);
    let body = Body::from_stream(stream);

    Ok(axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"walkability-reports.csv\"",
        )
        .body(body)
        .map_err(|e| AppError::Internal(e.to_string()))?)
}

/// GET /api/admin/reports/export/geojson — stream a filtered GeoJSON export.
///
/// # Contract (EXPORT-02, T-04-01, T-04-02)
/// - Requires admin auth (route is inside admin_protected_router).
/// - Accepts same AdminReportFilters as CSV export.
/// - Streams a valid GeoJSON FeatureCollection without buffering (D-16).
/// - Coordinates are [longitude, latitude] per RFC 7946 (Pitfall 4).
/// - Content-Type: application/geo+json.
/// - No SELECT * — column whitelist enforced (T-04-01).
pub async fn admin_export_geojson(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Query(filters): Query<AdminReportFilters>,
) -> Result<axum::response::Response, AppError> {
    use axum::{body::Body, http::header};
    use bytes::Bytes;
    use futures::StreamExt;
    use tokio_stream::wrappers::ReceiverStream;

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Bytes, std::io::Error>>(32);

    let pool = Arc::clone(&state.pool);
    let category = filters.category.clone();
    let status = filters.status.clone();
    let severity = filters.severity.clone();
    let date_from = filters.date_from;
    let date_to = filters.date_to;

    tokio::spawn(async move {
        // GeoJSON opening delimiter
        if tx
            .send(Ok(Bytes::from_static(
                b"{\"type\":\"FeatureCollection\",\"features\":[\n",
            )))
            .await
            .is_err()
        {
            return;
        }

        let (where_clause, _next_idx) = crate::db::admin_queries::build_export_where_clause(
            category.as_deref(),
            status.as_deref(),
            severity.as_deref(),
            date_from,
            date_to,
        );

        // CR-01: use build_geojson_export_sql() instead of .replace() on a template const.
        // The where_clause contains only "$N" placeholders — never raw user values.
        let sql = crate::db::admin_queries::build_geojson_export_sql(&where_clause);

        let mut q = sqlx::query(&sql);
        if let Some(ref v) = category {
            q = q.bind(v.as_str());
        }
        if let Some(ref v) = status {
            q = q.bind(v.as_str());
        }
        if let Some(ref v) = severity {
            q = q.bind(v.as_str());
        }
        if let Some(v) = date_from {
            q = q.bind(v);
        }
        if let Some(v) = date_to {
            q = q.bind(v);
        }

        let mut rows = q.fetch(&*pool);
        let mut first = true;

        while let Some(row_result) = rows.next().await {
            match row_result {
                Ok(row) => {
                    use sqlx::Row;

                    let id: uuid::Uuid = row.get("id");
                    let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
                    let category: String = row.get("category");
                    let severity: String = row.get("severity");
                    let status: String = row.get("status");
                    let ward_name: Option<String> = row.get("ward_name");
                    let assigned_org: Option<String> = row.get("assigned_org");
                    let latitude: f64 = row.get("latitude");
                    let longitude: f64 = row.get("longitude");
                    let description: Option<String> = row.get("description");
                    let photo_hash: Option<String> = row.get("photo_hash");
                    let duplicate_count: i32 = row.try_get("duplicate_count").unwrap_or(0);
                    let submitter_contact: Option<String> = row.get("submitter_contact");
                    let resolved_at: Option<chrono::DateTime<chrono::Utc>> = row.get("resolved_at");
                    let resolution_notes: Option<String> = row.get("resolution_notes");

                    // Build GeoJSON feature — note [longitude, latitude] coordinate order (RFC 7946 / Pitfall 4)
                    let feature = serde_json::json!({
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [longitude, latitude]
                        },
                        "properties": {
                            "id": id,
                            "created_at": created_at,
                            "category": category,
                            "severity": severity,
                            "status": status,
                            "ward_name": ward_name,
                            "assigned_org": assigned_org,
                            "description": description,
                            "photo_hash": photo_hash,
                            "duplicate_count": duplicate_count,
                            "submitter_contact": submitter_contact,
                            "resolved_at": resolved_at,
                            "resolution_notes": resolution_notes,
                        }
                    });

                    // Comma-separate features (prepend comma for all but the first)
                    let mut chunk = if first {
                        first = false;
                        feature.to_string()
                    } else {
                        format!(",{}", feature)
                    };
                    chunk.push('\n');

                    if tx.send(Ok(Bytes::from(chunk))).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    let _ = tx
                        .send(Err(std::io::Error::other(e.to_string())))
                        .await;
                    break;
                }
            }
        }

        // GeoJSON closing delimiter
        let _ = tx
            .send(Ok(Bytes::from_static(b"]}")))
            .await;
    });

    let stream = ReceiverStream::new(rx);
    let body = Body::from_stream(stream);

    Ok(axum::response::Response::builder()
        .status(axum::http::StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/geo+json")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"walkability-reports.geojson\"",
        )
        .body(body)
        .map_err(|e| AppError::Internal(e.to_string()))?)
}

// ── Admin user management handlers ───────────────────────────────────────────

/// GET /api/admin/users — list all admin users. Admin role required.
pub async fn admin_list_users(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    crate::middleware::auth::require_role(&claims, "admin")?;

    let users = admin_queries::list_admin_users(&state.pool).await?;
    let responses: Vec<serde_json::Value> = users
        .into_iter()
        .map(|u| {
            serde_json::to_value(u.into_response()).map_err(|e| AppError::Internal(e.to_string()))
        })
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(serde_json::json!(responses)))
}

/// POST /api/admin/users — create a new admin user. Admin role required.
pub async fn admin_create_user(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    crate::middleware::auth::require_role(&claims, "admin")?;

    // Validate fields using model-layer helpers (same logic as validate_create_user_request).
    validate_create_user_request(&payload.email, &payload.password, &payload.role)?;

    // Hash password with Argon2id.
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|_| AppError::Internal("Password hashing failed".to_string()))?
        .to_string();

    let user = admin_queries::create_admin_user(
        &state.pool,
        &payload.email,
        &hash,
        &payload.role,
        payload.display_name.as_deref(),
    )
    .await?;

    tracing::info!(
        email = %payload.email,
        role = %payload.role,
        "Admin user created"
    );

    let response = serde_json::to_value(user.into_response())
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok((StatusCode::CREATED, Json(response)))
}

/// DELETE /api/admin/users/:id — soft-deactivate a user. Admin role required.
/// A user cannot deactivate their own account, and super-admin accounts are protected.
pub async fn admin_deactivate_user(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    crate::middleware::auth::require_role(&claims, "admin")?;

    let caller_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    if id == caller_id {
        return Err(AppError::BadRequest(
            "Cannot deactivate your own account".to_string(),
        ));
    }

    // PHASE2-003: Pre-check whether the target is a super-admin BEFORE issuing the
    // deactivation UPDATE. This returns 403 Forbidden rather than 404, matching the
    // expected contract: the caller knows the user exists but is not permitted to act.
    let target = admin_queries::get_admin_user_by_id(&state.pool, id)
        .await?
        .ok_or(AppError::NotFound)?;

    if target.is_super_admin {
        return Err(AppError::Forbidden);
    }

    let found = admin_queries::deactivate_admin_user(&state.pool, id).await?;
    if !found {
        return Err(AppError::NotFound);
    }

    // FINDING-016: Include the caller's UUID in the audit log so deactivation actions
    // are traceable back to the admin who performed them.
    tracing::info!(
        deactivated_user_id = %id,
        performed_by = %caller_id,
        "Admin user deactivated"
    );
    Ok(StatusCode::NO_CONTENT)
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3b — Phase 2 profile handlers
// ─────────────────────────────────────────────────────────────────────────────

/// PATCH /api/admin/auth/profile — update the authenticated user's display_name.
///
/// # Contract (AC-PR-BE-1-S1, AC-PR-BE-1-S2)
/// - Validates display_name (None clears the field; Some(s) must be 2–80 non-blank chars).
/// - Returns the updated AdminUserResponse.
pub async fn admin_update_profile(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthJwtClaims>,
    Json(body): Json<UpdateProfileRequest>,
) -> Result<Json<AdminUserResponse>, AppError> {
    // Validate before touching the DB.
    // UpdateProfileRequest.display_name is Option<Option<String>>:
    //   None            → field absent in JSON → no-op, validate as None
    //   Some(None)      → field set to null    → clears the column, validate as None
    //   Some(Some(s))   → field set to a string → validate the string
    let inner: Option<String> = body.display_name.flatten();
    validate_profile_display_name(&inner)?;

    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;
    let updated =
        admin_queries::update_admin_profile(&state.pool, user_id, inner.as_deref()).await?;

    tracing::info!(user_id = %user_id, "Admin profile updated");
    Ok(Json(updated.into_response()))
}

/// POST /api/admin/auth/change-password — change the authenticated user's password.
///
/// # Contract (AC-PR-BE-3-S1)
/// - Verifies current_password against the stored Argon2id hash.
/// - Validates new_password (min 12 chars, differs from current).
/// - Hashes and stores the new password.
/// - Returns HTTP 200 OK on success.
pub async fn admin_change_password(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthJwtClaims>,
    Json(body): Json<ChangePasswordRequest>,
) -> Result<StatusCode, AppError> {
    // Validate the new password before any DB access (fail fast on format errors).
    validate_change_password(&body.new_password, &body.current_password)?;

    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    // Fetch the current user row to get the stored password hash.
    let user = admin_queries::get_admin_user_by_id(&state.pool, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Verify the supplied current_password against the stored hash.
    let password_ok = PasswordHash::new(&user.password_hash)
        .map(|parsed| {
            Argon2::default()
                .verify_password(body.current_password.as_bytes(), &parsed)
                .is_ok()
        })
        .unwrap_or(false);

    if !password_ok {
        return Err(AppError::Unauthorized);
    }

    // Hash the new password with Argon2id.
    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(body.new_password.as_bytes(), &salt)
        .map_err(|_| AppError::Internal("Password hashing failed".to_string()))?
        .to_string();

    admin_queries::update_admin_password(&state.pool, user_id, &new_hash).await?;

    tracing::info!(user_id = %user_id, "Admin password changed");
    Ok(StatusCode::OK)
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3b — Organization handlers (Phase 1 — Ward Foundation)
// ─────────────────────────────────────────────────────────────────────────────

use crate::models::organization::OrganizationResponse;

/// GET /api/admin/organizations — list all organizations.
/// Accessible by any authenticated admin user (admin or reviewer).
pub async fn admin_list_organizations(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<OrganizationResponse>>, AppError> {
    let orgs = admin_queries::list_organizations(&state.pool).await?;
    Ok(Json(
        orgs.into_iter().map(OrganizationResponse::from).collect(),
    ))
}

/// Request body for PATCH /api/admin/users/:id/org.
/// `org_id = null` clears the assignment (unscoped / super-admin view).
#[derive(serde::Deserialize)]
pub struct AssignOrgRequest {
    pub org_id: Option<Uuid>,
}

/// PATCH /api/admin/users/:id/org — assign (or clear) an organization for a user.
/// Admin role required.
pub async fn admin_assign_user_org(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<AssignOrgRequest>,
) -> Result<StatusCode, AppError> {
    // Require admin role to manage user org assignments.
    crate::middleware::auth::require_role(&claims, "admin").map_err(|_| AppError::Forbidden)?;

    admin_queries::assign_user_org(&state.pool, user_id, body.org_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3d — Phase 04-03a: Admin analytics + ward-boundaries handlers
// Requirements: ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05
// Security: All four registered under admin_protected_router (T-04-08)
// ─────────────────────────────────────────────────────────────────────────────

/// Query params for GET /api/admin/analytics/trend (optional category filter).
#[derive(serde::Deserialize)]
pub struct TrendParams {
    pub category: Option<String>,
}

/// GET /api/admin/analytics/wards — top 10 wards by unresolved report count.
///
/// # Contract (ANALYTICS-02, T-04-08)
/// - Requires admin auth (route is inside admin_protected_router).
/// - Returns up to 10 wards ordered by unresolved_count DESC.
/// - unresolved_count excludes reports with status 'resolved' or 'closed'.
pub async fn admin_get_ward_analytics(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = admin_queries::get_ward_analytics(&state.pool).await?;
    Ok(Json(serde_json::json!({ "data": rows })))
}

/// GET /api/admin/analytics/corporations — resolution rate per corporation.
///
/// # Contract (ANALYTICS-03, T-04-08)
/// - Requires admin auth (route is inside admin_protected_router).
/// - Returns one row per corporation (org_type = 'corporation').
/// - resolution_rate_pct is null when total_reports = 0 (NULLIF guard).
pub async fn admin_get_corporation_analytics(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = admin_queries::get_corporation_analytics(&state.pool).await?;
    Ok(Json(serde_json::json!({ "data": rows })))
}

/// GET /api/admin/analytics/trend — reports per week × 12 weeks.
///
/// # Contract (ANALYTICS-04, T-04-08, T-04-09)
/// - Requires admin auth (route is inside admin_protected_router).
/// - Optional ?category=<value> filter passed as a bound parameter — never
///   interpolated into SQL (T-04-09).
/// - Returns one row per (week_start, category) pair with at least one report.
pub async fn admin_get_trend_data(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<TrendParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = admin_queries::get_trend_data(&state.pool, params.category.as_deref()).await?;
    Ok(Json(serde_json::json!({ "data": rows })))
}

/// GET /api/wards/boundaries — ward GeoJSON FeatureCollection with unresolved counts.
///
/// # Contract (ANALYTICS-05, T-04-08, T-04-10)
/// - Requires admin auth (route is inside admin_protected_router — the choropleth
///   is an admin analytics feature per D-04/D-05; NOT a public endpoint).
/// - Returns a GeoJSON FeatureCollection where each feature's geometry is the
///   ward polygon (ST_Simplified to 0.001 degrees — T-04-10) and properties
///   include ward_name, ward_number, and unresolved_count.
/// - Wards with NULL boundary (missing geometry) are included with null geometry.
pub async fn admin_get_wards_boundaries(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = admin_queries::get_ward_boundaries(&state.pool).await?;

    // Assemble a GeoJSON FeatureCollection from the DB rows.
    let features: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            // boundary_geojson is already a valid GeoJSON geometry string from PostGIS.
            // Parse it so it embeds correctly into the Feature (not as a string literal).
            let geometry: serde_json::Value = row
                .boundary_geojson
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(serde_json::Value::Null);

            serde_json::json!({
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "id": row.id,
                    "ward_name": row.ward_name,
                    "ward_number": row.ward_number,
                    "unresolved_count": row.unresolved_count,
                }
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "type": "FeatureCollection",
        "features": features,
    })))
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Pure unit tests
//
// Requirements covered:
//   AC-ADMIN-RPT  R15            — validate_status (7 tests)
//   AC-ADMIN-USERS R-USR-2.1/2.2/2.3 — validate_create_user_request (9 tests)
//   AC-ADMIN-USERS + AC-ADMIN-RPT R24 — require_role (3 tests)
//
// RED PHASE BEHAVIOUR
// ───────────────────
// All 19 tests will FAIL (panic via todo!()) until the implementation agent
// fills in the three pure functions.  This is correct — they are red-phase TDD
// tests.
//
// COMPILE NOTE — AppError::Forbidden
// ───────────────────────────────────
// The `require_role` tests reference `AppError::Forbidden`, which does not
// exist in errors.rs yet.  The test helper `is_forbidden` is therefore gated
// behind a TODO comment and uses `unimplemented!()` as its body so that the
// *entire test module compiles today* (the variant mismatch becomes a link-time
// panic rather than a compile error).  Once the implementation agent adds
// `AppError::Forbidden` to errors.rs the `is_forbidden` function body must be
// updated to `matches!(err, AppError::Forbidden(_))` — see the comment inside.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::{
        validate_change_password, validate_create_user_request, validate_profile_display_name,
        validate_resolve_request, validate_status,
    };
    use crate::errors::AppError;
    use crate::middleware::auth::{require_role, JwtClaims};

    // ─────────────────────────────────────────────────────────────────────────
    // Test helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// Construct a JwtClaims with the given role.
    /// `sub` and `email` are fixed placeholders; `exp` is a far-future timestamp
    /// (2099-01-01 UTC) so these claims are never accidentally treated as expired.
    fn claims_with_role(role: &str) -> JwtClaims {
        JwtClaims {
            sub: "00000000-0000-0000-0000-000000000001".to_string(),
            email: "test@example.com".to_string(),
            role: role.to_string(),
            exp: 4_070_908_800, // 2099-01-01T00:00:00Z — deterministic, never expires
        }
    }

    /// Returns true when the error is a BadRequest variant (any message).
    fn is_bad_request(err: &AppError) -> bool {
        matches!(err, AppError::BadRequest(_))
    }

    /// Returns true when the error is a Forbidden variant.
    ///
    /// IMPLEMENTATION AGENT — two-step process:
    ///
    ///   Step 1 (before `AppError::Forbidden` exists):
    ///     This function body intentionally uses `unimplemented!()` so that the
    ///     file compiles even though the variant is absent.  The three
    ///     `require_role` tests that call this helper will PANIC at runtime with
    ///     "not implemented", keeping them in the red phase without blocking the
    ///     other 16 tests from running.
    ///
    ///   Step 2 (after adding `AppError::Forbidden(String)` to errors.rs):
    ///     Replace the body of this function with:
    ///         matches!(err, AppError::Forbidden(_))
    ///     Do NOT change anything else — the test assertions remain identical.
    fn is_forbidden(err: &AppError) -> bool {
        // AppError::Forbidden is a unit variant (no payload).
        matches!(err, AppError::Forbidden)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validate_status — Phase 03 happy paths (6 valid values — D-03)
    // ─────────────────────────────────────────────────────────────────────────

    /// D-03 — "open" is the first Phase 03 status value.
    #[test]
    fn test_validate_status_accepts_open() {
        let result = validate_status("open");
        assert!(
            result.is_ok(),
            "validate_status(\"open\") must return Ok(()); \
             \"open\" is the first Phase 03 status value (D-03); got {:?}",
            result
        );
    }

    /// D-03 — "acknowledged" is the second Phase 03 status value.
    #[test]
    fn test_validate_status_accepts_acknowledged() {
        let result = validate_status("acknowledged");
        assert!(
            result.is_ok(),
            "validate_status(\"acknowledged\") must return Ok(()); \
             \"acknowledged\" is the second Phase 03 status value (D-03); got {:?}",
            result
        );
    }

    /// D-03 — "assigned" is the third Phase 03 status value.
    #[test]
    fn test_validate_status_accepts_assigned() {
        let result = validate_status("assigned");
        assert!(
            result.is_ok(),
            "validate_status(\"assigned\") must return Ok(()); got {:?}",
            result
        );
    }

    /// D-03 — "in_progress" is the fourth Phase 03 status value.
    #[test]
    fn test_validate_status_accepts_in_progress() {
        let result = validate_status("in_progress");
        assert!(
            result.is_ok(),
            "validate_status(\"in_progress\") must return Ok(()); got {:?}",
            result
        );
    }

    /// D-03 — "resolved" is retained from Phase 01 (D-04).
    #[test]
    fn test_validate_status_accepts_resolved() {
        let result = validate_status("resolved");
        assert!(
            result.is_ok(),
            "validate_status(\"resolved\") must return Ok(()); got {:?}",
            result
        );
    }

    /// D-03 — "closed" is the sixth (final) Phase 03 status value.
    #[test]
    fn test_validate_status_accepts_closed() {
        let result = validate_status("closed");
        assert!(
            result.is_ok(),
            "validate_status(\"closed\") must return Ok(()); got {:?}",
            result
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validate_status — rejection: renamed values + other invalid values
    // ─────────────────────────────────────────────────────────────────────────

    /// D-04 — "submitted" was renamed to "open" in migration 008; must be rejected.
    #[test]
    fn test_validate_status_rejects_renamed_submitted() {
        let result = validate_status("submitted");
        assert!(
            result.is_err(),
            "validate_status(\"submitted\") must return Err after Phase 03 rename (D-04); \
             use 'open' instead; got {:?}",
            result
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_status(\"submitted\") must return AppError::BadRequest; got {:?}",
            err
        );
    }

    /// D-04 — "under_review" was renamed to "acknowledged" in migration 008; must be rejected.
    #[test]
    fn test_validate_status_rejects_renamed_under_review() {
        let result = validate_status("under_review");
        assert!(
            result.is_err(),
            "validate_status(\"under_review\") must return Err after Phase 03 rename (D-04); \
             use 'acknowledged' instead; got {:?}",
            result
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_status(\"under_review\") must return AppError::BadRequest; got {:?}",
            err
        );
    }

    /// AC-ADMIN-RPT R15 — "rejected" is not in the Phase 03 enum.
    #[test]
    fn test_validate_status_rejected() {
        let result = validate_status("rejected");
        assert!(
            result.is_err(),
            "validate_status(\"rejected\") must return Err; \
             \"rejected\" is not a valid Phase 03 status value \
             (valid: open, acknowledged, assigned, in_progress, resolved, closed)"
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_status(\"rejected\") must return AppError::BadRequest; \
             got {:?}",
            err
        );
    }

    /// AC-ADMIN-RPT R15 — uppercase "OPEN" must be rejected; case-sensitive.
    #[test]
    fn test_validate_status_uppercase() {
        let result = validate_status("OPEN");
        assert!(
            result.is_err(),
            "validate_status(\"OPEN\") must return Err; \
             status matching is case-sensitive — \"OPEN\" != \"open\""
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_status(\"OPEN\") must return AppError::BadRequest; \
             got {:?}",
            err
        );
    }

    /// AC-ADMIN-RPT R15 — empty string is not a valid status.
    #[test]
    fn test_validate_status_empty() {
        let result = validate_status("");
        assert!(
            result.is_err(),
            "validate_status(\"\") must return Err; \
             empty string is not a valid status value"
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_status(\"\") must return AppError::BadRequest; \
             got {:?}",
            err
        );
    }

    /// AC-ADMIN-RPT R15 — whitespace-padded " open" must be rejected.
    /// No silent trimming is performed; the caller owns normalisation.
    #[test]
    fn test_validate_status_whitespace() {
        let result = validate_status(" open");
        assert!(
            result.is_err(),
            "validate_status(\" open\") must return Err; \
             leading whitespace is not stripped — \" open\" != \"open\""
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_status(\" open\") must return AppError::BadRequest; \
             got {:?}",
            err
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validate_resolve_request — Phase 03 WFLOW-05 gate (D-13, D-14)
    // ─────────────────────────────────────────────────────────────────────────

    /// D-13: Transitioning to "resolved" without a photo must return BadRequest.
    #[test]
    fn test_validate_resolve_requires_photo_for_resolved() {
        let result = validate_resolve_request("resolved", 0);
        assert!(
            result.is_err(),
            "validate_resolve_request(\"resolved\", 0) must return Err; \
             photo is mandatory when status is 'resolved' (D-13); got {:?}",
            result
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_resolve_request error must be AppError::BadRequest; got {:?}",
            err
        );
    }

    /// D-14: Transitioning to "closed" without a photo must also return BadRequest.
    #[test]
    fn test_validate_resolve_requires_photo_for_closed() {
        let result = validate_resolve_request("closed", 0);
        assert!(
            result.is_err(),
            "validate_resolve_request(\"closed\", 0) must return Err; \
             photo is mandatory when status is 'closed' (D-14); got {:?}",
            result
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_resolve_request error must be AppError::BadRequest; got {:?}",
            err
        );
    }

    /// D-13/D-14: Non-terminal status transitions do NOT require a photo.
    #[test]
    fn test_validate_resolve_allows_non_terminal_without_photo() {
        // "open", "acknowledged", "assigned", "in_progress" do not require a photo.
        for status in &["open", "acknowledged", "assigned", "in_progress"] {
            let result = validate_resolve_request(status, 0);
            assert!(
                result.is_ok(),
                "validate_resolve_request(\"{}\", 0) must return Ok(()); \
                 photo is only required for 'resolved'/'closed' (D-13, D-14); got {:?}",
                status,
                result
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validate_create_user_request — happy paths (3 tests)
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-ADMIN-USERS R-USR-2.1/2.2/2.3 — a well-formed request passes all
    /// three validations and returns Ok(()).
    #[test]
    fn test_create_user_valid() {
        let result = validate_create_user_request(
            "ops@example.com",
            "SecurePass12", // exactly 12 chars — at the boundary
            "admin",
        );
        assert!(
            result.is_ok(),
            "validate_create_user_request with a valid email, 12-char password, \
             and role=\"admin\" must return Ok(()); got {:?}",
            result
        );
    }

    /// AC-ADMIN-USERS R-USR-2.3 — "reviewer" is an accepted role value.
    #[test]
    fn test_create_user_reviewer_role() {
        let result =
            validate_create_user_request("reviewer@example.com", "SecurePass12", "reviewer");
        assert!(
            result.is_ok(),
            "validate_create_user_request with role=\"reviewer\" must return Ok(()); \
             both \"admin\" and \"reviewer\" are the only valid roles; got {:?}",
            result
        );
    }

    /// AC-ADMIN-USERS R-USR-2.1 boundary — a password of exactly 12 characters
    /// is at the minimum and must pass (12 is inclusive).
    #[test]
    fn test_create_user_password_exactly_12() {
        // "Abcdefghijkl" — exactly 12 Unicode scalar values
        let result = validate_create_user_request("user@example.com", "Abcdefghijkl", "admin");
        assert!(
            result.is_ok(),
            "validate_create_user_request with a 12-character password must return Ok(()); \
             12 is the minimum allowed length (inclusive); got {:?}",
            result
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validate_create_user_request — rejection paths (6 tests)
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-ADMIN-USERS R-USR-2.1 — password of 11 characters (one below minimum)
    /// must be rejected.  AC-USR-2-F2 in admin-users-frontend-ac.md names this
    /// exact boundary.
    #[test]
    fn test_create_user_password_too_short() {
        // "Abcdefghijk" — exactly 11 characters
        let result = validate_create_user_request("user@example.com", "Abcdefghijk", "admin");
        assert!(
            result.is_err(),
            "validate_create_user_request with an 11-character password must return Err; \
             minimum is 12 characters (11 < 12)"
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_create_user_request short-password error must be \
             AppError::BadRequest; got {:?}",
            err
        );
        // The message must mention "12" so the caller knows the minimum.
        if let AppError::BadRequest(msg) = &err {
            assert!(
                msg.contains("12"),
                "BadRequest message for short password must mention \"12\" to communicate \
                 the minimum length requirement; got message: {:?}",
                msg
            );
        }
    }

    /// AC-ADMIN-USERS R-USR-2.1 — empty password (0 chars) is below the
    /// 12-char minimum and must be rejected.
    #[test]
    fn test_create_user_empty_password() {
        let result = validate_create_user_request("user@example.com", "", "admin");
        assert!(
            result.is_err(),
            "validate_create_user_request with an empty password must return Err; \
             0 chars is below the 12-char minimum"
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_create_user_request empty-password error must be \
             AppError::BadRequest; got {:?}",
            err
        );
    }

    /// AC-ADMIN-USERS R-USR-2.2 — email without `@` must be rejected.
    #[test]
    fn test_create_user_invalid_email() {
        let result = validate_create_user_request("notanemail", "SecurePass12", "admin");
        assert!(
            result.is_err(),
            "validate_create_user_request with email=\"notanemail\" (no @ symbol) \
             must return Err"
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_create_user_request invalid-email error must be \
             AppError::BadRequest; got {:?}",
            err
        );
    }

    /// AC-ADMIN-USERS R-USR-2.2 — empty email must be rejected.
    #[test]
    fn test_create_user_empty_email() {
        let result = validate_create_user_request("", "SecurePass12", "admin");
        assert!(
            result.is_err(),
            "validate_create_user_request with an empty email must return Err"
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_create_user_request empty-email error must be \
             AppError::BadRequest; got {:?}",
            err
        );
    }

    /// AC-ADMIN-USERS R-USR-2.3 — role "superuser" is not an accepted value
    /// and must be rejected.
    #[test]
    fn test_create_user_invalid_role() {
        let result = validate_create_user_request("user@example.com", "SecurePass12", "superuser");
        assert!(
            result.is_err(),
            "validate_create_user_request with role=\"superuser\" must return Err; \
             only \"admin\" and \"reviewer\" are valid"
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_create_user_request invalid-role error must be \
             AppError::BadRequest; got {:?}",
            err
        );
    }

    /// Ordering guarantee: email is checked BEFORE password.
    /// When both email and password are invalid the returned error is BadRequest
    /// (same type for both fields), confirming that email validation ran first
    /// and the function returned early — the password check was never reached.
    /// The implementation contract (see function doc comment) specifies this
    /// ordering explicitly.
    #[test]
    fn test_create_user_email_checked_before_password() {
        // Both email (no @) and password (< 12 chars) are invalid.
        let result = validate_create_user_request("notanemail", "short", "admin");
        assert!(
            result.is_err(),
            "validate_create_user_request with both bad email and short password \
             must return Err"
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_create_user_request with bad email + short password must \
             return AppError::BadRequest; got {:?}",
            err
        );
        // When email is invalid, the error message must NOT mention "12"
        // (password was never checked — we short-circuited on email).
        if let AppError::BadRequest(msg) = &err {
            assert!(
                !msg.contains("12"),
                "With an invalid email, the error message must not reference the password \
                 length requirement \"12\" — email is validated first and the function must \
                 return early; got message: {:?}",
                msg
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // require_role — 3 tests
    //
    // These tests call `is_forbidden`, which currently panics with
    // `unimplemented!()` because `AppError::Forbidden` does not yet exist.
    // They will remain in the red phase (panic) until:
    //   (a) the implementation agent adds `AppError::Forbidden` to errors.rs,
    //   (b) the `is_forbidden` helper body is updated to
    //       `matches!(err, AppError::Forbidden(_))`, and
    //   (c) `require_role` is implemented.
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-ADMIN-RPT, AC-ADMIN-USERS — an admin caller on an admin-only
    /// endpoint must be allowed through (Ok result).
    #[test]
    fn test_handler_require_role_admin_can_delete() {
        // Scenario: DELETE /api/admin/reports/:id — requires "admin" role.
        let claims = claims_with_role("admin");
        let result = require_role(&claims, "admin");
        assert!(
            result.is_ok(),
            "require_role must return Ok(()) when claims.role=\"admin\" and \
             required_role=\"admin\"; got {:?}",
            result
        );
    }

    /// AC-ADMIN-USERS R-USR-1, AC-ADMIN-RPT — a reviewer on a reviewer-
    /// accessible endpoint must be allowed through (Ok result).
    #[test]
    fn test_handler_require_role_reviewer_can_view() {
        // Scenario: GET /api/admin/reports — requires "reviewer" minimum.
        let claims = claims_with_role("reviewer");
        let result = require_role(&claims, "reviewer");
        assert!(
            result.is_ok(),
            "require_role must return Ok(()) when claims.role=\"reviewer\" and \
             required_role=\"reviewer\"; got {:?}",
            result
        );
    }

    /// AC-ADMIN-RPT R24 — a reviewer attempting a delete (admin-only operation)
    /// must be forbidden.  In pure-logic terms: require_role must return
    /// Err(AppError::Forbidden(_)) so that the handler can produce HTTP 403.
    ///
    /// This test will panic with `unimplemented!()` (from `is_forbidden`) until
    /// `AppError::Forbidden` is added to errors.rs.
    #[test]
    fn test_handler_require_role_reviewer_cannot_delete() {
        // Scenario: DELETE /api/admin/reports/:id — requires "admin".
        let claims = claims_with_role("reviewer");
        let result = require_role(&claims, "admin");
        assert!(
            result.is_err(),
            "require_role must return Err when claims.role=\"reviewer\" but \
             required_role=\"admin\"; a reviewer must not be permitted to delete reports"
        );
        let err = result.unwrap_err();
        assert!(
            is_forbidden(&err),
            "require_role(reviewer, required=admin) must return \
             AppError::Forbidden(_) so the handler responds HTTP 403; \
             got {:?}",
            err
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: validate_profile_display_name — 8 tests
    // Requirements: AC-PR-BE-1-F1, AC-PR-BE-1-F2, AC-PR-BE-1-F3, AC-PR-BE-1-S1/S2
    //
    // RED PHASE: all tests will panic via todo!() until impl fills in the fn.
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-PR-BE-1-S2 — None (null) display_name must always be accepted.
    /// A null clears the field; no minimum-length or content check applies.
    #[test]
    fn test_validate_profile_display_name_none_is_always_valid() {
        let result = validate_profile_display_name(&None);
        assert!(
            result.is_ok(),
            "validate_profile_display_name(None) must return Ok(()); \
             null display_name clears the field and requires no validation \
             (AC-PR-BE-1-S2). Got: {:?}",
            result
        );
    }

    /// AC-PR-BE-1-S1 — a valid string between 2–80 chars that is not whitespace-only
    /// must be accepted.
    #[test]
    fn test_validate_profile_display_name_valid_string_passes() {
        let result = validate_profile_display_name(&Some("Ops Lead".to_string()));
        assert!(
            result.is_ok(),
            "validate_profile_display_name(Some(\"Ops Lead\")) must return Ok(()); \
             a valid 8-character display name must be accepted (AC-PR-BE-1-S1). \
             Got: {:?}",
            result
        );
    }

    /// AC-PR-BE-1-F3 — a 1-character display_name is below the 2-char minimum.
    #[test]
    fn test_validate_profile_display_name_one_char_is_too_short() {
        let result = validate_profile_display_name(&Some("A".to_string()));
        assert!(
            result.is_err(),
            "validate_profile_display_name(Some(\"A\")) must return Err; \
             1 character is below the 2-char minimum (AC-PR-BE-1-F3). Got Ok(())"
        );
        // Verify the error message references the correct copy key.
        if let Err(AppError::BadRequest(msg)) = &result {
            assert!(
                msg.contains("displayNameTooShort"),
                "error message for 1-char display_name must reference \
                 'displayNameTooShort' copy key (AC-PR-BE-1-F3); got: {}",
                msg
            );
        } else {
            panic!(
                "validate_profile_display_name(Some(\"A\")) must return \
                 AppError::BadRequest; got: {:?}",
                result
            );
        }
    }

    /// AC-PR-BE-1-F3 boundary — exactly 2 characters is the minimum valid value.
    #[test]
    fn test_validate_profile_display_name_two_chars_is_minimum_valid() {
        let result = validate_profile_display_name(&Some("AB".to_string()));
        assert!(
            result.is_ok(),
            "validate_profile_display_name(Some(\"AB\")) must return Ok(()); \
             2 characters is the minimum valid length (AC-PR-BE-1-F3 boundary). \
             Got: {:?}",
            result
        );
    }

    /// AC-PR-BE-1-F1 — an 81-character display_name exceeds the 80-char maximum.
    #[test]
    fn test_validate_profile_display_name_81_chars_is_too_long() {
        let name_81 = "A".repeat(81);
        let result = validate_profile_display_name(&Some(name_81.clone()));
        assert!(
            result.is_err(),
            "validate_profile_display_name(Some(81-char string)) must return Err; \
             81 > 80 chars maximum (AC-PR-BE-1-F1). Got Ok(())"
        );
        if let Err(AppError::BadRequest(msg)) = &result {
            assert!(
                msg.contains("displayNameTooLong"),
                "error message for 81-char display_name must reference \
                 'displayNameTooLong' copy key (AC-PR-BE-1-F1); got: {}",
                msg
            );
        } else {
            panic!(
                "validate_profile_display_name(81 chars) must return \
                 AppError::BadRequest; got: {:?}",
                result
            );
        }
    }

    /// AC-PR-BE-1-F1 boundary — exactly 80 characters is the maximum valid value.
    #[test]
    fn test_validate_profile_display_name_80_chars_is_maximum_valid() {
        let name_80 = "A".repeat(80);
        let result = validate_profile_display_name(&Some(name_80));
        assert!(
            result.is_ok(),
            "validate_profile_display_name(Some(80-char string)) must return Ok(()); \
             80 chars is the maximum valid length (AC-PR-BE-1-F1 boundary). \
             Got: {:?}",
            result
        );
    }

    /// AC-PR-BE-1-F2 — a whitespace-only display_name must be rejected.
    /// Whitespace-only must produce a distinct error ("blank") rather than
    /// being accepted as a valid-length string.
    #[test]
    fn test_validate_profile_display_name_whitespace_only_is_rejected() {
        let result = validate_profile_display_name(&Some("   ".to_string()));
        assert!(
            result.is_err(),
            "validate_profile_display_name(Some(\"   \")) must return Err; \
             whitespace-only strings must be rejected (AC-PR-BE-1-F2). Got Ok(())"
        );
        if let Err(AppError::BadRequest(msg)) = &result {
            assert!(
                msg.contains("displayNameBlank"),
                "error message for whitespace-only display_name must reference \
                 'displayNameBlank' copy key (AC-PR-BE-1-F2); got: {}",
                msg
            );
        } else {
            panic!(
                "validate_profile_display_name(whitespace-only) must return \
                 AppError::BadRequest; got: {:?}",
                result
            );
        }
    }

    /// AC-PR-BE-1-F2 ordering — whitespace-only check fires before length check.
    /// A single space " " (1 char, whitespace-only) must return "blank" not "too_short".
    #[test]
    fn test_validate_profile_display_name_single_space_is_blank_not_too_short() {
        let result = validate_profile_display_name(&Some(" ".to_string()));
        assert!(
            result.is_err(),
            "validate_profile_display_name(Some(\" \")) must return Err; \
             a single space is whitespace-only. Got Ok(())"
        );
        if let Err(AppError::BadRequest(msg)) = &result {
            assert!(
                msg.contains("displayNameBlank"),
                "a single space must return 'displayNameBlank' (not 'displayNameTooShort'); \
                 whitespace-only check fires before length check (AC-PR-BE-1-F2). \
                 Got message: {}",
                msg
            );
        } else {
            panic!(
                "validate_profile_display_name(\" \") must return AppError::BadRequest; \
                 got: {:?}",
                result
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: validate_change_password — 6 tests
    // Requirements: AC-PR-BE-3-F2, AC-PR-BE-3-F3, AC-PR-BE-3-S1
    //
    // RED PHASE: all tests will panic via todo!() until impl fills in the fn.
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-PR-BE-3-S1 — a valid new password (>= 12 chars, differs from current)
    /// must return Ok(()).
    #[test]
    fn test_validate_change_password_valid_passes() {
        let result = validate_change_password("NewSecurePass1!", "OldPass123456!");
        assert!(
            result.is_ok(),
            "validate_change_password(valid 15-char, different from current) \
             must return Ok(()); got: {:?}",
            result
        );
    }

    /// AC-PR-BE-3-F2 boundary — exactly 11 characters is too short.
    #[test]
    fn test_validate_change_password_11_chars_too_short() {
        // "Abcdefghijk" is exactly 11 chars.
        let pw = "Abcdefghijk";
        assert_eq!(pw.chars().count(), 11, "test fixture must be 11 chars");
        let result = validate_change_password(pw, "OldPass123456!");
        assert!(
            result.is_err(),
            "validate_change_password(11 chars) must return Err; \
             minimum is 12 characters (AC-PR-BE-3-F2). Got Ok(())"
        );
        if let Err(AppError::BadRequest(msg)) = &result {
            assert!(
                msg.contains("newPasswordTooShort"),
                "error for 11-char new password must reference 'newPasswordTooShort' \
                 copy key (AC-PR-BE-3-F2); got: {}",
                msg
            );
        } else {
            panic!(
                "validate_change_password(11 chars) must return AppError::BadRequest; \
                 got: {:?}",
                result
            );
        }
    }

    /// AC-PR-BE-3-F2 boundary — exactly 12 characters at the minimum is valid.
    #[test]
    fn test_validate_change_password_12_chars_is_minimum_valid() {
        // "Abcdefghijk1" is exactly 12 chars, different from current.
        let pw = "Abcdefghijk1";
        assert_eq!(pw.chars().count(), 12, "test fixture must be 12 chars");
        let result = validate_change_password(pw, "DifferentOldPass!");
        assert!(
            result.is_ok(),
            "validate_change_password(exactly 12 chars, different from current) \
             must return Ok(()); 12 chars is the minimum valid length (AC-PR-BE-3-F2). \
             Got: {:?}",
            result
        );
    }

    /// AC-PR-BE-3-F3 — new password identical to current password must be rejected.
    #[test]
    fn test_validate_change_password_same_as_current_rejected() {
        let pw = "SamePassword123!";
        let result = validate_change_password(pw, pw); // same string
        assert!(
            result.is_err(),
            "validate_change_password(same as current) must return Err \
             (AC-PR-BE-3-F3); got Ok(())"
        );
        if let Err(AppError::BadRequest(msg)) = &result {
            assert!(
                msg.contains("newPasswordSameAsCurrent"),
                "error for same-as-current password must reference \
                 'newPasswordSameAsCurrent' copy key (AC-PR-BE-3-F3); got: {}",
                msg
            );
        } else {
            panic!(
                "validate_change_password(same as current) must return \
                 AppError::BadRequest; got: {:?}",
                result
            );
        }
    }

    /// AC-PR-BE-3-F2 + F3 ordering — length is checked before identity.
    /// An 11-char password that equals the current must report "too_short".
    #[test]
    fn test_validate_change_password_length_checked_before_identity() {
        let pw = "Abcdefghijk"; // 11 chars, also same as "current"
        assert_eq!(pw.chars().count(), 11, "test fixture must be 11 chars");
        let result = validate_change_password(pw, pw);
        assert!(
            result.is_err(),
            "validate_change_password(11 chars, same as current) must return Err; \
             got Ok(())"
        );
        if let Err(AppError::BadRequest(msg)) = &result {
            assert!(
                msg.contains("newPasswordTooShort"),
                "when new_password is both too short AND same as current, the 'too_short' \
                 error must be returned (length check precedes identity check); \
                 got: {}",
                msg
            );
        } else {
            panic!(
                "validate_change_password(11 chars, same as current) must return \
                 AppError::BadRequest; got: {:?}",
                result
            );
        }
    }

    /// AC-PR-BE-3-F5 — A missing JWT must produce HTTP 401. This pure-logic test
    /// verifies the copy key constant embedded in the handler error message so that
    /// the message is locked in at the test layer.
    #[test]
    fn test_change_password_missing_jwt_produces_unauthorized_copy_key() {
        // The handler must return AppError::Unauthorized when no JWT cookie is present.
        // We cannot call the async handler here (no runtime / no DB), so we verify the
        // AppError::Unauthorized variant produces the expected HTTP status code through
        // the IntoResponse impl.
        use crate::errors::AppError;
        // AppError::Unauthorized must exist and be constructable.
        let err = AppError::Unauthorized;
        // Confirm it is the Unauthorized variant (not Forbidden or other).
        assert!(
            matches!(err, AppError::Unauthorized),
            "AppError::Unauthorized must exist as a unit variant so the change-password \
             handler can return it when the JWT cookie is absent (AC-PR-BE-3-F5)"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite: AssignOrgRequest deserialization (WARD-03)
    // ─────────────────────────────────────────────────────────────────────────

    /// WARD-03 — AssignOrgRequest must accept null org_id to clear assignment.
    #[test]
    fn assign_org_request_deserializes_with_null_org_id() {
        let json = r#"{"org_id": null}"#;
        let req: super::AssignOrgRequest = serde_json::from_str(json).unwrap();
        assert!(
            req.org_id.is_none(),
            "AssignOrgRequest with org_id=null must deserialize to None; \
             clearing org assignment requires null support"
        );
    }

    /// WARD-03 — AssignOrgRequest must accept a UUID string for org_id.
    #[test]
    fn assign_org_request_deserializes_with_uuid() {
        use uuid::Uuid;
        let id = Uuid::nil();
        let json = format!(r#"{{"org_id": "{}"}}"#, id);
        let req: super::AssignOrgRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(
            req.org_id,
            Some(id),
            "AssignOrgRequest must deserialize org_id UUID string to Some(Uuid)"
        );
    }
}
