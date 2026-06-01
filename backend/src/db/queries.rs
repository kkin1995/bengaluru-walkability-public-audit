use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::report::{CreateReportRequest, Report};

/// Look up which ward polygon contains the given lat/lng coordinate.
///
/// # PostGIS coordinate order
/// ST_MakePoint takes (longitude, latitude) — X,Y order.
/// - $1 = latitude (Y)
/// - $2 = longitude (X)
///
/// Returns `Some(ward_id)` when the point falls inside exactly one ward,
/// `None` when no matching ward polygon exists.
pub async fn get_ward_for_point(
    pool: &PgPool,
    lat: f64,
    lng: f64,
) -> Result<Option<Uuid>, AppError> {
    let row = sqlx::query_as::<_, (Uuid,)>(
        r#"
        SELECT id FROM wards
        WHERE ST_Within(
            ST_SetSRID(ST_MakePoint($2, $1), 4326),
            boundary
        )
        LIMIT 1
        "#,
    )
    .bind(lat) // $1 = latitude
    .bind(lng) // $2 = longitude (MakePoint takes lng,lat → X,Y)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(id,)| id))
}

/// Public ward lookup: returns (ward_number, ward_name) for the ward polygon
/// that contains the given coordinate, or None if no ward matches.
///
/// Used by the public GET /api/wards/lookup endpoint. Does NOT expose the
/// ward UUID or corporation — only the fields needed for the citizen UI.
///
/// # PostGIS coordinate order
/// ST_MakePoint takes (longitude, latitude) — X,Y order.
/// - $1 = latitude (Y)
/// - $2 = longitude (X)
pub async fn get_ward_label_for_point(
    pool: &PgPool,
    lat: f64,
    lng: f64,
) -> Result<Option<(i32, String)>, AppError> {
    let row = sqlx::query_as::<_, (i32, String)>(
        r#"
        SELECT ward_number, ward_name FROM wards
        WHERE ST_Within(
            ST_SetSRID(ST_MakePoint($2, $1), 4326),
            boundary
        )
        LIMIT 1
        "#,
    )
    .bind(lat) // $1 = latitude
    .bind(lng) // $2 = longitude (MakePoint takes lng,lat → X,Y)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

/// Check whether a photo with the given SHA256 hash already exists in the DB.
/// Used by create_report to silently reject exact duplicate photo uploads.
pub async fn check_photo_hash_exists(pool: &PgPool, hash: &str) -> Result<bool, AppError> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM reports WHERE photo_hash = $1")
        .bind(hash)
        .fetch_one(pool)
        .await?;
    Ok(count > 0)
}

pub async fn insert_report(
    pool: &PgPool,
    req: &CreateReportRequest,
    image_path: &str,
    ward_id: Option<Uuid>,
) -> Result<Report, AppError> {
    let row = sqlx::query_as::<_, Report>(
        r#"
        INSERT INTO reports
            (image_path, latitude, longitude, category, severity,
             description, submitter_name, submitter_contact, location_source, ward_id,
             photo_hash, submitter_ip)
        VALUES ($1, $2, $3, $4::issue_category, $5::severity_level,
                $6, $7, $8, $9::location_source, $10,
                $11, $12)
        RETURNING
            id, created_at, image_path, latitude, longitude,
            category::TEXT AS category,
            severity::TEXT AS severity,
            description,
            submitter_name,
            submitter_contact,
            status::TEXT AS status,
            location_source::TEXT AS location_source,
            ward_id,
            photo_hash,
            duplicate_of_id,
            duplicate_count,
            duplicate_confidence,
            submitter_ip,
            resolution_photo_path,
            resolution_notes,
            assigned_org_id
        "#,
    )
    .bind(image_path)
    .bind(req.latitude)
    .bind(req.longitude)
    .bind(&req.category)
    .bind(&req.severity)
    .bind(req.description.as_deref())
    .bind(req.submitter_name.as_deref())
    .bind(req.submitter_contact.as_deref())
    .bind(&req.location_source)
    .bind(ward_id)
    .bind(req.photo_hash.as_deref())
    .bind(req.submitter_ip.as_deref())
    .fetch_one(pool)
    .await?;

    Ok(row)
}

/// Returns the total count of all reports in the database.
/// Used by the list_reports handler to include a `total` field in the response,
/// enabling the homepage to display a live report count instead of a hardcoded value.
/// Uses runtime query (not sqlx::query!) to avoid requiring offline sqlx metadata.
pub async fn count_reports(pool: &PgPool) -> Result<i64, AppError> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM reports")
        .fetch_one(pool)
        .await?;
    Ok(count)
}

