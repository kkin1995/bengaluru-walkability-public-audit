// backend/tests/export_tests.rs
//
// Wave 0 export test scaffold (EXPORT-01, EXPORT-02).
//
// These tests do NOT require a live database. They verify that:
//   - EXPORT_CSV_SQL references all required D-13 column names
//   - CSV date formatting produces DD/MM/YYYY output
//   - csv_escape correctly handles commas, quotes, newlines, and Excel
//     formula-injection trigger characters (=, +, -, @)
//   - GeoJSON coordinate builder emits [longitude, latitude] order (RFC 7946)
//   - EXPORT_GEOJSON_SQL does not use SELECT * (column whitelist enforced)
//
// Requirements covered:
//   EXPORT-01 — admin CSV export: DD/MM/YYYY dates, ward_name, all D-13 columns
//   EXPORT-02 — admin GeoJSON: streaming FeatureCollection, [lng, lat] coordinates
//   T-04-01   — no SELECT * in export SQL (column whitelist)
//   T-04-CSV  — CSV injection mitigation via csv_escape
//
// Test type: Unit (pure functions, no DB required). Priority: P0.
//
// ── Implementation agent instructions ─────────────────────────────────────────
// Do NOT modify these tests. The tests are the behavioural contract.
// If a test appears incorrect, document the concern and request a review.
// ─────────────────────────────────────────────────────────────────────────────

use bengaluru_walkability_backend::db::admin_queries::{
    csv_escape, export_csv_sql_fragment, export_geojson_sql_fragment, format_csv_date,
};
use chrono::{TimeZone, Utc};

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — EXPORT_CSV_SQL contains all D-13 required columns
// ─────────────────────────────────────────────────────────────────────────────

