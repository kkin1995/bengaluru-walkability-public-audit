---
phase: 04-export-and-public-analytics
plan: 03a
type: execute
wave: 3
depends_on: ["04-01", "04-02"]
files_modified:
  - backend/src/db/admin_queries.rs
  - backend/src/handlers/admin.rs
  - backend/src/main.rs
  - backend/tests/analytics_tests.rs
autonomous: true
requirements: [ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05]
must_haves:
  truths:
    - "GET /api/admin/analytics/wards returns the top 10 wards by unresolved report count"
    - "GET /api/admin/analytics/corporations returns resolution rate per corporation (resolved / total reports in their wards)"
    - "GET /api/admin/analytics/trend returns reports-per-week aggregates over the last 12 weeks, optionally filtered by category"
    - "GET /api/wards/boundaries returns a ward GeoJSON FeatureCollection with unresolved_count, under admin auth"
    - "All four analytics/boundaries endpoints are registered under admin_protected_router (require_auth)"
  artifacts:
    - path: "backend/src/db/admin_queries.rs"
      provides: "WARD_ANALYTICS_SQL, CORP_ANALYTICS_SQL, TREND_SQL, WARD_BOUNDARIES_SQL constants + query fns + test-only fragment helpers"
      contains: "const WARD_ANALYTICS_SQL"
    - path: "backend/src/handlers/admin.rs"
      provides: "admin_get_ward_analytics, admin_get_corporation_analytics, admin_get_trend_data, admin_get_wards_boundaries handlers"
      contains: "admin_get_ward_analytics"
    - path: "backend/tests/analytics_tests.rs"
      provides: "Wave 0 SQL-string unit tests for analytics + ward boundaries"
      contains: "ward_analytics_unresolved_filter"
  key_links:
    - from: "backend/src/main.rs"
      to: "admin analytics + ward boundaries handlers"
      via: "route registration under admin_protected_router (all four endpoints require auth, including /api/wards/boundaries)"
      pattern: "analytics/wards|wards/boundaries"
    - from: "backend/src/handlers/admin.rs"
      to: "admin_queries::get_ward_analytics / get_corporation_analytics / get_trend_data / get_ward_boundaries"
      via: "handler calls into query fns"
      pattern: "get_ward_analytics"
---

<objective>
Build the backend for the admin analytics dashboard: four aggregation/geometry queries and their authenticated handlers — top 10 unresolved wards (ANALYTICS-02), corporation resolution rate (ANALYTICS-03), weekly trend over 12 weeks (ANALYTICS-04), and a ward-boundaries GeoJSON endpoint feeding the choropleth (ANALYTICS-05). All endpoints are admin-only.

Purpose: ANALYTICS-02/03/04/05 backend tier. Split out from the original 04-03 (which exceeded the file-count quality target) so the backend lands as a focused, independently testable unit. Depends on 04-01 and 04-02 because it shares main.rs, admin_queries.rs and handlers/admin.rs with both. The frontend that consumes these endpoints is 04-03b.
Output: four backend analytics queries + handlers, ward-boundaries endpoint registered under admin auth, Wave 0 SQL-string tests.
</objective>

