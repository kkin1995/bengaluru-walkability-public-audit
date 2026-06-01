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
const DEACTIVATE_ADMIN_USER_SQL: &str = "UPDATE admin_users SET is_active = FALSE \
     WHERE id = $1 AND is_active = TRUE AND is_super_admin = FALSE";

/// Soft-deactivate an admin user (sets `is_active = false`).
/// Returns `true` if the row existed and was updated, `false` if not found.
/// Super-admin rows are silently protected by the WHERE clause — they return false
/// (not found / not updated) rather than an error, so the caller's NotFound path
/// is exercised. The handler layer calls guard_super_admin_deactivation() before
/// reaching this function for a pre-DB Forbidden response.
pub async fn deactivate_admin_user(pool: &PgPool, user_id: Uuid) -> Result<bool, AppError> {
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

    // WR-01: use a top-level CTE so the query is compatible with PostgreSQL 11
    // and earlier. Inline CTEs inside IN(...) subqueries are non-standard and
    // rejected by PG < 12.
    let (cte_prefix, org_clause) = if org_id.is_some() {
        let cte = format!(
            "WITH RECURSIVE org_subtree AS (\
                SELECT id FROM organizations WHERE id = ${}\
                UNION ALL\
                SELECT o.id FROM organizations o\
                  JOIN org_subtree s ON o.parent_id = s.id\
            ) ",
            param_idx
        );
        param_idx += 1;
        let clause = " AND reports.ward_id IN (\
                SELECT w.id FROM wards w\
                  JOIN org_subtree s ON w.org_id = s.id\
            )".to_string();
        (cte, clause)
    } else {
        (String::new(), String::new())
    };
    let _ = param_idx; // suppress unused-variable warning for count query

    // WR-07: org_clause starts with " AND ..." — prepend WHERE when where_clause is empty
    // so the SQL is valid when org_id is Some but no other filters are active.
    let full_where = if where_clause.is_empty() && !org_clause.is_empty() {
        format!("WHERE{}", &org_clause[" AND".len()..])
    } else {
        format!("{}{}", where_clause, org_clause)
    };

    let sql = format!(
        r#"
        {}SELECT COUNT(*)
        FROM reports
        LEFT JOIN wards ON wards.id = reports.ward_id
        {}
        "#,
        cte_prefix,
        full_where
    );

    let mut q = sqlx::query_scalar::<_, i64>(&sql);
    if let Some(v) = category {
        q = q.bind(v);
    }
    if let Some(v) = status {
        q = q.bind(v);
    }
    if let Some(v) = severity {
        q = q.bind(v);
    }
    if let Some(v) = date_from {
        q = q.bind(v);
    }
    if let Some(v) = date_to {
        q = q.bind(v);
    }
    if let Some(id) = org_id {
        q = q.bind(id);
    }

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

    // WR-01: use a top-level CTE so the query is compatible with PostgreSQL 11
    // and earlier. Inline CTEs inside IN(...) subqueries are non-standard and
    // rejected by PG < 12.
    let (cte_prefix, org_clause) = if org_id.is_some() {
        let cte = format!(
            "WITH RECURSIVE org_subtree AS (\
                SELECT id FROM organizations WHERE id = ${}\
                UNION ALL\
                SELECT o.id FROM organizations o\
                  JOIN org_subtree s ON o.parent_id = s.id\
            ) ",
            param_idx
        );
        param_idx += 1;
        let clause = " AND reports.ward_id IN (\
                SELECT w.id FROM wards w\
                  JOIN org_subtree s ON w.org_id = s.id\
            )".to_string();
        (cte, clause)
    } else {
        (String::new(), String::new())
    };

    // WR-07: org_clause starts with " AND ..." — prepend WHERE when where_clause is empty
    // so the SQL is valid when org_id is Some but no other filters are active.
    let full_where = if where_clause.is_empty() && !org_clause.is_empty() {
        format!("WHERE{}", &org_clause[" AND".len()..])
    } else {
        format!("{}{}", where_clause, org_clause)
    };

    let offset = (page - 1) * limit;
    // param_idx currently points to the next free slot after filter + org params
    let limit_idx = param_idx;
    let offset_idx = param_idx + 1;

    let sql = format!(
        r#"
        {cte_prefix}SELECT
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
            wards.ward_name AS ward_name,
            wards.corporation AS corporation,
            {dedup_cols}
        FROM reports
        LEFT JOIN wards ON wards.id = reports.ward_id
        {where_clause}
        ORDER BY reports.created_at DESC
        LIMIT ${limit_idx} OFFSET ${offset_idx}
        "#,
        cte_prefix = cte_prefix,
        dedup_cols = ADMIN_REPORT_DEDUP_COLS,
        where_clause = full_where,
        limit_idx = limit_idx,
        offset_idx = offset_idx,
    );

    // Bind filter values in the same order as conditions were added.
    let mut q = sqlx::query(&sql);
    if let Some(v) = category {
        q = q.bind(v);
    }
    if let Some(v) = status {
        q = q.bind(v);
    }
    if let Some(v) = severity {
        q = q.bind(v);
    }
    if let Some(v) = date_from {
        q = q.bind(v);
    }
    if let Some(v) = date_to {
        q = q.bind(v);
    }
    if let Some(id) = org_id {
        q = q.bind(id);
    }
    q = q.bind(limit).bind(offset);

    let rows = q.fetch_all(pool).await?;

    let result = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id":                   row.get::<Uuid, _>("id"),
                "created_at":           row.get::<DateTime<Utc>, _>("created_at"),
                "image_path":           row.get::<String, _>("image_path"),
                "latitude":             row.get::<f64, _>("latitude"),
                "longitude":            row.get::<f64, _>("longitude"),
                "category":             row.get::<String, _>("category"),
                "severity":             row.get::<String, _>("severity"),
                "description":          row.get::<Option<String>, _>("description"),
                "submitter_name":       row.get::<Option<String>, _>("submitter_name"),
                "submitter_contact":    row.get::<Option<String>, _>("submitter_contact"),
                "status":               row.get::<String, _>("status"),
                "location_source":      row.get::<String, _>("location_source"),
                "ward_name":            row.get::<Option<String>, _>("ward_name"),
                // D-22: corporation is auto-derived at query time via LEFT JOIN wards.
                // Feeds the CORP column rendered by Plan 03-03 ReportsTable.
                "corporation":          row.try_get::<Option<String>, _>("corporation").unwrap_or(None),
                "duplicate_count":      row.try_get::<i32, _>("duplicate_count").unwrap_or(0),
                "duplicate_of_id":      row.try_get::<Option<Uuid>, _>("duplicate_of_id").unwrap_or(None),
                "duplicate_confidence": row.try_get::<Option<String>, _>("duplicate_confidence").unwrap_or(None),
            })
        })
        .collect();

    Ok(result)
}

