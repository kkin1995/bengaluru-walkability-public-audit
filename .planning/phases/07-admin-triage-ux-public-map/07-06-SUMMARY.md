---
phase: 07-admin-triage-ux-public-map
plan: "06"
subsystem: ui
tags: [next.js, css, responsive-layout, photo, server-component]

requires:
  - phase: 07-admin-triage-ux-public-map
    provides: resolution_photo_url field typed and returned on PublicReport (already present from Phase 3/5)

provides:
  - PhotoFrame component (inline, server component): label + mono sub-label + 16/9 image
  - ResolutionBadge component: floating accent pill with check icon + "RESOLUTION" text
  - BeforeAfterGrid layout: CSS media query 2-col desktop / stacked mobile responsive layout
  - Before/After photo section on public report detail page (/reports/[id])
  - Single-photo fallback state: "Photo" label, maxWidth 520px, no badge

affects:
  - public-report-detail
  - TRIAGE-05

tech-stack:
  added: []
  patterns:
    - "Inline <style> block with CSS class + @media query for SSR-safe responsive layout (no JS width check)"
    - "URL extraction from Docker-internal URLs via split('/uploads/').pop() — established in FIX-01, reused here"
    - "Resolution date from history array reverse scan; last resolved/closed entry wins"

key-files:
  created: []
  modified:
    - frontend/app/reports/[id]/page.tsx

key-decisions:
  - "Used inline <style> block with .ba-grid CSS class + @media(min-width:768px) for responsive grid — avoids JS window width check that breaks SSR in Next.js server component"
  - "Resolution URL derived via split('/uploads/').pop() same as original image (FIX-01 pattern) — safe against Docker-internal hostnames"
  - "Resolution date: scan history[] in reverse for last resolved/closed entry; fallback to report.created_at (Risk 6)"
  - "Corp name for sub-label: ward_hierarchy?.corporation with 'GBA' fallback (Assumption A2 — assigned_org_name not in PublicReport)"
  - "Photos are display-only (no onClick, no lightbox) per D-28"
  - "Section heading always 'Photo' (D-27) regardless of single/two-photo state"

patterns-established:
  - "PhotoFrame: header row (label left + sub-label right) + position:relative wrapper for badge + img with aspectRatio 16/9"
  - "BeforeAfterGrid uses CSS class approach for SSR-safe responsive layout in server components"

requirements-completed: [TRIAGE-05]

duration: 2min
completed: 2026-06-22
status: complete
---

# Phase 07 Plan 06: Before/After Photo Layout Summary

**Responsive before/after photo layout on the public report detail page: two-column desktop grid + stacked mobile via CSS media query, with floating RESOLUTION badge and Docker-safe URL extraction**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-22T18:21:51Z
- **Completed:** 2026-06-22T18:23:49Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced old resolution section (single image with Docker-internal URL and hardcoded "Field verified" text) with proper before/after photo layout
- Added `PhotoFrame` component: label (14px/600) left + sub-label (10px mono muted) right, 16/9 aspect-ratio image with `borderRadius: var(--r-md)`
- Added `ResolutionBadge`: floating `position:absolute` pill with `background: var(--accent)`, check icon, "RESOLUTION" text, `aria-hidden`
- Added `BeforeAfterGrid`: CSS `.ba-grid` class + `@media(min-width:768px)` rule for SSR-safe responsive layout (2-col desktop, stacked mobile)
- Single-photo state: "Photo" label, `maxWidth: 520px`, centered, no badge, no After slot
- Resolution URL extracted via same `split("/uploads/").pop()` pattern as original photo (Docker-hostname-safe)
- Resolution date from last resolved/closed history entry; corp name from `ward_hierarchy?.corporation` (fallback "GBA")

## Task Commits

1. **Task 1: Build before/after photo layout on the public report detail page** - `5621897` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/app/reports/[id]/page.tsx` - Added `PhotoFrame`, `ResolutionBadge`, `BeforeAfterGrid` components; replaced old resolution section; added resolution URL/date/corp derivation logic

## Decisions Made

- **SSR-safe responsive layout:** Used `<style>` block with `.ba-grid` CSS class + `@media(min-width:768px)` instead of JS `window.innerWidth` check — server components cannot read window at render time
- **URL extraction pattern:** Reused `split("/uploads/").pop()` from the FIX-01 fix for original image; resolution URL stored with same Docker-internal hostname pattern
- **Resolution date fallback:** Scanned `history[]` in reverse for last `resolved` or `closed` entry; falls back to `report.created_at` (Risk 6 per plan)
- **Corp name fallback:** `ward_hierarchy?.corporation ?? "GBA"` — `assigned_org_name` is not in `PublicReport` (Assumption A2 per plan)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - all data sources are wired (`publicImageUrl`, `publicResolutionUrl`, `originalSubLabel`, `resolutionSubLabel` all derived from real API fields).

## Threat Flags

No new threat surface introduced. Resolution photo served from same `/uploads/` path as original (T-07-13: accepted). Malformed/missing `resolution_photo_url` falls back to single-photo layout (T-07-14: mitigated).

## Next Phase Readiness

- Before/after layout complete; any resolved report with a `resolution_photo_url` will now show the two-photo grid on the public detail page
- Single-photo state confirmed correct for unresolved reports
- Ready for Plan 07-07 (MOB-01–MOB-07 mobile Safari fixes)

## Self-Check

- [x] `frontend/app/reports/[id]/page.tsx` modified with all three components
- [x] Commit `5621897` exists in git log
- [x] `npm run build` passes (verified)
- [x] All 7 acceptance criteria verified (grep checks above)

## Self-Check: PASSED

---
*Phase: 07-admin-triage-ux-public-map*
*Completed: 2026-06-22*
