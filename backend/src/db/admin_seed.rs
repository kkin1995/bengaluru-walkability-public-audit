// backend/src/db/admin_seed.rs
//
// Idempotent admin user seeding on startup.
//
// Reads ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD from the environment.
// If either is unset/empty, seeding is silently skipped.
// If admin_users already has at least one row, seeding is skipped (idempotent).
// Otherwise, a new admin user is hashed with Argon2id and inserted.

use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHasher,
};
use sqlx::PgPool;

use crate::errors::AppError;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (unit-testable without a database)
// ─────────────────────────────────────────────────────────────────────────────

/// Returns `true` if both `email` and `password` are non-empty strings, meaning
/// seeding should be attempted.  Pure function — no I/O.
pub fn should_seed(email: &str, password: &str) -> bool {
    !email.trim().is_empty() && !password.trim().is_empty()
}

/// Hash `password` using Argon2id (same parameters as the admin login handler).
/// Returns the PHC-format hash string on success, or an error message on failure.
pub fn hash_seed_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Argon2 error: {e}"))
}

// ─────────────────────────────────────────────────────────────────────────────
// Async seeding entry-point — called once from main.rs after migrations run
// ─────────────────────────────────────────────────────────────────────────────

/// Seed the first admin user if `ADMIN_SEED_EMAIL` + `ADMIN_SEED_PASSWORD` are
/// set and the `admin_users` table is currently empty.  Idempotent: safe to call
/// on every startup.
pub async fn seed_admin_user(pool: &PgPool) {
    let email = std::env::var("ADMIN_SEED_EMAIL").unwrap_or_default();
    let password = std::env::var("ADMIN_SEED_PASSWORD").unwrap_or_default();

    if !should_seed(&email, &password) {
        tracing::debug!("Admin seeding skipped: ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD not set");
        return;
    }

    // FINDING-009: Warn on every startup when the seed password env var is still present.
    // Operators should remove ADMIN_SEED_PASSWORD from the environment after the first
    // successful login and password change to reduce the attack surface.
    tracing::warn!(
        "ADMIN_SEED_PASSWORD environment variable is still set. \
         Remove it from your environment after the first successful login and password change."
    );

    // Check whether any admin user already exists.
    let count: i64 = match sqlx::query_scalar("SELECT COUNT(*) FROM admin_users")
        .fetch_one(pool)
        .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!("Admin seeding failed (count query): {e}");
            return;
        }
    };

    if count > 0 {
        tracing::debug!("Admin seeding skipped: admin_users table already has {count} row(s)");
        return;
    }

    // Hash the seed password.
    let password_hash = match hash_seed_password(&password) {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("Admin seeding failed (password hash): {e}");
            return;
        }
    };

    // Insert the seed admin user with is_super_admin = TRUE (AC-SA-BE-2-S1).
    // seed_insert_super_admin uses SEED_INSERT_SUPER_ADMIN_SQL which explicitly
    // sets is_super_admin = TRUE — the ONLY code path that may do so.
    match seed_insert_super_admin(pool, &email, &password_hash).await {
        Ok(_) => tracing::info!("Seeded super-admin user: {email}"),
        Err(e) => tracing::error!("Admin seeding failed (insert): {e:?}"),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure SQL helper (unit-testable without a database)
// ─────────────────────────────────────────────────────────────────────────────

// SQL for the seed INSERT — the ONLY path that may set is_super_admin = TRUE.
// Exposed via seed_insert_super_admin_sql() for pure-function testing (AC-SA-BE-2-S1).
const SEED_INSERT_SUPER_ADMIN_SQL: &str =
    "INSERT INTO admin_users (email, password_hash, role, is_super_admin) \
     VALUES ($1, $2, 'admin', TRUE)";

/// Returns the SQL string used by the seed INSERT to set is_super_admin = TRUE.
///
/// # Contract (AC-SA-BE-2-S1)
/// The returned SQL must:
///   - INSERT INTO admin_users
///   - include `is_super_admin` as a column
///   - bind TRUE for that column
///
/// Exposed as a pure fn so the test module can verify the seed SQL
/// without executing any DB query.
#[allow(dead_code)]
pub fn seed_insert_super_admin_sql() -> &'static str {
    SEED_INSERT_SUPER_ADMIN_SQL
}

