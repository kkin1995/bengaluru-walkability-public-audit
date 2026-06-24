# Phase 7: Admin Triage UX + Public Map — Research

**Researched:** 2026-06-22
**Domain:** Next.js 14 frontend (TypeScript, App Router) + Rust/Axum backend — civic GIS web app
**Confidence:** HIGH

---

## Summary

Phase 7 is an enhancement-only phase — no schema migrations, no new external dependencies, no new npm packages beyond what already exists. All five feature areas (TRIAGE-01 through TRIAGE-05) and the mobile CSS fixes (MOB-01 through MOB-07) build directly on existing infrastructure. The backend already has `get_ward_boundaries()` (SQL + handler), `admin_get_wards_boundaries`, the full 6-value status enum, and all necessary DB join patterns. The frontend already has the category chip pattern, react-leaflet GeoJSON layer (via ChoroplethMap), the `publicStatusLabel`/`publicStatusColor` functions, and `resolution_photo_url` typed in `PublicReport`.

The highest-risk item is the **admin ward/corp filter (TRIAGE-01)**: it requires two new backend SQL queries (`list_distinct_corporations`, `list_wards_by_corp`) plus two new authenticated endpoints, plus changes to `AdminReportFilters` (Rust model + TypeScript interface) and the `list_admin_reports`/`count_admin_reports` dynamic WHERE clause. The ward select needs client-side searchability for 369 wards — the plan should implement this as a custom popover with text input, not a bare `<select>`, per the design spec.

The **public ward boundary overlay (TRIAGE-04)** requires promoting the existing admin-gated `/api/wards/boundaries` to a new public endpoint `/api/wards/public-boundaries` (or moving the route outside the auth middleware), adding nginx Cache-Control headers, and building a `WardBoundaryLayer` component inside the already-SSR-safe `ReportsMap.tsx`.