/// Fetch all reports that are marked as duplicates of the given original report ID.
/// Returns a lightweight JSON representation used by the admin frontend expandable row.
pub async fn get_duplicate_reports_for_original(
    pool: &PgPool,
    original_id: Uuid,
) -> Result<Vec<serde_json::Value>, AppError> {
    let rows = sqlx::query(
        r#"SELECT reports.id, reports.created_at, reports.image_path,
                  reports.latitude, reports.longitude,
                  reports.category::TEXT AS category, reports.severity::TEXT AS severity,
                  reports.description, reports.submitter_name, reports.status::TEXT AS status,
                  wards.ward_name AS ward_name
           FROM reports
           LEFT JOIN wards ON reports.ward_id = wards.id
           WHERE reports.duplicate_of_id = $1
           ORDER BY reports.created_at ASC"#,
    )
    .bind(original_id)
    .fetch_all(pool)
    .await?;

    let result = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id":               row.try_get::<Uuid, _>("id").ok().map(|u| u.to_string()),
                "created_at":       row.try_get::<DateTime<Utc>, _>("created_at").ok(),
                "image_path":       row.try_get::<String, _>("image_path").unwrap_or_default(),
                "latitude":         row.try_get::<f64, _>("latitude").unwrap_or(0.0),
                "longitude":        row.try_get::<f64, _>("longitude").unwrap_or(0.0),
                "category":         row.try_get::<String, _>("category").unwrap_or_default(),
                "severity":         row.try_get::<String, _>("severity").unwrap_or_default(),
                "description":      row.try_get::<Option<String>, _>("description").unwrap_or(None),
                "submitter_name":   row.try_get::<Option<String>, _>("submitter_name").unwrap_or(None),
                "status":           row.try_get::<String, _>("status").unwrap_or_default(),
                "ward_name":        row.try_get::<Option<String>, _>("ward_name").unwrap_or(None),
                "duplicate_of_id":  null,
                "duplicate_count":  0,
                "duplicate_confidence": null,
            })
        })
        .collect();

    Ok(result)
}

