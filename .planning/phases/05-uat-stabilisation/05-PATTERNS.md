# Phase 5: UAT Stabilisation — Pattern Map

**Mapped:** 2026-06-05T09:15:00Z
**Files analyzed:** 14 files to be created or modified
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/app/reports/[id]/page.tsx` | component (SSR page) | request-response | self (already exists — modify) | exact |
| `frontend/app/lib/config.ts` | config/utility | — | self (already exists — modify) | exact |
| `frontend/app/lib/translations.ts` | utility (label map) | transform | self (already exists — extend) | exact |
| `frontend/app/components/redesign/SuccessCard.tsx` | component | — | self (already exists — modify) | exact |
| `frontend/app/map/page.tsx` | component (client page) | — | self (already exists — modify) | exact |
| `frontend/app/report/page.tsx` | component (client page) | — | self (already exists — modify) | exact |
| `frontend/app/components/LocationMap.tsx` | component (map) | — | self (already exists — modify) | exact |
| `frontend/app/admin/page.tsx` | component (client page) | request-response | self (already exists — modify) | exact |
| `frontend/app/admin/login/page.tsx` | component (client page) | — | self (already exists — modify) | exact |
| `frontend/app/admin/reports/[id]/page.tsx` | component (client page) | request-response | self (already exists — modify) | exact |
| `frontend/next.config.mjs` | config | — | self (already exists — modify) | exact |
| `backend/src/handlers/reports.rs` | handler (controller) | request-response | self (already exists — modify) | exact |
| `backend/src/db/queries.rs` | service (DB query) | CRUD | self (already exists — modify) | exact |
| `backend/src/db/admin_queries.rs` | service (DB query) | CRUD | self (already exists — modify) | exact |
| `backend/src/models/admin.rs` | model | — | self (already exists — modify) | exact |
| `backend/migrations/015_rename_location_source.sql` | migration | batch | `backend/migrations/014_link_wards_to_organisations.sql` | role-match |
| `nginx/nginx.conf` | config (reverse proxy) | — | self (already exists — modify) | exact |
| `.github/workflows/deploy.yml` | config (CI) | — | self (already exists — modify) | exact |

---

## Pattern Assignments

### FIX-01: `frontend/app/reports/[id]/page.tsx` — Public image URL construction

**Analog:** self (lines 296-302, 11-12 for imports)

**Imports pattern** (lines 11-13 — current state):
```typescript
import { notFound } from "next/navigation";
import { INTERNAL_API_URL } from "@/app/lib/config";
import { getCategoryLabel, publicStatusLabel, publicStatusColor } from "@/app/lib/translations";
```

**Fix — add `API_BASE_URL` import:**
```typescript
import { INTERNAL_API_URL, API_BASE_URL } from "@/app/lib/config";
```

**Current broken pattern** (line 298 — what to replace):
```typescript
<img
  src={report.image_url}
  alt=""
  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
/>
```

**Fixed pattern — extract filename and reconstruct URL client-safe:**
```typescript
// After: const report: PublicReport = await res.json();
// Add this derivation (NEVER use report.image_url directly — it contains internal Docker URL):
const imageFilename = (report.image_url ?? "").split("/uploads/").pop() ?? "";
const publicImageUrl = imageFilename ? `${API_BASE_URL}/uploads/${imageFilename}` : "";

// Then render:
<img
  src={publicImageUrl}
  alt=""
  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
/>
```

**Key constraint:** `API_BASE_URL` comes from `frontend/app/lib/config.ts` line 18 (`process.env.NEXT_PUBLIC_API_URL ?? ""`). In Docker this is `""` (relative URL, proxied via nginx rewrites in `next.config.mjs` lines 38-42). In staging/Vercel it is the public backend URL. Do NOT inline `process.env.*` directly.

---

### FIX-02/03: `frontend/app/components/redesign/SuccessCard.tsx` + `frontend/app/map/page.tsx` — Deprecated route links

**Analog SuccessCard:** self (lines 254-256 — current `onReportAnother` button)

**Current pattern** (SuccessCard.tsx line 254):
```typescript
<Btn variant="accent" size="lg" onClick={onReportAnother} style={{ flex: 2 }}>
  <Bi en="Report another" kn="ಇನ್ನೊಂದು" style={{ alignItems: "center" }} />
