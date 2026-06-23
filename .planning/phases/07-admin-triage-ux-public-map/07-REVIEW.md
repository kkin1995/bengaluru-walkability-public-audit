---
phase: "07"
reviewed: 2026-06-23T10:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - backend/src/models/admin.rs
  - backend/src/db/admin_queries.rs
  - backend/src/handlers/admin.rs
  - backend/src/main.rs
  - backend/src/handlers/wards.rs
  - frontend/app/admin/lib/adminApi.ts
  - nginx/nginx.conf
  - nginx/nginx.server.conf
  - backend/src/handlers/reports.rs
  - frontend/app/admin/reports/page.tsx
  - frontend/app/map/page.tsx
  - frontend/app/components/ReportsMap.tsx
  - frontend/app/lib/config.ts
  - frontend/app/reports/[id]/page.tsx
  - frontend/app/admin/admin.css
  - frontend/app/admin/page.tsx
  - frontend/app/admin/reports/map/page.tsx
  - frontend/app/admin/analytics/page.tsx
  - frontend/app/admin/analytics/ChoroplethMap.tsx
  - frontend/app/admin/components/TrendChart.tsx
findings:
  critical: 3
  warning: 7
  info: 5
  total: 15
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-06-23T10:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 07 added the admin triage filter bar (corp/ward dropdowns), public ward boundary overlay, status filter chips on the public map, and before/after resolution photos on the public report detail page. The Rust backend additions are structurally sound: all SQL parameters are bound via `$N` placeholders (no interpolation), the public/admin endpoint split is clean, and the JPEG EXIF stripping and path-traversal guards are applied correctly.

Three critical bugs were found:

1. The admin reports map page (`admin/reports/map/page.tsx`) was not updated for the Phase 03 status rename. It uses the old "submitted"/"under_review" strings throughout — pin color functions, filter options, and chip logic all reference values that no longer exist in the database. Every pin renders gray and every filter returns no results.

2. The public map's `statusMatch` function (both `map/page.tsx` and `ReportsMap.tsx`) places "acknowledged" and "assigned" in two overlapping buckets, causing those statuses to match both the "open" chip and the "in_progress" chip simultaneously. Status filtering is logically inconsistent.

3. The public report detail page (`reports/[id]/page.tsx`) spreads `report.history` at line 421 without a null guard. If the backend omits or nullifies the `history` field for a report (possible on the public endpoint which may not include status_history), `[...undefined]` throws a TypeError, crashing the page with a 500 for that citizen.

---

## Critical Issues

### CR-01 — Admin map page uses pre-Phase-03 status values — all pins render gray, all filters return empty

**File:** `frontend/app/admin/reports/map/page.tsx:22-116`

**Issue:** `getPinColor`, `getStatusCssColor`, `STATUS_OPTIONS`, `STATUS_CHIP_OPTIONS`, and the `StatusFilter` type all reference "submitted" and "under_review" — vocabulary replaced by the six-value enum (open | acknowledged | assigned | in_progress | resolved | closed) in Phase 03. No report in the database has status "submitted" or "under_review". Every `getPinColor` call hits the `default` branch and returns gray `#6B7280`. Every filter by "Submitted" or "Under Review" returns an empty set. The `getStatusCssColor` function similarly falls through to `var(--status-submitted)` for all six real statuses.

**Fix:**
```typescript
function getPinColor(status: string): string {
  switch (status) {
    case "open":          return "#6B7280";
    case "acknowledged":
    case "assigned":
    case "in_progress":   return "#F59E0B";
    case "resolved":
    case "closed":        return "#22C55E";
    default:              return "#6B7280";
  }
}

function getStatusCssColor(status: string): string {
  switch (status) {
    case "open":          return "var(--status-open)";
    case "acknowledged":  return "var(--status-acknowledged)";
    case "assigned":      return "var(--status-assigned)";
    case "in_progress":   return "var(--status-in-progress)";
    case "resolved":      return "var(--status-resolved)";
    case "closed":        return "var(--status-closed)";
    default:              return "var(--status-open)";
  }
}

type StatusFilter = "" | "open" | "acknowledged" | "assigned" | "in_progress" | "resolved" | "closed";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];
```

---

### CR-02 — Public map status filter has overlapping buckets — "acknowledged"/"assigned" match both "Open" and "In progress" chips

**Files:**
- `frontend/app/map/page.tsx:36-45`
- `frontend/app/components/ReportsMap.tsx:210-219`

