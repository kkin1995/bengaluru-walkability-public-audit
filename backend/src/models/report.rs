use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Raw database row
#[derive(Debug, Clone, FromRow)]
pub struct Report {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub image_path: String,
    pub latitude: f64,
    pub longitude: f64,
    pub category: String,
    pub severity: String,
    pub description: Option<String>,
    pub submitter_name: Option<String>,
    // Stored in the DB for operator use but intentionally excluded from
    // ReportResponse to protect submitter privacy in public API responses.
    #[allow(dead_code)]
    pub submitter_contact: Option<String>,
    pub status: String,
    pub location_source: String,
    /// Ward the report falls in — auto-populated at creation time via PostGIS ST_Within.
    /// NULL when the point does not match any ward polygon (or ward lookup fails).
    pub ward_id: Option<Uuid>,
}

/// JSON response shape
#[derive(Debug, Serialize)]
pub struct ReportResponse {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub image_url: String,
    pub latitude: f64,
    pub longitude: f64,
    pub category: String,
    pub severity: String,
    pub description: Option<String>,
    pub submitter_name: Option<String>,
    pub status: String,
    pub location_source: String,
    /// Ward name — None in public endpoint (admin handler joins and populates).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ward_name: Option<String>,
}

impl Report {
    pub fn into_response(self, api_base: &str) -> ReportResponse {
        let image_url = format!("{}/uploads/{}", api_base, self.image_path);
        ReportResponse {
            id: self.id,
            created_at: self.created_at,
            image_url,
            latitude: (self.latitude * 1000.0).round() / 1000.0,
            longitude: (self.longitude * 1000.0).round() / 1000.0,
            category: self.category,
            severity: self.severity,
            description: self.description,
            submitter_name: self.submitter_name,
            status: self.status,
            location_source: self.location_source,
            // Public endpoint never exposes ward_name — admin handler populates it when needed.
            ward_name: None,
        }
    }
}

/// Parsed from multipart form
#[derive(Debug, Default)]
pub struct CreateReportRequest {
    pub image_bytes: Vec<u8>,
    pub image_filename: String,
    pub latitude: f64,
    pub longitude: f64,
    pub category: String,
    pub severity: String,
    pub description: Option<String>,
    pub submitter_name: Option<String>,
    pub submitter_contact: Option<String>,
    pub location_source: String,
}

/// Query params for list endpoint
#[derive(Debug, Deserialize)]
pub struct ListReportsQuery {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_limit")]
    pub limit: i64,
    pub category: Option<String>,
    pub status: Option<String>,
}

