---
phase: 07-admin-triage-ux-public-map
plan: "01"
subsystem: backend
tags: [triage, admin, filters, ward, corporation, rust, axum, postgresql]
requirements: [TRIAGE-01]

dependency_graph:
  requires: []
  provides:
    - GET /api/admin/corporations (admin-gated, returns [{id, name}])
    - GET /api/admin/wards?corp_id= (admin-gated, returns [{id, ward_name, ward_number}])
    - AdminReportFilters.ward_id (Uuid filter param on /api/admin/reports)
    - AdminReportFilters.corporation_id (Uuid filter param on /api/admin/reports)
  affects:
    - backend/src/models/admin.rs
    - backend/src/db/admin_queries.rs
    - backend/src/handlers/admin.rs
    - backend/src/main.rs

tech_stack:
  added: []
  patterns:
    - sqlx::query() runtime parameterized queries (no macros — T-07-02 bound params)
    - Axum Query<T> extractor with Uuid deserialization for input rejection
    - admin_protected_router auth layer (T-07-01 access control)

key_files:
  created: []
  modified:
    - backend/src/models/admin.rs
    - backend/src/db/admin_queries.rs
    - backend/src/handlers/admin.rs
    - backend/src/main.rs

decisions:
  - ward_id and corporation_id added as Option<Uuid> to AdminReportFilters so Axum rejects non-UUID input at deserialization boundary (T-07-02)
  - corporation_id filter uses subquery pattern (reports.ward_id IN SELECT id FROM wards WHERE org_id = $N) rather than JOIN to keep the WHERE clause builder simple and composable
  - build_export_where_clause() passes None, None for ward/corp — export filtering out of scope for this phase (D-04)
  - cargo sqlx prepare reported no queries found — this project uses runtime sqlx::query() strings not compile-time macros; .sqlx/ is intentionally empty and offline builds are not affected

metrics:
  duration: "~10 minutes"
  completed: "2026-06-22T18:15:12Z"
  tasks_completed: 3
  tasks_total: 3

status: complete
---

# Phase 07 Plan 01: Admin Corp/Ward Filter — Backend Data Tier Summary

**One-liner:** Ward and corporation filter params wired end-to-end: two new admin-gated endpoints for filter options + ward_id/corporation_id filtering on the existing report list/count queries.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ward_id/corporation_id to AdminReportFilters and extend WHERE clause | dcad47b | backend/src/models/admin.rs, backend/src/db/admin_queries.rs, backend/src/handlers/admin.rs |
| 2 | Add corp/ward filter-option queries + admin-gated handlers + routes | 99b1df4 | backend/src/db/admin_queries.rs, backend/src/handlers/admin.rs, backend/src/main.rs |
| 3 | Regenerate SQLx offline metadata and run backend tests | (no files changed) | backend/.sqlx/ (empty — runtime queries, no macros) |

## What Was Built

### AdminReportFilters Extensions (Task 1)

Added two new optional fields to `AdminReportFilters` in `backend/src/models/admin.rs`:

```rust
pub ward_id: Option<uuid::Uuid>,
pub corporation_id: Option<uuid::Uuid>,
```

Axum's `Query<AdminReportFilters>` extractor deserializes these from query string. Non-UUID values are rejected at deserialization (HTTP 422) — satisfying T-07-02 (ASVS V5).

### build_report_where_clause Extension (Task 1)

Extended `build_report_where_clause()` with two new parameters (after `date_to`, before `start_idx`):

- `ward_id: Option<Uuid>` → appends `reports.ward_id = $N`
- `corporation_id: Option<Uuid>` → appends `reports.ward_id IN (SELECT id FROM wards WHERE org_id = $N)`

Both bind values as `$N` parameters — never string-interpolated (T-07-02). Parameter index threading follows the same pattern as existing category/status/severity conditions. The existing `org_id` recursive CTE scoping is unchanged and remains additive as an AND condition.

Updated all callers:
- `count_admin_reports()`: new `ward_id` + `corporation_id` params, bound after date filters but before org_id (matching WHERE clause order)
- `list_admin_reports()`: same
- `build_export_where_clause()`: passes `None, None` — export filtering out of scope this phase
- All test call sites in the `#[cfg(test)]` module updated to 8-argument form

Added new TRIAGE-01 test: `build_report_where_clause_with_ward_and_corp_advances_param_idx` verifies both conditions are emitted with correct parameter indices.

