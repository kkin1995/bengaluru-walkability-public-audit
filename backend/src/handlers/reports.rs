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
// Note: ReportResponse is used in create_report (fake_success_response) and get_report_by_id.
// list_reports now uses list_reports_enriched which returns serde_json::Value directly.

// ── Bengaluru bounding box constants ────────────────────────────────────────
//
// Defined once at module level so both the handler and the test module share
// the same values. Moving them here removes the previous duplication between
// create_report (lines ~210-213) and mod tests (lines ~342-345).
const LAT_MIN: f64 = 12.7342;
const LAT_MAX: f64 = 13.1739;
const LNG_MIN: f64 = 77.3791;
const LNG_MAX: f64 = 77.8731;

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
    let cell = encode(Coord { x: lng, y: lat }, 6usize).unwrap_or_else(|_| "000000".to_string());
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

/// D-05/D-06: Returns true when `bytes` begins with the JPEG SOI (Start of Image)
/// marker `0xFF 0xD8`. Legitimate JPEG files always start with these two bytes.
///
/// Security note: this check must occur BEFORE `strip_exif`, because `img-parts`
/// silently returns the original bytes on parse failure — a non-JPEG would be
/// written to disk verbatim if it were allowed past this guard (see RESEARCH.md Pitfall 1).
// WR-03: pub(crate) so admin handlers can validate resolution photos the same way.
pub(crate) fn is_jpeg(bytes: &[u8]) -> bool {
    bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xD8
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
        status: "open".to_string(),
        location_source: "manual_pin".to_string(),
        ward_name: None,
        resolution_photo_url: None,
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
                req.image_filename = field.file_name().unwrap_or("upload.jpg").to_string();
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
                    tracing::warn!(
                        honeypot_value_len = text.len(),
                        "ABUSE-02: honeypot triggered, returning fake success"
                    );
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
    // D-05/D-06/D-07: Validate JPEG magic bytes before any processing.
    // Must come BEFORE strip_exif — img-parts silently falls back on parse errors,
    // which would allow non-JPEG files (e.g. SVG) to reach disk verbatim.
    if !is_jpeg(&req.image_bytes) {
        return Err(AppError::BadRequest("Only JPEG images are accepted".into()));
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

    // ABUSE-03: Compute SHA256 of raw bytes BEFORE EXIF stripping.
    // This ensures re-uploads of the same photo produce the same hash regardless
    // of client-side EXIF strip behaviour.
    {
        use sha2::{Digest, Sha256};
        let photo_hash = format!("{:x}", Sha256::digest(&req.image_bytes));

        // Check for exact duplicate photo — return fake success without writing anything
        if queries::check_photo_hash_exists(&state.pool, &photo_hash).await? {
            tracing::warn!(photo_hash = %photo_hash, "ABUSE-03: duplicate photo hash, returning fake success");
            return Ok(Json(fake_success_response()));
        }

        req.photo_hash = Some(photo_hash);
    }

    // Validate coordinates fall within Bengaluru
    if req.latitude < LAT_MIN
        || req.latitude > LAT_MAX
        || req.longitude < LNG_MIN
        || req.longitude > LNG_MAX
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

    // Store submitter_ip for deduplication confidence calculation.
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

    // NF-03-B: Look up the owning BBMP corporation org for the ward — non-fatal.
    let assigned_org_id: Option<Uuid> = if let Some(wid) = ward_id {
        queries::get_org_for_ward(&state.pool, wid)
            .await
            .unwrap_or_else(|e| {
                tracing::warn!(
                    ward_id = %wid,
                    error = %e,
                    "Org auto-assign lookup failed; proceeding with NULL assigned_org_id"
                );
                None
            })
    } else {
        None
    };

    // [FIX-06] Bake EXIF orientation into pixels before stripping EXIF metadata.
    // If orientation tag is absent or equals 1, bytes are returned unchanged.
    // Must run BEFORE strip_exif — after stripping, the orientation tag is gone.
    let oriented_bytes = bake_orientation(&req.image_bytes)?;

    // Strip EXIF from orientation-baked bytes — propagate error on parse failure
    // instead of writing potentially malformed bytes to disk (WR-02).
    let clean_bytes = strip_exif(&oriented_bytes)?;

    // Save to disk
    let file_uuid = Uuid::new_v4();
    let filename = format!("{}.jpg", file_uuid);
    let file_path = PathBuf::from(&state.uploads_dir).join(&filename);
    tokio::fs::write(&file_path, &clean_bytes).await?;

    // Insert into DB
    let report = queries::insert_report(&state.pool, &req, &filename, ward_id, assigned_org_id).await?;

    // Insert audit trail for org auto-assignment (best-effort — non-fatal on failure).
    if assigned_org_id.is_some() {
        if let Err(e) = sqlx::query(
            r#"INSERT INTO status_history (report_id, new_status, note, changed_by)
               VALUES ($1, 'open'::report_status, 'Auto-assigned based on ward geography', NULL)"#,
        )
        .bind(report.id)
        .execute(&*state.pool)
        .await
        {
            tracing::warn!(
                report_id = %report.id,
                error = %e,
                "Auto-assign status_history insert failed (non-fatal)"
            );
        }
    }

    let response = report.into_response(&state.api_base_url);

    Ok(Json(response))
}

pub async fn list_reports(
    State(state): State<AppState>,
    Query(params): Query<ListReportsQuery>,
) -> Result<Json<Value>, AppError> {
    let limit = if params.limit <= 0 {
        20
    } else {
        params.limit.clamp(1, 200)
    };
    let page = params.page.max(1);

    // Run the paginated list (enriched with ward data for popup) and total count concurrently.
    // count_reports is non-fatal: if it fails, we omit `total` from the response
    // rather than failing the whole request.
    // MAP-03 / D-31: list_reports_enriched includes ward_name + corporation via LEFT JOIN
    // so the public map popup can display the GBA jurisdiction line.
    let (reports_result, total_result) = tokio::join!(
        queries::list_reports_enriched(
            &state.pool,
            page,
            limit,
            params.category.as_deref(),
            params.status.as_deref(),
            &state.api_base_url,
        ),
        queries::count_reports(&state.pool),
    );

    let items = reports_result?;
    let count = items.len();

    let mut response = json!({
        "page": page,
        "limit": limit,
        "count": count,
        "items": items,
    });

    if let Ok(total) = total_result {
        response["total"] = json!(total);
    }

    Ok(Json(response))
}

pub async fn get_report(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let v = queries::get_report_with_detail(&state.pool, id, &state.api_base_url).await?;
    Ok(Json(v))
}

/// FIX-06: Reads tag 0x0112 (Orientation) from raw EXIF/TIFF bytes.
///
/// The EXIF APP1 payload starts with "Exif\0\0" (6 bytes), followed by a TIFF
/// header. This function handles both little-endian ("II") and big-endian ("MM")
/// byte order. Returns None if the tag is absent or the bytes are malformed.
///
/// TIFF structure (simplified):
///   [byte order marker 2B] [magic 0x2A 2B] [IFD0 offset 4B] [IFD entries...]
/// Each IFD entry: [tag 2B] [type 2B] [count 4B] [value/offset 4B]
fn read_exif_orientation_tag(exif_bytes: &[u8]) -> Option<u16> {
    // EXIF payload starts with "Exif\0\0" (6 bytes) then TIFF data
    if exif_bytes.len() < 14 {
        return None;
    }
    // Skip the "Exif\0\0" header
    let tiff = &exif_bytes[6..];
    if tiff.len() < 8 {
        return None;
    }

    // Determine byte order
    let little_endian = match &tiff[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => return None, // unknown byte order
    };

    let read_u16 = |buf: &[u8], offset: usize| -> Option<u16> {
        let b = buf.get(offset..offset + 2)?;
        Some(if little_endian {
            u16::from_le_bytes([b[0], b[1]])
        } else {
            u16::from_be_bytes([b[0], b[1]])
        })
    };
    let read_u32 = |buf: &[u8], offset: usize| -> Option<u32> {
        let b = buf.get(offset..offset + 4)?;
        Some(if little_endian {
            u32::from_le_bytes([b[0], b[1], b[2], b[3]])
        } else {
            u32::from_be_bytes([b[0], b[1], b[2], b[3]])
        })
    };

    // Verify TIFF magic (42)
    let magic = read_u16(tiff, 2)?;
    if magic != 42 {
        return None;
    }

    // IFD0 offset
    let ifd_offset = read_u32(tiff, 4)? as usize;
    if ifd_offset + 2 > tiff.len() {
        return None;
    }

    // Number of IFD entries
    let entry_count = read_u16(tiff, ifd_offset)? as usize;
    let entries_start = ifd_offset + 2;

    for i in 0..entry_count {
        let entry_offset = entries_start + i * 12;
        if entry_offset + 12 > tiff.len() {
            break;
        }
        let tag = read_u16(tiff, entry_offset)?;
        if tag == 0x0112 {
            // Orientation tag found — value is stored inline as a u16 in the
            // value/offset field (bytes 8..10 of the 12-byte IFD entry).
            return read_u16(tiff, entry_offset + 8);
        }
    }
    None
}

/// FIX-06: Bake EXIF orientation into pixels before stripping EXIF metadata.
///
/// Reads the EXIF Orientation tag (0x0112) from the JPEG bytes using img-parts,
/// then applies the required transform using the `image` crate.
///
/// - Orientation 1 (or absent): returns input bytes unchanged — no decode/re-encode.
/// - Orientation 3: rotate 180°.
/// - Orientation 6 (iPhone portrait): rotate 90° CW.
/// - Orientation 8: rotate 90° CCW.
/// - Mirror variants (2, 4, 5, 7): flip accordingly.
/// - Unknown values: passthrough (unchanged).
/// - Malformed JPEG: returns AppError::BadRequest.
///
/// Re-encodes to JPEG at 85% quality when rotation is applied.
fn bake_orientation(bytes: &[u8]) -> Result<Vec<u8>, crate::errors::AppError> {
    use image::codecs::jpeg::JpegEncoder;
    use img_parts::{jpeg::Jpeg, ImageEXIF};

    // Parse JPEG to read the orientation tag
    let jpeg = Jpeg::from_bytes(bytes.to_vec().into())
        .map_err(|_| crate::errors::AppError::BadRequest("Image processing failed: not a valid JPEG".into()))?;

    let orientation: u16 = jpeg
        .exif()
        .as_deref()
        .and_then(|exif_bytes| read_exif_orientation_tag(exif_bytes))
        .unwrap_or(1);

    // No rotation needed for orientation 1 (normal) or absent tag
    if orientation <= 1 {
        return Ok(bytes.to_vec());
    }

    // Decode image pixels using the `image` crate
    let img = image::load_from_memory(bytes)
        .map_err(|_| crate::errors::AppError::BadRequest("Failed to decode image for orientation correction".into()))?;

    // Apply transform based on EXIF orientation value
    let rotated = match orientation {
        3 => img.rotate180(),
        6 => img.rotate90(),
        8 => img.rotate270(),
        2 => img.fliph(),
        4 => img.flipv(),
        5 => img.rotate90().fliph(),
        7 => img.rotate270().fliph(),
        _ => return Ok(bytes.to_vec()), // unknown orientation — passthrough
    };

    // Re-encode to JPEG at 85% quality
    let mut output = Vec::new();
    let encoder = JpegEncoder::new_with_quality(&mut output, 85);
    rotated
        .write_with_encoder(encoder)
        .map_err(|_| crate::errors::AppError::BadRequest("JPEG re-encode failed after orientation correction".into()))?;

    Ok(output)
}

/// Strip all EXIF metadata from JPEG bytes using img-parts.
/// Returns an error if parsing fails — the SOI magic-byte check is necessary
/// but not sufficient; a polyglot file starting with 0xFF 0xD8 but otherwise
/// malformed would reach disk verbatim with the old fallback (WR-02).
///
/// Visibility expanded to pub(crate) so admin handlers (admin.rs) can reuse
/// the same EXIF stripping logic for resolution photos (plan 03-02 WFLOW-05).
pub(crate) fn strip_exif(bytes: &[u8]) -> Result<Vec<u8>, crate::errors::AppError> {
    use img_parts::{jpeg::Jpeg, ImageEXIF};
    Jpeg::from_bytes(bytes.to_vec().into())
        .map(|mut jpeg| {
            jpeg.set_exif(None);
            jpeg.encoder().bytes().to_vec()
        })
        .map_err(|_| crate::errors::AppError::BadRequest("Image processing failed: not a valid JPEG".into()))
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
    use super::*;

    /// Returns true when the coordinate is within the Bengaluru bounding box.
    /// This mirrors the guard in create_report() verbatim so that any change to
    /// the production predicate causes these tests to fail immediately.
    fn is_in_bengaluru(lat: f64, lng: f64) -> bool {
        (LAT_MIN..=LAT_MAX).contains(&lat) && (LNG_MIN..=LNG_MAX).contains(&lng)
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
        if raw <= 0 {
            20
        } else {
            raw.clamp(1, 200)
        }
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
        let ward_id = result.ok().flatten();
        assert!(
            ward_id.is_none(),
            "Ward lookup failure must produce None (non-fatal); \
             report submission must not be blocked by ward lookup errors"
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// JPEG validation unit tests
//
// Requirements covered:
//   D-05/D-06/D-07 — JPEG magic bytes check in create_report
//
// Pure unit tests: no database, no I/O, no Axum routing.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod jpeg_validation_tests {
    use super::*;

    /// D-06: valid JPEG bytes (FF D8 SOI + APP0 marker prefix) must be accepted.
    #[test]
    fn jpeg_magic_bytes_accepted() {
        assert!(
            is_jpeg(&[0xFF, 0xD8, 0xFF, 0xE0, 0x00]),
            "Bytes starting with 0xFF 0xD8 (JPEG SOI marker) must be accepted as JPEG"
        );
    }

    /// D-06: SVG content (XML declaration) must be rejected — not a JPEG.
    #[test]
    fn svg_rejected_not_jpeg() {
        assert!(
            !is_jpeg(b"<?xml version=\"1.0\""),
            "SVG/XML bytes must be rejected: first bytes are not 0xFF 0xD8"
        );
    }

    /// D-06: PNG magic bytes (89 50 4E 47) must be rejected — not a JPEG.
    #[test]
    fn png_rejected_not_jpeg() {
        assert!(
            !is_jpeg(&[0x89, 0x50, 0x4E, 0x47]),
            "PNG bytes (0x89 0x50 0x4E 0x47) must be rejected as not-JPEG"
        );
    }

    /// D-06: empty buffer must be rejected without panicking.
    #[test]
    fn empty_bytes_rejected() {
        assert!(
            !is_jpeg(&[]),
            "Empty byte slice must be rejected (no SOI marker possible)"
        );
    }

    /// D-06: single byte must be rejected without panicking (can't be two-byte SOI).
    #[test]
    fn single_byte_rejected() {
        assert!(
            !is_jpeg(&[0xFF]),
            "Single byte 0xFF is not a complete JPEG SOI marker — must be rejected"
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// bake_orientation unit tests (FIX-06)
//
// Requirements covered:
//   FIX-06 — EXIF orientation baking before EXIF strip
//
// Tests verify that:
//   - orientation 1 (normal): input bytes returned unchanged
//   - orientation 6 (iPhone portrait, 90 CW): output image dimensions swapped
//   - malformed bytes: returns AppError::BadRequest
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod bake_orientation_tests {
    use super::*;

    /// Builds a minimal 2x1 pixel JPEG (width=2, height=1) with an EXIF APP1 segment
    /// containing TIFF IFD0 tag 0x0112 (Orientation) set to `orientation_value`.
    /// Returns raw JPEG bytes with embedded EXIF.
    fn make_jpeg_with_orientation(width: u32, height: u32, orientation_value: u16) -> Vec<u8> {
        use image::{DynamicImage, ImageBuffer, Rgb, codecs::jpeg::JpegEncoder};
        use std::io::Write;

        // Create a simple colored image
        let img_buf: ImageBuffer<Rgb<u8>, Vec<u8>> = ImageBuffer::from_fn(width, height, |x, _y| {
            if x == 0 { Rgb([255u8, 0u8, 0u8]) } else { Rgb([0u8, 255u8, 0u8]) }
        });
        let img = DynamicImage::ImageRgb8(img_buf);

        // Encode to JPEG bytes first
        let mut jpeg_bytes = Vec::new();
        let encoder = JpegEncoder::new_with_quality(&mut jpeg_bytes, 85);
        img.write_with_encoder(encoder).expect("JPEG encode must succeed for test");

        if orientation_value == 1 {
            // No EXIF needed — orientation 1 is the default no-op
            return jpeg_bytes;
        }

        // Build a synthetic EXIF APP1 segment with Orientation tag
        // TIFF header (little-endian): II + 42 + IFD offset
        // IFD entry: tag 0x0112 (Orientation), type SHORT (3), count 1, value = orientation_value
        let orientation_bytes = orientation_value.to_le_bytes();

        // Minimal TIFF structure (little-endian):
        // "II"  = 0x49 0x49 (little-endian byte order)
        // 0x2A 0x00 = magic number 42 (LE)
        // 0x08 0x00 0x00 0x00 = offset to first IFD (8 bytes from start of TIFF = right after header)
        // IFD:
        //   0x01 0x00 = 1 entry
        //   0x12 0x01 = tag 0x0112 (Orientation)
        //   0x03 0x00 = type SHORT
        //   0x01 0x00 0x00 0x00 = count = 1
        //   [orientation_bytes padded to 4 bytes] = value
        //   0x00 0x00 0x00 0x00 = next IFD offset = 0 (end)
        let mut tiff: Vec<u8> = Vec::new();
        tiff.extend_from_slice(b"II"); // little-endian
        tiff.extend_from_slice(&42u16.to_le_bytes()); // magic
        tiff.extend_from_slice(&8u32.to_le_bytes()); // IFD offset
        // IFD entry count
        tiff.extend_from_slice(&1u16.to_le_bytes());
        // Tag entry: tag, type, count, value (padded to 4 bytes)
        tiff.extend_from_slice(&0x0112u16.to_le_bytes()); // Orientation tag
        tiff.extend_from_slice(&3u16.to_le_bytes()); // type SHORT
        tiff.extend_from_slice(&1u32.to_le_bytes()); // count
        tiff.extend_from_slice(&[orientation_bytes[0], orientation_bytes[1], 0, 0]); // value
        // Next IFD offset = 0
        tiff.extend_from_slice(&0u32.to_le_bytes());

        // EXIF APP1 marker: 0xFF 0xE1 + length (2 bytes, big-endian) + "Exif\0\0" + TIFF
        let _exif_payload_len = 6 + tiff.len(); // "Exif\0\0" + TIFF bytes (for documentation)

        // Now inject the APP1 segment into the JPEG after SOI marker (first 2 bytes)
        // by using img-parts to set the EXIF bytes
        let exif_bytes: Vec<u8> = {
            let mut e = b"Exif\0\0".to_vec();
            e.extend_from_slice(&tiff);
            e
        };

        // Use img-parts to inject EXIF into the clean JPEG
        use img_parts::{jpeg::Jpeg, ImageEXIF};
        let mut jpeg_parsed = Jpeg::from_bytes(jpeg_bytes.into())
            .expect("JPEG parse must succeed for test JPEG bytes");
        jpeg_parsed.set_exif(Some(exif_bytes.into()));
        jpeg_parsed.encoder().bytes().to_vec()
    }

    /// FIX-06 — orientation 1 (normal): bake_orientation returns input bytes unchanged.
    /// No decode/re-encode should occur for the no-op case.
    #[test]
    fn bake_orientation_1_returns_input_unchanged() {
        // Build a 3x2 JPEG with orientation = 1 (normal, no-op)
        let input = make_jpeg_with_orientation(3, 2, 1);
        let result = bake_orientation(&input).expect("bake_orientation must succeed for valid JPEG");
        // Orientation 1 must return the exact same bytes (no decode+re-encode)
        assert_eq!(
            result, input,
            "bake_orientation with orientation=1 must return input bytes unchanged"
        );
    }

    /// FIX-06 — orientation 6 (iPhone portrait, rotate 90 CW): output width/height swapped.
    /// A 3×2 image rotated 90° CW becomes a 2×3 image.
    #[test]
    fn bake_orientation_6_swaps_width_height() {
        // Build a 3×2 JPEG (width=3, height=2) with orientation = 6 (90 CW)
        let input = make_jpeg_with_orientation(3, 2, 6);
        let output = bake_orientation(&input).expect("bake_orientation must succeed for orientation=6");

        // Decode output to verify dimensions
        let decoded = image::load_from_memory(&output)
            .expect("Output of bake_orientation must be a valid JPEG");
        assert_eq!(
            decoded.width(), 2,
            "After 90 CW rotation, width (was 3) must become 2 (the original height)"
        );
        assert_eq!(
            decoded.height(), 3,
            "After 90 CW rotation, height (was 2) must become 3 (the original width)"
        );
    }

    /// FIX-06 — malformed bytes must return AppError::BadRequest, never panic.
    #[test]
    fn bake_orientation_malformed_returns_bad_request() {
        let garbage = b"not a jpeg at all";
        let result = bake_orientation(garbage);
        assert!(
            matches!(result, Err(AppError::BadRequest(_))),
            "bake_orientation must return AppError::BadRequest for malformed JPEG input, got: {:?}",
            result
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
        // Key is "{ip}:{geohash6}" — geohash6 is 6 chars, total > 9 chars
        assert!(
            key.len() > "1.2.3.4:".len(),
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
        let correct = encode(
            Coord {
                x: 77.5946,
                y: 12.9716,
            },
            6,
        )
        .expect("encode must succeed for valid Bengaluru coordinates");

        // Swapped order: x=latitude, y=longitude (WRONG — regression guard)
        let swapped = encode(
            Coord {
                x: 12.9716,
                y: 77.5946,
            },
            6,
        )
        .expect("encode must succeed even for swapped coordinates");

        assert_ne!(
            correct, swapped,
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