**TEST-01** (`bake_orientation` for orientation=6) — the test infrastructure and helper function already exist. The test for orientation=6 at iPhone dimensions (3024×4032) is the only gap: the existing `bake_orientation_6_swaps_width_height` test uses a 3×2 pixel synthetic JPEG. TEST-01 requires the same test to also verify a 3024×4032 input (or the spec's exact assertion); read the requirement carefully — the acceptance criterion says "3024×4032 input produces 4032×3024 output", which the existing generic test already covers logically. Confirm whether a separate named test is needed.

**Primary recommendation:** Implement in this order — TEST-01 (fastest win, zero risk), MOB CSS fixes (no backend, quick iteration), TRIAGE-05 before/after photo (frontend-only), TRIAGE-02/03 status chips (frontend-only), then TRIAGE-04 ward overlay (requires new backend endpoint + nginx), then TRIAGE-01 admin filter (highest complexity, most backend surface).

---

## Project Constraints (from CLAUDE.md)

| Constraint | Rule |
|------------|------|
| Branch protection | Never commit to `main`, `master`, `release-*`, or `phase-*` branches during fix/audit work. Use `fix/<area>-<description>` branches. |
| Git preflight | Run `git rev-parse --show-toplevel`, `git branch --show-current`, `git status --short`, `git log --oneline -5` before any edit. |
| Classification first | During any fix session, classify ALL findings before touching code. |
| Config rule | All env-var config in `frontend/app/lib/config.ts`. Never inline `process.env.*` in components. |
| Leaflet SSR | All Leaflet components via `dynamic(() => import(...), { ssr: false })`. Ward boundary layer code INSIDE the dynamically-imported component. |
| SQLx | After adding SQL queries in Rust, run `cargo sqlx prepare` to regenerate compile-time metadata. This project uses runtime `sqlx::query()` strings (not macros), so `cargo sqlx prepare` is still required for offline builds. |
| Frontend env vars | `NEXT_PUBLIC_API_URL` (client-side), `INTERNAL_API_URL` (server-side). |
| Admin API proxy | All `/api/admin/*` calls auto-proxied by `frontend/app/api/admin/[...path]/route.ts`. New admin endpoints are automatically covered. |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**TRIAGE-01 Admin Filter:**
- D-01: Two selects — corp (5–7 options) + ward (369, must be searchable). Inline with existing filters. Tablet scrolls horizontally.
- D-02: Corp selection narrows ward dropdown. Ward resets on corp change.
- D-03: Options fetched from `GET /api/admin/corporations` and `GET /api/admin/wards`. Admin-gated.
- D-04: Filter applies as separate params alongside category/status. Backend gains `ward_id` + `corporation_id` filter support.
- D-05: Admin with org_id scoping only sees their subtree. Super-admins see all.

**TRIAGE-02/03 Status Chips:**
- D-06: Two chip rows — category (existing) + status (new). Both horizontally scrollable.
- D-07: 4 status chips — "All statuses · N", "Open · N", "In progress · N", "Resolved · N". Mapping: open+acknowledged+assigned → Open; in_progress → In progress; resolved+closed → Resolved.
- D-08: Same visual style as category chips (height 34px/36px in code, borderRadius 999, backdropFilter blur(8px)). Status dot 7×7px.
- D-09: AND logic — category + status both active simultaneously.
- D-10: Status chip counts are total counts, not cross-filtered by category.
- D-11: Status filtering is client-side only — no new API parameter.
- D-12: Zero results = empty map, no message.
- D-13: Status filter state in-memory only (useState), not persisted to URL.

**TRIAGE-04 Ward Overlay:**
- D-14: New public endpoint `GET /api/wards/boundaries`. No auth required. Returns GeoJSON FeatureCollection with ward_name + ward_number properties.
- D-15: Shows all 369 wards regardless of whether they have reports.
- D-16: Stroke-only polygons — no fill. Thin teal (~1.5px, --accent at ~60% opacity).
- D-17: Hover (desktop) / tap (mobile) shows Leaflet tooltip with ward name. No filter behavior.
- D-18: Toggle button bottom-right of map, stacked above "Report here" FAB. Both in a flex column container.
- D-19: Overlay OFF by default.
- D-20: GeoJSON fetched lazily — only on first toggle ON.
- D-21: On fetch failure: silent fail — button inactive/greyed, no error shown.
- D-22: Cache-Control: public, max-age=86400 on the response.
- D-23: No rate limiting on this endpoint.

**TRIAGE-05 Before/After Photo:**
- D-24: Two-col on desktop (≥768px), stacked on mobile (<768px) when resolution_photo_url present.
- D-25: Single photo: label "Photo", maxWidth 520px. No After slot or placeholder.
- D-26: Sub-labels: "DD MMM · CITIZEN" (original) and "DD MMM · {corp_name}" (resolution).
- D-27: Section heading does not change when two photos present.
- D-28: No lightbox or tap interaction.
- D-29: Token authority — globals.css for citizen portal, admin.css for admin portal.

**Design Reference (D-29):** admin-portal-complete-design.zip in project root. Direction B = admin portal (exact spec for TRIAGE-01). Direction A layout intent for TRIAGE-02/03/04/05 only; CSS tokens must come from globals.css/admin.css.

### Claude's Discretion

- Ward select searchability implementation: lightest option that works on mobile Safari — custom popover with text input (not a third-party library).
- Ward/corp loading state implementation details.
- Ward overlay toggle label/icon choice within the 52×52px constraint.
- GeoJSON caching strategy (cache in component state after first successful fetch).

### Deferred Ideas (OUT OF SCOPE)

- Ward-level filter on public /map (clicking a polygon filters pins).
- Cross-filtered status chip counts.
- URL-persisted filter state on public /map.
- Email capture for ward updates.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIAGE-01 | Admin can filter the reports queue by ward or corporation | New backend endpoints + SQL filter clauses + frontend selects in filter bar |
| TRIAGE-02 | Public /map provides filter chips for report category (mirrors admin chip strip) | Category chips already exist — this requirement is already satisfied; verify in UAT |
| TRIAGE-03 | Public /map provides filter chips for report status (open, in progress, resolved) | StatusChipRow component added to map/page.tsx; client-side filter of allReports |
| TRIAGE-04 | Public /map displays a toggleable ward boundary polygon overlay | New public GET /api/wards/boundaries endpoint + WardBoundaryLayer in ReportsMap |
| TRIAGE-05 | Public report detail shows resolution photo alongside original when present | BeforeAfterGrid in reports/[id]/page.tsx; resolution_photo_url already typed |
| MOB-01 | Admin ops page content clipped behind bottom nav on mobile Safari | padding-bottom with safe-area-inset-bottom on scrollable container |
| MOB-02 | Admin queue page content clipped behind bottom nav | Same safe-area pattern on reports list container |
| MOB-03 | Analytics chart data lines not rendering on mobile | Recharts container with explicit width + height |
| MOB-04 | Chart legend shows raw enum strings | Recharts Legend formatter using getCategoryLabel from translations.ts |
| MOB-05 | Choropleth map not visible on mobile | ChoroplethMap container height explicit; null GeoJSON handled gracefully |
| MOB-06 | Ward GeoJSON error on mobile choropleth | Already handled by ChoroplethMap.tsx fetchError state; verify rendering |
| MOB-07 | Admin /map Leaflet controls under bottom nav | Offset Leaflet controls by env(safe-area-inset-bottom) + 56px nav height |
| TEST-01 | bake_orientation unit test for orientation=6 → output dimensions 3024×4032 | bake_orientation function and test module already exist; add specific test |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admin ward/corp filter options (TRIAGE-01) | API/Backend | Frontend (UI) | Filter options are data — must come from DB; frontend renders selects |
| Admin filter query narrowing (TRIAGE-01) | API/Backend | — | SQL WHERE clauses live in Rust db layer |
| Status chip rendering + count (TRIAGE-02/03) | Browser/Client | — | Client-side filter of already-fetched allReports array |
| Ward boundary GeoJSON serving (TRIAGE-04) | API/Backend | CDN/nginx | PostGIS query + serialization in Rust; cached at nginx/Cloudflare |
| Ward boundary rendering (TRIAGE-04) | Browser/Client | — | react-leaflet GeoJSON layer inside ssr:false boundary |
| Before/after photo layout (TRIAGE-05) | Frontend Server (SSR) | — | reports/[id]/page.tsx is a server component; layout is CSS only |
| Mobile Safari CSS fixes (MOB-01–07) | Browser/Client | — | CSS properties in admin.css; Recharts config in analytics/page.tsx |
| bake_orientation test (TEST-01) | API/Backend | — | Rust unit test in reports.rs; pure function, no I/O |

---

## Current State Analysis

### TRIAGE-01 — Admin Ward/Corp Filter

**What exists:**
- `AdminReportFilters` (Rust model, `backend/src/models/admin.rs` line 154) has fields: `category`, `status`, `severity`, `date_from`, `date_to`, `page`, `limit`, `duplicate_of_id`. No `ward_id` or `corporation_id`.
- `AdminReportFilters` (TypeScript, `frontend/app/admin/lib/adminApi.ts` line 127) has: `page`, `limit`, `category`, `status`, `severity`, `date_from`, `date_to`. No geographic filters.
- `build_report_where_clause()` (`admin_queries.rs` line 189) builds dynamic WHERE from category/status/severity/date_from/date_to. No ward or corp filter.
- `list_admin_reports()` already scopes by `org_id` via recursive CTE. Ward-level filtering is additive on top of this.
- The admin filter bar (`admin/reports/page.tsx`) renders category and status `<select>` elements. No ward/corp selects exist.
- `list_organizations()` already returns all orgs — corporations are a subset (`org_type = 'corporation'`).
- The `wards` table exists with `ward_name`, `ward_number`, `corporation`, `org_id` columns (evidenced by `WARD_ANALYTICS_SQL` and ward JOIN patterns throughout).

**What's missing:**
1. Rust: `AdminReportFilters` struct needs `ward_id: Option<Uuid>` and `corporation_id: Option<Uuid>`.
2. Rust: `build_report_where_clause()` + `count_admin_reports()` + `list_admin_reports()` need ward_id/corporation_id WHERE conditions.
3. Rust: Two new DB query functions — `list_distinct_corporations()` and `list_wards_for_filter(corp_id: Option<Uuid>)`.
4. Rust: Two new handler functions + router registration — `GET /api/admin/corporations` and `GET /api/admin/wards`.
5. TypeScript: `AdminReportFilters` interface needs `ward_id?: string` and `corporation_id?: string`.
6. TypeScript: Two new `adminApi.ts` functions: `getCorpoations()` and `getWards(corpId?: string)`.
7. Frontend: Corp select + Ward searchable popover added to `admin/reports/page.tsx` filter bar.

### TRIAGE-02 — Category Chips on Public Map

**What exists:** Category chips already exist in `frontend/app/map/page.tsx` (lines 12–29, `CHIPS` array). The requirement is already satisfied. The plan should confirm in UAT rather than implement again.

**Status:** ALREADY IMPLEMENTED.

### TRIAGE-03 — Status Chips on Public Map

**What exists:**
- `publicStatusLabel()` and `publicStatusColor()` in `translations.ts` — maps 6-state enum to 3-state citizen labels.
- `STATUS_COLORS` constant in `ReportsMap.tsx` — maps status to pin colors.
- Category chip pattern in `map/page.tsx` (lines 55–230) is the exact template.
- `allReports` state already holds all fetched reports; `onReportsLoaded` callback already populates it.

**What's missing:**
1. `STATUS_CHIPS` array and `statusChipLabel()` helper analogous to `CHIPS` and `chipLabel()`.
2. `activeStatusFilter` useState (default: `"all"`).
3. StatusChipRow rendered below category chip row (`top: 120px` — 76 category row + 36px chip + 8px gap).
4. Status counts computed from `allReports` (total counts, not cross-filtered).
5. `ReportsMap` receives `statusFilter` prop; filter applied alongside `categoryFilter` in the CircleMarker `.filter()` call.

**Status mapping for filter:**
- "Open": `status === 'open' || status === 'acknowledged' || status === 'assigned'`
- "In progress": `status === 'in_progress'`
- "Resolved": `status === 'resolved' || status === 'closed'`

### TRIAGE-04 — Ward Boundary Overlay

**What exists:**
- `get_ward_boundaries()` DB function (`admin_queries.rs` line 1640) — returns all ward polygons via `ST_AsGeoJSON(ST_Simplify(boundary::geometry, 0.001))`.
- `admin_get_wards_boundaries` handler (`admin.rs` line 1484) — assembles GeoJSON FeatureCollection.
- This endpoint is registered at `/api/wards/boundaries` inside `admin_protected_router` (requires JWT auth) — MUST NOT be reused as-is.
- `getWardBoundaries()` function in `adminApi.ts` (line 466) — already calls `${BASE}/api/wards/boundaries` but goes through the admin API base URL with credentials.
- `ChoroplethMap.tsx` uses `import { MapContainer, TileLayer, GeoJSON } from "react-leaflet"` — exact same pattern needed for the public overlay.
- `HeatmapLayer.tsx` shows the pattern for a toggleable overlay layer inside `ReportsMap.tsx`.

**What's missing:**
1. A **new public endpoint** — either a duplicate handler registered on the public router without auth middleware, or the existing endpoint moved. The simplest approach: add a new handler `pub_get_ward_boundaries` registered on the public `app` Router at `/api/wards/public-boundaries` (or reuse the same path on a public router).
2. nginx `location` block for the new public ward endpoint with `add_header Cache-Control "public, max-age=86400"` and no rate-limit zone (or a generous one).
3. Frontend: `WardBoundaryLayer` component inside `ReportsMap.tsx` (conditional on `showWardBoundaries` prop).
4. Frontend: `WardToggleButton` in `map/page.tsx` — 52×52px, positioned in a flex column with the FAB.
5. Frontend: `showWardBoundaries` state + lazy GeoJSON fetch logic (fetch once, cache in state).
6. Frontend: public `getPublicWardBoundaries()` function (calls the unauthenticated endpoint, not the admin-proxy version).

**Critical path note:** The existing `/api/wards/boundaries` endpoint is admin-only (inside `admin_protected_router` with `require_auth` layer). The public map cannot use this endpoint. A new public route is required — either a separate handler or the existing one re-registered without the auth layer.

### TRIAGE-05 — Before/After Photo

**What exists:**
- `resolution_photo_url?: string | null` already typed in `PublicReport` interface (`reports/[id]/page.tsx` line 46).
- The resolution section already exists (lines 557–607): when `isResolved`, a simple full-width `<img>` is shown at 180px height inside an accent-colored card.
- `report.assigned_org_name` is NOT currently in the `PublicReport` type or returned by the public reports endpoint. The corp name for the sub-label must be sourced from `report.ward_hierarchy?.corporation` as fallback.

**What's missing:**
1. Replace the existing simple resolution section with the `BeforeAfterGrid` / `PhotoFrame` layout per D-24/D-25.
2. `PhotoFrame` component: label (14px, bold) + sub-label (10px, mono, muted, right-aligned) + `<img>` with `aspectRatio: 16/9`, `borderRadius: var(--r-md)`.
3. `ResolutionBadge` pill on the After photo: floating `position: absolute`, `top: 8px`, `left: 8px`, `background: var(--accent)`, "RESOLUTION" 10px mono.
4. Desktop: `display: grid`, `gridTemplateColumns: 1fr 1fr`, `gap: 20px`. Mobile: `display: flex`, `flexDirection: column`, `gap: 16px`.
5. Single photo: label "Photo", `maxWidth: 520px`, no badge.

**No API changes needed** — `resolution_photo_url` is already in the type and already returned by `GET /api/reports/:id`.

**Important:** The current page already extracts `publicImageUrl` from `image_url` via `split("/uploads/").pop()` — the resolution photo URL likely has the same Docker hostname issue. Apply the same extraction for `resolution_photo_url`.

### MOB-01 through MOB-07 — Mobile Safari Layout Fixes

**What exists:**
- `admin.css` has `env(safe-area-inset-bottom)` referenced in some places already (map/page.tsx FAB uses it: `bottom: "calc(16px + env(safe-area-inset-bottom))"`).
- `ChoroplethMap.tsx` has a `height: 400` inline style on the MapContainer — this may be causing MOB-05 visibility issues on mobile.
- `admin/analytics/page.tsx` uses Recharts `TrendChart` and `ChoroplethMap` dynamically loaded.
- `admin/reports/map/page.tsx` — uses old status enum values (`submitted`, `under_review`, `resolved`) which no longer match the 6-value enum; this is a pre-existing stale code issue.

**Per bug:**
- MOB-01: Admin ops page (`/admin` dashboard). Add `paddingBottom: calc(Npx + env(safe-area-inset-bottom))` on the scrollable inner container. Need to check the layout structure.
- MOB-02: Admin queue page (`admin/reports/page.tsx`). Add safe-area `paddingBottom` to the outer `<div>` container.
- MOB-03: Recharts chart. Must provide explicit `width` + `height` numbers (not just percentages) or use a `ResponsiveContainer` with explicit dimensions.
- MOB-04: Chart legend formatter. Pass `formatter={(value) => getCategoryLabel(value).en}` to Recharts `<Legend>`.
- MOB-05/06: ChoroplethMap container height. Ensure `height: 400` (already set on `MapContainer`) is respected; parent container also needs explicit height. Check `dynamic(() => import("./ChoroplethMap"), { ssr: false })` wrapper div has a height.
- MOB-07: Admin map page Leaflet controls. Use CSS to push Leaflet attribution + any custom controls above the bottom nav: `padding-bottom: calc(56px + env(safe-area-inset-bottom))` on the map wrapper.

### TEST-01 — bake_orientation Unit Test

**What exists:**
- `bake_orientation()` function at line 482 in `handlers/reports.rs` — rotates JPEG based on EXIF orientation tag.
- `bake_orientation_tests` module already exists (line 1021) with:
  - `make_jpeg_with_orientation(width, height, orientation_value)` helper
  - `bake_orientation_1_returns_input_unchanged` — tests orientation=1 (no-op)
  - `bake_orientation_6_swaps_width_height` — tests orientation=6 with a 3×2 pixel JPEG, verifies output is 2×3
  - `bake_orientation_malformed_returns_bad_request` — tests error case

**What's missing:**
- The requirement says "covers the orientation=6 path" with "input 3024×4032, output 4032×3024". The existing `bake_orientation_6_swaps_width_height` test uses a 3×2 pixel JPEG to verify the same dimension swap logic. The acceptance criterion may simply require confirming this test passes (it's already written and likely passes). If the requirement means "add a test using actual iPhone dimensions", add `bake_orientation_6_iphone_portrait_dimensions` using `make_jpeg_with_orientation(3024, 4032, 6)` and asserting `width == 4032, height == 3024`. Note: creating a 3024×4032 pixel JPEG in-memory is expensive but feasible with the existing `make_jpeg_with_orientation` helper.

---

## Implementation Approach

### TRIAGE-01: Admin Ward/Corp Filter

**Backend changes (Rust):**

1. `backend/src/models/admin.rs` — add to `AdminReportFilters`:
   ```rust
   pub ward_id: Option<Uuid>,
   pub corporation_id: Option<Uuid>,
   ```

2. `backend/src/db/admin_queries.rs` — add two new query functions:
   ```rust
   pub async fn list_distinct_corporations(pool: &PgPool) -> Result<Vec<(String, Option<Uuid>)>, AppError>
   // SELECT DISTINCT wards.corporation, o.id FROM wards LEFT JOIN organizations o ON o.name ILIKE '%' || wards.corporation || '%' AND o.org_type = 'corporation' WHERE wards.corporation IS NOT NULL ORDER BY wards.corporation
   
   pub async fn list_wards_for_filter(pool: &PgPool, corp_id: Option<Uuid>) -> Result<Vec<(String, i32, Uuid)>, AppError>
   // SELECT ward_name, ward_number, id FROM wards WHERE ($1::uuid IS NULL OR org_id = $1) ORDER BY ward_number
   ```

3. `backend/src/db/admin_queries.rs` — extend `build_report_where_clause()` to add `ward_id` and `corp_id` conditions:
   ```rust
   fn build_report_where_clause(
       category: Option<&str>, status: Option<&str>, severity: Option<&str>,
       date_from: Option<DateTime<Utc>>, date_to: Option<DateTime<Utc>>,
       ward_id: Option<Uuid>, corporation_id: Option<Uuid>,  // NEW
       start_idx: i32,
   ) -> (String, i32)
   ```
   New conditions:
   - `ward_id`: `reports.ward_id = ${param_idx}` (bind Uuid)
   - `corporation_id`: `reports.ward_id IN (SELECT id FROM wards WHERE org_id = ${param_idx})` (bind Uuid)

4. Update all callers of `build_report_where_clause()`: `list_admin_reports()`, `count_admin_reports()`, `build_export_where_clause()` — pass `None, None` for now on export functions (ward/corp filter on exports is out of scope for this phase).

5. `backend/src/handlers/admin.rs` — add two new handler functions:
   ```rust
   pub async fn admin_list_corporations(...) -> Result<Json<serde_json::Value>, AppError>
   pub async fn admin_list_wards(...) -> Result<Json<serde_json::Value>, AppError>
   ```
   `admin_list_wards` accepts optional `corp_id` query param.

6. `backend/src/main.rs` — register new routes in `admin_protected_router`:
   ```rust
   .route("/api/admin/corporations", get(admin_list_corporations))
   .route("/api/admin/wards", get(admin_list_wards))
   ```

**Frontend changes (TypeScript):**

1. `frontend/app/admin/lib/adminApi.ts`:
   - Add `ward_id?: string` and `corporation_id?: string` to `AdminReportFilters` interface.
   - Add `getAdminCorporations()` function: `GET /api/admin/corporations`.
   - Add `getAdminWards(corpId?: string)` function: `GET /api/admin/wards?corp_id=...`.
   - Update `getAdminReports()` to pass `ward_id` and `corporation_id` params.
   - Update `downloadCsvExport()` and `downloadGeoJsonExport()` to pass ward/corp params (optional, include if scope allows).

2. `frontend/app/admin/reports/page.tsx`:
   - Add `wardId` and `corporationId` state variables.
   - Add `corporations` and `wards` state (fetched on mount).
   - Add `isLoadingFilters` and `filterError` states.
   - Corp select: custom trigger button (32px height, JetBrains Mono, `--r-xs`) + popover with corp list.
   - Ward select: custom trigger button + popover with text search input + filtered ward list.
   - Add vertical divider `|` between existing filters and new geo selects.
   - Corp change: reset ward, fetch new ward list, refetch reports.
   - Ward change: refetch reports with ward_id.
   - Extend `fetchReports()` to accept ward/corp params.
   - Update `categoryRef`/`statusRef` pattern to include `wardIdRef` and `corpIdRef`.

**Ward select searchability approach:** Custom popover (no third-party library). On trigger click: render a fixed/absolute-positioned div with a text input at top, scrollable ward list below. Client-side filter of wards array by `ward_name.toLowerCase().includes(q.toLowerCase()) || String(ward_number).includes(q)`. Show "Showing N / 369" header. "no ward matches '{q}'" when empty.

### TRIAGE-02: Category Chips (already implemented — verify in UAT)

No implementation needed. The `CHIPS` array and chip rendering already exist in `map/page.tsx`. The plan should have a single verification task.

### TRIAGE-03: Status Chips

**`frontend/app/map/page.tsx` changes only:**

```typescript
// Status chip data
const STATUS_CHIPS = [
  { label: "All statuses", value: "all" },
  { label: "Open",          value: "open",        statusGroup: ["open", "acknowledged", "assigned"] },
  { label: "In progress",   value: "in_progress",  statusGroup: ["in_progress"] },
  { label: "Resolved",      value: "resolved",     statusGroup: ["resolved", "closed"] },
] as const;

// Status counts (total, not cross-filtered)
const statusCounts = {
  open:        allReports.filter(r => ["open","acknowledged","assigned"].includes(r.status)).length,
  in_progress: allReports.filter(r => r.status === "in_progress").length,
  resolved:    allReports.filter(r => ["resolved","closed"].includes(r.status)).length,
};

const [activeStatusFilter, setActiveStatusFilter] = useState<string>("all");
```

Status chip row: `position: absolute`, `top: 120`, same horizontal constraints as category chips.

Pass `statusFilter={activeStatusFilter}` to `ReportsMap`. In `ReportsMap`, extend the filter expression:

```typescript
.filter((r) => {
  const categoryMatch = !categoryFilter || categoryFilter === "all" || r.category === categoryFilter;
  const statusMatch = !statusFilter || statusFilter === "all"
    || (statusFilter === "open" && ["open","acknowledged","assigned"].includes(r.status))
    || (statusFilter === "in_progress" && r.status === "in_progress")
    || (statusFilter === "resolved" && ["resolved","closed"].includes(r.status));
  return categoryMatch && statusMatch;
})
```

`ReportLite` type in `map/page.tsx` needs `status: string` field (currently only has `category: string`). Add it. The `onReportsLoaded` callback from `ReportsMap` already receives `Report[]` which has `status`.

### TRIAGE-04: Ward Boundary Overlay

**Backend:**

1. Create a new public handler in `backend/src/handlers/admin.rs` (or a new `handlers/wards.rs`):
   ```rust
   pub async fn public_get_ward_boundaries(
       State(state): State<AppState>,
   ) -> impl IntoResponse {
       // No auth required
       // Same logic as admin_get_wards_boundaries but no Extension(claims)
       // Add Cache-Control header: "public, max-age=86400"
   }
   ```

2. Register in `backend/src/main.rs` on the public router:
   ```rust
   .route("/api/wards/boundaries", get(handlers::wards::public_get_ward_boundaries))
   ```
   Note: This path conflicts with the existing admin-protected `/api/wards/boundaries`. Resolution: either rename the admin endpoint to `/api/admin/wards/boundaries` (breaking change to `adminApi.ts`), or use `/api/wards/public-boundaries` for the new public endpoint. Recommended: rename the admin endpoint to `/api/admin/wards/boundaries` and move it inside `admin_protected_router`, then register `/api/wards/boundaries` on the public router for the new unauthenticated version.

3. `nginx/nginx.conf` — add a location block for the new public endpoint:
   ```nginx
   location = /api/wards/boundaries {
       add_header Cache-Control "public, max-age=86400";
       add_header Vary "Accept-Encoding";
       proxy_pass http://backend;
       proxy_set_header Host              $host;
       proxy_set_header X-Real-IP         $remote_addr;
       proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
   No rate-limit zone per D-23.

**Frontend:**

1. `frontend/app/lib/config.ts` — add `PUBLIC_WARD_BOUNDARIES_URL` or reuse `API_BASE_URL + "/api/wards/boundaries"`.

2. `frontend/app/components/ReportsMap.tsx`:
   - Add `showWardBoundaries: boolean` prop.
   - Import `GeoJSON` from `react-leaflet` (already imported in ChoroplethMap, safe pattern confirmed).
   - Import `FeatureCollection` from `geojson` (already used in adminApi.ts).
   - `WardBoundaryLayer` component (inside ReportsMap.tsx, inside SSR boundary):
     ```tsx
     function WardBoundaryLayer({ geojson }: { geojson: FeatureCollection }) {
       return (
         <GeoJSON
           key="ward-boundaries"
           data={geojson}
           style={() => ({
             fill: false,
             stroke: true,
             color: "var(--accent)", // NOTE: CSS vars don't work in Leaflet SVG; use hardcoded value
             opacity: 0.5,
             weight: 1.5,
             lineCap: "round",
             lineJoin: "round",
           })}
           onEachFeature={(feature, layer) => {
             layer.bindTooltip(feature.properties?.ward_name ?? "Ward", { sticky: true });
           }}
         />
       );
     }
     ```
     **CSS var caveat:** Leaflet SVG `color` does not inherit CSS custom properties from the document. Use the resolved value of `--accent` directly: `oklch(0.62 0.14 145)` or its computed hex equivalent. Read from `getComputedStyle(document.documentElement).getPropertyValue('--accent')` at mount time, or hardcode.

3. `frontend/app/map/page.tsx`:
   - Add `showWardBoundaries` useState (default: `false`).
   - Add `wardBoundariesGeojson` useState (default: `null`).
   - Add `wardBoundariesStatus: 'idle' | 'loading' | 'loaded' | 'error'` useState.
   - `WardToggleButton` component or inline button: 52×52px, `borderRadius: var(--r-lg)` (16px), flex column, grid icon + "WARDS" label.
   - Toggle logic: on first ON toggle, fetch `${API_BASE_URL}/api/wards/boundaries`. On success: set geojson state + `loaded` status. On error: set `error` status, button goes to disabled/greyed. Subsequent ON toggles reuse cached geojson (no re-fetch).
   - Move FAB + ward toggle into a flex column container at `bottom: calc(24px + env(safe-area-inset-bottom))`, `right: 16px` (mobile).
   - Pass `showWardBoundaries` and `wardBoundariesGeojson` to `ReportsMap`.

### TRIAGE-05: Before/After Photo

**`frontend/app/reports/[id]/page.tsx` changes:**

Replace the existing resolution section (lines 557–607) with a `BeforeAfterGrid` layout:

```tsx
{/* Photo section */}
<section aria-label="Photo" style={{ marginBottom: 20 }}>
  {report.resolution_photo_url ? (
    // Two-photo grid
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",  // responsive
      gap: 20,
    }}>
      {/* Before (original) */}
      <PhotoFrame
        label="Before"
        subLabel={`${formatPhotoDate(report.created_at)} · CITIZEN`}
        src={publicImageUrl}
      />
      {/* After (resolution) */}
      <PhotoFrame
        label="After"
        subLabel={`${formatPhotoDate(resolvedAt)} · ${corpName}`}
        src={publicResolutionUrl}
        badge
      />
    </div>
  ) : (
    // Single photo
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <PhotoFrame
        label="Photo"
        subLabel={`${formatPhotoDate(report.created_at)} · CITIZEN`}
        src={publicImageUrl}
      />
    </div>
  )}
