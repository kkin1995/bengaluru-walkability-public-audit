---
phase: 04-export-and-public-analytics
reviewed: 2026-05-31T13:30:48Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - backend/Cargo.toml
  - backend/migrations/011_analytics_mv.sql
  - backend/src/db/admin_queries.rs
  - backend/src/db/queries.rs
  - backend/src/handlers/admin.rs
  - backend/src/handlers/mod.rs
  - backend/src/handlers/stats.rs
  - backend/src/lib.rs
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
  - frontend/app/components/HeatmapLayer/__tests__/HeatmapLayer.test.tsx
  - frontend/app/components/HeatmapLayer.tsx
  - frontend/app/components/ReportsMap.tsx
  - frontend/app/stats/page.tsx
  - frontend/app/stats/__tests__/StatsPage.test.tsx
  - frontend/__mocks__/leaflet.js
  - frontend/package.json
  - nginx/nginx.conf
  - nginx/nginx.server.conf
findings:
  critical: 5
  warning: 6
  info: 4
  total: 15
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-31T13:30:48Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 04 added streaming CSV/GeoJSON export endpoints, public `/api/stats` and
`/api/reports.geojson` endpoints, an admin analytics backend (ward analytics,
corporation stats, trend data, ward boundaries), an admin analytics frontend
dashboard, and a public heatmap layer on the map page.

The overall quality is solid: SQL injection is properly guarded through
parameterised queries, PII exclusion is carefully enforced across most of the
public endpoints, and the streaming architecture is sound. However, several
issues were found that require attention before this code ships.

The most serious findings are:

1. **PII leak in public GeoJSON** — `resolution_notes` is fetched and emitted
   in the public `/api/reports.geojson` stream. This is an admin-only field per
   D-17.
2. **Broken JSX comment syntax** — `{/* ... */}` embedded inside a JSX
   conditional expression body crashes the production build of the analytics
   page.
3. **`X-Forwarded-Proto` missing from `nginx.server.conf` login block** — the
   WR-07 fix was applied only to `nginx.conf`; the production server config
   file was not updated.
4. **`get_ward_analytics` panics on NULL `ward_number`** — uses `.get()` with
   no try-fallback on a nullable column.
5. **Admin GeoJSON export silently truncates on mid-stream DB error** — the
   resulting file is syntactically valid JSON with no in-band truncation signal.

---

## Critical Issues

### CR-01: PII field `resolution_notes` emitted in public GeoJSON stream

**File:** `backend/src/db/queries.rs:435-443` and `backend/src/handlers/stats.rs:113-139`

**Issue:** `PUBLIC_GEOJSON_SQL` explicitly selects `r.resolution_notes` and
`r.resolution_photo_path` and `r.resolved_at` (queries.rs lines 435-443). The
streaming handler in `stats.rs` then reads those values and emits them
verbatim in the public FeatureCollection properties (lines 112-139 of
stats.rs). `resolution_notes` is explicitly designated admin-only per D-17:
the comment in `get_report_with_detail` (queries.rs line 404) states
"resolution_notes (admin-only per D-17) is NEVER included" for the public
single-report endpoint. That same field is included in the unbounded public
GeoJSON stream, meaning any citizen can download internal admin notes for every
resolved report by fetching `/api/reports.geojson`.

The `public_geojson_no_pii` test does not check for `resolution_notes`,
`resolution_photo_path`, or `resolved_at`, which is why this was not caught
by the existing test suite.

**Fix:** Remove the three fields from `PUBLIC_GEOJSON_SQL` and from the handler
variable reads and property emissions in `stats.rs`:

```sql
-- Remove from PUBLIC_GEOJSON_SQL in queries.rs:
--    r.resolution_photo_path,
--    r.resolution_notes,
--    r.resolved_at,
```

```rust
// Remove from the stats.rs spawned task:
// let resolution_photo_path: Option<String> = row.get("resolution_photo_path");
// let resolution_notes: Option<String> = row.get("resolution_notes");
// let resolved_at: Option<chrono::DateTime<chrono::Utc>> = row.get("resolved_at");
// And remove them from the feature properties json! block.
```

