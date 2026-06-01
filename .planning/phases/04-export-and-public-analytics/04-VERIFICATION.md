---
phase: 04-export-and-public-analytics
verified: 2026-05-31T12:24:07Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification:
  - test: "Toggle the Issue Density heatmap on the public /map page"
    expected: "A top-right Leaflet layer control appears; clicking it adds/removes the open-reports heatmap layer; no SSR crash on cold load"
    why_human: "Leaflet canvas rendering and overlay toggle behavior require a real browser; npm run build passes but visual toggle interaction cannot be confirmed from grep/test alone"
  - test: "Click a ward in the /admin/analytics choropleth"
    expected: "The WardTable highlights and filters to that ward; the TrendChart caption updates to show the ward name; a Clear filter button resets both"
    why_human: "D-04 drilldown is client-side React state wired to Leaflet GeoJSON click events — verifiable in code but user experience of the interaction requires a browser"
  - test: "Download filtered CSV from /admin/reports with a category filter active"
    expected: "CSV file downloads with DD/MM/YYYY dates, ward_name column present, and rows match the applied filter; no Excel formula injection on fields starting with =, +, -, @"
    why_human: "Streaming blob download and CSV content correctness under filters requires a live backend + authenticated admin session"
  - test: "Hit /api/reports.geojson more than twice per minute from a single IP"
    expected: "Third request returns HTTP 429; prior requests succeed with a valid FeatureCollection with coordinates rounded to 3 decimal places"
    why_human: "Rate-limit behaviour under real network conditions (nginx + governor double-layer) requires a running stack; unit tests confirm the logic but not the end-to-end enforcement"
---

# Phase 04: Export and Public Analytics — Verification Report

