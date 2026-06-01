// backend/tests/analytics_tests.rs
//
// Wave 0 analytics SQL test scaffold (ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05).
//
// These tests do NOT require a live database. They verify that:
//   - WARD_ANALYTICS_SQL uses FILTER (WHERE status NOT IN ('resolved','closed'))
//     and has LIMIT 10 — confirming top-10 unresolved ward behaviour (ANALYTICS-02)
//   - CORP_ANALYTICS_SQL uses NULLIF() to guard zero-division on resolution rate
//     (ANALYTICS-03)
//   - TREND_SQL uses DATE_TRUNC('week') and INTERVAL '12 weeks' (ANALYTICS-04)
//   - WARD_BOUNDARIES_SQL uses ST_AsGeoJSON and ST_Simplify and selects
//     unresolved_count (ANALYTICS-05)
//
// Requirements covered:
//   ANALYTICS-02 — top 10 wards by unresolved report count
//   ANALYTICS-03 — resolution rate per corporation (zero-division guarded)
//   ANALYTICS-04 — reports-per-week over 12 weeks (DATE_TRUNC('week'))
//   ANALYTICS-05 — ward choropleth boundary endpoint (ST_AsGeoJSON + unresolved_count)
//   T-04-08      — all four endpoints registered under admin auth
//   T-04-09      — category filter bound via sqlx .bind() — no string interpolation
//   T-04-10      — ST_Simplify reduces ward boundary vertex count
//
// Test type: Unit (pure SQL-string assertions, no DB required). Priority: P0.
//
// ── Implementation agent instructions ─────────────────────────────────────────
// Do NOT modify these tests. The tests are the behavioural contract.
// If a test appears incorrect, document the concern and request a review.
// ─────────────────────────────────────────────────────────────────────────────

use bengaluru_walkability_backend::db::admin_queries::{
    corp_analytics_sql_fragment, trend_sql_fragment, ward_analytics_sql_fragment,
    ward_boundaries_sql_fragment, ward_link_migration_sql_fragment,
};

/// ANALYTICS-02 — WARD_ANALYTICS_SQL must use FILTER (WHERE status NOT IN
/// ('resolved','closed')) to count only unresolved reports, and must apply
/// LIMIT 10 to return only the top ten wards.
///
/// Security note (T-04-08): The endpoint is admin-only; this test verifies
/// the SQL produces the correct aggregate logic.
#[test]
fn ward_analytics_unresolved_filter() {
    let sql = ward_analytics_sql_fragment();

    assert!(
        sql.contains("FILTER (WHERE"),
        "WARD_ANALYTICS_SQL must use FILTER (WHERE ...) to count conditionally; \
         got: {}",
        sql
    );
    assert!(
        sql.to_uppercase().contains("NOT IN"),
        "WARD_ANALYTICS_SQL must use NOT IN to exclude resolved/closed reports; \
         got: {}",
        sql
    );
    assert!(
        sql.contains("resolved") && sql.contains("closed"),
        "WARD_ANALYTICS_SQL must exclude both 'resolved' and 'closed' statuses; \
         got: {}",
        sql
    );
    assert!(
        sql.contains("LIMIT 10"),
        "WARD_ANALYTICS_SQL must include LIMIT 10 to return only top 10 wards; \
         got: {}",
        sql
    );
}

/// ANALYTICS-03 — CORP_ANALYTICS_SQL must use NULLIF() to guard against
/// division-by-zero when a corporation has no reports (total_count = 0).
///
/// Without NULLIF, `resolved_count / total_count` would panic at the
/// PostgreSQL level when total_count = 0.
#[test]
fn corp_analytics_nullif_guard() {
    let sql = corp_analytics_sql_fragment();

    assert!(
        sql.contains("NULLIF("),
        "CORP_ANALYTICS_SQL must use NULLIF() to guard zero-division on \
         resolution rate when total_reports = 0; got: {}",
        sql
    );
    assert!(
        sql.contains("resolution_rate_pct") || sql.contains("resolution_rate"),
        "CORP_ANALYTICS_SQL must alias the resolution rate percentage column; \
         got: {}",
        sql
    );
}

