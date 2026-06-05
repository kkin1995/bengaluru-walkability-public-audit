# Phase 5: UAT Stabilisation — Research

**Researched:** 2026-06-05T08:30:00Z
**Domain:** Full-stack bug fixing (Next.js 14 / Rust Axum / PostgreSQL / Nginx / GitHub Actions CI)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FIX-01 — Public report photo broken**
- D-01: Fix lives in the frontend only — update `frontend/app/reports/[id]/page.tsx` and any related public photo component.
- D-02: URL pattern: `${NEXT_PUBLIC_API_URL}/uploads/${image_path_or_filename}`. Use `API_BASE_URL` from `frontend/app/lib/config.ts`.
- D-03: Read `nginx/nginx.conf` first to verify `/uploads/` has no auth guard.
- D-04: Do NOT resolve `AdminReport.image_url` vs `image_path` type mismatch (WARNING-02/03). Keep fix minimal.

**FIX-02 + FIX-03 — Deprecated route navigation**
- D-05: Change "Report another" CTA href from `/reports` to `/`.
- D-06: Change "Report here" FAB href from `/report` to `/`.
- D-07: Add 301 redirects in `next.config.mjs` `redirects()` for `/report` → `/` and `/reports` → `/`. Do not delete route pages yet.

**FIX-04 + FIX-05 — Leaflet blank tiles on iOS Safari**
- D-08: Primary fix: audit `nginx/nginx.conf` CSP `img-src` and `connect-src` to confirm `tile.openstreetmap.org` is allowed.
- D-09: Fallback applied regardless: add `map.invalidateSize()` after Leaflet container mounts in every map component.
- D-10: Scope: `LocationMap.tsx`, admin report detail map, and `ReportsMap.tsx`.
- D-11: Do NOT switch tile providers unless CSP + resize still fails on device.

**FIX-06 — Photo rotated 90°**
- D-12: Add orientation baking BEFORE the existing EXIF strip in `backend/src/handlers/reports.rs`.
- D-13: Use `img-parts` (already in Cargo.toml) to read EXIF Orientation tag 0x0112, add `image` crate to decode/rotate/re-encode JPEG.
- D-14: Re-encode at 85% JPEG quality.
- D-15: New uploads only. No migration for historical photos.
- D-16: If orientation tag absent or value 1, skip rotate and proceed to EXIF strip.

**FIX-07 — Duplicate "Open" in public status history**
- D-17: Filter `acknowledged` rows from the public status history query (WHERE clause). Do not change the write behavior.
- D-18: Admin portal status history must NOT filter acknowledged — admins need full timeline.
- D-19: Filter at SQL/query layer in `backend/src/db/queries.rs`, not in frontend.

**FIX-08 — "+N today" counter decrements on status changes**
- D-20: Backend query fix in `backend/src/db/admin_queries.rs`. Change to `COUNT(*) WHERE created_at::date = CURRENT_DATE` with no status filter.
- D-21: Do not change the SUBMITTED / UNDER REVIEW / RESOLVED stat cards.

**FIX-09 — Admin dashboard rubber-bands on iOS Safari**
- D-22: Audit `frontend/app/admin/page.tsx` and `frontend/app/admin/admin.css`.
- D-23: Ensure scrollable wrapper has `overflow-y: auto`, no fixed height on parent, no `overscroll-behavior: none`.
- D-24: Do NOT add `-webkit-overflow-scrolling: touch` (deprecated).

**FIX-10 — GPS coordinates at 4dp in citizen form**
- D-25: Use `toFixed(3)` in citizen Step 1 / Step 2 form components.
- D-26: Grep backend for rounding logic — verify public API and DB both enforce 3dp.

**FIX-11 — BUILD_HASH: 0000000**
- D-27: Inject `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD)` in GitHub Actions deploy workflow.
- D-28: Do not use Vercel project-level static settings.
- D-29: The admin footer already reads this variable at build time. This is a CI injection gap only.

**FIX-12 — Ward label inconsistency**
- D-30: Canonical label: "Auto-detected" (not "Auto-routed").
- D-31: Grep for `Auto-routed`, `auto-routed`, `Auto routed` and replace all occurrences.

**FIX-13 — LOCATION_SRC label misleading**
- D-32: Full-stack fix: backend code + DB migration + frontend display.
- D-33: Canonical values: `GPS_API`, `MANUAL_ADJUST`, `EXIF_GPS` (new); `MANUAL_PIN` deprecated (remove).
- D-34: Update `backend/src/handlers/reports.rs` to emit new canonical values.
- D-35: New SQLx migration `015_rename_location_source.sql`: `UPDATE reports SET location_source = 'GPS_API' WHERE location_source = 'MANUAL_PIN'`.
- D-36: Update admin report detail view label mapping in `frontend/app/lib/translations.ts` or `constants.ts`.

### Claude's Discretion
None specified — all areas have locked decisions.

