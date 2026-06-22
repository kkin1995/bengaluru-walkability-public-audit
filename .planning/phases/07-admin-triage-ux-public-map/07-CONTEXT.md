# Phase 7: Admin Triage UX + Public Map - Context

**Gathered:** 2026-06-22T00:00:00Z
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers five product improvements that together make the platform more useful for daily GBA admin work and for citizens browsing the public map:

1. **TRIAGE-01 — Admin ward/corp filter**: Two inline selects (Corporation + Ward) added to the existing admin reports filter bar. Selecting a corporation narrows the ward dropdown to that corporation's wards. Options fetched live from new API endpoints.
2. **TRIAGE-02/03 — Public map status chips**: A second chip row (below existing category chips) with status filter chips: All statuses / Open / In progress / Resolved.
3. **TRIAGE-04 — Ward boundary overlay**: A toggleable overlay on the public `/map` showing all 369 ward polygon boundaries as thin teal outlines. Loaded lazily on toggle, served by a new public GeoJSON endpoint.
4. **TRIAGE-05 — Before/after resolution photo**: On the public report detail page, when a resolution photo exists, it appears side-by-side with the original submission photo (labeled "Before" and "After").
5. **MOB-01 through MOB-07 — Mobile Safari layout bugs**: CSS fixes for bottom-nav clipping, chart rendering, choropleth visibility, and admin map layer positioning.
6. **TEST-01 — Backend unit test**: `bake_orientation` test for EXIF orientation=6 → output dimensions 3024×4032.

Phase ends when all 13 requirements pass UAT on mobile Safari and desktop.

</domain>

<decisions>
## Implementation Decisions

### Admin Ward/Corp Filter (TRIAGE-01)

- **D-01:** Two separate selects — Corporation select (5–7 options, no search needed) + Ward select (369 wards, must be searchable/filterable). Both placed **inline with existing filters** in the current admin reports filter bar, alongside category/status/severity selects. On tablet (1024px), the select group scrolls horizontally (`no-scrollbar`) instead of wrapping.
- **D-02:** Selecting a corporation narrows the ward dropdown to show only wards belonging to that corporation. Ward select resets when corporation changes.
- **D-03:** Filter options (corp names, ward names) fetched live from **new backend endpoints** on page mount: `GET /api/admin/corporations` (returns list of corporation names/IDs) and `GET /api/admin/wards` (returns list of ward names/IDs, optionally filtered by corp_id). These are admin-gated endpoints.
- **D-04:** Filtering applies as separate params alongside existing category/status params. Backend `list_admin_reports` query gains `ward_id` and `corporation_id` (or `org_id`) filter support.
- **D-05:** An admin with org_id scoping (e.g., a BBMP corporation admin) already only sees their subtree — the ward/corp filter further narrows within their visible scope. Super-admins see all wards and corps.

**Design spec (from `admin-portal-complete-design.zip` D-22 · AdminFilterBar):**
- Filter triggers: height 32px, JetBrains Mono, borderRadius 4px. Label in muted (e.g., "CORP:"), value in ink. Active state: `--accent-bg` background, `--accent-ink` label.
- Separator: 1px vertical divider between existing filters and the two new geographic selects.
- Corporation popover (236px wide): header shows "CORPORATION" + count. Each row: full corp name (bold) + zone sub-label + report count. Selected row highlighted with `--accent-bg`.
- Ward popover (296px wide): search input at top (`placeholder="grep ward name or no…"`), header shows "Showing N / 369" + corp name filter indicator. Each row: ward number (muted, tabular) + ward name (sans-serif, truncated) + corp tag (shown only in "All corps" view).
- No match state: "no ward matches '{q}'" in muted mono text.
- The two new selects are visually marked as NEW with `--accent-border` ring on the trigger.

### Public Map Status Filter Chips (TRIAGE-02 + TRIAGE-03)

- **D-06:** **Two chip rows** on the public `/map` page: category chips on top (existing, unchanged), status chips on bottom (new). Both rows scroll horizontally on mobile.
- **D-07:** Status chips: **4 chips** — "All statuses · N", "Open · N", "In progress · N", "Resolved · N". Simplified from the 6-state admin enum: `open` + `acknowledged` → "Open"; `assigned` + `in_progress` → "In progress"; `resolved` + `closed` → "Resolved". Chip labels use the existing `publicStatusLabel` mapping from `frontend/app/lib/translations.ts`.
- **D-08:** Chips use the **same visual style** as existing category chips (height 34px, borderRadius 999, backdropFilter blur(8px), same active/inactive states). Status chips add a colored dot (7×7px circle) matching the status color token: Open → `--status-submitted` (teal/blue), In progress → `--status-review` (amber), Resolved → `--status-resolved` (green).

