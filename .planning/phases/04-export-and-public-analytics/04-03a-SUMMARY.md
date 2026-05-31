---
phase: 04-export-and-public-analytics
plan: 03a
subsystem: backend/analytics
tags: [analytics, geojson, choropleth, ward-boundaries, tdd, admin-only]
dependency_graph:
  requires:
    - backend/src/db/admin_queries.rs (INTAKE_SQL pattern — 04-01/04-02)
    - backend/src/handlers/admin.rs (admin_get_intake_stats pattern)
    - backend/src/main.rs (admin_protected_router with require_auth)
  provides:
    - backend/src/db/admin_queries.rs (WARD_ANALYTICS_SQL, CORP_ANALYTICS_SQL,
        TREND_SQL, TREND_SQL_FILTERED, WARD_BOUNDARIES_SQL constants; get_ward_analytics,
        get_corporation_analytics, get_trend_data, get_ward_boundaries query fns;
        ward_analytics_sql_fragment, corp_analytics_sql_fragment, trend_sql_fragment,
        ward_boundaries_sql_fragment test-only helpers)
    - backend/src/handlers/admin.rs (admin_get_ward_analytics, admin_get_corporation_analytics,
        admin_get_trend_data, admin_get_wards_boundaries handlers)
    - backend/src/main.rs (four routes registered under admin_protected_router)
    - backend/tests/analytics_tests.rs (Wave 0 SQL-string tests — all GREEN)
  affects:
    - 04-03b (frontend analytics page consumes these four endpoints)
tech_stack:
  added: []
  patterns:
    - const SQL string + pub fn fragment() test hook (Wave 0 TDD, no live DB)
    - FILTER (WHERE r.status NOT IN ...) aggregate filter pattern
    - NULLIF() zero-division guard on resolution rate
    - DATE_TRUNC('week') weekly aggregation over INTERVAL '12 weeks'
    - ST_AsGeoJSON(ST_Simplify(boundary::geometry, 0.001)) for choropleth geometry
    - GeoJSON FeatureCollection assembly from DB rows in handler (admin_get_wards_boundaries)
    - Bound parameter category filter ($1) via match on Option<&str> (T-04-09)
key_files:
  created:
    - backend/tests/analytics_tests.rs
  modified:
    - backend/src/db/admin_queries.rs
    - backend/src/handlers/admin.rs
    - backend/src/main.rs
decisions:
  - "TREND_SQL_FILTERED is a separate const for the category-filtered variant — avoids
     runtime string interpolation (T-04-09); get_trend_data() dispatches to either const
     based on Option<&str>"
  - "WardBoundaryRow.boundary_geojson is Option<String> to handle wards with NULL
     geometry in the DB without panicking"
  - "admin_get_wards_boundaries parses boundary_geojson text into serde_json::Value
     so it embeds as a real JSON object in the FeatureCollection (not a quoted string)"
  - "TrendParams struct with Option<category> reuses the established Query extractor
     pattern from IntakeParams"
metrics:
  duration: "6 minutes"
  completed_date: "2026-05-31T11:36:19Z"
  tasks: 2
  files: 4 (1 created, 3 modified)
---

# Phase 04 Plan 03a: Admin Analytics Backend Summary

**One-liner:** Four analytics/boundaries endpoints (ANALYTICS-02/03/04/05) with SQL constants, query fns, GeoJSON assembly, and Wave 0 SQL-string unit tests — all admin-authenticated via admin_protected_router.

## What Was Built

### Task 1 (TDD RED + GREEN): Analytics SQL constants, query fns, and Wave 0 tests

**RED phase (commit 18ddf44):**