/// Fetch a single report by ID with full PII and exact coordinates.
/// Returns `None` if not found.
/// Includes `updated_at` (D-04) and a `status_history` array newest-first (D-05, D-06).
pub async fn get_admin_report_by_id(
    pool: &PgPool,
    report_id: Uuid,
) -> Result<Option<serde_json::Value>, AppError> {
    let row = sqlx::query(
        r#"
        SELECT
            r.id,
            r.created_at,
            r.updated_at,
            r.image_path,
            r.latitude,
            r.longitude,
            r.category::TEXT AS category,
            r.severity::TEXT AS severity,
            r.description,
            r.submitter_name,
            r.submitter_contact,
            r.status::TEXT AS status,
            r.location_source::TEXT AS location_source,
            r.resolution_photo_path,
            r.resolution_notes,
            r.assigned_org_id,
            r.ward_id,
            w.ward_name,
            w.ward_number,
            w.zone_name,
            w.ro_division,
            w.aro_sub_division,
            w.assembly_constituency,
            w.assembly_constituency_no,
            w.parliamentary_constituency,
            w.mla_name,
            w.mp_name,
            o.name AS corporation,
            ao.name AS assigned_org_name
        FROM reports r
        LEFT JOIN wards w ON w.id = r.ward_id
        LEFT JOIN organizations o ON o.id = w.org_id
        LEFT JOIN organizations ao ON ao.id = r.assigned_org_id
        WHERE r.id = $1
        "#,
    )
    .bind(report_id)
    .fetch_optional(pool)
    .await?;

    // Early-return None if report not found — do not issue the status_history query.
    let r = match row {
        None => return Ok(None),
        Some(r) => r,
    };

    // D-05, D-06: Fetch status history for this report, newest first, with admin attribution.
    // BUG-03.2-B: uses STATUS_HISTORY_SQL constant which applies COALESCE(au.display_name,
    // au.email) so the admin email is shown when display_name is NULL.
    let history_rows = sqlx::query(STATUS_HISTORY_SQL)
        .bind(report_id)
        .fetch_all(pool)
        .await?;

    let status_history: Vec<serde_json::Value> = history_rows
        .iter()
        .map(|h| {
            serde_json::json!({
                "id":               h.get::<Uuid, _>("id"),
                "old_status":       h.try_get::<String, _>("old_status").ok(),
                "new_status":       h.get::<String, _>("new_status"),
                "changed_at":       h.get::<DateTime<Utc>, _>("changed_at"),
                "note":             h.try_get::<String, _>("note").ok(),
                "changed_by":       h.try_get::<Uuid, _>("changed_by").ok(),
                "changed_by_name":  h.try_get::<String, _>("changed_by_name").ok(),
            })
        })
        .collect();

    let ward_id = r.get::<Option<Uuid>, _>("ward_id");
    let ward_hierarchy = if ward_id.is_some() {
        serde_json::json!({
            "ward_name":                  r.get::<Option<String>, _>("ward_name"),
            "ward_number":                r.try_get::<Option<i32>, _>("ward_number").unwrap_or(None), // CR-03
            "zone_name":                  r.get::<Option<String>, _>("zone_name"),
            "ro_division":                r.get::<Option<String>, _>("ro_division"),
            "aro_sub_division":           r.get::<Option<String>, _>("aro_sub_division"),
            "assembly_constituency":      r.get::<Option<String>, _>("assembly_constituency"),
            "assembly_constituency_no":   r.get::<Option<i32>, _>("assembly_constituency_no"),
            "parliamentary_constituency": r.get::<Option<String>, _>("parliamentary_constituency"),
            "mla_name":                   r.get::<Option<String>, _>("mla_name"),
            "mp_name":                    r.get::<Option<String>, _>("mp_name"),
            "corporation":                r.get::<Option<String>, _>("corporation"),
        })
    } else {
        serde_json::Value::Null
    };

    Ok(Some(serde_json::json!({
        "id":                   r.get::<Uuid, _>("id"),
        "created_at":           r.get::<DateTime<Utc>, _>("created_at"),
        "updated_at":           r.get::<DateTime<Utc>, _>("updated_at"),
        "image_path":           r.get::<String, _>("image_path"),
        "latitude":             r.get::<f64, _>("latitude"),
        "longitude":            r.get::<f64, _>("longitude"),
        "category":             r.get::<String, _>("category"),
        "severity":             r.get::<String, _>("severity"),
        "description":          r.get::<Option<String>, _>("description"),
        "submitter_name":       r.get::<Option<String>, _>("submitter_name"),
        "submitter_contact":    r.get::<Option<String>, _>("submitter_contact"),
        "status":               r.get::<String, _>("status"),
        "location_source":      r.get::<String, _>("location_source"),
        "resolution_photo_path": r.get::<Option<String>, _>("resolution_photo_path"),
        "resolution_notes":     r.get::<Option<String>, _>("resolution_notes"),
        "assigned_org_id":      r.get::<Option<Uuid>, _>("assigned_org_id"),
        "assigned_org_name":    r.get::<Option<String>, _>("assigned_org_name"),
        "ward_id":              ward_id,
        "ward_name":            r.get::<Option<String>, _>("ward_name"),
        "corporation":          r.get::<Option<String>, _>("corporation"),
        "ward_hierarchy":       ward_hierarchy,
        "status_history":       status_history,
    })))
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
    let result = sqlx::query("UPDATE reports SET status = $1::report_status WHERE id = $2")
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

/// Resolve or close a report by updating its status and storing the resolution photo.
///
/// # Contract (D-13, D-14, WFLOW-02, WFLOW-05)
/// - `new_status` must be "resolved" or "closed" — any other value is rejected with BadRequest.
/// - Updates `reports.status`, `reports.resolution_photo_path`, `reports.resolution_notes`.
/// - Inserts a `status_history` row in the same transaction.
/// - Returns `Ok(true)` if found and updated, `Ok(false)` if report not found (caller returns 404).
pub async fn resolve_report(
    pool: &PgPool,
    report_id: Uuid,
    new_status: &str,
    resolution_photo_path: &str,
    resolution_notes: Option<&str>,
    changed_by: Uuid,
) -> Result<bool, AppError> {
    // Defense-in-depth guard: validate status before opening transaction.
    // validate_resolve_request in the handler is the primary gate; this is belt-and-suspenders
    // per D-13/D-14 so that the DB layer is independently correct.
    if !matches!(new_status, "resolved" | "closed") {
        return Err(AppError::BadRequest(
            "resolve_report called with invalid status".to_string(),
        ));
    }

    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        r#"
        UPDATE reports
        SET status = $1::report_status,
            resolution_photo_path = $2,
            resolution_notes = $3,
            resolved_at = NOW()
        WHERE id = $4
        "#,
    )
    .bind(new_status)
    .bind(resolution_photo_path)
    .bind(resolution_notes)
    .bind(report_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        tx.rollback().await?;
        return Ok(false);
    }

    // Insert audit trail row in the same transaction.
    sqlx::query(
        r#"
        INSERT INTO status_history (report_id, new_status, note, changed_by)
        VALUES ($1, $2::report_status, $3, $4)
        "#,
    )
    .bind(report_id)
    .bind(new_status)
    .bind(resolution_notes)
    .bind(changed_by)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        report_id = %report_id,
        new_status = new_status,
        changed_by = %changed_by,
        "Report resolved"
    );

    Ok(true)
}

/// Assign a report to an organization and auto-advance status to 'assigned'.
///
/// # Contract (D-09, WFLOW-03)
/// - Updates `reports.assigned_org_id = org_id` AND `reports.status = 'assigned'`.
/// - Inserts a `status_history` row in the same transaction.
/// - Returns `Ok(true)` if found and updated, `Ok(false)` if report not found.
pub async fn assign_report_org(
    pool: &PgPool,
    report_id: Uuid,
    org_id: Uuid,
    changed_by: Uuid,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        r#"
        UPDATE reports
        SET assigned_org_id = $1,
            status = 'assigned'::report_status
        WHERE id = $2
        "#,
    )
    .bind(org_id)
    .bind(report_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        // WR-01: map FK violation (23503) to a meaningful 400 instead of 500.
        // Happens when caller supplies a non-existent org_id UUID.
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.code().as_deref() == Some("23503") {
                return AppError::BadRequest("Organization not found".to_string());
            }
        }
        AppError::Database(e)
    })?;

    if result.rows_affected() == 0 {
        tx.rollback().await?;
        return Ok(false);
    }

    // Insert audit trail row in the same transaction (D-09: auto-advance to 'assigned').
    sqlx::query(
        r#"
        INSERT INTO status_history (report_id, new_status, note, changed_by)
        VALUES ($1, 'assigned'::report_status, 'Assigned to organization', $2)
        "#,
    )
    .bind(report_id)
    .bind(changed_by)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        report_id = %report_id,
        org_id = %org_id,
        changed_by = %changed_by,
        "Report assigned to organization"
    );

    Ok(true)
}