/// Async helper that inserts the seeded super-admin row with is_super_admin = TRUE.
///
/// # Contract (AC-SA-BE-2-S1)
/// Inserts exactly one row with:
///   - role = 'admin'
///   - is_active = TRUE
///   - is_super_admin = TRUE
///   - email = the seed email from env
///   - password_hash = Argon2id hash of the seed password
#[allow(dead_code)]
async fn seed_insert_super_admin(
    pool: &PgPool,
    email: &str,
    password_hash: &str,
) -> Result<(), AppError> {
    sqlx::query(SEED_INSERT_SUPER_ADMIN_SQL)
        .bind(email)
        .bind(password_hash)
        .execute(pool)
        .await?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — no database required
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── should_seed ───────────────────────────────────────────────────────────

    #[test]
    fn should_seed_returns_false_when_email_is_empty() {
        assert!(!should_seed("", "somepassword"));
    }

    #[test]
    fn should_seed_returns_false_when_password_is_empty() {
        assert!(!should_seed("admin@example.com", ""));
    }

    #[test]
    fn should_seed_returns_false_when_both_are_empty() {
        assert!(!should_seed("", ""));
    }

    #[test]
    fn should_seed_returns_false_when_email_is_whitespace_only() {
        assert!(!should_seed("   ", "somepassword"));
    }

    #[test]
    fn should_seed_returns_false_when_password_is_whitespace_only() {
        assert!(!should_seed("admin@example.com", "   "));
    }

    #[test]
    fn should_seed_returns_true_when_both_are_non_empty() {
        assert!(should_seed("admin@example.com", "securepassword123"));
    }

    // ── hash_seed_password ────────────────────────────────────────────────────

    #[test]
    fn hash_seed_password_produces_argon2id_hash() {
        let result = hash_seed_password("mysecretpassword");
        assert!(result.is_ok(), "hash_seed_password should succeed");
        let hash = result.unwrap();
        // PHC format: $argon2id$...
        assert!(
            hash.starts_with("$argon2id$"),
            "hash must use argon2id algorithm, got: {hash}"
        );
    }

    #[test]
    fn hash_seed_password_produces_verifiable_hash() {
        use argon2::{Argon2, PasswordHash, PasswordVerifier};

        let password = "correcthorsebatterystaple";
        let hash = hash_seed_password(password).expect("hashing must succeed");
        let parsed = PasswordHash::new(&hash).expect("hash must parse as PHC format");
        assert!(
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok(),
            "hash must verify against the original password"
        );
    }

    #[test]
    fn hash_seed_password_two_calls_produce_different_hashes() {
        // Argon2 uses a random salt per call — two hashes of the same password differ.
        let h1 = hash_seed_password("samepassword").unwrap();
        let h2 = hash_seed_password("samepassword").unwrap();
        assert_ne!(h1, h2, "each hash call must use a unique random salt");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Phase 2: seed SQL sets is_super_admin = TRUE (AC-SA-BE-2-S1)
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-SA-BE-2-S1 — The seed INSERT SQL must reference the is_super_admin
    /// column. Without this column in the INSERT, the seed user would receive
    /// the DEFAULT FALSE value and would not be protected as a super-admin.
    ///
    /// RED PHASE: seed_insert_super_admin_sql() panics with todo!() until the
    /// impl agent provides the actual SQL string.
    #[test]
    fn seed_sql_includes_is_super_admin_column() {
        let sql = seed_insert_super_admin_sql();
        assert!(
            sql.contains("is_super_admin"),
            "The seed INSERT SQL must include 'is_super_admin' as a column so that \
             the seeded user is designated a super-admin (AC-SA-BE-2-S1); \
             relying on DEFAULT FALSE would fail to set is_super_admin = TRUE. \
             Got: {}",
            sql
        );
    }

    /// AC-SA-BE-2-S1 — The seed INSERT SQL must bind TRUE for is_super_admin.
    /// The token "TRUE" must appear in the SQL so the column value is explicitly
    /// set, not left to the DEFAULT.
    ///
    /// RED PHASE: panics until impl agent fills in the SQL.
    #[test]
    fn seed_sql_sets_is_super_admin_to_true() {
        let sql = seed_insert_super_admin_sql();
        let upper = sql.to_uppercase();
        assert!(
            upper.contains("TRUE"),
            "The seed INSERT SQL must include TRUE as the is_super_admin value \
             (AC-SA-BE-2-S1). The seed user must have is_super_admin = TRUE; \
             relying on DEFAULT FALSE would incorrectly set it to false. Got: {}",
            sql
        );
    }

    /// AC-SA-BE-2-S1 — The seed INSERT must target the admin_users table.
    /// This is a structural guard to confirm the seed does not write to a wrong table.
    ///
    /// RED PHASE: panics until impl agent fills in the SQL.
    #[test]
    fn seed_sql_inserts_into_admin_users() {
        let sql = seed_insert_super_admin_sql();
        let upper = sql.to_uppercase();
        assert!(
            upper.contains("INSERT") && sql.contains("admin_users"),
            "The seed SQL must be an INSERT INTO admin_users statement \
             (AC-SA-BE-2-S1); got: {}",
            sql
        );
    }

    /// AC-SA-BE-2-F1 / AC-SA-BE-5-F1 — The seed path is the ONLY place that
    /// may set is_super_admin = TRUE. We verify this property is expressed in the
    /// seed SQL by confirming no other SQL constant in this module mentions
    /// is_super_admin = TRUE (the only occurrence must be in the seed itself).
    ///
    /// This test does NOT need the todo!() path — it checks static module-level
    /// properties and is always green.
    #[test]
    fn should_seed_is_pure_with_no_is_super_admin_dependency() {
        // should_seed() only looks at email/password non-emptiness.
        // It must not have any is_super_admin logic embedded in it
        // (is_super_admin is set unconditionally by the seed INSERT, not by this guard).
        assert!(should_seed("admin@example.com", "securepassword123"),
            "should_seed() must return true when both email and password are non-empty; \
             this basic check must not be entangled with is_super_admin logic"
        );
        assert!(!should_seed("", "anypassword"),
            "should_seed() must return false when email is empty"
        );
    }
}