**Issue:** Both `statusMatch` (map/page.tsx) and `reportStatusMatch` (ReportsMap.tsx) define:
- "open" bucket → open | acknowledged | assigned
- "in_progress" bucket → acknowledged | assigned | in_progress

A report with status "acknowledged" or "assigned" satisfies both predicates simultaneously. Tapping "Open" and "In progress" shows the same set of reports. The chip-label counts computed by `statusCounts` (map/page.tsx line 62) do not share this overlap — they count acknowledged/assigned under `open` only — so the displayed counts disagree with the actually visible pins when "In progress" is selected.

**Fix:** Assign each status value to exactly one bucket. The spec comment says "In progress matches: acknowledged | assigned | in_progress" — adopt that and remove those from "open":

```typescript
// Fix statusMatch in map/page.tsx and reportStatusMatch in ReportsMap.tsx
if (chipValue === "open")
  return reportStatus === "open";
if (chipValue === "in_progress")
  return reportStatus === "acknowledged" || reportStatus === "assigned" || reportStatus === "in_progress";
if (chipValue === "resolved")
  return reportStatus === "resolved" || reportStatus === "closed";

// Fix statusCounts in map/page.tsx to match
function statusCounts(reports: ReportLite[]): Record<string, number> {
  let open = 0, inProgress = 0, resolved = 0;
  for (const r of reports) {
    const s = r.status;
    if (s === "open") open++;
    else if (s === "acknowledged" || s === "assigned" || s === "in_progress") inProgress++;
    else if (s === "resolved" || s === "closed") resolved++;
  }
  return { open, in_progress: inProgress, resolved };
}
```

---

### CR-03 — Public report detail page crashes with TypeError when `report.history` is absent

**File:** `frontend/app/reports/[id]/page.tsx:421`

**Issue:**
```typescript
const resolutionEntry = [...report.history]
  .reverse()
  .find((e) => e.status === "resolved" || e.status === "closed");
```
`report.history` is typed as `StatusHistoryEntry[]` but the backend's public `/api/reports/:id` handler may return `history` as an empty array, `null`, or omit the field entirely (the public endpoint is a different code path from the admin one — it would need to be verified). If `report.history` is `undefined` or `null`, the spread operator `[...undefined]` throws `TypeError: undefined is not iterable`. Next.js will catch this as an unhandled error and return a 500 to the citizen. The same unguarded access appears at line 738 in the `report.history.length === 0` check and the `.map()` call.

**Fix:**
```typescript
// Line ~421
const resolutionEntry = [...(report.history ?? [])].reverse()
  .find((e) => e.status === "resolved" || e.status === "closed");

// Line ~738 render section
{(report.history ?? []).length === 0 ? (
  <TimelineEntry
    entry={{ status: report.status, changed_at: report.created_at }}
    isCurrent
  />
) : (
  (report.history ?? []).map((entry, i) => (
    <TimelineEntry
      key={`${entry.status}-${entry.changed_at}`}
      entry={entry}
      isCurrent={i === (report.history ?? []).length - 1}
    />
  ))
)}
```

---

## Warnings

### WR-01 — Admin map page caps at 200 reports — silently drops reports beyond that

**File:** `frontend/app/admin/reports/map/page.tsx:138`

**Issue:** `getAdminReports({ limit: 200, page: 1 })` hard-caps the map at 200 reports. There is no UI indicator that the display is partial. The public map correctly uses `/api/reports.geojson` which streams all reports. As the dataset grows, the admin map will silently misrepresent the true distribution.

**Fix:** Use the GeoJSON endpoint (with auth credentials passed via `credentials: "include"`) for the admin map, matching the approach in `ReportsMap.tsx`, or implement visible pagination with a "showing N of M" notice.

---

### WR-02 — CSV/GeoJSON export in `admin/reports/page.tsx` omits the active corp/ward geographic filters

**File:** `frontend/app/admin/reports/page.tsx` (export handler functions)

**Issue:** The export handlers build `AdminReportFilters` from category, status, and severity only. The `corporationId` and `wardId` state variables (the new Phase 07 filters) are never forwarded to `downloadCsvExport` or `downloadGeoJsonExport`. A user who has narrowed the queue to a specific ward and then clicks "Export CSV" receives the globally unfiltered dataset — a data-accuracy bug that will confuse users and administrators.

