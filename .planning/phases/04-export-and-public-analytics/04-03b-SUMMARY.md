---
plan: 04-03b
phase: 04-export-and-public-analytics
status: complete
started: 2026-05-31T10:15:00Z
completed: 2026-05-31T10:45:00Z
commits:
  - 87b2e32
  - f4bebe6
key-files:
  created:
    - frontend/app/admin/analytics/page.tsx
    - frontend/app/admin/analytics/ChoroplethMap.tsx
    - frontend/app/admin/analytics/__tests__/AnalyticsPage.test.tsx
    - frontend/app/admin/components/KpiCards.tsx
    - frontend/app/admin/components/TrendChart.tsx
    - frontend/app/admin/components/WardTable.tsx
  modified:
    - frontend/app/admin/lib/adminApi.ts
    - frontend/app/admin/components/AdminSidebar.tsx
    - frontend/package.json
---

## What Was Built

**Plan 04-03b** — Admin analytics frontend dashboard (ANALYTICS-02/03/04/05 frontend tier).

### Task 1: recharts + components + adminApi (commit 87b2e32)

**recharts 3.8.1 installed** — pinned exact version, verified on npm.

**adminApi.ts additions:**
- Interfaces: `WardAnalytics`, `CorporationAnalytics`, `TrendDataPoint`
- Functions: `getWardAnalytics()`, `getCorporationAnalytics()`, `getTrendData(category?)`, `getWardBoundaries()` — all through `apiFetch` (credentials: include); `getWardBoundaries` hits admin endpoint `/api/wards/boundaries`
- Added `import type { FeatureCollection } from "geojson"` for type-safe return

**KpiCards.tsx** — Direction-B KPI row: top unresolved ward + count, overall resolution rate, total reports. Skeleton loading state. Uses `var(--surface)`, `var(--border)` from admin.css.

**TrendChart.tsx** — recharts `LineChart` with `ResponsiveContainer`. One `Line` per category. Legend `onClick` toggles hidden lines via `Set<string>` state (D-11). Flat `TrendDataPoint[]` transformed to recharts wide format. `CATEGORY_COLORS` map with Direction-B-compatible colors.

**WardTable.tsx** — Direction-B table rendering `WardAnalytics[]`. `selectedWard` prop highlights/filters the selected ward row. Danger color for unresolved count > 0.

**ChoroplethMap.tsx** — react-leaflet `MapContainer` centered on Bengaluru [12.9716, 77.5946]. `GeoJSON` layer styled by `getWardColor(unresolved_count)` (0=light gray → <5=teal → <15=amber → <30=orange → red). `onEachFeature` click calls `onWardClick(ward_name)` prop (D-04). Imported with `ssr: false` from analytics page.

### Task 2: analytics page + sidebar + smoke test (commit f4bebe6)

**analytics/page.tsx** — "use client" composition page:
- Dynamic imports: `TrendChart` and `ChoroplethMap` with `ssr: false` (recharts + Leaflet are window-dependent)
- State: `wardData`, `corpData`, `trendData`, `selectedWard`, `isLoading`, `isError`
- `fetchAnalytics` via `Promise.all([getWardAnalytics(), getCorporationAnalytics(), getTrendData()])`
- Layout: page header with Export CSV/GeoJSON buttons (D-07), full-width KpiCards, full-width Card wrapping TrendChart, then 1fr/1fr grid with WardTable (left) + ChoroplethMap (right)
- D-04 drilldown: `ChoroplethMap` `onWardClick` sets `selectedWard`; flows to `WardTable` (highlight/filter) and `TrendChart` (caption); "Clear filter" button resets

**AdminSidebar.tsx** — Analytics nav entry added to both `NAV_ITEMS` and `MOBILE_TABS`:
```typescript
{ key: "analytics", href: "/admin/analytics", icon: "activity" as const, label: "ANALYTICS" }
```
Uses verified `activity` icon (there is no `chart` icon in Icon.tsx).

**AnalyticsPage.test.tsx** — Wave 0 smoke tests (2 pass):
- Page renders without crashing and shows "analytics" title
- KpiCards and WardTable mocks render

## Verification

- `cd frontend && npm run build` → zero TypeScript errors
- `cd frontend && npm test -- --testPathPattern=AnalyticsPage` → 2 tests pass
- `recharts` present in package.json (`"recharts": "^3.8.1"`)
- `AdminSidebar.tsx` NAV_ITEMS contains `href: "/admin/analytics"`, `icon: "activity"`, `label: "ANALYTICS"`
- `ChoroplethMap.tsx` contains `GeoJSON` and `onWardClick` invocation
- `TrendChart.tsx` contains `LineChart` and legend onClick toggle

## Self-Check: PASSED

- [ ] recharts installed ✓
- [ ] adminApi: WardAnalytics, CorporationAnalytics, TrendDataPoint interfaces + 4 fetch fns ✓
- [ ] KpiCards, TrendChart, WardTable, ChoroplethMap components created ✓
- [ ] analytics/page.tsx: dynamic imports ssr:false, selectedWard drilldown ✓
- [ ] AdminSidebar: Analytics entry with `activity` icon in NAV_ITEMS + MOBILE_TABS ✓
- [ ] AnalyticsPage.test.tsx: 2 smoke tests pass ✓
- [ ] `npm run build` zero TS errors ✓
- [ ] STATE.md / ROADMAP.md not modified (orchestrator owns those) ✓

## Deviations

None — implementation followed 04-03b-PLAN.md and 04-PATTERNS.md exactly. Used `Array.from(new Set(...))` instead of spread (TypeScript target compatibility). Fixed `LegendPayload` type import from recharts internal types to satisfy strict typing.
