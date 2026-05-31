# Phase 4: Export and Public Analytics - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

GBA planners can download full audit exports in CSV or GeoJSON format (filtered by ward/category/status/date range), citizens can see high-level progress statistics on a dedicated public /stats page, admins have ward-level analytics on a new /admin/analytics route (top wards, resolution rate, trend chart, interactive choropleth map), and the public map gains a toggleable issue-density heatmap layer.

Road network KML import (road_segments, road_width_segments) is explicitly out of scope — deferred to Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Heatmap Visualization (MAP-02, ANALYTICS-05)
- **D-01:** Two separate visual layers, NOT a single approach:
  - Public map (/map): `leaflet.heat` point-density heatmap as a Leaflet overlay layer
  - Admin analytics (/admin/analytics): ward choropleth (filled polygons) using react-leaflet GeoJSON layer
- **D-02:** Public heatmap shows **open/unresolved reports only** — resolved reports do not contribute to heat (resolved pins stay green on the pin layer but don't add density heat)
- **D-03:** Heatmap toggle lives in the native Leaflet layer control (`L.control.layers`, top-right) — not the existing filter chip strip
- **D-04:** Admin choropleth is **interactive with filter drilldown** — clicking a ward filters the analytics tables and trend chart below to that ward

### Admin Analytics Page Structure
- **D-05:** New dedicated `/admin/analytics` route with a sidebar nav entry; dashboard (/admin) stays unchanged
- **D-06:** Page layout: KPI cards + trend chart at top (full width); ward table + choropleth map side-by-side at bottom; map click filters the ward table
- **D-07:** Export buttons (CSV + GeoJSON) appear on **both pages**:
  - `/admin/reports` — primary export, uses the existing filter bar (category/status/ward/date range)
  - `/admin/analytics` — quick export button (downloads current filtered data); no duplicate filter controls — uses sensible defaults or a simplified date picker
- **D-08:** Public stats page is a new standalone route at `/stats` (not embedded in the home page `/`). Shareable URL for press and advocacy use by Walkaluru.

### Charts Library (ANALYTICS-04)
- **D-09:** Use **recharts** for all chart components. Recharts covers all Phase 4 chart types (line, bar, area). The admin choropleth map is handled by react-leaflet GeoJSON (not recharts).
- **D-10:** Trend chart (ANALYTICS-04): **line chart** (not bar) for reports per week × 12 weeks — better shows rate of change and trend slope
- **D-11:** Category filter on trend chart: **multi-select with legend toggle** — multiple category lines on one chart; recharts built-in legend click-to-hide handles this natively. Default: all categories shown.

### CSV Export (EXPORT-01)
- **D-12:** [informational] CSV uses English category labels — **no Kannada text** in CSV exports (overrides REQUIREMENTS.md EXPORT-01 mention of "Kannada category labels")
- **D-13:** Full audit export column set: `id`, `submission_date` (DD/MM/YYYY), `category` (English label), `severity`, `status`, `ward_name`, `corporation`, `latitude`, `longitude`, `description`, `assigned_org`, `photo_hash`, `duplicate_count`, `submitter_contact` (name/phone when present), `resolved_at` (DD/MM/YYYY when present), `resolution_notes` (when present)
- **D-14:** [informational] UTF-8 encoding without BOM (no Kannada text means no Excel Kannada rendering issue)
- **D-15:** Streaming response — no buffering all rows in memory (use `tokio-util` + `bytes` pattern, already in Cargo.toml)

### GeoJSON Export (EXPORT-02, EXPORT-03)
- **D-16:** Admin GeoJSON (EXPORT-02): streaming FeatureCollection, filtered by same params as CSV — valid GeoJSON importable into QGIS
- **D-17:** Public GeoJSON (EXPORT-03): **full open data set** — includes `id`, `category`, `severity`, `status`, `ward_name`, `corporation`, `submitted_at` (date only), `description`, `after_photo_url` (when present), `resolution_notes` (when present), `resolved_at` (when present). Coordinates rounded to 3 decimal places (~111m). **No** `submitter_name`, `submitter_phone`, `ip_address`, or `photo_hash`.
- **D-18:** Public GeoJSON endpoint is **rate-limited at both layers** (defense in depth):
  - nginx: dedicated rate-limit zone for the endpoint (e.g., 2 req/min per IP, burst 1) — first line of defense
  - Application: governor crate rate limiter in the Rust handler — second layer for robustness

### Materialized View (ANALYTICS-01)
- **D-19:** Public stats materialized view refreshes automatically via a **PostgreSQL trigger on the reports table** after each insert — `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Data is always current. No pg_cron dependency needed at MVP scale.

### Road Network KML
- **D-20:** [informational] Road network KML import (road_segments + road_width_segments, reports-per-km analytics, corridor clustering) is **deferred to Phase 6** — Phase 5 already has a defined scope. Phase 4 already has 9 requirements; road network would be a significant parallel scope addition.

### Claude's Discretion
- Exact recharts component props, ResponsiveContainer sizing, and tooltip formatting for the trend chart
- Ward choropleth color scale (number of unresolved reports → fill color intensity) — semantic: low = light teal, high = deep red/amber
- leaflet.heat intensity/radius parameters — researcher/planner tune to make heatmap readable at Bengaluru city zoom level
- `/stats` public page visual design (Direction-A design system, globals.css) — layout, section order, typography
- nginx zone name and rate for public GeoJSON endpoint — researcher to confirm safe threshold
- Whether EXPORT-03 public GeoJSON endpoint is `/api/reports.geojson` or `/api/reports/export.geojson` — planner decides

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — EXPORT-01, EXPORT-02, EXPORT-03, ANALYTICS-01–05, MAP-02 (all Phase 4 requirements in full)
- `.planning/ROADMAP.md` — Phase 4 success criteria + proposed plan breakdown (04-01 through 04-04)

### Existing DB Schema
- `backend/migrations/008_workflow.sql` — Current reports table schema (resolution fields, status enum); any new Phase 4 migrations build on this
- `backend/migrations/004_ward_boundaries.sql` — Wards table schema; ward choropleth needs a `/api/wards/boundaries` GeoJSON endpoint derived from this

### Existing Backend (extend, do not replace)
- `backend/src/db/admin_queries.rs` — `list_admin_reports` (for export query starting point), `get_report_stats` (for analytics), `get_intake_stats` (pattern for new analytics endpoints)
- `backend/src/db/queries.rs` — `list_reports_enriched` (public GeoJSON export starting point)
- `backend/src/handlers/admin.rs` — `admin_list_reports`, `admin_get_stats`, `admin_get_intake_stats` — extend with export + analytics handlers
- `backend/Cargo.toml` — `tokio-util` + `bytes` already present for streaming; `geohash` present for reference

### Existing Frontend (extend, do not replace)
- `frontend/app/admin/lib/adminApi.ts` — All existing admin API functions; add export + analytics functions here
- `frontend/app/admin/components/Sparkbars.tsx` — Existing CSS bar component; recharts replaces this for the new trend chart but Sparkbars stays on the dashboard
- `frontend/app/admin/components/StatsCards.tsx` — Reuse pattern for analytics KPI cards
- `frontend/app/admin/AdminSidebar.tsx` — Add "Analytics" nav entry here
- `frontend/app/map/page.tsx` — Public map; add leaflet.heat layer + Leaflet layer control

### Design System
- `frontend/app/admin/admin.css` — Direction-B token layer; all admin analytics components use these tokens (no Tailwind)
- `frontend/app/globals.css` — Direction-A tokens; public /stats page uses these

### Prior Phase Context (decisions still applicable)
- `.planning/phases/03-government-triage-workflow/03-CONTEXT.md` — D-30/D-31/D-33 (public map pin colors, popup shape, resolved pins stay visible); D-34 (admin Direction-B primitives rule); road network deferred section

### Project Context
- `.planning/PROJECT.md` — Stakeholder audiences: GBA planners (exports), Walkaluru (public stats), future PWN algorithm (GeoJSON)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/db/admin_queries.rs::list_admin_reports` — extend with a `format=csv` or `format=geojson` variant for streaming export; filter params already exist
- `backend/src/db/queries.rs::list_reports_enriched` — starting point for public GeoJSON export; needs `resolution_notes`, `after_photo_url`, `resolved_at` fields added
- `frontend/app/admin/components/Sparkbars.tsx` — CSS-based; stays on dashboard; recharts used for new trend chart only
- `frontend/app/admin/components/StatsCards.tsx` — Reuse for analytics KPI row (top wards count, resolution rate, weekly intake KPIs)
- `frontend/app/admin/components/Card.tsx`, `Btn.tsx`, `Select.tsx`, `Icon.tsx` — Direction-B primitives for analytics page layout and controls
- `frontend/app/admin/lib/adminApi.ts::apiFetch` — Reuse for new analytics + export API calls

### Established Patterns
- Streaming response in Rust: `tokio-util` + `bytes` + `StreamBody` — already in Cargo.toml; CSV/GeoJSON export follows this pattern
- `AppError` enum — all backend error paths; 429 for rate limiting, streaming error handling
- `require_auth` middleware — all admin export endpoints behind auth; public GeoJSON endpoint is unauthenticated
- CSS custom properties via inline `style` objects — no Tailwind in admin components (Direction-B rule from Phase 02.5)
- `dynamic(() => import(...), { ssr: false })` — all map components (Leaflet uses `window`); applies to heatmap layer too
- Materialized view pattern: PostGIS already supports `CREATE MATERIALIZED VIEW ... WITH DATA`

### Integration Points
- `backend/src/main.rs` router — add export routes under `/api/admin/reports/export/*` (authed) and `/api/reports.geojson` or `/api/reports/export.geojson` (public)
- `nginx/nginx.conf` + `nginx/nginx.server.conf` — add new rate-limit zone for public GeoJSON endpoint in both configs
- `frontend/app/admin/AdminSidebar.tsx` — add "Analytics" nav item
- `frontend/app/admin/reports/page.tsx` — add Export section with CSV + GeoJSON download buttons
- Public router — new `/stats` page under `frontend/app/stats/page.tsx`
- Ward choropleth: needs new `GET /api/wards/boundaries` endpoint returning ward boundaries as GeoJSON FeatureCollection with `unresolved_count` property per ward

</code_context>

<specifics>
## Specific Ideas

### GBA Planner Workflow
GBA planners use the admin CSV export. They care about: ward name, category, status, date, coordinates. Full audit export (with photo_hash, duplicate_count) satisfies Nammadaari internal tracking too. One export format serves both audiences.

### Public Stats Page (/stats)
Intended for Walkaluru advocacy and press use — shareable URL showing aggregate progress. Should include a "Download open data (GeoJSON)" link for researchers and PWN algorithm input.

### Defense in Depth for Public GeoJSON
The public GeoJSON endpoint is the highest-risk endpoint (serves all reports, no auth). Two-layer rate limiting (nginx zone + governor crate) is non-negotiable. nginx zone is the primary protection.

### Recharts Library Decision
User preference: recharts if it covers all chart types, else something aesthetic and fast. Recharts covers all Phase 4 needs (line chart, bar chart — ward resolution bars). No need for Nivo.

</specifics>

<deferred>
## Deferred Ideas

- **Road network KML import** (road_segments, road_width_segments, reports-per-km analytics, corridor clustering) — deferred to **Phase 6**. Phase 5 is already scoped. KML files exist at project root: `bengaluru-road-centerline-map.kml` (101k segments) + road width KML (23k segments). See Phase 3 CONTEXT.md deferred section for full capability analysis.
- **Ward boundary polygon overlay on public map** (MAP-V2-02 from REQUIREMENTS.md v2) — deferred post-Phase 4; admin choropleth covers the analytics use case
- **Category and status filter controls on public map** (MAP-V2-01) — deferred; public map filter chips exist for category but status filter is v2

</deferred>

---

*Phase: 04-export-and-public-analytics*
*Context gathered: 2026-05-31*