</section>
```

`PhotoFrame` component (inline in same file):
```tsx
function PhotoFrame({ label, subLabel, src, badge }: { label: string; subLabel: string; src: string; badge?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{subLabel}</span>
      </div>
      <div style={{ position: "relative" }}>
        {badge && (
          <span aria-hidden="true" style={{
            position: "absolute", top: 8, left: 8, zIndex: 1,
            background: "var(--accent)", color: "#ffffff",
            fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
            padding: "3px 8px", borderRadius: "var(--r-full)",
          }}>
            RESOLUTION
          </span>
        )}
        <img src={src} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: "var(--r-md)", display: "block" }} />
      </div>
    </div>
  );
}
```

**Resolution photo URL extraction:** Apply same pattern as `publicImageUrl`:
```typescript
const resolutionFilename = (report.resolution_photo_url ?? "").split("/uploads/").pop() ?? "";
const publicResolutionUrl = resolutionFilename ? `${API_BASE_URL}/uploads/${resolutionFilename}` : "";
```

**Corp name for sub-label:** Use `wh?.corporation ?? "GBA"` as the corp name. The `assigned_org_name` is not in the public report type — the ward hierarchy corporation is the correct attribution.

**Resolved date for After sub-label:** The `PublicReport` type does not include `resolved_at`. Use `report.history` (status history) — find the last entry with status `resolved` or `closed` and use its `changed_at`. Fallback: `report.created_at`.

### MOB-01 through MOB-07

All CSS fixes. Target files: `frontend/app/admin/admin.css`, `frontend/app/admin/analytics/page.tsx`, `frontend/app/admin/analytics/ChoroplethMap.tsx`, `frontend/app/admin/reports/map/page.tsx`.

| Bug | File | Fix |
|-----|------|-----|
| MOB-01 | Admin ops dashboard container | Add `paddingBottom: "calc(80px + env(safe-area-inset-bottom))"` to scrollable area |
| MOB-02 | `admin/reports/page.tsx` outer div | Add same `paddingBottom` to the main container `style={{ padding: "24px 32px", ... }}` |
| MOB-03 | `analytics/page.tsx` TrendChart | Wrap chart in `ResponsiveContainer` with explicit `height={300}` or pass fixed dimensions |
| MOB-04 | `analytics/page.tsx` chart Legend | Add `formatter={(v: string) => getCategoryLabel(v).en}` to Recharts `<Legend>` |
| MOB-05/06 | `analytics/ChoroplethMap.tsx` | Ensure parent div has explicit `height: 400px`; `fetchError` already handled |
| MOB-07 | `admin/reports/map/page.tsx` | Add `paddingBottom: calc(56px + env(safe-area-inset-bottom))` to map wrapper, or offset Leaflet attribution control |

### TEST-01: bake_orientation orientation=6

**`backend/src/handlers/reports.rs` — add to `bake_orientation_tests` module:**

```rust
/// TEST-01 — orientation 6 at iPhone portrait dimensions (3024×4032 input → 4032×3024 output).
/// This matches the iPhone 16 Pro Max JPEG dimensions reported in Phase 5 UAT.
#[test]
fn bake_orientation_6_iphone_portrait_dimensions() {
    // Build a 3024×4032 JPEG (iPhone portrait: width=3024, height=4032) with orientation=6 (90 CW).
    // NOTE: This creates a real JPEG in memory — takes ~0.5s in debug builds.
    let input = make_jpeg_with_orientation(3024, 4032, 6);
    let output = bake_orientation(&input)
        .expect("bake_orientation must succeed for orientation=6 iPhone portrait");
    let decoded = image::load_from_memory(&output)
        .expect("Output of bake_orientation must be a valid JPEG");
    assert_eq!(
        decoded.width(), 4032,
        "After 90 CW rotation of 3024×4032 iPhone portrait, output width must be 4032"
    );
    assert_eq!(
        decoded.height(), 3024,
        "After 90 CW rotation of 3024×4032 iPhone portrait, output height must be 3024"
    );
}
```

**Warning:** Allocating a 3024×4032 RGB8 image in a test is ~35 MB. The test will be slow (~2–5 seconds). Consider marking with `#[ignore]` unless CI has sufficient memory, or use a smaller canonical size (e.g., 756×1008 = 3024/4 × 4032/4) that proves the same mathematical property. Check with the user which approach is preferred.

