---
phase: 07-admin-triage-ux-public-map
plan: "07"
subsystem: ui
tags: [recharts, leaflet, react-leaflet, next-js, css, mobile-safari, safe-area]

# Dependency graph
requires:
  - phase: 07-02
    provides: admin report management endpoints and ward boundaries API
  - phase: 07-04
    provides: corp/ward filter UI in reports/page.tsx (plan owns filter bar region)

provides:
  - .admin-safe-bottom CSS utility (padding-bottom: calc(56px + env(safe-area-inset-bottom)))
  - Bottom-nav safe-area clearance on admin ops dashboard and reports queue (MOB-01, MOB-02)
  - Leaflet controls offset above bottom nav on admin /map (MOB-07)
  - TrendChart explicit wrapper height (300px) for iOS Safari ResponsiveContainer fix (MOB-03)
  - TrendChart legendFormatter prop using getCategoryLabel for human-readable enum labels (MOB-04)
  - ChoroplethMap explicit wrapper height (400px) + null boundary graceful fallback (MOB-05, MOB-06)

affects:
  - admin portal mobile UX
  - analytics page
  - admin reports map page

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recharts ResponsiveContainer iOS fix: wrap in div with explicit px height; Container uses height:100%"
    - "JSX ternary comment placement: inline comments invalid inside ternary ( ) — remove or use fragment"
    - "Leaflet choropleth: outer div height must be explicit px; MapContainer height matches; inner wrapper height:100%"

key-files:
  created: []
  modified:
    - frontend/app/admin/admin.css
    - frontend/app/admin/page.tsx
    - frontend/app/admin/reports/page.tsx
    - frontend/app/admin/reports/map/page.tsx
    - frontend/app/admin/analytics/page.tsx
    - frontend/app/admin/analytics/ChoroplethMap.tsx
    - frontend/app/admin/components/TrendChart.tsx

key-decisions:
  - "TrendChart accepts optional legendFormatter prop; defaults to getCategoryLabel(value).en internally — callers can override or rely on default"
  - "Recharts iOS Safari fix uses explicit pixel height on wrapper div (300px) + ResponsiveContainer height:100% — not fixed width/height on LineChart directly"
  - "Choropleth wrapper height set in analytics/page.tsx (400px) matching MapContainer; ChoroplethMap itself uses height:100% to fill parent"

patterns-established:
  - "Pattern: admin scroll containers that need bottom-nav clearance apply .admin-safe-bottom from admin.css"
  - "Pattern: Recharts on iOS — always explicit pixel height on wrapper div, never rely on 100% alone"

requirements-completed: [MOB-01, MOB-02, MOB-03, MOB-04, MOB-05, MOB-06, MOB-07]

# Metrics
duration: 20min
completed: 2026-06-23
status: complete
---

# Phase 07 Plan 07: Mobile Safari Admin Layout Fixes Summary