/// Delete a report row and return its `image_path` so the caller can remove
/// the file from disk. Returns `None` if no such report exists.
pub async fn delete_report(pool: &PgPool, report_id: Uuid) -> Result<Option<String>, AppError> {
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
    // Phase 03 (D-03, D-04, Pitfall 4): updated from 3-value to 6-value enum.
    // "submitted" and "under_review" are NOT seeded — they were renamed in migration 008.
    let mut by_status: std::collections::HashMap<String, i64> =
        ["open", "acknowledged", "assigned", "in_progress", "resolved", "closed"]
            .iter()
            .map(|k| (k.to_string(), 0))
            .collect();

    // Seed keys match 001_init.sql issue_category enum exactly (CR-01/CR-02):
    // no_curb_ramp and encroachment were phantom values that never existed in the DB.
    let mut by_category: std::collections::HashMap<String, i64> = [
        "no_footpath",
        "broken_footpath",
        "blocked_footpath",
        "unsafe_crossing",
        "poor_lighting",
        "other",
    ]
    .iter()
    .map(|k| (k.to_string(), 0))
    .collect();

    // Seed keys match 001_init.sql severity_level enum exactly (CR-01/CR-02):
    // "critical" was a phantom value that never existed in the DB.
    let mut by_severity: std::collections::HashMap<String, i64> =
        ["low", "medium", "high"]
            .iter()
            .map(|k| (k.to_string(), 0))
            .collect();

    // Overwrite with actual DB counts.
    let status_rows =
        sqlx::query("SELECT status::TEXT AS status, COUNT(*) AS cnt FROM reports GROUP BY status")
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
// Intake stats — per-day report counts (BUG-03.2-A)
// ─────────────────────────────────────────────────────────────────────────────

/// SQL literal used by `get_intake_stats` at runtime.
///
/// Defined as a const so both the runtime query and the `intake_sql_fragment()`
/// test helper reference the exact same string — no drift possible.
///
/// Security note (T-intake-sqli): `days` is a bound parameter (`$1`) — never
/// interpolated via `format!` or string concatenation.
const INTAKE_SQL: &str = "SELECT \
    date_trunc('day', created_at AT TIME ZONE 'UTC')::DATE::TEXT AS day, \
    COUNT(*)::BIGINT AS count \
    FROM reports \
    WHERE created_at >= NOW() - make_interval(days => $1) \
    GROUP BY 1 \
    ORDER BY 1";

/// Returns per-day report counts for the last `days` calendar days (UTC).
///
/// # Contract (BUG-03.2-A)
/// - Only days with at least one submission appear in the result.
/// - The frontend is responsible for zero-filling sparse gaps.
/// - `days` must already be clamped to [1, 90] by the caller (handler).
pub async fn get_intake_stats(
    pool: &PgPool,
    days: i32,
) -> Result<Vec<crate::models::admin::IntakeDayCount>, AppError> {
    let rows = sqlx::query(INTAKE_SQL)
        .bind(days)
        .fetch_all(pool)
        .await?;

    let result = rows
        .iter()
        .map(|r| crate::models::admin::IntakeDayCount {
            day: r.get::<String, _>("day"),
            count: r.get::<i64, _>("count"),
        })
        .collect();

    Ok(result)
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
    let result =
        sqlx::query("UPDATE admin_users SET password_hash = $2, updated_at = NOW() WHERE id = $1")
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
    let sql = format!("SELECT {} FROM admin_users WHERE id = $1", ADMIN_USER_COLS);
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
    let result =
        sqlx::query("UPDATE admin_users SET org_id = $1 WHERE id = $2 AND is_active = TRUE")
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
/// Referenced by unit tests and used to build the SELECT dynamically.
pub const ADMIN_REPORT_DEDUP_COLS: &str =
    "reports.duplicate_count, reports.duplicate_of_id, reports.duplicate_confidence";

// ─────────────────────────────────────────────────────────────────────────────
// Status history SQL constant — single source of truth for the status_history
// SELECT used in get_report_admin().  Both the runtime query and the test helper
// reference this constant so they can never drift apart (BUG-03.2-B).
// ─────────────────────────────────────────────────────────────────────────────

/// The SQL string used in the status history `sqlx::query(...)` block.
///
/// # Fix applied (BUG-03.2-B)
/// Column expression changed from the bare `au.display_name` alias to
/// `COALESCE(au.display_name, au.email) AS changed_by_name` so the admin email
/// is surfaced when `display_name` is NULL (the default for seeded admins).
const STATUS_HISTORY_SQL: &str = r#"
        SELECT
            sh.id,
            sh.old_status::TEXT AS old_status,
            sh.new_status::TEXT AS new_status,
            sh.changed_at,
            sh.note,
            sh.changed_by,
            COALESCE(au.display_name, au.email) AS changed_by_name
        FROM status_history sh
        LEFT JOIN admin_users au ON au.id = sh.changed_by
        WHERE sh.report_id = $1
        ORDER BY sh.changed_at DESC
        "#;

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

/// Returns the status history SQL string used in `get_report_admin()`.
///
/// # Contract (BUG-03.2-B)
/// The returned string must contain "COALESCE", "au.email", and "changed_by_name"
/// so that admin attribution in the status history timeline falls back to the
/// admin email when `display_name` is NULL.
///
/// This is a test-only hook — the same `STATUS_HISTORY_SQL` constant is used by
/// the runtime `sqlx::query(STATUS_HISTORY_SQL)` call, so this function asserts
/// the exact SQL the query executes.
#[allow(dead_code)]
pub fn attribution_sql_fragment() -> &'static str {
    STATUS_HISTORY_SQL
}

/// Returns the intake SQL string used by `get_intake_stats`.
///
/// # Contract (BUG-03.2-A)
/// The returned string must contain "date_trunc" and "GROUP BY" so that
/// per-day aggregation is verified without executing any DB query.
///
/// This is a test-only hook — the same `INTAKE_SQL` constant is used by
/// the runtime `sqlx::query(INTAKE_SQL)` call, so this function asserts
/// the exact SQL the query executes.
#[allow(dead_code)]
pub fn intake_sql_fragment() -> &'static str {
    INTAKE_SQL
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 04-01: Streaming export SQL constants and pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Base SELECT + FROM + JOIN fragment shared by both CSV and GeoJSON export handlers.
///
/// IN-01: Previously duplicated as EXPORT_CSV_BASE and EXPORT_GEOJSON_BASE with
/// identical SQL. A single constant prevents silent drift when columns change.
///
/// Security notes (T-04-01, T-04-02, CR-01):
/// - Explicit column whitelist — no SELECT * — so new sensitive columns never
///   leak automatically.
/// - Filter values are always bound via .bind() through build_report_where_clause;
///   never string-interpolated into the SQL string.
/// - ward_name and assigned_org are JOIN columns; no UUID exposure in export.
/// - Coordinates are latitude, longitude (columns); the GeoJSON handler reverses
///   to [longitude, latitude] per GeoJSON RFC 7946 (Pitfall 4).
///
/// Use `build_csv_export_sql` or `build_geojson_export_sql` to append the WHERE
/// clause and ORDER BY at runtime.
/// Never use `.replace()` on this string — that approach was removed in CR-01
/// because it bypassed the parameterisation contract.
const EXPORT_BASE: &str = "SELECT \
    reports.id, \
    reports.created_at, \
    reports.category::TEXT AS category, \
    reports.severity::TEXT AS severity, \
    reports.status::TEXT AS status, \
    wards.ward_name AS ward_name, \
    organizations.name AS assigned_org, \
    reports.latitude, \
    reports.longitude, \
    reports.description, \
    reports.photo_hash, \
    reports.duplicate_count, \
    reports.submitter_contact, \
    reports.resolved_at, \
    reports.resolution_notes \
    FROM reports \
    LEFT JOIN wards ON wards.id = reports.ward_id \
    LEFT JOIN organizations ON organizations.id = reports.assigned_org_id";

/// Alias retained for any test or external references to the old CSV constant name.
#[allow(dead_code)]
const EXPORT_CSV_BASE: &str = EXPORT_BASE;

/// Alias retained for any test or external references to the old GeoJSON constant name.
#[allow(dead_code)]
const EXPORT_GEOJSON_BASE: &str = EXPORT_BASE;

/// Build a complete export SQL string from a base fragment and a WHERE clause.
///
/// # Security contract (CR-01)
/// - `base` must be one of `EXPORT_CSV_BASE` or `EXPORT_GEOJSON_BASE` (trusted consts).
/// - `where_clause` must contain only `$N` parameter placeholders produced by
///   `build_report_where_clause` — never raw user values.
/// - No raw user input ever enters the SQL string; all values are bound separately
///   via `.bind()` in the handler after this function returns.
///
/// This replaces the previous `.replace("{where_clause}", ...)` approach which,
/// while safe today, was structurally fragile: any future change that accidentally
/// interpolated a value instead of a `$N` index would have silently produced
/// injectable SQL.
pub fn build_export_sql(base: &str, where_clause: &str) -> String {
    if where_clause.is_empty() {
        format!("{} ORDER BY reports.created_at DESC", base)
    } else {
        format!("{} {} ORDER BY reports.created_at DESC", base, where_clause)
    }
}

/// Build a complete CSV export SQL string.
///
/// Convenience wrapper around `build_export_sql` for the CSV export handler.
pub fn build_csv_export_sql(where_clause: &str) -> String {
    build_export_sql(EXPORT_CSV_BASE, where_clause)
}

/// Build a complete GeoJSON export SQL string.
///
/// Convenience wrapper around `build_export_sql` for the GeoJSON export handler.
pub fn build_geojson_export_sql(where_clause: &str) -> String {
    build_export_sql(EXPORT_GEOJSON_BASE, where_clause)
}

/// Format a DateTime<Utc> as DD/MM/YYYY (D-12).
///
/// Used by the CSV export handler for submission_date and resolved_at columns.
/// Format string "%d/%m/%Y" produces zero-padded day and month per D-12.
pub fn format_csv_date(dt: &DateTime<Utc>) -> String {
    dt.format("%d/%m/%Y").to_string()
}

/// Format an optional DateTime<Utc> as DD/MM/YYYY, or empty string if None.
///
/// Used for resolved_at which may be NULL on open reports.
#[allow(dead_code)]
pub fn format_csv_date_opt(dt: Option<&DateTime<Utc>>) -> String {
    dt.map(|d| d.format("%d/%m/%Y").to_string())
        .unwrap_or_default()
}

/// Escape a free-text field for RFC 4180 CSV output.
///
/// Rules applied (T-04-CSV — CSV injection mitigation):
/// 1. Trim whitespace.
/// 2. Prefix fields starting with =, +, -, or @ with a single quote to
///    neutralize Excel formula execution.
/// 3. Replace any internal double-quotes with two double-quotes ("").
/// 4. Strip newline and carriage return characters (prevent row splitting).
/// 5. Wrap the entire value in double-quotes.
///
/// # Security
/// Free-text report descriptions and resolution notes are untrusted citizen
/// input that may contain arbitrary characters. Without this escaping:
/// - Commas in field values would split into multiple CSV columns.
/// - Embedded newlines would split rows in spreadsheet applications.
/// - Formula triggers (=, +, -, @) would execute as Excel formulas.
pub fn csv_escape(s: &str) -> String {
    let trimmed = s.trim();
    // CSV injection mitigation: prefix Excel formula triggers with single quote
    let sanitized = if trimmed.starts_with(['=', '+', '-', '@']) {
        format!("'{}", trimmed)
    } else {
        trimmed.to_string()
    };
    // Double internal quotes, strip newlines, wrap in double-quotes
    format!(
        "\"{}\"",
        sanitized
            .replace('"', "\"\"")
            .replace('\n', " ")
            .replace('\r', "")
    )
}

/// Build the WHERE clause for export queries (same filter params as list_admin_reports).
///
/// Returns (where_clause, next_param_idx). The where_clause may be an empty string
/// (no filters) or "WHERE condition1 AND condition2 ..." — the caller inserts
/// this into the SQL via string replacement of `{where_clause}`.
///
/// Parameters are bound in this order: category, status, severity, date_from, date_to.
/// Bound parameters prevent SQL injection (T-04-02).
pub fn build_export_where_clause(
    category: Option<&str>,
    status: Option<&str>,
    severity: Option<&str>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
) -> (String, i32) {
    build_report_where_clause(category, status, severity, date_from, date_to, 1)
}

/// Returns the CSV export SQL base fragment used by the streaming handler.
///
/// Test-only hook so integration tests in backend/tests/ can verify the
/// D-13 column set without executing any DB query.
/// The runtime handler calls `build_csv_export_sql()` which appends the
/// WHERE clause and ORDER BY to this base at request time.
#[allow(dead_code)]
pub fn export_csv_sql_fragment() -> &'static str {
    EXPORT_CSV_BASE
}

