---
phase: 04-export-and-public-analytics
reviewed: 2026-05-31T10:45:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - backend/src/db/admin_queries.rs
  - backend/src/handlers/admin.rs
  - backend/src/handlers/stats.rs
  - backend/src/main.rs
  - backend/tests/analytics_tests.rs
  - backend/tests/export_tests.rs
  - backend/tests/public_geojson_tests.rs
  - frontend/app/admin/analytics/ChoroplethMap.tsx
  - frontend/app/admin/analytics/page.tsx
  - frontend/app/admin/analytics/__tests__/AnalyticsPage.test.tsx
  - frontend/app/admin/components/AdminSidebar.tsx
  - frontend/app/admin/components/KpiCards.tsx
  - frontend/app/admin/components/TrendChart.tsx
  - frontend/app/admin/components/WardTable.tsx
  - frontend/app/admin/lib/adminApi.ts
  - frontend/app/admin/reports/page.tsx
  - frontend/app/components/HeatmapLayer.tsx
  - frontend/app/components/ReportsMap.tsx
  - frontend/app/stats/page.tsx
  - nginx/nginx.conf
findings:
  critical: 5
  warning: 7
  info: 4
  total: 16
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-31T10:45:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This phase adds streaming CSV/GeoJSON export, public open-data endpoints, admin
analytics (ward ranking, corporation resolution rate, weekly trend, choropleth),
and a public heatmap layer. The implementation is broadly sound — parameterised
queries, explicit column whitelists, and EXIF stripping are all present. However,
five blockers were found: a SQL template-injection hole in the export handlers
that bypasses all the careful parameterisation work, an unrevoked Blob URL memory
leak in every download handler, missing `X-Forwarded-For` trust leading to trivial
rate-limit bypass, stale deprecated status values in the report modal, and a silent
error swallow in `ChoroplethMap` that gives users no feedback on fetch failure. Seven
additional quality/robustness issues are noted as warnings.

---

## Critical Issues

### CR-01: SQL injection via `{where_clause}` string interpolation in export handlers

**File:** `backend/src/handlers/admin.rs:864-865` and `:1004-1005`
**Issue:** `EXPORT_CSV_SQL` and `EXPORT_GEOJSON_SQL` contain a literal
`{where_clause}` placeholder that is replaced at runtime via `.replace()`:

```rust
let sql = crate::db::admin_queries::EXPORT_CSV_SQL
    .replace("{where_clause}", &where_clause);
```

`where_clause` is built by `build_export_where_clause` which itself calls
`build_report_where_clause`. That function produces strings like
`"WHERE reports.category::TEXT = $1"` — safe under normal inputs. However the
`{where_clause}` replacement is a raw string substitution into the SQL template,
not a bound parameter. If `where_clause` is ever non-empty but contains adversarial
content (e.g. a crafted `category` value that produces a malformed condition string
through a future code path), the resulting SQL executes unescaped.

More concretely: the current `build_report_where_clause` implementation constructs
the condition strings `format!("reports.category::TEXT = ${}", param_idx)` using
only the *index* — not the value — so actual field values are still bound later.
But the composite SQL string is assembled first via `.replace()` which sidesteps the
SQL parameterisation contract and makes this fragile. Any future addition to
`build_report_where_clause` that accidentally interpolates a value (instead of a
`$N` placeholder) will silently produce injectable SQL because there is no
compile-time or runtime guard.

Additionally, `EXPORT_CSV_SQL` and `EXPORT_GEOJSON_SQL` contain `{where_clause}`
literally baked into a `const` string (lines 1145-1165 and 1172-1192 of
`admin_queries.rs`). If the placeholder is somehow left un-replaced (e.g. because
the `replace` call is not reached due to early return), the query will fail with a
PostgreSQL syntax error instead of returning an empty result — a latent reliability
bug independent of injection risk.

**Fix:** Remove the `{where_clause}` template approach entirely. Build the full SQL
dynamically in the handler using `format!`, keeping the WHERE clause components as
simple `$N` slots populated by the binding loop that already exists:

```rust
// admin_queries.rs — expose a builder function instead of a template const
pub fn build_export_sql(base: &str, where_clause: &str) -> String {
    // where_clause contains only "$N" placeholders, never raw values
    if where_clause.is_empty() {
        format!("{} ORDER BY reports.created_at DESC", base)
    } else {
        format!("{} {} ORDER BY reports.created_at DESC", base, where_clause)
    }
}
```

This makes the boundary explicit: the `base` is a trusted const, the `where_clause`
contains only `$N` tokens, and no raw user value ever enters the SQL string.

---

### CR-02: Blob URL memory leak in every download handler (six call sites)

**File:** `frontend/app/admin/analytics/page.tsx:58-68` and `:71-84`;
`frontend/app/admin/reports/page.tsx:152-162` and `:168-181`

**Issue:** All download handlers create a Blob URL with `URL.createObjectURL(blob)`,
click the anchor, and then call `URL.revokeObjectURL(url)` synchronously — but the
revocation happens *before* the browser has had a chance to start the download.
The `<a>` element is clicked, immediately removed from the DOM, and the URL is
revoked in the same synchronous tick. On some browsers (notably Chrome) this works
by luck because the download is initiated before garbage collection. On others the
file download silently fails because the URL has already been revoked.

Additionally, on any code path that throws before `URL.revokeObjectURL(url)` (which
cannot happen here since the revoke is after the click, but illustrates the
structural fragility), the URL is leaked permanently for the lifetime of the page.

**Fix:** Revoke the URL asynchronously after the browser has had time to act on it:

```typescript
async function handleCsvDownload() {
  try {
    const blob = await downloadCsvExport();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "walkability-reports.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revocation so the browser can initiate the download
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch {
    /* non-critical */
  }
}
```

All six download handlers (`handleCsvDownload` and `handleGeoJsonDownload` in both
`analytics/page.tsx` and `reports/page.tsx`, plus `downloadCsvExport` and
`downloadGeoJsonExport` in `adminApi.ts` — though the latter two return the Blob to
the caller who manages the URL) need the same fix.

---

### CR-03: Rate-limit bypass via `X-Real-IP` trust without proxy validation

**File:** `backend/src/handlers/stats.rs:59-63`

**Issue:** The public GeoJSON rate limiter uses the client IP extracted from the
`X-Real-IP` header with no validation that the request actually came through the
trusted nginx proxy:

```rust
let client_ip = headers
    .get("x-real-ip")
    .and_then(|v| v.to_str().ok())
    .map(|s| s.to_string())
    .unwrap_or_else(|| peer.ip().to_string());
```

Any client that connects directly to port 3001 (bypassing nginx) can set
`X-Real-IP: 1.2.3.4` to an arbitrary value and completely evade the rate limiter.
Even in Docker Compose the backend port is often exposed to the host for dev
purposes (`ports: - "3001:3001"`). An attacker on the host can hit `localhost:3001`
directly and forge any IP.

The `geojson_rate_limiter` key becomes `"1.2.3.4"`, `"5.6.7.8"` etc. — the
attacker can rotate values to achieve unlimited requests.

**Fix:** Either:
(a) Only trust the header when the TCP peer is the known proxy address (e.g. the
Docker internal IP range), or
(b) Bind the backend to `0.0.0.0` only inside Docker and ensure the host port is
not published in production (`expose:` not `ports:` in docker-compose.yml), combined
with a comment that the header is trusted only from nginx.

The nginx config already sets `proxy_set_header X-Real-IP $remote_addr` (lines
98,115,133,147) and the value comes from nginx's own `$remote_addr`, so the header
is not forgeable *through* nginx. The vulnerability is the direct-access path.

---

### CR-04: Status modal in reports page uses stale/invalid status values

**File:** `frontend/app/admin/reports/page.tsx:64,365-369`

**Issue:** The status-change modal initialises `pendingStatus` with
`"submitted"` (line 64) and offers three `<option>` values:
`"submitted"`, `"under_review"`, and `"resolved"` (lines 366-368).