</Btn>
```

`onReportAnother` is a callback prop — the fix is NOT in SuccessCard. It is in `report/page.tsx` where the callback is wired.

**Analog report/page.tsx — existing close handler pattern to mirror:**
The `onClose` callback uses `window.location.href = "/"` at report/page.tsx line 422. The `onReportAnother` callback currently calls `resetAll()`. Change it to navigate:
```typescript
onReportAnother={() => { window.location.href = "/"; }}
```

**Analog map/page.tsx** (line 269 — current FAB):
```typescript
href="/report"
```

**Fix** (one-character change to the href value):
```typescript
href="/"
```

---

### FIX-02/03: `frontend/next.config.mjs` — 301 redirects for deprecated routes

**Analog:** existing `rewrites()` block in `frontend/next.config.mjs` lines 29-43.

**Current pattern** (rewrites block, lines 29-43):
```javascript
async rewrites() {
  const backend = process.env.INTERNAL_API_URL;
  if (!backend) return [];
  return [
    {
      source: "/uploads/:path*",
      destination: `${backend}/uploads/:path*`,
    },
  ];
},
```

**Add `redirects()` alongside `rewrites()` — same file, same `nextConfig` object:**
```javascript
async redirects() {
  return [
    {
      source: "/report",
      destination: "/",
      permanent: true,
    },
    {
      source: "/reports",
      destination: "/",
      permanent: true,
    },
  ];
},
```

`permanent: true` emits HTTP 308 (Next.js App Router) or 301 (Pages Router). Either is acceptable — the redirect happens before route rendering.

---

### FIX-04: `frontend/app/components/LocationMap.tsx` — `invalidateSize` on mount

**Analog:** self (lines 98-109 — existing `useEffect` for Leaflet icon path fix)

**Current useEffect pattern** (lines 98-109):
```typescript
useEffect(() => {
  const L = require("leaflet");
  delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}, []);
```

**Add `MapSizeUpdater` child component inside `MapContainer`** — the react-leaflet `useMap` hook must be used inside a component that is a child of `<MapContainer>`:
```typescript
import { useMap } from "react-leaflet";

function MapSizeUpdater() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => { map.invalidateSize(); }, 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}
```

Then inside `<MapContainer ...>` (after existing `<TileLayer>`):
```typescript
<MapContainer center={center} zoom={15} ref={mapRef} style={{ width: "100%", height: "100%" }} scrollWheelZoom={false}>
  <MapSizeUpdater />
  <TileLayer ... />
  ...
</MapContainer>
```

**Note:** `LocationMap.tsx` already has `"use client"` (line 1) and is imported via `dynamic(() => import(...), { ssr: false })` in the parent component. The `MapSizeUpdater` goes inside this existing client component — no additional dynamic wrapping needed here.

---

### FIX-04: `nginx/nginx.conf` — CSP for public routes (`location /`)

**Analog:** existing CSP in admin location block (lines 179-198)

**Current admin CSP** (line 198):
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org; connect-src 'self';" always;
```

**Current public `location /` block** (lines 211-220 — NO CSP header):
```nginx
location / {
    proxy_pass http://frontend;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "upgrade";
    proxy_http_version 1.1;
}
```

**Fix — add CSP header to public `location /` block.** Mirror the admin CSP but add `https://*.tile.openstreetmap.org` to `connect-src` (iOS Safari enforces connect-src for XHR tile fetches):
```nginx
location / {
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org; connect-src 'self' https://*.tile.openstreetmap.org;" always;
    proxy_pass http://frontend;
    proxy_set_header Host              $host;
    ...
}
```

**Critical nginx rule:** `add_header` must be placed directly in the `location /` block. Adding it to the `server {}` parent does NOT propagate to child location blocks that have their own `add_header` directives (nginx inheritance rule).

---

### FIX-05: `frontend/app/admin/reports/[id]/page.tsx` — Add real Leaflet map

**Analog:** `frontend/app/reports/[id]/page.tsx` for dynamic import pattern; `frontend/app/components/LocationMap.tsx` for the map component itself.

**Current placeholder** (lines 426-437):
```typescript
<Card padded={false} style={{ marginBottom: 16, overflow: "hidden" }}>
  <div style={{
    height: 140,
    background: "linear-gradient(135deg, var(--surface-2), var(--surface-3))",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
      MAP
    </span>
  </div>
```

