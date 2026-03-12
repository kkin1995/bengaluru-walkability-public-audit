---
phase: 01-ward-foundation
plan: 06
subsystem: api
tags: [rust, axum, sqlx, postgres, postgis, org-scoping, ward, admin]

# Dependency graph
requires:
  - phase: 01-ward-foundation
    provides: organizations table, admin_users.org_id FK, assign endpoint (Plan 05)
provides:
  - Org-scoped report visibility in admin triage queue (WARD-03 Success Criterion #3)
  - wards.org_id FK to organizations via migration 006
  - list_admin_reports and count_admin_reports with recursive CTE org-scoping
  - admin_list_reports handler that fetches org_id from DB per request
affects: [02-anti-abuse, 03-government-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recursive CTE (WITH RECURSIVE org_subtree) for walking org hierarchy downward"
    - "Per-request DB lookup of org_id from admin_users using claims.sub (no JWT re-issue needed)"
    - "Dynamic SQL WHERE clause composition with org_id parameter appended after filter params"

key-files:
  created:
    - backend/migrations/006_ward_org_scoping.sql
  modified:
    - backend/src/models/admin.rs
    - backend/src/db/admin_queries.rs
    - backend/src/handlers/admin.rs

key-decisions:
  - "org_id NOT stored in JwtClaims — fetched from DB per request via claims.sub to avoid token re-issue on every org reassignment"
  - "wards.org_id FK added via migration 006 — enables direct JOIN in recursive CTE scoping query"
  - "When wards.org_id is NULL (all wards initially), org-scoped admins see zero reports — correct behavior per STATE.md blocker (GBA org structure unconfirmed)"
  - "Recursive CTE uses UNION ALL (not UNION) to walk org tree downward from admin's assigned org through parent_id links"

patterns-established:
  - "Org-scoping via recursive CTE: pattern established for future org-tree traversal queries"
  - "Handler DB lookup pattern: fetch calling user's metadata per-request for auth-sensitive decisions"

requirements-completed: [WARD-03]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 1 Plan 06: Org-Scoped Report Visibility Summary

**Recursive CTE org-scoping in admin report queries: org-assigned admins see only reports in their org's ward subtree, unscoped admins see all reports**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T09:58:44Z
- **Completed:** 2026-03-12T10:02:41Z
- **Tasks:** 2
- **Files modified:** 4 (including 1 new migration)

## Accomplishments
- Added `org_id: Option<Uuid>` to `AdminUser` struct and `AdminUserRow`, wired through `From` conversion and `ADMIN_USER_COLS`
- Extended `list_admin_reports` and `count_admin_reports` with `org_id: Option<Uuid>` parameter that appends a recursive CTE WHERE clause when Some
- Updated `admin_list_reports` handler to fetch calling admin's `org_id` from DB via `claims.sub` and pass it to both queries
- Created `006_ward_org_scoping.sql` migration adding `wards.org_id UUID REFERENCES organizations(id)` FK

## Task Commits

Each task was committed atomically:

1. **Task 1: Add org_id to AdminUser model and query signatures** - `7fd1eaf` (feat)
2. **Task 2: Wire org_id into admin_list_reports handler** - `cf63d7c` (feat)

**Plan metadata:** (docs commit — next)

_Note: TDD tasks had test (RED) → implementation (GREEN) cycle; tests passed in same commit after RED confirmed failures_

## Files Created/Modified
- `backend/migrations/006_ward_org_scoping.sql` - Adds wards.org_id UUID FK to organizations; idx_wards_org_id index
- `backend/src/models/admin.rs` - Added org_id: Option<Uuid> field to AdminUser struct; updated make_admin_user() test fixture
- `backend/src/db/admin_queries.rs` - Added org_id to AdminUserRow, ADMIN_USER_COLS, From conversion; added org_id param + recursive CTE to list/count queries; 4 new tests
- `backend/src/handlers/admin.rs` - Updated admin_list_reports to fetch org_id from DB and pass to both queries

## Decisions Made
- org_id not stored in JwtClaims — fetched from DB per request to avoid requiring token re-issue whenever org assignment changes
- wards.org_id FK added via new migration (006) — minimal schema addition enabling direct JOIN in CTE
- Zero-results behavior when wards.org_id is NULL (initially) is correct and expected per STATE.md blocker

## Deviations from Plan

None — plan executed exactly as written. Both tasks were implemented in sequence with TDD as specified. Handler update (Task 2) was needed to fix compile error from Task 1 signature changes, which aligned with the plan sequence.

## Issues Encountered
None — cargo check and cargo test passed cleanly after each step.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WARD-03 fully satisfied: org assignment controls report visibility in triage queue
- Org-scoping will remain a no-op (zero reports for scoped admins) until wards.org_id is seeded — correct and safe behavior
- Phase 1 all 6 plans complete — ready for Phase 2 (Anti-Abuse)

---
*Phase: 01-ward-foundation*
*Completed: 2026-03-12*