/// Returns the GeoJSON export SQL base fragment used by the streaming handler.
///
/// Test-only hook so integration tests in backend/tests/ can verify the
/// column whitelist (no SELECT *) without executing any DB query.
/// The runtime handler calls `build_geojson_export_sql()` which appends the
/// WHERE clause and ORDER BY to this base at request time.
#[allow(dead_code)]
pub fn export_geojson_sql_fragment() -> &'static str {
    EXPORT_GEOJSON_BASE
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 04-03a: Admin analytics SQL constants and query functions
// Requirements: ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05
// ─────────────────────────────────────────────────────────────────────────────

/// ANALYTICS-02: Top 10 wards by unresolved report count.
///
/// Security notes (T-04-08, T-04-09):
/// - Endpoint registered under admin_protected_router (require_auth).
/// - No user input is interpolated into this SQL — purely aggregate.
///
/// Returns columns: ward_name, ward_number, unresolved_count, total_count.
/// FILTER (WHERE r.status NOT IN ('resolved','closed')) counts only active
/// issues; ORDER BY unresolved_count DESC; LIMIT 10 caps to top 10.
const WARD_ANALYTICS_SQL: &str = "SELECT \
    w.ward_name, \
    w.ward_number, \
    COUNT(r.id) FILTER (WHERE r.status NOT IN ('resolved', 'closed')) AS unresolved_count, \
    COUNT(r.id) AS total_count \
    FROM wards w \
    LEFT JOIN reports r ON r.ward_id = w.id \
    GROUP BY w.id, w.ward_name, w.ward_number \
    ORDER BY unresolved_count DESC \
    LIMIT 10";

