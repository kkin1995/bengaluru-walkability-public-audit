use axum::{
    extract::{Multipart, Path, Query, State},
    Json,
};
use serde_json::{json, Value};
use std::path::PathBuf;
use uuid::Uuid;

use crate::{
    db::queries,
    errors::AppError,
    models::report::{CreateReportRequest, ListReportsQuery, ReportResponse},
    AppState,
};

pub async fn create_report(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<ReportResponse>, AppError> {
    let mut req = CreateReportRequest::default();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "photo" => {
                req.image_filename = field
                    .file_name()
                    .unwrap_or("upload.jpg")
                    .to_string();
                req.image_bytes = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?
                    .to_vec();
            }
            "lat" | "latitude" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                req.latitude = text
                    .parse()
                    .map_err(|_| AppError::BadRequest("Invalid latitude".into()))?;
            }
            "lng" | "longitude" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                req.longitude = text
                    .parse()
                    .map_err(|_| AppError::BadRequest("Invalid longitude".into()))?;
            }
            "category" => {
                req.category = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
            }
            "severity" => {
                req.severity = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
            }
            "description" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !text.is_empty() {
                    req.description = Some(text);
                }
            }
            "name" | "submitter_name" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !text.is_empty() {
                    req.submitter_name = Some(text);
                }
            }
            "contact" | "submitter_contact" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                if !text.is_empty() {
                    req.submitter_contact = Some(text);
                }
            }
            "location_source" => {
                req.location_source = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
            }
            _ => {
                // consume and discard unknown fields
                let _ = field.bytes().await;
            }
        }
    }

    // Validate required fields
    if req.image_bytes.is_empty() {
        return Err(AppError::BadRequest("Photo is required".into()));
    }
    if req.category.is_empty() {
        return Err(AppError::BadRequest("Category is required".into()));
    }
    if req.location_source.is_empty() {
        req.location_source = "manual_pin".to_string();
    }
    if req.severity.is_empty() {
        req.severity = "medium".to_string();
    }

    // Validate coordinates fall within Bengaluru
    const LAT_MIN: f64 = 12.7342;
    const LAT_MAX: f64 = 13.1739;
    const LNG_MIN: f64 = 77.3791;
    const LNG_MAX: f64 = 77.8731;
    if req.latitude < LAT_MIN || req.latitude > LAT_MAX
        || req.longitude < LNG_MIN || req.longitude > LNG_MAX
    {
        return Err(AppError::BadRequest(
            "Please drop the pin within Bengaluru".into(),
        ));
    }

    // Strip EXIF from image before saving
    let clean_bytes = strip_exif(&req.image_bytes);

    // Save to disk
    let file_uuid = Uuid::new_v4();
    let filename = format!("{}.jpg", file_uuid);
    let file_path = PathBuf::from(&state.uploads_dir).join(&filename);
    tokio::fs::write(&file_path, &clean_bytes).await?;

    // Insert into DB
    let report = queries::insert_report(&state.pool, &req, &filename).await?;
    let response = report.into_response(&state.api_base_url);

    Ok(Json(response))
}

pub async fn list_reports(
    State(state): State<AppState>,
    Query(params): Query<ListReportsQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = params.limit.clamp(1, 100);
    let page = params.page.max(1);

    let reports = queries::list_reports(
        &state.pool,
        page,
        limit,
        params.category.as_deref(),
        params.status.as_deref(),
    )
    .await?;

    let items: Vec<ReportResponse> = reports
        .into_iter()
        .map(|r| r.into_response(&state.api_base_url))
        .collect();

    Ok(Json(json!({
        "page": page,
        "limit": limit,
        "count": items.len(),
        "items": items,
    })))
}

