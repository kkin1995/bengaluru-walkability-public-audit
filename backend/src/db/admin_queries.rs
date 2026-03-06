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
        }
    }
}

// Re-used SELECT column list for admin_users queries.
const ADMIN_USER_COLS: &str = r#"
    id,
    email,
    password_hash,
    role::TEXT AS role,
    display_name,
    created_at,
    updated_at,
    is_active,
    last_login_at
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

/// Soft-deactivate an admin user (sets `is_active = false`).
/// Returns `true` if the row existed and was updated, `false` if not found.
pub async fn deactivate_admin_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<bool, AppError> {
    let result = sqlx::query(
        "UPDATE admin_users SET is_active = FALSE WHERE id = $1 AND is_active = TRUE",
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin report queries
// ─────────────────────────────────────────────────────────────────────────────

/// List reports with optional filters. Returns full-precision coordinates and
/// full PII fields (admin-only). Uses dynamic WHERE clause construction.
#[allow(clippy::too_many_arguments)] // all 8 params are distinct filter axes; no sensible grouping
pub async fn list_admin_reports(
    pool: &PgPool,
    category: Option<&str>,
    status: Option<&str>,
    severity: Option<&str>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
    page: i64,
    limit: i64,
) -> Result<Vec<serde_json::Value>, AppError> {
    // Build the WHERE clause dynamically; bind parameter index starts at 1.
    let mut conditions: Vec<String> = Vec::new();
    let mut param_idx: i32 = 1;

    if category.is_some() {
        conditions.push(format!("category::TEXT = ${}", param_idx));
        param_idx += 1;
    }
    if status.is_some() {
        conditions.push(format!("status::TEXT = ${}", param_idx));
        param_idx += 1;
    }
    if severity.is_some() {
        conditions.push(format!("severity::TEXT = ${}", param_idx));
        param_idx += 1;
    }
    if date_from.is_some() {
        conditions.push(format!("created_at >= ${}", param_idx));
        param_idx += 1;
    }
    if date_to.is_some() {
        conditions.push(format!("created_at <= ${}", param_idx));
        param_idx += 1;
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let offset = (page - 1) * limit;
    // param_idx currently points to the next free slot
    let limit_idx = param_idx;
    let offset_idx = param_idx + 1;

    let sql = format!(
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
        {}
        ORDER BY created_at DESC
        LIMIT ${} OFFSET ${}
        "#,
        where_clause, limit_idx, offset_idx
    );

    // Bind filter values in the same order as conditions were added.
    let mut q = sqlx::query(&sql);
    if let Some(v) = category   { q = q.bind(v); }
    if let Some(v) = status     { q = q.bind(v); }
    if let Some(v) = severity   { q = q.bind(v); }
    if let Some(v) = date_from  { q = q.bind(v); }
    if let Some(v) = date_to    { q = q.bind(v); }
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
        INSERT INTO status_history (report_id, status, note, changed_by)
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