Also extend the `public_geojson_no_pii` test to assert these fields are absent.

---

### CR-02: Broken JSX comment syntax causes `next build` crash on analytics page

**File:** `frontend/app/admin/analytics/page.tsx:157-159`

**Issue:** Lines 157-159 contain:

```tsx
        ) : (
          {/* WR-06: selectedWard prop removed — trend data is always system-wide */}
          <TrendChart data={trendData} />
        )}
```

A `{/* ... */}` block inside a JSX expression that is expected to return a
single React node creates a two-child expression (the comment node + the
TrendChart node), which is a JSX syntax error. This will fail with a
compilation error during `next build` or when TypeScript/Babel processes the
file. The development server may also error depending on the SWC configuration.

**Fix:** Delete the comment line entirely, or move it outside the expression:

```tsx
        ) : (
          <TrendChart data={trendData} />
        )}
```

---

### CR-03: `nginx.server.conf` login block missing `X-Forwarded-Proto` header

**File:** `nginx/nginx.server.conf:97-108`

**Issue:** The WR-07 fix (commit `4d0f1d8`) added
`proxy_set_header X-Forwarded-Proto $scheme;` to the `= /api/admin/auth/login`
location block in `nginx/nginx.conf` (line 122). The identical location block
in `nginx/nginx.server.conf` (the production Cloudflare-tunnel deployment
config, lines 97-108) was not updated. In the production environment this means
the login endpoint does not receive `X-Forwarded-Proto`, leaving any
audit-logging or HTTPS detection on that handler without the required header.
The two config files are supposed to be kept in sync for security headers.

**Fix:** Add the missing header to `nginx/nginx.server.conf` at line 104
(between the `X-Forwarded-For` and `X-Request-ID` lines):

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

---

### CR-04: `get_ward_analytics` panics on NULL `ward_number` column

**File:** `backend/src/db/admin_queries.rs:1362-1372` and `backend/src/db/admin_queries.rs:1588-1598`

**Issue:** Both `get_ward_analytics` (line 1366) and `get_ward_boundaries`
(line 1593) use `r.get::<i32, _>("ward_number")` with no error handling. If
any ward row has a NULL `ward_number` — which is structurally possible since
the wards table is populated by CSV import and there is no NOT NULL constraint
visible in the migration files reviewed — sqlx will return a
`RowNotFound`-equivalent type decode error. This causes the `?` propagation to
fail the entire query and return a 500 to the analytics dashboard, making the
entire ward analytics and choropleth map fail for all users whenever one ward
has a missing number. There is no defensive coding here unlike the
`try_get(...).ok()` pattern used elsewhere in the same file.

**Fix:**

```rust
// In get_ward_analytics mapping closure:
ward_number: r.try_get::<i32, _>("ward_number").unwrap_or(0),

// In get_ward_boundaries mapping closure:
ward_number: r.try_get::<i32, _>("ward_number").unwrap_or(0),
```

---

### CR-05: Admin GeoJSON export silently produces valid but truncated JSON on mid-stream DB error

**File:** `backend/src/handlers/admin.rs:1092-1108`

**Issue:** When a DB error occurs mid-stream in the admin GeoJSON export
handler, the code breaks out of the row loop and sends the closing `]}` bytes,
producing a syntactically valid but data-incomplete GeoJSON FeatureCollection.
The HTTP status 200 was already sent. There is no in-band signal to the caller
that truncation occurred. A consumer who imports this file into a GIS tool sees
a valid FeatureCollection and cannot distinguish truncated data from a complete
export.

This is worse than the CSV export handler, which correctly appends a `#ERROR:`
sentinel comment on mid-stream error (admin.rs lines 937-941). The GeoJSON
handler should apply the same principle.

**Fix:** Before sending `]}`, emit an error signal feature:

```rust
Err(e) => {
    tracing::error!(error = %e, "GeoJSON export: mid-stream DB error; appending error feature");
    let error_feature = serde_json::json!({
        "type": "Feature",
        "geometry": null,
        "properties": {
            "_stream_truncated": true,
            "_stream_error": e.to_string()
        }
    });
    let _ = tx.send(Ok(Bytes::from(format!(",{}\n", error_feature)))).await;
    break;
}
```

