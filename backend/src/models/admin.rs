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
}
