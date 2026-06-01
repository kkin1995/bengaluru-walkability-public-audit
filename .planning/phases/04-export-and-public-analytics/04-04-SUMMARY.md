---
phase: 04-export-and-public-analytics
plan: 04
subsystem: frontend/map
tags: [heatmap, leaflet, layer-control, ssr-safety, map]
dependency_graph:
  requires:
    - 04-01 (ordering formality; no shared source files)
  provides:
    - frontend/package.json (leaflet.heat@0.2.0 + @types/leaflet.heat@0.2.5)
    - frontend/app/components/HeatmapLayer.tsx (open-reports density heatmap via L.heatLayer)
    - frontend/app/components/HeatmapLayer/__tests__/HeatmapLayer.test.tsx (5 Wave 0 tests)
    - frontend/app/components/ReportsMap.tsx (HeatmapLayer rendered inside MapContainer)
    - frontend/__mocks__/leaflet.js (heatLayer + control.layers mocks added)
  affects:
    - /map page: heatmap toggle appears top-right via native Leaflet layers control
tech_stack:
  added:
    - leaflet.heat@0.2.0 (Leaflet org, verified on npm)
    - "@types/leaflet.heat@0.2.5" (DefinitelyTyped, verified on npm)
  patterns:
    - Side-effect import `import "leaflet.heat"` augments L with heatLayer
    - "(L as any).heatLayer(points, opts)" to satisfy TypeScript (Pitfall 3)
    - L.control.layers({}, { "Issue Density": heatLayer }, { position: "topright" }) for D-03
    - SSR guard: HeatmapLayer only imported by ReportsMap (ssr:false boundary)
    - useEffect cleanup: removeControl + removeLayer on unmount
key_files:
  created:
    - frontend/app/components/HeatmapLayer.tsx
    - frontend/app/components/HeatmapLayer/__tests__/HeatmapLayer.test.tsx
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/app/components/ReportsMap.tsx
    - frontend/__mocks__/leaflet.js
self_check:
  passed: true
  notes: |
    - npm test HeatmapLayer: 5/5 passed (open-only filter, L.control.layers, null DOM)
    - npm run build: exit 0, no TypeScript errors, no "window is not defined" SSR error
    - /map page renders in build output as ○ (static prerender)
    - grep ReportsMap.tsx: contains "HeatmapLayer" — wired correctly
    - grep map/page.tsx: does NOT import HeatmapLayer directly — ssr:false boundary intact
deviations:
  - Executed inline (orchestrator) rather than via worktree subagent due to Bash
    permission restriction on subagents in this session.
must_haves_verified:
  - "The public /map page shows a toggleable issue-density heatmap driven by open/unresolved
     reports only: YES — HeatmapLayer.tsx filters status === 'open', test confirms"
  - "The heatmap toggle lives in the native Leaflet layer control (top-right): YES —
     L.control.layers({}, { 'Issue Density': heatLayer }, { position: 'topright' })"
  - "The heatmap layer mounts without a server-side window error: YES — HeatmapLayer only
     imported by ReportsMap which is dynamic+ssr:false in map/page.tsx"
---

## Summary

Plan 04-04 complete in 2 tasks (executed inline due to session Bash permission issue):

**Task 1 (install + component + test):** `leaflet.heat@0.2.0` and `@types/leaflet.heat@0.2.5`
added to package.json (npm install synced package-lock.json). `HeatmapLayer.tsx` created as a
react-leaflet child component: `import "leaflet.heat"` augments `L`; `useMap()` gets the map
instance; `useEffect` filters `status === "open"` reports (D-02), creates `(L as any).heatLayer`
with radius 25/blur 15/maxZoom 14, adds it via `L.control.layers` overlay (D-03), and cleans up
on unmount. Top-of-file warning comment prevents future devs from importing it outside ReportsMap.
Leaflet mock extended with `heatLayer` + `control.layers` mocks. 5 Wave 0 RTL tests, all GREEN.

**Task 2 (wiring):** `HeatmapLayer` imported and rendered inside `<MapContainer>` in `ReportsMap.tsx`
(the ssr:false boundary). No additional fetch — reuses the same reports array fetched for pins.
`map/page.tsx` unchanged: no direct HeatmapLayer import (ssr:false intact). Build: zero TypeScript
errors, no SSR window crash, exit 0.