**Dynamic import pattern** (from CLAUDE.md constraint — all Leaflet must use SSR-off dynamic import):
```typescript
// At the top of admin/reports/[id]/page.tsx, alongside other imports:
import nextDynamic from "next/dynamic";

const LocationMap = nextDynamic(
  () => import("@/app/components/LocationMap"),
  { ssr: false }
);
```

**Replace the static placeholder div with:**
```typescript
{(report.latitude != null && report.longitude != null) ? (
  <LocationMap
    lat={report.latitude}
    lng={report.longitude}
    onChange={() => {}} // read-only; handler is a no-op
    readOnly
    className="w-full"
    style={{ height: 140 }}
  />
) : (
  <div style={{
    height: 140,
    background: "linear-gradient(135deg, var(--surface-2), var(--surface-3))",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
      No coordinates
    </span>
  </div>
)}
```

**Note:** `LocationMap` already supports `readOnly` prop (line 59: `readOnly = false`). With `readOnly`, the component renders a non-draggable `<Marker>` (line 163-164). The `onChange` prop is still required by the interface — pass a no-op.

---

### FIX-06: `backend/src/handlers/reports.rs` — EXIF orientation baking

**Analog:** existing `strip_exif()` function at lines 381-396 and the ingest pipeline at lines 292-300.

**Current pipeline order** (lines 292-300):
```rust
// Strip EXIF from image before saving
let clean_bytes = strip_exif(&req.image_bytes)?;

// Save to disk
let file_uuid = Uuid::new_v4();
let filename = format!("{}.jpg", file_uuid);
let file_path = PathBuf::from(&state.uploads_dir).join(&filename);
tokio::fs::write(&file_path, &clean_bytes).await?;
```

**Fixed pipeline order — insert `bake_orientation` BEFORE `strip_exif`:**
```rust
// [NEW FIX-06] Bake EXIF orientation into pixels before stripping metadata.
// If orientation tag is absent or == 1 (normal), bytes are returned unchanged.
let oriented_bytes = bake_orientation(&req.image_bytes)?;

// Strip EXIF from orientation-baked bytes
let clean_bytes = strip_exif(&oriented_bytes)?;

// Save to disk (unchanged)
```

**New `bake_orientation` helper — follow the exact same function signature style as `strip_exif`:**
```rust
/// FIX-06: Read EXIF orientation tag, rotate pixels if needed, return corrected bytes.
/// If the orientation tag is absent or has value 1 (normal), returns original bytes unchanged.
/// Re-encodes to JPEG at 85% quality when rotation is required.
fn bake_orientation(bytes: &[u8]) -> Result<Vec<u8>, crate::errors::AppError> {
    use img_parts::{jpeg::Jpeg, ImageEXIF};
    use image::{DynamicImage, codecs::jpeg::JpegEncoder};

    // Step 1: Read orientation tag value via img-parts
    let orientation: u16 = {
        let jpeg = Jpeg::from_bytes(bytes.to_vec().into())
            .map_err(|_| crate::errors::AppError::BadRequest("Image processing failed".into()))?;
        read_exif_orientation_tag(&jpeg).unwrap_or(1)
    };

    // Step 2: If no rotation needed, return original bytes unchanged
    if orientation <= 1 {
        return Ok(bytes.to_vec());
    }

    // Step 3: Decode, rotate, re-encode
    let img = image::load_from_memory(bytes)
        .map_err(|_| crate::errors::AppError::BadRequest("Failed to decode image".into()))?;

    let rotated: DynamicImage = match orientation {
        3 => img.rotate180(),
        6 => img.rotate90(),
        8 => img.rotate270(),
        2 => img.fliph(),
        4 => img.flipv(),
        5 => img.rotate90().fliph(),
        7 => img.rotate270().fliph(),
        _ => return Ok(bytes.to_vec()), // unknown value — passthrough
    };

    let mut output = Vec::new();
    let encoder = JpegEncoder::new_with_quality(&mut output, 85);
    rotated.write_with_encoder(encoder)
        .map_err(|_| crate::errors::AppError::BadRequest("JPEG re-encode failed".into()))?;
    Ok(output)
}
```

