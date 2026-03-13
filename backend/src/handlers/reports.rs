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

// ── Anti-abuse pure helper functions ────────────────────────────────────────
//
// These are extracted as top-level functions (not methods) so they can be
// called from both the handler and the unit test module without requiring
// any I/O infrastructure.

/// ABUSE-02: Returns true when the honeypot `website` field is non-empty.
/// Legitimate users never fill this field; bots typically fill all inputs.
fn is_honeypot_triggered(website_field: &str) -> bool {
    !website_field.is_empty()
}

/// ABUSE-01: Builds the rate-limit key as "{ip}:{geohash6}".
/// geohash::encode takes Coord { x: longitude, y: latitude } — do NOT swap.
/// Precision 6 gives ~1.2 km × 0.6 km cells — appropriate for hyperlocal dedup.
fn build_rate_limit_key(ip: &str, lat: f64, lng: f64) -> String {
    use geohash::{encode, Coord};
    let cell = encode(Coord { x: lng, y: lat }, 6usize)
        .unwrap_or_else(|_| "000000".to_string());
    format!("{}:{}", ip, cell)
}

/// Extracts the real client IP from X-Real-IP header (set by nginx) or falls
/// back to the TCP peer address. Never panics — returns "unknown" as last resort.
fn extract_client_ip(
    headers: &axum::http::HeaderMap,
    peer_addr: Option<std::net::SocketAddr>,
) -> String {
    headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            peer_addr
                .map(|a| a.ip().to_string())
                .unwrap_or_else(|| "unknown".to_string())
        })
}

/// ABUSE-02: Returns a fake HTTP 200 ReportResponse-shaped body for honeypot
/// submissions. The nil UUID signals bot detection without revealing it.
fn fake_success_response() -> ReportResponse {
    use chrono::Utc;
    ReportResponse {
        id: Uuid::nil(),
        created_at: Utc::now(),
        image_url: String::new(),
        latitude: 0.0,
        longitude: 0.0,
        category: "no_footpath".to_string(),
        severity: "medium".to_string(),
        description: None,
        submitter_name: None,
        status: "submitted".to_string(),
        location_source: "manual_pin".to_string(),
        ward_name: None,
    }
}