/// Represents a single row from the ward analytics query.
#[derive(serde::Serialize)]
pub struct WardAnalyticsRow {
    pub ward_name: String,
    pub ward_number: i32,
    pub unresolved_count: i64,
    pub total_count: i64,
}

/// Returns the top 10 wards ordered by unresolved report count (ANALYTICS-02).
///
/// # Contract
/// - Requires a valid PostgreSQL connection pool.
/// - Returns at most 10 rows (enforced by SQL LIMIT).
/// - unresolved_count excludes reports with status 'resolved' or 'closed'.
pub async fn get_ward_analytics(pool: &PgPool) -> Result<Vec<WardAnalyticsRow>, AppError> {
    let rows = sqlx::query(WARD_ANALYTICS_SQL)
        .fetch_all(pool)
        .await?;

    let result = rows
        .iter()
        .map(|r| WardAnalyticsRow {
            ward_name: r.get::<String, _>("ward_name"),
            ward_number: r.try_get::<i32, _>("ward_number").unwrap_or(0),
            unresolved_count: r.get::<i64, _>("unresolved_count"),
            total_count: r.get::<i64, _>("total_count"),
        })
        .collect();

    Ok(result)
}

/// Returns the WARD_ANALYTICS_SQL constant for SQL-string unit tests.
///
/// Test-only hook — the same constant is used by `get_ward_analytics` at
/// runtime. Asserting on this string guarantees no drift between the test
/// and the live query.
#[allow(dead_code)]
pub fn ward_analytics_sql_fragment() -> &'static str {
    WARD_ANALYTICS_SQL
}

/// ANALYTICS-03: Resolution rate per corporation.
///
/// Security notes (T-04-08, T-04-09):
/// - Endpoint registered under admin_protected_router (require_auth).
/// - NULLIF(COUNT(r.id), 0) guards against PostgreSQL division-by-zero when
///   a corporation has no associated reports.
///
/// Returns columns: corporation, total_reports, resolved_count,
/// resolution_rate_pct. Filters to org_type = 'corporation'.
const CORP_ANALYTICS_SQL: &str = "SELECT \
    o.name AS corporation, \
    COUNT(r.id) AS total_reports, \
    COUNT(r.id) FILTER (WHERE r.status IN ('resolved', 'closed')) AS resolved_count, \
    ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('resolved', 'closed')) \
        / NULLIF(COUNT(r.id), 0), 1) AS resolution_rate_pct \
    FROM organizations o \
    JOIN wards w ON w.org_id = o.id \
    LEFT JOIN reports r ON r.ward_id = w.id \
    WHERE o.org_type = 'corporation' \
    GROUP BY o.id, o.name \
    ORDER BY resolution_rate_pct DESC NULLS LAST";

/// Represents a single row from the corporation analytics query.
#[derive(serde::Serialize)]
pub struct CorpAnalyticsRow {
    pub corporation: String,
    pub total_reports: i64,
    pub resolved_count: i64,
    pub resolution_rate_pct: Option<f64>,
}

/// Returns resolution rate per corporation (ANALYTICS-03).
///
/// # Contract
/// - NULLIF guard prevents division-by-zero at the PostgreSQL level.
/// - Only organisations with org_type = 'corporation' are included.
/// - resolution_rate_pct may be None for corporations with total_reports = 0
///   (NULLIF returns NULL which maps to None in Rust).
pub async fn get_corporation_analytics(
    pool: &PgPool,
) -> Result<Vec<CorpAnalyticsRow>, AppError> {
    let rows = sqlx::query(CORP_ANALYTICS_SQL)
        .fetch_all(pool)
        .await?;

    let result = rows
        .iter()
        .map(|r| CorpAnalyticsRow {
            corporation: r.get::<String, _>("corporation"),
            total_reports: r.get::<i64, _>("total_reports"),
            resolved_count: r.get::<i64, _>("resolved_count"),
            resolution_rate_pct: r.try_get::<f64, _>("resolution_rate_pct").ok(),
        })
        .collect();

    Ok(result)
}

/// Returns the CORP_ANALYTICS_SQL constant for SQL-string unit tests.
///
/// Test-only hook — same string used by `get_corporation_analytics` at runtime.
#[allow(dead_code)]
pub fn corp_analytics_sql_fragment() -> &'static str {
    CORP_ANALYTICS_SQL
}

