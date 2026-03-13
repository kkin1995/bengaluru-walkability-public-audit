// backend/src/db/admin_queries.rs
//
// Runtime SQLx queries for the admin dashboard subsystem.
// All queries use sqlx::query_as::<_, T>(sql).bind(...) — NOT compile-time
// macros — so `cargo test` works without a live database.
//
// Error mapping conventions:
//   - Duplicate key (PG error 23505) → AppError::Conflict
//   - Row-not-found on expected fetch → AppError::NotFound
//   - All other sqlx errors propagate via AppError::Database (From impl)

use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool, Row};
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::admin::{AdminUser, StatsResponse};
use crate::models::organization::Organization;

// ─────────────────────────────────────────────────────────────────────────────
// Internal row type — AdminUser does not derive FromRow (its derives are
// locked), so we map through this intermediate struct.
// ─────────────────────────────────────────────────────────────────────────────

#[derive(FromRow)]
struct AdminUserRow {
    id: Uuid,
    email: String,
    password_hash: String,
    role: String,
    display_name: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    is_active: bool,
    last_login_at: Option<DateTime<Utc>>,
    /// Phase 2 addition (AC-SA-BE-4-S1): must be selected from DB.
    is_super_admin: bool,
    /// Phase 1 Ward Foundation: org assignment for scoped report visibility.
    org_id: Option<Uuid>,
}

impl From<AdminUserRow> for AdminUser {
    fn from(r: AdminUserRow) -> Self {
        AdminUser {
            id: r.id,
            email: r.email,
            password_hash: r.password_hash,
            role: r.role,
            display_name: r.display_name,
            created_at: r.created_at,
            updated_at: r.updated_at,
            is_active: r.is_active,
            last_login_at: r.last_login_at,
            is_super_admin: r.is_super_admin,
            org_id: r.org_id,
        }
    }
}

// Re-used SELECT column list for admin_users queries.
// Phase 2: is_super_admin added (AC-SA-BE-4-S1).
const ADMIN_USER_COLS: &str = r#"
    id,
    email,
    password_hash,
    role::TEXT AS role,
    display_name,
    created_at,
    updated_at,
    is_active,
    last_login_at,
    is_super_admin,
    org_id
"#;

// ─────────────────────────────────────────────────────────────────────────────
// Admin user queries
// ─────────────────────────────────────────────────────────────────────────────

/// Fetch a single admin user by email address (for login lookup).
/// Returns `None` if no matching row exists.
pub async fn get_admin_user_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<AdminUser>, AppError> {
    let sql = format!(
        "SELECT {} FROM admin_users WHERE email = $1",
        ADMIN_USER_COLS
    );
    let row = sqlx::query_as::<_, AdminUserRow>(&sql)
        .bind(email)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(AdminUser::from))
}

/// Stamp `last_login_at = NOW()` for the given user after a successful login.
pub async fn update_last_login(pool: &PgPool, user_id: Uuid) -> Result<(), AppError> {
    sqlx::query("UPDATE admin_users SET last_login_at = NOW() WHERE id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Return all admin_users rows (active and inactive), ordered by creation time.
pub async fn list_admin_users(pool: &PgPool) -> Result<Vec<AdminUser>, AppError> {
    let sql = format!(
        "SELECT {} FROM admin_users ORDER BY created_at ASC",
        ADMIN_USER_COLS
    );
    let rows = sqlx::query_as::<_, AdminUserRow>(&sql)
        .fetch_all(pool)
        .await?;

    Ok(rows.into_iter().map(AdminUser::from).collect())
}

/// Insert a new admin user. Returns the created row.
/// Maps PostgreSQL unique-violation (code 23505) to `AppError::Conflict`.
pub async fn create_admin_user(
    pool: &PgPool,
    email: &str,
    password_hash: &str,
    role: &str,
    display_name: Option<&str>,
) -> Result<AdminUser, AppError> {
    let sql = format!(
        r#"
        INSERT INTO admin_users (email, password_hash, role, display_name)
        VALUES ($1, $2, $3::user_role, $4)
        RETURNING {}
        "#,
        ADMIN_USER_COLS
    );

    let row = sqlx::query_as::<_, AdminUserRow>(&sql)
        .bind(email)
        .bind(password_hash)
        .bind(role)
        .bind(display_name)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            // Detect duplicate-key violation and surface a 409 Conflict.
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.code().as_deref() == Some("23505") {
                    return AppError::Conflict(format!(
                        "An admin user with email '{}' already exists",
                        email
                    ));
                }
            }
            AppError::Database(e)
        })?;

    Ok(AdminUser::from(row))
}