---

## Backend Work Required

### New Endpoints

| Endpoint | Auth | Handler Function | Notes |
|----------|------|------------------|-------|
| `GET /api/admin/corporations` | JWT required | `admin_list_corporations` | Returns `[{id, name}]` of distinct corporations |
| `GET /api/admin/wards?corp_id=...` | JWT required | `admin_list_wards` | Returns `[{id, ward_name, ward_number}]`; corp_id filter optional |
| `GET /api/wards/boundaries` (public) | None | `public_get_ward_boundaries` | New public handler; same query as admin version but no auth |

### SQL Changes

| File | Change |
|------|--------|
| `admin_queries.rs` | Add `ward_id: Option<Uuid>` and `corporation_id: Option<Uuid>` params to `build_report_where_clause()` |
| `admin_queries.rs` | Update `list_admin_reports()` and `count_admin_reports()` signatures + call sites |
| `admin_queries.rs` | Add `list_distinct_corporations()` function |
| `admin_queries.rs` | Add `list_wards_for_filter(corp_id: Option<Uuid>)` function |
| `admin_queries.rs` | Add `pub_get_ward_boundaries()` function (same SQL, no unresolved_count needed for public use, or reuse existing) |

### Router Registration

| File | Change |
|------|--------|
| `backend/src/main.rs` | Add `GET /api/admin/corporations` and `GET /api/admin/wards` to `admin_protected_router` |
| `backend/src/main.rs` | Add `GET /api/wards/boundaries` to public `app` Router (before merge with admin routers) |
| `backend/src/main.rs` | Rename admin ward boundaries from `/api/wards/boundaries` to `/api/admin/wards/boundaries` in `admin_protected_router` (to avoid route conflict with new public endpoint) |