**Design spec (from `admin-portal-complete-design.zip` D-23 · MapChipRows):**
- `MapChip` component: `height: 34px`, `padding: 0 13px`, `borderRadius: 999`, `backdropFilter: blur(8px)`, `background: rgba(255,255,255,0.95)` (inactive) / `var(--ink)` (active). Count in slightly smaller muted text.
- Status dot (7×7px circle) appears before the label. Active dot gets `boxShadow: 0 0 0 1.5px rgba(255,255,255,0.25)`.
- Both rows use `className="no-scrollbar"` for horizontal scroll without visible scrollbar.
- **D-09:** Both category and status filters operate **independently (AND logic)** — both can be active simultaneously. A user can filter to "Damaged footpath + Resolved" to see what's been fixed.
- **D-10:** Status chip **counts are always total counts** per status bucket across all reports — not cross-filtered by category selection. Consistent with how category chip counts work.
- **D-11:** Status filtering is **client-side only** — no new API parameter. The map already fetches all reports into `allReports` and filters client-side. Status filter follows the same pattern.
- **D-12:** When both filters are active but yield zero matching reports: **empty map, no message**. Consistent with existing zero-result behavior for category chips.
- **D-13:** Status filter state is **in-memory only** (useState) — not persisted to URL params. Consistent with existing category chip behavior.

### Ward Boundary Overlay (TRIAGE-04)

- **D-14:** A **new public backend endpoint**: `GET /api/wards/boundaries`. Returns all 369 ward polygons as a GeoJSON FeatureCollection. No authentication required. Each Feature's `properties` includes at minimum `ward_name` and `ward_number`.
- **D-15:** Shows **all 369 wards** (not just wards with reports). Consistent with the admin choropleth. Useful for citizens identifying their ward even if it has no reports.
- **D-16:** Polygon style: **stroke-only — no fill**. Thin teal stroke (~1.5px, `--color-primary` at ~60% opacity). No background fill, so report pins underneath remain clearly visible.
- **D-17:** Hovering (desktop) or tapping (mobile) a ward polygon shows a **Leaflet tooltip/popup with the ward name**. No filter behavior — the overlay is purely informational.
- **D-18 (design override):** Toggle button positioned **bottom-right of the map, stacked above the "Report here" FAB** — NOT top-right. Both buttons share a `flexDirection: column`, `gap: 12` container at `bottom: 24, right: 16` (mobile) / `bottom: 24, right: 24` (desktop). This was decided by the design spec and overrides the earlier discussion decision.
- **D-19:** Overlay is **OFF by default**. Most citizens are looking for report pins; ward boundaries are an optional reference layer.
- **D-20:** GeoJSON is **fetched lazily** — only when the user activates the toggle. Show a brief "Loading..." state on the toggle button while fetching.
- **D-21:** On fetch failure: **silent fail** — the toggle button becomes inactive/greyed out, no error message shown to the citizen.
- **D-22:** **Caching**: `Cache-Control: public, max-age=86400` (24h) on the endpoint response. Add `cf-cache-status` / Cloudflare cache headers so the Cloudflare edge also caches it. Ward boundaries are essentially static — no benefit from frequent re-fetching.
- **D-23:** No rate limiting on this endpoint. With 24h caching at nginx + Cloudflare edge, origin hits are negligible.

**Design spec (from `admin-portal-complete-design.zip` D-24 · WardToggle + WardPolygons):**
- Ward polygons: SVG `GeoJSON` layer with `fill="none"`, `stroke="var(--accent)"`, `strokeOpacity="0.5"`, `strokeWidth="1.5"`, `strokeLinejoin="round"`.
- Ward name labels: SVG `<text>` centered in each polygon, monospace 9px (mobile) / 11px (desktop), `fill: var(--accent-ink)`, opacity 0.7. These are permanent labels when overlay is ON (no hover required for basic identification).
- Toggle button: 52×52px, `borderRadius: 16px`, map icon + "WARDS" label (8px mono). OFF: white/blur background. ON: `--accent` background + `--on-accent` color.
- "Ward boundaries · 369 wards" banner: appears below the search bar when overlay is ON. Small teal-border info strip with a ward-boundary icon sample.
- Desktop legend: a Card bottom-left (`backdropFilter: blur(8px)`) shows pin color meanings (Open / In progress / Resolved) + a ward boundary line symbol. This legend is only shown on desktop.