**`read_exif_orientation_tag` helper** (reads EXIF APP1 segment via img-parts — mirrors the approach in `strip_exif`):
```rust
fn read_exif_orientation_tag(jpeg: &img_parts::jpeg::Jpeg) -> Option<u16> {
    use img_parts::ImageEXIF;
    let exif_bytes = jpeg.exif()?;
    // EXIF header: "Exif\0\0" (6 bytes), then TIFF header
    // IFD0 tag 0x0112 = Orientation
    // This is a minimal parser — use the `exif` crate for production-grade parsing
    // or parse the TIFF IFD manually. See Pitfall A1 in RESEARCH.md.
    exif_crate_or_manual_parse(exif_bytes.as_ref())
}
```

**NOTE for planner:** The `read_exif_orientation_tag` helper requires parsing EXIF bytes to find tag 0x0112. `img-parts` provides raw EXIF bytes but not tag parsing. Two options:
1. Add the `exif` crate (lightweight) for tag parsing.
2. Hand-roll a minimal TIFF IFD parser for tag 0x0112 only (< 30 lines).

`img-parts` docs confirm `.exif()` returns `Option<Bytes>` — the raw APP1 payload. The `image` crate's `load_from_memory` already auto-applies orientation when decoding (verify with image crate 0.25 changelog — if so, the explicit rotation step may be unnecessary for the `image` crate path). This is flagged as **assumption A1** in RESEARCH.md.

**`Cargo.toml` addition required:**
```toml
image = "0.25"
```

---

### FIX-07: `backend/src/db/queries.rs` — Filter `acknowledged` from public status history

**Analog:** existing status history query at line 381-386.

**Current query** (lines 381-386):
```rust
let history_rows = sqlx::query(
    "SELECT new_status::TEXT AS status, changed_at FROM status_history WHERE report_id = $1 ORDER BY changed_at ASC",
)
.bind(id)
.fetch_all(pool)
.await?;
```

**Fixed query — add `AND` filter per D-17/D-19:**
```rust
let history_rows = sqlx::query(
    "SELECT new_status::TEXT AS status, changed_at \
     FROM status_history \
     WHERE report_id = $1 \
       AND new_status::TEXT != 'acknowledged' \
     ORDER BY changed_at ASC",
)
.bind(id)
.fetch_all(pool)
.await?;
```

**Open question for planner (from RESEARCH.md):** The auto-assign audit insert at `backend/src/handlers/reports.rs` lines 307-316 writes a second `new_status = 'open'` row for reports that get org auto-assigned. This creates a duplicate "Open" entry visible in the public timeline that is distinct from the `acknowledged` duplication. The locked decision (D-17) only filters `acknowledged`. Planner should flag this during verification — the filter as specified may not fully resolve the duplication seen in UAT.

---

### FIX-08: `backend/src/db/admin_queries.rs` + `backend/src/models/admin.rs` — Today count

**Analog for query pattern:** `get_report_stats()` function at `admin_queries.rs` lines 826-901, especially the `sqlx::query_scalar` usage at line 827.

**Current stats query pattern** (lines 827-829):
```rust
let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reports")
    .fetch_one(pool)
    .await?;
```

**New `today_count` query — same pattern:**
```rust
let today_count: i64 = sqlx::query_scalar(
    "SELECT COUNT(*) FROM reports WHERE created_at::date = CURRENT_DATE"
)
.fetch_one(pool)
.await?;
```

**Current `StatsResponse` struct** (`backend/src/models/admin.rs` lines 242-251):
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct StatsResponse {
    pub total_reports: i64,
    /// Keys: "open", "acknowledged", "assigned", "in_progress", "resolved", "closed"
    pub by_status: HashMap<String, i64>,
    pub by_category: HashMap<String, i64>,
    pub by_severity: HashMap<String, i64>,
}
```

**Add `today_count` field:**
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct StatsResponse {
    pub total_reports: i64,
    pub today_count: i64,  // FIX-08: reports submitted today (UTC, date-only filter)
    pub by_status: HashMap<String, i64>,
    pub by_category: HashMap<String, i64>,
    pub by_severity: HashMap<String, i64>,
}
```

**Update `Ok(StatsResponse { ... })` at line 895-900** to include the new field:
```rust
Ok(StatsResponse {
    total_reports: total,
    today_count,  // FIX-08
    by_status,
    by_category,
    by_severity,
})
```

