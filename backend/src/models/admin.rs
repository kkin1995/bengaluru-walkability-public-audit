// backend/src/models/admin.rs
//
// Data models for the Admin Dashboard subsystem.
//
// Sources of truth:
//   docs/ac/admin-auth-ac.md       (auth, JWT, login/logout)
//   docs/ac/admin-reports-ac.md    (report management, status updates, stats)
//   docs/ac/admin-users-frontend-ac.md  (user management CRUD)
//
// All validation helpers in this file are pure functions that take only their
// arguments — no DB, no async, no side effects. Handler code calls these
// helpers before executing any database query.
//
// The impl-engineer fills in the bodies of:
//   - AdminUser::into_response()
//   - validate_password_length()
//   - validate_email_format()
//   - validate_role()
//   - UpdateStatusRequest::is_valid_status()
//
// All other derives and struct shapes are final — do NOT modify them.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// Phase 2: AppError is used by guard_super_admin_deactivation (production)
// and by test assertions. errors.rs does not import from models, so there
// is no circular dependency.
use crate::errors::AppError;

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

/// The two roles that exist in the system.
/// Stored in the DB as a PostgreSQL enum ("admin" | "reviewer").
/// The `role` field on AdminUser is a String for SQLx compatibility; this enum
/// is used for runtime role-gating logic in handlers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[allow(dead_code)]
pub enum UserRole {
    Admin,
    Reviewer,
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row struct — never sent directly to clients
// ─────────────────────────────────────────────────────────────────────────────

/// Raw database row for admin_users.
/// `password_hash` is intentionally absent from AdminUserResponse.
/// Never serialize this struct directly to an HTTP response.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct AdminUser {
    pub id: Uuid,
    pub email: String,
    /// argon2id hash — must NEVER appear in any HTTP response body.
    pub password_hash: String,
    /// "admin" or "reviewer" (PostgreSQL enum read as TEXT).
    pub role: String,
    pub display_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_active: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    /// Set to TRUE only for the seeded first admin user (AC-SA-BE-2-S1).
    /// Cannot be set via the user-management API (AC-SA-BE-5-F1).
    pub is_super_admin: bool,
}