### Before/After Resolution Photo (TRIAGE-05)

- **D-24:** On the public report detail page, when `resolution_photo_url` is present: display **two equal columns side-by-side on desktop (≥768px)** — left = original photo labeled "Before", right = resolution photo labeled "After". On mobile (<768px): stacked — original above, resolution below.
- **D-25:** When `resolution_photo_url` is null/absent: display only the original photo labeled **"Photo"** (not "Before") with `maxWidth: 520px`. **No empty slot or placeholder for the "After" photo**.
- **D-26:** Each photo block has: a **label** (14px bold — "Before" / "After" / "Photo") + a **sub-label** (11px mono) showing the upload date and who uploaded: e.g., "17 MAY · CITIZEN" (original) and "18 MAY · BBMP EAST" (resolution). The sub-label for the resolution photo should use the admin org name from the report's assigned corporation.
- **D-27:** The overall section heading (e.g., "Photo") **does not change** when two photos are present. The "Before"/"After" labels make the context clear.
- **D-28:** No lightbox or full-screen tap behavior. Both photos are **display-only**. No click/tap interaction needed.

**Design spec (from `admin-portal-complete-design.zip` D-25 · BeforeAfterDesktop / BeforeAfterMobile):**
- `PhotoFrame` component: label (14px bold), sub-label (11px mono, muted, right-aligned), photo with `aspectRatio: 16/9`, `borderRadius: var(--r-md)`, inset shadow.
- The "After" photo has a **"RESOLUTION" badge** pill (top-left of image): `--accent` background, `--on-accent` color, check icon, "RESOLUTION" text in 10px mono. This is a floating label on the resolution photo.
- Desktop: `grid-template-columns: 1fr 1fr`, `gap: 18px`.
- Mobile: `flexDirection: column`, `gap: 16px`.
- Single-photo state (no resolution photo): label is "Photo" not "Before"; `maxWidth: 520px` to avoid the photo spanning the full page width.

### Design Reference

- **D-29:** `admin-portal-complete-design.zip` (project root) is the **admin portal design only**. Direction A ("Daari Ops") in the archive is a design concept, NOT the live citizen portal. Direction B ("Walkability Console") is the actual admin portal.

  **Scope by feature:**
  - **TRIAGE-01 (admin filter bar)** — use `screens-new.jsx` `AdminFilterBar` (Direction B) as the authoritative implementation spec. Pixel values, component APIs, and interaction behavior are exact.
  - **TRIAGE-02/03 (public map chips), TRIAGE-04 (ward overlay), TRIAGE-05 (before/after photo)** — the Direction A screens in `screens-new.jsx` show the intended **layout structure and component behavior** (chip row layout, toggle position, photo grid), but the **CSS tokens and component names must come from the live citizen portal** (`frontend/app/globals.css`, existing `map/page.tsx` chip strip, existing `reports/[id]/page.tsx`). Do not adopt Direction A token names (`--accent-bg`, `--accent-ink`, etc.) — map them to the live citizen portal's equivalent tokens.

### Reviewed Todos

- `auto-assign-org-from-ward.md` todo matched Phase 7 keywords but is unrelated to this phase's scope (it concerns auto-populating `assigned_org_id` at report creation, which was implemented in Phase 3.4). Not folded.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §TRIAGE — TRIAGE-01 through TRIAGE-05 with acceptance criteria
- `.planning/PROJECT.md` §Active — Active v1.1 requirements list (admin triage UX + public map section)

### Admin Reports Queue (TRIAGE-01)
- `frontend/app/admin/reports/page.tsx` — Existing filter bar implementation; ward/corp selects added inline here
- `frontend/app/admin/lib/adminApi.ts` `AdminReportFilters` interface — Extend with `ward_id` and `corporation_id` params
- `backend/src/db/admin_queries.rs` — `list_admin_reports` query; add ward_id + org_id filter clauses here
- `backend/src/handlers/admin.rs` — Admin handler for list endpoint; add new `/api/admin/wards` and `/api/admin/corporations` route handlers here

### Public Map (TRIAGE-02, TRIAGE-03, TRIAGE-04)
- `frontend/app/map/page.tsx` — Public map page; category chips + new status chips + overlay toggle all land here
- `frontend/app/components/ReportsMap.tsx` — Leaflet map component; ward GeoJSON layer added here
- `frontend/app/lib/translations.ts` — `publicStatusLabel` mapping; status chip labels must use this (not hardcoded)
- `backend/src/handlers/admin.rs` (or new `routes/wards.rs`) — New public `GET /api/wards/boundaries` endpoint
- `nginx/nginx.server.conf` and `nginx/nginx.conf` — Add Cache-Control header for `/api/wards/boundaries`; no rate limit zone on this route

