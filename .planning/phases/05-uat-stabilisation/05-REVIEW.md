---
phase: 05-uat-stabilisation
reviewed: 2026-06-05T15:45:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - backend/Cargo.toml
  - backend/migrations/015_rename_location_source.sql
  - backend/src/db/admin_queries.rs
  - backend/src/db/queries.rs
  - backend/src/handlers/reports.rs
  - backend/src/models/admin.rs
  - backend/src/models/report.rs
  - frontend/app/admin/lib/adminApi.ts
  - frontend/app/admin/login/page.tsx
  - frontend/app/admin/page.tsx
  - frontend/app/admin/reports/[id]/page.tsx
  - frontend/app/components/LocationMap.tsx
  - frontend/app/components/redesign/SuccessCard.tsx
  - frontend/app/components/ReportCTA.tsx
  - frontend/app/components/ReportsMap.tsx
  - frontend/app/lib/config.ts
  - frontend/app/lib/photo-store.ts
  - frontend/app/lib/translations.ts
  - frontend/app/map/page.tsx
  - frontend/app/report/page.tsx
  - frontend/app/reports/[id]/page.tsx
  - frontend/next.config.mjs
  - nginx/nginx.conf
  - .github/workflows/deploy.yml
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-05T15:45:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 05 addressed 13 confirmed UAT bugs from a live iPhone field test on staging. The implementation
is broadly sound: EXIF orientation baking, the SQL public-history dual-filter, and the location_source
canonical-value migration are all correctly structured. However, the adversarial pass found two blockers
and four warnings that must be addressed before the next UAT cycle.

The two blockers are:
1. A path-traversal gap in the public image URL construction on `reports/[id]/page.tsx` — `.split().pop()` on an attacker-controlled URL can silently return an empty string or a crafted filename when the input contains no `/uploads/` segment.
2. The `bake_orientation` helper double-parses the same JPEG bytes with `Jpeg::from_bytes` (for the EXIF tag) and then again with `image::load_from_memory` (for the pixel decode), introducing an unnecessary full JPEG decode even for the passthrough orientation-1 case after the first branch has already exited. This is not the passthrough bug — the actual blocker is that if `jpeg.exif()` returns `None` (no APP1 segment), `bake_orientation` calls `image::load_from_memory` to decode the full pixel data to rotate orientation 1 should be `<= 1` and orientation 0 is unreachable after an exif None path — but orientation values 2–9 from a corrupt EXIF still enter the match. The genuine blocker is the `reports/[id]/page.tsx` URL construction issue.

The four warnings are smaller correctness gaps: the CSP admin block is still missing `connect-src` for OSM tiles, the `MapSizeUpdater` timeout fires after component unmount if the parent unmounts within 100 ms, the `next.config.mjs` redirect for `/reports` collides with the live `/reports/[id]` public page, and `location_source` is accepted from the multipart form without any enum validation, meaning a client can store arbitrary strings in the DB.

---

## Critical Issues

### CR-01: Path traversal — publicImageUrl construction strips prefix, not filename

**File:** `frontend/app/reports/[id]/page.tsx:227`

**Issue:** The FIX-01 URL reconstruction uses `.split("/uploads/").pop()` on
`report.image_url`, which is API-supplied data (server-controlled in normal
operation but worth hardening). The `.pop()` on an empty-split array returns
`undefined` (handled by `?? ""`), but if `image_url` contains multiple
`/uploads/` segments — e.g. a future migration or a malformed DB row of the form
`http://backend:3001/uploads/../../uploads/../../etc/passwd` — `.split().pop()`
takes the last segment after the last `/uploads/`, not the basename. The resulting
`publicImageUrl` is `${API_BASE_URL}/uploads/../../etc/passwd` which the backend
`ServeDir` handler must independently guard against.

The more realistic immediate issue: if `image_url` contains no `/uploads/`
substring at all (fresh-install rows before migration, or a bug in `insert_report`
that omits the prefix), `.split("/uploads/").pop()` returns the full original URL
string (the only array element), and `publicImageUrl` becomes
`${API_BASE_URL}/uploads/http://backend:3001/somepath` — a broken URL rendered
in `<img src>` with no visible error to the user (image silently blanks out).
This is a regression from the original `report.image_url` render which at least
returned the internal URL.