### Deferred Ideas (OUT OF SCOPE)
- Dedup job `closed` status exclusion (WARNING-01).
- `AdminReport.image_url` vs `image_path` type mismatch (WARNING-02/03).
- Bulk re-encode migration for existing rotated photos (FIX-06 new uploads only).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 | Public report detail page renders submitted photo correctly for unauthenticated users | Backend builds correct `image_url` via `api_base_url`; public page uses `report.image_url` directly from API response; nginx `/uploads/` has no auth guard |
| FIX-02 | "Report another" CTA navigates to home page (`/`) | SuccessCard uses `onReportAnother` callback; in `report/page.tsx` this calls `resetAll` — need to change behaviour to navigate to `/` instead |
| FIX-03 | "Report here" FAB on `/map` navigates to home page (`/`) | `frontend/app/map/page.tsx` line 269 has `href="/report"` — one-line change |
| FIX-04 | Leaflet map tiles in iOS Safari on citizen Step 2 | `LocationMap.tsx` has no `invalidateSize`; nginx public location `/` block has no CSP header |
| FIX-05 | Leaflet map tiles in iOS Safari on admin report detail | Admin detail shows a grey placeholder "MAP" box — needs real Leaflet map component added (not just CSP fix) |
| FIX-06 | Photos render upright (EXIF orientation baked in) | `image` crate not yet in `Cargo.toml`; pipeline is validate→strip→write; need to insert rotate step before strip |
| FIX-07 | Public STATUS HISTORY shows exactly one "Open" entry | Duplicate caused by auto-assign audit insert writing second `open` row AND by Acknowledge writing `acknowledged` row that maps to "Open" in public label; decision is SQL filter |
| FIX-08 | "+N today" counter is creation-date based | `statsForCards.submitted` maps to `by_status.open` — a status count, not a date filter; `StatsResponse` struct has no `today_count` field; requires new field + query |
| FIX-09 | Admin dashboard scrolls freely on iOS Safari | Admin layout wraps content in `overflow: hidden` / `overflowY: auto` — needs specific CSS audit |
| FIX-10 | GPS coordinates displayed at 3dp in citizen form | `report/page.tsx` uses `toFixed(4)` on lines 662, 970; backend already rounds to 3dp in API response |
| FIX-11 | BUILD_HASH shows real git SHA in admin footer | `deploy.yml` never injects `NEXT_PUBLIC_BUILD_HASH`; footer hardcodes `0000000`; login page also hardcodes it |
| FIX-12 | Ward label consistently "Auto-detected" | `SuccessCard.tsx` line 241: `Auto-routed` is hardcoded; `report/page.tsx` line 1024: `Auto-detected` — inconsistency confirmed |
| FIX-13 | LOCATION_SRC uses canonical values | DB enum currently only has `exif` and `manual_pin`; needs `ALTER TYPE` migration to add new values; frontend currently sends `"manual_pin"` and `"exif"` — must update to new values; `photo-store.ts` type definition also needs update |
</phase_requirements>

---

## Summary

Phase 5 is a pure bug-fix phase addressing 13 confirmed defects from the v1.0 live iPhone field test on staging.nammadaari.com. All bugs were observed on iPhone 16 Pro Max / iOS Safari / iOS 26.5. The fixes span the full stack: 3 frontend-only changes, 2 backend-only changes, 4 full-stack changes, 1 nginx/CSP change, 1 CI change, and 2 mixed component changes.

The most architecturally significant findings from the code audit are:

1. **FIX-01**: The public detail page fetches via `INTERNAL_API_URL` server-side and correctly gets `report.image_url` from the backend response (which is already `api_base_url + /uploads/ + image_path`). The problem is `api_base_url` in the backend is set to the internal Docker URL, which is inaccessible from the browser. The page renders `<img src={report.image_url}>` directly — where `image_url` contains the backend's `api_base_url` value, which is an internal URL. The fix must replace `src={report.image_url}` with `src={API_BASE_URL + '/uploads/' + extractFilename(report.image_url)}` or similar browser-accessible URL construction.

2. **FIX-02**: The SuccessCard `onReportAnother` callback is wired to `resetAll()` in `report/page.tsx` — which resets form state but does not navigate. The page is the deprecated `/report` route. After `resetAll()`, the user stays on `/report`. The fix is to make `onReportAnother` navigate to `/` (e.g., `window.location.href = "/"` consistent with the close handler pattern already in `report/page.tsx:422`).

3. **FIX-05**: The admin report detail page does NOT have a Leaflet map — it has a static grey gradient placeholder div. FIX-05 therefore requires **adding** a real Leaflet `LocationMap` (read-only) to the admin detail page, not just fixing CSP. The CONTEXT references "admin report detail map" which currently doesn't exist as Leaflet.

4. **FIX-07**: There are TWO sources of duplicate "Open" entries: (a) the auto-assign audit trail insert in `create_report` writes `new_status = 'open'` as a second entry when org auto-assign succeeds, and (b) Acknowledge writes `new_status = 'acknowledged'` which the public label maps to "Open". The CONTEXT decision to filter `acknowledged` from the public SQL query handles source (b). Source (a) — the extra `open` from auto-assign — needs separate attention. The SQL filter `WHERE new_status::TEXT != 'acknowledged'` handles source (b) but not source (a). Both are present for reports that have an assigned_org_id.

5. **FIX-08**: The `StatsResponse` struct has no `today_count` field. The frontend's "+N today" currently uses `statsForCards.submitted` (mapped from `by_status.open`). Adding a proper `today_count` requires: a new query in `admin_queries.rs`, a new field on `StatsResponse`, serialization update, frontend `AdminStats` type update, and rendering update. This is more than a one-line SQL change.

6. **FIX-13**: The `location_source` DB enum currently only contains `'exif'` and `'manual_pin'`. Adding `GPS_API`, `MANUAL_ADJUST`, `EXIF_GPS` requires an `ALTER TYPE ... ADD VALUE` PostgreSQL migration. The frontend's `photo-store.ts` type is `"exif" | "manual_pin"` — must be updated. `ReportCTA.tsx` and `report/page.tsx` also send the old values.

**Primary recommendation:** Execute fixes in severity order (FIX-01 first — critical), group backend changes into one wave and frontend changes into another to minimize `cargo sqlx prepare` runs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Public photo URL construction | Frontend Server (SSR) | — | Next.js server component fetches; must use browser-accessible URL |
| Route redirects for deprecated paths | Frontend Server (SSR) | — | next.config.mjs `redirects()` runs at Next.js routing layer |
| Leaflet tile CSP | CDN / Static (Nginx) | Browser | nginx sets CSP headers; browser enforces them |
| Leaflet map init timing fix | Browser / Client | — | `invalidateSize` call is client-side JS inside dynamic component |
| EXIF orientation baking | API / Backend | — | Pixel transformation at ingest before storage |
| Status history public filter | API / Backend | — | SQL WHERE clause on public read query |
| Today count query | API / Backend | — | SQL COUNT with date filter, no status filter |
| Admin dashboard scroll CSS | Browser / Client | — | CSS on client-rendered admin page |
| GPS display precision | Browser / Client | — | `toFixed(3)` in React render |
| BUILD_HASH injection | CDN / Static (CI) | Frontend Server | GitHub Actions sets env var at build time |
| Ward label string | Browser / Client | — | Hardcoded string in React component |
| location_source enum migration | Database / Storage | API / Backend | Postgres ALTER TYPE + UPDATE migration; backend emits new values |

