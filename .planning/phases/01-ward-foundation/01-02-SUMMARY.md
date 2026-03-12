---
phase: 01-ward-foundation
plan: "02"
subsystem: backend
tags: [rust, axum, postgis, ward-lookup, organizations, api-endpoints, sqlx]

# Dependency graph
requires:
  - 01-01-ward-schema
provides:
  - "get_ward_for_point() function in db/queries.rs (ST_Within PostGIS lookup)"
  - "Ward and Organization model structs (models/ward.rs, models/organization.rs)"
  - "insert_report() updated with ward_id parameter"
  - "GET /api/admin/organizations endpoint"
  - "PATCH /api/admin/users/:id/org endpoint"
  - "Ward auto-assignment in create_report handler (non-fatal on failure)"
affects:
  - 01-03-org-hierarchy
  - 02-anti-abuse
  - 03-government-workflow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ward lookup non-fatal pattern: unwrap_or_else(|e| { tracing::warn!(...); None }) — failure never blocks report submission"
    - "ST_MakePoint($2, $1): longitude is $2 (X), latitude is $1 (Y) — documented in code and tests"
    - "SQL-string unit tests (no live DB): query strings asserted for correct PostGIS syntax"

key-files:
  created:
    - backend/src/models/ward.rs
    - backend/src/models/organization.rs
  modified:
    - backend/src/models/mod.rs
    - backend/src/models/report.rs
    - backend/src/db/queries.rs
    - backend/src/db/admin_queries.rs
    - backend/src/handlers/reports.rs
    - backend/src/handlers/admin.rs
    - backend/src/main.rs

key-decisions:
  - "ward_id included in all SELECT RETURNING lists in queries.rs — ensures Report struct always reflects the DB column state"
  - "ward_name added as Option<String> to ReportResponse with skip_serializing_if=None — public endpoint returns null-absent; admin can populate when joining"
  - "admin_assign_user_org requires admin role via middleware::auth::require_role — reviewer cannot re-assign org scoping"
  - "Organization model lives in models/organization.rs separate from report.rs — single responsibility, matches Ward pattern"

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 1 Plan 02: Ward Rust Layer and Organization API Summary

**Rust ward lookup with PostGIS ST_Within, org CRUD admin endpoints, and ward auto-assignment wired non-fatally into create_report**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T04:21:23Z
- **Completed:** 2026-03-12T04:26:21Z
- **Tasks:** 2
- **Files created/modified:** 9

## Accomplishments

- New `backend/src/models/ward.rs`: `Ward` (FromRow) and `WardResponse` (Serialize) structs with `From<Ward>` conversion
- New `backend/src/models/organization.rs`: `Organization` (FromRow) and `OrganizationResponse` (Serialize) structs with `From<Organization>` conversion
- Updated `models/report.rs`: added `ward_id: Option<Uuid>` to `Report` struct; added `ward_name: Option<String>` to `ReportResponse` (skip_serializing_if=None for public endpoint privacy)
- Updated `db/queries.rs`: added `get_ward_for_point(pool, lat, lng)` with correct PostGIS coordinate order (`ST_MakePoint($2, $1)` — longitude first); updated `insert_report`, `list_reports`, `get_report_by_id` to include `ward_id` in all SELECT/RETURNING lists
- Updated `db/admin_queries.rs`: added `list_organizations()` (ORDER BY org_type, name) and `assign_user_org()` functions
- Updated `handlers/reports.rs`: wired `get_ward_for_point` call between bbox validation and EXIF strip; failure logs warning and continues with `ward_id = None`
- Updated `handlers/admin.rs`: added `admin_list_organizations` (GET /api/admin/organizations) and `admin_assign_user_org` (PATCH /api/admin/users/:id/org) handlers with `AssignOrgRequest` struct
- Updated `main.rs`: registered both new routes under `admin_protected_router`
- All 203 tests pass (196 unit + 7 migration integration); 19 new tests added

## Task Commits

Each task was committed atomically:

1. **Task 1: Ward and Organization model structs + ward lookup query** - `4f4180f` (feat)
2. **Task 2: Wire ward lookup into create_report and add org API endpoints** - `a54f4b8` (feat)

## Files Created/Modified

- `backend/src/models/ward.rs` - Ward + WardResponse structs; 3 unit tests
- `backend/src/models/organization.rs` - Organization + OrganizationResponse structs; 4 unit tests
- `backend/src/models/mod.rs` - Added pub mod ward, pub mod organization
- `backend/src/models/report.rs` - ward_id field + ward_name in response; updated test helper
- `backend/src/db/queries.rs` - get_ward_for_point(); updated insert_report/list_reports/get_report_by_id with ward_id; 3 unit tests
- `backend/src/db/admin_queries.rs` - list_organizations(), assign_user_org(); 2 SQL string unit tests
- `backend/src/handlers/reports.rs` - Ward lookup wired after bbox check; 1 unit test
- `backend/src/handlers/admin.rs` - admin_list_organizations, admin_assign_user_org, AssignOrgRequest; 2 unit tests
- `backend/src/main.rs` - Two new admin routes registered

## Decisions Made

- **Non-fatal ward lookup**: `get_ward_for_point` failure uses `unwrap_or_else` — logs a warning, stores `ward_id = NULL`. Report submission is never blocked by PostGIS unavailability.
- **ST_MakePoint($2, $1) coordinate order**: longitude is the X parameter (first arg to MakePoint) but bound as `$2`; latitude is Y and bound as `$1`. This matches PostGIS convention and is tested to prevent regression.
- **ward_name skip_serializing_if=None**: public endpoint never exposes ward_name; field is present in struct so admin handlers can populate it without changing response shape.
- **admin_assign_user_org requires admin role**: reviewer cannot change org scoping — enforced via `require_role(&claims, "admin")` before DB call.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `backend/src/models/ward.rs` — FOUND
- `backend/src/models/organization.rs` — FOUND
- `get_ward_for_point` in `db/queries.rs` — FOUND
- `list_organizations` in `db/admin_queries.rs` — FOUND
- `admin_list_organizations` in `handlers/admin.rs` — FOUND
- `ward_id` in `models/report.rs` — FOUND
- `/api/admin/organizations` in `main.rs` — FOUND
- Commits 4f4180f, a54f4b8 — VERIFIED via `cargo test` green (203 tests)

---
*Phase: 01-ward-foundation*
*Completed: 2026-03-12*