**Seven admin portal mobile Safari bugs fixed via CSS safe-area utilities, explicit Recharts chart heights, getCategoryLabel legend formatter, and Leaflet choropleth wrapper sizing — no behavior or data changes.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-23T16:00:00Z
- **Completed:** 2026-06-23T16:23:03Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Admin ops dashboard and reports queue scroll content clear the 56px bottom nav on iOS Safari (MOB-01, MOB-02)
- Admin /map Leaflet legend and attribution sit above the bottom nav via `calc(56px + env(safe-area-inset-bottom))` (MOB-07)
- Reports-per-week Recharts chart renders data lines on mobile — fixed by adding explicit 300px height on wrapper div (MOB-03)
- Chart legend shows "Damaged Footpath", "Blocked Footpath" etc. via getCategoryLabel formatter instead of raw enum strings (MOB-04)
- Ward choropleth visible on mobile without horizontal scroll — explicit 400px wrapper div + ChoroplethMap height:100% fill (MOB-05)
- Null GeoJSON boundaries handled gracefully by `boundaries &&` guard; fetchError shows accessible alert (MOB-06)
- `npm run lint` passes with zero warnings; `npm run build` compiles all 16 routes successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Bottom-nav safe-area padding (MOB-01, MOB-02, MOB-07)** - `2bf89fe` (fix) — committed prior to this session
2. **Task 2: Analytics chart height + legend formatter + choropleth visibility (MOB-03, MOB-04, MOB-05, MOB-06)** - `0bb4c48` (fix)
3. **Task 3: Verify lint + build pass** — no code changes; lint and build verified clean

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `frontend/app/admin/admin.css` — added `.admin-safe-bottom` utility (`padding-bottom: calc(56px + env(safe-area-inset-bottom))`)
- `frontend/app/admin/page.tsx` — ops dashboard scrollable container applies `.admin-safe-bottom`
- `frontend/app/admin/reports/page.tsx` — reports queue page-level container applies `.admin-safe-bottom`
- `frontend/app/admin/reports/map/page.tsx` — map wrapper gets `paddingBottom: calc(56px + env(safe-area-inset-bottom))` for Leaflet controls
- `frontend/app/admin/analytics/page.tsx` — explicit 400px choropleth wrapper div; legendFormatter prop passed to TrendChart; JSX syntax error fixed
- `frontend/app/admin/analytics/ChoroplethMap.tsx` — wrapper `height: 100%, width: 100%`; MapContainer `width: 100%`
- `frontend/app/admin/components/TrendChart.tsx` — `legendFormatter` prop; wrapper div `height: 300`; Legend `formatter` uses prop or getCategoryLabel fallback

## Decisions Made

- TrendChart accepts optional `legendFormatter?: (value: string) => string` prop. When provided by parent it uses it; otherwise falls back to `getCategoryLabel(value).en` — keeps TrendChart independently useful and lets analytics/page.tsx wire the specific label logic.
- Recharts iOS Safari fix: explicit `px` on wrapper div `height: 300`, then `ResponsiveContainer height="100%"` — this is the canonical pattern; do NOT use only `height="100%"` on ResponsiveContainer or it collapses on iOS.
- Choropleth wrapper sizing split: `analytics/page.tsx` provides the authoritative `height: 400` (single source of truth matching MapContainer); `ChoroplethMap` uses `height: 100%` to fill it. Avoids duplicating the pixel value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed JSX syntax error in analytics/page.tsx**
- **Found during:** Task 2 (analytics chart fixes)
- **Issue:** A JSX-style comment `{/* ... */}` was placed directly inside a ternary expression's `( )` context — invalid JSX that TypeScript reported as "')' expected" at line 159
- **Fix:** Removed the inline JSX comment; the intent is documented in TrendChart.tsx's prop JSDoc
- **Files modified:** `frontend/app/admin/analytics/page.tsx`
- **Verification:** `npx tsc --noEmit` shows zero errors in analytics files after fix
- **Committed in:** `0bb4c48` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix)
**Impact on plan:** The syntax error would have caused build failure; auto-fix was essential. No scope creep.

## Issues Encountered

- The working tree already had partial Task 2 changes (uncommitted) from a prior interrupted session. The JSX comment syntax error in those changes was caught by TypeScript and fixed before committing.

## Known Stubs

None. All MOB fixes wire directly to existing data sources; no placeholder values or TODO text introduced.

## Threat Flags

None. CSS and chart config changes only; no new network endpoints, auth paths, or schema changes.

## Next Phase Readiness

- All seven MOB bugs resolved; admin portal ready for mobile Safari use
- Phase 07 Plan 07 is the final plan in Phase 07 wave 4
- Phase 07 complete when all plans in all waves are merged

## Self-Check: PASSED

- SUMMARY.md: FOUND
- analytics/page.tsx: FOUND
- ChoroplethMap.tsx: FOUND
- TrendChart.tsx: FOUND
- Commit 0bb4c48: FOUND
- Commit 2bf89fe: FOUND

---
*Phase: 07-admin-triage-ux-public-map*
*Completed: 2026-06-23*
