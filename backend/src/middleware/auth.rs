//! JWT authentication middleware and pure helper functions.
//!
//! The two public pure functions in this module are the behavioural contract
//! for JWT validation and role gating. The async Axum middleware
//! (`require_auth`) builds on top of them and is NOT unit-tested here; it is
//! covered by integration tests in the handlers suite.

use crate::errors::AppError;
use jsonwebtoken::{Algorithm, DecodingKey, Validation};
use std::sync::Arc;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Claims embedded in every `admin_token` JWT.
///
/// `sub` — UUID of the `admin_users` row (string form).
/// `email` — operator email address.
/// `role` — one of `"admin"` or `"reviewer"`.
/// `exp` — Unix timestamp (seconds) at which the token expires.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct JwtClaims {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub exp: usize,
}

// ---------------------------------------------------------------------------
// Pure functions (unit-testable, no async, no DB, no Axum extractors)
// ---------------------------------------------------------------------------

/// Decode and validate a JWT from the value of the `admin_token` cookie.
///
/// # Contract
///
/// | Input                                           | Output                    |
/// |------------------------------------------------|---------------------------|
/// | `None`                                         | `Err(AppError::Unauthorized)` |
/// | `Some("")`                                     | `Err(AppError::Unauthorized)` |
/// | `Some("not.a.jwt")`                            | `Err(AppError::Unauthorized)` |
/// | Signed with a different secret                 | `Err(AppError::Unauthorized)` |
/// | Valid JWT whose `exp` < now                    | `Err(AppError::Unauthorized)` |
/// | JWT with `alg: none` (unsigned)                | `Err(AppError::Unauthorized)` |
/// | Valid JWT with future `exp`, correct secret    | `Ok(JwtClaims { … })`    |
///
/// # Security note
/// `Validation` is constructed with `algorithms: [HS256]` only. Tokens
/// presenting `alg: "none"` are therefore rejected by the library before any
/// claim is decoded.
pub fn extract_claims(cookie_val: Option<&str>, secret: &[u8]) -> Result<JwtClaims, AppError> {
    let val = match cookie_val {
        None | Some("") => return Err(AppError::Unauthorized),
        Some(v) => v,
    };

    // Only accept HS256 — tokens with alg:none or any other algorithm are rejected
    // before any claim is decoded (security: prevents algorithm substitution attacks).
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true; // expired tokens must be rejected

    jsonwebtoken::decode::<JwtClaims>(val, &DecodingKey::from_secret(secret), &validation)
        .map(|token_data| token_data.claims)
        .map_err(|_| AppError::Unauthorized)
}

/// Check whether the authenticated operator holds the required role.
///
/// # Contract
///
/// | `claims.role` | `required_role` | Result          |
/// |--------------|----------------|-----------------|
/// | `"admin"`    | `"admin"`       | `Ok(())`        |
/// | `"admin"`    | `"reviewer"`    | `Ok(())` — admin is a superset of all roles |
/// | `"reviewer"` | `"reviewer"`    | `Ok(())`        |
/// | `"reviewer"` | `"admin"`       | `Err(AppError::Forbidden)` |
/// | any unknown  | `"admin"`       | `Err(AppError::Forbidden)` |
/// | any unknown  | `"reviewer"`    | `Err(AppError::Forbidden)` |
///
/// Pure function: no I/O, no clock reads, no DB access. Deterministic.
pub fn require_role(claims: &JwtClaims, required_role: &str) -> Result<(), AppError> {
    // "admin" is a superset of all roles — it passes every role gate.
    if claims.role == "admin" {
        return Ok(());
    }
    if claims.role == required_role {
        return Ok(());
    }
    Err(AppError::Forbidden)
}

// ---------------------------------------------------------------------------
// Axum middleware (async — not unit-tested; covered by integration tests)
// ---------------------------------------------------------------------------