### nginx Changes

| File | Change |
|------|--------|
| `nginx/nginx.conf` | Add `location = /api/wards/boundaries` with `add_header Cache-Control "public, max-age=86400"` |

---

## Frontend Work Required

### New Components (all inline in their parent files)

| Component | File | Size |
|-----------|------|------|
| `PhotoFrame` | `reports/[id]/page.tsx` | ~30 lines |
| `ResolutionBadge` | Inside `PhotoFrame` | ~5 lines |
| `WardBoundaryLayer` | `components/ReportsMap.tsx` | ~25 lines |
| `WardToggleButton` | `map/page.tsx` | ~30 lines |
| `StatusChipRow` | `map/page.tsx` | ~50 lines (based on category chip pattern) |

### Extended Files

| File | Changes |
|------|---------|
| `frontend/app/admin/lib/adminApi.ts` | Add `ward_id?`, `corporation_id?` to `AdminReportFilters`; add `getAdminCorporations()`, `getAdminWards()` |
| `frontend/app/admin/reports/page.tsx` | Add corp/ward selects to filter bar; extend `fetchReports()` |
| `frontend/app/map/page.tsx` | Add `StatusChipRow`, `WardToggleButton`, `showWardBoundaries` state, FAB column layout |
| `frontend/app/components/ReportsMap.tsx` | Add `showWardBoundaries` prop, `WardBoundaryLayer` component |
| `frontend/app/reports/[id]/page.tsx` | Replace existing resolution section with `BeforeAfterGrid`/`PhotoFrame` layout |
| `frontend/app/admin/admin.css` | Add MOB safe-area padding utilities |
| `frontend/app/admin/analytics/page.tsx` | Fix chart dimensions (MOB-03/04) |
| `frontend/app/admin/analytics/ChoroplethMap.tsx` | Fix container height (MOB-05/06) |
| `frontend/app/admin/reports/map/page.tsx` | Fix Leaflet control positioning (MOB-07) |