**Frontend impact:** `frontend/app/admin/lib/adminApi.ts` `AdminStats` TypeScript interface must also add `today_count: number`. `frontend/app/admin/page.tsx` line 357 rendering must use `stats.today_count` instead of `statsForCards.submitted`.

---

### FIX-09: `frontend/app/admin/page.tsx` — iOS Safari scroll rubber-band

**Analog:** The admin CSS token layer at `frontend/app/admin/admin.css`. The fix is CSS-only — no component logic changes.

**Pattern to follow:** Modern iOS scrolling requires `overflow-y: auto` on the scrollable container, no ancestor with `overflow: hidden` that would trap the scroll context, and no `overscroll-behavior: none`.

**What to audit in `admin/page.tsx`:** The outermost wrapper `div` and any parent with explicit height. Look for inline `style={{ overflow: "hidden" }}` or `style={{ overflowY: "hidden" }}` on the page container or layout parent.

**Constraint from D-24:** Do NOT add `-webkit-overflow-scrolling: touch` (deprecated since iOS 15). The fix is exclusively:
1. `overflow-y: auto` on the scrollable wrapper (not `hidden`).
2. No `overscroll-behavior: none` on that wrapper.
3. No `height: 100vh` on an ancestor that prevents scroll anchoring (use `min-height: 100dvh` instead).

---

### FIX-10: `frontend/app/report/page.tsx` — GPS coordinate display precision

**Analog:** `frontend/app/admin/reports/[id]/page.tsx` line 446 — already uses `.toFixed(4)` for admin display; the citizen form should use `.toFixed(3)`.

**Current broken pattern** (report/page.tsx lines 662 and 970):
```typescript
{form.lat.toFixed(4)}, {form.lng.toFixed(4)}
// and
{form.lat.toFixed(4)}° N, {form.lng.toFixed(4)}° E
```

**Fixed pattern:**
```typescript
{form.lat.toFixed(3)}, {form.lng.toFixed(3)}
// and
{form.lat.toFixed(3)}° N, {form.lng.toFixed(3)}° E
```

**Backend verification per D-26:** `backend/src/db/queries.rs` lines 403-406 already rounds to 3dp at the API response layer:
```rust
let lat_rounded = (latitude * 1000.0).round() / 1000.0;
let lng_rounded = (longitude * 1000.0).round() / 1000.0;
```
Backend rounding is already correct. The fix is frontend-only (two `toFixed(4)` → `toFixed(3)` replacements in report/page.tsx).

---

### FIX-11: `.github/workflows/deploy.yml` — BUILD_HASH injection

**Analog:** existing `NEXT_PUBLIC_APP_VERSION` injection pattern in `frontend/next.config.mjs` lines 12-14.

**Current deploy.yml build step** (lines 41-46 — no BUILD_HASH injection):
```yaml
- name: Build and deploy on LXC
  run: |
    ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no root@192.168.1.152 \
      "cd /opt/nammadaari && \
       docker compose -f docker-compose.yml -f docker-compose.server.yml build backend && \
       docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --remove-orphans db backend nginx"
```

**Key finding from RESEARCH.md open question 2:** The frontend deploys to Vercel separately. `deploy.yml` only builds the backend Docker image. The frontend is served via `${{ vars.FRONTEND_URL }}` (smoke test line 88). This means `NEXT_PUBLIC_BUILD_HASH` injection must happen in **Vercel project environment variables** or the Vercel build command, NOT in this deploy.yml SSH step.

**Correct fix pattern for Vercel deployment:**
1. In Vercel project settings → Environment Variables, add `NEXT_PUBLIC_BUILD_HASH` with a static placeholder value.
2. Override it at build time via the Vercel build command: `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build`.

**`frontend/app/lib/config.ts` — add BUILD_HASH export** (following the same pattern as `APP_VERSION` at line 22):
```typescript
export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? "0000000";
```

**`frontend/app/admin/login/page.tsx` — replace hardcoded string** (line 246):
```typescript
// Current:
<span>BUILD_HASH: 0000000 · {new Date().getFullYear()}</span>

// Fixed (import BUILD_HASH from config.ts):
import { BUILD_HASH } from "@/app/lib/config";
// ...
<span>BUILD_HASH: {BUILD_HASH} · {new Date().getFullYear()}</span>
```

---

### FIX-12: `frontend/app/components/redesign/SuccessCard.tsx` — Ward label string

