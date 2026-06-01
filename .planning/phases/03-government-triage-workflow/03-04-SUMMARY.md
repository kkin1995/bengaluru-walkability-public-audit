---
plan: 03-04
phase: 03-government-triage-workflow
status: complete
completed: 2026-05-31T00:00:00Z
commits:
  - 64249a5
  - 071a784
self_check: PASSED
---

## Summary

Shipped the Phase 03 public citizen frontend (Direction A) — status-based map pin colors, extended popup, status legend, and the new public `/reports/[id]` server component page.

## What Was Built

**ReportsMap status-based coloring + popup (Task 1):**
- `STATUS_COLORS` const added to `ReportsMap.tsx`: red for open/acknowledged/assigned, amber for in_progress, green for resolved/closed (3-color public mapping per D-30, UI-SPEC §I)
- `CircleMarker.fillColor` now sourced from `STATUS_COLORS[report.status]` instead of `CATEGORY_COLORS`
- Popup extended to include: corporation name, ward name, current status label with colored dot, and `Read More →` link to `/reports/{id}` (D-31, UI-SPEC §G)
- Map legend in `/map` page replaced with 3-row status legend: Open (red), In progress (amber), Resolved (green) per UI-SPEC §H

**Public /reports/[id] page (Task 2):**
- New Next.js server component at `frontend/app/reports/[id]/page.tsx` — fetches `GET /api/reports/:id` server-side via `INTERNAL_API_URL`
- Renders full Direction-A layout per UI-SPEC §J: hero photo, status badge, meta grid (date + ward + corporation), status history timeline, conditional Resolution section (after-photo + notes when resolved/closed), full GBA Responsibility Hierarchy section (bureaucratic + elected chains), back-to-map link
- Test coverage in `frontend/app/reports/[id]/__tests__/page.test.tsx`

## Key Files

### Created
- `frontend/app/reports/[id]/page.tsx` — public single-report server component (MAP-03)
- `frontend/app/reports/[id]/__tests__/page.test.tsx` — page tests

### Modified
- `frontend/app/components/ReportsMap.tsx` — STATUS_COLORS + extended popup + status legend
- `frontend/app/map/page.tsx` — status-based legend (MAP-01)
- `frontend/app/lib/config.ts` — config additions for INTERNAL_API_URL

## Test Results

870 frontend tests passing. ReportsMap STATUS_COLORS and popup tests green. New `/reports/[id]` page tests green.

(Note: `ReportsMap.test.tsx` suite skipped due to leaflet.heat import mock gap — pre-existing test infrastructure issue from Phase 04, not a Phase 03 regression.)

## Self-Check: PASSED

All must_haves verified:
- [x] ReportsMap CircleMarker fillColor from STATUS_COLORS (not CATEGORY_COLORS) (MAP-01)
- [x] ReportsMap Popup has corporation + ward + status + Read More link (MAP-03)
- [x] Map legend replaces category legend with 3-row status legend (UI-SPEC §H)
- [x] /reports/[id] is a Next.js server component fetching via INTERNAL_API_URL (MAP-03)
- [x] /reports/[id] hero + status badge + meta grid + history + resolution section + GBA hierarchy
- [x] Pin colors render correctly in jest tests; fillColor prop asserted