impl AdminUser {
    /// Convert the DB row into a safe API response, dropping `password_hash`
    /// and `updated_at` (internal field).
    ///
    /// # Contract (from AC-USR-1-S1, R-USR-1.1, AC-USR-1-F4)
    /// - The returned value must NOT contain `password_hash`.
    /// - All fields listed in AdminUserResponse must be present.
    ///
    /// # TDD stub
    /// TODO: implement — copy each field except password_hash and updated_at.
    pub fn into_response(self) -> AdminUserResponse {
        AdminUserResponse {
            id: self.id,
            email: self.email,
            role: self.role,
            display_name: self.display_name,
            is_active: self.is_active,
            created_at: self.created_at,
            last_login_at: self.last_login_at,
            is_super_admin: self.is_super_admin,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// API response structs — safe to serialize to HTTP responses
// ─────────────────────────────────────────────────────────────────────────────

/// Shape returned by GET /api/admin/users and GET /api/admin/auth/me.
/// Intentionally excludes: `password_hash`, `updated_at`.
///
/// Field set is governed by R-USR-1.1 and ASSUMPTION-AUTH-14 (Option A).
/// Phase 2 addition: `is_super_admin` (AC-SA-BE-4-S1, ASSUMPTION-P2-SA-3 Option A).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminUserResponse {
    pub id: Uuid,
    pub email: String,
    /// "admin" or "reviewer"
    pub role: String,
    pub display_name: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    /// None when the user has never logged in (ASSUMPTION-ADM-5 Option A).
    pub last_login_at: Option<DateTime<Utc>>,
    /// True only for the seeded super-admin user (AC-SA-BE-4-S1).
    /// Always false for API-created users (AC-SA-BE-5-S1).
    pub is_super_admin: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Request structs
// ─────────────────────────────────────────────────────────────────────────────

/// Body for POST /api/admin/auth/login.
/// Both fields are required; missing either must produce a 400 (AC-AUTH-01).
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Body for POST /api/admin/users.
/// Validation rules:
///   - password.chars().count() >= 12  (R-USR-2.1, AC-USR-2-F1, AC-USR-2-F2, AC-USR-2-F3)
///   - email contains exactly one '@' with a domain that contains at least one '.'  (R-USR-2.2)
///   - role is "admin" or "reviewer"  (R-USR-2.3)
///   - display_name is optional  (ASSUMPTION-ADM-7 Option A)
#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub password: String,
    pub role: String,
    pub display_name: Option<String>,
}

/// Query parameters for GET /api/admin/reports.
/// All fields are optional; absent fields mean "no filter applied".
#[derive(Debug, Deserialize, Default)]
pub struct AdminReportFilters {
    pub category: Option<String>,
    pub status: Option<String>,
    pub severity: Option<String>,
    pub date_from: Option<chrono::DateTime<chrono::Utc>>,
    pub date_to: Option<chrono::DateTime<chrono::Utc>>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

/// Body for PATCH /api/admin/reports/:id/status.
/// `status` must be one of: "submitted", "under_review", "resolved"  (R15, AC-RPT-29).
/// `note` is optional (R14).
#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
    pub note: Option<String>,
}

impl UpdateStatusRequest {
    /// Returns true iff `self.status` is one of the three permitted values
    /// (case-sensitive, lowercase only):
    ///   "submitted" | "under_review" | "resolved"
    ///
    /// Any other value — including uppercase variants or unknown strings — returns false.
    ///
    /// # Contract (R15, AC-RPT-29, AC-RPT-30)
    /// - "submitted"   → true
    /// - "under_review" → true
    /// - "resolved"    → true
    /// - "rejected"    → false
    /// - "SUBMITTED"   → false
    /// - ""            → false
    ///
    /// # TDD stub
    /// TODO: implement
    /// matches!(self.status.as_str(), "submitted" | "under_review" | "resolved")
    pub fn is_valid_status(&self) -> bool {
        matches!(self.status.as_str(), "submitted" | "under_review" | "resolved")
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT Claims
// ─────────────────────────────────────────────────────────────────────────────

/// Claims embedded inside the signed admin_token JWT.
///
/// Shape governed by ASSUMPTION-AUTH-14 Option A and ASSUMPTION-ADM-3 Option A.
///
/// `sub`   — UUID of the admin_users row, as a String.
/// `email` — email address at the time of login.
/// `role`  — "admin" or "reviewer".
/// `exp`   — Unix timestamp (seconds since epoch) when the token expires.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    /// Subject: UUID of the admin_users row as a lowercase hyphenated string.
    pub sub: String,
    pub email: String,
    /// "admin" or "reviewer"
    pub role: String,
    /// Unix timestamp expiry (seconds since epoch).
    pub exp: usize,
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats response
// ─────────────────────────────────────────────────────────────────────────────

/// Body returned by GET /api/admin/stats.
///
/// All enum values with zero reports still appear with value 0 (R34).
/// When the database is empty, all counts are 0 and all maps have their full
/// key sets present (ASSUMPTION-ADM-11 Option A).
#[derive(Debug, Serialize, Deserialize)]
pub struct StatsResponse {
    pub total_reports: i64,
    /// Keys: "submitted", "under_review", "resolved"
    pub by_status: HashMap<String, i64>,
    /// Keys: all values of the issue_category enum
    pub by_category: HashMap<String, i64>,
    /// Keys: all values of the severity_level enum
    pub by_severity: HashMap<String, i64>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Returns true iff `password` has at least 12 Unicode scalar values (chars).
///
/// # Contract (R-USR-2.1, AC-USR-2-F1, AC-USR-2-F2, AC-USR-2-F3)
/// - len 11 → false
/// - len 12 → true
/// - len 20 → true
///
/// # TDD stub
/// TODO: implement
/// password.chars().count() >= 12
#[allow(dead_code)] // used only in #[cfg(test)] tests in this file
pub fn validate_password_length(password: &str) -> bool {
    password.chars().count() >= 12
}

/// Returns true iff `email` contains exactly one '@' whose right-hand side
/// (the domain) contains at least one '.'.
///
/// This implements the structural minimum required by R1.4 / R-USR-2.2.
/// Full RFC 5322 compliance is enforced at the handler layer (not here).
///
/// # Contract
/// - "user@example.com"  → true
/// - "notanemail"        → false   (no '@')
/// - "@nodomain"         → false   (empty local part; domain has no '.')
/// - "user@"             → false   (empty domain)
/// - "user@nodot"        → false   (domain has no '.')
/// - "user@@double.com"  → false   (more than one '@')
///
/// # TDD stub
/// TODO: implement
/// let parts: Vec<&str> = email.splitn(2, '@').collect();
/// parts.len() == 2 && !parts[0].is_empty() && parts[1].contains('.')
#[allow(dead_code)] // used only in #[cfg(test)] tests in this file
pub fn validate_email_format(email: &str) -> bool {
    // Split on '@' allowing at most 2 parts — more than one '@' produces len > 2
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    if parts.len() != 2 {
        return false;
    }
    let local = parts[0];
    let domain = parts[1];
    // local must be non-empty, domain must be non-empty and contain '.'
    // Also guard against a second '@' hiding in the domain (splitn(2) keeps it whole)
    !local.is_empty() && !domain.is_empty() && domain.contains('.') && !domain.contains('@')
}

/// Returns true iff `role` is exactly "admin" or "reviewer" (case-sensitive).
///
/// # Contract (R-USR-2.3, AC-USR-2-F5)
/// - "admin"     → true
/// - "reviewer"  → true
/// - "superuser" → false
/// - "Admin"     → false
/// - ""          → false
///
/// # TDD stub
/// TODO: implement
/// matches!(role, "admin" | "reviewer")
#[allow(dead_code)] // used only in #[cfg(test)] tests in this file
pub fn validate_role(role: &str) -> bool {
    matches!(role, "admin" | "reviewer")
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — New request DTOs (Profile page)
// ─────────────────────────────────────────────────────────────────────────────

/// Body for PATCH /api/admin/auth/profile.
///
/// `display_name` is optional — absent means "no change"; null means "clear".
/// Validation rules (AC-PR-BE-1):
///   - When present and non-null: 2–80 non-whitespace-only characters
///   - null is always accepted (clears the display name)
///   - absent (field not in JSON) is always accepted (no-op update)
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct UpdateProfileRequest {
    pub display_name: Option<Option<String>>,
}

/// Body for POST /api/admin/auth/change-password.
///
/// Both fields are required (AC-PR-BE-3-F4).
/// Validation rules (AC-PR-BE-3):
///   - current_password: any non-empty string (verified via Argon2)
///   - new_password: >= 12 chars, differs from current_password
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Pure validation helpers (Profile page)
// ─────────────────────────────────────────────────────────────────────────────

/// Validate a proposed `display_name` value (when present and non-null).
///
/// # Contract (AC-PR-BE-1-F1, AC-PR-BE-1-F2, AC-PR-BE-1-F3)
/// [ASSUMPTION-P2-PR-1 Option B: 80 chars maximum]
/// [ASSUMPTION-P2-PR-2 Option A: 2 chars minimum; whitespace-only rejected]
///
/// Returns:
///   - Ok(())                  — value is valid (2–80 chars, not whitespace-only)
///   - Err("too_short")        — fewer than 2 characters  (AC-PR-BE-1-F3)
///   - Err("too_long")         — more than 80 characters  (AC-PR-BE-1-F1)
///   - Err("whitespace_only")  — all whitespace            (AC-PR-BE-1-F2)
///
/// Callers pass `None` to skip validation (null or absent display_name).
/// This function is only called when the caller supplies a non-null string.
///
/// # Value boundaries
/// - 1 char  → Err("too_short")
/// - 2 chars → Ok(())
/// - 80 chars → Ok(())
/// - 81 chars → Err("too_long")
/// - "  "    → Err("whitespace_only")
///
/// # TDD stub
/// TODO: implement — replace todo!() with:
///   if name.trim().is_empty() { return Err("whitespace_only"); }
///   let len = name.chars().count();
///   if len < 2 { return Err("too_short"); }
///   if len > 80 { return Err("too_long"); }
///   Ok(())
#[allow(dead_code)]
pub fn validate_display_name(name: &str) -> Result<(), &'static str> {
    // Whitespace-only check BEFORE length so " " (1 space) returns "whitespace_only"
    // rather than "too_short" (ordering mandated by AC-PR-BE-1-F2).
    if name.trim().is_empty() {
        return Err("whitespace_only");
    }
    let len = name.chars().count();
    if len < 2 {
        return Err("too_short");
    }
    if len > 80 {
        return Err("too_long");
    }
    Ok(())
}

/// Validate a proposed `new_password` for the change-password endpoint.
///
/// # Contract (AC-PR-BE-3-F2, AC-PR-BE-3-F3)
/// [ASSUMPTION-P2-PR-3: 12-char minimum, same as user creation]
/// [ASSUMPTION-P2-PR-5: Same-as-current is rejected with 400]
///
/// Returns:
///   - Ok(())             — new_password is valid and differs from current
///   - Err("too_short")   — fewer than 12 chars  (AC-PR-BE-3-F2)
///   - Err("same_as_current") — identical to current_password (AC-PR-BE-3-F3)
///
/// # Value boundaries
/// - 11 chars → Err("too_short")
/// - 12 chars → Ok(()) (when different from current)
///
/// # TDD stub
/// TODO: implement — replace todo!() with:
///   if new_password.chars().count() < 12 { return Err("too_short"); }
///   if new_password == current_password { return Err("same_as_current"); }
///   Ok(())
#[allow(dead_code)]
pub fn validate_new_password(
    new_password: &str,
    current_password: &str,
) -> Result<(), &'static str> {
    // Length check BEFORE identity so a short same-as-current password gets
    // "too_short" not "same_as_current" (ordering mandated by AC-PR-BE-3-F2+F3).
    if new_password.chars().count() < 12 {
        return Err("too_short");
    }
    if new_password == current_password {
        return Err("same_as_current");
    }
    Ok(())
}

/// Check whether `is_super_admin` may be set via the user-management API.
///
/// # Contract (AC-SA-BE-5-F1, ASSUMPTION-P2-SA-4 Option A)
/// - This function always returns `false`, enforcing that the API-created user
///   path never sets is_super_admin = true, regardless of request body content.
/// - The seed path (admin_seed.rs) is the ONLY code path that may set
///   is_super_admin = true.
///
/// # TDD stub
/// TODO: implement — replace todo!() with: false
#[allow(dead_code)]
pub fn api_create_can_set_super_admin() -> bool {
    // The API-created user path NEVER sets is_super_admin = true.
    // Only the seed path (admin_seed.rs) may set it (AC-SA-BE-5-F1).
    false
}

/// Enforce the super-admin protection guard before a deactivation query runs.
///
/// # Contract (AC-SA-BE-3-F1, SA Security Considerations)
/// - If `is_super_admin` is true → returns Err(AppError::Forbidden)
/// - If `is_super_admin` is false → returns Ok(())
///
/// This is the FIRST check that must run inside any deactivation path,
/// before any DB mutation, to prevent TOCTOU races (see SA Security section).
///
/// # TDD stub
/// TODO: implement — replace todo!() with:
///   if is_super_admin { Err(AppError::Forbidden) } else { Ok(()) }
#[allow(dead_code)]
pub fn guard_super_admin_deactivation(is_super_admin: bool) -> Result<(), AppError> {
    // This check MUST run before any DB mutation to prevent TOCTOU races.
    // The atomic SQL guard in deactivate_admin_user is the belt; this is the suspenders.
    if is_super_admin {
        Err(AppError::Forbidden)
    } else {
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
//
// Requirements covered:
//   AC-USR-1-F4   — password_hash must never appear in AdminUserResponse JSON
//   R-USR-1.1     — AdminUserResponse shape
//   AC-AUTH-01    — LoginRequest missing fields
//   AC-USR-2-F1,2,3 — password length validation (11 invalid, 12 valid, 20 valid)
//   AC-USR-2-F4   — email format validation
//   AC-USR-2-F5   — role validation
//   AC-AUTH-03    — JwtClaims round-trip and exp present
//   AC-RPT-43     — StatsResponse serialization
//   AC-RPT-29     — UpdateStatusRequest valid/invalid values
//
// None of these tests touch the database or the network. They are pure
// computation and serialization tests.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    // ─────────────────────────────────────────────────────────────────────────
    // Fixture builders
    // ─────────────────────────────────────────────────────────────────────────

    /// Build a complete AdminUser with well-known field values.
    /// Tests that only care about one field override it via struct update syntax.
    fn make_admin_user() -> AdminUser {
        let now = Utc::now();
        AdminUser {
            id: Uuid::nil(),
            email: "ops@example.com".to_string(),
            password_hash: "$argon2id$v=19$m=19456,t=2,p=1$SALT$HASH".to_string(),
            role: "admin".to_string(),
            display_name: Some("Ops User".to_string()),
            created_at: now,
            updated_at: now,
            is_active: true,
            last_login_at: Some(now),
            // Phase 2: default to false; tests that need true override this field.
            is_super_admin: false,
        }
    }

    /// Build an AdminUserResponse for tests that don't need to go through AdminUser.
    fn make_admin_user_response() -> AdminUserResponse {
        let now = Utc::now();
        AdminUserResponse {
            id: Uuid::nil(),
            email: "ops@example.com".to_string(),
            role: "admin".to_string(),
            display_name: Some("Ops User".to_string()),
            is_active: true,
            created_at: now,
            last_login_at: Some(now),
            is_super_admin: false,
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 1 — AdminUser → AdminUserResponse conversion
    // Requirements: R-USR-1.1, AC-USR-1-F4
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_admin_user_into_response_omits_password_hash() {
        // AC-USR-1-F4: password_hash must NEVER appear in the converted response.
        // AdminUserResponse does not have a password_hash field (compile-time guarantee).
        // This test adds a belt-and-suspenders runtime assertion by serialising the
        // response to JSON and checking the string is absent.
        let user = make_admin_user();
        let response = user.into_response();
        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        assert!(
            !json.contains("password_hash"),
            "password_hash key must NOT appear in AdminUserResponse JSON, but got: {}",
            json
        );
        assert!(
            !json.contains("$argon2id$"),
            "argon2id hash value must NOT appear in AdminUserResponse JSON, but got: {}",
            json
        );
    }

    #[test]
    fn test_admin_user_into_response_includes_all_public_fields() {
        // R-USR-1.1: response must contain id, email, role, display_name,
        // is_active, created_at, last_login_at.
        let fixed_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000")
            .expect("test UUID must be valid");
        let user = AdminUser {
            id: fixed_id,
            email: "ops@example.com".to_string(),
            role: "admin".to_string(),
            display_name: Some("Ops User".to_string()),
            is_active: true,
            is_super_admin: false,
            ..make_admin_user()
        };

        let response = user.into_response();
        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        // Each of these fields must be present in the serialized output.
        for field in &["id", "email", "role", "display_name", "is_active", "created_at", "last_login_at"] {
            assert!(
                json.contains(field),
                "expected field '{}' to be present in AdminUserResponse JSON, but got: {}",
                field,
                json
            );
        }

        // Spot-check the values round-trip correctly.
        assert_eq!(
            response.email, "ops@example.com",
            "email must be preserved through into_response(); expected 'ops@example.com', got '{}'",
            response.email
        );
        assert_eq!(
            response.role, "admin",
            "role must be preserved through into_response(); expected 'admin', got '{}'",
            response.role
        );
        assert_eq!(
            response.id, fixed_id,
            "id must be preserved through into_response()"
        );
        assert!(
            response.is_active,
            "is_active=true must be preserved through into_response()"
        );
        assert_eq!(
            response.display_name,
            Some("Ops User".to_string()),
            "display_name Some(...) must be preserved through into_response()"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 2 — AdminUserResponse serialization
    // Requirements: R-USR-1.1 (field shape and null handling)
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_admin_user_response_serializes_display_name_none_as_null() {
        // When display_name is None, the JSON must contain "display_name":null
        // (not omit the key) so that frontend clients can rely on a stable shape.
        let now = Utc::now();
        let response = AdminUserResponse {
            id: Uuid::nil(),
            email: "ops@example.com".to_string(),
            role: "reviewer".to_string(),
            display_name: None,
            is_active: true,
            created_at: now,
            last_login_at: None,
            is_super_admin: false,
        };

        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        assert!(
            json.contains("\"display_name\":null"),
            "display_name:None must serialize as null in JSON, but got: {}",
            json
        );
    }

    #[test]
    fn test_admin_user_response_serializes_last_login_at_none_as_null() {
        // When last_login_at is None (user has never logged in), the JSON must
        // contain "last_login_at":null.
        let now = Utc::now();
        let response = AdminUserResponse {
            id: Uuid::nil(),
            email: "never@example.com".to_string(),
            role: "reviewer".to_string(),
            display_name: None,
            is_active: true,
            created_at: now,
            last_login_at: None,
            is_super_admin: false,
        };

        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        assert!(
            json.contains("\"last_login_at\":null"),
            "last_login_at:None must serialize as null in JSON, but got: {}",
            json
        );
    }

    #[test]
    fn test_admin_user_response_serializes_with_all_fields_present() {
        // When all optional fields have values, the JSON must contain them.
        let now = Utc::now();
        let response = AdminUserResponse {
            id: Uuid::nil(),
            email: "full@example.com".to_string(),
            role: "admin".to_string(),
            display_name: Some("Full User".to_string()),
            is_active: false,
            created_at: now,
            last_login_at: Some(now),
            is_super_admin: false,
        };

        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        assert!(
            json.contains("\"Full User\""),
            "display_name value 'Full User' must appear in JSON, but got: {}",
            json
        );
        assert!(
            json.contains("\"full@example.com\""),
            "email value must appear in JSON, but got: {}",
            json
        );
        assert!(
            json.contains("\"is_active\":false"),
            "is_active:false must serialize as false (not true), but got: {}",
            json
        );
        assert!(
            !json.contains("password_hash"),
            "password_hash must never appear in AdminUserResponse JSON, but got: {}",
            json
        );
    }

    #[test]
    fn test_admin_user_response_json_has_no_password_hash_key() {
        // Regression guard: directly construct AdminUserResponse (no AdminUser involved)
        // and confirm the key "password_hash" is structurally absent.
        // This is a compile-time guarantee (no such field exists), but we also
        // assert it at the JSON level to prevent future field additions.
        let now = Utc::now();
        let response = AdminUserResponse {
            id: Uuid::nil(),
            email: "test@example.com".to_string(),
            role: "admin".to_string(),
            display_name: None,
            is_active: true,
            created_at: now,
            last_login_at: None,
            is_super_admin: false,
        };

        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        // These substrings must all be absent regardless of future rename aliases.
        for forbidden in &["password_hash", "passwordHash", "\"password\"", "\"hash\""] {
            assert!(
                !json.contains(forbidden),
                "forbidden key '{}' must NOT appear in AdminUserResponse JSON, but got: {}",
                forbidden,
                json
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 3 — LoginRequest deserialization
    // Requirements: R1.2, R1.3, AC-AUTH-01
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_login_request_valid_deserialization() {
        // A JSON body with both email and password must deserialize correctly.
        let json = r#"{"email":"ops@example.com","password":"CorrectHorseBatteryStaple"}"#;
        let result: Result<LoginRequest, _> = serde_json::from_str(json);

        assert!(
            result.is_ok(),
            "valid login JSON must deserialize without error; got: {:?}",
            result.err()
        );

        let req = result.unwrap();
        assert_eq!(
            req.email, "ops@example.com",
            "deserialized email must match input; expected 'ops@example.com', got '{}'",
            req.email
        );
        assert_eq!(
            req.password, "CorrectHorseBatteryStaple",
            "deserialized password must match input; expected 'CorrectHorseBatteryStaple', got '{}'",
            req.password
        );
    }

    #[test]
    fn test_login_request_missing_email_fails_deserialization() {
        // AC-AUTH-01: omitting the email field must produce a deserialization error.
        // The handler must return 400 for this case; here we test the model layer.
        let json = r#"{"password":"SomePassword1!"}"#;
        let result: Result<LoginRequest, _> = serde_json::from_str(json);

        assert!(
            result.is_err(),
            "LoginRequest JSON without 'email' must fail deserialization, but it succeeded"
        );
    }

    #[test]
    fn test_login_request_missing_password_fails_deserialization() {
        // AC-AUTH-01: omitting the password field must produce a deserialization error.
        let json = r#"{"email":"ops@example.com"}"#;
        let result: Result<LoginRequest, _> = serde_json::from_str(json);

        assert!(
            result.is_err(),
            "LoginRequest JSON without 'password' must fail deserialization, but it succeeded"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 4 — CreateUserRequest: password length validation
    // Requirements: R-USR-2.1, AC-USR-2-F1, AC-USR-2-F2, AC-USR-2-F3
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_password_validation_11_chars_is_invalid() {
        // AC-USR-2-F2: exactly 11 characters is below the 12-char minimum → invalid.
        // The string "Abcdefghijk" is exactly 11 ASCII characters.
        let password = "Abcdefghijk";
        assert_eq!(
            password.chars().count(),
            11,
            "test fixture 'Abcdefghijk' must have exactly 11 chars (got {}); fix the fixture",
            password.chars().count()
        );
        assert!(
            !validate_password_length(password),
            "password with 11 characters must be invalid (minimum is 12); \
             validate_password_length('{}') returned true",
            password
        );
    }

    #[test]
    fn test_password_validation_12_chars_is_valid() {
        // AC-USR-2-F3: exactly 12 characters is the boundary value → valid.
        // The string "Abcdefghijk1" is exactly 12 ASCII characters.
        let password = "Abcdefghijk1";
        assert_eq!(
            password.chars().count(),
            12,
            "test fixture 'Abcdefghijk1' must have exactly 12 chars (got {}); fix the fixture",
            password.chars().count()
        );
        assert!(
            validate_password_length(password),
            "password with exactly 12 characters must be valid (minimum is 12); \
             validate_password_length('{}') returned false",
            password
        );
    }

    #[test]
    fn test_password_validation_20_chars_is_valid() {
        // A password well above the minimum must be valid.
        let password = "SecurePass2026!Xtra4";
        assert_eq!(
            password.chars().count(),
            20,
            "test fixture must have exactly 20 chars (got {}); fix the fixture",
            password.chars().count()
        );
        assert!(
            validate_password_length(password),
            "password with 20 characters must be valid; \
             validate_password_length('{}') returned false",
            password
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 4b — CreateUserRequest: email format validation
    // Requirements: R-USR-2.2, R1.4, AC-USR-2-F4
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_email_validation_no_at_sign_is_invalid() {
        // AC-USR-2-F4: an email without '@' must be rejected.
        assert!(
            !validate_email_format("notanemail"),
            "email 'notanemail' (no '@') must be invalid; validate_email_format returned true"
        );
    }

    #[test]
    fn test_email_validation_empty_domain_is_invalid() {
        // "user@" — domain part is empty, therefore no '.', therefore invalid.
        assert!(
            !validate_email_format("user@"),
            "email 'user@' (empty domain) must be invalid; validate_email_format returned true"
        );
    }

    #[test]
    fn test_email_validation_domain_without_dot_is_invalid() {
        // "user@nodot" — domain has no '.', which violates R1.4.
        assert!(
            !validate_email_format("user@nodot"),
            "email 'user@nodot' (domain without '.') must be invalid; \
             validate_email_format returned true"
        );
    }

    #[test]
    fn test_email_validation_multiple_at_signs_is_invalid() {
        // "user@@double.com" — more than one '@' is invalid per R1.4.
        assert!(
            !validate_email_format("user@@double.com"),
            "email 'user@@double.com' (two '@') must be invalid; \
             validate_email_format returned true"
        );
    }

    #[test]
    fn test_email_validation_valid_email_passes() {
        // A well-formed email must pass.
        assert!(
            validate_email_format("ops@example.com"),
            "email 'ops@example.com' must be valid; validate_email_format returned false"
        );
    }

    #[test]
    fn test_email_validation_subdomain_email_passes() {
        // A subdomain address must also pass (the '.' is in the domain).
        assert!(
            validate_email_format("user@mail.example.co.in"),
            "email 'user@mail.example.co.in' must be valid; validate_email_format returned false"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 4c — CreateUserRequest: role validation
    // Requirements: R-USR-2.3, AC-USR-2-F5
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_role_validation_admin_is_valid() {
        assert!(
            validate_role("admin"),
            "role 'admin' must be valid; validate_role returned false"
        );
    }

    #[test]
    fn test_role_validation_reviewer_is_valid() {
        assert!(
            validate_role("reviewer"),
            "role 'reviewer' must be valid; validate_role returned false"
        );
    }

    #[test]
    fn test_role_validation_superuser_is_invalid() {
        // Any string other than "admin" or "reviewer" must be rejected (R-USR-2.3).
        assert!(
            !validate_role("superuser"),
            "role 'superuser' must be invalid; validate_role returned true"
        );
    }

    #[test]
    fn test_role_validation_uppercase_admin_is_invalid() {
        // Validation is case-sensitive; "Admin" is not the same as "admin".
        assert!(
            !validate_role("Admin"),
            "role 'Admin' (capital A) must be invalid (case-sensitive); \
             validate_role returned true"
        );
    }

    #[test]
    fn test_role_validation_empty_string_is_invalid() {
        assert!(
            !validate_role(""),
            "empty string must be an invalid role; validate_role returned true"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 5 — JwtClaims serialization / deserialization
    // Requirements: AC-AUTH-03 (JWT payload shape)
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_jwt_claims_round_trips() {
        // JwtClaims must survive a serialize → deserialize round-trip with identical values.
        let original = JwtClaims {
            sub: "a1b2c3d4-0000-4000-8000-000000000001".to_string(),
            email: "ops@example.com".to_string(),
            role: "admin".to_string(),
            exp: 9_999_999_999, // far-future Unix timestamp for determinism
        };

        let json = serde_json::to_string(&original)
            .expect("JwtClaims must serialize without error");
        let decoded: JwtClaims = serde_json::from_str(&json)
            .expect("JwtClaims must deserialize from its own serialized form without error");

        assert_eq!(
            decoded.sub, original.sub,
            "JwtClaims.sub must survive round-trip; expected '{}', got '{}'",
            original.sub, decoded.sub
        );
        assert_eq!(
            decoded.email, original.email,
            "JwtClaims.email must survive round-trip; expected '{}', got '{}'",
            original.email, decoded.email
        );
        assert_eq!(
            decoded.role, original.role,
            "JwtClaims.role must survive round-trip; expected '{}', got '{}'",
            original.role, decoded.role
        );
        assert_eq!(
            decoded.exp, original.exp,
            "JwtClaims.exp must survive round-trip; expected {}, got {}",
            original.exp, decoded.exp
        );
    }

    #[test]
    fn test_jwt_claims_exp_field_is_present_in_serialized_json() {
        // AC-AUTH-03: the JWT payload must contain an 'exp' field (integer Unix timestamp).
        let claims = JwtClaims {
            sub: "550e8400-e29b-41d4-a716-446655440000".to_string(),
            email: "ops@example.com".to_string(),
            role: "reviewer".to_string(),
            exp: 1_800_000_000,
        };

        let json = serde_json::to_string(&claims)
            .expect("JwtClaims must serialize without error");

        assert!(
            json.contains("\"exp\""),
            "JwtClaims JSON must contain 'exp' field, but got: {}",
            json
        );
        assert!(
            json.contains("1800000000"),
            "JwtClaims JSON must contain the exp value 1800000000, but got: {}",
            json
        );
    }

    #[test]
    fn test_jwt_claims_sub_and_role_present_in_serialized_json() {
        // AC-AUTH-03: the JWT payload must also contain 'sub' and 'role'.
        let claims = JwtClaims {
            sub: "a1b2c3d4-0000-4000-8000-000000000001".to_string(),
            email: "test@example.com".to_string(),
            role: "admin".to_string(),
            exp: 9_999_999_999,
        };

        let json = serde_json::to_string(&claims)
            .expect("JwtClaims must serialize without error");

        assert!(
            json.contains("\"sub\""),
            "JwtClaims JSON must contain 'sub' field, but got: {}",
            json
        );
        assert!(
            json.contains("\"role\""),
            "JwtClaims JSON must contain 'role' field, but got: {}",
            json
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 6 — StatsResponse serialization
    // Requirements: R33, R34, AC-RPT-43, AC-RPT-44
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_stats_response_total_reports_is_present() {
        // R33: the 'total_reports' field must be present and carry an integer value.
        let stats = StatsResponse {
            total_reports: 42,
            by_status: HashMap::new(),
            by_category: HashMap::new(),
            by_severity: HashMap::new(),
        };

        let json = serde_json::to_string(&stats)
            .expect("StatsResponse must serialize without error");

        assert!(
            json.contains("\"total_reports\":42"),
            "StatsResponse JSON must contain 'total_reports':42, but got: {}",
            json
        );
    }

    #[test]
    fn test_stats_response_by_status_serializes_correctly() {
        // R33, AC-RPT-43: by_status must be an object with string keys and integer values.
        let mut by_status = HashMap::new();
        by_status.insert("submitted".to_string(), 3_i64);
        by_status.insert("under_review".to_string(), 2_i64);
        by_status.insert("resolved".to_string(), 1_i64);

        let stats = StatsResponse {
            total_reports: 6,
            by_status,
            by_category: HashMap::new(),
            by_severity: HashMap::new(),
        };

        let json = serde_json::to_string(&stats)
            .expect("StatsResponse must serialize without error");

        // Each key-value pair must be present.
        assert!(
            json.contains("\"submitted\":3"),
            "by_status must contain 'submitted':3, but got: {}",
            json
        );
        assert!(
            json.contains("\"under_review\":2"),
            "by_status must contain 'under_review':2, but got: {}",
            json
        );
        assert!(
            json.contains("\"resolved\":1"),
            "by_status must contain 'resolved':1, but got: {}",
            json
        );
        assert!(
            json.contains("\"by_status\""),
            "StatsResponse JSON must contain 'by_status' key, but got: {}",
            json
        );
    }

    #[test]
    fn test_stats_response_zero_counts_serialize_as_zero_not_absent() {
        // R34: categories / statuses with zero reports must appear with value 0,
        // not be omitted from the JSON.
        let mut by_category = HashMap::new();
        by_category.insert("no_footpath".to_string(), 0_i64);
        by_category.insert("broken_footpath".to_string(), 0_i64);

        let stats = StatsResponse {
            total_reports: 0,
            by_status: HashMap::new(),
            by_category,
            by_severity: HashMap::new(),
        };

        let json = serde_json::to_string(&stats)
            .expect("StatsResponse must serialize without error");

        assert!(
            json.contains("\"no_footpath\":0"),
            "no_footpath with zero count must appear as 0 (not be absent), but got: {}",
            json
        );
        assert!(
            json.contains("\"broken_footpath\":0"),
            "broken_footpath with zero count must appear as 0 (not be absent), but got: {}",
            json
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 7 — UpdateStatusRequest validation
    // Requirements: R15, AC-RPT-29, AC-RPT-30
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_update_status_submitted_is_valid() {
        // R15: "submitted" is one of the three permitted status values.
        let req = UpdateStatusRequest {
            status: "submitted".to_string(),
            note: None,
        };
        assert!(
            req.is_valid_status(),
            "status 'submitted' must be valid; is_valid_status() returned false"
        );
    }

    #[test]
    fn test_update_status_under_review_is_valid() {
        // R15: "under_review" is one of the three permitted status values.
        let req = UpdateStatusRequest {
            status: "under_review".to_string(),
            note: None,
        };
        assert!(
            req.is_valid_status(),
            "status 'under_review' must be valid; is_valid_status() returned false"
        );
    }

    #[test]
    fn test_update_status_resolved_is_valid() {
        // R15: "resolved" is one of the three permitted status values.
        let req = UpdateStatusRequest {
            status: "resolved".to_string(),
            note: Some("fixed on site".to_string()),
        };
        assert!(
            req.is_valid_status(),
            "status 'resolved' must be valid; is_valid_status() returned false"
        );
    }

    #[test]
    fn test_update_status_rejected_is_invalid() {
        // R15: "rejected" is NOT one of the three permitted values (AC-RPT-29 uses
        // "flagged" as the example; "rejected" is equally invalid).
        let req = UpdateStatusRequest {
            status: "rejected".to_string(),
            note: None,
        };
        assert!(
            !req.is_valid_status(),
            "status 'rejected' must be invalid; is_valid_status() returned true"
        );
    }

    #[test]
    fn test_update_status_uppercase_is_invalid() {
        // R15: validation is case-sensitive. "SUBMITTED" is not "submitted".
        let req = UpdateStatusRequest {
            status: "SUBMITTED".to_string(),
            note: None,
        };
        assert!(
            !req.is_valid_status(),
            "status 'SUBMITTED' (uppercase) must be invalid (case-sensitive match required); \
             is_valid_status() returned true"
        );
    }

    #[test]
    fn test_update_status_empty_string_is_invalid() {
        // An empty status string must be rejected (AC-RPT-30 / AC-RPT-31).
        let req = UpdateStatusRequest {
            status: "".to_string(),
            note: None,
        };
        assert!(
            !req.is_valid_status(),
            "empty status string must be invalid; is_valid_status() returned true"
        );
    }

    #[test]
    fn test_update_status_flagged_is_invalid() {
        // AC-RPT-29 uses "flagged" as the canonical invalid-status example.
        let req = UpdateStatusRequest {
            status: "flagged".to_string(),
            note: None,
        };
        assert!(
            !req.is_valid_status(),
            "status 'flagged' must be invalid per AC-RPT-29; is_valid_status() returned true"
        );
    }

    #[test]
    fn test_update_status_note_is_optional_and_does_not_affect_validity() {
        // note is optional (R14). The presence or absence of a note must not
        // change whether the status value itself is considered valid.
        let with_note = UpdateStatusRequest {
            status: "resolved".to_string(),
            note: Some("a note".to_string()),
        };
        let without_note = UpdateStatusRequest {
            status: "resolved".to_string(),
            note: None,
        };
        assert!(
            with_note.is_valid_status(),
            "status 'resolved' with a note must still be valid"
        );
        assert!(
            without_note.is_valid_status(),
            "status 'resolved' without a note must still be valid"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 8 — Phase 2: AdminUser struct holds is_super_admin
    // Requirements: SA-BE-4 (AC-SA-BE-4-S1), ASSUMPTION-P2-SA-3 Option A
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-SA-BE-4-S1 — AdminUser struct must have an is_super_admin field.
    /// The field must default to false for regular users; the seed path sets it
    /// to true. This test confirms the field round-trips through into_response().
    #[test]
    fn test_admin_user_is_super_admin_false_maps_to_response() {
        // A non-super-admin user created via the API always has is_super_admin = false.
        // Confirm the value survives the into_response() conversion.
        let user = AdminUser {
            is_super_admin: false,
            ..make_admin_user()
        };
        let response = user.into_response();
        assert!(
            !response.is_super_admin,
            "into_response() must preserve is_super_admin=false; \
             expected false, got true"
        );
    }

    /// AC-SA-BE-4-S1 — The super-admin seed row has is_super_admin = true.
    /// The into_response() conversion must NOT coerce this to false.
    #[test]
    fn test_admin_user_is_super_admin_true_maps_to_response() {
        // The seeded admin user has is_super_admin = true. Confirm the value
        // survives the into_response() conversion.
        let user = AdminUser {
            is_super_admin: true,
            ..make_admin_user()
        };
        let response = user.into_response();
        assert!(
            response.is_super_admin,
            "into_response() must preserve is_super_admin=true (seeded super-admin); \
             expected true, got false"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 9 — Phase 2: AdminUserResponse serializes is_super_admin
    // Requirements: SA-BE-4 (AC-SA-BE-4-S1), AC-SA-BE-4-F1
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-SA-BE-4-S1 — is_super_admin field must be present in the serialized
    /// JSON output when true. This is a positive-value serialization check.
    #[test]
    fn test_admin_user_response_serializes_is_super_admin_true() {
        // A super-admin row must serialize is_super_admin as true.
        let mut response = make_admin_user_response();
        response.is_super_admin = true;

        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        assert!(
            json.contains("\"is_super_admin\":true"),
            "AdminUserResponse JSON must contain '\"is_super_admin\":true' for the \
             seeded super-admin user (AC-SA-BE-4-S1); got: {}",
            json
        );
    }

    /// AC-SA-BE-4-S1 — is_super_admin must also be present for non-super-admin
    /// users (serialized as false). The field must always be present, not omitted.
    #[test]
    fn test_admin_user_response_serializes_is_super_admin_false() {
        // A non-super-admin row must serialize is_super_admin as false (present,
        // not omitted from the JSON).
        let response = make_admin_user_response(); // is_super_admin: false

        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        assert!(
            json.contains("\"is_super_admin\":false"),
            "AdminUserResponse JSON must contain '\"is_super_admin\":false' for regular \
             users (is_super_admin must be present in every element, not omitted); \
             got: {}",
            json
        );
    }

    /// AC-SA-BE-4-F1 (regression guard) — password_hash must still be absent from
    /// AdminUserResponse after Phase 2 additions. Adding is_super_admin must not
    /// accidentally re-introduce any sensitive field.
    #[test]
    fn test_admin_user_response_still_omits_password_hash_after_phase2() {
        let user = AdminUser {
            is_super_admin: true, // super-admin path to exercise new code branch
            ..make_admin_user()
        };
        let response = user.into_response();
        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        assert!(
            !json.contains("password_hash"),
            "password_hash must NEVER appear in AdminUserResponse JSON even after Phase 2 \
             additions; regression guard. Got: {}",
            json
        );
        assert!(
            !json.contains("$argon2id$"),
            "argon2id hash value must NEVER appear in AdminUserResponse JSON; got: {}",
            json
        );
    }

    /// AC-SA-BE-4-S1 — the is_super_admin key must appear in the field list for
    /// a well-formed AdminUserResponse. This belt-and-suspenders test iterates
    /// all required field names in a single assertion pass.
    #[test]
    fn test_admin_user_response_includes_is_super_admin_in_field_list() {
        let mut response = make_admin_user_response();
        response.is_super_admin = true;

        let json = serde_json::to_string(&response)
            .expect("AdminUserResponse must serialize without error");

        // Every field mandated by AC-SA-BE-4-S1 must be present in the JSON.
        for field in &[
            "\"id\"",
            "\"email\"",
            "\"role\"",
            "\"display_name\"",
            "\"is_active\"",
            "\"created_at\"",
            "\"last_login_at\"",
            "\"is_super_admin\"",
        ] {
            assert!(
                json.contains(field),
                "AdminUserResponse JSON must contain field {} (AC-SA-BE-4-S1 requires \
                 is_super_admin to be present in every element); got: {}",
                field,
                json
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 10 — Phase 2: is_super_admin guard pure function
    // Requirements: AC-SA-BE-3-F1, SA Security Considerations
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-SA-BE-3-F1 — guard_super_admin_deactivation must return
    /// AppError::Forbidden when is_super_admin = true, without any DB mutation.
    /// This is the red-phase stub test — will panic until implemented.
    #[test]
    fn test_guard_super_admin_deactivation_returns_forbidden_for_super_admin() {
        // AC-SA-BE-3-F1: deactivating a super-admin must be blocked BEFORE any
        // DB call. The guard is a pure predicate on the is_super_admin flag.
        let result = guard_super_admin_deactivation(true);
        assert!(
            result.is_err(),
            "guard_super_admin_deactivation(true) must return Err (Forbidden); \
             the super-admin deactivation path must be blocked pre-DB. Got Ok(())"
        );
        assert!(
            matches!(result.unwrap_err(), AppError::Forbidden),
            "guard_super_admin_deactivation(true) must return \
             AppError::Forbidden specifically (HTTP 403); \
             got a different AppError variant"
        );
    }

    /// AC-SA-BE-3-S1 — guard_super_admin_deactivation must return Ok(()) when
    /// is_super_admin = false (normal deactivation path should proceed).
    #[test]
    fn test_guard_super_admin_deactivation_returns_ok_for_regular_user() {
        // A non-super-admin target must pass the guard so the DB deactivation
        // query can proceed normally.
        let result = guard_super_admin_deactivation(false);
        assert!(
            result.is_ok(),
            "guard_super_admin_deactivation(false) must return Ok(()) so that \
             the deactivation DB query proceeds for regular users; got Err({:?})",
            result.err()
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 11 — Phase 2: API-created users cannot be super-admin
    // Requirements: AC-SA-BE-5-S1, AC-SA-BE-5-F1, ASSUMPTION-P2-SA-4 Option A
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-SA-BE-5-F1 — api_create_can_set_super_admin() must always return false.
    /// The API-created path must hardcode is_super_admin = FALSE, ignoring any
    /// is_super_admin field that might appear in the request body.
    #[test]
    fn test_api_create_cannot_set_super_admin() {
        // ASSUMPTION-P2-SA-4 Option A: is_super_admin can only be set via seed/
        // migration. The API-create path must always produce is_super_admin=false.
        let can_set = api_create_can_set_super_admin();
        assert!(
            !can_set,
            "api_create_can_set_super_admin() must return false; \
             the API-created user path must NEVER set is_super_admin=true, \
             regardless of what the request body contains. Got true."
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 12 — Phase 2: validate_display_name (Profile page)
    // Requirements: AC-PR-BE-1-F1, AC-PR-BE-1-F2, AC-PR-BE-1-F3
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-PR-BE-1-S1 — a valid display_name of 2+ non-whitespace characters
    /// must return Ok(()).
    #[test]
    fn test_validate_display_name_valid_string_passes() {
        // "Ops Lead" is 8 characters, non-whitespace — must pass validation.
        let result = validate_display_name("Ops Lead");
        assert!(
            result.is_ok(),
            "validate_display_name(\"Ops Lead\") must return Ok(()); \
             a valid 8-character display name was rejected. Got: {:?}",
            result
        );
    }

    /// AC-PR-BE-1-F3 — a display_name of exactly 1 character is below the
    /// 2-char minimum and must be rejected with "too_short".
    #[test]
    fn test_validate_display_name_one_char_is_too_short() {
        // [ASSUMPTION-P2-PR-2 Option A: minimum 2 chars]
        // "A" is exactly 1 character — below minimum.
        let result = validate_display_name("A");
        assert!(
            result.is_err(),
            "validate_display_name(\"A\") must return Err (1 char < 2 char minimum); \
             got Ok(())"
        );
        assert_eq!(
            result.unwrap_err(),
            "too_short",
            "validate_display_name(\"A\") must return Err(\"too_short\"); \
             1 char is below the 2-char minimum (AC-PR-BE-1-F3)"
        );
    }

    /// AC-PR-BE-1-F3 boundary — exactly 2 characters is the minimum valid value.
    #[test]
    fn test_validate_display_name_two_chars_is_minimum_valid() {
        // "AB" is exactly 2 characters — at the minimum boundary, must be valid.
        let result = validate_display_name("AB");
        assert!(
            result.is_ok(),
            "validate_display_name(\"AB\") must return Ok(()); \
             2 characters is the minimum valid length (AC-PR-BE-1-F3 boundary); \
             got: {:?}",
            result
        );
    }

    /// AC-PR-BE-1-F1 — a display_name exceeding 80 characters must be rejected.
    #[test]
    fn test_validate_display_name_81_chars_is_too_long() {
        // [ASSUMPTION-P2-PR-1 Option B: maximum 80 chars]
        // A string of exactly 81 characters must be rejected.
        let name_81 = "A".repeat(81);
        assert_eq!(
            name_81.chars().count(),
            81,
            "test fixture must be exactly 81 chars; fix the fixture"
        );
        let result = validate_display_name(&name_81);
        assert!(
            result.is_err(),
            "validate_display_name(81 chars) must return Err (81 > 80 max); \
             got Ok(())"
        );
        assert_eq!(
            result.unwrap_err(),
            "too_long",
            "validate_display_name(81 chars) must return Err(\"too_long\") \
             (AC-PR-BE-1-F1: max is 80 chars)"
        );
    }

    /// AC-PR-BE-1-F1 boundary — exactly 80 characters is the maximum valid value.
    #[test]
    fn test_validate_display_name_80_chars_is_maximum_valid() {
        // A string of exactly 80 characters must be accepted.
        let name_80 = "A".repeat(80);
        assert_eq!(
            name_80.chars().count(),
            80,
            "test fixture must be exactly 80 chars; fix the fixture"
        );
        let result = validate_display_name(&name_80);
        assert!(
            result.is_ok(),
            "validate_display_name(80 chars) must return Ok(()); \
             80 characters is the maximum valid length (AC-PR-BE-1-F1 boundary); \
             got: {:?}",
            result
        );
    }

    /// AC-PR-BE-1-F2 — a whitespace-only display_name must be rejected.
    #[test]
    fn test_validate_display_name_whitespace_only_is_rejected() {
        // "   " (three spaces) is whitespace-only — must be rejected.
        let result = validate_display_name("   ");
        assert!(
            result.is_err(),
            "validate_display_name(\"   \") must return Err (whitespace-only string); \
             got Ok(())"
        );
        assert_eq!(
            result.unwrap_err(),
            "whitespace_only",
            "validate_display_name(\"   \") must return Err(\"whitespace_only\") \
             (AC-PR-BE-1-F2)"
        );
    }

    /// AC-PR-BE-1-F2 — a tab-only display_name is also whitespace-only.
    #[test]
    fn test_validate_display_name_tab_only_is_whitespace_only() {
        let result = validate_display_name("\t\t");
        assert!(
            result.is_err(),
            "validate_display_name(\"\\t\\t\") must return Err (tab chars are whitespace); \
             got Ok(())"
        );
        assert_eq!(
            result.unwrap_err(),
            "whitespace_only",
            "validate_display_name(\"\\t\\t\") must return Err(\"whitespace_only\") \
             (AC-PR-BE-1-F2)"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 13 — Phase 2: validate_new_password (Change Password)
    // Requirements: AC-PR-BE-3-F2, AC-PR-BE-3-F3
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-PR-BE-3-S1 — a valid new password of 12+ chars different from current
    /// must return Ok(()).
    #[test]
    fn test_validate_new_password_valid_passes() {
        // "NewSecurePass1!" is 15 chars, differs from "OldPass123456!" — must pass.
        let result = validate_new_password("NewSecurePass1!", "OldPass123456!");
        assert!(
            result.is_ok(),
            "validate_new_password(valid 15-char password, different current) \
             must return Ok(()); got: {:?}",
            result
        );
    }

    /// AC-PR-BE-3-F2 boundary — exactly 11 characters is below the 12-char minimum.
    #[test]
    fn test_validate_new_password_11_chars_is_too_short() {
        // [ASSUMPTION-P2-PR-3: 12-char minimum consistent with user creation]
        // "Abcdefghijk" is exactly 11 characters — must be rejected.
        let new_pw = "Abcdefghijk";
        assert_eq!(
            new_pw.chars().count(),
            11,
            "test fixture must be exactly 11 chars; fix the fixture"
        );
        let result = validate_new_password(new_pw, "OldPass123456!");
        assert!(
            result.is_err(),
            "validate_new_password(11 chars) must return Err (minimum is 12); got Ok(())"
        );
        assert_eq!(
            result.unwrap_err(),
            "too_short",
            "validate_new_password(11 chars) must return Err(\"too_short\") \
             (AC-PR-BE-3-F2: minimum is 12 chars)"
        );
    }

    /// AC-PR-BE-3-F2 boundary — exactly 12 characters at the minimum is valid
    /// (when different from current_password).
    #[test]
    fn test_validate_new_password_12_chars_is_minimum_valid() {
        // "Abcdefghijk1" is exactly 12 characters — at the boundary, must be valid.
        let new_pw = "Abcdefghijk1";
        assert_eq!(
            new_pw.chars().count(),
            12,
            "test fixture must be exactly 12 chars; fix the fixture"
        );
        let result = validate_new_password(new_pw, "DifferentOldPw!");
        assert!(
            result.is_ok(),
            "validate_new_password(exactly 12 chars, different from current) \
             must return Ok(()); 12 chars is the minimum valid length. Got: {:?}",
            result
        );
    }

    /// AC-PR-BE-3-F3 — new_password same as current_password must be rejected.
    /// [ASSUMPTION-P2-PR-5: same-password rejected with 400]
    #[test]
    fn test_validate_new_password_same_as_current_is_rejected() {
        // When new_password == current_password, even if length >= 12, must reject.
        let password = "SamePassword123!";
        let result = validate_new_password(password, password);
        assert!(
            result.is_err(),
            "validate_new_password(same as current) must return Err \
             (AC-PR-BE-3-F3: new password must differ from current); got Ok(())"
        );
        assert_eq!(
            result.unwrap_err(),
            "same_as_current",
            "validate_new_password(same as current) must return \
             Err(\"same_as_current\") (AC-PR-BE-3-F3)"
        );
    }

    /// AC-PR-BE-3-F3 + AC-PR-BE-3-F2 ordering — when both too-short AND same-as-current
    /// apply, too_short should be reported first (length check precedes same-password check).
    #[test]
    fn test_validate_new_password_short_takes_priority_over_same_as_current() {
        // An 11-char password that also happens to equal the current password:
        // The too_short error should be returned, not same_as_current, because
        // length is validated before identity.
        let password = "Abcdefghijk"; // 11 chars
        assert_eq!(password.chars().count(), 11);
        let result = validate_new_password(password, password);
        assert!(
            result.is_err(),
            "validate_new_password(11 chars, same as current) must return Err; \
             got Ok(())"
        );
        assert_eq!(
            result.unwrap_err(),
            "too_short",
            "validate_new_password(11 chars, same as current) must report \
             Err(\"too_short\") — length check precedes identity check"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 14 — Phase 2: ChangePasswordRequest deserialization
    // Requirements: AC-PR-BE-3-F4, AC-PR-BE-4-F1
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-PR-BE-4-S1 — valid JSON with both required fields must deserialize.
    #[test]
    fn test_change_password_request_valid_deserialization() {
        let json = r#"{"current_password":"OldPass123!","new_password":"NewPass456!"}"#;
        let result: Result<ChangePasswordRequest, _> = serde_json::from_str(json);
        assert!(
            result.is_ok(),
            "ChangePasswordRequest with both required fields must deserialize \
             without error; got: {:?}",
            result.err()
        );
        let req = result.unwrap();
        assert_eq!(
            req.current_password, "OldPass123!",
            "current_password must be preserved; expected 'OldPass123!', got '{}'",
            req.current_password
        );
        assert_eq!(
            req.new_password, "NewPass456!",
            "new_password must be preserved; expected 'NewPass456!', got '{}'",
            req.new_password
        );
    }

    /// AC-PR-BE-3-F4 — a request missing current_password must fail deserialization.
    #[test]
    fn test_change_password_request_missing_current_password_fails() {
        let json = r#"{"new_password":"NewPass456!"}"#;
        let result: Result<ChangePasswordRequest, _> = serde_json::from_str(json);
        assert!(
            result.is_err(),
            "ChangePasswordRequest without 'current_password' must fail deserialization \
             (AC-PR-BE-3-F4: both fields are required); got Ok"
        );
    }

    /// AC-PR-BE-3-F4 — a request missing new_password must fail deserialization.
    #[test]
    fn test_change_password_request_missing_new_password_fails() {
        let json = r#"{"current_password":"OldPass123!"}"#;
        let result: Result<ChangePasswordRequest, _> = serde_json::from_str(json);
        assert!(
            result.is_err(),
            "ChangePasswordRequest without 'new_password' must fail deserialization \
             (AC-PR-BE-3-F4: both fields are required); got Ok"
        );
    }
}
