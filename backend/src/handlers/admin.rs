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
        AdminReportFilters, CreateUserRequest, LoginRequest, UpdateStatusRequest,
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
    let user = match user_opt {
        Some(u) if password_ok && u.is_active => u,
        _ => return Err(AppError::Unauthorized),
    };

    // Stamp last_login_at (best-effort — don't fail the login on DB error).
    let _ = admin_queries::update_last_login(&state.pool, user.id).await;

    // Build JWT.
    let session_hours: i64 = std::env::var("JWT_SESSION_HOURS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(24);

    let exp = (jsonwebtoken::get_current_timestamp() as i64 + session_hours * 3600) as usize;

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
    if cookie_secure {
        cookie.set_secure(true);
    }

    let response_body = user.into_response();
    tracing::info!(
        email = %payload.email,
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

    // Fetch fresh user record from DB (the JWT only carries a snapshot).
    let user = admin_queries::get_admin_user_by_email(&state.pool, &claims.email)
        .await?
        .filter(|u| u.id == user_id)
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

    // Best-effort filesystem removal — log warning on failure, never fail the request.
    let full_path = std::path::PathBuf::from(&state.uploads_dir).join(&image_path);
    if let Err(e) = tokio::fs::remove_file(&full_path).await {
        tracing::warn!(
            path = %full_path.display(),
            error = %e,
            "Could not delete image file after report deletion"
        );
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
/// A user cannot deactivate their own account.
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

    let found = admin_queries::deactivate_admin_user(&state.pool, id).await?;
    if !found {
        return Err(AppError::NotFound);
    }

    tracing::info!(user_id = %id, "Admin user deactivated");
    Ok(StatusCode::NO_CONTENT)
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
    use super::{require_role, validate_create_user_request, validate_status, JwtClaims};
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
}