### New Query Functions (Task 2)

**`list_distinct_corporations(pool)`** (`backend/src/db/admin_queries.rs`):
```sql
SELECT id, name FROM organizations WHERE org_type = 'corporation' ORDER BY name
```
Returns `Vec<(Uuid, String)>` — stable UUID keys for the admin Corp filter select.

**`list_wards_for_filter(pool, corp_id: Option<Uuid>)`** (`backend/src/db/admin_queries.rs`):
```sql
SELECT id, ward_name, ward_number FROM wards
WHERE ($1::uuid IS NULL OR org_id = $1)
ORDER BY ward_number
```
Returns `Vec<(Uuid, String, i32)>`. Corp_id bound as `$1` — fully parameterized (T-07-02).

### New Handlers (Task 2)

**`admin_list_corporations`** (`backend/src/handlers/admin.rs`):
- Extension(claims) auth → admin_protected_router gates it (T-07-01)
- Returns `Json([{"id": <uuid>, "name": <string>}])` array

**`admin_list_wards`** (`backend/src/handlers/admin.rs`):
- Extension(claims) auth + `Query<WardFilterParams>` (corp_id: Option<Uuid>)
- Returns `Json([{"id": <uuid>, "ward_name": <string>, "ward_number": <i32>}])` array
- Invalid corp_id (non-UUID) → 422 Unprocessable Entity at deserialization (T-07-02)

### Route Registration (Task 2)

Both routes registered inside `admin_protected_router` (not the public `app` Router):
```rust
.route("/api/admin/corporations", get(admin_list_corporations))
.route("/api/admin/wards", get(admin_list_wards))
```
The `require_auth` middleware layer applies automatically — satisfying T-07-01 (ASVS V4 L1).

### SQLx Metadata + Tests (Task 3)

`cargo sqlx prepare` reported "no queries found" — expected, as this project uses runtime `sqlx::query()` strings, not compile-time `sqlx::query!` macros. The `.sqlx/` directory remains empty and unchanged; offline Docker builds are not affected.

`cargo test`: 250 tests passed, 0 failed across all test suites (unit tests in admin_queries.rs, admin.rs, handlers/reports.rs, and integration tests).

## Deviations from Plan

None — plan executed exactly as written.

The only notable discovery: the plan said to "commit the updated .sqlx/ files" in Task 3, but `cargo sqlx prepare` correctly reported no queries to prepare since the project uses runtime SQL strings. This is not a deviation — the RESEARCH.md note (Risk 3) already documented this: "The project uses runtime sqlx::query() strings, so there are no macro-level compile errors — only offline build failures. cargo test and cargo run with a live DB will work without cargo sqlx prepare. Only Docker builds without a live DB require it." Since no compile-time queries were added, no metadata update was required.

## Security Audit (Threat Model)

All mitigations from the plan's threat model applied:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-07-01 | Both new routes registered inside admin_protected_router — JWT auth layer applies |
| T-07-02 | corp_id/ward_id deserialized as Option<Uuid> — invalid input rejected at Axum extraction boundary; all SQL uses $N bound params, no interpolation |
| T-07-SC | No new crates added — Uuid/serde_json/sqlx already in tree |

T-07-03 (scoped admin filtering) is satisfied by the existing org_id recursive CTE which remains unchanged; out-of-scope wards yield zero rows.

## Known Stubs

None. This plan is backend-only (data tier). The admin frontend filter UI is Plan 04.

## Threat Flags

None. No new network endpoints beyond what the plan specified; no PII exposure; ward/corp data is non-sensitive organizational metadata.

## Self-Check

Files created/modified:
- `backend/src/models/admin.rs` — FOUND: ward_id + corporation_id fields present
- `backend/src/db/admin_queries.rs` — FOUND: list_distinct_corporations + list_wards_for_filter present
- `backend/src/handlers/admin.rs` — FOUND: admin_list_corporations + admin_list_wards present
- `backend/src/main.rs` — FOUND: /api/admin/corporations + /api/admin/wards routes registered

Commits:
- dcad47b — feat(07-01): add ward_id/corporation_id to AdminReportFilters and extend WHERE clause
- 99b1df4 — feat(07-01): add list_distinct_corporations/list_wards_for_filter queries + admin handlers + routes
