---
phase: 02-anti-abuse-and-data-quality
plan: "03"
subsystem: ui
tags: [next.js, react, typescript, jest, react-testing-library, tailwind]

# Dependency graph
requires:
  - phase: 02-anti-abuse-and-data-quality/02-02
    provides: getDuplicatesForReport API, expandable duplicate row in ReportsTable, AdminReport type with duplicate_count/duplicate_of_id/duplicate_confidence
provides:
  - Sub-table with <thead>, ward_name, toLocaleDateString(), StatusBadge, and clickable anchor rows
  - Report detail page at /admin/reports/[id] fetching via getAdminReport()
  - data-testid="dupe-subtable" on inner table element
  - data-testid="status-badge" on StatusBadge component (both known-status and fallback spans)
affects:
  - Phase 03 (Government Workflow) — admins can now navigate from queue to individual report detail for triage decisions
  - Any future tests referencing StatusBadge — data-testid="status-badge" is now a stable contract

# Tech tracking
tech-stack:
  added: []
  patterns:
    - sr-only anchor + onClick=window.location.assign pattern for navigable <tr> rows (avoids invalid <a><tr> nesting while providing both keyboard and click access)
    - data-testid on shared UI primitives (StatusBadge) enables cross-component test assertions

key-files:
  created:
    - frontend/app/admin/components/__tests__/ReportsTable.subtable.test.tsx
    - frontend/app/admin/reports/[id]/__tests__/page.test.tsx
    - frontend/app/admin/reports/[id]/page.tsx
  modified:
    - frontend/app/admin/components/ReportsTable.tsx
    - frontend/app/admin/components/StatusBadge.tsx

key-decisions:
  - "sr-only anchor + onClick=window.location.assign used for navigable <tr> rows — <a> wrapping <tr> is invalid HTML; this pattern satisfies test assertions for href presence while maintaining semantic correctness"
  - "data-testid='status-badge' added to StatusBadge spans (both branches) — makes StatusBadge presence testable across all consumer components without mocking the component itself"
  - "jest.mock() factory cannot reference variables declared after it due to hoisting — mock fixture data moved before mock factory or set via beforeEach; documented as test authoring pattern"

patterns-established:
  - "Navigable table rows: sr-only <a href=...> in first cell + onClick=window.location.assign() on <tr> — provides keyboard access, DOM link for tests, and click navigation"
  - "Sub-table structure: <table data-testid='dupe-subtable'> with <thead> + <tbody>, formatters applied inline (toLocaleDateString, ward_name ?? '—', StatusBadge)"
  - "jest.mock() ordering: all jest.mock() calls grouped before any const fixture declarations to avoid hoisting-related ReferenceError"

requirements-completed: ["ABUSE-06"]

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 02 Plan 03: UAT Gap Closure — Sub-table and Report Detail Route Summary

**Admin duplicate sub-table now shows ward name, formatted dates, and StatusBadge pills with clickable rows linking to a new /admin/reports/[id] detail page showing photo, description, status, and all report fields**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T11:00:11Z
- **Completed:** 2026-03-13T11:04:41Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- Fixed ReportsTable duplicate sub-table: replaced UUID slice + raw ISO + plain status text with ward_name, toLocaleDateString(), and StatusBadge pills inside a proper <thead>/<tbody> structure
- Created /admin/reports/[id]/page.tsx: full report detail page with photo, category, severity, status, ward, dates, description, submitter info, and duplicate linkage info; loading and error states
- Added data-testid="status-badge" to StatusBadge component, making it testable across all consumer components
- 22 new tests across 2 test files, all passing; 608 total tests passing with zero regressions

## Task Commits

1. **Task 1: RED — failing tests** - `1e31856` (test)
2. **Task 2: GREEN — fix sub-table + create detail route** - `811f57f` (feat)

**Plan metadata:** committed with final docs commit

## Files Created/Modified

- `frontend/app/admin/components/__tests__/ReportsTable.subtable.test.tsx` — 10 tests for sub-table structure, data rendering, and navigation link
- `frontend/app/admin/reports/[id]/__tests__/page.test.tsx` — 12 tests for detail page data fetching, loading/error states, and content rendering
- `frontend/app/admin/reports/[id]/page.tsx` — new "use client" detail page using getAdminReport(), renders all report fields with loading/error handling
- `frontend/app/admin/components/ReportsTable.tsx` — sub-table replaced: Link import added, <thead> added, ward_name + formatted date + StatusBadge + sr-only anchor in rows
- `frontend/app/admin/components/StatusBadge.tsx` — data-testid="status-badge" added to both known-status span and fallback span

## Decisions Made

- Used sr-only anchor + onClick=window.location.assign pattern for navigable table rows to avoid invalid HTML (wrapping `<tr>` directly in `<a>` is not permitted). The sr-only anchor keeps an actual `href` attribute in the DOM for test assertions, while the onClick provides the click handler.
- Added data-testid="status-badge" to StatusBadge rather than mocking it in tests — this lets sub-table and detail page tests verify StatusBadge presence without brittle component mocks.
- Mock fixture data in the subtable test was hoisted into the file after jest.mock() calls (not inside them) after encountering a ReferenceError from jest's hoisting behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added data-testid="status-badge" to StatusBadge component**
- **Found during:** Task 2 (GREEN — implementing sub-table fix and detail route)
- **Issue:** StatusBadge had no data-testid attribute; plan required `data-testid="status-badge"` in both new test files but the component never emitted it — tests would fail even with correct page structure
- **Fix:** Added `data-testid="status-badge"` to both the known-status span and the fallback span in StatusBadge.tsx
- **Files modified:** frontend/app/admin/components/StatusBadge.tsx
- **Verification:** All 22 new tests pass including status-badge assertions; full 608-test suite passes with no regressions
- **Committed in:** 811f57f (Task 2 commit)

**2. [Rule 1 - Bug] Fixed jest.mock() hoisting ReferenceError in subtable test**
- **Found during:** Task 2 (running tests after implementation)
- **Issue:** mockDuplicateReport const was declared before jest.mock() in source order, but jest.mock() is hoisted to top of file at runtime — const was not initialized when the mock factory ran
- **Fix:** Moved jest.mock() calls before the const declaration; set getDuplicatesForReport.mockResolvedValue in beforeEach using the const after initialization; also switched two getByText to getAllByText for headers shared between main and sub-table thead
- **Files modified:** frontend/app/admin/components/__tests__/ReportsTable.subtable.test.tsx
- **Verification:** 10 subtable tests all pass GREEN
- **Committed in:** 811f57f (Task 2 commit, test file included in same commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both auto-fixes required for test correctness and component testability. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- UAT gap from Test 7 fully closed: sub-table now shows meaningful information (ward name, formatted date, status pill) and each row links to the full report detail page
- Admin triage workflow is now end-to-end: queue → expandable duplicates → navigate to full report detail
- StatusBadge data-testid="status-badge" is now a stable contract; any new component using StatusBadge can assert its presence via testid without mocking
- Phase 2 (Anti-Abuse and Data Quality) is now complete — all planned plans (01, 02, 03) executed
- Ready for Phase 3 (Government Workflow)

---
*Phase: 02-anti-abuse-and-data-quality*
*Completed: 2026-03-13*
