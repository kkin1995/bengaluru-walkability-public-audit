---
phase: 01-ward-foundation
plan: 05
subsystem: database
tags: [postgres, sql, ward, admin, rust]

# Dependency graph
requires:
  - phase: 01-ward-foundation
    provides: "LEFT JOIN wards added to list_admin_reports in plan 04"
provides:
  - "Correct wards.ward_name column reference in list_admin_reports production SQL"
  - "Matching correction in unit test SQL string"
affects: [admin-triage, ward-display, WARD-01]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - backend/src/db/admin_queries.rs

key-decisions:
  - "Two-word surgical fix only: wards.name → wards.ward_name in both production SQL (line 301) and test SQL (line 855) — nothing else changed"

patterns-established: []

requirements-completed: [WARD-01]

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 1 Plan 05: Fix wards.ward_name Column Reference Summary

**Surgical two-line fix correcting wards.name → wards.ward_name in list_admin_reports SQL, unblocking ward name display in the admin triage queue**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-12T09:40:00Z
- **Completed:** 2026-03-12T09:45:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Corrected wrong column reference `wards.name AS ward_name` → `wards.ward_name AS ward_name` in the production SQL at line 301 of `admin_queries.rs`
- Applied the same fix to the mirrored unit test SQL string at line 855 so the test now validates the correct column name
- All 207 backend tests pass with no regressions (200 unit + 7 migration tests)
- WARD-01 is now closed: at runtime, ward names will resolve correctly for reports inside a ward boundary

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix wards.name → wards.ward_name in production SQL and unit test SQL** - `0356afc` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/src/db/admin_queries.rs` - Two character-for-character replacements only; no structural changes

## Decisions Made
Two-word surgical fix only — no other changes to the query, column order, JOIN clause, or assertions. The existing `assert!(sql.contains("ward_name"))` test already passes after the fix because `ward_name` appears in both the column qualifier and the alias.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The two occurrences were exactly where the plan specified (lines 301 and 855). Fix was straightforward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- WARD-01 gap is closed; admin triage queue will now show correct ward names at runtime
- Phase 1 gap closure plans 05 and 06 are the final items; after plan 06 Phase 1 is complete
- No blockers introduced by this fix

---
*Phase: 01-ward-foundation*
*Completed: 2026-03-12*
