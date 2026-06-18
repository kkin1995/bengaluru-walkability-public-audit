---
phase: 05-uat-stabilisation
reviewed: 2026-06-05T12:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - backend/migrations/015_rename_location_source.sql
  - backend/Cargo.toml
  - backend/Cargo.lock
  - backend/src/handlers/reports.rs
  - backend/src/db/queries.rs
  - backend/src/db/admin_queries.rs
  - backend/src/models/admin.rs
  - backend/src/models/report.rs
  - frontend/app/reports/[id]/page.tsx
  - frontend/app/report/page.tsx
  - frontend/app/map/page.tsx
  - frontend/next.config.mjs
  - frontend/app/components/LocationMap.tsx
  - frontend/app/components/ReportsMap.tsx
  - frontend/app/components/redesign/SuccessCard.tsx
  - frontend/app/components/ReportCTA.tsx
  - frontend/app/lib/photo-store.ts
  - frontend/app/admin/reports/[id]/page.tsx
  - frontend/app/lib/translations.ts
  - frontend/app/admin/lib/adminApi.ts
  - frontend/app/admin/page.tsx
  - frontend/app/lib/config.ts
  - frontend/app/admin/login/page.tsx
  - nginx/nginx.conf
findings:
  critical: 4
  warning: 9
  info: 5
  total: 18
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-05T12:00:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 05 (UAT stabilisation) addressed 13 confirmed UAT bugs from live iPhone field testing. The backend migration, orientation baking, public-history dual-filter, and canonical location_source rename are all structurally correct. The adversarial pass found four blockers and nine warnings.

The most serious issues: (1) The honeypot `<input type="hidden">` is never filled by bots and the `querySelector` that reads its value cannot distinguish it from other hidden fields in the same DOM tree — bot detection silently never fires. (2) Unvalidated `location_source` strings from the multipart form are written directly to a PostgreSQL enum column, producing unhandled 500 errors on any unrecognised value from stale or malicious clients. (3) The `photo-store.ts` blob URL created in `ReportCTA` is never revoked on overwrite, leaking memory on repeated use. (4) The admin CSP block is missing `connect-src` for OSM tiles, causing the FIX-05 Leaflet map to silently fail on iOS Safari in the admin panel.

---

## Critical Issues

### CR-01: Honeypot field is `type="hidden"` — bots never fill it and the `querySelector` is broken

**File:** `frontend/app/report/page.tsx:557, 752, 1224` (honeypot inputs) and `frontend/app/report/page.tsx:379-382` (reader)

**Issue:** All three step branches render the honeypot as:
```tsx
<input type="hidden" data-hp="1" />
```
The form handler reads it as:
```ts
const honeypotEl = document.querySelector('input[data-hp="1"]') as HTMLInputElement | null;
body.append("website", honeypotEl?.value ?? "");
```
Two compounding defects:

1. A `type="hidden"` input is invisible to bots that target fillable form fields. Bots specifically skip hidden inputs. The honeypot provides zero signal against automated submissions.

2. When multiple steps are rendered in the same React tree, there are multiple elements matching `[data-hp="1"]` in the DOM simultaneously. `querySelector` returns the first match — not necessarily the one in the active step — and `type="hidden"` inputs have `value` of `""` by definition, meaning the appended value is always `""` regardless.

The backend's `is_honeypot_triggered` check therefore never fires for any real submission.

**Fix:** Change to a visually hidden but technically visible text input:
```tsx
{/* ABUSE-02 honeypot — type="text" so bots fill it; visually hidden via absolute positioning */}
<input
  type="text"
  name="website"
  data-hp="1"
  aria-hidden="true"
  tabIndex={-1}
  autoComplete="off"
  style={{ opacity: 0, position: "absolute", left: "-9999px", width: 1, height: 1 }}
/>
```
Place exactly one instance per rendered step (not three), and keep the `querySelector` reader as-is once there is only one matching element per DOM state.

---

### CR-02: Unvalidated `location_source` written directly to a PostgreSQL enum column — produces unhandled 500 on any unrecognised value

**File:** `backend/src/handlers/reports.rs:177-182` and `backend/src/handlers/reports.rs:215-217`