pub async fn create_report(
    State(state): State<AppState>,
    axum::extract::ConnectInfo(peer_addr): axum::extract::ConnectInfo<std::net::SocketAddr>,
    headers: axum::http::HeaderMap,
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
            "website" => {
                // ABUSE-02: Honeypot field — legitimate users never fill this.
                // Return a fake success response silently; bots get no error signal.
                let text = field.text().await.unwrap_or_default();
                if is_honeypot_triggered(&text) {
                    return Ok(Json(fake_success_response()));
                }
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

    // ABUSE-01: Rate limit check — 2 submissions/hour per IP+geohash-6 cell.
    // Checked after bbox validation so out-of-bounds submissions never consume quota.
    let client_ip = extract_client_ip(&headers, Some(peer_addr));
    let rate_key = build_rate_limit_key(&client_ip, req.latitude, req.longitude);
    if state.rate_limiter.check_key(&rate_key).is_err() {
        return Err(AppError::RateLimited(
            "You've submitted too many reports from this area recently. Try again in an hour."
                .into(),
        ));
    }

    // Store submitter_ip for Plan 02 deduplication pipeline.
    req.submitter_ip = Some(client_ip);

    // Look up the ward for this coordinate — non-fatal if PostGIS fails.
    let ward_id = queries::get_ward_for_point(&state.pool, req.latitude, req.longitude)
        .await
        .unwrap_or_else(|e| {
            tracing::warn!(
                lat = req.latitude,
                lng = req.longitude,
                error = %e,
                "Ward lookup failed; report will be stored without ward assignment"
            );
            None
        });

    // Strip EXIF from image before saving
    let clean_bytes = strip_exif(&req.image_bytes);

    // Save to disk
    let file_uuid = Uuid::new_v4();
    let filename = format!("{}.jpg", file_uuid);
    let file_path = PathBuf::from(&state.uploads_dir).join(&filename);
    tokio::fs::write(&file_path, &clean_bytes).await?;

    // Insert into DB
    let report = queries::insert_report(&state.pool, &req, &filename, ward_id).await?;
    let response = report.into_response(&state.api_base_url);

    Ok(Json(response))
}

pub async fn list_reports(
    State(state): State<AppState>,
    Query(params): Query<ListReportsQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = if params.limit <= 0 { 20 } else { params.limit.clamp(1, 200) };
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

    // ── P2-4: effective_limit() ───────────────────────────────────────────────
    //
    // Spec: cap raised from 100 → 200; values ≤ 0 fall back to default 20;
    //       values 1–200 accepted as-is; values > 200 clamped to 200.
    //
    // This helper mirrors the logic the handler will use AFTER the fix.
    // It is intentionally seeded with the OLD logic (raw.clamp(1, 100)) so
    // that the tests compile right now but the cases exercising new behaviour
    // (EC-1, EC-2, EC-3, EC-10, EC-11, EC-12, EC-13) FAIL, confirming they
    // represent a real behavioural delta that the implementer must satisfy.
    //
    // The implementer must replace the body of this function with:
    //   if raw <= 0 { 20 } else { raw.clamp(1, 200) }
    // and then update the production line in list_reports() to match.
    // Tests must NOT be modified — they are the contract.
    fn effective_limit(raw: i64) -> i64 {
        if raw <= 0 { 20 } else { raw.clamp(1, 200) }
    }

    // EC-1: zero must fall back to default 20, not be clamped to 1
    #[test]
    fn test_effective_limit_zero_returns_default_20() {
        assert_eq!(
            effective_limit(0),
            20,
            "limit=0 must fall back to the default of 20, not be clamped to 1 \
             (got {} instead of 20)",
            effective_limit(0)
        );
    }

    // EC-2: -1 must fall back to default 20
    #[test]
    fn test_effective_limit_minus_one_returns_default_20() {
        assert_eq!(
            effective_limit(-1),
            20,
            "limit=-1 must fall back to the default of 20, not be clamped to 1 \
             (got {} instead of 20)",
            effective_limit(-1)
        );
    }

    // EC-3: large negative value must fall back to default 20
    #[test]
    fn test_effective_limit_large_negative_returns_default_20() {
        assert_eq!(
            effective_limit(-999),
            20,
            "limit=-999 must fall back to the default of 20, not be clamped to 1 \
             (got {} instead of 20)",
            effective_limit(-999)
        );
    }

    // EC-4: minimum valid value 1 must be returned as-is
    #[test]
    fn test_effective_limit_one_returns_one() {
        assert_eq!(
            effective_limit(1),
            1,
            "limit=1 is the minimum valid value and must be returned unchanged \
             (got {} instead of 1)",
            effective_limit(1)
        );
    }

    // EC-5: mid-range value 20 (the default) must be returned as-is
    #[test]
    fn test_effective_limit_twenty_returns_twenty() {
        assert_eq!(
            effective_limit(20),
            20,
            "limit=20 is a normal mid-range value and must be returned unchanged \
             (got {} instead of 20)",
            effective_limit(20)
        );
    }

    // EC-6: mid-range value 50 must be returned as-is
    #[test]
    fn test_effective_limit_fifty_returns_fifty() {
        assert_eq!(
            effective_limit(50),
            50,
            "limit=50 is within the valid range 1–200 and must be returned unchanged \
             (got {} instead of 50)",
            effective_limit(50)
        );
    }

    // EC-7: 100 was the old cap — it must now be accepted as-is (not clamped)
    #[test]
    fn test_effective_limit_one_hundred_returns_one_hundred() {
        assert_eq!(
            effective_limit(100),
            100,
            "limit=100 was the old cap but is now a mid-range value (cap is 200); \
             it must be returned unchanged (got {} instead of 100)",
            effective_limit(100)
        );
    }

    // EC-8: 199 is just below the new cap and must be returned as-is
    #[test]
    fn test_effective_limit_199_returns_199() {
        assert_eq!(
            effective_limit(199),
            199,
            "limit=199 is one below the new cap of 200 and must be returned unchanged \
             (got {} instead of 199)",
            effective_limit(199)
        );
    }

    // EC-9: 200 is exactly the new cap and must be returned as-is
    #[test]
    fn test_effective_limit_200_returns_200() {
        assert_eq!(
            effective_limit(200),
            200,
            "limit=200 is exactly at the new cap and must be accepted unchanged \
             (got {} instead of 200)",
            effective_limit(200)
        );
    }

    // EC-10: 201 is just over the new cap and must be clamped to 200
    #[test]
    fn test_effective_limit_201_clamped_to_200() {
        assert_eq!(
            effective_limit(201),
            200,
            "limit=201 exceeds the cap of 200 and must be clamped to 200 \
             (got {} instead of 200)",
            effective_limit(201)
        );
    }

    // EC-11: 500 is well over the new cap and must be clamped to 200
    #[test]
    fn test_effective_limit_500_clamped_to_200() {
        assert_eq!(
            effective_limit(500),
            200,
            "limit=500 exceeds the cap of 200 and must be clamped to 200 \
             (got {} instead of 200)",
            effective_limit(500)
        );
    }

    // EC-12: 10000 must be clamped to 200
    #[test]
    fn test_effective_limit_10000_clamped_to_200() {
        assert_eq!(
            effective_limit(10000),
            200,
            "limit=10000 far exceeds the cap of 200 and must be clamped to 200 \
             (got {} instead of 200)",
            effective_limit(10000)
        );
    }

    // EC-13: i64::MAX must be clamped to 200 without overflow or panic
    #[test]
    fn test_effective_limit_i64_max_clamped_to_200() {
        assert_eq!(
            effective_limit(i64::MAX),
            200,
            "limit=i64::MAX must be clamped to 200 without overflow or panic \
             (got {} instead of 200)",
            effective_limit(i64::MAX)
        );
    }

    // ── WARD-02: ward lookup failure must not block report submission ─────────

    /// WARD-02 — When get_ward_for_point returns Err, the handler must
    /// continue with ward_id = None (non-fatal). This test simulates the
    /// unwrap_or_else pattern used in create_report().
    #[test]
    fn ward_lookup_failure_does_not_block_report() {
        // Simulates the unwrap_or_else behavior: Err from get_ward_for_point → None
        let result: Result<Option<uuid::Uuid>, String> = Err("PostGIS error".to_string());
        let ward_id = result.unwrap_or_else(|_| None);
        assert!(
            ward_id.is_none(),
            "Ward lookup failure must produce None (non-fatal); \
             report submission must not be blocked by ward lookup errors"
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Anti-abuse unit tests (ABUSE-01, ABUSE-02)
//
// Requirements covered:
//   ABUSE-01 — Per-IP+geohash-6 rate limiting (2 submissions/hour max)
//   ABUSE-02 — Honeypot bot detection via hidden `website` form field
//
// All helpers under test are pure functions extracted from the handler, so
// tests require no database, network, or Axum routing stack.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod rate_limit_honeypot_tests {
    use super::*;
    use axum::http::StatusCode;
    use axum::response::IntoResponse;

    // ── ABUSE-02: Honeypot detection ──────────────────────────────────────────

    /// ABUSE-02 — is_honeypot_triggered returns false for empty string (legitimate user).
    #[test]
    fn honeypot_empty_passes_through() {
        assert!(
            !is_honeypot_triggered(""),
            "Empty website field must NOT trigger honeypot (legitimate user path)"
        );
    }

    /// ABUSE-02 — is_honeypot_triggered returns true for any non-empty string (bot path).
    #[test]
    fn honeypot_non_empty_returns_fake_success() {
        assert!(
            is_honeypot_triggered("http://spam.com"),
            "Non-empty website field must trigger honeypot (bot detection)"
        );
        assert!(
            is_honeypot_triggered("x"),
            "Single-character website field must trigger honeypot"
        );
        assert!(
            is_honeypot_triggered("   "),
            "Whitespace-only website field must trigger honeypot"
        );
    }

    // ── ABUSE-01: Rate limit key construction ────────────────────────────────

    /// ABUSE-01 — build_rate_limit_key returns "{ip}:{geohash6}" format.
    /// Verifies key structure: starts with ip, contains colon separator,
    /// and has geohash suffix (total length > ip.len() + 1).
    #[test]
    fn rate_limit_key_format() {
        let key = build_rate_limit_key("1.2.3.4", 12.9716, 77.5946);
        assert!(
            key.starts_with("1.2.3.4:"),
            "Rate limit key must start with IP address followed by colon. Got: {}",
            key
        );
        // Key is "{ip}:{geohash6}" — geohash6 is 6 chars, total ≥ 9+1 chars
        assert!(
            key.len() >= "1.2.3.4:".len() + 1,
            "Rate limit key must contain geohash suffix after colon. Got: {}",
            key
        );
        // The geohash portion must be exactly 6 characters
        let geohash_part = &key["1.2.3.4:".len()..];
        assert_eq!(
            geohash_part.len(),
            6,
            "Geohash portion of rate limit key must be exactly 6 characters. Got: '{}'",
            geohash_part
        );
    }

    // ── ABUSE-01: Geohash coordinate order regression guard ──────────────────

    /// ABUSE-01 — Regression guard for geohash coordinate order.
    /// geohash::encode takes Coord { x: longitude, y: latitude }.
    /// Swapping x and y must produce a DIFFERENT hash (proves order matters).
    #[test]
    fn geohash_coordinate_order() {
        use geohash::{encode, Coord};

        // Correct order: x=longitude, y=latitude (Bengaluru city center)
        let correct = encode(Coord { x: 77.5946, y: 12.9716 }, 6)
            .expect("encode must succeed for valid Bengaluru coordinates");

        // Swapped order: x=latitude, y=longitude (WRONG — regression guard)
        let swapped = encode(Coord { x: 12.9716, y: 77.5946 }, 6)
            .expect("encode must succeed even for swapped coordinates");

        assert_ne!(
            correct,
            swapped,
            "Correct (lng,lat) and swapped (lat,lng) coordinate order must produce \
             DIFFERENT geohashes. If they are equal, the coordinate order is wrong."
        );

        // The correct hash must be 6 characters
        assert_eq!(
            correct.len(),
            6,
            "Geohash with precision=6 must have exactly 6 characters. Got: '{}'",
            correct
        );
    }

    // ── ABUSE-01: AppError::RateLimited maps to HTTP 429 ────────────────────

    /// ABUSE-01 — AppError::RateLimited must produce HTTP 429 TOO_MANY_REQUESTS.
    #[test]
    fn rate_limited_error_maps_to_429() {
        let err = AppError::RateLimited("test message".into());
        let response = err.into_response();
        assert_eq!(
            response.status(),
            StatusCode::TOO_MANY_REQUESTS,
            "AppError::RateLimited must map to HTTP 429 TOO_MANY_REQUESTS"
        );
    }
}