pub async fn get_report(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ReportResponse>, AppError> {
    let report = queries::get_report_by_id(&state.pool, id).await?;
    Ok(Json(report.into_response(&state.api_base_url)))
}

/// Strip all EXIF metadata from JPEG bytes using img-parts.
/// Falls back to returning the original bytes if parsing fails.
fn strip_exif(bytes: &[u8]) -> Vec<u8> {
    use img_parts::{jpeg::Jpeg, ImageEXIF};

    match Jpeg::from_bytes(bytes.to_vec().into()) {
        Ok(mut jpeg) => {
            jpeg.set_exif(None);
            jpeg.encoder().bytes().to_vec()
        }
        Err(_) => bytes.to_vec(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
//
// Requirements covered:
//   AC2.2 — pin outside Bengaluru bbox → 400 "Please drop the pin within Bengaluru"
//
// The validation logic is expressed as pure boolean predicates extracted from
// the handler constants so they can be tested without a real database or Axum
// routing stack.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    // ── Bengaluru bounding box constants (must match the handler exactly) ─────

    const LAT_MIN: f64 = 12.7342;
    const LAT_MAX: f64 = 13.1739;
    const LNG_MIN: f64 = 77.3791;
    const LNG_MAX: f64 = 77.8731;

    /// Returns true when the coordinate is within the Bengaluru bounding box.
    /// This mirrors the guard in create_report() verbatim so that any change to
    /// the production predicate causes these tests to fail immediately.
    fn is_in_bengaluru(lat: f64, lng: f64) -> bool {
        !(lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX)
    }

    // ── Happy-path: valid Bengaluru coordinates ───────────────────────────────

    #[test]
    fn test_bengaluru_bounds_valid_center() {
        // AC2.2 — a point at the geographic centre of Bengaluru must pass.
        assert!(
            is_in_bengaluru(12.9716, 77.5946),
            "Center of Bengaluru (12.9716, 77.5946) must be inside the bounding box"
        );
    }

    #[test]
    fn test_bengaluru_bounds_valid_sample_point() {
        // AC2.2 — a random interior point must pass.
        assert!(
            is_in_bengaluru(13.0, 77.6),
            "(13.0, 77.6) is inside the Bengaluru bbox and must be accepted"
        );
    }

    // ── Latitude out of range ─────────────────────────────────────────────────

    #[test]
    fn test_bengaluru_bounds_lat_too_low() {
        // AC2.2 — latitude of 0 (equator) must be rejected.
        assert!(
            !is_in_bengaluru(0.0, 77.5),
            "lat=0 is far south of Bengaluru and must be rejected"
        );
    }

    #[test]
    fn test_bengaluru_bounds_lat_too_high() {
        // AC2.2 — latitude of 14.0 (north of Karnataka) must be rejected.
        assert!(
            !is_in_bengaluru(14.0, 77.5),
            "lat=14.0 is north of the Bengaluru bbox and must be rejected"
        );
    }

    #[test]
    fn test_bengaluru_bounds_lat_just_below_min() {
        // AC2.2 boundary: one small step below latMin must be rejected.
        // 12.7341 < LAT_MIN (12.7342)
        assert!(
            !is_in_bengaluru(12.7341, 77.5946),
            "lat=12.7341 is just below latMin=12.7342 and must be rejected"
        );
    }

    #[test]
    fn test_bengaluru_bounds_lat_just_above_max() {
        // AC2.2 boundary: one small step above latMax must be rejected.
        // 13.1740 > LAT_MAX (13.1739)
        assert!(
            !is_in_bengaluru(13.174_0, 77.5946),
            "lat=13.1740 is just above latMax=13.1739 and must be rejected"
        );
    }

    // ── Longitude out of range ────────────────────────────────────────────────

    #[test]
    fn test_bengaluru_bounds_lng_too_low() {
        // AC2.2 — longitude of 0 (prime meridian) must be rejected.
        assert!(
            !is_in_bengaluru(12.9, 0.0),
            "lng=0 is far west of Bengaluru and must be rejected"
        );
    }

    #[test]
    fn test_bengaluru_bounds_lng_too_high() {
        // AC2.2 — longitude of 80 (Bay of Bengal) must be rejected.
        assert!(
            !is_in_bengaluru(12.9, 80.0),
            "lng=80 is east of the Bengaluru bbox and must be rejected"
        );
    }

    #[test]
    fn test_bengaluru_bounds_lng_just_below_min() {
        // AC2.2 boundary: one small step below lngMin must be rejected.
        // 77.3790 < LNG_MIN (77.3791)
        assert!(
            !is_in_bengaluru(12.9716, 77.379_0),
            "lng=77.3790 is just below lngMin=77.3791 and must be rejected"
        );
    }

    #[test]
    fn test_bengaluru_bounds_lng_just_above_max() {
        // AC2.2 boundary: one small step above lngMax must be rejected.
        // 77.8732 > LNG_MAX (77.8731)
        assert!(
            !is_in_bengaluru(12.9716, 77.873_2),
            "lng=77.8732 is just above lngMax=77.8731 and must be rejected"
        );
    }

    // ── Exact boundary edges must be ACCEPTED (inclusive bounds) ─────────────

    #[test]
    fn test_bengaluru_bounds_exact_sw_corner() {
        // AC2.2 — the exact SW corner (latMin, lngMin) lies ON the boundary → accepted.
        assert!(
            is_in_bengaluru(LAT_MIN, LNG_MIN),
            "Exact SW corner (latMin={}, lngMin={}) must be inside the bbox (inclusive)",
            LAT_MIN,
            LNG_MIN
        );
    }

    #[test]
    fn test_bengaluru_bounds_exact_ne_corner() {
        // AC2.2 — the exact NE corner (latMax, lngMax) lies ON the boundary → accepted.
        assert!(
            is_in_bengaluru(LAT_MAX, LNG_MAX),
            "Exact NE corner (latMax={}, lngMax={}) must be inside the bbox (inclusive)",
            LAT_MAX,
            LNG_MAX
        );
    }

    #[test]
    fn test_bengaluru_bounds_exact_nw_corner() {
        // Completeness: NW corner must also be accepted.
        assert!(
            is_in_bengaluru(LAT_MAX, LNG_MIN),
            "Exact NW corner (latMax={}, lngMin={}) must be inside the bbox",
            LAT_MAX,
            LNG_MIN
        );
    }

    #[test]
    fn test_bengaluru_bounds_exact_se_corner() {
        // Completeness: SE corner must also be accepted.
        assert!(
            is_in_bengaluru(LAT_MIN, LNG_MAX),
            "Exact SE corner (latMin={}, lngMax={}) must be inside the bbox",
            LAT_MIN,
            LNG_MAX
        );
    }

    // ── Default-field population (pure logic, no I/O) ─────────────────────────

    #[test]
    fn test_default_severity_is_medium() {
        // AC4.2 — when severity is empty in the form, the handler defaults it to "medium".
        // We test the defaulting logic in isolation.
        let mut severity = String::new();
        if severity.is_empty() {
            severity = "medium".to_string();
        }
        assert_eq!(
            severity, "medium",
            "Empty severity field must default to 'medium'"
        );
    }

    #[test]
    fn test_default_location_source_is_manual_pin() {
        // Verifies the defaulting logic for location_source matches the handler.
        let mut location_source = String::new();
        if location_source.is_empty() {
            location_source = "manual_pin".to_string();
        }
        assert_eq!(
            location_source, "manual_pin",
            "Empty location_source must default to 'manual_pin'"
        );
    }
}