**Issue:**
```rust
"location_source" => {
    req.location_source = field.text().await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
}
```
The only guard is:
```rust
if req.location_source.is_empty() {
    req.location_source = "GPS_API".to_string();
}
```
This guard is bypassed whenever the field is non-empty. The value is then forwarded as `$9::location_source` to the INSERT. PostgreSQL raises `invalid input value for enum location_source` for any string not in the enum type, which becomes a 500 error (`AppError::Database`) rather than a 400 `BadRequest`.

Affected scenarios: a stale iOS client (pre-FIX-13) sending `"exif"` or `"manual_pin"` (which still exist in the DB enum but may be removed in a future migration); any automated client; any frontend bug during a deploy window.

**Fix:**
```rust
"location_source" => {
    let raw = field.text().await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    req.location_source = match raw.as_str() {
        "GPS_API" | "EXIF_GPS" | "MANUAL_ADJUST" => raw,
        // Accept legacy enum values from pre-015 clients
        "exif" | "manual_pin" => raw,
        // Unknown value: default to canonical GPS_API rather than a 500
        _ => "GPS_API".to_string(),
    };
}
```
Remove the subsequent `is_empty` check or retain it only as a defensive fallback after this whitelist.

---

### CR-03: `photo-store.ts` leaks blob URLs on repeated use and is not SSR-safe

**File:** `frontend/app/lib/photo-store.ts:21-28`

**Issue:**
```ts
export function storePendingPhoto(p: PendingPhoto): void {
  window.__pendingPhoto = p;
}
```
`ReportCTA.tsx` calls `URL.createObjectURL(file)` and stores the result in `p.previewUrl`. When a user picks a photo, then goes back and picks a different photo, `storePendingPhoto` is called a second time. The previous `previewUrl` blob URL is silently overwritten in `window.__pendingPhoto` and never revoked. On low-memory devices (the target iOS audience), unreleased blob URLs accumulate and degrade performance.

Additionally, neither `storePendingPhoto` nor `consumePendingPhoto` guards against being called in a server context. The module comment says "Browser-only — NOT SSR-safe" but provides no guard. If any server component or Next.js middleware ever imports a file that transitively imports `photo-store.ts`, the call `window.__pendingPhoto` will throw `ReferenceError: window is not defined` at SSR time.

**Fix:**
```ts
export function storePendingPhoto(p: PendingPhoto): void {
  if (typeof window === "undefined") return;
  // Revoke the previous preview URL to prevent blob URL accumulation
  const prev = window.__pendingPhoto;
  if (prev?.previewUrl) {
    try { URL.revokeObjectURL(prev.previewUrl); } catch { /* ignore */ }
  }
  window.__pendingPhoto = p;
}

export function consumePendingPhoto(): PendingPhoto | null {
  if (typeof window === "undefined") return null;
  const p = window.__pendingPhoto ?? null;
  window.__pendingPhoto = null;
  return p;
}
```

---

### CR-04: Admin CSP block missing `connect-src` for OSM tiles — FIX-05 Leaflet map silently fails on iOS Safari in admin panel

**File:** `nginx/nginx.conf:198`

**Issue:** FIX-05 added a real read-only Leaflet map to the admin report detail page (`frontend/app/admin/reports/[id]/page.tsx`). On iOS Safari, Leaflet fetches tile images via XMLHttpRequest (not `<img>` tags), which is governed by `connect-src`. The admin `location /admin` CSP block at line 198 has:
```nginx
connect-src 'self';
```
The public `location /` block (line 220) correctly adds `https://*.tile.openstreetmap.org`. The admin block does not. The admin map will render with blank tiles on iOS Safari — the same symptom FIX-04 fixed for public pages — but the admin block was not updated.

**Fix:**
```nginx
# In location /admin, update the add_header Content-Security-Policy line:
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org; connect-src 'self' https://*.tile.openstreetmap.org;" always;
```

---

## Warnings

### WR-01: CSP `connect-src` in public block missing Nominatim — BUG-4 nearby road feature is blocked on strict browsers

**File:** `nginx/nginx.conf:220`

**Issue:** `frontend/app/report/page.tsx` makes a fetch to `https://nominatim.openstreetmap.org/reverse?...` (lines 204-224) as part of BUG-4's nearby road feature. The public `location /` CSP has:
```nginx
connect-src 'self' https://*.tile.openstreetmap.org;
```
`nominatim.openstreetmap.org` does not match `*.tile.openstreetmap.org` — the wildcard only applies to the `tile` subdomain. On browsers that strictly enforce CSP (Chrome 60+, Safari 15.4+), the Nominatim fetch is blocked with a CSP violation, `nearRoad` stays `null`, and the "Near …" display on the confirm step never populates. The feature was implemented but is silently blocked in production.