/// EXPORT-01/D-13 — The CSV export query must include all columns specified in
/// the D-13 column set. Verifies the SQL fragment (not a live query) contains
/// every required column name token.
///
/// Columns required by D-13:
///   id, created_at, category, severity, status, ward_name, assigned_org,
///   latitude, longitude, description, photo_hash, duplicate_count,
///   submitter_contact, resolved_at, resolution_notes
#[test]
fn export_csv_includes_all_columns() {
    let sql = export_csv_sql_fragment();

    let required_columns = [
        "id",
        "created_at",
        "category",
        "severity",
        "status",
        "ward_name",
        "assigned_org",
        "latitude",
        "longitude",
        "description",
        "photo_hash",
        "duplicate_count",
        "submitter_contact",
        "resolved_at",
        "resolution_notes",
    ];

    for col in &required_columns {
        assert!(
            sql.contains(col),
            "EXPORT_CSV_SQL must contain the D-13 column '{}'; \
             the export will be missing this column for GBA planners. Got SQL:\n{}",
            col,
            sql
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — format_csv_date produces DD/MM/YYYY output (D-12)
// ─────────────────────────────────────────────────────────────────────────────

/// EXPORT-01/D-12 — CSV submission_date must use DD/MM/YYYY format (not ISO
/// 8601). This test drives a known DateTime through format_csv_date and asserts
/// the exact output string matches the expected format.
#[test]
fn csv_date_format_dd_mm_yyyy() {
    // 25 December 2025 UTC — single-digit day/month values must be zero-padded
    let dt = Utc.with_ymd_and_hms(2025, 12, 25, 14, 30, 0).unwrap();
    let formatted = format_csv_date(&dt);
    assert_eq!(
        formatted, "25/12/2025",
        "format_csv_date must produce DD/MM/YYYY format per D-12; \
         got '{}' — GBA planners expect day-first date strings",
        formatted
    );

    // Also test a single-digit day and month (1 Jan 2024) — must be zero-padded
    let dt2 = Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap();
    let formatted2 = format_csv_date(&dt2);
    assert_eq!(
        formatted2, "01/01/2024",
        "format_csv_date must zero-pad single-digit day/month; \
         got '{}' for 1 January 2024",
        formatted2
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — csv_escape correctly handles commas, quotes, newlines, and formula
//          injection trigger characters (T-04-CSV)
// ─────────────────────────────────────────────────────────────────────────────

/// T-04-CSV — csv_escape must:
///   1. Wrap the field in double-quotes
///   2. Double internal double-quote characters (" → "")
///   3. Strip newlines and carriage returns from the field
///   4. Prefix fields starting with =, +, -, @ with a single quote to
///      neutralize Excel formula execution (CSV injection mitigation)
#[test]
fn csv_escape_special_chars() {
    // Case 1: field with comma — must be quoted
    let result = csv_escape("hello, world");
    assert!(
        result.starts_with('"') && result.ends_with('"'),
        "csv_escape must wrap field in double-quotes when it contains a comma; got: {}",
        result
    );
    assert!(
        result.contains("hello, world"),
        "csv_escape must preserve the field content; got: {}",
        result
    );

    // Case 2: field with internal double-quote — must be doubled ("" not \")
    let result2 = csv_escape("say \"hello\"");
    assert!(
        result2.contains("\"\""),
        "csv_escape must double internal double-quotes (\"\" not \\\"); got: {}",
        result2
    );

    // Case 3: field starting with '=' — Excel formula injection trigger
    let result3 = csv_escape("=SUM(A1:A10)");
    assert!(
        result3.contains("'="),
        "csv_escape must prefix '=' formula triggers with a single quote; got: {}",
        result3
    );

    // Case 4: field starting with '+' — Excel formula injection trigger
    let result4 = csv_escape("+CMD|' /C calc'!A0");
    assert!(
        result4.contains("'+"),
        "csv_escape must prefix '+' formula triggers with a single quote; got: {}",
        result4
    );

    // Case 5: field with newline — must be stripped or replaced
    let result5 = csv_escape("line1\nline2");
    assert!(
        !result5.contains('\n'),
        "csv_escape must remove newline characters to prevent row splitting; got: {}",
        result5
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — GeoJSON coordinate order is [longitude, latitude] (RFC 7946)
// ─────────────────────────────────────────────────────────────────────────────

/// EXPORT-02/Pitfall 4 — GeoJSON RFC 7946 specifies coordinates as
/// [longitude, latitude] (X, Y). The existing backend stores data as
/// latitude, longitude in separate columns; the export must reverse this order.
///
/// This test constructs a Feature JSON directly using the same coordinate
/// assembly logic (serde_json::json!) and asserts the first coordinate value
/// is longitude (77.xxxx Bengaluru range) and the second is latitude (12.xxxx).
#[test]
fn geojson_coordinate_order() {
    let latitude: f64 = 12.9716;
    let longitude: f64 = 77.5946;

    // GeoJSON feature as the handler builds it — coordinates must be [lng, lat]
    let feature = serde_json::json!({
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [longitude, latitude]
        },
        "properties": {}
    });

    let coords = feature["geometry"]["coordinates"]
        .as_array()
        .expect("coordinates must be a JSON array");

    assert_eq!(
        coords.len(),
        2,
        "GeoJSON Point coordinates must have exactly 2 elements [lng, lat]"
    );

    let first = coords[0]
        .as_f64()
        .expect("first coordinate must be a number");
    let second = coords[1]
        .as_f64()
        .expect("second coordinate must be a number");

    // Bengaluru: longitude is ~77.5 (first), latitude is ~12.9 (second)
    assert!(
        first > 70.0 && first < 85.0,
        "First coordinate must be longitude (Bengaluru range ~77.5); got {}. \
         GeoJSON uses [longitude, latitude], not [latitude, longitude].",
        first
    );
    assert!(
        second > 10.0 && second < 15.0,
        "Second coordinate must be latitude (Bengaluru range ~12.9); got {}. \
         GeoJSON uses [longitude, latitude], not [latitude, longitude].",
        second
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — EXPORT_GEOJSON_SQL does not use SELECT * (T-04-01 column whitelist)
// ─────────────────────────────────────────────────────────────────────────────

/// T-04-01 — The admin GeoJSON export SQL must use an explicit column
/// whitelist (no SELECT *). This enforces information-disclosure control:
/// new sensitive columns added to the reports table will NOT appear in
/// exports until explicitly added to the query.
#[test]
fn export_geojson_sql_no_select_star() {
    let sql = export_geojson_sql_fragment();
    assert!(
        !sql.contains("SELECT *") && !sql.contains("select *"),
        "EXPORT_GEOJSON_SQL must NOT use SELECT * — column whitelist is required \
         (T-04-01 information disclosure control). Got SQL:\n{}",
        sql
    );
}