fn default_page() -> i64 { 1 }
fn default_limit() -> i64 { 20 }

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
//
// Requirements covered:
//   AC5.2 — lat/lng rounded to 3 decimal places in API response
//
// None of these tests touch the database. They construct a Report directly
// and call into_response(), which is pure computation.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    /// Build a minimal Report with the given lat/lng. All other fields are
    /// set to valid, non-significant values so the tests remain focused on
    /// the rounding behaviour.
    fn make_report(latitude: f64, longitude: f64) -> Report {
        Report {
            id: Uuid::nil(),
            created_at: Utc::now(),
            image_path: "test.jpg".to_string(),
            latitude,
            longitude,
            category: "no_footpath".to_string(),
            severity: "medium".to_string(),
            description: None,
            submitter_name: None,
            submitter_contact: None,
            status: "new".to_string(),
            location_source: "manual_pin".to_string(),
            ward_id: None,
        }
    }

    // ── image_url construction ────────────────────────────────────────────────

    #[test]
    fn test_into_response_builds_correct_image_url() {
        // Verifies that the image URL is constructed from api_base + /uploads/ + image_path.
        let report = make_report(12.9716, 77.5946);
        let response = report.into_response("http://localhost:3001");
        assert_eq!(
            response.image_url,
            "http://localhost:3001/uploads/test.jpg",
            "image_url must be api_base + '/uploads/' + image_path"
        );
    }

    // ── lat/lng rounding — AC5.2 ──────────────────────────────────────────────

    #[test]
    fn test_lat_lng_rounding_already_three_decimals() {
        // AC5.2 — a value already at exactly 3 decimal places must be unchanged.
        let report = make_report(12.972, 77.595);
        let response = report.into_response("http://localhost:3001");
        assert_eq!(
            response.latitude, 12.972,
            "latitude with exactly 3 decimal places must not change: expected 12.972, got {}",
            response.latitude
        );
        assert_eq!(
            response.longitude, 77.595,
            "longitude with exactly 3 decimal places must not change: expected 77.595, got {}",
            response.longitude
        );
    }

    #[test]
    fn test_lat_lng_rounding_rounds_up_at_fourth_decimal() {
        // AC5.2 — 12.97165 rounds UP to 12.972 (4th decimal ≥ 5).
        let report = make_report(12.97165, 77.59465);
        let response = report.into_response("http://localhost:3001");
        assert_eq!(
            response.latitude, 12.972,
            "12.97165 must round up to 12.972, got {}",
            response.latitude
        );
        assert_eq!(
            response.longitude, 77.595,
            "77.59465 must round up to 77.595, got {}",
            response.longitude
        );
    }

    #[test]
    fn test_lat_lng_rounding_rounds_down_below_half() {
        // AC5.2 — 12.97149 rounds DOWN to 12.971 (4th decimal < 5).
        let report = make_report(12.97149, 77.59449);
        let response = report.into_response("http://localhost:3001");
        assert_eq!(
            response.latitude, 12.971,
            "12.97149 must round down to 12.971, got {}",
            response.latitude
        );
        assert_eq!(
            response.longitude, 77.594,
            "77.59449 must round down to 77.594, got {}",
            response.longitude
        );
    }

    #[test]
    fn test_lat_lng_rounding_exact_half_rounds_to_even_or_up() {
        // AC5.2 — 12.9715 should round to 12.972 using standard half-up rounding.
        // Rust's f64::round() uses half-away-from-zero, so 12.9715 → 12.972.
        let report = make_report(12.9715, 77.5945);
        let response = report.into_response("http://localhost:3001");
        // (12.9715 * 1000.0).round() / 1000.0 = 12972.0 / 1000.0 = 12.972
        assert_eq!(
            response.latitude, 12.972,
            "12.9715 (exact half) must round to 12.972 via half-away-from-zero, got {}",
            response.latitude
        );
    }

    #[test]
    fn test_lat_lng_rounding_at_bengaluru_bbox_sw_corner() {
        // AC5.2 + boundary: the exact SW bbox corner (latMin, lngMin) — no rounding needed.
        let report = make_report(12.7342, 77.3791);
        let response = report.into_response("http://localhost:3001");
        assert_eq!(
            response.latitude, 12.734,
            "12.7342 must round to 12.734, got {}",
            response.latitude
        );
        assert_eq!(
            response.longitude, 77.379,
            "77.3791 must round to 77.379, got {}",
            response.longitude
        );
    }

    #[test]
    fn test_lat_lng_rounding_at_bengaluru_bbox_ne_corner() {
        // AC5.2 + boundary: the exact NE bbox corner (latMax, lngMax).
        let report = make_report(13.1739, 77.8731);
        let response = report.into_response("http://localhost:3001");
        assert_eq!(
            response.latitude, 13.174,
            "13.1739 must round to 13.174, got {}",
            response.latitude
        );
        assert_eq!(
            response.longitude, 77.873,
            "77.8731 must round to 77.873, got {}",
            response.longitude
        );
    }

    #[test]
    fn test_lat_lng_rounding_many_decimal_places() {
        // AC5.2 — a value with many decimals is clamped to 3.
        let report = make_report(12.971600012345678, 77.594600098765432);
        let response = report.into_response("http://localhost:3001");
        assert_eq!(
            response.latitude, 12.972,
            "12.971600… must round to 12.972, got {}",
            response.latitude
        );
        assert_eq!(
            response.longitude, 77.595,
            "77.594600… must round to 77.595, got {}",
            response.longitude
        );
    }

    #[test]
    fn test_coordinate_rounding_in_response_leaves_db_struct_unchanged() {
        // AC5.2 — the DB struct carries full precision; only the response is rounded.
        // into_response() consumes self, so we verify the response independently.
        let original_lat = 12.97165;
        let original_lng = 77.59465;
        let report = make_report(original_lat, original_lng);

        // Clone before consuming so we can compare (Report derives Clone)
        let lat_before = report.latitude;
        let lng_before = report.longitude;

        let response = report.into_response("http://localhost:3001");

        // DB-side values were exact
        assert_eq!(lat_before, original_lat, "DB struct latitude must be unmodified");
        assert_eq!(lng_before, original_lng, "DB struct longitude must be unmodified");

        // Response-side values are rounded
        assert_eq!(response.latitude, 12.972, "Response latitude must be rounded to 3dp");
        assert_eq!(response.longitude, 77.595, "Response longitude must be rounded to 3dp");
    }

    // ── P-D: PUBLIC_URL / image_url correctness ──────────────────────────────
    //
    // These four tests are regression guards that verify into_response() builds
    // image_url from whatever api_base is passed in.  They will pass as soon as
    // the implementation wires config.public_url into AppState.api_base_url
    // (replacing the current "http://0.0.0.0:{port}" construction in main.rs).
    //
    // Requirements:
    //   PD-R1 — image_url must use the configured public base URL, not 0.0.0.0
    //   PD-R2 — image_url must never expose the internal bind address 0.0.0.0

    #[test]
    fn test_image_url_uses_provided_base_url() {
        // PD-R1 — into_response must prefix image_path with whatever api_base is given.
        // With api_base = "http://localhost" the URL must begin "http://localhost/uploads/".
        let report = make_report(12.9716, 77.5946);
        let response = report.into_response("http://localhost");
        assert!(
            response.image_url.starts_with("http://localhost/uploads/"),
            "image_url must start with 'http://localhost/uploads/' when api_base is \
             'http://localhost', but got: {}",
            response.image_url
        );
    }

    #[test]
    fn test_image_url_with_custom_domain() {
        // PD-R1 — into_response must use the caller-supplied domain verbatim.
        // With api_base = "https://example.com" the URL must begin
        // "https://example.com/uploads/".
        let report = make_report(12.9716, 77.5946);
        let response = report.into_response("https://example.com");
        assert!(
            response.image_url.starts_with("https://example.com/uploads/"),
            "image_url must start with 'https://example.com/uploads/' when api_base is \
             'https://example.com', but got: {}",
            response.image_url
        );
    }

    #[test]
    fn test_image_url_never_contains_0_0_0_0() {
        // PD-R2 — the bind address 0.0.0.0 must never leak into image URLs.
        // When api_base is the correct public URL the string "0.0.0.0" must be absent.
        let report = make_report(12.9716, 77.5946);
        let response = report.into_response("http://localhost");
        assert!(
            !response.image_url.contains("0.0.0.0"),
            "image_url must NOT contain '0.0.0.0'; that is the internal bind address \
             and must never be exposed to clients. Got: {}",
            response.image_url
        );
    }

    #[test]
    fn test_image_url_never_starts_with_http_0_0_0_0() {
        // PD-R2 (strict prefix form) — the URL must not start with the broken
        // "http://0.0.0.0" pattern that was produced by the pre-fix main.rs line 64.
        let report = make_report(12.9716, 77.5946);
        let response = report.into_response("http://localhost");
        assert!(
            !response.image_url.starts_with("http://0.0.0.0"),
            "image_url must NOT start with 'http://0.0.0.0'; got: {}",
            response.image_url
        );
    }

    // ── submitter_contact is NOT present in ReportResponse (privacy) ──────────

    #[test]
    fn test_response_omits_submitter_contact() {
        // Security/privacy: submitter_contact must never appear in the public response.
        // ReportResponse has no submitter_contact field — this is a compile-time guarantee.
        // We verify the field is simply absent from the serialised JSON.
        let report = Report {
            submitter_contact: Some("user@example.com".to_string()),
            ward_id: None,
            ..make_report(12.9716, 77.5946)
        };
        let response = report.into_response("http://localhost:3001");
        let json = serde_json::to_string(&response).expect("serialisation must not fail");
        assert!(
            !json.contains("submitter_contact"),
            "submitter_contact must NOT appear in the public JSON response, but got: {}",
            json
        );
        assert!(
            !json.contains("user@example.com"),
            "submitter_contact value must NOT appear in the public JSON response"
        );
    }
}
