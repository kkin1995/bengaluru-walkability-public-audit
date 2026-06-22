---
phase: "07"
plan: "05"
subsystem: frontend
status: complete
tags: [public-map, status-filter, ward-overlay, leaflet, client-side-filtering]
dependency_graph:
  requires: ["07-02"]
  provides: ["TRIAGE-03", "TRIAGE-04"]
  affects: ["frontend/app/map/page.tsx", "frontend/app/components/ReportsMap.tsx", "frontend/app/lib/config.ts"]
tech_stack:
  added: []
  patterns: ["react-leaflet GeoJSON overlay", "client-side AND filter", "lazy fetch with geojson cache", "silent fail on fetch error"]
key_files:
  created: []
  modified:
    - frontend/app/map/page.tsx
    - frontend/app/components/ReportsMap.tsx
    - frontend/app/lib/config.ts
decisions:
  - "Status chip 'In progress' maps to acknowledged|assigned|in_progress — three backend statuses collapse to one citizen bucket (per CONTEXT.md Specifics)"
  - "WardBoundaryLayer defined inside ReportsMap.tsx module (inside ssr:false boundary) — not a separate file, avoids window access on SSR"
  - "CSS var resolved via getComputedStyle at WardBoundaryLayer render time with oklch fallback — Leaflet SVG does not inherit CSS custom properties (Risk 2)"
  - "PUBLIC_WARD_BOUNDARIES_URL exported from config.ts using API_BASE_URL concat — project config rule (no inline process.env in components)"
  - "FAB column uses position:absolute + env(safe-area-inset-bottom) for iOS safe area; ward toggle stacked above Report here FAB (D-18)"
  - "Status legend top adjusted from 108 to 200 to avoid overlap with new status chip row at top:120"
metrics:
  duration: "3 min"
  completed_date: "2026-06-22T18:43:23Z"
  tasks_completed: 2
  files_modified: 3
requirements: [TRIAGE-03, TRIAGE-04]
---

# Phase 07 Plan 05: Status Filter Chips + Ward Boundary Overlay Summary

**One-liner:** Client-side status chip row (4 chips, AND logic, colored dots) + lazy-fetched, cached, stroke-only ward GeoJSON overlay with silent fail on the public map.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add status filter chips with client-side AND filtering | 5b053aa | map/page.tsx, ReportsMap.tsx, config.ts |
| 2 | Add ward boundary overlay toggle + lazy GeoJSON layer | 5b053aa | (same commit — shared files) |

## What Was Built

### Task 1: Status Filter Chips (TRIAGE-03)

- `STATUS_CHIPS` array defines 4 chips: "All statuses", "Open", "In progress", "Resolved"
- Chip labels use `publicStatusLabel` from `translations.ts` — no hardcoded citizen-facing text
- Status mapping matches CONTEXT.md D-07: Open = open/acknowledged/assigned; In progress = acknowledged/assigned/in_progress; Resolved = resolved/closed
- `statusCounts()` computes TOTAL counts per bucket from `allReports` (not cross-filtered by category, per D-10)
- `StatusChipRow` renders at `position: absolute, top: 120` (76 + 36 + 8 gap) with `role="toolbar" aria-label="Filter by status"`
- Each chip has `aria-pressed`, colored 7x7 dot (--danger/--warn/--accent), active dot gets shadow
- `activeStatusFilter` state is in-memory only (not URL-persisted, D-13)
- `ReportLite` type extended with `status: string`; populated from onReportsLoaded GeoJSON data
- `ReportsMap` receives `statusFilter` prop; `.filter()` applies categoryFilter AND statusFilter (D-09)
- Zero results = empty map, no message (D-12) — consistent with existing category chip behavior

### Task 2: Ward Boundary Overlay (TRIAGE-04)

- `PUBLIC_WARD_BOUNDARIES_URL` exported from `config.ts` (API_BASE_URL + "/api/wards/boundaries")
- `WardBoundaryLayer` component defined inside `ReportsMap.tsx` (inside ssr:false boundary)
  - Uses react-leaflet `GeoJSON` component (same import pattern as ChoroplethMap)
  - Style: `fill: false`, color resolved from CSS var at render time with oklch fallback, `opacity: 0.5`, `weight: 1.5`, `lineJoin: "round"`
  - `onEachFeature` binds Leaflet tooltip with `ward_name` from GeoJSON properties (D-17)
  - `aria-hidden="true"` on the layer (decorative overlay)
- `WardToggleButton` (52x52px, --r-lg borderRadius) with grid-icon SVG + "WARDS" mono label
- Toggle state machine: idle → loading (opacity 0.5, disabled) → loaded/setShowWardBoundaries(true) or error (opacity 0.4, silent fail, no error text)
- GeoJSON cached in state; re-toggling ON reuses cache without refetch (D-20)
- "Ward boundaries · 369 wards" banner shown when overlay is ON (anchored at top:166, accent border)
- FAB column reorganized: ward toggle above Report here FAB in shared flex-column at bottom-right

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed spurious `@ts-expect-error` on `aria-hidden`**
- Found during: Task 2 build verification
- Issue: Build failed with "Unused '@ts-expect-error' directive" because `aria-hidden` is already in react-leaflet's GeoJSON prop types
- Fix: Removed the `@ts-expect-error` comment
- Files modified: frontend/app/components/ReportsMap.tsx

**2. [Rule 2 - Layout adjustment] Status legend top shifted from 108 to 200**
- Found during: Task 1 implementation
- Issue: The status legend was positioned at top:108 — now overlaps with the new status chip row at top:120 (which occupies ~36px height)
- Fix: Moved legend to top:200 to clear both chip rows without overlapping
- Files modified: frontend/app/map/page.tsx

## Known Stubs

None. All chip counts are live-computed from `allReports`. Ward GeoJSON comes from the real backend endpoint. No placeholder data.

## Threat Flags

None. Changes are client-side only; the ward GeoJSON endpoint was secured in Plan 02 (T-07-10 accepted, T-07-11/T-07-12 mitigated by cache + silent fail).

## Self-Check

### Files exist:
- frontend/app/map/page.tsx — modified (FOUND)
- frontend/app/components/ReportsMap.tsx — modified (FOUND)
- frontend/app/lib/config.ts — modified (FOUND)

### Commits exist:
- 5b053aa — feat(07-05): add status filter chips and ward boundary overlay to public map (FOUND)

### Build:
- `npm run build` — PASSED (3 files changed, 388 insertions, 21 deletions)

## Self-Check: PASSED
