---
phase: 01-ward-foundation
plan: 03
subsystem: ui
tags: [react, next.js, typescript, admin-dashboard, leaflet, nginx, csp]

# Dependency graph
requires:
  - phase: 01-ward-foundation plan 01
    provides: wards table, ward lookup in create_report, GET /api/admin/organizations, PATCH /api/admin/users/:id/org
  - phase: 01-ward-foundation plan 02
    provides: backend ward and org API handlers, adminApi.ts types
provides:
  - Ward name column in admin reports triage queue (ward_name or em-dash placeholder)
  - Org assignment UI on admin users management page (Unassigned or org name + select control)
  - listOrganizations() and assignUserOrg() typed API calls in adminApi.ts
  - nginx CSP allowing unpkg.com for Leaflet CSS/images on /admin routes
  - Null guard on ReportsTable preventing crash when reports prop is undefined
affects:
  - phase 02 (anti-abuse) — admin dashboard stability required before abuse monitoring
  - phase 03 (government workflow) — org assignment UI is prerequisite for GBA triage routing

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ReportsTable receives reports as nullable-safe prop — always guard array access with !reports check
    - nginx CSP admin block includes https://unpkg.com for Leaflet CDN assets (style-src, img-src)
    - TDD red-green cycle for React admin page tests using jest.mock(@/app/admin/lib/adminApi)

key-files:
  created:
    - frontend/app/admin/__tests__/reports-page-ward.test.tsx
    - frontend/app/admin/__tests__/users-page-org.test.tsx
  modified:
    - frontend/app/admin/lib/adminApi.ts
    - frontend/app/admin/reports/page.tsx
    - frontend/app/admin/users/page.tsx
    - frontend/app/admin/components/ReportsTable.tsx
    - nginx/nginx.conf

key-decisions:
  - "unpkg.com added to both style-src and img-src in admin CSP — Leaflet loads CSS and marker PNGs from CDN"
  - "ReportsTable null guard (!reports) added defensively — typed as Report[] but Leaflet hydration timing can deliver undefined prop in SSR context"
  - "Sidebar hydration race (first-load flicker) documented as known behavior, not fixed — low priority UX issue with no correctness impact"

patterns-established:
  - "CSP admin block: when adding CDN-loaded libraries (Leaflet, etc.), always extend style-src and img-src explicitly"
  - "ReportsTable: guard array props with !arr check before .length or .map calls"

requirements-completed: [WARD-01, WARD-03]

# Metrics
duration: 25min
completed: 2026-03-12
---

# Phase 1 Plan 03: Ward Foundation Frontend Summary

**Admin reports triage queue now shows ward name per report, and users page shows org assignment UI — with nginx CSP fixed for Leaflet CDN and defensive null guard on ReportsTable**

## Performance

- **Duration:** ~25 min (continuation from checkpoint)
- **Started:** 2026-03-12T04:27:00Z
- **Completed:** 2026-03-12T04:43:19Z
- **Tasks:** 3 (Tasks 1 and 2 from prior agent session; Task 3 verification + fixes in this session)
- **Files modified:** 7

## Accomplishments
- Added `ward_name` column to admin reports triage table — shows ward name or em-dash for null
- Added org assignment dropdown to admin users page — shows "Unassigned" with select control per user
- Extended `adminApi.ts` with `Organization` type, `listOrganizations()`, and `assignUserOrg()`
- Fixed nginx CSP `style-src` and `img-src` to allow `https://unpkg.com` (Leaflet CDN)
- Fixed `ReportsTable` crash when `reports` prop is undefined on initial render
- 581 frontend tests passing, 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend adminApi.ts and write tests (TDD RED)** - `397a131` (test)
2. **Task 2: Add ward column and org assignment UI (TDD GREEN)** - `54acd1f` (feat)
3. **Task 3: Fix CSP and null guard (verification fixes)** - `4a1ea1f` (fix)

## Files Created/Modified
- `frontend/app/admin/__tests__/reports-page-ward.test.tsx` - React tests for ward column display
- `frontend/app/admin/__tests__/users-page-org.test.tsx` - React tests for org assignment UI
- `frontend/app/admin/lib/adminApi.ts` - Added Organization type, listOrganizations, assignUserOrg
- `frontend/app/admin/reports/page.tsx` - Ward column surfaced from listReports response
- `frontend/app/admin/users/page.tsx` - Org display and assignment select control per user
- `frontend/app/admin/components/ReportsTable.tsx` - Added null guard on reports prop
- `nginx/nginx.conf` - Added https://unpkg.com to style-src and img-src in admin CSP

## Decisions Made
- `https://unpkg.com` added to both `style-src` and `img-src` in nginx admin CSP — Leaflet loads its CSS and default marker PNG icons from the unpkg.com CDN; blocking either breaks the reports map page
- The sidebar first-load hydration flicker (resolves on refresh) was documented as known behavior rather than fixed — it is a low-priority SSR/hydration race with no correctness or security impact

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed nginx CSP blocking Leaflet CDN styles**
- **Found during:** Task 3 (human verification)
- **Issue:** `Content-Security-Policy: The page's settings blocked a style (style-src-elem) at https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` — admin CSP `style-src 'self' 'unsafe-inline'` did not include the unpkg.com origin used by Leaflet
- **Fix:** Added `https://unpkg.com` to `style-src` and `img-src` in the `/admin` location CSP header in `nginx/nginx.conf`
- **Files modified:** `nginx/nginx.conf`
- **Verification:** CSP directive updated; tests unaffected (nginx not covered by Jest)
- **Committed in:** `4a1ea1f`

**2. [Rule 1 - Bug] Fixed ReportsTable crash on undefined reports prop**
- **Found during:** Task 3 (human verification) — `TypeError: can't access property "length", t is undefined`
- **Issue:** `if (reports.length === 0)` crashes when `reports` is undefined; occurs during Leaflet hydration before reports data arrives
- **Fix:** Changed guard to `if (!reports || reports.length === 0)` in `ReportsTable.tsx`
- **Files modified:** `frontend/app/admin/components/ReportsTable.tsx`
- **Verification:** 581 frontend tests pass; lint clean
- **Committed in:** `4a1ea1f`

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs found during human verification)
**Impact on plan:** Both fixes required for correct operation of the admin reports map page. No scope creep.

## Issues Encountered
- Sidebar not appearing on first load (resolves on browser refresh) — documented as known hydration behavior, not fixed. Low priority.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 complete: wards table, ward lookup, organizations table, org assignment API, and all admin UI surfaces are in place
- Organizations table is empty by design — seeding deferred until GBA corp structure is confirmed with Arun Pai / Walkaluru
- Phase 2 (anti-abuse) can begin once org structure is confirmed and organizations are seeded

---
*Phase: 01-ward-foundation*
*Completed: 2026-03-12*