**Fix:**
```nginx
connect-src 'self' https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org;
```

---

### WR-02: `SuccessCard` shares the homepage URL on "Share", not the specific report URL

**File:** `frontend/app/components/redesign/SuccessCard.tsx:31-43`

**Issue:**
```ts
async function handleShare() {
  const url = typeof window !== "undefined" ? window.location.origin : "";
  ...
  await (nav as Navigator).share({ title: "Bengaluru Walkability Audit", url });
```
`window.location.origin` is the root domain (e.g. `https://nammadaari.com`), not the specific report page. The `reportId` prop is available and the public report URL is `/reports/${reportId}`. A citizen who taps "Share" after submitting shares a link to the homepage, not to their specific report — defeating the purpose of sharing.

**Fix:**
```ts
const url = reportId
  ? `${window.location.origin}/reports/${reportId}`
  : window.location.origin;
```

---

### WR-03: `statusActionLabel` in `admin/page.tsx` maps the renamed `under_review` status — all `acknowledged`, `assigned`, `in_progress` reports show as "New"

**File:** `frontend/app/admin/page.tsx:23-27`

**Issue:**
```ts
function statusActionLabel(status: string): string {
  if (status === "resolved") return "Resolved";
  if (status === "under_review") return "Under review";
  return "New";
}
```
`under_review` was renamed to `acknowledged` in migration 008 and is explicitly called out in `models/admin.rs` as an invalid value. The live database will never return `under_review`. The function's second branch is dead code. More critically, reports with status `acknowledged`, `assigned`, or `in_progress` all fall through to "New" — displaying incorrect labels in the activity feed.

**Fix:**
```ts
function statusActionLabel(status: string): string {
  if (status === "resolved" || status === "closed") return "Resolved";
  if (status === "in_progress" || status === "assigned" || status === "acknowledged") return "In progress";
  return "New"; // open + unknown
}
```

---

### WR-04: Migration 015 UPDATE statements run outside a transaction — partial migration possible on failure

**File:** `backend/migrations/015_rename_location_source.sql:22-31`

**Issue:** The `-- sqlx:noTransaction` pragma is required for the `ALTER TYPE ... ADD VALUE` statements, which PostgreSQL does not allow inside a transaction block. However, the subsequent `UPDATE` statements that migrate existing rows also run outside the transaction:
```sql
UPDATE reports SET location_source = 'GPS_API' WHERE location_source::TEXT = 'manual_pin';
UPDATE reports SET location_source = 'EXIF_GPS' WHERE location_source::TEXT = 'exif';
```
If the first `UPDATE` succeeds and the second fails (disk full, connection loss, OOM kill), the migration leaves the DB in a partially migrated state. The `_sqlx_migrations` table entry may or may not have been written depending on exactly when the failure occurred. On the next startup, SQLx may skip the migration (if the entry was committed) or retry it (if not). The `IF NOT EXISTS` guards on the `ALTER TYPE` make re-running idempotent for those statements, and both `UPDATE` predicates are idempotent (`manual_pin → GPS_API` on rows already updated is a no-op). The practical risk is low but the migration is not atomic.

**Fix (documentation):** Add a comment explicitly acknowledging this. Alternatively, for new deployments, split into a `noTransaction` migration for the `ALTER TYPE` statements and a normal transactional migration for the `UPDATE` statements.

---

### WR-05: `compressImage` is duplicated verbatim in `ReportCTA.tsx` and `report/page.tsx`

**File:** `frontend/app/components/ReportCTA.tsx:12-36` and `frontend/app/report/page.tsx:82-106`

**Issue:** The entire `compressImage` function is copy-pasted between both files, including the `MAX_BYTES` constant and the quality ladder `[0.85, 0.75, 0.65, 0.55, 0.45, 0.4]`. Two copies of EXIF extraction logic also exist (lines 61-89 in `ReportCTA.tsx` and lines 267-290 in `report/page.tsx`). If the quality ladder or size limit is changed in one file, the other silently drifts.

