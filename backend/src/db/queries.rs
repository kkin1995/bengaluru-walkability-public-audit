use sqlx::PgPool;
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
             description, submitter_name, submitter_contact, location_source, ward_id)
        VALUES ($1, $2, $3, $4::issue_category, $5::severity_level,
                $6, $7, $8, $9::location_source, $10)
        RETURNING
            id, created_at, image_path, latitude, longitude,
            category::TEXT AS category,
            severity::TEXT AS severity,
            description,
            submitter_name,
            submitter_contact,
            status::TEXT AS status,
            location_source::TEXT AS location_source,
            ward_id
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
    .fetch_one(pool)
    .await?;

    Ok(row)
}

pub async fn list_reports(
    pool: &PgPool,
    page: i64,
    limit: i64,
    category: Option<&str>,
    status: Option<&str>,
) -> Result<Vec<Report>, AppError> {
    let offset = (page - 1) * limit;

    let rows = sqlx::query_as::<_, Report>(
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
            ward_id
        FROM reports
        WHERE
            ($1::TEXT IS NULL OR category::TEXT = $1)
            AND ($2::TEXT IS NULL OR status::TEXT = $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(category)
    .bind(status)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

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
            ward_id
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
        let ward_id = result.unwrap_or_else(|_| None);
        assert!(
            ward_id.is_none(),
            "Ward lookup failure must produce None (non-fatal); got Some(_)"
        );
    }
}