---

## Warnings

### WR-01: `count_admin_reports` with org scoping builds a CTE in a subquery — non-portable SQL

**File:** `backend/src/db/admin_queries.rs:248-302`

**Issue:** When `org_id` is `Some`, both `count_admin_reports` and
`list_admin_reports` construct SQL with a `WITH RECURSIVE` CTE embedded inside
an `IN (...)` subquery clause. The resulting SQL looks like:

```sql
SELECT COUNT(*) FROM reports LEFT JOIN wards ...
WHERE ... AND reports.ward_id IN (
    WITH RECURSIVE org_subtree AS (...) SELECT w.id FROM wards w ...
)
```

While PostgreSQL 12+ supports inline CTEs in subqueries, this is
non-standard SQL. PostgreSQL 11 and earlier will reject this with a syntax
error, silently breaking all org-scoped pagination and listing for
any deployment running an older PostgreSQL version. Since the project targets
a self-hosted setup, the Postgres version is not pinned, making this a latent
compatibility risk.

**Fix:** Refactor to use a top-level CTE pattern:

```sql
WITH RECURSIVE org_subtree AS (
    SELECT id FROM organizations WHERE id = $N
    UNION ALL
    SELECT o.id FROM organizations o JOIN org_subtree s ON o.parent_id = s.id
)
SELECT COUNT(*) FROM reports
LEFT JOIN wards ON wards.id = reports.ward_id
WHERE ... AND reports.ward_id IN (
    SELECT w.id FROM wards w JOIN org_subtree s ON w.org_id = s.id
)
```

---

### WR-02: `admin_export_csv` and `admin_export_geojson` do not validate filter enum values

**File:** `backend/src/handlers/admin.rs:856-885` and `backend/src/handlers/admin.rs:1001-1030`

**Issue:** Both export handlers accept `status`, `category`, and `severity`
query parameters and pass them directly to `build_export_where_clause` without
validating that the values are valid enum members. An admin who submits
`?status=typo_value` will get a 200 response with only the CSV/GeoJSON header
and zero data rows, with no indication the filter was invalid. This silent
empty-export scenario is a usability defect that could cause an admin to
incorrectly conclude there are no reports matching their criteria.

**Fix:** Add lightweight validation before the DB call:

```rust
if let Some(ref s) = filters.status {
    validate_status(s)?;  // already defined in this file, returns AppError::BadRequest
}
```

---

### WR-03: `public_get_geojson` sends an `Err` variant to the stream on DB error — abruptly resets TCP connection

**File:** `backend/src/handlers/stats.rs:154-159`

**Issue:** On a DB row error the public GeoJSON handler sends:
```rust
let _ = tx.send(Err(std::io::Error::other(e.to_string()))).await;
```
The stream channel type is `Result<Bytes, std::io::Error>`. `Body::from_stream`
propagates the `Err` variant as a body-level IO error to Hyper, which resets
the TCP connection rather than completing the HTTP response cleanly. This will
manifest as a connection reset error on the client, which is harder to
diagnose than a clean close with a truncated but parseable body. The admin
export handler closes cleanly with `]}` on error; the public handler should
match.

**Fix:**
```rust
Err(e) => {
    tracing::error!(error = %e, "Public GeoJSON: mid-stream DB error");
    let _ = tx.send(Ok(Bytes::from_static(b"]}"))  ).await;
    break;
}
```

---

### WR-04: `ChoroplethMap` `key` prop on GeoJSON layer is effectively constant across different data

**File:** `frontend/app/admin/analytics/ChoroplethMap.tsx:61`

**Issue:** The `key` prop is set to `JSON.stringify(boundaries).slice(0, 40)`.
Every valid GeoJSON `FeatureCollection` response will start with
`{"type":"FeatureCollection","features":[`, meaning the first 40 characters
are identical for all responses regardless of content. When the `boundaries`
state is updated with a new fetch result (e.g., after a data refresh), the key
will not change, React will not unmount-and-remount the `GeoJSON` layer, and
the choropleth map will not re-render with the new data.