### Public Report Detail (TRIAGE-05)
- `frontend/app/reports/[id]/page.tsx` — Public report detail page; before/after photo layout added here
- `PublicReport` interface in same file — `resolution_photo_url?: string | null` already defined; no change needed

### Design System Reference (scoped by surface)
- `admin-portal-complete-design.zip` (project root) — `screens-new.jsx` for TRIAGE-01 (admin) exact specs + TRIAGE-02/03/04/05 layout intent only.
- `tokens.css` in the archive — Direction B only is relevant for implementation. Direction A is a design concept, NOT the live citizen portal.
- `frontend/app/globals.css` — **Authoritative citizen portal CSS tokens** (used for TRIAGE-02/03/04/05 implementation). Always match these, never Direction A from the archive.
- `primitives.jsx` in the archive — Reference for admin portal primitives (`StatusBadge`, `Card`, admin `Icon` usage). Citizen portal uses `frontend/app/components/ui/` primitives instead.

### Mobile Safari Fixes (MOB-01 through MOB-07)
- `frontend/app/admin/admin.css` — Admin CSS variable layer; mobile scroll, bottom-nav safe area, and overflow fixes land here
- `frontend/app/admin/analytics/page.tsx` — Analytics page; choropleth map and chart fixes
- `frontend/app/admin/analytics/ChoroplethMap.tsx` — Admin ward choropleth; MOB-05/06 ward boundary GeoJSON fix
- `frontend/app/admin/reports/map/page.tsx` — Admin map page; MOB-07 bottom nav positioning

### Design System (applies to all frontend work)
- `frontend/app/globals.css` — CSS variable tokens (`--color-primary`, `--color-surface`, etc.); public pages use this
- `frontend/app/admin/admin.css` — Admin portal CSS variable layer; admin pages use this
- `frontend/app/components/ui/` — UI primitives (`Btn`, `Pill`, `Icon`, `Bi`, `SectionLabel`); reuse for any new UI

### Backend Unit Test
- `backend/src/handlers/reports.rs` — `bake_orientation` function; TEST-01 unit test added in `#[cfg(test)]` module here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Category chip strip** (`frontend/app/map/page.tsx`): The 7-chip `CHIPS` array + `chipLabel()` helper + `useState(activeFilter)` pattern is the exact template for the new status chip row. Duplicate the pattern with a `STATUS_CHIPS` array.
- **`Pill` component** (`frontend/app/components/ui/Pill.tsx`): Status badges already use this; status chips may reuse same visual primitive.
- **`publicStatusLabel` / `publicStatusColor`** (`frontend/app/lib/translations.ts`): Already maps the 6-state enum to citizen-facing labels (Open / In Progress / Resolved). The status chip labels must use these — do not hardcode.
- **Admin filter bar** (`frontend/app/admin/reports/page.tsx`): Category and status `<select>` elements already in the filter row. Ward/corp selects follow the same `<select>` + `onChange → setFilter → fetchReports()` pattern.
- **`AdminReportFilters`** (`frontend/app/admin/lib/adminApi.ts`): Interface needs `ward_id?: string` and `corporation_id?: string` (or `org_id?: string`) fields.
- **Admin choropleth GeoJSON fetch** (`frontend/app/admin/analytics/ChoroplethMap.tsx`): Shows the pattern for fetching ward polygon GeoJSON from the backend. The new public endpoint returns the same polygon data but without auth gate and without analytics data.
- **react-leaflet GeoJSON layer**: The admin choropleth already uses react-leaflet's `<GeoJSON>` component. The ward boundary overlay in `ReportsMap.tsx` reuses the same Leaflet GeoJSON approach.
- **HeatmapLayer** (`frontend/app/components/HeatmapLayer.tsx`): Existing example of a toggleable Leaflet overlay layer added to the public map. Ward boundary overlay follows the same conditional-render pattern.
- **`resolution_photo_url`**: Already typed in `PublicReport` interface (`frontend/app/reports/[id]/page.tsx`). No API changes needed.

