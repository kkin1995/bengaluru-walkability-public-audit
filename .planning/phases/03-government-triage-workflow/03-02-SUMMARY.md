---
phase: 03-government-triage-workflow
plan: 02
subsystem: backend-api
tags:
  - axum
  - multipart
  - sqlx
  - postgres
  - rust
  - wflow-01
  - wflow-02
  - wflow-03
  - wflow-04
  - wflow-05
dependency_graph:
  requires:
    - 03-01  # migrations 008/009/010 + model updates
  provides:
    - resolve-report-endpoint
    - assign-org-endpoint
    - admin-list-corporation-field
    - public-report-detail-with-history-and-ward-hierarchy
  affects:
    - 03-03  # admin UI consumes corporation field + new endpoints
    - 03-04  # public /reports/[id] page consumes history + ward_hierarchy
tech_stack:
  added: []
  patterns:
    - multipart-field-collect-before-validate  # Pitfall 7
    - transactional-update-plus-history-insert
    - left-join-ward-hierarchy
    - privacy-guard-public-status-history
key_files:
  created: []
  modified:
    - backend/src/db/admin_queries.rs
    - backend/src/db/queries.rs
    - backend/src/handlers/admin.rs
    - backend/src/handlers/reports.rs
    - backend/src/main.rs
    - backend/src/models/admin.rs
decisions:
  - "Named new report-org request struct ReportAssignOrgRequest (not AssignOrgRequest) to avoid conflict with existing user-org AssignOrgRequest; documented in handler"
  - "strip_exif visibility expanded to pub(crate) so admin handlers can reuse without duplication"
  - "get_report_by_id retained with #[allow(dead_code)] since it may be useful for future admin detail enhancement"
metrics:
  duration: ~35 minutes
  completed: 2026-05-26T05:27:00Z
  tasks_completed: 3
  files_modified: 6
---

# Phase 03 Plan 02 Summary: Backend API Handlers

## Status: COMPLETED

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | resolve_report + assign_report_org DB functions + list_admin_reports corporation extension | f931ae5 | Done |
| 2 | admin_resolve_report multipart handler + admin_assign_report_org JSON handler + route registration | c750c4e | Done |
| 3 | Public GET /api/reports/:id extension — get_report_with_detail (history + ward_hierarchy) | 034701f | Done |

## Files Modified

- `backend/src/db/admin_queries.rs` — Added `resolve_report` (transactional, validates status), `assign_report_org` (transactional, status='assigned'), extended `list_admin_reports` SELECT with `wards.corporation AS corporation` + corporation in JSON builder
- `backend/src/db/queries.rs` — Added `get_report_with_detail` (two queries: report+wards JOIN + status_history), privacy guards; `get_report_by_id` retained with #[allow(dead_code)]
- `backend/src/handlers/admin.rs` — Added `admin_resolve_report` (multipart, EXIF strip, path-traversal guard, photo cleanup on NotFound) + `admin_assign_report_org` (JSON); updated imports
- `backend/src/handlers/reports.rs` — `get_report` handler updated to call `get_report_with_detail`; `strip_exif` expanded to `pub(crate)`
- `backend/src/main.rs` — Registered `/api/admin/reports/:id/assign-org` and `/api/admin/reports/:id/resolve` behind `require_auth`
- `backend/src/models/admin.rs` — Added `ReportAssignOrgRequest { org_id: Uuid }` for report-to-org assignment

## Routes Registered

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| POST | /api/admin/reports/:id/resolve | admin_resolve_report | require_auth |
| POST | /api/admin/reports/:id/assign-org | admin_assign_report_org | require_auth |
| GET | /api/reports/:id | get_report (updated) | public |

## New DB Functions

| Function | Transaction | Status History |
|----------|-------------|---------------|
| resolve_report | Yes (pool.begin) | Yes (same tx) |
| assign_report_org | Yes (pool.begin) | Yes (same tx, note='Assigned to organization') |

## Public API JSON Shape Diff

`GET /api/reports/:id` now returns:
```json
{
  "id": "...",
  "created_at": "...",
  "image_url": "http://localhost:3001/uploads/uuid.jpg",
  "latitude": 12.971,
  "longitude": 77.594,
  "category": "broken_footpath",
  "severity": "high",
  "description": "...",
  "status": "resolved",
  "location_source": "exif_gps",
  "resolution_photo_url": "http://localhost:3001/uploads/uuid2.jpg",  // only when resolved
  "history": [
    {"status": "open", "changed_at": "..."},
    {"status": "resolved", "changed_at": "..."}
  ],
  "ward_hierarchy": {
    "ward_name": "Jayanagar",
    "corporation": "South",
    "zone_name": "Dasarahalli",
    "ro_division": "RO-...",
    "aro_sub_division": "ARO-...",
    "assembly_constituency": "Jayanagar",
    "assembly_constituency_no": 174,
    "parliamentary_constituency": "Bangalore South",
    "mla_name": "...",
    "mp_name": "..."
  }
}
```

Admin list per row now includes: `"corporation": "South"` (or null).

## Key Decisions / Deviations

### Rule 1 - Naming: ReportAssignOrgRequest vs AssignOrgRequest
- **Found during:** Task 2
- **Issue:** Plan specified adding `AssignOrgRequest` to models/admin.rs, but that name already exists in handlers/admin.rs for the user-to-org assignment endpoint (uses `Option<Uuid>` to support clearing). Two structs named identically would cause a namespace collision.
- **Fix:** Named the new struct `ReportAssignOrgRequest` with a clear doc comment distinguishing it from the user-org variant.
- **Files modified:** backend/src/models/admin.rs, backend/src/handlers/admin.rs
- **Commit:** c750c4e

### Rule 2 - Security: Photo cleanup on NotFound in resolve handler
- **Found during:** Task 2
- **Issue:** If `resolve_report` DB call returns `Ok(false)` (report not found), the resolution photo was already written to disk. Without cleanup this creates orphaned files.
- **Fix:** Added `tokio::fs::remove_file(&write_path).await` (best-effort) before returning NotFound error.
- **Files modified:** backend/src/handlers/admin.rs
- **Commit:** c750c4e

### cargo sqlx prepare — no queries found
- This project uses runtime `sqlx::query` (not compile-time `sqlx::query!` macros) as noted at the top of admin_queries.rs. The .sqlx directory is intentionally empty. `cargo sqlx prepare` produces "no queries found" which is expected.

## Verification Results

- `cargo build`: PASSED (0 errors)
- `cargo clippy -- -D warnings`: PASSED (0 warnings in project code; 1 external-crate future-compat warning for sqlx-postgres)
- `cargo test`: PASSED — 239 tests passed, 0 failed (from backend unit tests + migration_phase2_test)
- `cargo sqlx prepare`: No-op (runtime queries; .sqlx remains empty as expected)

## Threat Model Coverage

All 9 STRIDE threats from the plan's `<threat_model>` are mitigated:
- T-03-02-01: EXIF stripped via `strip_exif` before disk write
- T-03-02-02: Path traversal prevented via canonicalize + parent-directory check
- T-03-02-03: Photo required gate via `validate_resolve_request` + DB-layer guard
- T-03-02-04: status_history.note never selected in public query (privacy comment + test grep)
- T-03-02-05: resolution_notes never in JSON response from `get_report_with_detail`
- T-03-02-06: FK constraint on assigned_org_id enforces referential integrity
- T-03-02-07: require_auth middleware validates JWT signature
- T-03-02-08: Any admin role allowed (D-07) — no require_role gate on new routes
- T-03-02-09: list_admin_reports already behind require_auth; corporation is civic data

## Self-Check: PASSED