**Fix:** Use the feature count or a timestamp-based key:
```tsx
key={boundaries.features.length + '_' + Date.now()}
```
Or derive a more stable key from meaningful content:
```tsx
key={boundaries.features.map(f => f.properties?.ward_number).join(',')}
```

---

### WR-05: `AdminSidebar` mobile tabs dead `href` on logout entry

**File:** `frontend/app/admin/components/AdminSidebar.tsx:31`

**Issue:** The `MOBILE_TABS` array item for logout has `href: "/api/admin/auth/logout"`.
The rendering code correctly catches `tab.key === "logout"` and renders a
`<button>` instead, so the `href` is never used in the anchor. However, if the
`key` check were ever refactored or the entry were rendered as a link, the
browser would make a full-page GET request to the logout API endpoint (which
only accepts POST), receiving an HTTP 405 Method Not Allowed without executing
the JS logout flow. This is a latent defect in the defensive structure.

**Fix:** Remove the `href` field from the logout tab entry:
```ts
{ key: "logout", icon: "logout" as const, label: "OUT" },
```

---

### WR-06: `HeatmapLayer` test comment contradicts implementation — `in_progress` wrongly documented as excluded

**File:** `frontend/app/components/HeatmapLayer/__tests__/HeatmapLayer.test.tsx:37-39`

**Issue:** The `REPORTS` test fixture at line 37 annotates the `in_progress`
report with the comment "should be filtered out", and the assertion at line 68
verifies that latitude 12.974 (`in_progress`) is absent from heatmap points.
However, the actual `HeatmapLayer.tsx` implementation correctly includes
`in_progress` in `UNRESOLVED_STATUSES` and therefore in heatmap points. The
test passes only because the fixture happens to have exactly 2 `open` reports
which produce the 2 expected points — but the `in_progress` report at 12.974
would also be included if present in the actual code. The test comment and
assertion are actively wrong and will mislead future maintainers about the
intended behaviour.

**Fix:** Update the test comment and assertion to reflect that `in_progress`
should appear in heatmap data. Add fixture entries for `acknowledged` and
`assigned` statuses to confirm they are also included.

---

## Info

### IN-01: `EXPORT_CSV_BASE` and `EXPORT_GEOJSON_BASE` are identical SQL — duplicated constant

**File:** `backend/src/db/admin_queries.rs:1145-1189`

**Issue:** Both constants contain the exact same SQL text. Any future column
addition or deletion must be applied to both constants independently, with no
compiler or test enforcement that they stay in sync.

**Fix:** Declare a single `EXPORT_BASE` constant and reference it from both
wrapper functions.

---

### IN-02: `AnalyticsPage` test suite does not cover error or loading states

**File:** `frontend/app/admin/analytics/__tests__/AnalyticsPage.test.tsx`

**Issue:** Only two test cases exist: title rendering and KPI/WardTable mock
presence. The `isError` branch (retry button, failure message) and `isLoading`
skeleton state are not tested.

**Fix:** Add a test case that mocks `getWardAnalytics` to reject and asserts
"Failed to load analytics data" is displayed.

---

### IN-03: `geojson` type import relies on transitive `@types/leaflet` dependency

**File:** `frontend/app/admin/lib/adminApi.ts:11`

**Issue:** `import type { FeatureCollection } from "geojson"` works because
`@types/geojson` is a peer dependency of `@types/leaflet`. If `@types/leaflet`
is ever updated to drop or change that dependency, this import will silently
break TypeScript compilation.

**Fix:** Add `@types/geojson` as an explicit `devDependency` in `package.json`.

---

### IN-04: `KpiCards` "Reports in Top 10 Wards" label is misleading

**File:** `frontend/app/admin/components/KpiCards.tsx:103-106`

**Issue:** The label says "Reports in Top 10 Wards" and the comment correctly
notes this is a top-10-only sum (not a system-wide total). However, an admin
skimming the dashboard may read this as the overall report count, especially
since KPI dashboards conventionally show totals. This could cause incorrect
reporting to civic bodies.

**Fix:** Rename to "Total Reports (Top 10 Wards)" or add a sub-label "top 10
wards only" to make the scope explicit at a glance.

---

_Reviewed: 2026-05-31T13:30:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
