# Phase 5: UAT Stabilisation - Context

**Gathered:** 2026-06-05T07:17:13Z
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all 13 confirmed bugs from the v1.0 live iPhone field test (staging.nammadaari.com, iPhone 16 Pro Max, iOS 26.5, 2026-06-01). Every requirement in this phase is a confirmed UAT finding — no new capabilities, no speculative improvements. The phase is complete when all FIX-01 through FIX-13 success criteria pass on a live iOS Safari test device.

Bugs span: frontend URL construction, route navigation, Leaflet iOS rendering, backend EXIF orientation processing, backend SQL queries, backend status history filtering, backend location_source values + DB migration, CSS overflow, and CI build-time injection.

</domain>

<decisions>
## Implementation Decisions

### FIX-01 — Public report photo broken (Critical)
- **D-01:** Fix lives in the frontend only — update how `frontend/app/reports/[id]/page.tsx` (and any related public photo component) constructs the `<img src>` attribute.
- **D-02:** URL pattern: `${NEXT_PUBLIC_API_URL}/uploads/${image_path_or_filename}`. Use the `API_BASE_URL` from `frontend/app/lib/config.ts` — never inline `process.env.*` directly in the component.
- **D-03:** Before writing the fix, read `nginx/nginx.conf` to verify the `/uploads/` location block has no auth guard that would silently block unauthenticated requests. If nginx is auth-gating `/uploads/`, that must be removed as part of this fix.
- **D-04:** Known tech debt (STATE.md WARNING-02/03): `AdminReport.image_url` vs `image_path` field mismatch — do NOT resolve this mismatch in Phase 5. Keep the public fix minimal: construct the correct URL from whatever field the public reports API returns. Do not refactor the admin API response shape.

### FIX-02 + FIX-03 — Deprecated route navigation (High)
- **D-05:** Change the `href` on the "Report another" CTA (SuccessCard or wherever it renders) from `/reports` to `/`.
- **D-06:** Change the `href` on the "Report here" FAB on the public `/map` page from `/report` to `/`.
- **D-07:** After updating both links, add `301` permanent redirects for both deprecated routes — `/report` → `/` and `/reports` → `/`. Implement via `next.config.mjs` `redirects()`. Do not delete the route pages yet; the redirect will intercept first.

### FIX-04 + FIX-05 — Leaflet blank tiles on iOS Safari (Medium)
- **D-08:** Primary approach: audit `nginx/nginx.conf` CSP headers (`Content-Security-Policy: img-src` and `connect-src`). Confirm `tile.openstreetmap.org` (the OSM tile origin) is explicitly allowed. iOS Safari enforces CSP strictly — this is the most likely root cause.
- **D-09:** Fallback applied regardless: add `map.invalidateSize()` call after the Leaflet container mounts in every map component (belt-and-suspenders for 0-height init timing issue).
- **D-10:** Scope: apply the fix to ALL Leaflet map components — `LocationMap.tsx`, the admin report detail map, and `ReportsMap.tsx`. The CSP change is global anyway and `invalidateSize` is harmless on a correctly-sized map.
- **D-11:** Do NOT switch tile providers (CartoDB, etc.) unless CSP fix + resize still yields blank tiles after verification on an iOS Safari device.

### FIX-06 — Photo rotated 90° in admin (Medium)
- **D-12:** Add orientation baking to the upload ingest pipeline in `backend/src/handlers/reports.rs`, BEFORE the existing EXIF strip step.
- **D-13:** Library approach: use the existing `img-parts` crate to read the EXIF Orientation tag value (tag 0x0112), then add the `image` crate to decode the JPEG bytes, apply the correct rotation/flip transform, and re-encode to JPEG.
- **D-14:** Re-encode quality: 85% JPEG quality (standard civic documentation use — minimal visible loss, acceptable file size).
- **D-15:** Scope: new uploads only. Do not write a migration script to re-process existing stored photos. At this stage there are very few live reports and the risk of bulk re-encode data loss outweighs the benefit.
- **D-16:** If the EXIF orientation tag is absent or has value 1 (normal/no rotation), skip the rotate step and proceed directly to EXIF strip as today. No regression for photos without orientation tags.

### FIX-07 — Duplicate "Open" in public status history (Medium)
- **D-17:** Fix is in the public-facing status history query (the query that backs the public report detail page status timeline). Filter out rows where `status = 'acknowledged'` from the public query result. Keep writing the status_history row on every transition including Acknowledge — the internal audit trail must remain complete.
- **D-18:** The admin portal report detail view must NOT filter Acknowledged entries — admins need the full timeline including acknowledge timestamps for triage accountability.
- **D-19:** Implement the filter at the SQL/query layer (WHERE clause on the public status history query), not in the frontend component. Keeps the filtering logic in one place.