**Fix:** Extract `compressImage`, `MAX_BYTES`, and the EXIF extraction pattern into `frontend/app/lib/image-utils.ts` and import from both call sites.

---

### WR-06: `ReportsMap` `fetchReports` callback depends on `onReportsLoaded` — latent infinite-loop risk

**File:** `frontend/app/components/ReportsMap.tsx:82-130`

**Issue:**
```ts
const fetchReports = useCallback(async () => { ... }, [apiUrl, onReportsLoaded]);
```
`onReportsLoaded` is currently passed as `setAllReports` (a stable React state setter). This is safe today. However, if any future caller passes an inline callback (e.g. `(reports) => setAllReports(reports)`), the unstable reference causes `fetchReports` to be recreated every render, which triggers the `useEffect([fetchReports])`, which calls `fetchReports`, which triggers another render — an infinite loop that saturates the API with requests.

**Fix:** Remove `onReportsLoaded` from the `useCallback` dependency array and use a stable ref pattern:
```ts
const onLoadedRef = useRef(onReportsLoaded);
useEffect(() => { onLoadedRef.current = onReportsLoaded; }, [onReportsLoaded]);
const fetchReports = useCallback(async () => {
  // ...
  onLoadedRef.current?.(items);
}, [apiUrl]); // onReportsLoaded removed from deps
```

---

### WR-07: Nominatim `User-Agent` is hardcoded to staging domain

**File:** `frontend/app/report/page.tsx:208-210`

**Issue:**
```ts
headers: {
  "User-Agent": "Walkable BLR (staging-walkability.kinariwala.com)",
},
```
Nominatim's Terms of Service require a valid contact URL or email. The hardcoded value is a personal staging subdomain (`kinariwala.com`). In production, this misidentifies the service, may cause Nominatim to rate-limit or block requests, and exposes a personal domain in HTTP headers to an external service. The value should reflect the production domain.

**Fix:** Derive from a config constant:
```ts
// frontend/app/lib/config.ts — add:
export const NOMINATIM_USER_AGENT =
  `Nammadaari Walkability Audit (${process.env.NEXT_PUBLIC_SITE_URL ?? "nammadaari.com"})`;

// frontend/app/report/page.tsx — use:
"User-Agent": NOMINATIM_USER_AGENT,
```

---

### WR-08: `list_admin_reports_with_org_id_includes_recursive_cte` test validates a different SQL structure than production code uses

**File:** `backend/src/db/admin_queries.rs:2008-2044`

**Issue:** The test constructs the `org_clause` as an inline subquery CTE:
```rust
format!(
    " AND reports.ward_id IN (\
        WITH RECURSIVE org_subtree AS (\
            SELECT id FROM organizations WHERE id = ${}\
            UNION ALL\
            SELECT o.id FROM organizations o\
              JOIN org_subtree s ON o.parent_id = s.id\
        )\
        SELECT w.id FROM wards w\
          JOIN org_subtree s ON w.org_id = s.id\
    )",
    param_idx
)
```
However, the production `list_admin_reports` function constructs the CTE as a **top-level** prefix (`WITH RECURSIVE org_subtree AS (...) SELECT ...` before the main SELECT). Inline CTEs inside `IN(...)` subqueries are explicitly noted as non-standard and rejected by PostgreSQL < 12 — and the production code was deliberately written to use a top-level CTE (see comments at lines 247-248 and 333-334: "WR-01: use a top-level CTE so the query is compatible with PostgreSQL 11"). The test asserts on a SQL pattern that the live query never produces and that would be rejected by the DB on older PostgreSQL.

**Fix:** Rewrite the test to use `build_report_where_clause` and construct the SQL the same way `list_admin_reports` does (top-level CTE prefix), or expose a helper that returns the actual built SQL fragment.

---

### WR-09: `photo-store.ts` `File` object survives navigation only in the same browser tab — lost on hard reload or cross-tab share

**File:** `frontend/app/lib/photo-store.ts`

**Issue:** `window.__pendingPhoto` is a plain JavaScript property. It is shared across React's soft navigation (App Router `router.push`) within the same tab, which is the intended path. However:
- A hard reload (e.g. the user taps reload by mistake on the category step) loses the entire `window` state. The user is redirected back to the `"photo"` step (because `consumePendingPhoto()` returns `null`), but their photo is lost with no feedback.
- On iOS, if the browser suspends and restores the tab (page lifecycle API), `window` properties are preserved. However, if the browser discards the tab (rare but possible under memory pressure), the `File` object is lost.