---

## Integration Points

### Admin Ward/Corp Filter Flow

```
Admin user selects "BBMP East" corp
→ handleCorpChange("bbmp-east-uuid")
→ setWardId("") + setCorporationId("bbmp-east-uuid")
→ fetchWards("bbmp-east-uuid") → GET /api/admin/wards?corp_id=... → backend wards query
→ fetchReports(..., corporationId: "bbmp-east-uuid") → GET /api/admin/reports?corporation_id=...
→ admin_list_reports() → build_report_where_clause() adds ward_id IN (SELECT wards.id WHERE org_id = $N)
→ filtered report list returned
```

### Ward Boundary Overlay Flow

```
User taps "WARDS" toggle (OFF → ON)
→ setWardBoundariesStatus("loading")
→ fetch GET /api/wards/boundaries
→ nginx serves response with Cache-Control: public, max-age=86400
→ Response cached at nginx (subsequent requests = nginx cache hit, no backend hit)
→ setWardBoundariesGeojson(data) + setWardBoundariesStatus("loaded") + setShowWardBoundaries(true)
→ map/page.tsx passes showWardBoundaries=true + wardBoundariesGeojson to ReportsMap
→ ReportsMap renders <WardBoundaryLayer data={wardBoundariesGeojson} />
→ react-leaflet renders GeoJSON SVG overlay on top of tile layer
```

### Public Map Status Filter Flow