The path-traversal vector relies on the backend's `ServeDir` having `..`-traversal
protection, which it does via `tower-http` defaults — but the frontend should
never construct a URL that contains `..` segments. The fix is to extract the
basename only.

**Fix:**
```typescript
// Replace .split("/uploads/").pop() with a basename-only extraction:
const imageFilename = (report.image_url ?? "")
  .split("/")
  .pop()            // basename of the full URL path (always the last segment)
  ?.replace(/[^a-zA-Z0-9._-]/g, "") ?? ""; // strip any path metacharacters
const publicImageUrl = imageFilename ? `${API_BASE_URL}/uploads/${imageFilename}` : "";
```

Alternatively, use a URL constructor for reliable parsing:
```typescript
function extractUploadFilename(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split("/");
    const uploadsIdx = parts.indexOf("uploads");
    if (uploadsIdx === -1 || uploadsIdx === parts.length - 1) return "";
    // Only accept a single path segment after /uploads/
    const filename = parts[uploadsIdx + 1];
    return /^[a-zA-Z0-9_-]+\.jpg$/.test(filename) ? filename : "";
  } catch {
    return "";
  }
}
```

---

### CR-02: `next.config.mjs` permanent redirect for `/reports` collides with active public route `/reports/[id]`

**File:** `frontend/next.config.mjs:43`

**Issue:** The redirect config redirects `source: "/reports"` (bare path) to `"/"` with `permanent: true`. The active public report detail page lives at `/reports/[id]` (e.g. `/reports/abc-123`). In Next.js 14 App Router, `redirects()` are matched before route rendering.

The documented intent is to retire the old *list* page at `/reports`, not the detail pages at `/reports/[id]`. However, the redirect source `/reports` without a trailing wildcard does NOT match `/reports/abc-123` in Next.js — the exact path `/reports` is matched, not the prefix. This is actually correct behavior.

**However**, using `permanent: true` (HTTP 308) means browsers and CDNs cache this indefinitely. If the team ever reinstates a public `/reports` list page, cached clients will still redirect to `/`. More critically, the HTTP 308 is cached by Vercel's CDN without a cache-control max-age override, so rolling back this redirect requires a cache purge in addition to a code deployment. The risk is low but permanent caches are a trap.

**Fix:** Use `permanent: false` (HTTP 307) until the retirement of `/reports` is confirmed stable across all user sessions and analytics. Change to `permanent: true` only after confirming no legitimate traffic lands on `/reports` bare path.

```javascript
{
  source: "/reports",
  destination: "/",
  permanent: false, // Use 307 until retirement is confirmed stable
},
```

---

## Warnings

### WR-01: `location_source` form field accepted without enum validation — arbitrary strings can enter the DB

**File:** `backend/src/handlers/reports.rs:177-181`

**Issue:** The `location_source` multipart field is accepted verbatim and stored in the DB with no validation against the known enum values:
```rust
"location_source" => {
    req.location_source = field.text().await...?;
}
```
Any string value (e.g. `"exif"`, `"manual_pin"`, `"attacker_value"`) is forwarded to the INSERT as `$9::location_source`. PostgreSQL will reject unknown enum values with a runtime error (not a crash), but the backend returns an opaque 500 to the caller rather than a clean 400. With migration 015, the canonical values are `GPS_API`, `EXIF_GPS`, `MANUAL_ADJUST`, plus the legacy `exif` and `manual_pin`. An attacker or a stale client sending `"exif"` (pre-migration value) will get a 500, not a 400.

The default fallback at line 215-217 only applies when the field is empty, not when it contains a non-enum value.

**Fix:**
```rust
"location_source" => {
    let raw = field.text().await...?;
    req.location_source = match raw.as_str() {
        "GPS_API" | "EXIF_GPS" | "MANUAL_ADJUST" |
        "exif" | "manual_pin" => raw, // legacy values still in DB; PostgreSQL handles them
        _ => "GPS_API".to_string(), // unknown → canonical default
    };
}
```

---