Neither case is a crash — the UI falls back to the photo step correctly — but the UX regression (silent photo loss) is a step backward from a hypothetical `sessionStorage` or `IndexedDB` approach.

**Fix (recommended):** Document the limitation explicitly in the photo-store module header. For production hardening, consider persisting the `previewUrl` (object URL) in `sessionStorage` as a fallback display while the actual `File` object is held in memory.

---

## Info

### IN-01: `BUILD_HASH` default `"0000000"` is indistinguishable from a failed CI injection

**File:** `frontend/app/lib/config.ts:26`

**Issue:** `export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? "0000000"`. The default `"0000000"` is visually identical to a failed build-hash injection. An operator cannot tell from the login page footer whether CI is wiring `NEXT_PUBLIC_BUILD_HASH` correctly or defaulting silently.

**Fix:**
```ts
export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? "dev-build";
```
`"dev-build"` is visually distinct from a 7-character hex SHA and signals that the env var was absent.

---

### IN-02: `admin/page.tsx` recomputes `dayCount` identically in `.catch()` handler

**File:** `frontend/app/admin/page.tsx:78` and `101`

**Issue:**
```ts
const dayCount = activePeriod === "7D" ? 7 : activePeriod === "30D" ? 30 : 14;
// ...
.catch(() => {
  const dayCount2 = activePeriod === "7D" ? 7 : activePeriod === "30D" ? 30 : 14;
  setIntakeData(Array(dayCount2).fill(0) as number[]);
});
```
`dayCount2` is an identical re-derivation of `dayCount`. Since the `.catch()` callback is a closure, `dayCount` from the outer scope is accessible.

**Fix:**
```ts
.catch(() => { setIntakeData(Array(dayCount).fill(0) as number[]); });
```

---

### IN-03: `next.config.mjs` reads `package.json` synchronously at module load time with no error boundary

**File:** `frontend/next.config.mjs:2-8`

**Issue:**
```js
const { version } = JSON.parse(
  readFileSync(join(__dirname, "package.json"), "utf8")
);
```
This throws an unhandled exception if `package.json` is absent (e.g. in a Docker layer that strips source files). The build fails with no descriptive error message.

**Fix:**
```js
let version = "0.0.0";
try {
  version = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")).version ?? "0.0.0";
} catch { /* package.json absent — use default version */ }
```

---

### IN-04: `getLocationSourceLabel` fallback exposes raw DB enum values to admin users on unrecognised strings

**File:** `frontend/app/lib/translations.ts:61-63`

**Issue:**
```ts
export function getLocationSourceLabel(value: string): { en: string; kn: string } {
  return LOCATION_SOURCE_LABEL_MAP[value] ?? { en: value, kn: value };
}
```
For any string not in `LOCATION_SOURCE_LABEL_MAP`, the raw DB enum value is displayed. If a future migration adds a new `location_source` value before the frontend ships a label for it, the admin sees machine strings like `"MANUAL_ADJUST_V2"`. This matches the pattern used by `getCategoryLabel`, so it is consistent, but it is worth flagging for ops awareness.

**Fix (optional):**
```ts
return LOCATION_SOURCE_LABEL_MAP[value] ?? { en: `Unknown source (${value})`, kn: `Unknown source (${value})` };
```

---

### IN-05: Migration comment at line 14 incorrectly states PG < 12 as the exclusive reason for `noTransaction`

**File:** `backend/migrations/015_rename_location_source.sql:14-17`

**Issue:** The comment reads:
> Non-transactional: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in PostgreSQL < 12.

In fact, `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block in **any** PostgreSQL version. PostgreSQL 12 changed the visibility semantics (the new value becomes visible in the same transaction), but the restriction on running inside a transaction was never lifted. The comment's reasoning is partially incorrect. The conclusion (use `noTransaction`) is correct.

**Fix (documentation only):**
```sql
-- Non-transactional: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- This applies to all PostgreSQL versions. PostgreSQL 12+ made new values visible
-- within the same transaction, but the requirement to run outside a transaction remains.
```

---

_Reviewed: 2026-06-05T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
