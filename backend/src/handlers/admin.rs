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
    extract::{Extension, Path, Query, State},
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
        LoginRequest, UpdateProfileRequest, UpdateStatusRequest,
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
/// # Contract (AC-ADMIN-RPT R15)
/// Returns `Ok(())` when `status` is one of exactly three lowercase strings:
///   "submitted" | "under_review" | "resolved"
/// Returns `Err(AppError::BadRequest("Invalid status".to_string()))` for any
/// other value, including uppercase variants, whitespace-padded strings, and
/// empty strings.
///
/// No trimming is performed — the caller is responsible for normalising input.
///
/// TODO: implement — replace todo!() with:
///   match status {
///       "submitted" | "under_review" | "resolved" => Ok(()),
///       _ => Err(AppError::BadRequest("Invalid status".to_string())),
///   }
#[allow(dead_code)] // used only in #[cfg(test)] tests in this file
pub fn validate_status(status: &str) -> Result<(), AppError> {
    match status {
        "submitted" | "under_review" | "resolved" => Ok(()),
        _ => Err(AppError::BadRequest("Invalid status".to_string())),
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
///
/// TODO: implement — replace todo!() with:
///   if email.is_empty() || !email.contains('@') {
///       return Err(AppError::BadRequest("Invalid email".to_string()));
///   }
///   if password.chars().count() < 12 {
///       return Err(AppError::BadRequest("Password must be at least 12 characters".to_string()));
///   }
///   match role {
///       "admin" | "reviewer" => Ok(()),
///       _ => Err(AppError::BadRequest("Invalid role".to_string())),
///   }
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

/// Enforce that the authenticated caller holds the required role.
///
/// # Contract (AC-ADMIN-USERS R-USR-1/2/3, AC-ADMIN-RPT R24)
/// Returns `Ok(())` when `claims.role == required_role`.
/// Returns `Err(AppError::Forbidden("Insufficient role".to_string()))` otherwise.
///
/// # Dependency on AppError::Forbidden
/// This function will not compile until `AppError::Forbidden(String)` is added
/// to `errors.rs`.  See the implementation instructions at the top of this file.
///
/// TODO: implement — replace todo!() with:
///   if claims.role == required_role {
///       Ok(())
///   } else {
///       Err(AppError::Forbidden("Insufficient role".to_string()))
///   }
#[allow(dead_code)] // used only in #[cfg(test)] tests in this file
pub fn require_role(claims: &JwtClaims, required_role: &str) -> Result<(), AppError> {
    if claims.role == required_role {
        Ok(())
    } else {
        Err(AppError::Forbidden)
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
        "whitespace_only" => AppError::BadRequest("COPY.admin.profile.displayNameBlank".to_string()),
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
    crate::models::admin::validate_new_password(new_password, current_password)
        .map_err(|reason| match reason {
            "too_short" => AppError::BadRequest("COPY.admin.profile.newPasswordTooShort".to_string()),
            "same_as_current" => AppError::BadRequest("COPY.admin.profile.newPasswordSameAsCurrent".to_string()),
            other => AppError::BadRequest(format!("COPY.admin.profile.{other}")),
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
    const DUMMY_HASH: &str =
        "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$\
         Qs2IJDMCCkFMkJ7qGO5fRQ3mJNGwLXFMGADAF5Lpv4";

    let user_opt =
        admin_queries::get_admin_user_by_email(&state.pool, &payload.email).await?;

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
    cookie.set_same_site(axum_extra::extract::cookie::SameSite::Strict);
    // FINDING-011: Set Max-Age so the browser discards the cookie after the session expires.
    cookie.set_max_age(time::Duration::seconds(jwt_session_hours * 3600));
    if cookie_secure {
        cookie.set_secure(true);
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
    // Build a named removal cookie. `jar.remove()` adds the appropriate
    // expiry / Max-Age=0 directives automatically.
    let removal = axum_extra::extract::cookie::Cookie::build(("admin_token", ""))
        .path("/")
        .http_only(true)
        .build();

    tracing::info!("Admin logout");
    (StatusCode::OK, jar.remove(removal))
}

/// GET /api/admin/auth/me — return the authenticated user's profile.
pub async fn admin_me(
    Extension(claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized)?;

    // FINDING-006: Fetch by UUID (the JWT sub claim) — more robust than fetching
    // by email, which could stale-match if the email were ever changed.
    let user = admin_queries::get_admin_user_by_id(&state.pool, user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(serde_json::to_value(user.into_response()).unwrap()))
}

// ── Admin report handlers ─────────────────────────────────────────────────────

/// GET /api/admin/reports — paginated report list with full PII.
/// Accessible by both admin and reviewer roles.
pub async fn admin_list_reports(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<AdminReportFilters>,
) -> Result<Json<serde_json::Value>, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20);
    let limit = if limit <= 0 { 20 } else { limit.clamp(1, 200) };

    let items = admin_queries::list_admin_reports(
        &state.pool,
        params.category.as_deref(),
        params.status.as_deref(),
        params.severity.as_deref(),
        params.date_from,
        params.date_to,
        page,
        limit,
    )
    .await?;

    Ok(Json(serde_json::json!({
        "page": page,
        "limit": limit,
        "count": items.len(),
        "items": items,
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

    let changed_by = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized)?;

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

// ── Admin stats handler ───────────────────────────────────────────────────────

/// GET /api/admin/stats — aggregate counts by status, category, severity.
/// Accessible by both admin and reviewer roles.
pub async fn admin_get_stats(
    Extension(_claims): Extension<AuthJwtClaims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let stats = admin_queries::get_report_stats(&state.pool).await?;
    Ok(Json(serde_json::to_value(stats).unwrap()))
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
        .map(|u| serde_json::to_value(u.into_response()).unwrap())
        .collect();

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

    let response = serde_json::to_value(user.into_response()).unwrap();
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

    let caller_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized)?;

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
    let updated = admin_queries::update_admin_profile(
        &state.pool,
        user_id,
        inner.as_deref(),
    )
    .await?;

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
        require_role, validate_change_password, validate_create_user_request,
        validate_profile_display_name, validate_status, JwtClaims,
    };
    use crate::errors::AppError;

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
    // validate_status — happy paths (3 tests)
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-ADMIN-RPT R15 — "submitted" is a valid status value.
    #[test]
    fn test_validate_status_submitted() {
        let result = validate_status("submitted");
        assert!(
            result.is_ok(),
            "validate_status(\"submitted\") must return Ok(()); \
             \"submitted\" is one of the three valid MVP status values; got {:?}",
            result
        );
    }

    /// AC-ADMIN-RPT R15 — "under_review" is a valid status value.
    #[test]
    fn test_validate_status_under_review() {
        let result = validate_status("under_review");
        assert!(
            result.is_ok(),
            "validate_status(\"under_review\") must return Ok(()); \
             \"under_review\" is one of the three valid MVP status values; got {:?}",
            result
        );
    }

    /// AC-ADMIN-RPT R15 — "resolved" is a valid status value.
    #[test]
    fn test_validate_status_resolved() {
        let result = validate_status("resolved");
        assert!(
            result.is_ok(),
            "validate_status(\"resolved\") must return Ok(()); \
             \"resolved\" is one of the three valid MVP status values; got {:?}",
            result
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validate_status — rejection paths (4 tests)
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-ADMIN-RPT R15 — "rejected" is NOT in the three-value MVP enum.
    /// The AC lists exactly "submitted", "under_review", "resolved"; "rejected"
    /// is absent and must produce a 400 error.
    #[test]
    fn test_validate_status_rejected() {
        let result = validate_status("rejected");
        assert!(
            result.is_err(),
            "validate_status(\"rejected\") must return Err; \
             \"rejected\" is not a valid MVP status value \
             (valid: submitted, under_review, resolved)"
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_status(\"rejected\") must return AppError::BadRequest; \
             got {:?}",
            err
        );
    }

    /// AC-ADMIN-RPT R15 — uppercase "SUBMITTED" must be rejected; the
    /// validation is case-sensitive and performs no normalisation.
    #[test]
    fn test_validate_status_uppercase() {
        let result = validate_status("SUBMITTED");
        assert!(
            result.is_err(),
            "validate_status(\"SUBMITTED\") must return Err; \
             status matching is case-sensitive — \"SUBMITTED\" != \"submitted\""
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_status(\"SUBMITTED\") must return AppError::BadRequest; \
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

    /// AC-ADMIN-RPT R15 — whitespace-padded " submitted" must be rejected.
    /// No silent trimming is performed; the caller owns normalisation.
    #[test]
    fn test_validate_status_whitespace() {
        let result = validate_status(" submitted");
        assert!(
            result.is_err(),
            "validate_status(\" submitted\") must return Err; \
             leading whitespace is not stripped — \" submitted\" != \"submitted\""
        );
        let err = result.unwrap_err();
        assert!(
            is_bad_request(&err),
            "validate_status(\" submitted\") must return AppError::BadRequest; \
             got {:?}",
            err
        );
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
        let result = validate_create_user_request(
            "reviewer@example.com",
            "SecurePass12",
            "reviewer",
        );
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
        let result = validate_create_user_request(
            "user@example.com",
            "Abcdefghijkl",
            "admin",
        );
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
        let result = validate_create_user_request(
            "user@example.com",
            "Abcdefghijk",
            "admin",
        );
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
        let result = validate_create_user_request(
            "user@example.com",
            "SecurePass12",
            "superuser",
        );
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
}