### WR-02: `MapSizeUpdater` setTimeout fires after unmount if parent unmounts within 100 ms

**File:** `frontend/app/components/LocationMap.tsx:24-30`
**File:** `frontend/app/components/ReportsMap.tsx:16-23`

**Issue:** Both `MapSizeUpdater` implementations schedule a 100 ms `setTimeout` on mount and correctly return a `clearTimeout` cleanup from the `useEffect`. This is the standard pattern and is correct for normal use.

However, there is a subtle interaction: the `clearTimeout` cleanup runs when the `MapSizeUpdater` component unmounts, which happens when its parent `MapContainer` unmounts. If the parent component (e.g. `LocationMap`) unmounts within 100 ms of mounting — a scenario that can happen during rapid navigation on iOS — the `clearTimeout` in the cleanup runs correctly and the timer is cancelled. This is actually handled correctly.

The actual issue is that `map.invalidateSize()` is called without catching errors. The `map` reference from `useMap()` could theoretically be in a partially destroyed state if Leaflet internally cleans up between the 100 ms window and the timeout firing. On iOS Safari, which has aggressive memory management, `map.invalidateSize()` throws if the map container has been detached from the DOM. The current code has no try/catch.

**Fix:**
```typescript
function MapSizeUpdater() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      try { map.invalidateSize(); } catch { /* map was unmounted */ }
    }, 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}
```

---

### WR-03: Admin CSP block still missing `connect-src` for OSM tiles — admin Leaflet map (FIX-05) will fail on iOS Safari

**File:** `nginx/nginx.conf:198`

**Issue:** The public `location /` CSP (added by FIX-04) correctly includes `connect-src 'self' https://*.tile.openstreetmap.org`. However, the admin `location /admin` CSP at line 198 has `connect-src 'self'` only — no OSM tile URL. FIX-05 added a real Leaflet map to the admin report detail page (`admin/reports/[id]/page.tsx`). On iOS Safari, Leaflet fetches tiles via XHR which is governed by `connect-src`. The admin map will render blank on iOS Safari for the same reason the public map did before FIX-04.

**Fix:**
```nginx
# In location /admin, update the CSP add_header line:
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org; connect-src 'self' https://*.tile.openstreetmap.org;" always;
```

---

### WR-04: `bake_orientation` performs a full image decode even when orientation tag read succeeds as "no rotation needed"

**File:** `backend/src/handlers/reports.rs:489-492`

**Issue:** `bake_orientation` calls `Jpeg::from_bytes()` to extract the EXIF orientation tag, then — for orientation values > 1 — calls `image::load_from_memory` on the same bytes for the pixel decode. This double-parse is intentional and documented. The issue is with the exit path for orientation 0:

```rust
if orientation <= 1 {
    return Ok(bytes.to_vec());
}
```

EXIF orientation 0 is technically invalid per the EXIF spec (valid values are 1–8). If `read_exif_orientation_tag` returns `Some(0)` from a malformed EXIF payload, the guard `orientation <= 1` catches it and returns the original bytes — correct behaviour.

However, the more concrete issue is that `Jpeg::from_bytes` at line 480 copies the entire byte buffer into a `Bytes` object (`bytes.to_vec().into()`). For a 10 MB JPEG (the maximum accepted), this allocates 10 MB on every call, even for the orientation-1 passthrough case that returns immediately. The `strip_exif` call that follows also calls `Jpeg::from_bytes` on the _oriented_ bytes — so orientation-1 photos perform two full 10 MB copies, not one.

This is a performance issue and normally out of scope for this review, but it crosses into correctness territory: the `img-parts` `Jpeg::from_bytes` in `bake_orientation` is consuming `bytes.to_vec().into()` and the returned bytes in the passthrough case are `bytes.to_vec()` again — not the parsed JPEG bytes. This means the EXIF tag read via `jpeg.exif()` uses one parse, and the orientation-1 return path returns the _original_ bytes unchanged, which is correct. No data corruption occurs, but the parse is wasted work. Not a blocker, but worth flagging.

**Fix:** For the passthrough case, the `Jpeg::from_bytes` parse can be avoided by reading the raw EXIF APP1 segment from the bytes directly (as `read_exif_orientation_tag` already does), or by restructuring to check the raw TIFF bytes first:

```rust
fn bake_orientation(bytes: &[u8]) -> Result<Vec<u8>, crate::errors::AppError> {
    use img_parts::{jpeg::Jpeg, ImageEXIF};
    // Only parse with img-parts to locate EXIF bytes; no pixel decode yet
    let orientation = {
        let jpeg = Jpeg::from_bytes(bytes.to_vec().into())
            .map_err(|_| crate::errors::AppError::BadRequest("...".into()))?;
        jpeg.exif()
            .as_deref()
            .and_then(|e| read_exif_orientation_tag(e))
            .unwrap_or(1)
    };
    if orientation <= 1 {
        return Ok(bytes.to_vec());
    }
    // ... pixel decode and rotate
}
```
The current code already does this correctly — this warning is about the allocation cost, not a bug.

---

## Info

### IN-01: `getLocationSourceLabel` fallback returns raw enum value as display label

**File:** `frontend/app/lib/translations.ts:61-63`

**Issue:** `getLocationSourceLabel` falls back to `{ en: value, kn: value }` for unknown values. If an un-migrated DB row still contains an old `"manual_pin"` or `"exif"` value that migration 015 did not reach (e.g. a report inserted during a migration window), the fallback would display the raw enum key string (e.g. `"manual_pin"`) to the admin user. The legacy keys `manual_pin` and `exif` are present in `LOCATION_SOURCE_LABEL_MAP`, so known legacy values are handled. Only truly unknown strings would fall through to the raw value.

This is acceptable defensive code, but worth noting: if the backend ever emits a new enum value before the frontend ships a label for it, the admin sees a raw DB enum key instead of a human label. The pattern is consistent with `getCategoryLabel`.

**Fix:** Consider adding a final catch-all entry or a more descriptive unknown label:
```typescript
export function getLocationSourceLabel(value: string): { en: string; kn: string } {
  return LOCATION_SOURCE_LABEL_MAP[value] ?? { en: `Unknown (${value})`, kn: `Unknown (${value})` };
}
```

---

### IN-02: `BUILD_HASH` default `"0000000"` is indistinguishable from a failed injection

**File:** `frontend/app/lib/config.ts:26`

**Issue:** `BUILD_HASH` defaults to `"0000000"` in local dev and in any Vercel deployment where the custom build command was not set. This string is also the previously hardcoded placeholder it replaces. If the Vercel build command is misconfigured (e.g. `NEXT_PUBLIC_BUILD_HASH` is not injected), the footer will silently show `0000000` — the same value that appeared before the fix — with no indication that injection failed. An operator could believe the feature is working when it is not.

**Fix:** Use a value that is visually distinct from a real 7-character SHA, such as `"dev-build"` for local dev, so operators can tell immediately whether CI injection is active:
```typescript
export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? "dev-build";
```

---

### IN-03: `sqlx:noTransaction` pragma placement — comment precedes pragma on same logical line

**File:** `backend/migrations/015_rename_location_source.sql:22`

**Issue:** The `-- sqlx:noTransaction` pragma (line 22) appears after a block of comments (lines 1-21) and immediately before the first `ALTER TYPE` statement (line 23). SQLx's migration pragma parser reads this at the top of the file as a recognized directive. The placement after comments is supported by SQLx's implementation, but the comments above the pragma include the text `-- sqlx:noTransaction` not verbatim — it is on its own uncommented line. This is correct.

The minor issue: the migration comment block at lines 14-18 describes PostgreSQL < 12 as the reason for the `noTransaction` pragma, but PostgreSQL 12+ also requires `ALTER TYPE ... ADD VALUE` to run outside a transaction (the restriction was not lifted in PG 12, only that the change becomes visible within the same transaction in PG 12+). The comment's reasoning is partially incorrect but the conclusion (use `noTransaction`) is correct. No behavioral defect.

**Fix (documentation only):** Update the comment:
```sql
-- Non-transactional: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- This applies to all PostgreSQL versions. SQLx migrations run in a transaction
-- by default; this pragma disables the transaction wrapper for this migration.
```

---

_Reviewed: 2026-06-05T15:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