**Fix:**
```typescript
async function handleCsvDownload() {
  const filters: AdminReportFilters = {};
  if (category) filters.category = category;
  if (status) filters.status = status;
  if (severity) filters.severity = severity;
  if (corporationId) filters.corporation_id = corporationId;  // ADD
  if (wardId) filters.ward_id = wardId;                       // ADD
  const blob = await downloadCsvExport(filters);
  ...
}
```
Apply the same fix to `handleGeoJsonDownload`.

---

### WR-03 — `validate_create_user_request` uses weaker email check than the model-layer helper

**File:** `backend/src/handlers/admin.rs:189`

**Issue:** The handler-layer gate for `POST /api/admin/users` checks `email.is_empty() || !email.contains('@')`. This accepts `"user@@double.com"` (two `@` signs) and `"@nodomain"` (empty local part) because both contain an `@`. The model-layer `validate_email_format` in `models/admin.rs` correctly rejects these cases, but it is marked `#[allow(dead_code)]` and is only called in unit tests. The handler uses its own weaker check. Emails like `"user@@example.com"` would be inserted into the database.

**Fix:**
```rust
use crate::models::admin::validate_email_format;

pub fn validate_create_user_request(email: &str, password: &str, role: &str) -> Result<(), AppError> {
    if !validate_email_format(email) {
        return Err(AppError::BadRequest("Invalid email".to_string()));
    }
    // ... rest unchanged
}
```
Remove the `#[allow(dead_code)]` from `validate_email_format` in models/admin.rs.

---

### WR-04 — `AdminUser` TypeScript interface declares `org_id` that the backend never serializes

**File:** `frontend/app/admin/lib/adminApi.ts:27`

**Issue:** `AdminUser` includes `org_id: string | null`, but `AdminUser::into_response()` in `backend/src/models/admin.rs` returns `AdminUserResponse` which has no `org_id` field. The property will always be `undefined` in the browser (not `null` as typed). TypeScript believes this is a nullable first-class field. Any code that destructures `org_id` expecting a `string | null` will instead receive `undefined`, bypassing TypeScript's null-safety checks.

**Fix:** Either add `org_id: Option<Uuid>` to `AdminUserResponse` in the Rust backend (and update `into_response`) — the preferred fix since org_id appears needed for the user management UI — or remove the field from the TypeScript interface if it is not needed.

---

### WR-05 — Resolution photo shown for non-resolved reports when `resolution_photo_url` is set

**File:** `frontend/app/reports/[id]/page.tsx:406-408`

**Issue:**
```typescript
const hasResolutionPhoto = publicResolutionUrl !== "";
```
`hasResolutionPhoto` is true whenever the URL is non-empty, regardless of `report.status`. The `isResolved` variable is derived at line 401 but never used to gate the photo display. If an admin uploads a resolution photo while leaving the status as "in_progress" (e.g., a workflow error), the public page will display the "RESOLUTION" badge and "After" photo even though the report is not closed.

**Fix:**
```typescript
const hasResolutionPhoto = publicResolutionUrl !== "" && isResolved;
```

---

### WR-06 — nginx adds duplicate `Cache-Control` header on `/api/wards/boundaries`

**Files:** `nginx/nginx.conf:151-160`, `nginx/nginx.server.conf:134-143`

**Issue:** Both the nginx location block (`add_header Cache-Control "public, max-age=86400"`) and the Axum handler (`[(header::CACHE_CONTROL, "public, max-age=86400")]` in `handlers/wards.rs:98`) set `Cache-Control`. When nginx proxies the backend response, `add_header` appends a _second_ `Cache-Control` header rather than replacing the backend's. Receiving two `Cache-Control` headers is technically valid but behaviour varies: some proxies and CDNs pick the first, some pick the last, some use the most restrictive. This could result in Cloudflare not caching the response as intended.

**Fix:** Pick one authoritative source. Remove `add_header Cache-Control` from nginx and rely on the backend header (already correct), or remove the header from the Rust handler and set it in nginx only. The backend is the simpler single source of truth since the Axum handler already sets it:

```nginx
location = /api/wards/boundaries {
    # Cache-Control: public, max-age=86400 is set by the backend handler
    add_header Vary "Accept-Encoding";
    proxy_pass http://backend;
    ...
}
```

---

### WR-07 — `admin/reports/page.tsx` filter load uses double-fetch on error with race on loading state

**File:** `frontend/app/admin/reports/page.tsx` (filter useEffect)