**Phase Goal:** Provide actionable data exports and public analytics so staff and stakeholders can analyse report trends, track ward-level resolution, and share open data — without GBA integration.
**Verified:** 2026-05-31T12:24:07Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An authenticated admin can download a streaming CSV of filtered reports with DD/MM/YYYY dates and a ward_name column | VERIFIED | `admin_export_csv` handler in `backend/src/handlers/admin.rs:826`; `EXPORT_CSV_SQL` at `admin_queries.rs:1145` includes ward_name via LEFT JOIN; `format_csv_date` at line 1198 formats DD/MM/YYYY; route registered under admin_protected_router at `main.rs:200` |
| 2 | An authenticated admin can download a streaming GeoJSON FeatureCollection with [longitude, latitude] coordinate order | VERIFIED | `admin_export_geojson` handler at `admin.rs:965`; `EXPORT_GEOJSON_SQL` at `admin_queries.rs:1172`; export test `geojson_coordinate_order` passes (5/5 export_tests green) |
| 3 | The reports table has a resolved_at column that resolve_report() sets to NOW() when status becomes resolved or closed | VERIFIED | `backend/migrations/011_analytics_mv.sql:18`: `ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`; `admin_queries.rs:676`: `resolved_at = NOW()` in resolve_report() UPDATE statement |
| 4 | Export endpoints return 401 when called without an admin session cookie | VERIFIED | Both export routes live inside `admin_protected_router` which applies `require_auth` middleware via `.layer(axum::middleware::from_fn_with_state(arc_state, require_auth))` at `main.rs:249-252` |
| 5 | A public unauthenticated GET /api/reports.geojson returns a FeatureCollection with coordinates rounded to 3 decimal places and zero PII fields | VERIFIED | `PUBLIC_GEOJSON_SQL` at `queries.rs:426` — comment at line 420 explicitly lists excluded PII columns (submitter_name, submitter_contact, submitter_ip, photo_hash); `round3()` helper at `queries.rs:454`; 4/4 public_geojson_tests pass (no_pii, coords_rounded, fields_present, stats_mv_includes_top_categories) |
| 6 | The public GeoJSON endpoint returns 429 when the per-IP governor rate limit is exceeded | VERIFIED | `stats.rs:66`: `if state.geojson_rate_limiter.check_key(&client_ip).is_err()` returns AppError::RateLimited; `geojson_rate_limiter` field in AppState initialised at main.rs; nginx also enforces `limit_req zone=geojson_public burst=1 nodelay` |
| 7 | A public_stats_mv materialized view exists and refreshes automatically via a trigger on reports insert/update | VERIFIED | `migrations/011_analytics_mv.sql:30`: `CREATE MATERIALIZED VIEW IF NOT EXISTS public_stats_mv`; `line 50`: unique index for CONCURRENTLY; `line 67-71`: `trg_refresh_public_stats` AFTER INSERT OR UPDATE trigger calling REFRESH MATERIALIZED VIEW CONCURRENTLY |
| 8 | A public /stats page renders total reports, resolved count, top 3 categories, and a GeoJSON open-data download link without requiring auth | VERIFIED | `frontend/app/stats/page.tsx` is a Server Component (no "use client"); SSR-fetches `INTERNAL_API_URL/api/stats` with `revalidate: 60`; renders `total`, `resolved`, `topCats`; includes download link at line 204 "Download open data (GeoJSON)"; 4/4 StatsPage tests pass |
| 9 | GET /api/admin/analytics/wards returns top 10 wards by unresolved report count | VERIFIED | `WARD_ANALYTICS_SQL` at `admin_queries.rs:1297` with `FILTER (WHERE r.status NOT IN ('resolved','closed'))` and `LIMIT 10`; `get_ward_analytics` at line 1323; `admin_get_ward_analytics` handler at `admin.rs:1351`; route at `main.rs:232` inside admin_protected_router; Wave 0 test passes |
| 10 | GET /api/admin/analytics/corporations returns resolution rate per corporation | VERIFIED | `CORP_ANALYTICS_SQL` at `admin_queries.rs:1360` with `NULLIF(COUNT(r.id),0)` zero-division guard; `get_corporation_analytics` at line 1389; `admin_get_corporation_analytics` handler at `admin.rs:1365`; route at `main.rs:235`; Wave 0 test passes |
| 11 | GET /api/admin/analytics/trend returns reports-per-week aggregates over the last 12 weeks, optionally filtered by category | VERIFIED | `TREND_SQL` and `TREND_SQL_FILTERED` consts at `admin_queries.rs:1429/1440`; `get_trend_data(pool, Option<&str>)` dispatches to filtered/unfiltered const; `admin_get_trend_data` reads `?category` param; route at `main.rs:240`; Wave 0 test confirms DATE_TRUNC + INTERVAL '12 weeks' |
| 12 | GET /api/wards/boundaries returns a ward GeoJSON FeatureCollection with unresolved_count, under admin auth | VERIFIED | `WARD_BOUNDARIES_SQL` at `admin_queries.rs:1518` with `ST_AsGeoJSON(ST_Simplify(..., 0.001))` and `unresolved_count FILTER`; `admin_get_wards_boundaries` handler at `admin.rs:1398`; route at `main.rs:246` inside admin_protected_router (not public block); Wave 0 test confirms ST_AsGeoJSON + ST_Simplify |
| 13 | The /admin/analytics page shows top 10 unresolved wards, corporation resolution rate, 12-week trend line chart, and interactive ward choropleth with click-to-filter drilldown | VERIFIED | `frontend/app/admin/analytics/page.tsx`: Promise.all fetches wardData/corpData/trendData; KpiCards + WardTable + TrendChart + ChoroplethMap all rendered; `onWardClick={setSelectedWard}` at line 186; `selectedWard` flows to WardTable and TrendChart; 2/2 AnalyticsPage smoke tests pass |
| 14 | The public /map page shows a toggleable issue-density heatmap layer driven by open/unresolved reports only, toggled via native Leaflet layer control | VERIFIED | `HeatmapLayer.tsx:40`: filters `status === "open"`; `line 56-60`: `L.control.layers({}, {"Issue Density": heatLayer}, {position:"topright"})`; rendered inside `ReportsMap.tsx:116` (the ssr:false boundary); not imported directly from map/page.tsx (grep confirmed no import); 5/5 HeatmapLayer tests pass |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/migrations/011_analytics_mv.sql` | resolved_at column + public_stats_mv MV + trigger | VERIFIED | Contains ALTER TABLE (resolved_at), CREATE MATERIALIZED VIEW, CREATE UNIQUE INDEX, CREATE TRIGGER trg_refresh_public_stats |
| `backend/src/db/admin_queries.rs` | EXPORT_CSV_SQL, EXPORT_GEOJSON_SQL, csv_escape, format_csv_date, WARD_ANALYTICS_SQL, CORP_ANALYTICS_SQL, TREND_SQL, WARD_BOUNDARIES_SQL | VERIFIED | All constants and query functions confirmed at specific line numbers |
| `backend/src/handlers/admin.rs` | admin_export_csv, admin_export_geojson, admin_get_ward_analytics, admin_get_corporation_analytics, admin_get_trend_data, admin_get_wards_boundaries | VERIFIED | All six handlers confirmed; use Body::from_stream for streaming |
| `backend/src/handlers/stats.rs` | public_get_stats, public_get_geojson | VERIFIED | Both handlers confirmed; geojson_rate_limiter.check_key used |
| `backend/tests/export_tests.rs` | 5 Wave 0 export tests | VERIFIED | All 5 tests pass: export_csv_includes_all_columns, csv_date_format_dd_mm_yyyy, csv_escape_special_chars, geojson_coordinate_order, export_geojson_sql_no_select_star |
| `backend/tests/public_geojson_tests.rs` | 4 Wave 0 public GeoJSON tests | VERIFIED | All 4 tests pass |
| `backend/tests/analytics_tests.rs` | 4 Wave 0 analytics SQL tests | VERIFIED | All 4 tests pass |
| `nginx/nginx.conf` | geojson_public zone + location block + proxy_read_timeout 120s | VERIFIED | Lines 25 and 93-94 confirmed |
| `nginx/nginx.server.conf` | Identical to nginx.conf | VERIFIED | Lines 31 and 80-81 confirmed |
| `frontend/app/stats/page.tsx` | Server Component, SSR stats fetch, Download open data link | VERIFIED | No "use client"; imports INTERNAL_API_URL from config; download link at line 204 |
| `frontend/app/admin/reports/page.tsx` | Export CSV + Export GeoJSON buttons wired to active filters | VERIFIED | handleCsvDownload/handleGeoJsonDownload pass active category/status filters; buttons at lines 261, 269 |
| `frontend/app/admin/analytics/page.tsx` | ChoroplethMap, TrendChart dynamic imports, selectedWard drilldown | VERIFIED | Dynamic imports with ssr:false; ChoroplethMap onWardClick at line 186 |
| `frontend/app/admin/analytics/ChoroplethMap.tsx` | react-leaflet GeoJSON with onWardClick | VERIFIED | GeoJSON layer, onWardClick callback in onEachFeature at line 52 |
| `frontend/app/admin/components/TrendChart.tsx` | recharts LineChart with legend click-to-hide | VERIFIED | LineChart at line 76; Legend onClick at line 85; hiddenLines Set state at line 45 |
| `frontend/app/admin/components/KpiCards.tsx` | KPI cards using Direction-B tokens | VERIFIED | File exists; uses var(--surface), var(--border) from admin.css |
| `frontend/app/admin/components/WardTable.tsx` | Ward table with selectedWard highlight | VERIFIED | File exists; selectedWard prop used |
| `frontend/app/components/HeatmapLayer.tsx` | leaflet.heat + open-reports filter + L.control.layers | VERIFIED | import "leaflet.heat" at line 15; filter at line 40; L.control.layers at line 56 |
| `frontend/package.json` | recharts@^3.8.1, leaflet.heat@^0.2.0, @types/leaflet.heat@^0.2.5 | VERIFIED | All three confirmed in package.json |
| `frontend/app/admin/components/AdminSidebar.tsx` | Analytics entry with activity icon in NAV_ITEMS + MOBILE_TABS | VERIFIED | Lines 20 and 28: `{ key: "analytics", href: "/admin/analytics", icon: "activity" as const, label: "ANALYTICS" }` |
| `frontend/app/admin/lib/adminApi.ts` | downloadCsvExport, downloadGeoJsonExport, getWardAnalytics, getCorporationAnalytics, getTrendData, getWardBoundaries, getPublicStats | VERIFIED | All seven functions confirmed at specific lines |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `backend/src/main.rs` | `admin_export_csv / admin_export_geojson` | route inside admin_protected_router | WIRED | Lines 200, 204 — before /:id route to prevent path capture |
| `frontend/app/admin/reports/page.tsx` | `downloadCsvExport / downloadGeoJsonExport` | handleCsvDownload/handleGeoJsonDownload with active filters | WIRED | Lines 151, 170 pass category/status filters from page state |
| `backend/src/main.rs` | `handlers::stats::public_get_geojson` | public route block (no auth layer) | WIRED | Line 265 — in public block, not inside admin_protected_router |
| `backend/migrations/011_analytics_mv.sql` | reports table | AFTER INSERT OR UPDATE trigger trg_refresh_public_stats | WIRED | Lines 67-71 create trigger calling refresh_public_stats_mv() |
| `frontend/app/stats/page.tsx` | `/api/stats` | SSR fetch via INTERNAL_API_URL | WIRED | Lines 24, `import { INTERNAL_API_URL } from "@/app/lib/config"` — no process.env inline |
| `backend/src/main.rs` | analytics + ward-boundaries handlers | admin_protected_router (.layer(require_auth)) | WIRED | Lines 232-252 — all four routes inside protected router before .layer(require_auth) |
| `frontend/app/admin/analytics/page.tsx` | `getWardAnalytics / getCorporationAnalytics / getTrendData` | Promise.all in fetchAnalytics useCallback | WIRED | Lines 36-50; results set via setWardData/setCorpData/setTrendData |
| `frontend/app/admin/analytics/ChoroplethMap.tsx` | WardTable + TrendChart filter state | onWardClick callback → selectedWard state | WIRED | `onWardClick={setSelectedWard}` at line 186; flows to WardTable line 170, TrendChart line 153 |
| `frontend/app/admin/lib/adminApi.ts` | `GET /api/wards/boundaries` (admin) | getWardBoundaries through apiFetch (credentials:include) | WIRED | Line 458; routes through apiFetch so session cookie is sent |
| `frontend/app/components/ReportsMap.tsx` | `HeatmapLayer` | import + render inside MapContainer (ssr:false boundary) | WIRED | Lines 9 (import), 116 (render inside MapContainer) |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `admin/analytics/page.tsx` | wardData, corpData, trendData | Promise.all([getWardAnalytics(), getCorporationAnalytics(), getTrendData()]) → apiFetch → admin_protected_router endpoints → DB queries | WARD_ANALYTICS_SQL / CORP_ANALYTICS_SQL / TREND_SQL SELECT from reports with FILTER aggregates | FLOWING |
| `stats/page.tsx` | stats (total_reports, resolved_count, top_categories) | SSR fetch INTERNAL_API_URL/api/stats → public_get_stats → get_public_stats → `SELECT ... FROM public_stats_mv` | MV populated from real reports table data | FLOWING |
| `admin/analytics/ChoroplethMap.tsx` | FeatureCollection prop | getWardBoundaries() → apiFetch /api/wards/boundaries → admin_get_wards_boundaries → get_ward_boundaries → WARD_BOUNDARIES_SQL | ST_AsGeoJSON on real ward geometries | FLOWING |
| `HeatmapLayer.tsx` | reports prop | Same /api/reports fetch already used for pins in ReportsMap | Reuses existing reports array — no additional fetch | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend library tests | `cargo test --lib` | 241/241 passed | PASS |
| Export integration tests | `cargo test --test export_tests` | 5/5 passed | PASS |
| Public GeoJSON integration tests | `cargo test --test public_geojson_tests` | 4/4 passed | PASS |
| Analytics integration tests | `cargo test --test analytics_tests` | 4/4 passed | PASS |
| Backend compile | `cargo check` | exit 0, no errors | PASS |
| Frontend build | `npm run build` | exit 0, no TypeScript errors (fetch failed = SSR backend not running, not a TS error) | PASS |
| StatsPage tests | `npm test StatsPage` | 4/4 passed | PASS |
| AnalyticsPage tests | `npm test AnalyticsPage` | 2/2 passed | PASS |
| HeatmapLayer tests | `npm test HeatmapLayer` | 5/5 passed | PASS |

---

### Probe Execution

No probe scripts declared in PLAN files or found under `scripts/*/tests/probe-*.sh`. Step 7c: SKIPPED (no probes declared).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MAP-02 | 04-04 | Heatmap layer on public map, toggleable | SATISFIED | HeatmapLayer.tsx + ReportsMap.tsx wiring; L.control.layers toggle; 5/5 tests pass |
| EXPORT-01 | 04-01 | Admin CSV export with DD/MM/YYYY, ward_name, filters | SATISFIED | admin_export_csv + EXPORT_CSV_SQL; format_csv_date; buttons on /admin/reports with active filters |
| EXPORT-02 | 04-01 | Admin GeoJSON streaming, no memory buffering | SATISFIED | admin_export_geojson uses Body::from_stream + mpsc channel; EXPORT_GEOJSON_SQL |
| EXPORT-03 | 04-02 | Public GeoJSON, coordinates rounded 3dp, no PII | SATISFIED | PUBLIC_GEOJSON_SQL excludes PII; round3() applied; nginx + governor rate limiting; 4/4 tests pass |
| ANALYTICS-01 | 04-02 | Public stats page: total, resolved, top 3 categories from materialized view | SATISFIED | public_stats_mv MV + trigger in migration 011; /stats Server Component SSR-fetches /api/stats |
| ANALYTICS-02 | 04-03a, 04-03b | Admin analytics: top 10 wards by unresolved count | SATISFIED | WARD_ANALYTICS_SQL FILTER+LIMIT 10; admin_get_ward_analytics; WardTable component |
| ANALYTICS-03 | 04-03a, 04-03b | Admin analytics: resolution rate per corporation | SATISFIED | CORP_ANALYTICS_SQL with NULLIF guard; admin_get_corporation_analytics; KpiCards shows resolution rate |
| ANALYTICS-04 | 04-03a, 04-03b | Admin analytics: trend chart 12 weeks, filterable by category | SATISFIED | TREND_SQL + TREND_SQL_FILTERED; TrendChart recharts LineChart with legend click-to-hide |
| ANALYTICS-05 | 04-03a, 04-03b | Admin analytics: ward choropleth with unresolved count fill | SATISFIED | WARD_BOUNDARIES_SQL + ST_AsGeoJSON; ChoroplethMap react-leaflet GeoJSON layer styled by unresolved_count |

**All 9 Phase 4 requirements satisfied by codebase implementation.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `HeatmapLayer.tsx` | 76 | `return null` | INFO | Expected for a Leaflet imperative overlay — not a render stub; the actual canvas is managed by Leaflet's `addTo(map)` call in the useEffect above |

No TBD, FIXME, or XXX markers found in any phase-modified file. No stubs or placeholder implementations detected.

---

### Human Verification Required

#### 1. Heatmap toggle on public /map page

**Test:** Load `/map` in a browser, look for the layer control top-right, toggle "Issue Density" on and off.
**Expected:** Heatmap appears/disappears correctly; only open-status report points contribute density; no console SSR error.
**Why human:** Leaflet canvas rendering, overlay registration, and toggle interaction require a real browser with a running backend.

#### 2. Ward choropleth click-to-filter drilldown on /admin/analytics

**Test:** Log in as admin, navigate to `/admin/analytics`, wait for ward boundaries to load, click a ward polygon.
**Expected:** WardTable row for the clicked ward highlights; TrendChart caption shows the ward name; "Clear filter" button resets both.
**Why human:** D-04 drilldown is wired correctly in code (onWardClick → selectedWard state), but the interactive behaviour requires a browser with real ward boundary data loaded.

#### 3. CSV download with active filters from /admin/reports

**Test:** Log in, apply a category filter, click "Export CSV".
**Expected:** CSV downloads promptly (streaming); file contains only rows matching the filter; ward_name column present; dates are DD/MM/YYYY; fields starting with =,+,-,@ are prefixed with single quote.
**Why human:** Streaming Blob download behaviour and CSV content correctness require an authenticated session and live backend.

#### 4. Rate limit enforcement on /api/reports.geojson

**Test:** Send 3 rapid requests to /api/reports.geojson from the same IP (e.g., via curl).
**Expected:** First two succeed with 200 and valid GeoJSON; third returns 429; coordinates in response are rounded to 3 decimal places.
**Why human:** End-to-end enforcement of the nginx + governor double-layer rate limit requires a running nginx + backend stack.

---

## Gaps Summary

No gaps found. All 14 observable truths are verified with codebase evidence. All 9 Phase 4 requirement IDs are satisfied. All Wave 0 tests pass (13 backend + 11 frontend). Backend compiles clean. Frontend build produces zero TypeScript errors.

Four human verification items remain — these are browser/network interaction tests that cannot be confirmed programmatically but all underlying code is wired correctly.

---

_Verified: 2026-05-31T12:24:07Z_
_Verifier: Claude (gsd-verifier)_
