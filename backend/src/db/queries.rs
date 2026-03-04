use sqlx::PgPool;
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::report::{CreateReportRequest, Report};

pub async fn insert_report(
    pool: &PgPool,
    req: &CreateReportRequest,
    image_path: &str,
) -> Result<Report, AppError> {
    let row = sqlx::query_as::<_, Report>(
        r#"
        INSERT INTO reports
            (image_path, latitude, longitude, category, severity,
             description, submitter_name, submitter_contact, location_source)
        VALUES ($1, $2, $3, $4::issue_category, $5::severity_level,
                $6, $7, $8, $9::location_source)
        RETURNING
            id, created_at, image_path, latitude, longitude,
            category::TEXT AS category,
            severity::TEXT AS severity,
            description,
            submitter_name,
            submitter_contact,
            status::TEXT AS status,
            location_source::TEXT AS location_source
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
            location_source::TEXT AS location_source
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
            location_source::TEXT AS location_source
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