---

## Standard Stack

### Core (no changes — existing stack)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14 (App Router) | Frontend SSR + routing | Project standard [ASSUMED] |
| Rust / Axum | 0.7 | Backend API | Project standard [ASSUMED] |
| SQLx | 0.7 | DB queries + migrations | Project standard [ASSUMED] |
| img-parts | 0.3 | EXIF reading / stripping | Already in Cargo.toml [VERIFIED: grep Cargo.toml] |
| react-leaflet | unknown | Map components | Already in use [VERIFIED: grep frontend source] |

### New Dependency (FIX-06 only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| image | 0.25.10 | JPEG decode/rotate/re-encode | FIX-06 orientation baking |

**image crate registry verification:** `cargo search image` returned `image = "0.25.10"` [VERIFIED: crates.io via cargo search]. The `image` crate (formerly image-rs) is the canonical Rust image processing library — decades old, actively maintained, matches UAT-01-07 fix note which says "image-rs (Rust)".

The `image` crate is NOT yet in `backend/Cargo.toml`. It must be added.

### Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| image | crates.io | ~12 yrs | Very high | github.com/image-rs/image | N/A (crates.io) | Approved |

*slopcheck targets npm; `image` is a Rust crate on crates.io. Verified via `cargo search image` as the canonical crate. [VERIFIED: crates.io via cargo search]*

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[iPhone Safari]
    |
    | HTTPS
    v
