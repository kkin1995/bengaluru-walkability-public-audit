---
phase: 07-admin-triage-ux-public-map
plan: 11
subsystem: frontend/public-map
status: complete
tags: [triage, status-filter, bucketing, tdd, gap-closure]
requirements: [TRIAGE-03]

dependency_graph:
  requires: []
  provides:
    - "publicStatusMatches(status, bucket) — single shared bucketing predicate in translations.ts"
    - "TRIAGE-03 closed — status chip filter consistent between counts and render"
  affects:
    - frontend/app/lib/translations.ts
    - frontend/app/components/ReportsMap.tsx
    - frontend/app/map/page.tsx

tech_stack:
  added: []
  patterns:
    - "Delegate render filter to shared helper — prevents count/render drift"
    - "publicStatusMatches reuses publicStatusLabel — single source of bucketing truth"
    - "TDD RED/GREEN cycle with regression-guard tests"

key_files:
  created:
    - path: frontend/app/lib/__tests__/publicStatusMatch.test.ts
      description: "14 unit tests covering all bucket combos including TRIAGE-03 regression guards"
  modified:
    - path: frontend/app/lib/translations.ts
      description: "Added exported publicStatusMatches(status, bucket) delegating to publicStatusLabel"
    - path: frontend/app/components/ReportsMap.tsx
      description: "Replaced divergent reportStatusMatch with publicStatusMatches; import updated"
    - path: frontend/app/map/page.tsx
      description: "Removed dead statusMatch() helper (defined but never called)"

decisions:
  - "publicStatusMatches delegates to publicStatusLabel — guarantees buckets cannot drift between callers"
  - "Removed dead statusMatch() from map/page.tsx — previously defined but never called"
  - "TDD approach: RED commit first, then GREEN, regression guards encode exact defect"

metrics:
  duration: "137 seconds (~2 min)"
  completed_date: "2026-06-24T06:31:13Z"
  tasks_completed: 3
  files_modified: 4
---

# Phase 07 Plan 11: TRIAGE-03 Status Bucket Consistency Fix Summary

**One-liner:** Single `publicStatusMatches()` helper eliminates count/render drift — acknowledged/assigned now correctly in Open bucket everywhere.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Add failing tests for publicStatusMatches | fdd7009 | frontend/app/lib/__tests__/publicStatusMatch.test.ts |
| 1 (GREEN) | Add publicStatusMatches to translations.ts | 6400795 | frontend/app/lib/translations.ts |
| 2 | Replace ReportsMap inline reportStatusMatch | 1bc647e | frontend/app/components/ReportsMap.tsx, frontend/app/map/page.tsx |
| 3 | Verify lint and build clean | 5b932ee | (no files — verification only) |

## Root Cause Fixed

Two divergent bucketing functions existed for the same three status chips:

- **Chip counts** in `map/page.tsx` (`statusCounts`) bucketed via `publicStatusLabel`:
  `open | acknowledged | assigned → "Open"`, `in_progress → "In progress"`
- **Render filter** in `ReportsMap.tsx` (`reportStatusMatch`) bucketed as:
  `in_progress → acknowledged || assigned || in_progress` — putting acknowledged/assigned into the wrong bucket

An `acknowledged` report was counted under "Open" but rendered under "In progress" — exactly the TRIAGE-03 defect. The chip read "In progress · 0" while an acknowledged/assigned report still appeared on the map when "In progress" was selected.

## Fix

Exported `publicStatusMatches(status, bucket)` in `translations.ts` that delegates to `publicStatusLabel`. This is the single source of truth for status bucketing:

```typescript
export function publicStatusMatches(
  status: string,
  bucket: "all" | "open" | "in_progress" | "resolved"
): boolean {
  if (bucket === "all") return true;
  const labelMap = { open: "Open", in_progress: "In progress", resolved: "Resolved" };
  return publicStatusLabel(status) === labelMap[bucket];
}
```

`ReportsMap.tsx` now calls `publicStatusMatches(r.status, statusFilter)` in the marker filter — guaranteeing acknowledged/assigned always match "Open", never "In progress".

## Verification

- `npx jest app/lib/__tests__/publicStatusMatch.test.ts`: 14 tests pass, 0 failures
- Regression guards pass: `publicStatusMatches("acknowledged", "in_progress") === false`
- `grep -c "acknowledged.*||.*assigned.*||.*in_progress" ReportsMap.tsx` returns 0 (divergent code gone)
- `npm run lint`: 0 ESLint warnings or errors
- `npm run build`: compiled successfully, all 16 routes generated

## Deviations from Plan

**1. [Rule 1 - Auto-fix] Removed dead statusMatch() in map/page.tsx**
- **Found during:** Task 2
- **Issue:** `statusMatch()` was defined in `map/page.tsx` (lines 40-43) but never called anywhere in the file
- **Fix:** Removed the dead function per plan instruction ("if the now-unused local statusMatch helper is not referenced anywhere after this change, remove it")
- **Files modified:** `frontend/app/map/page.tsx`
- **Commit:** 1bc647e

## Known Stubs

None. All filters are wired to real data.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. Client-side filter only — all data is already public GeoJSON. No new threat flags.

## Self-Check: PASSED

- [x] `frontend/app/lib/__tests__/publicStatusMatch.test.ts` exists
- [x] `frontend/app/lib/translations.ts` exports `publicStatusMatches`
- [x] `frontend/app/components/ReportsMap.tsx` imports and calls `publicStatusMatches`
- [x] Commits fdd7009, 6400795, 1bc647e, 5b932ee exist in git log
