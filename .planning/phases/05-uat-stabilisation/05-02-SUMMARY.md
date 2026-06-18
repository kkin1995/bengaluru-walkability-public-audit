---
phase: 05-uat-stabilisation
plan: "02"
subsystem: frontend-citizen-public
tags: [fix, citizen-flow, public-map, leaflet, location-source, ux]
dependency_graph:
  requires: []
  provides:
    - public-photo-url-fix
    - deprecated-route-redirects
    - invalidateSize-citizen-maps
    - canonical-location-source-emission
  affects:
    - frontend/app/reports/[id]/page.tsx
    - frontend/app/report/page.tsx
    - frontend/app/map/page.tsx
    - frontend/next.config.mjs
    - frontend/app/components/LocationMap.tsx
    - frontend/app/components/ReportsMap.tsx
    - frontend/app/components/redesign/SuccessCard.tsx
    - frontend/app/components/ReportCTA.tsx
    - frontend/app/lib/photo-store.ts
tech_stack:
  added: []
  patterns:
    - MapSizeUpdater child component pattern (useMap + setTimeout invalidateSize)
    - API_BASE_URL + split("/uploads/").pop() for public image URL construction
    - Canonical enum values: EXIF_GPS, GPS_API, MANUAL_ADJUST for location_source
key_files:
  created: []
  modified:
    - frontend/app/reports/[id]/page.tsx
    - frontend/app/report/page.tsx
    - frontend/app/map/page.tsx
    - frontend/next.config.mjs
    - frontend/app/components/LocationMap.tsx
    - frontend/app/components/ReportsMap.tsx
    - frontend/app/components/redesign/SuccessCard.tsx
    - frontend/app/components/ReportCTA.tsx
    - frontend/app/lib/photo-store.ts
decisions:
  - MapSizeUpdater defined inline in each map component (not extracted to shared module) — both files already client-side, inline keeps the fix isolated to its scope
  - MANUAL_ADJUST added to report/page.tsx for the map-pin-drag case (locationSource when user moves the LocationMap pin), which was not explicitly called out in the plan but is the correct canonical value for that interaction path
metrics:
  duration: "6 minutes"
  completed: "2026-06-05T12:07:07Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 9
---

# Phase 05 Plan 02: Citizen/Public Frontend UAT Fixes Summary

Public photo URL reconstruction from API_BASE_URL + filename, deprecated-route navigation and redirects, iOS-safe invalidateSize on both citizen/public Leaflet maps, 3dp GPS coordinate display, "Auto-detected" ward label, and canonical GPS_API/EXIF_GPS/MANUAL_ADJUST location_source emission.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | FIX-01/02/03: photo URL + nav + redirects | 0e2ce8d | reports/[id]/page.tsx, report/page.tsx, map/page.tsx, next.config.mjs |
| 2 | FIX-04/10/12/13: maps + coords + label + emission | ce49ef1 | LocationMap.tsx, ReportsMap.tsx, SuccessCard.tsx, ReportCTA.tsx, photo-store.ts, report/page.tsx |

## What Was Built

### FIX-01 (D-01/D-02): Public report photo URL
- Added `API_BASE_URL` to the import in `reports/[id]/page.tsx`
- Derive `imageFilename` via `.split("/uploads/").pop()` — path-traversal-safe (T-05-05)
- Build `publicImageUrl = API_BASE_URL + "/uploads/" + imageFilename`
- Changed `<img src={report.image_url}>` to `<img src={publicImageUrl}>`
- The raw `image_url` contains `http://backend:3001/...` (internal Docker hostname), which is unreachable from the browser

### FIX-02 (D-05): "Report another" CTA navigation
- Changed `onReportAnother={resetAll}` to `onReportAnother={() => { window.location.href = "/"; }}` in report/page.tsx
- Mirrors the existing `onClose` handler pattern — decision lives in the caller, not SuccessCard

### FIX-03 (D-06/D-07): /map FAB + permanent redirects
- Changed map/page.tsx FAB `href` from `/report` to `/`
- Added `async redirects()` to next.config.mjs returning permanent redirects:
  - `/report` → `/` with `permanent: true`
  - `/reports` → `/` with `permanent: true`