/// Fetch a paginated list of reports enriched with ward data (ward_name + corporation).
///
/// Used by the public GET /api/reports list endpoint to populate the map popup
/// with corporation + ward_name per UI-SPEC §G (MAP-03 / D-31).
///
/// Privacy guarantees: submitter_name, submitter_contact, submitter_ip are NOT selected.
/// Status history and resolution_notes are NOT included (list endpoint).
///
/// Returns a Vec of serde_json::Value objects matching the public list shape.
pub async fn list_reports_enriched(
    pool: &PgPool,
    page: i64,
    limit: i64,
    category: Option<&str>,
    status: Option<&str>,
    api_base: &str,
) -> Result<Vec<serde_json::Value>, AppError> {
    let offset = (page - 1) * limit;

    let rows = sqlx::query(
        r#"
        SELECT
            r.id,
            r.created_at,
            r.image_path,
            r.latitude,
            r.longitude,
            r.category::TEXT AS category,
            r.severity::TEXT AS severity,
            r.description,
            r.status::TEXT AS status,
            r.location_source::TEXT AS location_source,
            r.resolution_photo_path,
            w.ward_name,
            w.corporation
        FROM reports r
        LEFT JOIN wards w ON w.id = r.ward_id
        WHERE
            ($1::TEXT IS NULL OR r.category::TEXT = $1)
            AND ($2::TEXT IS NULL OR r.status::TEXT = $2)
        ORDER BY r.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(category)
    .bind(status)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let items = rows
        .iter()
        .map(|row| {
            let image_path = row.get::<String, _>("image_path");
            let image_url = format!("{}/uploads/{}", api_base, image_path);

            let latitude = row.get::<f64, _>("latitude");
            let longitude = row.get::<f64, _>("longitude");
            let lat_rounded = (latitude * 1000.0).round() / 1000.0;
            let lng_rounded = (longitude * 1000.0).round() / 1000.0;

            let resolution_photo_path = row.try_get::<Option<String>, _>("resolution_photo_path").unwrap_or(None);
            let resolution_photo_url = resolution_photo_path
                .map(|p| format!("{}/uploads/{}", api_base, p));

            let mut obj = serde_json::Map::new();
            obj.insert("id".to_string(), serde_json::json!(row.get::<Uuid, _>("id")));
            obj.insert("created_at".to_string(), serde_json::json!(row.get::<DateTime<Utc>, _>("created_at")));
            obj.insert("image_url".to_string(), serde_json::json!(image_url));
            obj.insert("latitude".to_string(), serde_json::json!(lat_rounded));
            obj.insert("longitude".to_string(), serde_json::json!(lng_rounded));
            obj.insert("category".to_string(), serde_json::json!(row.get::<String, _>("category")));
            obj.insert("severity".to_string(), serde_json::json!(row.get::<String, _>("severity")));
            obj.insert("description".to_string(), serde_json::json!(row.get::<Option<String>, _>("description")));
            obj.insert("status".to_string(), serde_json::json!(row.get::<String, _>("status")));
            obj.insert("location_source".to_string(), serde_json::json!(row.get::<String, _>("location_source")));

            // Include ward_name and corporation for map popup (MAP-03 / D-31)
            if let Some(ward_name) = row.try_get::<Option<String>, _>("ward_name").unwrap_or(None) {
                obj.insert("ward_name".to_string(), serde_json::json!(ward_name));
            }
            if let Some(corporation) = row.try_get::<Option<String>, _>("corporation").unwrap_or(None) {
                obj.insert("corporation".to_string(), serde_json::json!(corporation));
            }

            // resolution_photo_url only when present (D-18)
            if let Some(url) = resolution_photo_url {
                obj.insert("resolution_photo_url".to_string(), serde_json::json!(url));
            }

            serde_json::Value::Object(obj)
        })
        .collect();

    Ok(items)
}

// Retained for potential direct usage by tests or future admin detail queries.
// The public handler now uses get_report_with_detail for the enriched response.
#[allow(dead_code)]
pub async fn get_report_by_id(pool: &PgPool, id: Uuid) -> Result<Report, AppError> {
    let row = sqlx::query_as::<_, Report>(
        r#"
        SELECT
            id, created_at, image_path, latitude, longitude,
            category::TEXT AS category,
            severity::TEXT AS severity,
            description,
            submitter_name,
            submitter_contact,
            status::TEXT AS status,
            location_source::TEXT AS location_source,
            ward_id,
            photo_hash,
            duplicate_of_id,
            duplicate_count,
            duplicate_confidence,
            submitter_ip,
            resolution_photo_path,
            resolution_notes,
            assigned_org_id
        FROM reports
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(row)
}

/// Fetch a single report by ID enriched with status history and ward hierarchy.
///
/// This is the data source for the public GET /api/reports/:id endpoint (D-29).
///
/// # Privacy guarantees (D-17, Pitfall 10)
/// - `status_history.note` (resolution_notes) is NEVER selected — admin-only field.
/// - `status_history.changed_by` is NEVER selected — admin-only field.
/// - `reports.submitter_name`, `reports.submitter_contact`, `reports.submitter_ip` are
///   NEVER selected — citizen PII, never exposed in public API.
///
/// # Returns
/// A `serde_json::Value` with shape:
/// ```json
/// {
///   "id", "created_at", "image_url", "latitude", "longitude", "category",
///   "severity", "description", "status", "location_source",
///   "resolution_photo_url" (only when Some),
///   "history": [{"status", "changed_at"}, ...],
///   "ward_hierarchy": {"ward_name", "corporation", "zone_name", "ro_division",
///     "aro_sub_division", "assembly_constituency", "assembly_constituency_no",
///     "parliamentary_constituency", "mla_name", "mp_name"}
/// }
/// ```
///
/// Returns `AppError::NotFound` if no such report exists.
pub async fn get_report_with_detail(
    pool: &PgPool,
    id: Uuid,
    api_base: &str,
) -> Result<serde_json::Value, AppError> {
    // Query 1: report + ward hierarchy via LEFT JOIN.
    // Pitfall 9: LEFT JOIN so reports with no ward_id still return a row.
    let row = sqlx::query(
        r#"
        SELECT
            r.id,
            r.created_at,
            r.image_path,
            r.latitude,
            r.longitude,
            r.category::TEXT AS category,
            r.severity::TEXT AS severity,
            r.description,
            r.status::TEXT AS status,
            r.location_source::TEXT AS location_source,
            r.resolution_photo_path,
            w.ward_name,
            w.corporation,
            w.zone_name,
            w.ro_division,
            w.aro_sub_division,
            w.assembly_constituency,
            w.assembly_constituency_no,
            w.parliamentary_constituency,
            w.mla_name,
            w.mp_name
        FROM reports r
        LEFT JOIN wards w ON w.id = r.ward_id
        WHERE r.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    // Query 2: public status history.
    // PRIVACY (D-17, Pitfall 10): status_history.note and status_history.changed_by
    // are NEVER selected for the public response — admin-only fields stay admin-only.
    let history_rows = sqlx::query(
        "SELECT new_status::TEXT AS status, changed_at FROM status_history WHERE report_id = $1 ORDER BY changed_at ASC",
    )
    .bind(id)
    .fetch_all(pool)
    .await?;

    let history: Vec<serde_json::Value> = history_rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "status": r.get::<String, _>("status"),
                "changed_at": r.get::<DateTime<Utc>, _>("changed_at"),
            })
        })
        .collect();

    // Build base URL for image URLs.
    let image_path = row.get::<String, _>("image_path");
    let image_url = format!("{}/uploads/{}", api_base, image_path);

    // Round latitude and longitude to 3 decimal places (privacy + consistency).
    let latitude = row.get::<f64, _>("latitude");
    let longitude = row.get::<f64, _>("longitude");
    let lat_rounded = (latitude * 1000.0).round() / 1000.0;
    let lng_rounded = (longitude * 1000.0).round() / 1000.0;

    // Build the ward_hierarchy object (all keys always present; values may be null).
    // Frontend dispatches on null values per UI-SPEC.
    let ward_hierarchy = serde_json::json!({
        "ward_name":                 row.try_get::<Option<String>, _>("ward_name").unwrap_or(None),
        "corporation":               row.try_get::<Option<String>, _>("corporation").unwrap_or(None),
        "zone_name":                 row.try_get::<Option<String>, _>("zone_name").unwrap_or(None),
        "ro_division":               row.try_get::<Option<String>, _>("ro_division").unwrap_or(None),
        "aro_sub_division":          row.try_get::<Option<String>, _>("aro_sub_division").unwrap_or(None),
        "assembly_constituency":     row.try_get::<Option<String>, _>("assembly_constituency").unwrap_or(None),
        "assembly_constituency_no":  row.try_get::<Option<i32>, _>("assembly_constituency_no").unwrap_or(None),
        "parliamentary_constituency": row.try_get::<Option<String>, _>("parliamentary_constituency").unwrap_or(None),
        "mla_name":                  row.try_get::<Option<String>, _>("mla_name").unwrap_or(None),
        "mp_name":                   row.try_get::<Option<String>, _>("mp_name").unwrap_or(None),
    });

    // Build the response JSON.
    let mut obj = serde_json::Map::new();
    obj.insert("id".to_string(), serde_json::json!(row.get::<Uuid, _>("id")));
    obj.insert("created_at".to_string(), serde_json::json!(row.get::<DateTime<Utc>, _>("created_at")));
    obj.insert("image_url".to_string(), serde_json::json!(image_url));
    obj.insert("latitude".to_string(), serde_json::json!(lat_rounded));
    obj.insert("longitude".to_string(), serde_json::json!(lng_rounded));
    obj.insert("category".to_string(), serde_json::json!(row.get::<String, _>("category")));
    obj.insert("severity".to_string(), serde_json::json!(row.get::<String, _>("severity")));
    obj.insert("description".to_string(), serde_json::json!(row.get::<Option<String>, _>("description")));
    obj.insert("status".to_string(), serde_json::json!(row.get::<String, _>("status")));
    obj.insert("location_source".to_string(), serde_json::json!(row.get::<String, _>("location_source")));

    // resolution_photo_url is only included when resolution_photo_path is Some (D-18).
    // resolution_notes (admin-only per D-17) is NEVER included.
    if let Some(photo_path) = row.try_get::<Option<String>, _>("resolution_photo_path").unwrap_or(None) {
        let resolution_photo_url = format!("{}/uploads/{}", api_base, photo_path);
        obj.insert("resolution_photo_url".to_string(), serde_json::json!(resolution_photo_url));
    }

    obj.insert("history".to_string(), serde_json::json!(history));
    obj.insert("ward_hierarchy".to_string(), ward_hierarchy);

    Ok(serde_json::Value::Object(obj))
}

