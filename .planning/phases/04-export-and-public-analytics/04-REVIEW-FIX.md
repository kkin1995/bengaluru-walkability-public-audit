---
phase: 04-export-and-public-analytics
fixed_at: 2026-05-31T11:30:00Z
fix_scope: critical_warning
findings_in_scope: 12
fixed: 12
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed:** 2026-05-31T11:30:00Z
**Scope:** Critical + Warning (CR-01..CR-05, WR-01..WR-07)
**Findings in scope:** 12
**Fixed:** 12
**Skipped:** 0
**Status:** all_fixed

## Applied Fixes

### CR-01 — SQL injection via `{where_clause}` template — FIXED

**Commit:** `a6ecbf3`

Removed the `{where_clause}` `.replace()` template approach. Added `build_export_sql()` builder
function in `admin_queries.rs` that composes the base SQL and WHERE clause explicitly, keeping
only `$N` parameter placeholders in the where_clause string. Updated `admin_export_csv` and
`admin_export_geojson` handlers to call `build_export_sql()` instead of `.replace()`.

---

### CR-02 — Blob URL memory leak in download handlers — FIXED

**Commit:** `fcb9f3b`

Deferred `URL.revokeObjectURL(url)` to `setTimeout(..., 100)` in all four download handlers
(`handleCsvDownload` and `handleGeoJsonDownload` in both `analytics/page.tsx` and
`reports/page.tsx`). This ensures the browser has time to initiate the download before the
object URL is invalidated.

---

### CR-03 — Rate-limit bypass via `X-Real-IP` without proxy validation — FIXED

**Commit:** `8517330`

Added a comment in `stats.rs` documenting that `X-Real-IP` is only trusted when the request
comes through nginx (not direct backend access). Updated `docker-compose.yml` to use `expose:`
instead of `ports:` for the backend port `3001`, preventing direct host access in production
and enforcing the nginx-only access path.

---

### CR-04 — Status modal uses stale/invalid status values — FIXED

**Commit:** `fcf6f13`

Updated the status-change modal in `reports/page.tsx` to use the Phase-03 enum values:
`open`, `acknowledged`, `assigned`, `in_progress`, `resolved`, `closed`. Changed the
initial `pendingStatus` state from `"submitted"` to `"open"`.

---

### CR-05 — Silent error swallow in `ChoroplethMap` — FIXED

**Commit:** `fe727b5`

Added `fetchError` boolean state to `ChoroplethMap`. The `.catch(() => null)` was replaced
with `.catch(() => setError(true))`. Added a `role="alert"` error banner rendered when
`fetchError` is true, giving analytics users visible feedback on ward boundary fetch failure.

---

### WR-01 — `COOKIE_SECURE` read per-request — FIXED

**Commit:** `7ab7aeb`

Added `pub cookie_secure: bool` to `AppState`. Read `COOKIE_SECURE` environment variable
once at startup in `main.rs` and stored in `AppState`. Both `admin_login` and `admin_logout`
now reference `state.cookie_secure` instead of calling `std::env::var()` on each request.

---

### WR-02 — `KpiCards` `totalReports` shows only top-10 ward sum — FIXED

**Commit:** `cca5ec2`

Renamed the KPI label from "Total Reports" to "Reports in Top 10 Wards" in `KpiCards.tsx`
to accurately reflect that the count is derived from the top-10 ward analytics query (LIMIT 10),
not the system-wide total.

---

### WR-03 — `HeatmapLayer` filters only `"open"` status — FIXED

**Commit:** `e697feb`

Updated `HeatmapLayer.tsx` to use `UNRESOLVED_STATUSES = new Set(["open", "acknowledged", "assigned", "in_progress"])`.
Reports with any of these four unresolved statuses now contribute to heatmap density, matching
the Phase-03 status enum intent.

---

### WR-04 — `ReportsMap` uses paginated list endpoint instead of GeoJSON — FIXED

**Commit:** `afdd479`

Switched `ReportsMap.tsx` from `GET /api/reports?limit=200` to `GET /api/reports.geojson`.
Added GeoJSON feature-to-report mapping. This removes the hard-coded 200-report cap and
uses the purpose-built endpoint with privacy-protected rounded coordinates.

---

### WR-05 — Mid-stream DB errors swallowed in export handlers — FIXED

**Commit:** `ae5c4ed`

CSV export: appends a `#ERROR: stream interrupted at row N\n` sentinel comment to the CSV
when a mid-stream DB error occurs, allowing consumers to detect truncation.
GeoJSON export: logs the error and sends a closing `]}` to produce valid (though incomplete)
JSON on mid-stream failure.

---

### WR-06 — `TrendChart` `selectedWard` prop displayed but unused — FIXED

**Commit:** `3c08766`

Removed the `selectedWard` prop and its "FILTERED: {selectedWard}" render from `TrendChart`.
The trend data is global (not ward-filterable at the API level), so the misleading filter
label was removed entirely rather than leaving it to suggest functionality that doesn't exist.

---

### WR-07 — Nginx login block missing `X-Forwarded-Proto` header — FIXED

**Commit:** `4d0f1d8`

Added `proxy_set_header X-Forwarded-Proto $scheme;` to the `/api/admin/auth/login` exact-match
location block in `nginx.conf`. This brings it in line with all other proxy blocks.

---

## Skipped (Info — out of scope for critical_warning fix)

- **IN-01:** `public_geojson_tests.rs` test uses hardcoded SQL string instead of exported fragment
- **IN-02:** `WardTable` uses `w.ward_name` as React key (non-unique risk)
- **IN-03:** `AnalyticsPage` test mocks from path that may not match Jest module identity
- **IN-04:** `AdminSidebar` uses `<a>` tags instead of Next.js `<Link>` for nav items

_Run `/gsd-code-review 4 --fix --all` to address Info findings._

---

_Fixed: 2026-05-31T11:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Branch: feat/phase-04-export-analytics_