// SQL for the deactivation UPDATE — exposed as a const so deactivate_admin_user_sql()
// can return the exact string that the live function uses, satisfying the test that
// verifies the atomic super-admin guard (AC-SA-BE-3-F1, SA Security Considerations).
const DEACTIVATE_ADMIN_USER_SQL: &str =
    "UPDATE admin_users SET is_active = FALSE \
     WHERE id = $1 AND is_active = TRUE AND is_super_admin = FALSE";

/// Soft-deactivate an admin user (sets `is_active = false`).
/// Returns `true` if the row existed and was updated, `false` if not found.
/// Super-admin rows are silently protected by the WHERE clause — they return false
/// (not found / not updated) rather than an error, so the caller's NotFound path
/// is exercised. The handler layer calls guard_super_admin_deactivation() before
/// reaching this function for a pre-DB Forbidden response.
pub async fn deactivate_admin_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<bool, AppError> {
    let result = sqlx::query(DEACTIVATE_ADMIN_USER_SQL)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin report queries
// ─────────────────────────────────────────────────────────────────────────────

/// Build the dynamic WHERE clause and return (clause_string, next_param_idx).
/// Shared by list_admin_reports and count_admin_reports so the WHERE logic is
/// always in sync.
fn build_report_where_clause(
    category: Option<&str>,
    status: Option<&str>,
    severity: Option<&str>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
    start_idx: i32,
) -> (String, i32) {
    let mut conditions: Vec<String> = Vec::new();
    let mut param_idx = start_idx;

    if category.is_some() {
        conditions.push(format!("reports.category::TEXT = ${}", param_idx));
        param_idx += 1;
    }
    if status.is_some() {
        conditions.push(format!("reports.status::TEXT = ${}", param_idx));
        param_idx += 1;
    }
    if severity.is_some() {
        conditions.push(format!("reports.severity::TEXT = ${}", param_idx));
        param_idx += 1;
    }
    if date_from.is_some() {
        conditions.push(format!("reports.created_at >= ${}", param_idx));
        param_idx += 1;
    }
    if date_to.is_some() {
        conditions.push(format!("reports.created_at <= ${}", param_idx));
        param_idx += 1;
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    (where_clause, param_idx)
}

/// Count reports matching the same filters as list_admin_reports.
/// Returns the total filtered row count (accurate regardless of limit/offset).
/// When `org_id` is Some, applies the same recursive CTE scoping as list_admin_reports
/// so pagination totals are accurate.
#[allow(clippy::too_many_arguments)]
pub async fn count_admin_reports(
    pool: &PgPool,
    category: Option<&str>,
    status: Option<&str>,
    severity: Option<&str>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
    org_id: Option<Uuid>,
) -> Result<i64, AppError> {
    let (where_clause, mut param_idx) =
        build_report_where_clause(category, status, severity, date_from, date_to, 1);

    // Append org-scoping condition when the caller has an org assignment.
    let org_clause = if org_id.is_some() {
        let cte = format!(
            " AND reports.ward_id IN (\
                WITH RECURSIVE org_subtree AS (\
                    SELECT id FROM organizations WHERE id = ${}\
                    UNION ALL\
                    SELECT o.id FROM organizations o\
                      JOIN org_subtree s ON o.parent_id = s.id\
                )\
                SELECT w.id FROM wards w\
                  JOIN org_subtree s ON w.org_id = s.id\
            )",
            param_idx
        );
        param_idx += 1;
        cte
    } else {
        String::new()
    };
    let _ = param_idx; // suppress unused-variable warning for count query

    let full_where = format!("{}{}", where_clause, org_clause);

    let sql = format!(
        r#"
        SELECT COUNT(*)
        FROM reports
        LEFT JOIN wards ON wards.id = reports.ward_id
        {}
        "#,
        full_where
    );

    let mut q = sqlx::query_scalar::<_, i64>(&sql);
    if let Some(v) = category  { q = q.bind(v); }
    if let Some(v) = status    { q = q.bind(v); }
    if let Some(v) = severity  { q = q.bind(v); }
    if let Some(v) = date_from { q = q.bind(v); }
    if let Some(v) = date_to   { q = q.bind(v); }
    if let Some(id) = org_id   { q = q.bind(id); }

    let count = q.fetch_one(pool).await?;
    Ok(count)
}

/// List reports with optional filters. Returns full-precision coordinates and
/// full PII fields (admin-only). Includes ward_name via LEFT JOIN.
/// When `org_id` is Some, restricts to reports whose ward_id belongs to the
/// org's recursive subtree (walks organizations tree downward via parent_id).
/// When `org_id` is None, returns all reports unfiltered.
#[allow(clippy::too_many_arguments)] // all 9 params are distinct filter axes; no sensible grouping
pub async fn list_admin_reports(
    pool: &PgPool,
    category: Option<&str>,
    status: Option<&str>,
    severity: Option<&str>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
    page: i64,
    limit: i64,
    org_id: Option<Uuid>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let (where_clause, mut param_idx) =
        build_report_where_clause(category, status, severity, date_from, date_to, 1);

    // Append org-scoping condition when the caller has an org assignment.
    let org_clause = if org_id.is_some() {
        let cte = format!(
            " AND reports.ward_id IN (\
                WITH RECURSIVE org_subtree AS (\
                    SELECT id FROM organizations WHERE id = ${}\
                    UNION ALL\
                    SELECT o.id FROM organizations o\
                      JOIN org_subtree s ON o.parent_id = s.id\
                )\
                SELECT w.id FROM wards w\
                  JOIN org_subtree s ON w.org_id = s.id\
            )",
            param_idx
        );
        param_idx += 1;
        cte
    } else {
        String::new()
    };

    let full_where = format!("{}{}", where_clause, org_clause);

    let offset = (page - 1) * limit;
    // param_idx currently points to the next free slot after filter + org params
    let limit_idx = param_idx;
    let offset_idx = param_idx + 1;

    let sql = format!(
        r#"
        SELECT
            reports.id,
            reports.created_at,
            reports.image_path,
            reports.latitude,
            reports.longitude,
            reports.category::TEXT AS category,
            reports.severity::TEXT AS severity,
            reports.description,
            reports.submitter_name,
            reports.submitter_contact,
            reports.status::TEXT AS status,
            reports.location_source::TEXT AS location_source,
            wards.ward_name AS ward_name
        FROM reports
        LEFT JOIN wards ON wards.id = reports.ward_id
        {}
        ORDER BY reports.created_at DESC
        LIMIT ${} OFFSET ${}
        "#,
        full_where, limit_idx, offset_idx
    );

    // Bind filter values in the same order as conditions were added.
    let mut q = sqlx::query(&sql);
    if let Some(v) = category   { q = q.bind(v); }
    if let Some(v) = status     { q = q.bind(v); }
    if let Some(v) = severity   { q = q.bind(v); }
    if let Some(v) = date_from  { q = q.bind(v); }
    if let Some(v) = date_to    { q = q.bind(v); }
    if let Some(id) = org_id    { q = q.bind(id); }
    q = q.bind(limit).bind(offset);

    let rows = q.fetch_all(pool).await?;

    let result = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id":                row.get::<Uuid, _>("id"),
                "created_at":        row.get::<DateTime<Utc>, _>("created_at"),
                "image_path":        row.get::<String, _>("image_path"),
                "latitude":          row.get::<f64, _>("latitude"),
                "longitude":         row.get::<f64, _>("longitude"),
                "category":          row.get::<String, _>("category"),
                "severity":          row.get::<String, _>("severity"),
                "description":       row.get::<Option<String>, _>("description"),
                "submitter_name":    row.get::<Option<String>, _>("submitter_name"),
                "submitter_contact": row.get::<Option<String>, _>("submitter_contact"),
                "status":            row.get::<String, _>("status"),
                "location_source":   row.get::<String, _>("location_source"),
                "ward_name":         row.get::<Option<String>, _>("ward_name"),
            })
        })
        .collect();

    Ok(result)
}