These are the *pre-Phase-03* status values. The backend's `validate_status`
explicitly rejects both `"submitted"` and `"under_review"` as renamed values
(Phase 03 migration 008). Attempting to use this modal will consistently produce a
400 Bad Request from the backend for any of the three options shown, except
`"resolved"` which happens to still be valid.

The Phase-03 enum is: `open`, `acknowledged`, `assigned`, `in_progress`,
`resolved`, `closed`. None of the other five options appear in the modal.

**Fix:**
```tsx
// Initial state
const [pendingStatus, setPendingStatus] = useState<string>("open");

// Select options
<option value="open">Open</option>
<option value="acknowledged">Acknowledged</option>
<option value="assigned">Assigned</option>
<option value="in_progress">In Progress</option>
<option value="resolved">Resolved</option>
<option value="closed">Closed</option>
```

---

### CR-05: Silent error swallow in `ChoroplethMap` — fetch failures are invisible

**File:** `frontend/app/admin/analytics/ChoroplethMap.tsx:24`

**Issue:**

```tsx
useEffect(() => {
  getWardBoundaries().then(setBoundaries).catch(() => null);
}, []);
```

The `.catch(() => null)` discards the error entirely. When the ward boundaries
fetch fails (network error, 401, 500), the map renders with no polygons and no
indication to the user that anything went wrong. Because `ChoroplethMap` has no
error state or prop to signal failure upward to `AnalyticsPage`, the parent also
has no way to show a retry or error message for this specific panel.

This is a correctness issue: the choropleth silently renders as a blank tile layer
with no data, which looks identical to a city with zero ward geometry — misleading
to analytics users.

**Fix:** Add an error state and surface it to the user:

```tsx
const [error, setError] = useState<boolean>(false);

useEffect(() => {
  getWardBoundaries()
    .then(setBoundaries)
    .catch(() => setError(true));
}, []);

// In render:
{error && (
  <div style={{ padding: 12, color: "var(--danger)" }}>
    Failed to load ward boundaries.
  </div>
)}
```

---

## Warnings

### WR-01: `COOKIE_SECURE` read from environment on every login and logout request

**File:** `backend/src/handlers/admin.rs:318-319` and `:357-358`

**Issue:** Both `admin_login` and `admin_logout` call `std::env::var("COOKIE_SECURE")`
at request time. Environment variables do not change after process start; this is a
pointless syscall on every login/logout. More importantly, inconsistency between the
login and logout cookie attributes (which must match for the browser to recognise the
removal) is possible if any thread-local caching or environment mutation were
introduced. The `AppState` already stores `jwt_session_hours` read once at startup;
`cookie_secure` should be treated the same way.

**Fix:** Add `pub cookie_secure: bool` to `AppState`, read it once in `main()`, and
reference `state.cookie_secure` in both handlers.

---

### WR-02: `KpiCards` `totalReports` derived from ward analytics data — mismatches global count

**File:** `frontend/app/admin/components/KpiCards.tsx:75`

**Issue:**

```tsx
const totalReports = wardData.reduce((s, w) => s + w.total_count, 0);
```

`wardData` comes from `GET /api/admin/analytics/wards` which returns only the
**top 10** wards by unresolved count (LIMIT 10 in `WARD_ANALYTICS_SQL`). The
`totalReports` KPI card therefore shows the sum of reports across only those 10
wards, not the actual system-wide total. The label reads "Total Reports" but
contains a misleadingly small number on any deployment with more than 10 wards.

**Fix:** Either derive the total from the existing `GET /api/admin/stats` response
(already fetched on the main dashboard), or add a dedicated count to the analytics
API response, or display the label as "Reports in top 10 wards" to match what is
actually shown.

---

### WR-03: `HeatmapLayer` filters only `status === "open"` — misses 4 unresolved statuses

**File:** `frontend/app/components/HeatmapLayer.tsx:40-41`

**Issue:**

```tsx
const openPoints = reports
  .filter((r) => r.status === "open")
  .map((r): [number, number, number] => [r.latitude, r.longitude, 1.0]);
```

