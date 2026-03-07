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

use crate::db::admin_queries;

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

    // Insert the seed admin user.
    match admin_queries::create_admin_user(pool, &email, &password_hash, "admin", None).await {
        Ok(_) => tracing::info!("Seeded admin user: {email}"),
        Err(e) => tracing::error!("Admin seeding failed (insert): {e:?}"),
    }
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
}