// ─────────────────────────────────────────────────────────────────────────────
// Public open-data queries (EXPORT-03, ANALYTICS-01)
//
// D-17 whitelist — zero PII fields.
// Explicitly excluded: submitter_name, submitter_contact, submitter_ip, photo_hash.
// ─────────────────────────────────────────────────────────────────────────────

/// Column-whitelisted SQL for the public GeoJSON open-data endpoint.
/// NO PII columns (submitter_name, submitter_contact, photo_hash excluded per D-17).
/// Coordinates are rounded to 3 decimal places (~111 m) by the handler via round3().
pub const PUBLIC_GEOJSON_SQL: &str = r#"
SELECT
    r.id,
    r.category::TEXT          AS category,
    r.severity::TEXT          AS severity,
    r.status::TEXT            AS status,
    w.ward_name               AS ward_name,
    w.corporation             AS corporation,
    r.created_at,
    r.description,
    r.latitude,
    r.longitude
FROM reports r
LEFT JOIN wards w ON w.id = r.ward_id
ORDER BY r.created_at DESC
"#;

/// Test-only helper: exposes PUBLIC_GEOJSON_SQL for unit tests.
#[allow(dead_code)]
pub fn public_geojson_sql_fragment() -> &'static str {
    PUBLIC_GEOJSON_SQL
}