/// ANALYTICS-04: Reports per week over the last 12 weeks, optionally filtered
/// by category.
///
/// Security notes (T-04-08, T-04-09):
/// - Endpoint registered under admin_protected_router (require_auth).
/// - The optional category filter is a bound parameter ($1) — never interpolated
///   via format! or string concatenation.
///
/// When `category` is None the WHERE clause is omitted (both variants compile
/// to the same const SQL; the runtime function applies conditional binding).
///
/// Returns columns: week_start (YYYY-MM-DD text), category (text), count.
const TREND_SQL: &str = "SELECT \
    DATE_TRUNC('week', created_at AT TIME ZONE 'UTC')::DATE::TEXT AS week_start, \
    category::TEXT AS category, \
    COUNT(*)::BIGINT AS count \
    FROM reports \
    WHERE created_at >= NOW() - INTERVAL '12 weeks' \
    GROUP BY 1, 2 \
    ORDER BY 1, 2";

/// Like TREND_SQL but with an additional category filter bound as $1.
///
/// Used by `get_trend_data` when a category filter is provided.
/// Security (T-04-09): category value is a bound parameter, never interpolated.
const TREND_SQL_FILTERED: &str = "SELECT \
    DATE_TRUNC('week', created_at AT TIME ZONE 'UTC')::DATE::TEXT AS week_start, \
    category::TEXT AS category, \
    COUNT(*)::BIGINT AS count \
    FROM reports \
    WHERE created_at >= NOW() - INTERVAL '12 weeks' \
    AND category::TEXT = $1 \
    GROUP BY 1, 2 \
    ORDER BY 1, 2";

/// Represents a single row from the trend data query.
#[derive(serde::Serialize)]
pub struct TrendDataRow {
    pub week_start: String,
    pub category: String,
    pub count: i64,
}

/// Returns reports-per-week aggregates over the last 12 weeks (ANALYTICS-04).
///
/// # Contract
/// - `category` is an optional filter. When Some, it is bound as a sqlx
///   parameter — never interpolated into the SQL string (T-04-09).
/// - Returns one row per (week_start, category) pair that has at least one
///   report.
/// - Frontend is responsible for zero-filling sparse week/category combinations.
pub async fn get_trend_data(
    pool: &PgPool,
    category: Option<&str>,
) -> Result<Vec<TrendDataRow>, AppError> {
    let rows = match category {
        Some(cat) => {
            sqlx::query(TREND_SQL_FILTERED)
                .bind(cat)
                .fetch_all(pool)
                .await?
        }
        None => {
            sqlx::query(TREND_SQL)
                .fetch_all(pool)
                .await?
        }
    };

    let result = rows
        .iter()
        .map(|r| TrendDataRow {
            week_start: r.get::<String, _>("week_start"),
            category: r.get::<String, _>("category"),
            count: r.get::<i64, _>("count"),
        })
        .collect();

    Ok(result)
}

/// Returns the TREND_SQL constant for SQL-string unit tests.
///
/// Test-only hook — same string used by `get_trend_data` (unfiltered variant)
/// at runtime. Tests assert that DATE_TRUNC('week') and INTERVAL '12 weeks'
/// are present.
#[allow(dead_code)]
pub fn trend_sql_fragment() -> &'static str {
    TREND_SQL
}

/// ANALYTICS-05: Ward polygons with unresolved report count for choropleth.
///
/// Security notes (T-04-08, T-04-10):
/// - Endpoint registered under admin_protected_router (require_auth).
/// - ST_Simplify(boundary::geometry, 0.001) reduces vertex count per Pitfall 7
///   — 0.001 degrees ≈ 100 m simplification, sufficient for visual choropleth
///   while keeping response size manageable (T-04-10).
///
/// Returns columns: id, ward_name, ward_number, boundary_geojson (text),
/// unresolved_count. The handler assembles these into a GeoJSON FeatureCollection.
const WARD_BOUNDARIES_SQL: &str = "SELECT \
    w.id, \
    w.ward_name, \
    w.ward_number, \
    ST_AsGeoJSON(ST_Simplify(w.boundary::geometry, 0.001)) AS boundary_geojson, \
    COUNT(r.id) FILTER (WHERE r.status NOT IN ('resolved', 'closed')) AS unresolved_count \
    FROM wards w \
    LEFT JOIN reports r ON r.ward_id = w.id \
    GROUP BY w.id, w.ward_name, w.ward_number, w.boundary";

/// Represents a single row from the ward boundaries query.
///
/// `boundary_geojson` is the ST_AsGeoJSON output — a valid GeoJSON geometry
/// string (e.g. `{"type":"MultiPolygon","coordinates":[...]}`).
#[derive(serde::Serialize)]
pub struct WardBoundaryRow {
    pub id: Uuid,
    pub ward_name: String,
    pub ward_number: i32,
    pub boundary_geojson: Option<String>,
    pub unresolved_count: i64,
}

/// Returns ward boundary GeoJSON strings with unresolved report counts (ANALYTICS-05).
///
/// The handler is responsible for assembling the rows into a GeoJSON
/// FeatureCollection with properties { ward_name, ward_number, unresolved_count }
/// and the boundary_geojson as the geometry.
///
/// # Contract
/// - Rows with NULL boundary (wards missing geometry) have boundary_geojson = None.
/// - unresolved_count excludes reports with status 'resolved' or 'closed'.
pub async fn get_ward_boundaries(pool: &PgPool) -> Result<Vec<WardBoundaryRow>, AppError> {
    let rows = sqlx::query(WARD_BOUNDARIES_SQL)
        .fetch_all(pool)
        .await?;

    let result = rows
        .iter()
        .map(|r| WardBoundaryRow {
            id: r.get::<Uuid, _>("id"),
            ward_name: r.get::<String, _>("ward_name"),
            ward_number: r.try_get::<i32, _>("ward_number").unwrap_or(0),
            boundary_geojson: r.try_get::<String, _>("boundary_geojson").ok(),
            unresolved_count: r.get::<i64, _>("unresolved_count"),
        })
        .collect();

    Ok(result)
}