Created `backend/tests/analytics_tests.rs` with four SQL-string unit tests — no live DB required:
- `ward_analytics_unresolved_filter`: asserts FILTER (WHERE ... NOT IN) and LIMIT 10 in WARD_ANALYTICS_SQL
- `corp_analytics_nullif_guard`: asserts NULLIF( in CORP_ANALYTICS_SQL
- `trend_sql_uses_week_trunc`: asserts DATE_TRUNC('week') and INTERVAL '12 weeks' in TREND_SQL
- `ward_boundaries_uses_st_asgeojson`: asserts ST_AsGeoJSON, ST_Simplify, unresolved_count in WARD_BOUNDARIES_SQL

Tests confirmed failing (unresolved import errors — fragment helpers didn't exist yet).

**GREEN phase (commit b49338c):**

Added to `backend/src/db/admin_queries.rs`:
- `WARD_ANALYTICS_SQL` const: top 10 wards by unresolved count (FILTER WHERE NOT IN ('resolved','closed'), ORDER BY DESC, LIMIT 10) + `WardAnalyticsRow` struct + `get_ward_analytics(pool)` + `ward_analytics_sql_fragment()` test hook
- `CORP_ANALYTICS_SQL` const: resolution rate per corporation with NULLIF(COUNT(r.id), 0) zero-division guard, org_type = 'corporation' filter + `CorpAnalyticsRow` struct + `get_corporation_analytics(pool)` + `corp_analytics_sql_fragment()` test hook
- `TREND_SQL` const (unfiltered) + `TREND_SQL_FILTERED` const (category as $1 bound parameter): DATE_TRUNC('week'), INTERVAL '12 weeks', GROUP BY 1, 2 + `TrendDataRow` struct + `get_trend_data(pool, Option<&str>)` dispatching on category presence + `trend_sql_fragment()` test hook
- `WARD_BOUNDARIES_SQL` const: ST_AsGeoJSON(ST_Simplify(w.boundary::geometry, 0.001)), unresolved_count FILTER, GROUP BY id/ward_name/ward_number/boundary + `WardBoundaryRow` struct + `get_ward_boundaries(pool)` + `ward_boundaries_sql_fragment()` test hook

All 4 Wave 0 tests GREEN. Full suite: 261 tests passing.

### Task 2: Analytics handlers + route registration (commit 041a368)

Added to `backend/src/handlers/admin.rs`:
- `TrendParams` struct with `category: Option<String>` for Query extraction
- `admin_get_ward_analytics`: `Extension(_claims)` + `State(state)` → calls `get_ward_analytics` → `Json({ "data": rows })`
- `admin_get_corporation_analytics`: same pattern → calls `get_corporation_analytics`
- `admin_get_trend_data`: reads `?category` via `Query(params)`, passes `params.category.as_deref()` to `get_trend_data`
- `admin_get_wards_boundaries`: assembles GeoJSON FeatureCollection — boundary_geojson text parsed into `serde_json::Value` (not left as a string literal), properties include id/ward_name/ward_number/unresolved_count

Updated `backend/src/main.rs`:
- Added `admin_get_corporation_analytics`, `admin_get_trend_data`, `admin_get_ward_analytics`, `admin_get_wards_boundaries` to the `use handlers::admin` import list
- Registered all four routes inside `admin_protected_router` (before the `.layer(require_auth)` call):
  - `/api/admin/analytics/wards` → `admin_get_ward_analytics`
  - `/api/admin/analytics/corporations` → `admin_get_corporation_analytics`
  - `/api/admin/analytics/trend` → `admin_get_trend_data`
  - `/api/wards/boundaries` → `admin_get_wards_boundaries` (admin-only per D-04/D-05)

`/api/wards/boundaries` is NOT in the public route block — it lives exclusively inside the `admin_protected_router` with `require_auth` applied.

## Verification Results

- `cargo test analytics` — 4 passed, 0 failed (Wave 0 SQL-string tests)
- `cargo test` — 261 total (241 unit + 4 analytics + 5 export + 7 migration + 4 public_geojson), 0 failed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added TREND_SQL_FILTERED separate const**
- **Found during:** Task 1 GREEN phase
- **Issue:** The plan described one TREND_SQL with optional category filter "bound as a parameter." A single SQL string cannot conditionally include a WHERE clause fragment for an optional filter without runtime string interpolation (T-04-09 violation). Two separate const strings are the correct pattern (same as established in admin_queries.rs).
- **Fix:** Added `TREND_SQL_FILTERED` const with `AND category::TEXT = $1`; `get_trend_data()` dispatches to the appropriate const based on `Option<&str>` — no format! or string concatenation.
- **Files modified:** `backend/src/db/admin_queries.rs`
- **Commit:** b49338c

**2. [Rule 2 - Missing critical functionality] Parse boundary_geojson as serde_json::Value**
- **Found during:** Task 2 implementation
- **Issue:** If `boundary_geojson` (a PostgreSQL text string from ST_AsGeoJSON) is embedded directly in the JSON output without parsing, it appears as a double-encoded string `"geometry":"{\"type\":\"MultiPolygon\",...}"` rather than a proper JSON object. react-leaflet `<GeoJSON>` expects a real JSON object for the geometry field.
- **Fix:** Added `serde_json::from_str(s).ok()` to parse the boundary text into `serde_json::Value` before embedding in the Feature. Null geometry falls back to `serde_json::Value::Null`.
- **Files modified:** `backend/src/handlers/admin.rs`
- **Commit:** 041a368

## TDD Gate Compliance

- RED gate: commit `18ddf44` — `test(04-03a): add failing Wave 0 analytics SQL tests (RED)`
- GREEN gate: commit `b49338c` — `feat(04-03a): analytics SQL constants + query fns + test fragment helpers (GREEN)`
- No REFACTOR pass needed (code was clean after GREEN)

## Known Stubs

None — all four SQL constants, query functions, handlers, and route registrations are fully implemented. The frontend that consumes these endpoints is 04-03b.

## Threat Flags

No new security surface beyond what was planned. The four endpoints are registered under `admin_protected_router` per T-04-08. The category filter is bound (T-04-09). ST_Simplify is applied (T-04-10). No public endpoints were introduced.

## Self-Check: PASSED