- T-05-07: destinations are hardcoded, no open-redirect surface

### FIX-04 (D-09/D-10): invalidateSize on Leaflet maps
- Added `MapSizeUpdater` component (uses `useMap()` + `useEffect` + `setTimeout(100ms)`) to both citizen/public maps:
  - `LocationMap.tsx` — citizen confirm-step map (D-09)
  - `ReportsMap.tsx` — public reports map (D-10, third map)
- MapSizeUpdater is defined inline in each file (not extracted to a shared module) — both files are already `"use client"` and the fix is small enough to be self-contained
- The nginx CSP portion of FIX-04 is owned by plan 05-04

### FIX-10 (D-25): GPS coordinate display precision
- Changed two `toFixed(4)` to `toFixed(3)` in report/page.tsx:
  - Line ~662: coordinate pill inside the "Photo ready" card
  - Line ~970: coordinate display on the confirm step
- Backend already rounds to 3dp at the API layer (queries.rs) — frontend-only fix

### FIX-12 (D-30/D-31): Ward attribution label
- Replaced `Auto-routed` with `Auto-detected` in SuccessCard.tsx line 241
- Grep confirmed 0 remaining occurrences of any "auto.routed" variant across all frontend app files

### FIX-13 (D-33): Canonical location_source emission
- Updated `locationSource` type in `photo-store.ts` from `"exif" | "manual_pin"` to `"EXIF_GPS" | "GPS_API" | "MANUAL_ADJUST"`
- Updated `FormState.locationSource` type and all assignments in `report/page.tsx`:
  - Default: `"GPS_API"` (was `"manual_pin"`)
  - After browser geolocation: `"GPS_API"` (was `"manual_pin"`)
  - After EXIF GPS: `gps ? "EXIF_GPS" : "GPS_API"` (was `gps ? "exif" : "manual_pin"`)
  - After manual map-pin drag: `"MANUAL_ADJUST"` (was `"manual_pin"`)
- Updated both `handleChange` and `handleGalleryChange` in `ReportCTA.tsx`:
  - Default: `"GPS_API"` (was `"manual_pin"`)
  - After EXIF GPS: `"EXIF_GPS"` (was `"exif"`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] MANUAL_ADJUST for map-pin drag case**
- **Found during:** Task 2 (FIX-13 implementation)
- **Issue:** The plan's FIX-13 section called out lines 60, 156, and 319 in report/page.tsx but missed the LocationMap `onChange` callback at ~line 919 which also emits `"manual_pin"`
- **Fix:** Changed that assignment to `"MANUAL_ADJUST"` — this is the correct canonical value when the user explicitly drags the map pin
- **Files modified:** `frontend/app/report/page.tsx`
- **Commit:** ce49ef1

## MapSizeUpdater Implementation Note

MapSizeUpdater was **defined inline** in each map component (not factored into a shared module). Both LocationMap.tsx and ReportsMap.tsx are already `"use client"` files, and the component is 8 lines. Keeping it inline avoids a new shared file that both map files would import — reduces coupling and makes the fix traceable to each file independently.

## Known Stubs

None — all fixes are fully wired. No placeholder data or TODO markers introduced.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| (none) | — | All new surfaces are within the plan's threat model (T-05-05, T-05-06, T-05-07 already registered) |

## Self-Check

### Created files exist
No new files — all modifications to existing files.

### Modified files committed
- `frontend/app/reports/[id]/page.tsx` — commit 0e2ce8d
- `frontend/app/report/page.tsx` — commits 0e2ce8d + ce49ef1
- `frontend/app/map/page.tsx` — commit 0e2ce8d
- `frontend/next.config.mjs` — commit 0e2ce8d
- `frontend/app/components/LocationMap.tsx` — commit ce49ef1
- `frontend/app/components/ReportsMap.tsx` — commit ce49ef1
- `frontend/app/components/redesign/SuccessCard.tsx` — commit ce49ef1
- `frontend/app/components/ReportCTA.tsx` — commit ce49ef1
- `frontend/app/lib/photo-store.ts` — commit ce49ef1

### Commit hashes verified
Both commits exist on worktree-agent-afed6236a013801ef.

## Self-Check: PASSED