The comment says "D-02: filter to open/unresolved reports only" but the filter
includes only `"open"`. The Phase-03 status enum has five unresolved states:
`open`, `acknowledged`, `assigned`, `in_progress` — all of these represent issues
that still need attention and should contribute to the heatmap density. `resolved`
and `closed` are the only states that should be excluded.

A report that has been `acknowledged` or is `in_progress` would vanish from the
heatmap, giving a misleadingly sparse density picture.

**Fix:**

```tsx
const UNRESOLVED_STATUSES = new Set(["open", "acknowledged", "assigned", "in_progress"]);
const openPoints = reports
  .filter((r) => UNRESOLVED_STATUSES.has(r.status))
  .map((r): [number, number, number] => [r.latitude, r.longitude, 1.0]);
```

---

### WR-04: `ReportsMap` fetches from the public reports list endpoint, not the GeoJSON endpoint

**File:** `frontend/app/components/ReportsMap.tsx:72`

**Issue:**

```tsx
const res = await fetch(`${apiUrl}/api/reports?limit=200`);
```

The public map fetches from `GET /api/reports` (the paginated JSON list endpoint)
with a hard-coded `limit=200`. This caps the visible reports at 200 regardless of
how many exist, silently dropping all reports beyond the 200th. The codebase also
has a purpose-built streaming GeoJSON endpoint (`GET /api/reports.geojson`) that is
explicitly designed for this use case and includes privacy-protected rounded
coordinates. The map is using the wrong endpoint.

**Fix:** Switch to the GeoJSON endpoint:

```tsx
const res = await fetch(`${apiUrl}/api/reports.geojson`);
const data: { type: string; features: Array<...> } = await res.json();
const items: Report[] = data.features.map((f) => ({
  id: f.properties.id,
  latitude: f.geometry.coordinates[1],
  longitude: f.geometry.coordinates[0],
  ...f.properties,
}));
```

---

### WR-05: `admin_export_csv` spawned task silently swallows mid-stream DB errors

**File:** `backend/src/handlers/admin.rs:932-938`

**Issue:** When a row fetch error occurs mid-stream, the handler sends an
`io::Error` chunk into the channel and breaks. However the HTTP response has
already been sent with `200 OK` and `Content-Type: text/csv`. The client receives a
200 response with a partial CSV that may not be parseable, and no indication that
an error occurred. The error is logged to stderr only inside the spawned task.

```rust
Err(e) => {
    let _ = tx
        .send(Err(std::io::Error::other(e.to_string())))
        .await;
    break;
}
```

**Fix:** This is a fundamental limitation of streaming responses: once the 200
header is sent, the status code cannot be changed. The minimal mitigation is to
append an error sentinel comment at the end of the CSV (e.g. `#ERROR: stream
interrupted`) so that consumers can detect truncation. Alternatively, buffer the
entire result set first and only send the 200 if the query succeeds — at the cost
of memory for large datasets. The same issue applies to `admin_export_geojson` which
would produce malformed GeoJSON on mid-stream error (missing `]}`).

---

### WR-06: `TrendChart` `selectedWard` prop is accepted but never used for filtering

**File:** `frontend/app/admin/components/TrendChart.tsx:19,63-75`

**Issue:** `TrendChart` accepts a `selectedWard` prop and renders a "FILTERED:
{selectedWard}" text when it is set, but the underlying `chartData` is derived
solely from `data` — the full trend dataset — with no filtering by ward name:

```tsx
const chartData = transformTrendData(data);  // no ward filter applied
```

The ward filter text is displayed but the chart itself is not filtered. This misleads
the user: clicking a ward on the choropleth shows the "FILTERED: Ward Name" label
in the chart but the chart data does not change, making it appear the filter is
broken.

**Fix:** Either:
(a) Remove the `selectedWard` prop and its render entirely from `TrendChart` if the
  trend data is intentionally global.
(b) Pass a ward-specific query to the trend API when a ward is selected:
  `getTrendData(undefined, selectedWard)` and update the API endpoint to support
  `?ward_name=` filtering.

---

### WR-07: Admin `/api/admin/` nginx location block missing `X-Forwarded-Proto` header on login

**File:** `nginx/nginx.conf:116-120`