### FIX-08 — "+N today" counter decrements on status changes (Medium)
- **D-20:** Backend query fix in `backend/src/db/admin_queries.rs` (or wherever the stats endpoint query lives). Change the "+N today" SQL to `COUNT(*) WHERE created_at::date = CURRENT_DATE` with no status filter. Status should never influence this counter.
- **D-21:** Do not change the separate SUBMITTED / UNDER REVIEW / RESOLVED stat cards — those are correctly status-filtered and serve a different purpose.

### FIX-09 — Admin dashboard rubber-bands back to top on iOS Safari (Medium)
- **D-22:** Read the admin dashboard page CSS (likely `frontend/app/admin/page.tsx` and `frontend/app/admin/admin.css` or the relevant CSS module). Audit the scrollable container chain.
- **D-23:** Fix: ensure the scrollable wrapper has `overflow-y: auto` (not `hidden`), no fixed height on a parent that would prevent iOS scroll from anchoring, and no `overscroll-behavior: none` that could conflict with iOS momentum scrolling.
- **D-24:** Do not add `-webkit-overflow-scrolling: touch` — deprecated; modern iOS 15+ respects `overflow-y: auto`.

### FIX-10 — GPS coordinates shown at 4dp in citizen form (Medium/Low)
- **D-25:** Frontend display fix: round the GPS coordinate values to 3 decimal places in the citizen Step 1 / Step 2 form components before rendering. Use `toFixed(3)` or equivalent.
- **D-26:** Also grep the backend for the location rounding logic confirmed in Phase 1 (`REQUIREMENTS.md` §Privacy). Verify that the public API response and DB storage both enforce 3dp. If any rounding is missing in the backend, add it. Do not assume — verify with `grep -r "round\|decimal\|toFixed\|3dp"` in backend/src.

### FIX-11 — BUILD_HASH: 0000000 in admin footer (Low)
- **D-27:** Fix: inject `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD)` as an env var during the frontend build step in the GitHub Actions deploy workflow (`.github/workflows/deploy.yml` or equivalent).
- **D-28:** Do not rely on Vercel project-level static settings — those would give a static hash that doesn't update per deployment.
- **D-29:** The admin footer already reads this variable at build time (Phase 02.6 added the version stamping infrastructure). This is purely a CI injection gap, not a code bug.

### FIX-12 — Ward label inconsistency (Low)
- **D-30:** Canonical label: **"Auto-detected"** (not "Auto-routed"). Standardize across all citizen-facing screens.
- **D-31:** Scope: grep all frontend components for the strings `Auto-routed`, `auto-routed`, `Auto routed` (case variations) and replace every occurrence with `Auto-detected`. Includes at minimum: SuccessCard.tsx (confirmation screen), Step 2 form component, and any other component that renders a ward attribution label.

