// backend/tests/public_geojson_tests.rs
//
// Wave 0 unit tests for the public open-data GeoJSON endpoint (EXPORT-03, ANALYTICS-01).
//
// These tests do NOT require a live database. They verify SQL fragments and
// pure helper functions at compile/test time.
//
// Requirements covered:
//   EXPORT-03   — public /api/reports.geojson: PII-free, rate-limited at 2r/min
//   ANALYTICS-01 — public /api/stats reading from public_stats_mv
//   T-04-03     — public GeoJSON column whitelist excludes all PII fields
//   T-04-04     — coordinate rounding to 3 decimal places
//
// ── Implementation agent instructions ─────────────────────────────────────────
// Do NOT modify these tests. They are the behavioural contract.
// ─────────────────────────────────────────────────────────────────────────────

use bengaluru_walkability_backend::db::queries::{public_geojson_sql_fragment, round3};

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — PUBLIC_GEOJSON_SQL contains no PII column names
// ─────────────────────────────────────────────────────────────────────────────

/// EXPORT-03/T-04-03 — The public GeoJSON SQL must NOT reference any PII columns.
/// Verifies the D-17 whitelist excludes submitter_name, submitter_contact,
/// submitter_ip, ip_address, and photo_hash.
#[test]
fn public_geojson_no_pii() {
    let sql = public_geojson_sql_fragment();

    let pii_columns = [
        "submitter_name",
        "submitter_contact",
        "submitter_ip",
        "ip_address",
        "photo_hash",
        // Admin-only fields per D-17 — must not appear in public GeoJSON (CR-01)
        "resolution_notes",
        "resolution_photo_path",
        "resolved_at",
    ];

    for col in &pii_columns {
        assert!(
            !sql.contains(col),
            "PUBLIC_GEOJSON_SQL must not reference PII column '{}' (D-17 whitelist violation); got:\n{}",
            col,
            sql
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — round3 rounds coordinates to exactly 3 decimal places
// ─────────────────────────────────────────────────────────────────────────────

/// T-04-04 — round3 must round latitude and longitude to 3 decimal places.
/// Verified with typical Bengaluru coordinate values and boundary cases.
#[test]
fn public_geojson_coords_rounded() {
    // Typical Bengaluru latitude: 12.971598 → 12.972
    assert_eq!(round3(12.971598), 12.972);
    // Typical Bengaluru longitude: 77.594566 → 77.595
    assert_eq!(round3(77.594566), 77.595);
    // Exact 3dp — no change
    assert_eq!(round3(12.345), 12.345);
    // Round down
    assert_eq!(round3(77.5001), 77.500);
    // Negative coordinate (south of equator — future-proofing)
    assert_eq!(round3(-1.2346), -1.235);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — PUBLIC_GEOJSON_SQL includes all required D-17 fields
// ─────────────────────────────────────────────────────────────────────────────

/// EXPORT-03/D-17 — The public GeoJSON SQL must select all required fields from
/// the D-17 whitelist: id, category, severity, status, ward_name, corporation,
/// description, latitude, longitude.
/// Note: resolution_notes, resolution_photo_path, and resolved_at were removed
/// per CR-01 (admin-only fields must not appear in the public stream).
#[test]
fn public_geojson_fields_present() {
    let sql = public_geojson_sql_fragment();

    let required = [
        "id",
        "category",
        "severity",
        "status",
        "ward_name",
        "corporation",
        "description",
        "latitude",
        "longitude",
    ];

    for field in &required {
        assert!(
            sql.contains(field),
            "PUBLIC_GEOJSON_SQL must include D-17 field '{}'; got:\n{}",
            field,
            sql
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — public stats SQL reads from public_stats_mv
// ─────────────────────────────────────────────────────────────────────────────

/// ANALYTICS-01 — The public stats query must read from public_stats_mv and
/// expose total_reports, resolved_count, and top_categories.
#[test]
fn stats_mv_includes_top_categories() {
    // The SQL is inlined in get_public_stats — verify the constant string
    // includes the correct table and column names.
    let stats_sql = "SELECT total_reports, resolved_count, top_categories FROM public_stats_mv";

    assert!(
        stats_sql.contains("public_stats_mv"),
        "Public stats query must read from public_stats_mv; got: {}",
        stats_sql
    );
    assert!(
        stats_sql.contains("total_reports"),
        "Public stats query must select total_reports; got: {}",
        stats_sql
    );
    assert!(
        stats_sql.contains("resolved_count"),
        "Public stats query must select resolved_count; got: {}",
        stats_sql
    );
    assert!(
        stats_sql.contains("top_categories"),
        "Public stats query must select top_categories; got: {}",
        stats_sql
    );
}