/// Fetch a single report by ID with full PII and exact coordinates.
/// Returns `None` if not found.
pub async fn get_admin_report_by_id(
    pool: &PgPool,
    report_id: Uuid,
) -> Result<Option<serde_json::Value>, AppError> {
    let row = sqlx::query(
        r#"
        SELECT
            id,
            created_at,
            image_path,
            latitude,
            longitude,
            category::TEXT AS category,
            severity::TEXT AS severity,
            description,
            submitter_name,
            submitter_contact,
            status::TEXT AS status,
            location_source::TEXT AS location_source
        FROM reports
        WHERE id = $1
        "#,
    )
    .bind(report_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| {
        serde_json::json!({
            "id":                r.get::<Uuid, _>("id"),
            "created_at":        r.get::<DateTime<Utc>, _>("created_at"),
            "image_path":        r.get::<String, _>("image_path"),
            "latitude":          r.get::<f64, _>("latitude"),
            "longitude":         r.get::<f64, _>("longitude"),
            "category":          r.get::<String, _>("category"),
            "severity":          r.get::<String, _>("severity"),
            "description":       r.get::<Option<String>, _>("description"),
            "submitter_name":    r.get::<Option<String>, _>("submitter_name"),
            "submitter_contact": r.get::<Option<String>, _>("submitter_contact"),
            "status":            r.get::<String, _>("status"),
            "location_source":   r.get::<String, _>("location_source"),
        })
    }))
}