**Analog:** `report/page.tsx` line 1024 (already uses "Auto-detected" correctly).

**Current broken string** (SuccessCard.tsx line 241):
```typescript
<span style={{ fontSize: 10, color: "var(--muted-2)", marginLeft: "auto" }}>
  Auto-routed
</span>
```

**Fixed string:**
```typescript
<span style={{ fontSize: 10, color: "var(--muted-2)", marginLeft: "auto" }}>
  Auto-detected
</span>
```

**Grep scope** per D-31: Search all frontend files for case variations — `Auto-routed`, `auto-routed`, `Auto routed` — and replace every occurrence. Current confirmed location: `SuccessCard.tsx` line 241.

---

### FIX-13: Full-stack `location_source` canonical values

This fix spans five files.

#### `backend/migrations/015_rename_location_source.sql` (new file)

**Analog:** `backend/migrations/014_link_wards_to_organisations.sql` (most recent migration).

**Migration pattern:**
```sql
-- 015_rename_location_source.sql
-- FIX-13: Add canonical location_source enum values and migrate existing rows.
-- PostgreSQL does not support ALTER TYPE ... DROP VALUE.
-- Old values (exif, manual_pin) remain in the enum type but are no longer emitted by code.

-- Step 1: Add new canonical values (idempotent — IF NOT EXISTS)
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'GPS_API';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'MANUAL_ADJUST';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'EXIF_GPS';

-- Step 2: Migrate existing rows to canonical values
UPDATE reports SET location_source = 'GPS_API'   WHERE location_source::TEXT = 'manual_pin';
UPDATE reports SET location_source = 'EXIF_GPS'  WHERE location_source::TEXT = 'exif';
```

**Important:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in PostgreSQL < 12. SQLx migrations run in transactions by default. If the migration fails with "ALTER TYPE ... ADD VALUE cannot run inside a transaction block", add `-- sqlx:transaction:off` pragma at the top of the file (verify SQLx migration pragma syntax for the installed version).

#### `backend/src/handlers/reports.rs` — emit new canonical values

**Analog:** existing `location_source` default at line 216 and fake_success_response at line 91.

**Current defaults** (lines 91, 216):
```rust
// line 91 (fake_success_response):
location_source: "manual_pin".to_string(),

// line 216 (create_report default):
req.location_source = "manual_pin".to_string();
```

**Fixed defaults:**
```rust
// line 91:
location_source: "GPS_API".to_string(),

// line 216:
req.location_source = "GPS_API".to_string();
```

#### `frontend/app/lib/translations.ts` — add location_source label map

**Analog:** existing `CATEGORY_LABEL_MAP` + `getCategoryLabel()` pattern (lines 35-46).

**Add after the existing map functions:**
```typescript
// FIX-13: Canonical location_source display labels
const LOCATION_SOURCE_LABEL_MAP: Record<string, { en: string; kn: string }> = {
  GPS_API:       { en: "GPS (device)",   kn: "GPS (ಸಾಧನ)" },
  MANUAL_ADJUST: { en: "Manual pin",     kn: "ಮ್ಯಾನ್ಯುಯಲ್ ಪಿನ್" },
  EXIF_GPS:      { en: "Photo GPS",      kn: "ಫೋಟೋ GPS" },
  // Legacy values — kept for DB rows not yet migrated
  manual_pin:    { en: "Manual pin",     kn: "ಮ್ಯಾನ್ಯುಯಲ್ ಪಿನ್" },
  exif:          { en: "Photo GPS",      kn: "ಫೋಟೋ GPS" },
};

export function getLocationSourceLabel(value: string): { en: string; kn: string } {
  return LOCATION_SOURCE_LABEL_MAP[value] ?? { en: value, kn: value };
}
```

#### `frontend/app/report/page.tsx` — send new canonical values

**Analog:** existing `locationSource` state and assignment at lines 46, 60, 156, 319 (current values `"exif"` and `"manual_pin"`).

**Type change** (line 46):
```typescript
// Current:
locationSource: "exif" | "manual_pin";

// Fixed:
locationSource: "EXIF_GPS" | "GPS_API" | "MANUAL_ADJUST";
```

**Default value** (line 60):
```typescript
locationSource: "GPS_API",  // was "manual_pin"
```