**Issue:** The filter options are loaded via `Promise.all([getAdminCorporations(), getAdminWards()])`. The `.finally(() => setIsLoadingFilters(false))` fires when the Promise.all settles. If the `.catch()` handler then re-fires API calls (a common retry pattern), `isLoadingFilters` is `false` while those retry calls are still in-flight. The loading indicator disappears before data is populated, causing a flash of an empty filter state followed by population.

**Fix:** Use `Promise.allSettled` to handle partial failures gracefully:
```typescript
const [corpsResult, wardsResult] = await Promise.allSettled([
  getAdminCorporations(),
  getAdminWards(),
]);
if (corpsResult.status === "fulfilled") setCorporations(corpsResult.value);
if (wardsResult.status === "fulfilled") setWards(wardsResult.value);
if (corpsResult.status === "rejected" || wardsResult.status === "rejected") {
  setFilterError(true);
}
```

---

## Info

### IN-01 — `TrendChart.tsx` dead color entries for phantom database enum values

**File:** `frontend/app/admin/components/TrendChart.tsx:34-36`

**Issue:** `CATEGORY_COLORS` includes entries for `"encroachment"` and `"no_curb_ramp"`. These are explicitly documented in `admin_queries.rs` (line 894-907) as "phantom values that never existed in the DB." They are dead code and mislead future maintainers about valid category values.

**Fix:** Remove both entries from `CATEGORY_COLORS`.

---

### IN-02 — `admin.css` defines pre-Phase-03 `--status-submitted` and `--status-review` tokens

**File:** `frontend/app/admin/admin.css:47-52, 119-124`

**Issue:** Both light and dark mode token blocks define `--status-submitted`, `--status-submitted-bg`, `--status-review`, and `--status-review-bg`. These correspond to the old two-value status vocabulary ("submitted", "under_review") that was renamed in Phase 03. The Phase 03 six-value tokens are also present alongside them, making the old tokens dead code that imply a vocabulary no longer used.

**Fix:** Remove the four pre-Phase-03 token declarations from both light and dark blocks.

---

### IN-03 — `admin.css` missing `--status-resolved` token triplet in dark mode

**File:** `frontend/app/admin/admin.css:100-142`

**Issue:** The dark-mode block defines tokens for `--status-open`, `--status-acknowledged`, `--status-assigned`, `--status-in-progress`, and `--status-closed` — but not `--status-resolved` and its `-bg`/`-border` siblings. The light-mode block at line 51 defines these correctly. Components referencing `--status-resolved` in dark mode will receive the CSS `inherit` fallback (likely white or no color), producing incorrect resolved-status coloring in dark mode.

**Fix:**
```css
.dark .admin-portal {
  /* ... existing tokens ... */
  --status-resolved: oklch(0.70 0.14 145);
  --status-resolved-bg: oklch(0.26 0.05 145);
  --status-resolved-border: oklch(0.36 0.09 145);
}
```

---

### IN-04 — `ChoroplethMap.tsx` generates a ~1000-character key string on every render

**File:** `frontend/app/admin/analytics/ChoroplethMap.tsx:65`

**Issue:**
```typescript
key={boundaries.features.map(f => f.properties?.ward_number).join(',')}
```
This joins 369 ward numbers into a comma-separated string as the React reconciliation key on every render cycle. Since `boundaries` is set once after initial fetch and never changes, the computed key never changes either — making the work unconditionally wasted. If any feature has `ward_number: undefined`, it silently produces an empty slot in the joined string, further weakening uniqueness.

**Fix:**
```typescript
key={`wards-${boundaries.features.length}`}
```

---

### IN-05 — `resolveReport` in adminApi.ts uses raw `fetch` and loses backend error details

**File:** `frontend/app/admin/lib/adminApi.ts:346-353`

**Issue:** `resolveReport` uses raw `fetch` (correctly, for multipart) but throws `new Error(\`HTTP ${res.status}\`)` without reading the response body. Every other mutation in this file uses `apiFetch` which reads the body and includes backend error text (e.g., "Resolution photo required" or "Only JPEG images are accepted"). The resolve error messages will always be bare status codes with no actionable detail for the admin.

**Fix:** Read the response body in the error branch, matching `apiFetch`'s pattern:
```typescript
if (!res.ok) {
  let detail = "";
  try { detail = await res.text(); } catch { /* ignore */ }
  throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`);
}
```

---

_Reviewed: 2026-06-23T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