### FIX-13 — LOCATION_SRC label misleading (Low)
- **D-32:** This is a full-stack fix: backend code + DB migration for existing rows + frontend display.
- **D-33:** Canonical location source values:
  - `GPS_API` — location captured via browser Geolocation API (most common on iOS where camera photos don't embed GPS EXIF)
  - `MANUAL_ADJUST` — user explicitly dragged/adjusted the map pin
  - `EXIF_GPS` — location extracted from photo EXIF GPS tags (future path; scaffold the value now)
  - `MANUAL_PIN` — deprecated, must be removed
- **D-34:** Backend change: update the code in `backend/src/handlers/reports.rs` (or wherever location_source is set) to emit the new canonical values when creating reports.
- **D-35:** DB migration: write a new SQLx migration (015_rename_location_source.sql) that `UPDATE reports SET location_source = 'GPS_API' WHERE location_source = 'MANUAL_PIN'`. Make the migration idempotent.
- **D-36:** Frontend display: update the admin report detail view label mapping to show the new canonical values correctly. The mapping should be in `frontend/app/lib/translations.ts` or `constants.ts` — not hardcoded in the component.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UAT Findings (source of truth for all bugs)
- `UAT-Milestone-01-Live.md` — Full live UAT report with all 12 findings, steps to reproduce, screenshots referenced, and severity classifications. READ THIS FIRST before planning any FIX-*.

### Requirements
- `.planning/REQUIREMENTS.md` §FIX — All 13 FIX requirements with acceptance criteria
- `.planning/PROJECT.md` §Active — Active v1.1 requirements list

### Backend source files (most likely to be modified)
- `backend/src/handlers/reports.rs` — Photo upload handler: EXIF strip, anti-abuse, ward lookup; FIX-06 and FIX-13 changes land here
- `backend/src/db/admin_queries.rs` — Admin SQL queries including stats; FIX-08 changes land here
- `backend/src/db/queries.rs` — Public report queries including status history; FIX-07 public status history filter lands here

### Frontend source files (most likely to be modified)
- `frontend/app/reports/[id]/page.tsx` — Public report detail page; FIX-01 photo URL fix lands here
- `frontend/app/lib/config.ts` — ALL env-var config lives here; use `API_BASE_URL` from here for FIX-01 URL construction
- `frontend/app/lib/translations.ts` — Label helpers; FIX-13 location source display mapping lands here
- `frontend/app/lib/constants.ts` — Category/severity lists and shared constants; check for ward label strings (FIX-12)
- `frontend/app/components/redesign/SuccessCard.tsx` — Confirmation screen; FIX-02 ("Report another" href) and FIX-12 (ward label) land here
- `next.config.mjs` — FIX-02/03 301 redirects for `/report` and `/reports` land here

### Infrastructure
- `nginx/nginx.conf` — CSP headers and location blocks; FIX-01 (verify /uploads/ auth) and FIX-04/05 (CSP tile origin) audit starts here
- `.github/workflows/deploy.yml` (or equivalent CI file) — FIX-11 BUILD_HASH injection lands here

### Design system (for CSS fixes)
- `frontend/app/admin/admin.css` — Admin CSS variable layer (Phase 02.5); FIX-09 scroll fix audit starts here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/app/lib/config.ts`: `API_BASE_URL` — already exported; use this for FIX-01 image URL construction (never inline `process.env.*` in components)
- `img-parts` crate (already in `Cargo.toml`): EXIF reading/stripping — extend for orientation tag extraction in FIX-06
- `image` crate: likely NOT yet in `Cargo.toml` — check before adding; may already be a transitive dependency
- `frontend/app/lib/translations.ts`: existing label helper pattern — FIX-13 location source labels should follow the same bilingual/mapping pattern

### Established Patterns
- **EXIF strip pipeline** (`backend/src/handlers/reports.rs`): currently strips EXIF via `img-parts` after upload. FIX-06 adds a rotate step BEFORE this strip. Keep the pipeline sequential: validate → read orientation → rotate pixels → strip EXIF → write to disk.
- **Status history writes** (`backend`): every status transition writes to `status_history`. FIX-07 does NOT change this write behavior — it adds a filter only to the public read query.
- **Config rule** (CLAUDE.md): all env-var config in `frontend/app/lib/config.ts`. No `process.env.*` directly in components. FIX-01 must follow this.
- **Dynamic map import** (CLAUDE.md): all Leaflet map components use `dynamic(() => import(...), { ssr: false })`. The `invalidateSize` hook in FIX-04/05 must be inside the dynamically-imported component, not the server-side wrapper.
- **SQLx migrations** (CLAUDE.md): DB schema changes applied on startup via `sqlx::migrate!`. FIX-13 DB migration follows this pattern — new file `backend/migrations/015_rename_location_source.sql`.

### Integration Points
- FIX-06 (EXIF orientation) intersects with the EXIF strip already in `reports.rs` — both read and write the same in-memory photo bytes. The orientation step must come first and produce clean JPEG bytes before strip.
- FIX-07 (status history) intersects with the public reports detail API endpoint — need to find where status history is fetched for the public detail page (frontend fetches from `/api/reports/:id` or a separate history endpoint).
- FIX-11 (BUILD_HASH) intersects with the existing `NEXT_PUBLIC_APP_VERSION` injection (Phase 02.6) — follow the same CI pattern already established in `next.config.mjs`.

</code_context>

<specifics>
## Specific Ideas

- **FIX-06 orientation baking**: UAT finding explicitly recommends `image-rs` (Rust). The fix note says "Do not use CSS workaround — fix at ingest." This is a hard constraint — no `image-orientation: from-image` CSS or client-side canvas rotation. Pixels must be correct before storage.
- **FIX-07 duplicate Open entries**: The public STATUS HISTORY UI currently shows all status_history rows. The Acknowledged state is an admin-internal state (its name implies "we've seen this"). The public user should see only transitions that mean something to them: Open → In Progress → Resolved → Closed. Filtering `acknowledged` from the public query aligns with this mental model.
- **FIX-13 location source**: The user explicitly confirmed this must be accurate in both frontend and backend. "GPS_API", "MANUAL_ADJUST", and "EXIF_GPS" are the canonical values going forward. The stored value in the DB must match the canonical values — hence the migration.

</specifics>

<deferred>
## Deferred Ideas

- **Dedup job `closed` status exclusion** (WARNING-01 from STATE.md): Out of scope per REQUIREMENTS.md v1.1. Defer to v1.2.
- **AdminReport.image_url vs image_path type mismatch** (WARNING-02/03 from STATE.md): Phase 5 fixes the public photo URL without resolving this tech debt. The admin API field naming inconsistency stays deferred.
- **Existing rotated photos**: FIX-06 fixes new uploads only. A bulk re-encode migration for historical photos is deferred — too few live reports to justify the risk at this stage.

</deferred>

---

*Phase: 5-UAT-Stabilisation*
*Context gathered: 2026-06-05T07:17:13Z*