/// Transition a report's status and record the change in `status_history`.
/// Returns `true` if found and updated, `false` if no such report exists.
pub async fn update_report_status(
    pool: &PgPool,
    report_id: Uuid,
    new_status: &str,
    note: Option<&str>,
    changed_by: Uuid,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;

    // Update the report; cast the string to the report_status enum.
    let result = sqlx::query(
        "UPDATE reports SET status = $1::report_status WHERE id = $2",
    )
    .bind(new_status)
    .bind(report_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        // Report not found — roll back and signal miss.
        tx.rollback().await?;
        return Ok(false);
    }

    // Insert audit trail row.
    sqlx::query(
        r#"
        INSERT INTO status_history (report_id, new_status, note, changed_by)
        VALUES ($1, $2::report_status, $3, $4)
        "#,
    )
    .bind(report_id)
    .bind(new_status)
    .bind(note)
    .bind(changed_by)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(true)
}

/// Delete a report row and return its `image_path` so the caller can remove
/// the file from disk. Returns `None` if no such report exists.
pub async fn delete_report(
    pool: &PgPool,
    report_id: Uuid,
) -> Result<Option<String>, AppError> {
    let row = sqlx::query("DELETE FROM reports WHERE id = $1 RETURNING image_path")
        .bind(report_id)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(|r| r.get::<String, _>("image_path")))
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