<execution_context>
@/home/karankinariwala/KARAN/1-Projects/Active/bengaluru-walkability-public-audit/.claude/get-shit-done/workflows/execute-plan.md
@/home/karankinariwala/KARAN/1-Projects/Active/bengaluru-walkability-public-audit/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-export-and-public-analytics/04-CONTEXT.md
@.planning/phases/04-export-and-public-analytics/04-RESEARCH.md
@.planning/phases/04-export-and-public-analytics/04-PATTERNS.md
@CLAUDE.md
@.planning/phases/04-export-and-public-analytics/04-01-SUMMARY.md
@.planning/phases/04-export-and-public-analytics/04-02-SUMMARY.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Analytics + ward-boundaries SQL constants, query fns, and Wave 0 tests</name>
  <files>backend/src/db/admin_queries.rs, backend/tests/analytics_tests.rs</files>
  <read_first>
    - backend/src/db/admin_queries.rs (INTAKE_SQL const + get_intake_stats pattern ~lines 877-909; test-only pub fn fragment pattern ~lines 1085-1126)
    - backend/migrations/004_ward_boundaries.sql + 009_ward_hierarchy.sql (wards.boundary GEOGRAPHY column, ward_name, ward_number, org_id; organizations.name, org_type)
    - .planning/phases/04-export-and-public-analytics/04-RESEARCH.md "Code Examples" SQL blocks (ANALYTICS-02/03/04/05), Pitfall 7 (ST_Simplify for boundaries)
    - .planning/phases/04-export-and-public-analytics/04-PATTERNS.md "admin_queries.rs" analytics SQL section
  </read_first>
  <behavior>
    - Test ward_analytics_unresolved_filter: WARD_ANALYTICS_SQL contains `FILTER (WHERE` with status NOT IN ('resolved','closed') and `LIMIT 10`
    - Test corp_analytics_nullif_guard: CORP_ANALYTICS_SQL contains `NULLIF(` to guard zero-division on resolution rate
    - Test trend_sql_uses_week_trunc: TREND_SQL contains `DATE_TRUNC('week'` and `INTERVAL '12 weeks'`
    - Test ward_boundaries_uses_st_asgeojson: WARD_BOUNDARIES_SQL contains `ST_AsGeoJSON` and `ST_Simplify` and selects unresolved_count
  </behavior>
  <action>
    Create backend/tests/analytics_tests.rs with the four tests above (RED first) referencing pub fn fragment helpers.
    In admin_queries.rs add four SQL consts and query fns following the INTAKE_SQL pattern:
    WARD_ANALYTICS_SQL — top 10 wards: SELECT w.ward_name, w.ward_number, COUNT(r.id) FILTER (WHERE r.status NOT IN ('resolved','closed')) AS unresolved_count, COUNT(r.id) AS total_count FROM wards w LEFT JOIN reports r ON r.ward_id = w.id GROUP BY w.id, w.ward_name, w.ward_number ORDER BY unresolved_count DESC LIMIT 10. Add `pub async fn get_ward_analytics(pool)`.
    CORP_ANALYTICS_SQL — resolution rate per corporation: SELECT o.name AS corporation, COUNT(r.id) AS total_reports, COUNT(r.id) FILTER (WHERE r.status IN ('resolved','closed')) AS resolved_count, ROUND(100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('resolved','closed')) / NULLIF(COUNT(r.id),0), 1) AS resolution_rate_pct FROM organizations o JOIN wards w ON w.org_id = o.id LEFT JOIN reports r ON r.ward_id = w.id WHERE o.org_type = 'corporation' GROUP BY o.id, o.name ORDER BY resolution_rate_pct DESC NULLS LAST. Add `pub async fn get_corporation_analytics(pool)`.
    TREND_SQL — reports/week × 12 weeks: SELECT DATE_TRUNC('week', created_at AT TIME ZONE 'UTC')::DATE::TEXT AS week_start, category::TEXT AS category, COUNT(*)::BIGINT AS count FROM reports WHERE created_at >= NOW() - INTERVAL '12 weeks' GROUP BY 1,2 ORDER BY 1,2. Add `pub async fn get_trend_data(pool, category: Option<&str>)` (optional category filter bound as a parameter — never interpolated).
    WARD_BOUNDARIES_SQL — ward polygons + unresolved_count: SELECT w.id, w.ward_name, w.ward_number, ST_AsGeoJSON(ST_Simplify(w.boundary::geometry, 0.001)) AS boundary_geojson, COUNT(r.id) FILTER (WHERE r.status NOT IN ('resolved','closed')) AS unresolved_count FROM wards w LEFT JOIN reports r ON r.ward_id = w.id GROUP BY w.id, w.ward_name, w.ward_number, w.boundary. Add `pub async fn get_ward_boundaries(pool)` that assembles a GeoJSON FeatureCollection (boundary_geojson parsed into geometry, unresolved_count/ward_name/ward_number as properties).
    Expose `pub fn ward_analytics_sql_fragment()`, `corp_analytics_sql_fragment()`, `trend_sql_fragment()`, `ward_boundaries_sql_fragment()` (#[allow(dead_code)]) so the tests assert on the exact strings without a live DB.
  </action>
  <verify>
    <automated>cd backend && cargo test analytics 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - backend/tests/analytics_tests.rs exists with tests ward_analytics_unresolved_filter, corp_analytics_nullif_guard, trend_sql_uses_week_trunc, ward_boundaries_uses_st_asgeojson
    - admin_queries.rs contains `const WARD_ANALYTICS_SQL`, `const CORP_ANALYTICS_SQL`, `const TREND_SQL`, `const WARD_BOUNDARIES_SQL` and matching `pub async fn get_*` functions plus the four `*_sql_fragment()` helpers
    - `cd backend && cargo test analytics` exits 0
  </acceptance_criteria>
  <done>All four analytics/boundaries SQL consts + query fns compile and the Wave 0 analytics tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Analytics + ward-boundaries handlers, registered under admin auth in main.rs</name>
  <files>backend/src/handlers/admin.rs, backend/src/main.rs</files>
  <read_first>
    - backend/src/handlers/admin.rs (admin_get_intake_stats Json-returning handler pattern; how Extension(claims) and State(state) are extracted)
    - backend/src/main.rs lines 173-214 (admin_protected_router with require_auth layer) + lines 216-223 (public route block)
    - .planning/phases/04-export-and-public-analytics/04-PATTERNS.md "handlers/admin.rs" analytics handler section + "main.rs" router section (note: /api/wards/boundaries is ADMIN-ONLY and lives in the admin protected block)
    - .planning/phases/04-export-and-public-analytics/04-RESEARCH.md Pitfall 7 (ST_Simplify) for the boundaries response
  </read_first>
  <action>
    In handlers/admin.rs add Json-returning handlers (mirror admin_get_intake_stats): `admin_get_ward_analytics`, `admin_get_corporation_analytics`, `admin_get_trend_data` (reads optional `?category` query param and passes it to get_trend_data), and `admin_get_wards_boundaries` (returns the FeatureCollection from get_ward_boundaries). Each receives `Extension(_claims): Extension<AuthJwtClaims>` and `State(state)`; errors propagate via AppError.
    In main.rs register ALL FOUR under admin_protected_router so require_auth applies: `/api/admin/analytics/wards`, `/api/admin/analytics/corporations`, `/api/admin/analytics/trend`, and `/api/wards/boundaries`. The ward-boundaries endpoint is admin-only (the choropleth is an admin analytics feature per D-04/D-05) — it MUST be inside the admin protected block, NOT the public route block. This matches 04-PATTERNS.md main.rs router section.
  </action>
  <verify>
    <automated>cd backend && cargo test 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - handlers/admin.rs contains `pub async fn admin_get_ward_analytics(`, `admin_get_corporation_analytics(`, `admin_get_trend_data(`, `admin_get_wards_boundaries(`
    - main.rs registers `analytics/wards`, `analytics/corporations`, `analytics/trend`, and `wards/boundaries`, all inside admin_protected_router (require_auth applied) — none in the public route block
    - `cd backend && cargo test` exits 0
  </acceptance_criteria>
  <done>The four analytics/boundaries handlers compile, are routed under admin auth, and the backend test suite is green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| admin browser → /api/admin/analytics/* | Authenticated admin reads aggregate analytics |
| admin browser → /api/wards/boundaries | Authenticated read of ward geometry + unresolved counts |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-08 | Information Disclosure | analytics + ward-boundaries endpoints | mitigate | All four registered under admin_protected_router require_auth; aggregate-only data, no per-report PII; /api/wards/boundaries is NOT public |
| T-04-09 | Tampering | analytics SQL (category filter on trend) | mitigate | Category filter bound via sqlx .bind(); analytics consts use no string interpolation of user input |
| T-04-10 | Denial of Service | ward-boundaries response size | mitigate | ST_Simplify(boundary, 0.001) reduces vertex count per Pitfall 7 to keep response small |
</threat_model>

<verification>
- `cd backend && cargo test` passes (analytics tests green)
- All four endpoints registered under admin_protected_router (require_auth)
</verification>

<success_criteria>
- Backend serves top 10 unresolved wards, corporation resolution rate, 12-week trend (category-filterable), and ward-boundaries GeoJSON — all admin-authenticated
- Wave 0 SQL-string tests pass; full backend suite green
</success_criteria>

<output>
Create `.planning/phases/04-export-and-public-analytics/04-03a-SUMMARY.md` when done
</output>