```
Reports fetched once: GET /api/reports.geojson → allReports state
Status chip clicked → setActiveStatusFilter("in_progress")
→ statusCounts remain from full allReports (not re-filtered by category)
→ ReportsMap receives statusFilter="in_progress"
→ CircleMarker .filter() applies: categoryFilter AND statusFilter
→ Only in_progress markers rendered (category filter also applied if active)
```

---

## Implementation Risks

### Risk 1: Route Conflict — `/api/wards/boundaries`

**Problem:** The existing `/api/wards/boundaries` route is registered in `admin_protected_router` (auth-gated). A new public route at the same path cannot coexist in Axum — the protected version would shadow or conflict with the public version depending on merge order.

**Solution:** Rename the admin endpoint to `/api/admin/wards/boundaries` (more semantically correct) and update:
- `adminApi.ts` `getWardBoundaries()` function call from `${BASE}/api/wards/boundaries` to `${BASE}/api/admin/wards/boundaries`
- nginx: remove any old location block; add new public location block
- Register new public handler at `/api/wards/boundaries` on the public `app` Router

### Risk 2: Leaflet SVG and CSS Custom Properties

**Problem:** Leaflet renders ward polygon SVG via its own DOM manipulation. CSS custom properties (e.g., `var(--accent)`) do not propagate into Leaflet's SVG layers in all browsers — iOS Safari is especially inconsistent.

**Solution:** Read the computed value at component mount:
```typescript
const accentColor = typeof window !== 'undefined'
  ? getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || 'oklch(0.62 0.14 145)'
  : 'oklch(0.62 0.14 145)';
```
Or hardcode the resolved value `oklch(0.62 0.14 145)` (from globals.css). The ChoroplethMap uses `#4a5568` directly — same approach.

### Risk 3: SQLx Compile-Time Metadata

**Problem:** The backend uses `sqlx::query()` (runtime queries, not `query!` macros), but `cargo sqlx prepare` still needs to be run after adding queries that reference new parameter types (Uuid params). Without it, offline builds (Docker) fail.

**Solution:** After all Rust changes, run:
```bash
cargo sqlx prepare --database-url "postgres://walkability:secret@localhost:5432/walkability"
```
This updates `.sqlx/` metadata files. These must be committed.

**Note:** The project uses runtime `sqlx::query()` strings, so there are no macro-level compile errors — only offline build failures. `cargo test` and `cargo run` with a live DB will work without `cargo sqlx prepare`. Only Docker builds without a live DB require it.

### Risk 4: Ward Select Searchability on Mobile Safari

**Problem:** A native `<select>` with 369 options is unusable on mobile (no search). A third-party dropdown library is out of scope (D-01: no third-party libraries needed).

**Solution:** Custom popover div. Key Mobile Safari concerns:
- Do not use `position: fixed` inside a scrollable parent (can cause rendering bugs on iOS). Use `position: absolute` relative to a `position: relative` container.
- Ensure the popover has `z-index` above all other admin content.
- Use `overflow-y: auto` with `-webkit-overflow-scrolling: touch` for smooth scroll on the ward list.
- Input `type="search"` or `type="text"` — avoid `type="tel"` or `type="number"`.

### Risk 5: bake_orientation Test Memory

**Problem:** Creating a 3024×4032 JPEG in-memory for TEST-01 allocates ~35 MB (RGB8). In debug mode this may be slow (2–5 seconds per test run).

**Solution:** Use a proportionally smaller image (e.g., 756×1008, exactly 1/4 scale of iPhone dimensions) to verify the same rotation math. The acceptance criterion's mention of "3024×4032" verifies the function handles that path, which the existing `bake_orientation_6_swaps_width_height` test already covers generically. Discuss with user whether full iPhone dimensions are required.

### Risk 6: Resolution Photo Date

**Problem:** `PublicReport` type has `created_at` but not `resolved_at`. The "After" sub-label needs the resolution date (`"18 MAY · BBMP EAST"`).

**Solution:** Parse `report.history` for the last entry with `status === "resolved" || status === "closed"` and use its `changed_at`. If history is empty, fall back to `report.created_at`. This is a client-side derivation with no API changes.

### Risk 7: Admin Ward Filter and Org Scoping

**Problem:** The `list_admin_reports()` function already has org_id scoping via recursive CTE. Adding `ward_id` filter on top of this is additive (AND condition). However: if a super-admin filters by a ward that belongs to a different corporation's org tree, the result should correctly return that ward's reports (super-admins see all). The org_id CTE is only applied when `org_id.is_some()`, so super-admins (org_id = None) will correctly see all wards.

