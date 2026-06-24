---
phase: 07-admin-triage-ux-public-map
plan: 12
subsystem: ui
tags: [leaflet, react-leaflet, css, svg, focus-outline, ward-boundary, geojson]

# Dependency graph
requires:
  - phase: 07-05
    provides: WardBoundaryLayer in ReportsMap.tsx with fill:true/fillOpacity:0 hover hit area
  - phase: 07-02
    provides: Public ward boundary GeoJSON endpoint

provides:
  - SVG focus outline suppressed on Leaflet interactive paths via globals.css (TRIAGE-04b)
  - Blur-on-click handler in WardBoundaryLayer so no persistent focus state on ward polygons
  - Ward hover tooltip unchanged (TRIAGE-04 not regressed)
  - wardBoundaryPane at z-index 390 ensures ward SVG never occludes CircleMarker click events

affects: [07-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defense-in-depth: CSS outline:none + programmatic blur() to remove Leaflet SVG focus artifacts"
    - "Leaflet event handler: (layer as any).on('click', e => e?.target?._path?.blur?.()) for blur-on-click"

key-files:
  created: []
  modified:
    - frontend/app/globals.css
    - frontend/app/components/ReportsMap.tsx

key-decisions:
  - "Defense-in-depth approach: both CSS (.leaflet-interactive:focus { outline:none }) and JS blur() applied so no runtime can re-introduce the focus rectangle"
  - "WardBoundaryLayer wardStyle left unchanged (fill:true, fillOpacity:0) — hover hit area for TRIAGE-04 tooltip must not regress"

patterns-established:
  - "Leaflet SVG focus suppression: .leaflet-interactive:focus { outline: none } in globals.css covers all polygon layers globally"

requirements-completed: [TRIAGE-04]

# Metrics
duration: ~15min
completed: 2026-06-24
status: complete
---

# Phase 07 Plan 12: TRIAGE-04b Ward Focus Rectangle Summary

**Leaflet SVG focus-outline artifact removed via CSS `outline:none` on `.leaflet-interactive` + programmatic `blur()` on ward polygon click, with ward hover tooltip intact (TRIAGE-04b closed)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-24
- **Completed:** 2026-06-24
- **Tasks:** 2 auto + 1 checkpoint
- **Files modified:** 2

## Accomplishments

- Identified root cause: TRIAGE-04 hover fix set `fill:true, fillOpacity:0` on ward polygons, making each polygon an interactive, focusable SVG path; on click the browser applied a default focus outline rendered as a black rectangle around the ward bounds
- Added `.leaflet-interactive:focus { outline: none }` and belt-and-suspenders `.leaflet-container svg path.leaflet-interactive { outline: none }` rules to `frontend/app/globals.css`
- Added `(layer as any).on("click", (e) => { e?.target?._path?.blur?.(); })` handler in `WardBoundaryLayer.onEachFeature` in `ReportsMap.tsx` so focus state never persists
- Human-verified on local deploy: no black rectangle on ward click; hover tooltip still shows ward name

## Task Commits

Each task was committed atomically:

1. **Task 1: Suppress Leaflet SVG path focus outline + blur on ward polygon click** - `118897c` (fix)
2. **Task 2: Verify frontend build clean** - `a36c1b5` (chore)

## Files Created/Modified

- `frontend/app/globals.css` — Added two CSS selectors removing `outline` on `.leaflet-interactive:focus`; comment cites TRIAGE-04b
- `frontend/app/components/ReportsMap.tsx` — WardBoundaryLayer.onEachFeature extended with a click handler that calls `_path.blur()` after `bindTooltip`

## Decisions Made

- Defense-in-depth: both the CSS rule (prevents any repaint of the focus outline) and the JS `blur()` call (clears focus state from DOM) were applied — either alone could be bypassed by some browsers
- `wardStyle` (`fill:true, fillOpacity:0`) was intentionally left untouched to preserve the hover hit area (TRIAGE-04 must not regress)

## Deviations from Plan

None - plan executed exactly as written. Both tasks completed as specified. CSS rule and blur handler added. Build and lint passed.

## Issues / Observations

**Additional fix applied post-checkpoint (commit `06f1398`):**

During checkpoint verification the reviewer noted: when the WARDS toggle is on, clicking a report marker does not open the report detail popup.

Root cause: ward GeoJSON loads asynchronously, so its SVG paths were appended to the overlay pane SVG *after* the CircleMarker paths. In SVG, later elements are hit-tested first — so the transparent `fillOpacity:0` ward fill was always above markers and swallowed their clicks.

Fix: `WardBoundaryLayer` now creates a dedicated `wardBoundaryPane` at z-index 390 (below `overlayPane` at 400) in a `useEffect`, then renders the `<GeoJSON>` into that pane (`pane="wardBoundaryPane"`). Ward polygons are permanently in a lower SVG layer; CircleMarkers remain in the overlay pane and receive clicks correctly. Human-verified: clicking report markers with WARDS toggle on now opens the popup correctly. Hover tooltips and teal stroke unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TRIAGE-04b is closed; ward overlay renders with no focus artifacts
- TRIAGE-04 (hover tooltip) is confirmed not regressed
- Ward marker-click regression resolved; report popups open correctly with WARDS toggle on
- All gap-closure plans complete; branch ready for /gsd-ship

---
*Phase: 07-admin-triage-ux-public-map*
*Completed: 2026-06-24*