### Established Patterns
- **Client-side filter state**: `useState` + `allReports.filter(...)` — the existing category filter pattern. Status filter follows identically.
- **Leaflet dynamic import** (CLAUDE.md): `dynamic(() => import(...), { ssr: false })` — mandatory on ALL Leaflet components. Ward boundary layer code lives INSIDE the dynamically-imported component.
- **Config rule** (CLAUDE.md): All env-var config in `frontend/app/lib/config.ts`. `API_BASE_URL` from `config.ts` for the ward boundaries fetch URL.
- **SQLx compile-time checks**: Any new SQL queries in Rust must be registered via `cargo sqlx prepare` after adding them. New admin filter params need SQL changes + query metadata regeneration.
- **Admin API proxy** (`frontend/app/api/admin/[...path]/route.ts`): All `/api/admin/*` calls from the frontend go through this proxy. New admin endpoints (wards, corps) are automatically proxied — no frontend proxy code changes needed.
- **nginx Cache-Control**: For the new public ward boundaries endpoint, add `add_header Cache-Control "public, max-age=86400";` in the nginx location block (similar to `/uploads/` block pattern).

### Integration Points
- New admin filter selects → `AdminReportFilters` type → `getAdminReports()` API call → backend `list_admin_reports` SQL
- New `GET /api/wards/boundaries` → registered in `backend/src/main.rs` router → nginx `/api/wards/` location block → Cloudflare cache
- Status chip row → `allReports` state (already fetched) → `ReportsMap` receives filtered pins
- Ward GeoJSON overlay → new `WardBoundaryLayer` component → rendered inside `ReportsMap.tsx` conditionally based on toggle state passed as prop from `map/page.tsx`
- Before/after photo → `PublicReport.resolution_photo_url` → conditional two-column layout in `reports/[id]/page.tsx`

</code_context>

<specifics>
## Specific Ideas

- **Admin ward select searchability**: With 369 wards, the `<select>` element alone is insufficient. Consider a `<datalist>` + `<input>` combo for native searchable behavior, or a simple `<select>` with `size` attribute that shows a scrollable list. The planner should pick the lightest option that works on mobile Safari — no third-party dropdown library needed.
- **Ward/corp select loading state**: On page mount, while `GET /api/admin/corporations` and `GET /api/admin/wards` are fetching, the selects show a "Loading..." disabled state. On error, they show "Unavailable" disabled. This matches the existing `isLoading`/`fetchError` pattern in the reports page.
- **Ward boundary GeoJSON endpoint caching**: The nginx location block for `/api/wards/` should add `add_header Cache-Control "public, max-age=86400";` and `add_header Vary "Accept-Encoding";`. For Cloudflare caching, the `Cache-Control: public` header is sufficient — Cloudflare respects it. Optionally add `add_header CF-Cache-Status $upstream_http_cf_cache_status;` for cache debugging.
- **Ward overlay toggle button**: A compact button with a ward-grid icon + text "Ward boundaries" in collapsed state, changing to "Hide boundaries" when active. Position: top-right of the Leaflet map container, using Leaflet's `L.Control` or a CSS-positioned div inside the map wrapper. The planner should pick whichever avoids z-index conflicts with Leaflet's own controls.
- **Status chip "In progress" mapping**: In the backend, "in progress" includes `acknowledged`, `assigned`, and `in_progress` enum values. The client-side filter for "In progress" chip must match all three: `r.status === 'acknowledged' || r.status === 'assigned' || r.status === 'in_progress'`. The "Resolved" chip matches both `resolved` and `closed`.
- **Design delivered**: `admin-portal-complete-design.zip` is in the project root. The planner must reference `screens-new.jsx` from this archive — it contains the exact component implementations for all four new features. No pre-execution step needed; the design is available now.

</specifics>

<deferred>
## Deferred Ideas

- **Ward-level filter on public /map (clicking a ward polygon filters report pins)**: This would add a third filter dimension (category + status + ward) to the public map. Significant complexity — requires public API to support ward-level filtering. Deferred to a future phase if GBA stakeholders request it.
- **Cross-filtered status chip counts** (show counts for status × category intersection): More accurate but adds backend complexity. Deferred — total-count approach is sufficient for MVP.
- **URL-persisted filter state on public /map**: Status and category filter state not persisted to URL. Could be added later for shareable filtered map links. Deferred — in-memory is sufficient for v1.1.
- **Email capture on public /map for ward updates**: Out of scope for v1.1. Notifications are a v1.2+ feature (NOTIF-01/02).

### Reviewed Todos (not folded)
- `auto-assign-org-from-ward.md` — todo matched Phase 7 keywords but is unrelated. The auto-assign feature (populating `assigned_org_id` from ward geography at report creation) was implemented in Phase 3.4. Todo is stale and should be closed.

</deferred>

---

*Phase: 7-Admin-Triage-UX-Public-Map*
*Context gathered: 2026-06-22T00:00:00Z*