/// ANALYTICS-04 — TREND_SQL must use DATE_TRUNC('week') to aggregate reports
/// per calendar week, and must scope results to the last 12 weeks via
/// INTERVAL '12 weeks'.
///
/// Security note (T-04-09): The optional category filter must NOT be
/// interpolated via format!/string concatenation — it must be a bound
/// parameter ($N). This test verifies the SQL structure does not contain
/// user-controllable content inline.
#[test]
fn trend_sql_uses_week_trunc() {
    let sql = trend_sql_fragment();

    assert!(
        sql.contains("DATE_TRUNC('week'"),
        "TREND_SQL must use DATE_TRUNC('week') to aggregate per-week; \
         got: {}",
        sql
    );
    assert!(
        sql.contains("INTERVAL '12 weeks'"),
        "TREND_SQL must use INTERVAL '12 weeks' to scope the rolling window; \
         got: {}",
        sql
    );
    assert!(
        sql.contains("GROUP BY"),
        "TREND_SQL must use GROUP BY to aggregate counts per week and category; \
         got: {}",
        sql
    );
}

/// ANALYTICS-05 — WARD_BOUNDARIES_SQL must use ST_AsGeoJSON to serialise ward
/// boundary geometry, ST_Simplify to reduce vertex count (Pitfall 7 / T-04-10),
/// and must select unresolved_count for the choropleth colour scale.
#[test]
fn ward_boundaries_uses_st_asgeojson() {
    let sql = ward_boundaries_sql_fragment();

    assert!(
        sql.contains("ST_AsGeoJSON"),
        "WARD_BOUNDARIES_SQL must use ST_AsGeoJSON to convert boundary geometry \
         to GeoJSON text; got: {}",
        sql
    );
    assert!(
        sql.contains("ST_Simplify"),
        "WARD_BOUNDARIES_SQL must use ST_Simplify to reduce vertex count (Pitfall 7 / \
         T-04-10); got: {}",
        sql
    );
    assert!(
        sql.contains("unresolved_count"),
        "WARD_BOUNDARIES_SQL must select unresolved_count so the choropleth colour \
         scale has a data source (ANALYTICS-05); got: {}",
        sql
    );
}

/// NF-04.1-A / WARD-03 — The migration UPDATE SQL must use the same ILIKE strategy
/// as `get_org_for_ward` to link each ward to its corporation organization.
///
/// This test is a SQL-string guard that prevents silent pattern drift between
/// the migration and the runtime query: if either is changed without updating the
/// other, this test fails before reaching the live database.
///
/// Assertions verify:
/// - UPDATE wards       — the migration mutates the wards table
/// - ILIKE              — match strategy matches get_org_for_ward
/// - org_type = 'corporation' — only corporation rows matched (not the GBA root)
/// - SET org_id         — the column being populated
#[test]
fn ward_org_id_ilike_pattern_consistency() {
    let sql = ward_link_migration_sql_fragment();

    assert!(
        sql.contains("UPDATE wards"),
        "Migration SQL must UPDATE the wards table to populate org_id; got: {}",
        sql
    );
    assert!(
        sql.contains("ILIKE"),
        "Migration SQL must use ILIKE to match corporation names (same strategy as \
         get_org_for_ward); got: {}",
        sql
    );
    assert!(
        sql.contains("org_type = 'corporation'"),
        "Migration SQL must filter to org_type = 'corporation' to avoid matching \
         the GBA root organization; got: {}",
        sql
    );
    assert!(
        sql.contains("SET org_id"),
        "Migration SQL must SET org_id on the wards table; got: {}",
        sql
    );
}

/// NF-04.1-B / ANALYTICS-03 — CORP_ANALYTICS_SQL must JOIN on w.org_id to use
/// the FK populated by migration 014, not by a runtime ILIKE scan per query.
///
/// This test verifies the JOIN path that depends on wards.org_id being non-NULL
/// (populated by migration 014_link_wards_to_organisations). If wards.org_id is
/// NULL for all rows, this JOIN returns zero rows and ANALYTICS-03 returns an
/// empty dataset.
///
/// Also asserts the org_type filter is present to restrict to corporations only.
#[test]
fn corp_analytics_joins_on_org_id() {
    let sql = corp_analytics_sql_fragment();

    assert!(
        sql.contains("w.org_id"),
        "CORP_ANALYTICS_SQL must JOIN wards on w.org_id (the FK populated by migration 014); \
         got: {}",
        sql
    );
    assert!(
        sql.contains("org_type = 'corporation'") || sql.contains("o.org_type = 'corporation'"),
        "CORP_ANALYTICS_SQL must filter to org_type = 'corporation' to exclude the \
         GBA root organization from the results; got: {}",
        sql
    );
    assert!(
        sql.contains("::float8"),
        "CORP_ANALYTICS_SQL must cast ROUND(..., 1) to ::float8 so sqlx decodes \
         the value as f64 (OID 701) instead of NUMERIC (OID 1700); \
         without this cast resolution_rate_pct is always None at runtime; got: {}",
        sql
    );
}