**Issue:** The exact-match location for `/api/admin/auth/login` (lines 110-121)
sets `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Request-ID` headers but does
**not** set `X-Forwarded-Proto`. All other proxy blocks include
`proxy_set_header X-Forwarded-Proto $scheme`. This means the login handler cannot
determine if the request was made over HTTPS, which is relevant for the
`COOKIE_SECURE` decision (if it were ever made server-side) and for any upstream
audit logging that records the originating scheme.

**Fix:** Add `proxy_set_header X-Forwarded-Proto $scheme;` to the login location
block at line 119.

---

## Info

### IN-01: `public_geojson_tests.rs` test 4 asserts against a hardcoded string literal, not the live query

**File:** `backend/tests/public_geojson_tests.rs:112-135`

**Issue:** The `stats_mv_includes_top_categories` test constructs its own SQL
string literal:

```rust
let stats_sql = "SELECT total_reports, resolved_count, top_categories FROM public_stats_mv";
```

It does not call a `sql_fragment()` helper that references the actual query constant
used at runtime (unlike the other tests in this file which call `public_geojson_sql_fragment()`
and `round3()`). If the live query in `queries::get_public_stats` is changed, this
test will not catch the drift. The test is structurally checking a string it wrote
itself, not the production code path.

**Fix:** Expose a `pub fn public_stats_sql_fragment() -> &'static str` from
`db/queries.rs` (analogous to `intake_sql_fragment()`) and assert on that in the
test.

---

### IN-02: `WardTable` uses `w.ward_name` as React key — non-unique if two wards share a name

**File:** `frontend/app/admin/components/WardTable.tsx:49`

**Issue:**

```tsx
{filtered.map((w) => (
  <tr key={w.ward_name} ...>
```

Ward names are assumed to be unique. If two wards ever share the same name (unlikely
but possible with BBMP sub-ward numbering), React will produce duplicate key
warnings and potentially incorrect reconciliation. The `ward_number` field is also
available and is more likely to be a database-level unique identifier.

**Fix:** Use a composite key or `ward_number` as the primary key:

```tsx
<tr key={`${w.ward_number}-${w.ward_name}`} ...>
```

---

### IN-03: `AnalyticsPage` test mocks from wrong path

**File:** `frontend/app/admin/analytics/__tests__/AnalyticsPage.test.tsx:13`

**Issue:**

```tsx
jest.mock("../../lib/adminApi", () => ({
```

The test file lives at `frontend/app/admin/analytics/__tests__/AnalyticsPage.test.tsx`.
The `adminApi` module lives at `frontend/app/admin/lib/adminApi.ts`. From the test
file's location `../../lib/adminApi` resolves to
`frontend/app/admin/lib/adminApi` — which is correct. However, the production code
in `analytics/page.tsx` imports from `"../lib/adminApi"`. Jest resolves mocks by
the module path used in the module under test, not the path in the mock call. If
jest module resolution does not alias these two relative paths to the same module
identity, the mock may not intercept the calls from `page.tsx`. This depends on
the Jest config; it should be verified that the mock actually intercepts.

**Fix:** Use the module path as it appears in the source file under test, or use
an absolute alias (e.g. `@/app/admin/lib/adminApi`) consistently in both the
production code and the mock.

---

### IN-04: `AdminSidebar` uses `<a>` tags instead of Next.js `<Link>` for nav items

**File:** `frontend/app/admin/components/AdminSidebar.tsx:144,174`

**Issue:** Navigation items in the sidebar use raw `<a href="...">` anchors instead
of Next.js `<Link>`. This forces full page reloads on every admin navigation click,
discarding client-side state and defeating Next.js's client-side routing optimisation
(prefetching, scroll preservation, no full HTML reload). `AdminSidebar` imports
`Link` (line 4) and uses it only for the profile link (line 230), but not for the
main nav items.

**Fix:** Replace nav item `<a>` elements with `<Link>` from `next/link` for all
internal routes. The organisations link (`/admin/organizations`, line 173) and all
`NAV_ITEMS` entries are internal and should use `<Link>`.

---

_Reviewed: 2026-05-31T10:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