**For scoped admins:** Their org CTE already limits ward visibility. If they try to filter by a ward outside their org tree, the AND condition produces zero results (correct behavior — they shouldn't see those wards anyway, and the ward dropdown should only show their accessible wards filtered by the API).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Rust built-in tests (`cargo test`) |
| Config file | none — standard Rust test setup |
| Quick run command | `cd backend && cargo test -- --test-thread=1 2>&1 \| tail -20` |
| Full suite command | `cd backend && cargo test 2>&1` |
| Frontend lint | `cd frontend && npm run lint` |
| Frontend build | `cd frontend && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| TRIAGE-01 | Ward/corp filter narrows reports | Manual UAT | Manual — requires live DB | Verify in staging with real data |
| TRIAGE-02 | Category chips visible + functional | Manual UAT | Manual | Already implemented — smoke test |
| TRIAGE-03 | Status chips visible + counts correct | Manual UAT | Manual | Verify on staging |
| TRIAGE-04 | Ward overlay renders + toggles | Manual UAT | Manual — requires browser | Test on mobile Safari + desktop Chrome |
| TRIAGE-05 | Before/after layout correct | Manual UAT | Manual | Test with a report that has resolution_photo_url |
| MOB-01 | Admin ops page scrolls past bottom nav | Manual UAT | Manual — requires iOS Safari | |
| MOB-02 | Admin queue scrolls past bottom nav | Manual UAT | Manual — requires iOS Safari | |
| MOB-03 | Analytics chart renders on mobile | Manual UAT | Manual — requires iOS Safari | |
| MOB-04 | Chart legend shows human labels | Manual UAT | Manual | |
| MOB-05/06 | Choropleth map visible on mobile | Manual UAT | Manual — requires iOS Safari | |
| MOB-07 | Admin map controls above bottom nav | Manual UAT | Manual — requires iOS Safari | |
| TEST-01 | bake_orientation(orientation=6) | Unit test | `cd backend && cargo test bake_orientation_6` | Already exists; add iPhone-dimensions variant |

### Wave 0 Gaps

- [ ] `backend/src/handlers/reports.rs` — add `bake_orientation_6_iphone_portrait_dimensions` test (or confirm existing test suffices for the acceptance criterion)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ward boundary GeoJSON assembly | Custom Rust GeoJSON serializer | `serde_json::json!()` with PostGIS `ST_AsGeoJSON()` output | Already pattern-proven in `admin_get_wards_boundaries` |
| Client-side status filtering | Custom filter engine | `Array.filter()` with explicit status group arrays | Simple predicate matching is sufficient |
| Searchable ward dropdown | Third-party library (react-select, downshift) | Custom popover with `<input type="text">` + client-side filter | D-01: no third-party libraries; 369 items is manageable with simple string filter |
| Leaflet GeoJSON layer | Custom SVG overlay | `react-leaflet <GeoJSON>` component | Already used in `ChoroplethMap.tsx`; well-tested pattern |
| JPEG orientation detection | Custom EXIF parser | `img-parts` + existing `read_exif_orientation_tag()` | Already implemented; bake_orientation uses it |

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `<select>` for large lists | Custom searchable popover | `<select>` with 369 options unusable on mobile; custom popover needed |
| Leaflet CSS vars | Hardcoded color values in Leaflet layer styles | CSS custom properties don't propagate to Leaflet SVG on iOS Safari |
| Inline `process.env.*` | `frontend/app/lib/config.ts` centralized | Project rule — all env var access through config module |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `resolved_at` column exists on reports table but is not in `PublicReport` type — use `history` for After photo date | TRIAGE-05 | If history is empty for resolved reports, date fallback to created_at (safe but imprecise) |
| A2 | `assigned_org_name` is not returned by the public GET /api/reports/:id endpoint | TRIAGE-05 | If it is available, use it directly instead of `ward_hierarchy.corporation` |
| A3 | The admin `ChoroplethMap.tsx` imports CSS from `"leaflet/dist/leaflet.css"` — this must not conflict with the public map's Leaflet CSS | MOB-05/06 | If both load, CSS could be duplicated — acceptable, Leaflet CSS is idempotent |
| A4 | Ward select popover should use `position: absolute` not `position: fixed` to avoid iOS Safari rendering bugs | TRIAGE-01 | If absolute-positioned popover clips behind other elements, may need z-index or portal approach |
| A5 | CSS custom property `--accent` resolves correctly when read via `getComputedStyle` in the Leaflet component mount | TRIAGE-04 | If globals.css loads after ReportsMap mounts, the value may be empty; fallback to hardcoded color handles this |

---

## Open Questions

1. **bake_orientation test scope (TEST-01)**
   - What we know: existing `bake_orientation_6_swaps_width_height` test verifies orientation=6 math with a 3×2 pixel JPEG
   - What's unclear: does TEST-01 require a test using actual iPhone dimensions (3024×4032) or is the existing test sufficient?
   - Recommendation: Add the iPhone-dimensions test but use 756×1008 (1/4 scale) to avoid 35 MB allocation. Ask user to confirm if exact dimensions are required.

2. **Admin ward boundaries endpoint naming conflict**
   - What we know: `/api/wards/boundaries` is currently admin-only; the public feature requires the same path unauthenticated
   - What's unclear: the CONTEXT.md says `GET /api/wards/boundaries` for the public endpoint — same path as the existing admin one
   - Recommendation: Rename admin endpoint to `/api/admin/wards/boundaries`; register public at `/api/wards/boundaries`. Update `adminApi.ts` `getWardBoundaries()` call.

3. **Resolution photo sub-label corp name source**
   - What we know: `report.assigned_org_name` is not in `PublicReport`; `wh?.corporation` is available
   - What's unclear: is `wh.corporation` always correct for the resolution attribution (the admin who resolved it might be from a different corp than the ward's corp)
   - Recommendation: Use `wh?.corporation` as best available; this is cosmetic information

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| PostgreSQL + PostGIS | All backend queries | Per staging environment | No schema changes in this phase |
| react-leaflet | TRIAGE-04 WardBoundaryLayer | Already in package.json | Used in ChoroplethMap.tsx |
| geojson types | TRIAGE-04 | Already in package.json (imported in adminApi.ts) | |
| Recharts | MOB-03/04 | Already in package.json (used in TrendChart) | |
| cargo test | TEST-01 | Available | Rust unit tests, no live DB needed |

---

## Security Domain

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V4 Access Control | YES — new admin endpoints must be JWT-gated | `admin_protected_router` + `require_auth` middleware |
| V5 Input Validation | YES — corp_id / ward_id params are Uuid | Axum `Query<AdminReportFilters>` with Uuid type coerces or rejects invalid UUIDs |
| V4 — Public endpoints | YES — ward boundaries public endpoint must have NO auth | Register on public `app` Router only, never in `admin_protected_router` |

The new public `/api/wards/boundaries` endpoint returns only geographic data (ward polygons + ward_name/ward_number). No PII, no report data, no report counts in the public version. This is safe to expose without authentication.

---

## Sources

### Primary (HIGH confidence — codebase inspection)
- `frontend/app/admin/reports/page.tsx` — existing filter bar implementation [VERIFIED: file read]
- `frontend/app/admin/lib/adminApi.ts` — AdminReportFilters interface [VERIFIED: file read]
- `backend/src/db/admin_queries.rs` — list_admin_reports SQL + build_report_where_clause [VERIFIED: file read]
- `backend/src/handlers/admin.rs` — admin_get_wards_boundaries handler + route registration [VERIFIED: file read]
- `backend/src/main.rs` — router registration including /api/wards/boundaries placement [VERIFIED: file read]
- `frontend/app/map/page.tsx` — category chip pattern [VERIFIED: file read]
- `frontend/app/components/ReportsMap.tsx` — map props, STATUS_COLORS, filter pattern [VERIFIED: file read]
- `frontend/app/lib/translations.ts` — publicStatusLabel/publicStatusColor functions [VERIFIED: file read]
- `frontend/app/reports/[id]/page.tsx` — PublicReport interface, resolution section [VERIFIED: file read]
- `frontend/app/admin/analytics/ChoroplethMap.tsx` — GeoJSON layer pattern [VERIFIED: file read]
- `backend/src/handlers/reports.rs` — bake_orientation function + existing tests [VERIFIED: file read]
- `nginx/nginx.conf` — existing location blocks, rate-limit zones [VERIFIED: file read]
- `frontend/app/admin/admin.css` — admin CSS tokens [VERIFIED: file read]
- `.planning/phases/07-admin-triage-ux-public-map/07-CONTEXT.md` — locked decisions [VERIFIED: file read]
- `.planning/phases/07-admin-triage-ux-public-map/07-UI-SPEC.md` — visual contracts [VERIFIED: file read]

### Secondary (MEDIUM confidence — ASSUMED from training knowledge)
- Leaflet SVG CSS custom property propagation behavior [ASSUMED] — documented known issue; hardcode fallback is standard mitigation
- iOS Safari `position: fixed` inside scrollable parent behavior [ASSUMED] — documented iOS rendering quirk; `position: absolute` is the standard workaround

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in the project; no new dependencies
- Architecture patterns: HIGH — all patterns exist in the codebase and are verified
- Pitfalls: MEDIUM — Leaflet/iOS Safari CSS vars and route conflicts are documented patterns; one ASSUMED item

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable codebase; no fast-moving dependencies)
