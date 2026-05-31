---
phase: 04-export-and-public-analytics
plan: 01
subsystem: backend/export, frontend/admin
tags: [export, csv, geojson, streaming, migration, tdd]
dependency_graph:
  requires: []
  provides:
    - backend/migrations/011_analytics_mv.sql (resolved_at column — 04-02 appends MV+trigger)
    - backend/src/db/admin_queries.rs (EXPORT_CSV_SQL, EXPORT_GEOJSON_SQL, csv_escape, format_csv_date, build_export_where_clause)
    - backend/src/handlers/admin.rs (admin_export_csv, admin_export_geojson streaming handlers)
    - backend/src/main.rs (export routes in admin_protected_router)
    - frontend/app/admin/lib/adminApi.ts (downloadCsvExport, downloadGeoJsonExport)
    - frontend/app/admin/reports/page.tsx (Export CSV, Export GeoJSON buttons)
  affects:
    - 04-02 (depends on 011_analytics_mv.sql existing for MV+trigger append)
tech_stack:
  added:
    - tokio-stream 0.1 (ReceiverStream for streaming body)
    - futures 0.3 (StreamExt for .next() on sqlx stream)
  patterns:
    - mpsc channel + ReceiverStream + Body::from_stream (Axum 0.7 streaming)
    - const SQL string + pub fn fragment() test hook pattern (no compile-time sqlx macros)
    - Blob URL download via document.createElement("a") in React
key_files:
  created:
    - backend/migrations/011_analytics_mv.sql
    - backend/src/lib.rs
    - backend/tests/export_tests.rs
  modified:
    - backend/Cargo.toml
    - backend/Cargo.lock
    - backend/src/db/admin_queries.rs
    - backend/src/handlers/admin.rs
    - backend/src/main.rs
    - frontend/app/admin/lib/adminApi.ts
    - frontend/app/admin/reports/page.tsx
decisions:
  - "Added lib.rs to expose module tree to integration tests (binary-only crate had no library target)"
  - "Made EXPORT_CSV_SQL and EXPORT_GEOJSON_SQL pub const so handlers can reference them from crate root"
  - "csv_escape and format_csv_date made pub (not pub(crate)) so integration tests in backend/tests/ can import them"
  - "build_export_where_clause is a thin pub wrapper around build_report_where_clause (start_idx=1) to keep export filter binding in sync with list queries"
  - "resolved_at = NOW() added to resolve_report() UPDATE statement alongside existing SET columns — no new bind parameter (SQL-side NOW())"
  - "Export routes registered BEFORE /api/admin/reports/:id to ensure literal 'export' path segment is not captured as :id parameter"
metrics:
  duration: "12 minutes"
  completed_date: "2026-05-31T09:44:00Z"
  tasks: 3
  files: 7 (3 created, 7 modified)
---

# Phase 04 Plan 01: Streaming CSV/GeoJSON Export Summary

**One-liner:** Streaming CSV export (D-13 columns, DD/MM/YYYY, CSV injection mitigation) and GeoJSON export ([lng, lat] RFC 7946) behind admin auth, plus migration 011 that adds the resolved_at column and stamps it on report resolution.

## What Was Built

### Task 1: Migration 011 — resolved_at column (commit 374232f)

Created `backend/migrations/011_analytics_mv.sql` adding `resolved_at TIMESTAMPTZ` to the reports table via `ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`. Updated `resolve_report()` in `admin_queries.rs` to `SET resolved_at = NOW()` alongside the existing status/photo/notes fields. The migration file contains a comment placeholder for plan 04-02 to append the materialized view + trigger.

### Task 2: Wave 0 TDD export scaffold + streaming handlers (commits b6f649d, 5e4ee33)

**RED phase (b6f649d):**
- Created `backend/tests/export_tests.rs` with 5 tests: `export_csv_includes_all_columns`, `csv_date_format_dd_mm_yyyy`, `csv_escape_special_chars`, `geojson_coordinate_order`, `export_geojson_sql_no_select_star`
- Created `backend/src/lib.rs` library target so integration tests can import from `db::admin_queries`

**GREEN phase (5e4ee33):**
- Added `EXPORT_CSV_SQL` and `EXPORT_GEOJSON_SQL` pub const with all D-13 columns (explicit whitelist, no SELECT *)
- Added `format_csv_date` (DD/MM/YYYY, D-12), `format_csv_date_opt`, `csv_escape` (CSV injection mitigation for =,+,-,@ triggers)
- Added `build_export_where_clause` pub wrapper around existing `build_report_where_clause`
- Added `export_csv_sql_fragment` and `export_geojson_sql_fragment` test hook functions
- Added `admin_export_csv` streaming handler: mpsc channel + `ReceiverStream` + `Body::from_stream`, CSV header then rows via `sqlx fetch()`
- Added `admin_export_geojson` streaming handler: opening `{"type":"FeatureCollection","features":[` then per-row Feature with `"coordinates": [longitude, latitude]` (RFC 7946), then `]}`
- Registered routes in `admin_protected_router` before `/:id` route (prevents path capture)
- Added `tokio-stream` and `futures` to Cargo.toml

### Task 3: adminApi export functions + export buttons (commit 35ceca0)

- Added `downloadCsvExport` and `downloadGeoJsonExport` to `adminApi.ts` — both build URLSearchParams from `AdminReportFilters`, call with `credentials: "include"`, return `res.blob()`
- Added `handleCsvDownload` / `handleGeoJsonDownload` in `/admin/reports/page.tsx` — Blob URL pattern with `document.createElement("a")` download trigger
- Added two `<Btn variant="ghost" size="sm">` buttons ("Export CSV", "Export GeoJSON") below filter bar, above ReportsTable, disabled while `isLoading`

## Verification Results

- `cargo test` — 253 passed, 0 failed (241 unit + 5 export integration + 7 migration tests)
- `cargo check` — exits 0
- `npm run build` — exits 0, zero TypeScript errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added lib.rs library target to expose integration test helpers**
- **Found during:** Task 2 RED phase
- **Issue:** The backend crate had only `[[bin]]` in Cargo.toml — no library target. Integration test files in `backend/tests/` cannot import from a binary-only crate. The plan specified `pub fn fragment helpers` accessible from integration tests.
- **Fix:** Created `backend/src/lib.rs` declaring the same module tree as `main.rs`. Both the binary and library crates compile independently; integration tests import from the library tree.
- **Files modified:** `backend/src/lib.rs` (created), `backend/Cargo.toml` (Cargo automatically detects the new lib.rs)
- **Commit:** b6f649d

**2. [Rule 2 - Missing visibility] Changed csv_escape/format_csv_date from pub(crate) to pub**
- **Found during:** Task 2 GREEN phase
- **Issue:** Integration tests in `backend/tests/export_tests.rs` are compiled as a separate crate and cannot access `pub(crate)` items from the library crate.
- **Fix:** Changed visibility to `pub` — these are pure helper functions with no security implications.
- **Commit:** 5e4ee33

## TDD Gate Compliance

- RED gate: commit b6f649d — `test(04-01): add failing Wave 0 export test scaffold (RED)`
- GREEN gate: commit 5e4ee33 — `feat(04-01): streaming CSV/GeoJSON export handlers + SQL constants (GREEN)`
- No REFACTOR pass needed (code was clean after GREEN)

## Known Stubs

None — all export endpoints, SQL queries, helper functions, and UI buttons are fully implemented and wired. The `-- public_stats_mv + trigger appended by plan 04-02` comment in migration 011 is an intentional placeholder for the next plan, not a code stub.

## Self-Check: PASSED