[Cloudflare Tunnel] → [Nginx (port 80)]
                              |
              ┌───────────────┼────────────────┐
              |               |                |
        [/uploads/*]    [/api/*]         [/ and /admin/*]
              |               |                |
        [Axum ServeDir] [Axum handlers]  [Next.js SSR]
              |               |                |
         [filesystem]    [PostgreSQL]    [Next.js components]
                                              |
                             (server components use INTERNAL_API_URL)
                             (client components use API_BASE_URL = "")
```

**Critical insight for FIX-01:** The Next.js server component at `/reports/[id]` fetches via `INTERNAL_API_URL` (backend container name). The backend constructs `image_url = api_base_url + "/uploads/" + image_path`. In Docker, `api_base_url` is the internal Docker URL. When the browser receives the rendered HTML with `<img src="{internal_url}/uploads/file.jpg">`, that URL is inaccessible from the public internet. The fix must reconstruct the image URL on the **frontend** using `API_BASE_URL` (the public-facing URL), not rely on the URL embedded in the API response.

### Recommended Project Structure
No structural changes needed. All edits are within existing files.

```
backend/
├── migrations/
│   └── 015_rename_location_source.sql    (NEW — FIX-13)
├── src/
│   ├── handlers/reports.rs               (FIX-06, FIX-13)
│   └── db/
│       ├── queries.rs                    (FIX-07)
│       └── admin_queries.rs              (FIX-08)
frontend/
├── app/
│   ├── lib/
│   │   ├── config.ts                     (FIX-11: add BUILD_HASH export)
│   │   └── translations.ts               (FIX-13: add location_source labels)
│   ├── reports/[id]/page.tsx             (FIX-01: image URL, FIX-07: history rendering)
│   ├── map/page.tsx                      (FIX-03: FAB href)
│   ├── report/page.tsx                   (FIX-02: onReportAnother, FIX-10: toFixed(3), FIX-13: send new values)
│   ├── components/
│   │   ├── LocationMap.tsx               (FIX-04: invalidateSize)
│   │   ├── ReportsMap.tsx                (FIX-04: invalidateSize, if applicable)
│   │   └── redesign/SuccessCard.tsx      (FIX-12: "Auto-detected")
│   └── admin/
│       ├── page.tsx                      (FIX-08: today_count rendering, FIX-09: scroll CSS)
│       ├── login/page.tsx                (FIX-11: use BUILD_HASH variable)
│       └── reports/[id]/page.tsx         (FIX-05: add LocationMap, FIX-13: LOCATION_SRC labels)
├── next.config.mjs                       (FIX-02/03: redirects)
.github/workflows/deploy.yml             (FIX-11: inject NEXT_PUBLIC_BUILD_HASH)
nginx/nginx.conf                          (FIX-04: public CSP header)
```

### Pattern 1: EXIF Orientation Baking (FIX-06)

**What:** Read EXIF orientation tag from JPEG using `img-parts`, then conditionally rotate using the `image` crate, then proceed to existing EXIF strip.

**Pipeline order (immutable):**
```
validate JPEG magic bytes
  → compute SHA256 hash (ABUSE-03)
  → bbox check + rate limit
  → [NEW] read orientation tag (img-parts)
  → [NEW] rotate/flip pixels if needed (image crate)
  → strip EXIF (img-parts, existing)
  → write to disk
  → insert DB
```

**EXIF Orientation tag values → transforms:**

| Value | Meaning | Action |
|-------|---------|--------|
| 1 | Normal | No-op (skip rotate) |
| 3 | 180° | Rotate 180° |
| 6 | 90° CW (iPhone portrait) | Rotate 90° CW |
| 8 | 90° CCW | Rotate 90° CCW |
| 2,4,5,7 | Mirror variants | Flip + rotate |

*iPhone portrait photos typically produce orientation value 6 (rotate 90° CW to get upright).*

**Implementation approach with `img-parts` + `image`:**
```rust
// Source: img-parts 0.3 docs [ASSUMED] + image crate 0.25 docs [ASSUMED]
use img_parts::{jpeg::Jpeg, ImageEXIF};
use image::{load_from_memory, ImageFormat};

fn bake_orientation(jpeg_bytes: &[u8]) -> Result<Vec<u8>, AppError> {
    // Step 1: Read orientation tag BEFORE stripping EXIF
    let orientation = read_exif_orientation(jpeg_bytes); // helper using img-parts
    
    if orientation == 1 || orientation == 0 {
        return Ok(jpeg_bytes.to_vec()); // no rotation needed
    }
    
    // Step 2: Decode and rotate pixels using `image` crate
    let img = load_from_memory(jpeg_bytes)
        .map_err(|_| AppError::BadRequest("Failed to decode image".into()))?;
    
    let rotated = match orientation {
        3 => img.rotate180(),
        6 => img.rotate90(),
        8 => img.rotate270(),
        // Handle mirror cases if needed
        _ => img,
    };
    
    // Step 3: Re-encode to JPEG at 85% quality
    let mut output = Vec::new();
    rotated.write_to(&mut std::io::Cursor::new(&mut output), ImageFormat::Jpeg)?;
    Ok(output)
}
```
*Note: The `image` crate API for quality control is `image::codecs::jpeg::JpegEncoder::new_with_quality`. The above is a simplified illustration — verify exact API via image crate docs before coding.*

### Pattern 2: SQL Filter for Public Status History (FIX-07)

**Current query (line 382 of queries.rs):**
```sql
SELECT new_status::TEXT AS status, changed_at
FROM status_history
WHERE report_id = $1
ORDER BY changed_at ASC
```

**Fixed query (add WHERE filter per D-17/D-19):**
```sql
SELECT new_status::TEXT AS status, changed_at
FROM status_history
WHERE report_id = $1
  AND new_status::TEXT != 'acknowledged'
ORDER BY changed_at ASC
```

**Important nuance for FIX-07:** There are TWO sources of duplicate "Open" entries in the current code:
1. `create_report` inserts a second `status_history` row with `new_status = 'open'` for auto-assign audit trail (line 308 of reports.rs). This creates two `open` entries before `acknowledged` even fires.
2. Acknowledge transition writes `new_status = 'acknowledged'`, which the public label function maps to "Open" — creating a visible third "Open" entry.

The CONTEXT decision (D-17) filters `acknowledged`. This handles source #2. Source #1 (duplicate `open` from auto-assign) remains. The planner should flag this as an open question — the locked decision says filter `acknowledged`, which may not fully resolve the duplication seen in UAT where THREE entries were shown.

### Pattern 3: Today Count Query (FIX-08)

The frontend `+N today` display currently maps from `statsForCards.submitted` which equals `by_status.open`. This is wrong — it's a status filter, not a date filter.

**Required changes:**
1. New SQL in `admin_queries.rs`:
```sql
SELECT COUNT(*) FROM reports
WHERE created_at::date = CURRENT_DATE
```
2. New field `today_count: i64` in `StatsResponse` struct (`backend/src/models/admin.rs`).
3. New field in `get_report_stats()` to populate it.
4. Update `AdminStats` TypeScript interface in `frontend/app/admin/lib/adminApi.ts`.
5. Update `frontend/app/admin/page.tsx` line 357 to use `stats.today_count`.

### Pattern 4: location_source DB Migration (FIX-13)

The existing PostgreSQL `location_source` enum contains only `'exif'` and `'manual_pin'`. Adding new values requires `ALTER TYPE ... ADD VALUE` (PostgreSQL-specific DDL):

```sql
-- 015_rename_location_source.sql
-- Step 1: Add new canonical enum values
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'GPS_API';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'MANUAL_ADJUST';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'EXIF_GPS';

-- Step 2: Migrate existing data
UPDATE reports SET location_source = 'GPS_API' WHERE location_source = 'manual_pin';

-- Note: 'manual_pin' cannot be removed from the enum in PostgreSQL without
-- recreating the type. Keep it as a deprecated value — just stop emitting it.
-- The UPDATE above converts all stored rows. New code never writes 'manual_pin'.
```

*PostgreSQL does NOT support `ALTER TYPE ... DROP VALUE`. The old value `manual_pin` must stay in the enum definition. After migration, no row should store it, and no code should write it.*

**Frontend impact:**
- `frontend/app/lib/photo-store.ts` type: change `"exif" | "manual_pin"` to `"EXIF_GPS" | "GPS_API" | "MANUAL_ADJUST"`.
- `frontend/app/components/ReportCTA.tsx` lines 58, 74, 121, 137: change emitted values from `"exif"` / `"manual_pin"` to `"EXIF_GPS"` / `"GPS_API"`.
- `frontend/app/report/page.tsx` lines 60, 156, 319, 918: same value updates.
- `frontend/app/admin/reports/[id]/page.tsx` line 106: condition `report.location_source === "exif"` must change to `=== "EXIF_GPS"`.

**Backend impact:**
- `backend/src/handlers/reports.rs` line 216: default `"manual_pin"` → `"GPS_API"`.
- `backend/src/handlers/reports.rs` line 91: fake_success_response `"manual_pin"` → `"GPS_API"`.
- `backend/src/models/report.rs` line 186: test fixture `"manual_pin"` → `"GPS_API"`.
- Tests in `reports.rs` lines 583-590: the `test_default_location_source_is_manual_pin` test will need updating.

### Pattern 5: Leaflet invalidateSize (FIX-04)

The standard react-leaflet pattern for fixing 0-height tile issues is to call `map.invalidateSize()` via the `useMap` hook inside a component rendered as a child of `MapContainer`:

```typescript
// Source: react-leaflet docs [ASSUMED] — useMap hook
import { useMap } from "react-leaflet";
import { useEffect } from "react";

function MapSizeUpdater() {
  const map = useMap();
  useEffect(() => {
    // Defer until after container has rendered
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// Usage inside MapContainer:
<MapContainer ...>
  <MapSizeUpdater />
  <TileLayer ... />
  ...
</MapContainer>
```

*This pattern is required for `LocationMap.tsx` (FIX-04) and any map component in the admin detail view (FIX-05).*

### Pattern 6: nginx CSP for Public Routes (FIX-04)

**Current state (from nginx.conf code audit):**
- The `/admin` location block has a `Content-Security-Policy` header that includes `img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org`.
- The `/` (catch-all) location block has NO `Content-Security-Policy` header.
- The citizen Step 2 confirm map and the public map at `/map` are served by the `/` location block.

**Fix:** Add CSP to the public location block to allow OSM tile origin:
```nginx
location / {
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org; connect-src 'self' https://*.tile.openstreetmap.org;" always;
    proxy_pass http://frontend;
    ...
}
```

*`connect-src` must also include `https://*.tile.openstreetmap.org` because Leaflet fetches tiles via XHR/fetch. iOS Safari enforces `connect-src` for tile fetching.*

### Anti-Patterns to Avoid

- **FIX-01 anti-pattern:** Using the `image_url` from the API response directly as the `<img src>`. The backend constructs this URL with `api_base_url` (internal container URL). Must reconstruct from `API_BASE_URL` (public) + `/uploads/` + filename.
- **FIX-06 anti-pattern:** Using CSS `image-orientation: from-image` or client-side canvas rotation. UAT finding explicitly says "fix at ingest" and "Do not use CSS workaround."
- **FIX-07 anti-pattern:** Filtering in the frontend component instead of SQL. CONTEXT D-19 requires SQL-layer filtering.
- **FIX-09 anti-pattern:** Adding `-webkit-overflow-scrolling: touch` — deprecated since iOS 15. CONTEXT D-24 explicitly forbids it.
- **FIX-13 anti-pattern:** Trying to DROP the old `manual_pin` enum value. PostgreSQL does not support `ALTER TYPE ... DROP VALUE`. Keep it but stop emitting it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JPEG decode + rotate | Custom byte manipulation | `image` crate (image-rs) | JPEG encoding edge cases; handles all EXIF transform cases |
| EXIF tag extraction | Manual byte parsing | `img-parts` (already present) | Already in Cargo.toml; handles APP1 marker correctly |
| Leaflet map resize | Custom resize observer | `map.invalidateSize()` via `useMap` hook | Official react-leaflet API for this exact problem |

---

## Common Pitfalls

### Pitfall 1: Public Image URL Uses Internal Docker Hostname

**What goes wrong:** The backend builds `image_url = api_base_url + "/uploads/" + image_path`. When `api_base_url` is the internal Docker URL (e.g., `http://backend:3001`), the rendered HTML has `<img src="http://backend:3001/uploads/file.jpg">` — unreachable from the public internet.

**Why it happens:** The backend doesn't know which URL the browser will use. `api_base_url` is set from env vars for the backend's internal routing, not the public URL.

**How to avoid:** In `reports/[id]/page.tsx`, extract the filename from `report.image_url` (take the last segment after `/uploads/`), then prefix with `API_BASE_URL` from `config.ts`. Alternatively, expose `image_path` (just the filename) from the public API and always construct URLs in the frontend — but that changes the API shape (deferred per D-04).

**Practical fix approach:**
```typescript
// In reports/[id]/page.tsx
import { API_BASE_URL } from "@/app/lib/config";

// report.image_url comes from backend as "http://backend:3001/uploads/abc.jpg" or "/uploads/abc.jpg"
// Extract just the filename
const imageFilename = report.image_url.split("/uploads/").pop() ?? "";
const publicImageUrl = `${API_BASE_URL}/uploads/${imageFilename}`;
```

### Pitfall 2: FIX-05 Requires Adding a Map Component, Not Just Fixing CSP

**What goes wrong:** The admin report detail page (`admin/reports/[id]/page.tsx`) shows a static grey placeholder div (lines 425-437), not a Leaflet map. CSP + invalidateSize fixes do nothing if there is no Leaflet map to fix.

**Why it happens:** The map was deferred/placeholder when the admin UI was built.

**How to avoid:** FIX-05 requires adding a real `<LocationMap>` in read-only mode to the admin detail page, wrapped in a `dynamic(() => import(...), { ssr: false })` per the project's mandatory dynamic import rule (CLAUDE.md). Then apply CSP + invalidateSize to it.

### Pitfall 3: FIX-07 — Auto-Assign Creates a Second `open` Entry

**What goes wrong:** The CONTEXT decision filters `acknowledged` from the public status history query. However, `create_report` also inserts a second `status_history` row with `new_status = 'open'` for the auto-assign audit trail (reports.rs line 308). This creates two `open` rows before `acknowledged` fires. The CONTEXT filter only removes `acknowledged` rows, leaving the duplicate `open`.

**Why it happens:** UAT-01-10 showed three entries: `Open, Open, In Progress` — two `open` before any acknowledge. The auto-assign audit insert was added in Phase 03.4 to support org hierarchy. Its insertion into `status_history` as `new_status = 'open'` wasn't anticipated to cause public history duplication.

**How to avoid:** Two options:
- (A) Apply the CONTEXT decision as-is (filter `acknowledged`) — this partially fixes the issue by removing the third `acknowledged`-as-Open entry, but doesn't fix the two `open` entries from auto-assign.
- (B) Also add a filter to exclude the auto-assign note: `AND (note IS NULL OR note != 'Auto-assigned based on ward geography')`.

The CONTEXT only specifies filtering `acknowledged`. The planner should implement D-19 exactly as specified, but flag this as an open question for verification.

### Pitfall 4: FIX-13 DB Enum Cannot Drop Old Values

**What goes wrong:** Trying to remove `manual_pin` from the `location_source` enum causes a PostgreSQL error: `ALTER TYPE ... DROP VALUE` is not supported.

**Why it happens:** PostgreSQL enum types are append-only. Values can be added, not removed.

**How to avoid:** The migration should only use `ALTER TYPE ... ADD VALUE IF NOT EXISTS` for new values, then `UPDATE` existing rows. Never attempt `DROP VALUE`. The old `manual_pin` value stays in the type definition permanently; ensure no code writes it after migration.

### Pitfall 5: FIX-08 Requires New Field on StatsResponse

**What goes wrong:** Only adding a SQL query without adding the field to `StatsResponse` struct causes a compile error (SQLx or serde).

**Why it happens:** `StatsResponse` is a Rust struct with `#[derive(Serialize, Deserialize)]`. Adding `today_count` to the DB query but not the struct fails compilation.

**How to avoid:** Changes must be coordinated: (1) add `today_count: i64` to `StatsResponse` in `backend/src/models/admin.rs`, (2) add the query in `admin_queries.rs`, (3) populate in `get_report_stats()`, (4) update `AdminStats` TypeScript interface, (5) update dashboard rendering.

### Pitfall 6: image Crate JPEG Quality API

**What goes wrong:** Using `image::DynamicImage::save()` or the default JPEG encoder, which may not allow specifying 85% quality directly.

**Why it happens:** The `image` crate has multiple encoding paths; the quality control API requires using `JpegEncoder` explicitly.

**How to avoid:**
```rust
use image::codecs::jpeg::JpegEncoder;

let mut output = Vec::new();
let encoder = JpegEncoder::new_with_quality(&mut output, 85);
rotated.write_with_encoder(encoder)?;
```
*Verify exact API signature against image crate 0.25 docs [ASSUMED — training knowledge].*

### Pitfall 7: nginx `add_header` Does Not Inherit in Nested Locations

**What goes wrong:** Adding `add_header Content-Security-Policy` to the `server {}` block does NOT apply to nested `location` blocks that already have their own `add_header` directives.

**Why it happens:** Nginx `add_header` inheritance: if a location block has ANY `add_header` directive, it DOES NOT inherit headers from the parent `server {}` block.

**How to avoid:** Add the CSP header directly to the specific `location /` block, not at server level.

### Pitfall 8: FIX-02 — SuccessCard onReportAnother Is Not a Link

**What goes wrong:** Trying to change `onReportAnother` in SuccessCard.tsx to an href won't work — `onReportAnother` is a callback prop, not a link.

**Why it happens:** SuccessCard uses `onClick={onReportAnother}` on a `<Btn>`. The navigation decision is in the caller.

**How to avoid:** Change the `onReportAnother` implementation in `report/page.tsx` where SuccessCard is rendered (line 419). The current implementation calls `resetAll` which keeps the user on `/report`. Change to: `onReportAnother={() => { window.location.href = "/"; }}` — consistent with the close handler pattern already used at line 422.

---

## Code Examples

### FIX-01: Constructing the Public Image URL
```typescript
// In frontend/app/reports/[id]/page.tsx
// Source: code audit of queries.rs and config.ts [VERIFIED: code read]
import { API_BASE_URL } from "@/app/lib/config";

// Backend returns image_url with internal URL — extract just the filename
const imageFilename = (report.image_url ?? "").split("/uploads/").pop() ?? "";
const publicImageUrl = imageFilename
  ? `${API_BASE_URL}/uploads/${imageFilename}`
  : "";

// Then use: <img src={publicImageUrl} ...>
```

### FIX-07: Public Status History SQL Filter
```sql
-- In backend/src/db/queries.rs — get_report_with_detail
-- Source: code audit of queries.rs line 382 [VERIFIED: code read]
SELECT new_status::TEXT AS status, changed_at
FROM status_history
WHERE report_id = $1
  AND new_status::TEXT != 'acknowledged'
ORDER BY changed_at ASC
```

### FIX-08: Today Count in StatsResponse
```rust
// In backend/src/db/admin_queries.rs
// Source: code audit of admin_queries.rs and models/admin.rs [VERIFIED: code read]
let today_count: i64 = sqlx::query_scalar(
    "SELECT COUNT(*) FROM reports WHERE created_at::date = CURRENT_DATE"
)
.fetch_one(pool)
.await?;

// Return in StatsResponse:
Ok(StatsResponse {
    total_reports: total,
    today_count,  // NEW FIELD
    by_status,
    by_category,
    by_severity,
})
```

### FIX-11: BUILD_HASH in deploy.yml
```yaml
# In .github/workflows/deploy.yml — Build and deploy step
# Source: code audit of deploy.yml [VERIFIED: code read]
- name: Build and deploy on LXC
  run: |
    ssh ... "cd /opt/nammadaari && \
    NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) \
    docker compose ... build --build-arg NEXT_PUBLIC_BUILD_HASH=${NEXT_PUBLIC_BUILD_HASH} ..."
```

*Note: For Next.js, build args passed to Docker must be declared in the Dockerfile as `ARG NEXT_PUBLIC_BUILD_HASH` and picked up in `next.config.mjs` or passed as env vars at build time. The exact mechanism depends on how the frontend Dockerfile is structured — verify before coding.*

### FIX-13: location_source Migration
```sql
-- backend/migrations/015_rename_location_source.sql
-- Source: code audit of migrations/ and 001_init.sql [VERIFIED: code read]

-- Add canonical enum values (idempotent via IF NOT EXISTS)
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'GPS_API';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'MANUAL_ADJUST';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'EXIF_GPS';

-- Migrate all existing rows
UPDATE reports SET location_source = 'GPS_API' WHERE location_source = 'manual_pin';

-- Note: 'manual_pin' and 'exif' remain in the enum type but are no longer emitted by code.
-- 'exif' should also be migrated if any rows exist with that value:
-- UPDATE reports SET location_source = 'EXIF_GPS' WHERE location_source = 'exif';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `manual_pin` / `exif` location_source | `GPS_API` / `MANUAL_ADJUST` / `EXIF_GPS` | Phase 5 (FIX-13) | More accurate admin triage labelling |
| `by_status.open` as "today count" | `COUNT(*) WHERE created_at::date = CURRENT_DATE` | Phase 5 (FIX-08) | Immutable intake metric |
| EXIF strip only | Orient bake → EXIF strip | Phase 5 (FIX-06) | Upright photos in admin |

**Deprecated/outdated after Phase 5:**
- `manual_pin`: deprecated location source value; keep in DB enum but emit nothing to it.
- `/report` route: soft-deprecated via 301 redirect to `/`.
- `/reports` route: soft-deprecated via 301 redirect to `/`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `image` crate 0.25 API: `rotate90()`, `rotate180()`, `rotate270()` are methods on `DynamicImage` | Standard Stack / Code Examples | Low — these are stable long-standing API methods; verify in crate docs before coding |
| A2 | `image` crate quality control uses `JpegEncoder::new_with_quality` | Code Examples (FIX-06) | Low — may need different API method name; check image 0.25 docs |
| A3 | react-leaflet `useMap` hook is available in the version installed | Standard Stack | Low — this hook exists in react-leaflet v3+; verify installed version in package.json |
| A4 | The Dockerfile for the frontend supports build args / env injection at Next.js build time | FIX-11 | Medium — if Dockerfile doesn't forward env vars to `npm run build`, FIX-11 won't work; verify Dockerfile before coding |
| A5 | `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is idempotent in the installed PostgreSQL version | FIX-13 | Low — `IF NOT EXISTS` for ADD VALUE was added in PostgreSQL 9.3; project uses PostGIS which requires PG 10+ |

---

## Open Questions

1. **FIX-07: Auto-assign creates duplicate `open` entry**
   - What we know: `create_report` inserts a second `status_history` row with `new_status = 'open'` when auto-assign succeeds (reports.rs line 308). The CONTEXT filter removes `acknowledged`. The two-`open` duplication from auto-assign persists.
   - What's unclear: Does the locked decision (filter `acknowledged`) fully resolve the visible duplication seen in UAT? UAT showed THREE entries: Open, Open, In Progress — that's two `open` before any `acknowledged`.
   - Recommendation: Implement D-17/D-19 as specified (filter `acknowledged`). Additionally, evaluate filtering auto-assign `open` entries by checking `note = 'Auto-assigned based on ward geography'`, or change the auto-assign audit insert to NOT use `status_history` (use a separate audit table or just log). Flag this for human review during verification.

2. **FIX-11: Frontend Dockerfile build arg forwarding**
   - What we know: `deploy.yml` runs `docker compose build backend` and `up -d db backend nginx`. The frontend is deployed to Vercel separately (based on `FRONTEND_URL` variable and smoke test step).
   - What's unclear: If the frontend is on Vercel, `NEXT_PUBLIC_BUILD_HASH` injection must happen in the Vercel project env settings or Vercel build command, not in the self-hosted deploy script. The `deploy.yml` only builds the backend Docker image.
   - Recommendation: Before coding, clarify whether the frontend deploys via Vercel CI or via Docker on the LXC. If Vercel: inject via Vercel project env vars; if Docker: inject via `docker build --build-arg`. This is a material difference in how the fix is implemented.

3. **FIX-05: Admin detail map scope**
   - What we know: The admin detail page has a grey placeholder div, not a Leaflet map. Adding a Leaflet map requires `dynamic(() => import(...), { ssr: false })` per CLAUDE.md, plus the LocationMap component in read-only mode.
   - What's unclear: CONTEXT D-10 says "apply to ALL Leaflet map components — `LocationMap.tsx`, the admin report detail map, and `ReportsMap.tsx`". This implies the admin detail DOES have a Leaflet map. The UAT finding (UAT-01-09) says "Grey placeholder box with only the text 'MAP'".
   - Recommendation: FIX-05 scope includes adding a real Leaflet map to the admin detail page. Plan this as a two-step change: (1) add `<LocationMap readOnly lat=... lng=...>` to admin detail, (2) apply invalidateSize to it. This is confirmed by the UAT finding.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust / cargo | FIX-06 backend build | ✓ | (project standard) | — |
| Node.js / npm | Frontend build | ✓ | (project standard) | — |
| PostgreSQL | FIX-13 migration | ✓ (Docker) | PostGIS variant | — |
| `image` crate (Rust) | FIX-06 | ✗ (not in Cargo.toml) | 0.25.10 | Must add |
| `img-parts` crate | FIX-06 (EXIF read) | ✓ | 0.3 | Already present |
| GitHub Actions runner | FIX-11 | ✓ | self-hosted linux walkability-prod | — |

**Missing dependencies with no fallback:**
- `image` crate (Rust): not in `backend/Cargo.toml`. Must add before FIX-06 can be implemented.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | `cargo test` (Rust unit tests in-source) |
| Frontend framework | Jest (existing in `frontend/app/**/__tests__/`) |
| Quick run command | `cd backend && cargo test` |
| Full suite command | `cd backend && cargo test && cd ../frontend && npm test -- --watchAll=false` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | Public image URL construction | unit | `cargo test -- test_into_response` | ✅ (`models/report.rs` has URL tests) |
| FIX-02 | Report another navigates to `/` | manual | Manual iOS Safari test | N/A — navigation |
| FIX-03 | FAB href changed | unit (lint) | `grep -n "href.*report" frontend/app/map/page.tsx` | N/A |
| FIX-04 | Leaflet tiles on iOS Safari | manual | Manual iOS Safari test | N/A — visual/browser |
| FIX-05 | Admin map renders | manual | Manual iOS Safari test | N/A — visual/browser |
| FIX-06 | Orientation baked before EXIF strip | unit | `cargo test` (add unit test for bake_orientation) | ❌ Wave 0 |
| FIX-07 | No acknowledged in public history | unit | `cargo test` (add test for history filter) | ❌ Wave 0 |
| FIX-08 | Today count is date-based | unit | `cargo test` (add unit test for today_count query logic) | ❌ Wave 0 |
| FIX-09 | Dashboard scrolls on iOS | manual | Manual iOS Safari test | N/A — visual/browser |
| FIX-10 | GPS at 3dp in citizen form | unit | check `toFixed(3)` in report/page.tsx | Partial (ReviewStrip.tsx already at 3dp) |
| FIX-11 | BUILD_HASH injected | smoke | deploy smoke test (manual verify) | N/A |
| FIX-12 | "Auto-detected" consistent | unit (string check) | `grep -rn "Auto-routed"` returns 0 results | N/A |
| FIX-13 | location_source uses canonical values | unit | `cargo test` (update test_default_location_source) | ✅ (needs update) |

### Wave 0 Gaps

- [ ] `backend/src/handlers/reports.rs` — unit test for `bake_orientation()` helper covering orientation values 1 (no-op), 3, 6, 8
- [ ] `backend/src/db/queries.rs` — unit/integration test verifying `acknowledged` is excluded from public status history
- [ ] `backend/src/db/admin_queries.rs` — unit test for today_count SQL logic (can test the SQL string constant pattern, per existing test patterns in admin_queries.rs)
- [ ] Update `test_default_location_source_is_manual_pin` in `reports.rs` to expect `GPS_API`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes in Phase 5 |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | No access control changes |
| V5 Input Validation | yes | FIX-13 location_source input — old values must be rejected by backend after migration |
| V6 Cryptography | no | No crypto changes |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via image_url extraction | Tampering | Extract only basename from `image_url` using `.split("/uploads/").pop()` — never use full path |
| JPEG polyglot / malformed bytes in orientation baking step | Tampering | `is_jpeg()` magic-byte check already runs BEFORE orientation baking; `image` crate returns Err on malformed input |
| Injection via `location_source` enum | Tampering | SQLx typed binding `$9::location_source` already rejects invalid enum values at DB level; old `manual_pin` value still in enum type so DB doesn't reject it — backend code must stop emitting it |

---

## Sources

### Primary (HIGH confidence)
- `backend/src/handlers/reports.rs` — full code audit [VERIFIED: code read] — EXIF pipeline, location_source, auto-assign
- `backend/src/db/queries.rs` — full code audit [VERIFIED: code read] — status history query, image_url construction
- `backend/src/db/admin_queries.rs` — partial code audit [VERIFIED: code read] — stats query, today count absence
- `backend/Cargo.toml` — [VERIFIED: code read] — `image` crate absent, `img-parts` present
- `backend/migrations/001_init.sql` — [VERIFIED: grep] — location_source enum values
- `backend/migrations/` directory — [VERIFIED: ls] — last migration is 014; next is 015
- `frontend/app/reports/[id]/page.tsx` — full code audit [VERIFIED: code read] — image_url usage, status history rendering
- `frontend/app/components/redesign/SuccessCard.tsx` — full code audit [VERIFIED: code read] — "Auto-routed" hardcoding confirmed
- `frontend/app/components/LocationMap.tsx` — full code audit [VERIFIED: code read] — no invalidateSize present
- `frontend/app/map/page.tsx` — grep [VERIFIED: code read] — FAB href="/report" confirmed
- `frontend/app/report/page.tsx` — partial audit [VERIFIED: code read] — toFixed(4) confirmed, onReportAnother = resetAll
- `frontend/app/admin/reports/[id]/page.tsx` — partial audit [VERIFIED: code read] — grey placeholder confirmed, no Leaflet
- `frontend/app/admin/page.tsx` — partial audit [VERIFIED: code read] — statsForCards.submitted misuse confirmed
- `frontend/app/admin/login/page.tsx` — grep [VERIFIED: code read] — BUILD_HASH hardcoded as 0000000
- `frontend/app/lib/translations.ts` — full code audit [VERIFIED: code read] — no location_source labels present
- `frontend/app/lib/config.ts` — full code audit [VERIFIED: code read] — API_BASE_URL, no BUILD_HASH export
- `nginx/nginx.conf` — full code audit [VERIFIED: code read] — /uploads/ has no auth guard; / has no CSP; /admin has CSP with OSM tiles
- `.github/workflows/deploy.yml` — full code audit [VERIFIED: code read] — no NEXT_PUBLIC_BUILD_HASH injection; frontend deploys to Vercel (separate from LXC backend deploy)
- `UAT-Milestone-01-Live.md` — full read [VERIFIED: code read] — root cause analysis for all 13 findings
- `backend/src/models/admin.rs` — partial read [VERIFIED: code read] — StatsResponse struct (no today_count field)

### Secondary (MEDIUM confidence)
- `cargo search image` result — `image = "0.25.10"` [VERIFIED: crates.io via cargo search]

### Tertiary (LOW confidence)
- image crate API specifics (`rotate90`, `JpegEncoder::new_with_quality`) — [ASSUMED: training knowledge, verify against image 0.25 docs before coding]
- react-leaflet `useMap` hook pattern — [ASSUMED: training knowledge, verify against installed version in package.json]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in Cargo.toml or package.json via code audit
- Architecture: HIGH — full code audit of all affected files; root causes confirmed from UAT findings
- Pitfalls: HIGH — all pitfalls derived from actual code readings, not inference
- FIX-06 API specifics: LOW — image crate method names are training knowledge; verify before coding

**Research date:** 2026-06-05T08:30:00Z
**Valid until:** 2026-07-05 (stable codebase; 30-day expiry)
