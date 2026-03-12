---
phase: 01-ward-foundation
plan: "04"
subsystem: api
tags: [rust, axum, sqlx, postgres, postgis, typescript, nextjs, admin]

# Dependency graph
requires:
  - phase: 01-ward-foundation/01-01
    provides: wards table with id + name columns
  - phase: 01-ward-foundation/01-03
    provides: admin frontend pages (reports list, reports map)
provides:
  - GET /api/admin/reports returning { data, pagination: { page, limit, total_count, total_pages } }
  - ward_name field in every admin report row via LEFT JOIN wards
  - count_admin_reports() returning accurate total filtered count (not items.length)
  - Null guards on setReports() calls in both admin report pages
affects:
  - phase: 02-anti-abuse
  - phase: 03-government-workflow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared WHERE clause builder (build_report_where_clause) used by both list and count queries to keep filter logic in sync"
    - "tokio::try_join! for concurrent list + count queries in a single handler round-trip"
    - "Null-coalescing default (result.data ?? []) on all paginated API responses in frontend"

key-files:
  created: []
  modified:
    - backend/src/db/admin_queries.rs
    - backend/src/handlers/admin.rs
    - frontend/app/admin/reports/map/page.tsx
    - frontend/app/admin/reports/page.tsx

key-decisions:
  - "build_report_where_clause() extracted as a private helper shared by list_admin_reports and count_admin_reports — single source of truth for filter logic prevents WHERE clause drift between list and count"
  - "tokio::try_join! used to run list and count concurrently, avoiding two sequential round-trips for the same filter set"
  - "total_pages = ((total_count + limit - 1) / limit).max(1) — ceiling division with minimum 1 so frontend never receives total_pages: 0"

patterns-established:
  - "Paginated list handlers must call both list_* and count_* helpers concurrently via try_join! and return { data, pagination: { page, limit, total_count, total_pages } }"
  - "Frontend pages that receive paginated data must null-guard with ?? [] on .data access"

requirements-completed: [WARD-03]

# Metrics
duration: 15min
completed: 2026-03-12
---

# Phase 01 Plan 04: Admin Reports JSON Shape and Ward JOIN Summary

**Backend admin reports API fixed to return { data, pagination } shape with accurate COUNT(*) total and ward_name via LEFT JOIN wards, unblocking the admin reports list and map pages**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-12T09:18:36Z
- **Completed:** 2026-03-12T09:35:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `count_admin_reports()` DB helper that runs the same filter WHERE clause as `list_admin_reports` but returns `SELECT COUNT(*)` — providing an accurate total filtered count independent of limit/offset
- Added `LEFT JOIN wards ON wards.id = reports.ward_id` to `list_admin_reports`, selecting `wards.name AS ward_name` so every report row includes ward context
- Replaced the wrong `{ page, limit, count, items }` return shape in `admin_list_reports` handler with the correct `{ data, pagination: { page, limit, total_count, total_pages } }` shape, matching `AdminReportListResponse`
- Applied `result.data ?? []` null guard in the map page and `res.data ?? []` in the list page as belt-and-suspenders protection

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix list_admin_reports — add COUNT subquery and ward LEFT JOIN** - `4ba89f2` (feat)
2. **Task 2: Fix admin_list_reports handler — correct JSON shape and null guards** - `8742cc4` (fix)

**Plan metadata:** _(docs commit follows this summary)_

## Files Created/Modified

- `backend/src/db/admin_queries.rs` - Added `build_report_where_clause()` private helper, `count_admin_reports()` public async fn, updated `list_admin_reports` SELECT to include LEFT JOIN wards and ward_name; 4 new unit tests
- `backend/src/handlers/admin.rs` - `admin_list_reports` handler now calls both `list_admin_reports` and `count_admin_reports` via `tokio::try_join!`, computes `total_pages`, returns correct JSON shape
- `frontend/app/admin/reports/map/page.tsx` - `setReports(result.data ?? [])` null guard
- `frontend/app/admin/reports/page.tsx` - `setReports(res.data ?? [])` null guard

## Decisions Made

- **Shared WHERE clause builder:** `build_report_where_clause()` private function takes the same 5 filter params and `start_idx` and returns `(String, i32)`. Both `list_admin_reports` and `count_admin_reports` call it — eliminating the risk of the WHERE clauses drifting apart and producing mismatched list vs count results.
- **Concurrent list + count via `tokio::try_join!`:** Both queries are independent so they run in parallel, keeping the handler at one network round-trip overhead rather than two.
- **total_pages minimum 1:** `((total_count + limit - 1) / limit).max(1)` ensures the frontend pagination UI never renders zero pages even when the DB is empty.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Admin reports list and map pages will populate correctly once the running stack picks up the new backend binary
- UAT items "No reports found" and "TypeError on .filter()" are resolved
- Phase 2 (Anti-Abuse) and Phase 3 (Government Workflow) can proceed; the admin reports API now has a stable, frontend-matching contract

---
*Phase: 01-ward-foundation*
*Completed: 2026-03-12*
