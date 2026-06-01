---
phase: 04-export-and-public-analytics
plan: 03b
type: execute
wave: 3
depends_on: ["04-03a"]
files_modified:
  - frontend/package.json
  - frontend/app/admin/lib/adminApi.ts
  - frontend/app/admin/components/AdminSidebar.tsx
  - frontend/app/admin/components/KpiCards.tsx
  - frontend/app/admin/components/TrendChart.tsx
  - frontend/app/admin/components/WardTable.tsx
  - frontend/app/admin/analytics/ChoroplethMap.tsx
  - frontend/app/admin/analytics/page.tsx
  - frontend/app/admin/analytics/__tests__/AnalyticsPage.test.tsx
autonomous: true
requirements: [ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05]
must_haves:
  truths:
    - "The /admin/analytics page shows top 10 wards by unresolved report count"
    - "The page shows resolution rate per corporation (resolved / total reports in their wards)"
    - "The page shows a recharts line chart of reports per week over the last 12 weeks, with multi-select legend toggle"
    - "The page shows an interactive ward choropleth; clicking a ward filters the ward table and trend chart to that ward (D-04)"
    - "An Analytics nav entry appears in the admin sidebar"
  artifacts:
    - path: "frontend/app/admin/analytics/page.tsx"
      provides: "admin analytics page composing KPI cards, trend chart, ward table, choropleth"
      contains: "ChoroplethMap"
    - path: "frontend/app/admin/components/TrendChart.tsx"
      provides: "recharts LineChart with legend click-to-hide"
      contains: "LineChart"
    - path: "frontend/app/admin/analytics/ChoroplethMap.tsx"
      provides: "react-leaflet GeoJSON choropleth with click-to-filter"
      contains: "GeoJSON"
    - path: "frontend/package.json"
      provides: "recharts dependency"
      contains: "recharts"
  key_links:
    - from: "frontend/app/admin/analytics/page.tsx"
      to: "getWardAnalytics / getCorporationAnalytics / getTrendData / getWardBoundaries"
      via: "adminApi calls"
      pattern: "getWardAnalytics"
    - from: "frontend/app/admin/analytics/ChoroplethMap.tsx"
      to: "ward table + trend chart filter state"
      via: "onWardClick callback updating selectedWard"
      pattern: "onWardClick"
    - from: "frontend/app/admin/lib/adminApi.ts"
      to: "GET /api/wards/boundaries (admin)"
      via: "getWardBoundaries through apiFetch with credentials"
      pattern: "getWardBoundaries"
---

<objective>
Build the frontend for the admin analytics dashboard at `/admin/analytics` (D-05): KPI cards + trend chart full-width on top, ward table + interactive choropleth side-by-side below (D-06). Charts use recharts (D-09, D-10, D-11); the choropleth uses react-leaflet GeoJSON (D-01) with click-to-filter drilldown (D-04). Consumes the analytics + ward-boundaries endpoints built in 04-03a.

Purpose: ANALYTICS-02/03/04/05 frontend tier. Split out from the original 04-03 (which exceeded the file-count quality target). Depends on 04-03a because every component here consumes the backend endpoints that 04-03a registers; both stay in Wave 3.
Output: recharts dependency, analytics adminApi functions, four analytics components, the analytics page with click-to-filter drilldown, Analytics sidebar entry, Wave 0 page test.
</objective>

