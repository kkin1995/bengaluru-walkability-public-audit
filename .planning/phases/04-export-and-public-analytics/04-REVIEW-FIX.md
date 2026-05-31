---
phase: 04-export-and-public-analytics
fixed_at: 2026-05-31T13:31:00Z
fix_scope: all
findings_in_scope: 15
fixed: 15
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed:** 2026-05-31T13:31:00Z
**Scope:** All (Critical + Warning + Info)
**Findings in scope:** 15
**Fixed:** 15
**Skipped:** 0
**Status:** all_fixed

## Fixes Applied

### Critical (5/5 fixed)

| ID | Commit | Description |
|----|--------|-------------|
| CR-01 | bf7a534 | Remove admin-only PII fields (`resolution_notes`, `resolution_photo_path`, `resolved_at`) from `PUBLIC_GEOJSON_SQL` and public streaming handler |
| CR-02 | a75522c | Remove invalid `{/* ... */}` JSX comment inside ternary expression body in analytics `page.tsx` that crashed `next build` |
| CR-03 | f438f3f | Add `proxy_set_header X-Forwarded-Proto $scheme;` to `nginx.server.conf` login location block (production config missed by prior WR-07 fix) |
| CR-04 | 18a5870 | Replace `.get::<i32>()` with `.try_get::<i32>().unwrap_or(0)` for `ward_number` in `get_ward_analytics` and `get_ward_boundaries` to prevent NULL panic |
| CR-05 | 2121739 | Admin GeoJSON export appends sentinel Feature with `_stream_truncated: true` before closing `]}` on mid-stream DB error |

### Warnings (6/6 fixed)

| ID | Commit | Description |
|----|--------|-------------|
| WR-01 | a288e0d | Refactor org-scoping CTE from `IN(...)` subquery to top-level prefix for PostgreSQL 11+ compatibility |
| WR-02 | 32d84f5 | Add `validate_category` and `validate_severity` functions; both export handlers now validate enum filter params before spawning |
| WR-03 | 2d2534f | Public GeoJSON error path breaks cleanly instead of sending `Err` that resets the TCP connection |
| WR-04 | 8122ef5 | `ChoroplethMap` key now uses ward content hash instead of always-identical first 40 bytes of JSON |
| WR-05 | d6c1116 | Remove dead `href` from logout mobile tab entry in `AdminSidebar` |
| WR-06 | f7d80e7 | Correct `HeatmapLayer` test: document `in_progress`/`acknowledged`/`assigned` as correctly included in heatmap data |

### Info (4/4 fixed)

| ID | Commit | Description |
|----|--------|-------------|
| IN-01 | fbdb0fb | Deduplicate `EXPORT_CSV_BASE` and `EXPORT_GEOJSON_BASE` into single `EXPORT_BASE` constant |
| IN-02 | 25a7211 | Add error state and retry button test coverage to `AnalyticsPage` test suite |
| IN-03 | bb7a028 | Add `@types/geojson` as explicit `devDependency` in `frontend/package.json` |
| IN-04 | c41808a | Clarify `KpiCards` label to "Total Reports (Top 10 Wards)" with "top 10 wards only" sub-label |