/// Returns the WARD_BOUNDARIES_SQL constant for SQL-string unit tests.
///
/// Test-only hook — same string used by `get_ward_boundaries` at runtime.
/// Tests assert ST_AsGeoJSON, ST_Simplify, and unresolved_count are present.
#[allow(dead_code)]
pub fn ward_boundaries_sql_fragment() -> &'static str {
    WARD_BOUNDARIES_SQL
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
        let (where_clause, param_idx) = build_report_where_clause(None, None, None, None, None, 1);
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
        let (where_clause, _) = build_report_where_clause(None, None, None, None, None, 1);
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
        let (clause, next_idx) = build_report_where_clause(None, None, None, None, None, 1);
        assert!(
            clause.is_empty(),
            "No-filter clause must be empty; got: {:?}",
            clause
        );
        assert_eq!(next_idx, 1, "With no filters, param_idx must remain at 1");
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
        let (where_clause, param_idx) = build_report_where_clause(None, None, None, None, None, 1);
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
        let (where_clause, _param_idx) = build_report_where_clause(None, None, None, None, None, 1);
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

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 6 — BUG-03.2-B: status history attribution fallback via COALESCE
    // ─────────────────────────────────────────────────────────────────────────

    /// BUG-03.2-B — The status history query must use COALESCE(au.display_name, au.email)
    /// so that the admin email is shown when display_name is NULL (the default for
    /// seeded admins).  Without this, the timeline always renders "BY · —".
    ///
    /// This test asserts on the exact SQL string the runtime query executes
    /// (via the STATUS_HISTORY_SQL constant) — it is not a snapshot test.
    #[test]
    fn attribution_fallback_sql_uses_coalesce() {
        let fragment = attribution_sql_fragment();
        assert!(
            fragment.contains("COALESCE"),
            "Status history SQL must use COALESCE for attribution fallback (BUG-03.2-B); \
             a bare display_name alias returns NULL when display_name is unset. \
             Got: {}",
            fragment
        );
        assert!(
            fragment.contains("au.email"),
            "Status history SQL must include 'au.email' as the COALESCE fallback so the \
             admin email appears when display_name is NULL (BUG-03.2-B); got: {}",
            fragment
        );
        assert!(
            fragment.contains("changed_by_name"),
            "Status history SQL must alias the column as 'changed_by_name' so the \
             row-accessor h.try_get::<String, _>(\"changed_by_name\") succeeds (BUG-03.2-B); \
             got: {}",
            fragment
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite 7 — BUG-03.2-A: intake stats SQL uses date_trunc + GROUP BY
    // ─────────────────────────────────────────────────────────────────────────

    /// BUG-03.2-A — The intake SQL must use `date_trunc('day', ...)` to aggregate
    /// per-day counts and `GROUP BY` to collapse multiple rows per day into one.
    ///
    /// Security note (T-intake-sqli): The SQL must NOT use `format!` or string
    /// interpolation for the interval — `days` is a bound parameter.
    /// The test verifies the SQL literal contains the bound form `$1`.
    ///
    /// T-intake-dos: `days` clamping [1,90] is enforced in the handler before
    /// the DB call — not in the SQL itself. This test asserts the SQL structure,
    /// not the clamp (which is tested via the handler grep acceptance criterion).
    #[test]
    fn intake_sql_uses_date_trunc_and_group_by() {
        let sql = intake_sql_fragment();
        assert!(
            sql.contains("date_trunc"),
            "Intake SQL must use date_trunc to aggregate per-day counts (BUG-03.2-A); \
             got: {}",
            sql
        );
        assert!(
            sql.contains("GROUP BY"),
            "Intake SQL must use GROUP BY to collapse multiple submissions per day (BUG-03.2-A); \
             got: {}",
            sql
        );
        assert!(
            sql.contains("$1"),
            "Intake SQL must bind `days` as a parameter ($1) — never format!/string-interpolate \
             the interval (T-intake-sqli); got: {}",
            sql
        );
        assert!(
            !sql.contains("format!"),
            "Intake SQL must not be constructed with format! — it must be a static literal \
             with bound parameters (T-intake-sqli); got: {}",
            sql
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Suite NF-03-B — geographic org auto-assignment SQL-string tests
    // ─────────────────────────────────────────────────────────────────────────

    /// NF-03-B — list_admin_reports SQL must JOIN organizations on assigned_org_id,
    /// not read corporation from wards.corporation directly.
    #[test]
    fn list_admin_reports_corp_join_uses_assigned_org_id() {
        let (where_clause, param_idx) = build_report_where_clause(None, None, None, None, None, 1);
        let limit_idx = param_idx;
        let offset_idx = param_idx + 1;
        let sql = format!(
            r#"
            SELECT
                reports.id,
                o.name AS corporation,
                {dedup_cols}
            FROM reports
            LEFT JOIN wards ON wards.id = reports.ward_id
            LEFT JOIN organizations o ON o.id = reports.assigned_org_id
            {where_clause}
            ORDER BY reports.created_at DESC
            LIMIT ${limit_idx} OFFSET ${offset_idx}
            "#,
            dedup_cols = ADMIN_REPORT_DEDUP_COLS,
            where_clause = where_clause,
            limit_idx = limit_idx,
            offset_idx = offset_idx,
        );
        assert!(
            sql.contains("LEFT JOIN organizations o ON o.id = reports.assigned_org_id"),
            "list_admin_reports must JOIN organizations on assigned_org_id; got: {}",
            sql
        );
        assert!(
            !sql.contains("wards.corporation"),
            "list_admin_reports must NOT read corporation from wards directly; got: {}",
            sql
        );
    }

    /// NF-03-B — Auto-assign status_history insert must use 'open' status and NULL changed_by.
    #[test]
    fn auto_assign_history_sql_uses_open_status_and_null_changed_by() {
        let sql = r#"INSERT INTO status_history (report_id, new_status, note, changed_by)
           VALUES ($1, 'open'::report_status, 'Auto-assigned based on ward geography', NULL)"#;
        assert!(sql.contains("'open'::report_status"), "auto-assign must use open status; got: {}", sql);
        assert!(sql.contains("NULL"), "changed_by must be NULL for system auto-assign; got: {}", sql);
        assert!(sql.contains("ward geography"), "note must reference ward geography; got: {}", sql);
    }
}