**After browser geolocation** (line 156):
```typescript
locationSource: "GPS_API",  // was "manual_pin"
```

**After EXIF GPS extraction** (line 319):
```typescript
locationSource: gps ? "EXIF_GPS" : "GPS_API",  // was: gps ? "exif" : "manual_pin"
```

#### `frontend/app/admin/reports/[id]/page.tsx` — LOCATION_SRC display and condition

**Current condition** (line 106):
```typescript
{report.location_source === "exif" && (
```

**Fixed condition:**
```typescript
{report.location_source === "EXIF_GPS" && (
```

**Current label rendering** (line 347):
```typescript
{ key: "LOCATION_SRC", value: (report.location_source ?? "—").toUpperCase() },
```

**Fixed — use translation helper:**
```typescript
import { getLocationSourceLabel } from "@/app/lib/translations";
// ...
{ key: "LOCATION_SRC", value: getLocationSourceLabel(report.location_source ?? "").en },
```

---

## Shared Patterns

### Config import (all frontend files)
**Source:** `frontend/app/lib/config.ts` lines 18-23
**Apply to:** Any file needing API URL or version constants — never inline `process.env.*` in components.
```typescript
export const API_BASE_URL    = process.env.NEXT_PUBLIC_API_URL ?? "";
export const ADMIN_API_BASE_URL = "";
export const INTERNAL_API_URL  = process.env.INTERNAL_API_URL ?? "http://localhost:3001";
export const APP_VERSION       = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
// Add: export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? "0000000";
```

### Translation map pattern (all new label helpers)
**Source:** `frontend/app/lib/translations.ts` lines 35-46 (`CATEGORY_LABEL_MAP` + `getCategoryLabel`)
**Apply to:** FIX-13 `getLocationSourceLabel` helper — same bilingual Record + fallback pattern.
```typescript
const SOME_MAP: Record<string, { en: string; kn: string }> = { ... };
export function getSomeLabel(value: string): { en: string; kn: string } {
  return SOME_MAP[value] ?? { en: value, kn: value };
}
```

### Rust helper function pattern (all new backend helpers)
**Source:** `backend/src/handlers/reports.rs` lines 381-396 (`strip_exif`)
**Apply to:** FIX-06 `bake_orientation` helper — same `pub(crate) fn name(bytes: &[u8]) -> Result<Vec<u8>, AppError>` signature, same `img_parts` import scope, same error type.
```rust
pub(crate) fn strip_exif(bytes: &[u8]) -> Result<Vec<u8>, crate::errors::AppError> {
    use img_parts::{jpeg::Jpeg, ImageEXIF};
    Jpeg::from_bytes(bytes.to_vec().into())
        .map(|mut jpeg| {
            jpeg.set_exif(None);
            jpeg.encoder().bytes().to_vec()
        })
        .map_err(|_| crate::errors::AppError::BadRequest("Image processing failed: not a valid JPEG".into()))
}
```

### SQLx `query_scalar` pattern (new stats queries)
**Source:** `backend/src/db/admin_queries.rs` line 827
**Apply to:** FIX-08 `today_count` query — same scalar fetch pattern.
```rust
let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM reports WHERE ...")
    .fetch_one(pool)
    .await?;
```

### Dynamic Leaflet import (all map components in admin)
**Source:** CLAUDE.md architectural decision + `frontend/app/map/page.tsx` line 5 (`import nextDynamic from "next/dynamic"`)
**Apply to:** FIX-05 — admin report detail page must wrap `LocationMap` in `nextDynamic(..., { ssr: false })`.
```typescript
import nextDynamic from "next/dynamic";
const LocationMap = nextDynamic(
  () => import("@/app/components/LocationMap"),
  { ssr: false }
);
```

---

## No Analog Found

All files being modified are existing project files. No genuinely new files lack an analog, except:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/migrations/015_rename_location_source.sql` | migration | batch | New migration file; closest analog is `014_link_wards_to_organisations.sql` (role-match only — different DDL content) |

---

## Metadata

**Analog search scope:** `frontend/app/`, `backend/src/`, `nginx/`, `.github/workflows/`
**Files scanned:** 18 source files read directly; ~30 additional grep passes
**Pattern extraction date:** 2026-06-05T09:15:00Z
**Branch context:** `feat/phase-03.4-org-auto-assign-compact-nav` (active branch at time of mapping)