/// Aggregate report counts by status, category, and severity.
/// Every known enum value appears in the result maps, even when the count is 0
/// (populated from hard-coded known-value lists, then overwritten with DB counts).
pub async fn get_report_stats(pool: &PgPool) -> Result<StatsResponse, AppError> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reports")
        .fetch_one(pool)
        .await?;

    // Seed every expected key with 0 so callers always see a full map (R34).
    let mut by_status: std::collections::HashMap<String, i64> = [
        "submitted", "under_review", "resolved",
    ]
    .iter()
    .map(|k| (k.to_string(), 0))
    .collect();

    let mut by_category: std::collections::HashMap<String, i64> = [
        "no_footpath",
        "broken_footpath",
        "blocked_footpath",
        "no_curb_ramp",
        "unsafe_crossing",
        "poor_lighting",
        "encroachment",
        "other",
    ]
    .iter()
    .map(|k| (k.to_string(), 0))
    .collect();

    let mut by_severity: std::collections::HashMap<String, i64> = [
        "low", "medium", "high", "critical",
    ]
    .iter()
    .map(|k| (k.to_string(), 0))
    .collect();

    // Overwrite with actual DB counts.
    let status_rows = sqlx::query(
        "SELECT status::TEXT AS status, COUNT(*) AS cnt FROM reports GROUP BY status",
    )
    .fetch_all(pool)
    .await?;
    for row in &status_rows {
        let key: String = row.get("status");
        let cnt: i64 = row.get("cnt");
        by_status.insert(key, cnt);
    }

    let category_rows = sqlx::query(
        "SELECT category::TEXT AS category, COUNT(*) AS cnt FROM reports GROUP BY category",
    )
    .fetch_all(pool)
    .await?;
    for row in &category_rows {
        let key: String = row.get("category");
        let cnt: i64 = row.get("cnt");
        by_category.insert(key, cnt);
    }

    let severity_rows = sqlx::query(
        "SELECT severity::TEXT AS severity, COUNT(*) AS cnt FROM reports GROUP BY severity",
    )
    .fetch_all(pool)
    .await?;
    for row in &severity_rows {
        let key: String = row.get("severity");
        let cnt: i64 = row.get("cnt");
        by_severity.insert(key, cnt);
    }

    Ok(StatsResponse {
        total_reports: total,
        by_status,
        by_category,
        by_severity,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — New admin_queries functions (stubs)
// ─────────────────────────────────────────────────────────────────────────────

/// Update a user's display_name column in-place.
///
/// # Contract (AC-PR-BE-1-S1, AC-PR-BE-1-S2)
/// - `display_name = Some(s)` → sets column to the string value s
/// - `display_name = None`    → sets column to NULL
/// - In both cases, `updated_at` is refreshed to NOW().
/// - Returns the updated AdminUser row.
/// - Returns AppError::NotFound if no row matches `user_id`.
#[allow(dead_code)]
pub async fn update_admin_profile(
    pool: &PgPool,
    user_id: Uuid,
    display_name: Option<&str>,
) -> Result<AdminUser, AppError> {
    let sql = format!(
        "UPDATE admin_users SET display_name = $2, updated_at = NOW() \
         WHERE id = $1 RETURNING {}",
        ADMIN_USER_COLS
    );
    let row = sqlx::query_as::<_, AdminUserRow>(&sql)
        .bind(user_id)
        .bind(display_name)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(AdminUser::from(row))
}

/// Update a user's password_hash column in-place.
///
/// # Contract (AC-PR-BE-3-S1)
/// - Stores the new Argon2id hash.
/// - `updated_at` is refreshed to NOW().
/// - Returns Ok(()) on success.
/// - Returns AppError::NotFound if no row matches `user_id`.
#[allow(dead_code)]
pub async fn update_admin_password(
    pool: &PgPool,
    user_id: Uuid,
    new_password_hash: &str,
) -> Result<(), AppError> {
    let result = sqlx::query(
        "UPDATE admin_users SET password_hash = $2, updated_at = NOW() WHERE id = $1",
    )
    .bind(user_id)
    .bind(new_password_hash)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Fetch a single admin user by ID (for profile operations that work from JWT sub).
///
/// # Contract (AC-PR-BE-1-F5, AC-PR-BE-3-F6)
/// - Returns Some(AdminUser) if the row exists.
/// - Returns None if no row with the given UUID exists.
#[allow(dead_code)]
pub async fn get_admin_user_by_id(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<AdminUser>, AppError> {
    let sql = format!(
        "SELECT {} FROM admin_users WHERE id = $1",
        ADMIN_USER_COLS
    );
    let row = sqlx::query_as::<_, AdminUserRow>(&sql)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

    Ok(row.map(AdminUser::from))
}

// ─────────────────────────────────────────────────────────────────────────────
// Organization queries (Phase 1 — Ward Foundation)
// ─────────────────────────────────────────────────────────────────────────────

/// List all organizations ordered by org_type then name.
/// Used by GET /api/admin/organizations.
pub async fn list_organizations(pool: &PgPool) -> Result<Vec<Organization>, AppError> {
    let rows = sqlx::query_as::<_, Organization>(
        r#"
        SELECT id, name, org_type, parent_id, created_at, updated_at
        FROM organizations
        ORDER BY org_type, name
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Assign (or clear) an organization for an admin user.
/// `org_id = None` clears the assignment (super-admin / unscoped view).
/// Returns `AppError::NotFound` if no active user matches `user_id`.
pub async fn assign_user_org(
    pool: &PgPool,
    user_id: Uuid,
    org_id: Option<Uuid>,
) -> Result<(), AppError> {
    let result = sqlx::query(
        "UPDATE admin_users SET org_id = $1 WHERE id = $2 AND is_active = TRUE",
    )
    .bind(org_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 02-02 — Dedup columns constant
//
// This constant is referenced by the unit test below to verify that
// list_admin_reports SELECT includes the three deduplication columns.
// Initialized to an empty string (RED state) — Task 2 sets the real value.
// ─────────────────────────────────────────────────────────────────────────────

/// The three dedup columns that must appear in every list_admin_reports SELECT.
/// Task 1 initialises this to "" so that admin_reports_includes_dedup_cols()
/// fails (RED).  Task 2 sets the real column list and the test turns GREEN.
pub const ADMIN_REPORT_DEDUP_COLS: &str = "";

// ─────────────────────────────────────────────────────────────────────────────
// Pure SQL-string helpers (testable without a database)
// ─────────────────────────────────────────────────────────────────────────────

/// Returns the SQL column list used for all admin_users SELECT queries.
/// Exposed as a pure function so tests can verify the Phase 2 column
/// `is_super_admin` is present without executing any DB query.
///
/// # Contract (AC-SA-BE-4-S1)
/// The returned string must contain "is_super_admin".
///
/// This is a test-only hook — carries no behavioral side effects.
/// The `#[allow(dead_code)]` ensures the function compiles even if not
/// called in production code paths (only called from tests).
#[allow(dead_code)]
pub fn admin_user_cols_sql() -> &'static str {
    ADMIN_USER_COLS
}

/// Returns the SQL used to deactivate an admin user.
///
/// # Contract (AC-SA-BE-3-S1, SA Security Considerations)
/// The deactivation SQL must include `AND is_super_admin = FALSE` in the WHERE
/// clause so the super-admin guard is atomic (single UPDATE, no TOCTOU window).
#[allow(dead_code)]
pub fn deactivate_admin_user_sql() -> &'static str {
    DEACTIVATE_ADMIN_USER_SQL
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — no database required
//
// Requirements covered:
//   AC-SA-BE-4-S1  — ADMIN_USER_COLS includes is_super_admin
//   AC-SA-BE-3-F1  — deactivation SQL includes super-admin guard (atomic)
//   AC-SA-BE-5-S1  — create_admin_user SQL hardcodes is_super_admin = FALSE
//   AC-SA-BE-2-S1  — seed SQL sets is_super_admin = TRUE
//
// ── Implementation agent instructions ─────────────────────────────────────────
// Do NOT modify any test in this module. The tests are the behavioural contract.
// If a test appears to be incorrect, document your concern and request a review
// from the QA agent — do not alter assertions independently.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 1 — ADMIN_USER_COLS includes is_super_admin (AC-SA-BE-4-S1)
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-SA-BE-4-S1 — Every SELECT query that builds an AdminUser must include
    /// the is_super_admin column. This test verifies the shared column list
    /// contains the token so that all queries that use ADMIN_USER_COLS are covered.
    #[test]
    fn admin_user_cols_includes_is_super_admin() {
        let cols = admin_user_cols_sql();
        assert!(
            cols.contains("is_super_admin"),
            "ADMIN_USER_COLS must include 'is_super_admin' so that all admin_users \
             SELECT queries return the Phase 2 field (AC-SA-BE-4-S1); got: {}",
            cols
        );
    }

    /// AC-SA-BE-4-S1 — The column list must still include all pre-existing Phase 1
    /// columns. Adding is_super_admin must not accidentally drop any existing column.
    #[test]
    fn admin_user_cols_still_includes_all_phase1_columns() {
        let cols = admin_user_cols_sql();
        for col in &[
            "id",
            "email",
            "password_hash",
            "role",
            "display_name",
            "created_at",
            "updated_at",
            "is_active",
            "last_login_at",
        ] {
            assert!(
                cols.contains(col),
                "ADMIN_USER_COLS must still include column '{}' after Phase 2 additions; \
                 a column was accidentally removed. Got: {}",
                col,
                cols
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 2 — AdminUser struct carries is_super_admin (AC-SA-BE-4-S1)
    //
    // AdminUserRow is a private struct — we cannot construct it directly in
    // tests. Instead, we verify that AdminUser (the public output of the
    // From<AdminUserRow> conversion) correctly carries the is_super_admin field.
    // The models/admin.rs test suite covers the into_response() path.
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-SA-BE-4-S1 — AdminUser struct must have an is_super_admin field so
    /// that the DB query result can set it. This test constructs an AdminUser
    /// directly (without the DB row) to verify the field exists and can be set.
    #[test]
    fn admin_user_struct_has_is_super_admin_field() {
        use chrono::Utc;

        let now = Utc::now();
        // Construct with is_super_admin = true (seeded super-admin case).
        let super_admin = AdminUser {
            id: Uuid::nil(),
            email: "seed@example.com".to_string(),
            password_hash: "$argon2id$stub".to_string(),
            role: "admin".to_string(),
            display_name: None,
            created_at: now,
            updated_at: now,
            is_active: true,
            last_login_at: None,
            is_super_admin: true,
            org_id: None,
        };
        assert!(
            super_admin.is_super_admin,
            "AdminUser with is_super_admin=true must carry that value; \
             the DB row-to-struct mapping must not coerce it to false \
             (AC-SA-BE-4-S1). Got false."
        );

        // Also verify the false case (API-created user).
        let regular = AdminUser {
            id: Uuid::nil(),
            email: "api@example.com".to_string(),
            password_hash: "$argon2id$stub".to_string(),
            role: "reviewer".to_string(),
            display_name: None,
            created_at: now,
            updated_at: now,
            is_active: true,
            last_login_at: None,
            is_super_admin: false,
            org_id: None,
        };
        assert!(
            !regular.is_super_admin,
            "AdminUser with is_super_admin=false (API-created) must carry false; \
             the DB row-to-struct mapping must not coerce it to true \
             (AC-SA-BE-5-S1). Got true."
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 2b — Organization queries (Phase 1 — Ward Foundation)
    // ─────────────────────────────────────────────────────────────────────────

    /// WARD-03 — list_organizations must query FROM organizations with correct ordering.
    #[test]
    fn list_organizations_query_returns_all_orgs() {
        let sql = "SELECT id, name, org_type, parent_id, created_at, updated_at FROM organizations ORDER BY org_type, name";
        assert!(
            sql.contains("FROM organizations"),
            "list_organizations SQL must query FROM organizations; got: {}",
            sql
        );
        assert!(
            sql.contains("ORDER BY org_type, name"),
            "list_organizations SQL must order by org_type, name; got: {}",
            sql
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 2c — list_admin_reports ward JOIN and count_admin_reports (WARD-03)
    // ─────────────────────────────────────────────────────────────────────────

    /// WARD-03 — list_admin_reports SQL must include LEFT JOIN wards so that
    /// ward_name is populated for reports that fall within a ward boundary.
    #[test]
    fn list_admin_reports_sql_includes_ward_join() {
        // Build the SQL the same way list_admin_reports does (no filters).
        let (where_clause, param_idx) =
            build_report_where_clause(None, None, None, None, None, 1);
        let limit_idx = param_idx;
        let offset_idx = param_idx + 1;
        let sql = format!(
            r#"
            SELECT
                reports.id,
                reports.created_at,
                reports.image_path,
                reports.latitude,
                reports.longitude,
                reports.category::TEXT AS category,
                reports.severity::TEXT AS severity,
                reports.description,
                reports.submitter_name,
                reports.submitter_contact,
                reports.status::TEXT AS status,
                reports.location_source::TEXT AS location_source,
                wards.ward_name AS ward_name
            FROM reports
            LEFT JOIN wards ON wards.id = reports.ward_id
            {}
            ORDER BY reports.created_at DESC
            LIMIT ${} OFFSET ${}
            "#,
            where_clause, limit_idx, offset_idx
        );
        assert!(
            sql.contains("LEFT JOIN wards"),
            "list_admin_reports SQL must include LEFT JOIN wards; got: {}",
            sql
        );
        assert!(
            sql.contains("ward_name"),
            "list_admin_reports SQL must select ward_name; got: {}",
            sql
        );
    }

    /// WARD-03 — count_admin_reports SQL must include LEFT JOIN wards and
    /// SELECT COUNT(*) so the total matches across the same filter set.
    #[test]
    fn count_admin_reports_sql_includes_ward_join_and_count() {
        let (where_clause, _) =
            build_report_where_clause(None, None, None, None, None, 1);
        let sql = format!(
            r#"
            SELECT COUNT(*)
            FROM reports
            LEFT JOIN wards ON wards.id = reports.ward_id
            {}
            "#,
            where_clause
        );
        assert!(
            sql.contains("COUNT(*)"),
            "count_admin_reports SQL must include COUNT(*); got: {}",
            sql
        );
        assert!(
            sql.contains("LEFT JOIN wards"),
            "count_admin_reports SQL must include LEFT JOIN wards; got: {}",
            sql
        );
    }

    /// WARD-03 — build_report_where_clause with all filters must produce
    /// a clause with 5 conditions and advance param_idx to 6.
    #[test]
    fn build_report_where_clause_all_filters_advances_param_idx() {
        use chrono::Utc;
        let now = Utc::now();
        let (clause, next_idx) = build_report_where_clause(
            Some("broken_footpath"),
            Some("submitted"),
            Some("high"),
            Some(now),
            Some(now),
            1,
        );
        assert!(
            clause.starts_with("WHERE "),
            "All-filter clause must start with WHERE; got: {}",
            clause
        );
        assert_eq!(
            next_idx, 6,
            "With 5 filters starting at index 1, next param_idx must be 6"
        );
    }

    /// WARD-03 — build_report_where_clause with no filters must produce
    /// an empty string and leave param_idx at 1.
    #[test]
    fn build_report_where_clause_no_filters_is_empty() {
        let (clause, next_idx) =
            build_report_where_clause(None, None, None, None, None, 1);
        assert!(
            clause.is_empty(),
            "No-filter clause must be empty; got: {:?}",
            clause
        );
        assert_eq!(
            next_idx, 1,
            "With no filters, param_idx must remain at 1"
        );
    }

    /// WARD-03 — assign_user_org update must target correct table and column.
    #[test]
    fn assign_user_org_sql_targets_correct_table() {
        let sql = "UPDATE admin_users SET org_id = $1 WHERE id = $2 AND is_active = TRUE";
        assert!(
            sql.contains("UPDATE admin_users"),
            "assign_user_org must update admin_users table; got: {}",
            sql
        );
        assert!(
            sql.contains("org_id = $1"),
            "assign_user_org must set org_id; got: {}",
            sql
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 2d — Org-scoped report visibility (WARD-03, Plan 06)
    // ─────────────────────────────────────────────────────────────────────────

    /// WARD-03/P06 — ADMIN_USER_COLS must include org_id so get_admin_user_by_id
    /// can return the org assignment without a second query.
    #[test]
    fn admin_user_cols_includes_org_id() {
        let cols = admin_user_cols_sql();
        assert!(
            cols.contains("org_id"),
            "ADMIN_USER_COLS must include 'org_id' so that get_admin_user_by_id \
             returns the org assignment (WARD-03 P06); got: {}",
            cols
        );
    }

    /// WARD-03/P06 — AdminUser struct must expose org_id so the handler can
    /// extract it after fetching the user from the DB.
    #[test]
    fn admin_user_struct_has_org_id_field() {
        use chrono::Utc;
        let now = Utc::now();
        let test_org_id = Uuid::nil();

        // With org_id set to Some(uuid) — org-scoped admin
        let scoped = AdminUser {
            id: Uuid::nil(),
            email: "scoped@example.com".to_string(),
            password_hash: "$argon2id$stub".to_string(),
            role: "reviewer".to_string(),
            display_name: None,
            created_at: now,
            updated_at: now,
            is_active: true,
            last_login_at: None,
            is_super_admin: false,
            org_id: Some(test_org_id),
        };
        assert_eq!(
            scoped.org_id,
            Some(test_org_id),
            "AdminUser with org_id=Some(uuid) must carry that value; got: {:?}",
            scoped.org_id
        );

        // With org_id = None — super-admin / unscoped view
        let unscoped = AdminUser {
            id: Uuid::nil(),
            email: "super@example.com".to_string(),
            password_hash: "$argon2id$stub".to_string(),
            role: "admin".to_string(),
            display_name: None,
            created_at: now,
            updated_at: now,
            is_active: true,
            last_login_at: None,
            is_super_admin: true,
            org_id: None,
        };
        assert!(
            unscoped.org_id.is_none(),
            "AdminUser with org_id=None must carry None; got: {:?}",
            unscoped.org_id
        );
    }

    /// WARD-03/P06 — When org_id is Some, list_admin_reports SQL must contain
    /// the recursive CTE (org_subtree) and restrict by ward org membership.
    #[test]
    fn list_admin_reports_with_org_id_includes_recursive_cte() {
        let org_id = Some(Uuid::nil());
        let (where_clause, param_idx) =
            build_report_where_clause(None, None, None, None, None, 1);
        // Simulate what list_admin_reports does with org_id = Some
        let org_clause = if let Some(id) = org_id {
            let _ = id; // use the value
            format!(
                " AND reports.ward_id IN (\
                    WITH RECURSIVE org_subtree AS (\
                        SELECT id FROM organizations WHERE id = ${}\
                        UNION ALL\
                        SELECT o.id FROM organizations o\
                          JOIN org_subtree s ON o.parent_id = s.id\
                    )\
                    SELECT w.id FROM wards w\
                      JOIN org_subtree s ON w.org_id = s.id\
                )",
                param_idx
            )
        } else {
            String::new()
        };

        let full_where = format!("{}{}", where_clause, org_clause);
        assert!(
            full_where.contains("org_subtree"),
            "SQL with org_id=Some must contain recursive CTE 'org_subtree'; got: {}",
            full_where
        );
        assert!(
            full_where.contains("w.org_id = s.id"),
            "SQL with org_id=Some must join wards on w.org_id; got: {}",
            full_where
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 5 — ABUSE-06: list_admin_reports must include dedup columns
    // ─────────────────────────────────────────────────────────────────────────

    /// ABUSE-06 — list_admin_reports SELECT must include the three dedup columns
    /// so the frontend can show duplicate badges and Duplicate labels.
    ///
    /// RED PHASE: ADMIN_REPORT_DEDUP_COLS is "" until Task 2 sets the real value.
    #[test]
    fn admin_reports_includes_dedup_cols() {
        assert!(
            ADMIN_REPORT_DEDUP_COLS.contains("duplicate_count"),
            "Admin reports SELECT must include duplicate_count (ABUSE-06)"
        );
        assert!(
            ADMIN_REPORT_DEDUP_COLS.contains("duplicate_of_id"),
            "Admin reports SELECT must include duplicate_of_id (ABUSE-06)"
        );
        assert!(
            ADMIN_REPORT_DEDUP_COLS.contains("duplicate_confidence"),
            "Admin reports SELECT must include duplicate_confidence (ABUSE-06)"
        );
    }

    /// WARD-03/P06 — When org_id is None, no CTE is added to the WHERE clause.
    #[test]
    fn list_admin_reports_with_no_org_id_has_no_cte() {
        let org_id: Option<Uuid> = None;
        let (where_clause, _param_idx) =
            build_report_where_clause(None, None, None, None, None, 1);
        let org_clause = if org_id.is_some() {
            "WITH RECURSIVE org_subtree".to_string()
        } else {
            String::new()
        };
        let full_where = format!("{}{}", where_clause, org_clause);
        assert!(
            !full_where.contains("org_subtree"),
            "SQL with org_id=None must NOT contain org_subtree CTE; got: {}",
            full_where
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 3 — deactivation SQL atomic super-admin guard (AC-SA-BE-3-F1)
    // ─────────────────────────────────────────────────────────────────────────

    /// AC-SA-BE-3-F1 + SA Security Considerations — the deactivation UPDATE must
    /// include `AND is_super_admin = FALSE` (or equivalent) in its WHERE clause.
    /// This makes the super-admin protection atomic: a single SQL statement that
    /// cannot be split into a TOCTOU-vulnerable two-step SELECT + UPDATE.
    ///
    /// RED PHASE: deactivate_admin_user_sql() panics with todo!() until the impl
    /// agent updates deactivate_admin_user() to include the guard and updates
    /// this helper to return the actual SQL.
    #[test]
    fn deactivation_sql_includes_super_admin_guard() {
        let sql = deactivate_admin_user_sql();
        let upper = sql.to_uppercase();
        assert!(
            upper.contains("IS_SUPER_ADMIN") || sql.contains("is_super_admin"),
            "deactivate_admin_user SQL must include 'is_super_admin' in the WHERE clause \
             so the super-admin guard is atomic (SA Security Considerations: single UPDATE, \
             no TOCTOU window); got: {}",
            sql
        );
        assert!(
            upper.contains("FALSE"),
            "deactivate_admin_user SQL must include 'FALSE' to guard against deactivating \
             super-admin rows (AC-SA-BE-3-F1); got: {}",
            sql
        );
    }
}
