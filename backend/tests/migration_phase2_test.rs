// backend/tests/migration_phase2_test.rs
//
// Static analysis tests for Phase 2 migration SQL files.
//
// These tests do NOT require a live database. They verify that the migration
// SQL source text contains the structural elements mandated by the AC before
// any database is involved. A migration that does not contain the required
// DDL tokens cannot possibly satisfy the AC, regardless of how it is applied.
//
// Requirements covered:
//   AC-SA-BE-1-S1  — 003_super_admin.sql must add an is_super_admin BOOLEAN
//                    NOT NULL DEFAULT FALSE column to admin_users
//   AC-SA-BE-1-F2  — Column is added with ALTER TABLE (not CREATE TABLE), so
//                    the migration can be applied incrementally
//
// Test type: Unit (file read + string assertion). Priority: P0.
//
// ── Implementation agent instructions ─────────────────────────────────────────
// Do NOT modify these tests. The tests in this suite are the behavioural
// contract for this system. If a test appears to be incorrect, document your
// concern and request a review from the QA agent — do not alter assertions
// independently.
// ─────────────────────────────────────────────────────────────────────────────

// Path is relative to the Cargo workspace / package root.
const MIGRATION_003: &str = include_str!("../migrations/003_super_admin.sql");

/// AC-SA-BE-1-S1 — The migration must reference the `is_super_admin` column
/// name. This is the minimum token required for the schema to gain the field.
#[test]
fn migration_003_mentions_is_super_admin() {
    assert!(
        MIGRATION_003.contains("is_super_admin"),
        "003_super_admin.sql must contain the token 'is_super_admin'; \
         the migration cannot add the required column without naming it. \
         File contents:\n{}",
        MIGRATION_003
    );
}

/// AC-SA-BE-1-S1 — The new column must be typed as BOOLEAN (case-insensitive
/// check). PostgreSQL accepts both BOOLEAN and BOOL; we check for the canonical
/// form used by the project style guide.
#[test]
fn migration_003_declares_boolean_type() {
    let upper = MIGRATION_003.to_uppercase();
    assert!(
        upper.contains("BOOLEAN"),
        "003_super_admin.sql must declare the column type as BOOLEAN; \
         got:\n{}",
        MIGRATION_003
    );
}

/// AC-SA-BE-1-S1 — The column must have a DEFAULT FALSE constraint so that all
/// pre-existing rows receive is_super_admin = FALSE automatically when the
/// migration is applied, without requiring a separate UPDATE.
#[test]
fn migration_003_has_default_false() {
    let upper = MIGRATION_003.to_uppercase();
    assert!(
        upper.contains("DEFAULT FALSE"),
        "003_super_admin.sql must include 'DEFAULT FALSE' so existing rows \
         are automatically set to is_super_admin = FALSE; got:\n{}",
        MIGRATION_003
    );
}

/// AC-SA-BE-1-S1 — The migration must use ALTER TABLE (not CREATE TABLE or
/// DROP TABLE) because it is adding a column to an existing table. A CREATE
/// TABLE statement would indicate a structural error in the migration.
#[test]
fn migration_003_uses_alter_table() {
    let upper = MIGRATION_003.to_uppercase();
    assert!(
        upper.contains("ALTER TABLE"),
        "003_super_admin.sql must use ALTER TABLE to add a column to the \
         existing admin_users table; a CREATE TABLE statement would be wrong \
         for an incremental schema migration. Got:\n{}",
        MIGRATION_003
    );
}

/// AC-SA-BE-1-S1 — The migration must target the `admin_users` table.
/// A migration that alters a different table cannot satisfy the requirement.
#[test]
fn migration_003_targets_admin_users_table() {
    assert!(
        MIGRATION_003.contains("admin_users"),
        "003_super_admin.sql must reference the 'admin_users' table (the target \
         of the ALTER TABLE); got:\n{}",
        MIGRATION_003
    );
}

/// AC-SA-BE-1-S1 — The column must carry a NOT NULL constraint.
/// Without NOT NULL, rows inserted without the field would store NULL,
/// violating the boolean semantics of the super-admin flag.
#[test]
fn migration_003_has_not_null_constraint() {
    let upper = MIGRATION_003.to_uppercase();
    assert!(
        upper.contains("NOT NULL"),
        "003_super_admin.sql must include 'NOT NULL' on the is_super_admin column; \
         the flag must always be a definite true/false, never NULL. Got:\n{}",
        MIGRATION_003
    );
}

/// Regression guard: the migration must NOT drop any existing column or table.
/// An accidental DROP would destroy data for existing admin users.
#[test]
fn migration_003_does_not_drop_anything() {
    let upper = MIGRATION_003.to_uppercase();
    assert!(
        !upper.contains("DROP COLUMN") && !upper.contains("DROP TABLE"),
        "003_super_admin.sql must NOT contain DROP COLUMN or DROP TABLE; \
         an incremental migration must only add structure, never remove it. \
         Got:\n{}",
        MIGRATION_003
    );
}