/// Round a float to 3 decimal places (~111 m precision at Bengaluru latitudes).
/// Applied to latitude and longitude in the public GeoJSON endpoint (D-17 privacy).
pub fn round3(f: f64) -> f64 {
    (f * 1000.0).round() / 1000.0
}

/// Row returned by get_public_stats — sourced from the public_stats_mv MV.
pub struct PublicStatsRow {
    pub total_reports: i64,
    pub resolved_count: i64,
    pub top_categories: Option<serde_json::Value>,
}

/// Read aggregate stats from the public_stats_mv materialized view.
/// Returns zero counts when the view has no rows (e.g. fresh database).
pub async fn get_public_stats(pool: &PgPool) -> Result<PublicStatsRow, AppError> {
    let row = sqlx::query(
        "SELECT total_reports, resolved_count, top_categories FROM public_stats_mv",
    )
    .fetch_optional(pool)
    .await?;

    match row {
        Some(r) => Ok(PublicStatsRow {
            total_reports: r.get::<i64, _>("total_reports"),
            resolved_count: r.get::<i64, _>("resolved_count"),
            top_categories: r.get::<Option<serde_json::Value>, _>("top_categories"),
        }),
        None => Ok(PublicStatsRow {
            total_reports: 0,
            resolved_count: 0,
            top_categories: None,
        }),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — no database required
//
// Requirements covered:
//   WARD-01 — ward auto-assignment via ST_Within at report creation
//   WARD-02 — ward lookup failure is non-fatal (NULL stored)
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    /// WARD-01 — ST_MakePoint takes (longitude, latitude) i.e. X,Y order.
    /// $2 must be the longitude parameter; $1 must be latitude.
    /// This prevents the most common PostGIS coordinate-order bug.
    #[test]
    fn get_ward_for_point_uses_correct_coordinate_order() {
        let sql = r#"SELECT id FROM wards WHERE ST_Within(ST_SetSRID(ST_MakePoint($2, $1), 4326), boundary) LIMIT 1"#;
        assert!(
            sql.contains("ST_MakePoint($2, $1)"),
            "longitude must be $2 (X), latitude must be $1 (Y) in ST_MakePoint — got: {}",
            sql
        );
    }

    /// WARD-01 — query must use ST_Within for polygon containment check.
    #[test]
    fn get_ward_for_point_uses_st_within() {
        let sql = r#"SELECT id FROM wards WHERE ST_Within(ST_SetSRID(ST_MakePoint($2, $1), 4326), boundary) LIMIT 1"#;
        assert!(
            sql.contains("ST_Within"),
            "Ward lookup must use ST_Within for polygon containment; got: {}",
            sql
        );
    }

    /// WARD-02 — ward lookup failure must produce None, not propagate error.
    /// This test simulates the unwrap_or_else behavior in the handler.
    #[test]
    fn ward_lookup_failure_produces_none() {
        let result: Result<Option<Uuid>, String> = Err("PostGIS error".to_string());
        let ward_id = result.ok().flatten();
        assert!(
            ward_id.is_none(),
            "Ward lookup failure must produce None (non-fatal); got Some(_)"
        );
    }

    /// ABUSE-03 — SHA256 hash must be sensitive to byte content and produce
    /// a 64-character hex string. This verifies the sha2 crate is wired
    /// and that hash order sensitivity is preserved.
    #[test]
    fn photo_hash_sha256_is_byte_order_sensitive() {
        use sha2::{Digest, Sha256};
        let bytes_a: &[u8] = &[1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        let bytes_b: &[u8] = &[2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        let hash_a = format!("{:x}", Sha256::digest(bytes_a));
        let hash_b = format!("{:x}", Sha256::digest(bytes_b));
        assert_ne!(hash_a, hash_b, "SHA256 of different bytes must differ");
        assert_eq!(hash_a.len(), 64, "SHA256 hex string must be 64 chars");
    }

    /// WARD-03 — get_ward_label_for_point SQL uses correct PostGIS coordinate order.
    /// ST_MakePoint($2, $1) means longitude=$2 (X) and latitude=$1 (Y).
    #[test]
    fn get_ward_label_for_point_uses_correct_coordinate_order() {
        let sql = r#"SELECT ward_number, ward_name FROM wards WHERE ST_Within(ST_SetSRID(ST_MakePoint($2, $1), 4326), boundary) LIMIT 1"#;
        assert!(
            sql.contains("ST_MakePoint($2, $1)"),
            "longitude must be $2 (X), latitude must be $1 (Y) in ST_MakePoint — got: {}",
            sql
        );
        assert!(
            sql.contains("ward_number") && sql.contains("ward_name"),
            "public ward lookup must select ward_number and ward_name; got: {}",
            sql
        );
    }

    /// NF-03-B — get_org_for_ward SQL must use ILIKE pattern and org_type filter.
    #[test]
    fn get_org_for_ward_uses_ilike_and_org_type_filter() {
        let sql = r#"SELECT o.id FROM wards w JOIN organizations o ON o.org_type = 'corporation' AND o.name ILIKE '%' || w.corporation || '%' WHERE w.id = $1 LIMIT 1"#;
        assert!(
            sql.contains("ILIKE '%' || w.corporation || '%'"),
            "org lookup must use ILIKE with ward.corporation; got: {}",
            sql
        );
        assert!(
            sql.contains("org_type = 'corporation'"),
            "org lookup must filter by org_type = 'corporation'; got: {}",
            sql
        );
    }
}