<execution_context>
@/home/karankinariwala/KARAN/1-Projects/Active/bengaluru-walkability-public-audit/.claude/get-shit-done/workflows/execute-plan.md
@/home/karankinariwala/KARAN/1-Projects/Active/bengaluru-walkability-public-audit/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-export-and-public-analytics/04-CONTEXT.md
@.planning/phases/04-export-and-public-analytics/04-RESEARCH.md
@.planning/phases/04-export-and-public-analytics/04-PATTERNS.md
@CLAUDE.md
@.planning/phases/04-export-and-public-analytics/04-01-SUMMARY.md
@.planning/phases/04-export-and-public-analytics/04-03a-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install recharts; build TrendChart, KpiCards, WardTable, ChoroplethMap components + adminApi functions</name>
  <files>frontend/package.json, frontend/app/admin/lib/adminApi.ts, frontend/app/admin/components/KpiCards.tsx, frontend/app/admin/components/TrendChart.tsx, frontend/app/admin/components/WardTable.tsx, frontend/app/admin/analytics/ChoroplethMap.tsx</files>
  <read_first>
    - frontend/app/admin/components/StatsCards.tsx (KPI card structure, skeleton pattern, count style — DO NOT reuse directly; it is locked to the old 3-value status shape per RESEARCH Open Question 4 RESOLVED)
    - frontend/app/admin/components/ReportsTable.tsx (table markup + Direction-B token usage for WardTable analog)
    - frontend/app/components/ReportsMap.tsx (react-leaflet MapContainer/TileLayer/GeoJSON usage, ssr guard pattern for ChoroplethMap)
    - frontend/app/admin/lib/adminApi.ts (apiFetch pattern, AdminStats interface placement)
    - frontend/app/admin/admin.css (Direction-B tokens: var(--surface), var(--border), var(--ink), var(--font-mono), var(--r-lg))
    - frontend/app/lib/translations.ts (getCategoryLabel for trend chart legend labels)
    - .planning/phases/04-export-and-public-analytics/04-RESEARCH.md Pattern 5 (recharts LineChart + legend onClick), Pattern 7 (choropleth + getWardColor), Pitfall 6 (recharts SSR)
    - .planning/phases/04-export-and-public-analytics/04-PATTERNS.md "TrendChart.tsx", "KpiCards.tsx", "WardTable.tsx", "ChoroplethMap.tsx", "adminApi.ts" sections
  </read_first>
  <action>
    Run `cd frontend && npm install recharts@3.8.1` (version verified on npm 2026-05-31; leaflet.heat is installed in 04-04, not here).
    In adminApi.ts add interfaces WardAnalytics (ward_name, ward_number, unresolved_count, total_count), CorporationAnalytics (corporation, total_reports, resolved_count, resolution_rate_pct), TrendDataPoint (week_start, category, count), and functions `getWardAnalytics()`, `getCorporationAnalytics()`, `getTrendData(category?)`, `getWardBoundaries(): Promise<GeoJSON.FeatureCollection>` — all routed through apiFetch with credentials. getWardBoundaries hits the ADMIN endpoint /api/wards/boundaries (04-03a registers it under admin auth), so it must route through apiFetch so the session cookie is sent.
    Create KpiCards.tsx ("use client", Direction-B): KPI cards for top-unresolved ward, overall resolution rate, total reports — new component using Phase 3 6-value status semantics (do not import StatsCards). Skeleton + countStyle per StatsCards analog.
    Create TrendChart.tsx ("use client"): recharts LineChart per Pattern 5 — one Line per category, ResponsiveContainer, CartesianGrid/XAxis(week_start)/YAxis/Tooltip/Legend with onClick legend click-to-hide via hiddenLines Set state (D-11). Transform flat TrendDataPoint[] to wide format keyed by week_start. CATEGORY_COLORS map using Direction-B tokens. Accept optional selectedWard prop to caption the chart scope.
    Create WardTable.tsx ("use client", Direction-B): renders WardAnalytics[] rows (ward_name, unresolved_count, total_count), highlights selectedWard prop row.
    Create ChoroplethMap.tsx (react-leaflet): MapContainer centered on Bengaluru [12.9716, 77.5946], TileLayer OSM, GeoJSON layer styled by getWardColor(unresolved_count) (low=light teal → high=red, Claude's discretion palette), onEachFeature click handler calling onWardClick(ward_name) prop (D-04). Must be importable with ssr:false (no "use client" needed when dynamically imported, but imports leaflet css).
  </action>
  <verify>
    <automated>cd frontend && npm run build 2>&1 | grep -iE "error|window is not defined" | head -8; echo "done"</automated>
  </verify>
  <acceptance_criteria>
    - frontend/package.json dependencies contain `recharts`
    - adminApi.ts contains `getWardAnalytics`, `getCorporationAnalytics`, `getTrendData`, `getWardBoundaries` and their interfaces
    - TrendChart.tsx contains `LineChart` and a legend `onClick` handler that toggles hidden lines
    - ChoroplethMap.tsx contains `GeoJSON` and an `onWardClick` invocation in onEachFeature
    - KpiCards.tsx and WardTable.tsx exist using Direction-B tokens (var(--surface)/var(--border)), not Tailwind
    - `cd frontend && npm run build` has zero TypeScript errors
  </acceptance_criteria>
  <done>recharts installed; the four analytics components build cleanly; adminApi exposes all analytics fetch functions.</done>
</task>

<task type="auto">
  <name>Task 2: Compose /admin/analytics page with click-to-filter drilldown + Analytics sidebar entry + Wave 0 page test</name>
  <files>frontend/app/admin/analytics/page.tsx, frontend/app/admin/analytics/__tests__/AnalyticsPage.test.tsx, frontend/app/admin/components/AdminSidebar.tsx</files>
  <read_first>
    - frontend/app/admin/page.tsx (page structure: "use client", state + useCallback fetch, dynamic imports ssr:false for chart/map, layout padding/maxWidth)
    - frontend/app/admin/components/AdminSidebar.tsx lines ~17-30 (NAV_ITEMS array + MOBILE_TABS array — add an analytics entry)
    - frontend/app/admin/components/Icon.tsx (IconName union — confirmed members include "activity", "grid", "table", "map", "inbox", "users"; there is NO "chart" icon)
    - .planning/phases/04-export-and-public-analytics/04-RESEARCH.md Open Question 4 RESOLVED (new KPI components, not StatsCards), Pitfall 6 (recharts dynamic import)
    - .planning/phases/04-export-and-public-analytics/04-PATTERNS.md "analytics/page.tsx" + "AdminSidebar.tsx" sections
  </read_first>
  <action>
    Create frontend/app/admin/analytics/page.tsx ("use client"): dynamic-import TrendChart and ChoroplethMap with ssr:false (recharts + Leaflet are window-dependent). State: wardData, corpData, trendData, selectedWard (string|null), isLoading, isError. useCallback fetchAnalytics calling Promise.all([getWardAnalytics(), getCorporationAnalytics(), getTrendData()]) in useEffect. Layout per D-06: page title, full-width KpiCards row, full-width Card wrapping TrendChart, then a 1fr 1fr grid with WardTable (left) and ChoroplethMap (right). D-04 drilldown: ChoroplethMap onWardClick sets selectedWard; pass selectedWard to WardTable (highlight/filter) and to TrendChart (refetch trend scoped to ward OR filter client-side) so clicking a ward filters the table and chart. Add a quick "Export CSV" / "Export GeoJSON" button using downloadCsvExport/downloadGeoJsonExport from 04-01 with sensible defaults (D-07 — no duplicate filter bar).
    Create frontend/app/admin/analytics/__tests__/AnalyticsPage.test.tsx — smoke test rendering the page with mocked adminApi (TrendChart/ChoroplethMap mocked since they need DOM/Leaflet); assert it renders without crashing and shows the analytics title.
    In AdminSidebar.tsx add the Analytics nav entry to NAV_ITEMS (and the MOBILE_TABS array if present), positioned after reports/queue. Use icon name `activity` exactly — there is NO `chart` icon in Icon.tsx; `activity` is the verified line/pulse metrics glyph (the same icon used for the OPS dashboard entry). Concretely add: `{ key: "analytics", href: "/admin/analytics", icon: "activity" as const, label: "ANALYTICS" }`.
  </action>
  <verify>
    <automated>cd frontend && npm test -- --testPathPattern=AnalyticsPage --passWithNoTests 2>&1 | tail -6; cd "$OLDPWD" 2>/dev/null; true</automated>
  </verify>
  <acceptance_criteria>
    - frontend/app/admin/analytics/page.tsx exists, dynamically imports TrendChart and ChoroplethMap with ssr:false, and wires ChoroplethMap onWardClick to selectedWard which flows to WardTable and TrendChart
    - AdminSidebar.tsx NAV_ITEMS contains an entry with href `/admin/analytics`, label `ANALYTICS`, and `icon: "activity" as const` (NOT "chart" — that icon does not exist)
    - AnalyticsPage.test.tsx exists and passes
    - `cd frontend && npm run build` has zero TypeScript errors
  </acceptance_criteria>
  <done>The /admin/analytics page composes KPI cards, trend chart, ward table and interactive choropleth with click-to-filter drilldown; the Analytics nav entry uses the verified `activity` icon; smoke test passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| admin browser → /admin/analytics page | Authenticated admin views aggregate analytics rendered client-side |
| npm registry → frontend build | New recharts dependency introduced |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-08 | Information Disclosure | analytics page data fetch | mitigate | All analytics + ward-boundaries fetches route through apiFetch (credentials: 'include') to admin-only endpoints registered under require_auth in 04-03a; aggregate-only data, no per-report PII |
| T-04-SC | Tampering | recharts npm install | mitigate | RESEARCH Package Legitimacy Audit: recharts Approved (recharts/recharts, ~10yr, very high downloads, MIT), manually verified on npm; slopcheck PyPI flag was cross-ecosystem false positive; no postinstall scripts. Pin exact version 3.8.1 |
</threat_model>

<verification>
- `cd frontend && npm run build` zero TypeScript errors
- `cd frontend && npm test -- --testPathPattern=AnalyticsPage` passes
- recharts present in package.json
</verification>

<success_criteria>
- /admin/analytics shows top 10 unresolved wards, corporation resolution rate, 12-week trend line chart, and interactive choropleth
- Clicking a ward filters the table + trend chart (D-04)
- Analytics nav entry present with the `activity` icon; build clean
</success_criteria>

<output>
Create `.planning/phases/04-export-and-public-analytics/04-03b-SUMMARY.md` when done
</output>
