---
slug: uat-map-gps-ward-bugs
status: resolved
trigger: "Three bugs from iPhone 16 Pro Max UAT on staging-walkability.kinariwala.com (2026-04-25 12:06–12:08)"
created: 2026-04-25
updated: 2026-04-25
---

## Symptoms

- **Expected:** (1) Map opens quickly after tapping "Open Map"; (2) GPS auto-detects from photo EXIF or falls back to browser geolocation and resolves; (3) Confirm step shows GBA Ward Number and Name beneath coordinates.
- **Actual:** (1) Map shows blank "Loading reports…" for ~60 seconds before Leaflet renders; (2) GPS pill shows "Locating…" indefinitely when photo has no EXIF GPS, never resolves — coordinates fall back to hardcoded BENGALURU_CENTER (12.9716, 77.5946); (3) No ward name/number shown on Step 2 confirm screen.
- **Errors:** None thrown — all silent UX failures.
- **Timeline:** Introduced with ui-redesign branch; previous UI did not have the slow map load regression.
- **Reproduction:** (1) tap Open Map on home; (2) tap Report an issue, upload gallery photo without GPS EXIF, proceed to category step; (3) proceed to confirm step and check location section.

## Current Focus

hypothesis: "Root causes are understood from code review: BUG-1 = MapContainer gates on API fetch completing; BUG-2 = no geolocation fallback after EXIF miss; BUG-3 = no ward lookup in public submission flow"
test: "Read ReportsMap.tsx, report/page.tsx, and backend routes"
expecting: "Confirm hypotheses and apply targeted fixes"
next_action: "All three bugs fixed and committed"

## Bug Detail

### BUG-1 (PERF): Map loading regression
- File: `frontend/app/components/ReportsMap.tsx`
- Root cause: `fetchReports()` sets `loading=true` and renders a plain div instead of `MapContainer` while the API call is in-flight. Map tiles and Leaflet JS do not preload. Fix: render MapContainer immediately with a loading overlay; add markers progressively after fetch completes. Move Leaflet icon patch to a one-time useEffect, not inside the fetch callback.

### BUG-2 (UX): GPS "Locating…" stuck
- File: `frontend/app/report/page.tsx` (step "category" and mount useEffect)
- Root cause: After EXIF extraction fails (gps=null), `form.gpsConfirmed` stays false. The "Locating…" pill is shown when `!form.gpsConfirmed` but nothing ever resolves it — no `navigator.geolocation.getCurrentPosition()` fallback is triggered. Fix: after EXIF miss, call browser geolocation with a timeout; on success set `gpsConfirmed=true` and update lat/lng; on failure change pill text to "Pin required" so user knows to adjust manually.

### BUG-3 (MISSING): Ward name absent from confirm step
- File: `frontend/app/report/page.tsx` (step "confirm"), backend needs new public endpoint
- Root cause: The public API (`/api/reports`) intentionally omits `ward_name` (admin-only). No client-side ward lookup exists. The backend has `get_ward_for_point()` and `wards` table. Fix: add `GET /api/wards/lookup?lat=&lng=` public endpoint to backend; call it from the confirm step when coords are known; display "Ward {number} · {name}" beneath coordinates.

## Evidence

- timestamp: 2026-04-25T12:06
  observation: "signal-2026-04-25-120945.png shows 'Loading reports…' blank screen at 12:06 — map not visible"
  supports: BUG-1

- timestamp: 2026-04-25T12:07
  observation: "IMG_4304 shows map finally loaded at 12:07 — ~60s delay from click"
  supports: BUG-1

- timestamp: 2026-04-25T12:07
  observation: "IMG_4305/4306 show '● Locating…' pill on category step after gallery photo upload (coffee mug, no GPS EXIF)"
  supports: BUG-2

- timestamp: 2026-04-25T12:08
  observation: "IMG_4307 shows Step 2 with coordinates 12.9716° N, 77.5946° E (= BENGALURU_CENTER default) — no ward shown"
  supports: BUG-2, BUG-3

- timestamp: code-review
  observation: "ReportsMap.tsx L82-88: loading state renders plain div, MapContainer not in DOM while loading"
  supports: BUG-1

- timestamp: code-review
  observation: "report/page.tsx L529-548: 'Locating…' pill conditioned on !form.gpsConfirmed; no geolocation fallback in codebase"
  supports: BUG-2

- timestamp: code-review
  observation: "report/page.tsx L700-790: location section shows only coordinates and Adjust button — no ward lookup or display"
  supports: BUG-3

- timestamp: code-review
  observation: "backend/src/handlers/reports.rs L90: 'Public endpoint never exposes ward_name — admin handler populates it when needed'"
  supports: BUG-3

## Eliminated

(none)

## Resolution

root_cause: "BUG-1: MapContainer gated behind loading state preventing tile preload. BUG-2: No navigator.geolocation fallback after EXIF GPS miss. BUG-3: No public ward lookup endpoint or frontend display."
fix: "BUG-1: MapContainer always rendered; overlays handle loading/error states; Leaflet icon patch moved to one-time useEffect. BUG-2: tryBrowserGeolocation() called concurrently after EXIF miss in both handleFile and consumePendingPhoto paths; pill shows 'Adjust pin' on failure. BUG-3: New GET /api/wards/lookup?lat=&lng= Axum handler backed by get_ward_label_for_point query; frontend fetches on confirm step entry and pin adjustment, displays 'Ward N · Name', degrades silently on 404/error."
verification: "cargo check clean; 221+7 backend unit tests pass; all three changes committed to ui-redesign branch."
files_changed:
  - frontend/app/components/ReportsMap.tsx
  - frontend/app/report/page.tsx
  - backend/src/db/queries.rs
  - backend/src/handlers/wards.rs
  - backend/src/handlers/mod.rs
  - backend/src/main.rs