/// Tower middleware layer that validates the `admin_token` cookie.
///
/// On success, the decoded `JwtClaims` are inserted into request extensions so
/// downstream handlers can extract them via `Extension<JwtClaims>`.
/// On failure, an `AppError::Unauthorized` response is returned immediately,
/// short-circuiting the handler chain.
pub async fn require_auth(
    axum::extract::State(state): axum::extract::State<Arc<crate::AppState>>,
    cookies: axum_extra::extract::CookieJar,
    mut req: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, AppError> {
    let cookie_val = cookies.get("admin_token").map(|c| c.value().to_owned());
    let claims = extract_claims(cookie_val.as_deref(), &state.jwt_secret)?;
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};

    // -----------------------------------------------------------------------
    // Test JWT builder
    // -----------------------------------------------------------------------

    /// Build a signed JWT for use in tests.
    ///
    /// `role`            — value for the `role` claim.
    /// `exp_offset_secs` — seconds added to the current Unix time for `exp`.
    ///                     Use a negative value for an already-expired token
    ///                     (e.g., -3600 = expired one hour ago).
    ///                     Use 1 for "expires in one second" (still valid now).
    /// `secret`          — HMAC-SHA256 signing key bytes.
    ///
    /// The `sub` and `email` fields are fixed to deterministic test values so
    /// assertions can be pinned without inspecting the token builder.
    fn make_test_jwt(role: &str, exp_offset_secs: i64, secret: &[u8]) -> String {
        let now = jsonwebtoken::get_current_timestamp() as i64;
        let exp = (now + exp_offset_secs) as usize;
        let claims = JwtClaims {
            sub: "11111111-1111-1111-1111-111111111111".to_string(),
            email: "ops@example.com".to_string(),
            role: role.to_string(),
            exp,
        };
        encode(
            &Header::default(), // HS256
            &claims,
            &EncodingKey::from_secret(secret),
        )
        .expect("make_test_jwt: encoding should never fail in tests")
    }

    // -----------------------------------------------------------------------
    // Constants used across tests
    // -----------------------------------------------------------------------

    const SECRET: &[u8] = b"test-secret-for-unit-tests-only";
    const WRONG_SECRET: &[u8] = b"completely-different-secret-key";

    // -----------------------------------------------------------------------
    // extract_claims — AC-AUTH-14, AC-AUTH-15, AC-AUTH-16 (pure function layer)
    // -----------------------------------------------------------------------

    /// R6.1 — A missing cookie (None) must be rejected immediately.
    /// Maps to: test_extract_claims_none_cookie
    #[test]
    fn test_extract_claims_none_cookie() {
        let result = extract_claims(None, SECRET);

        assert!(
            matches!(result, Err(AppError::Unauthorized)),
            "Expected Err(AppError::Unauthorized) when cookie_val is None, got: {:?}",
            result
        );
    }

    /// R6.1 edge case — An empty string cookie value is treated as absent.
    /// The empty string cannot be a valid JWT (no dots), so it must be rejected.
    /// Maps to: test_extract_claims_empty_string
    #[test]
    fn test_extract_claims_empty_string() {
        let result = extract_claims(Some(""), SECRET);

        assert!(
            matches!(result, Err(AppError::Unauthorized)),
            "Expected Err(AppError::Unauthorized) when cookie_val is Some(\"\"), got: {:?}",
            result
        );
    }

    /// R6 edge case — A string that is not a JWT at all must be rejected.
    /// "not.a.jwt" has the right dot count but invalid base64url segments.
    /// Maps to: test_extract_claims_malformed_jwt
    #[test]
    fn test_extract_claims_malformed_jwt() {
        let result = extract_claims(Some("not.a.jwt"), SECRET);

        assert!(
            matches!(result, Err(AppError::Unauthorized)),
            "Expected Err(AppError::Unauthorized) for malformed JWT 'not.a.jwt', got: {:?}",
            result
        );
    }

    /// R6.2 — A JWT signed with a secret that differs from the verification
    /// secret must be rejected (signature mismatch).
    /// Maps to: test_extract_claims_wrong_secret
    #[test]
    fn test_extract_claims_wrong_secret() {
        // Token signed with WRONG_SECRET; verified with SECRET — must fail.
        let token = make_test_jwt("admin", 3600, WRONG_SECRET);

        let result = extract_claims(Some(&token), SECRET);

        assert!(
            matches!(result, Err(AppError::Unauthorized)),
            "Expected Err(AppError::Unauthorized) when JWT signed with wrong secret, got: {:?}",
            result
        );
    }

    /// R6.3 — A JWT whose `exp` is 1 (a Unix timestamp far in the past)
    /// must be rejected. This covers the "already expired" path.
    /// The AC specifies `exp < now` strictly; exp=1 is always < now.
    /// Maps to: test_extract_claims_expired
    #[test]
    fn test_extract_claims_expired() {
        // exp = 1 second after Unix epoch — always expired in any real run.
        // We cannot use make_test_jwt's offset because offset of -(current_time - 1)
        // would be huge; instead build the claims manually.
        let claims = JwtClaims {
            sub: "11111111-1111-1111-1111-111111111111".to_string(),
            email: "ops@example.com".to_string(),
            role: "admin".to_string(),
            exp: 1, // Unix timestamp 1970-01-01T00:00:01Z — always in the past
        };
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(SECRET),
        )
        .expect("make expired token");

        let result = extract_claims(Some(&token), SECRET);

        assert!(
            matches!(result, Err(AppError::Unauthorized)),
            "Expected Err(AppError::Unauthorized) for expired JWT (exp=1), got: {:?}",
            result
        );
    }

    /// R6 security — The `alg: "none"` attack vector must be rejected.
    ///
    /// An attacker can craft a JWT with `alg: "none"` and no signature.
    /// If the library is not explicitly told to only accept HS256, it might
    /// decode the token as valid. The implementation must only accept HS256.
    ///
    /// We verify this by building a token that encodes the Header with
    /// `alg: none`. The jsonwebtoken crate's `Header::new(Algorithm::HS256)`
    /// is the correct default; here we attempt the none-alg encoding and
    /// confirm the verification rejects it.
    ///
    /// Maps to: test_extract_claims_alg_none_rejected
    #[test]
    fn test_extract_claims_alg_none_rejected() {
        // The jsonwebtoken crate does not expose Algorithm::None in its public
        // API (it rejects it at the library level), so we build the raw token
        // by hand using base64url encoding to simulate what an attacker would
        // send. This ensures our Validation layer rejects it rather than relying
        // solely on the library's default posture.
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

        let header = r#"{"alg":"none","typ":"JWT"}"#;
        // exp = year 2099 to ensure it would be valid if alg:none were accepted
        let payload = r#"{"sub":"11111111-1111-1111-1111-111111111111","email":"ops@example.com","role":"admin","exp":4102444800}"#;

        let header_b64 = URL_SAFE_NO_PAD.encode(header.as_bytes());
        let payload_b64 = URL_SAFE_NO_PAD.encode(payload.as_bytes());

        // alg:none token — no signature segment (or empty signature)
        let none_alg_token = format!("{}.{}.", header_b64, payload_b64);

        let result = extract_claims(Some(&none_alg_token), SECRET);

        assert!(
            matches!(result, Err(AppError::Unauthorized)),
            "Expected Err(AppError::Unauthorized) for alg:none JWT \
             (unsigned token must never be accepted), got: {:?}",
            result
        );
    }

    /// R6 happy path — A well-formed JWT with correct secret and future `exp`
    /// must decode successfully and return the embedded claims verbatim.
    /// Maps to: test_extract_claims_valid
    #[test]
    fn test_extract_claims_valid() {
        let token = make_test_jwt("admin", 3600, SECRET);

        let result = extract_claims(Some(&token), SECRET);

        assert!(
            result.is_ok(),
            "Expected Ok(JwtClaims) for a valid JWT with future exp, got: {:?}",
            result
        );

        let claims = result.unwrap();
        assert_eq!(
            claims.sub, "11111111-1111-1111-1111-111111111111",
            "Expected sub to equal the fixed test UUID, got: {:?}",
            claims.sub
        );
        assert_eq!(
            claims.email, "ops@example.com",
            "Expected email to equal 'ops@example.com', got: {:?}",
            claims.email
        );
        assert_eq!(
            claims.role, "admin",
            "Expected role to equal 'admin', got: {:?}",
            claims.role
        );
        // exp must be strictly greater than current time (token is not yet expired)
        let now = jsonwebtoken::get_current_timestamp() as usize;
        assert!(
            claims.exp > now,
            "Expected exp ({}) to be strictly greater than now ({}) for a valid token",
            claims.exp,
            now
        );
    }

    // -----------------------------------------------------------------------
    // require_role — AC-AUTH-19 through AC-AUTH-22 (pure function layer)
    // -----------------------------------------------------------------------

    /// Helper: build a JwtClaims with a specific role.
    /// Other fields are deterministic test values — tests must not depend on
    /// them being meaningful for the require_role function.
    fn claims_with_role(role: &str) -> JwtClaims {
        JwtClaims {
            sub: "22222222-2222-2222-2222-222222222222".to_string(),
            email: "test@example.com".to_string(),
            role: role.to_string(),
            exp: 9999999999, // far future — expiry is irrelevant to require_role
        }
    }

    /// R7.1, R7.3 — An admin operator must pass an admin role check.
    /// Maps to: test_require_role_admin_passes_admin_check
    #[test]
    fn test_require_role_admin_passes_admin_check() {
        let claims = claims_with_role("admin");

        let result = require_role(&claims, "admin");

        assert!(
            result.is_ok(),
            "Expected Ok(()) when role='admin' and required_role='admin', got: {:?}",
            result
        );
    }

    /// R7.1 — Admin is a superset of all roles. An admin operator must
    /// pass a reviewer role check without requiring an exact match.
    /// Maps to: test_require_role_admin_passes_reviewer_check
    #[test]
    fn test_require_role_admin_passes_reviewer_check() {
        let claims = claims_with_role("admin");

        let result = require_role(&claims, "reviewer");

        assert!(
            result.is_ok(),
            "Expected Ok(()) when role='admin' and required_role='reviewer' \
             (admin is a superset of reviewer permissions), got: {:?}",
            result
        );
    }

    /// R7.1 — A reviewer operator must pass a reviewer role check.
    /// Maps to: test_require_role_reviewer_passes_reviewer_check
    #[test]
    fn test_require_role_reviewer_passes_reviewer_check() {
        let claims = claims_with_role("reviewer");

        let result = require_role(&claims, "reviewer");

        assert!(
            result.is_ok(),
            "Expected Ok(()) when role='reviewer' and required_role='reviewer', got: {:?}",
            result
        );
    }

    /// R7.2 — A reviewer operator must be blocked from admin-only endpoints.
    /// Maps to: test_require_role_reviewer_fails_admin_check
    #[test]
    fn test_require_role_reviewer_fails_admin_check() {
        let claims = claims_with_role("reviewer");

        let result = require_role(&claims, "admin");

        assert!(
            matches!(result, Err(AppError::Forbidden)),
            "Expected Err(AppError::Forbidden) when role='reviewer' and \
             required_role='admin' (reviewer must not access admin-only routes), \
             got: {:?}",
            result
        );
    }

    /// R7 edge case — An unknown role (not "admin" or "reviewer") must never
    /// pass any role check, even for "reviewer"-gated routes.
    /// A role of "superuser" is not a valid system role; it must be treated
    /// as having no permissions.
    /// Maps to: test_require_role_unknown_role_fails
    #[test]
    fn test_require_role_unknown_role_fails() {
        let claims = claims_with_role("superuser");

        let result = require_role(&claims, "admin");

        assert!(
            matches!(result, Err(AppError::Forbidden)),
            "Expected Err(AppError::Forbidden) when role='superuser' (unknown role) \
             and required_role='admin', got: {:?}",
            result
        );
    }
}
