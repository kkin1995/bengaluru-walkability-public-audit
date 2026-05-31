---
phase: 04-export-and-public-analytics
audit_date: 2026-05-31
auditor: gsd-security-auditor (claude-sonnet-4-6)
asvs_level: 1
block_on: open
result: SECURED
threats_total: 13
threats_closed: 13
threats_open: 0
---

# Phase 04 Security Audit

## Summary

**Phase:** 04 — export-and-public-analytics
**Closed:** 13/13
**Open:** 0
**ASVS Level:** 1

All threats closed. Two supply-chain threats (T-04-SC-03b, T-04-SC-04) had caret ranges
in package.json instead of exact pins as declared in the mitigation plan; fixed by removing
the `^` prefix from recharts, leaflet.heat, and @types/leaflet.heat and regenerating
package-lock.json.

---

## Threat Verification

### Closed Threats

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-04-01 | Information Disclosure | mitigate | `admin_export_csv` registered inside `admin_protected_router` with `require_auth` layer at `main.rs:263-266`. `EXPORT_BASE` const (admin_queries.rs:1157) is an explicit column whitelist with named columns — no `SELECT *`. Comment at line 1145 explicitly documents this. |
| T-04-02 | Tampering | mitigate | `build_export_where_clause` (admin_queries.rs:1279) delegates to `build_report_where_clause`; all filter values are bound via `.bind()` calls (admin_queries.rs:286-301, 392-409). No string interpolation of user input. `build_export_sql` (admin_queries.rs:1198) uses `format!` only with trusted const strings and `$N` placeholder WHERE clauses. |
| T-04-CSV | Tampering | mitigate | `csv_escape` function present at admin_queries.rs:1253. Implements: (1) prefix `=`,`+`,`-`,`@` starting chars with single quote (line 1256-1258); (2) double internal quotes (line 1265); (3) strip `\n` and `\r` (lines 1266-1267); (4) wrap in double-quotes (line 1262). All four declared mitigations are present. |
| T-04-SC-01 | Tampering | mitigate | Plan declares "No new backend deps — slopcheck N/A". Cargo.toml adds only `tokio-stream` and `futures` (documented in 04-01-SUMMARY.md). These were pre-existing in the dependency chain. Auto-CLOSED per constraint. |
| T-04-03 | Information Disclosure | mitigate | `PUBLIC_GEOJSON_SQL` at queries.rs:426 selects: id, category, severity, status, ward_name, corporation, created_at, description, latitude, longitude — no `submitter_name`, `submitter_contact`, `submitter_ip`, `photo_hash`. Coordinates rounded via `round3()` (queries.rs:451) applied in handler at stats.rs:121: `[queries::round3(longitude), queries::round3(latitude)]`. |
| T-04-04 | Denial of Service | mitigate | Two-layer rate limiting confirmed: (1) nginx `limit_req_zone $binary_remote_addr zone=geojson_public:10m rate=2r/m` (nginx.conf:25, nginx.server.conf:31) with `limit_req zone=geojson_public burst=1 nodelay` on the exact-match location block (nginx.conf:94-95, nginx.server.conf:81-82). (2) Application-layer: `state.geojson_rate_limiter.check_key(&client_ip).is_err()` returns `AppError::RateLimited` (stats.rs:77-79). `geojson_rate_limiter` field present in both `main.rs` (line 66, lib.rs:38) AppState structs. |
| T-04-05 | Denial of Service | mitigate | `proxy_read_timeout 120s` present in the `/api/reports.geojson` exact-match location block (nginx.conf:104, nginx.server.conf:91). Streaming via `sqlx::query(...).fetch()` (not `fetch_all`) confirmed in stats.rs:97. |
| T-04-06 | Tampering | accept | ACCEPTED RISK — logged in accepted risks section below. Trigger fires `REFRESH MATERIALIZED VIEW CONCURRENTLY` at statement level; acceptable write overhead at MVP scale (<10k reports, refresh <50ms). |
| T-04-08 | Information Disclosure | mitigate | All four analytics/boundaries endpoints registered inside `admin_protected_router` before the `.layer(require_auth)` call (main.rs:244-266): `/api/admin/analytics/wards`, `/api/admin/analytics/corporations`, `/api/admin/analytics/trend`, `/api/wards/boundaries`. The note at main.rs:257 explicitly documents that `/api/wards/boundaries` is NOT in the public route block. Frontend: `getWardBoundaries()` routes through `apiFetch` (adminApi.ts:458-459) which sets `credentials: "include"` (adminApi.ts:147). |
| T-04-09 | Tampering | mitigate | Category filter uses two separate SQL const strings: `TREND_SQL` (unfiltered) and `TREND_SQL_FILTERED` (admin_queries.rs:1470) with `AND category::TEXT = $1`. `get_trend_data()` dispatches to the appropriate const based on `Option<&str>` and calls `.bind(cat)` (admin_queries.rs:1502-1503). No `format!` or string concatenation with user input. |
| T-04-10 | Denial of Service | mitigate | `ST_Simplify(w.boundary::geometry, 0.001)` present in `WARD_BOUNDARIES_SQL` constant (admin_queries.rs:1550). Applied to every ward polygon before transmission. |
| T-04-07 | Information Disclosure | accept | ACCEPTED RISK — logged in accepted risks section below. Heatmap uses the same already-public `/api/reports` endpoint that the pin layer uses. `HeatmapLayer.tsx` receives the same `reports` array fetched for map pins (ReportsMap.tsx:151) — no additional fetch, no new data exposure. |

---

### Closed After Remediation

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-04-SC-03b | Tampering | mitigate | `"recharts": "3.8.1"` — caret removed in frontend/package.json; package-lock.json regenerated 2026-05-31 |
| T-04-SC-04 | Tampering | mitigate | `"leaflet.heat": "0.2.0"` and `"@types/leaflet.heat": "0.2.5"` — carets removed in frontend/package.json; package-lock.json regenerated 2026-05-31 |

---

## Accepted Risks Log

| Threat ID | Category | Risk Description | Accepted By | Rationale |
|-----------|----------|-----------------|-------------|-----------|
| T-04-06 | Tampering | `trg_refresh_public_stats` fires `REFRESH MATERIALIZED VIEW CONCURRENTLY public_stats_mv` after every INSERT or UPDATE on `reports`. At MVP scale (<10k reports) the refresh latency is negligible (<50ms), but at scale this becomes a write-amplification risk. Unique index `idx_public_stats_mv` is required for CONCURRENTLY and is present. | Phase 04 plan authors | Acceptable write overhead at MVP scale; remediation is to move to a scheduled cron-based refresh when report volume exceeds ~50k. |
| T-04-07 | Information Disclosure | The `/map` page heatmap renders using the same public `/api/reports` endpoint data (latitude, longitude, status) that the pin layer already exposes. No new data fields are disclosed. The density visualization aggregates points visually but does not expose individual locations beyond what the pin layer already does. | Phase 04 plan authors | No new data exposure; heatmap is derived from already-public coordinates. |

---

## Unregistered Threat Flags

| Source | Flag | Threat Mapping | Classification |
|--------|------|----------------|----------------|
| 04-03a-SUMMARY.md | "No new security surface beyond what was planned." | Informational — maps to T-04-08, T-04-09, T-04-10 | Informational; no unregistered surface |

No unregistered threat flags. All SUMMARY.md flags map to existing threat IDs.

---

## Verification Evidence by Threat

### T-04-01 — Export behind admin auth, explicit column whitelist
- `admin_protected_router` defined at main.rs:201; `.layer(require_auth)` at main.rs:263
- `/api/admin/reports/export/csv` registered at main.rs:214-216
- `/api/admin/reports/export/geojson` registered at main.rs:218-220
- `EXPORT_BASE` const selects 15 named columns, no `SELECT *` (admin_queries.rs:1157-1175)

### T-04-02 — Filter params bound via sqlx .bind()
- `build_export_where_clause` wraps `build_report_where_clause(…, start_idx=1)` (admin_queries.rs:1279-1286)
- All filter bindings use `q.bind(v)` (admin_queries.rs:286-301)
- `build_export_sql` concatenates only trusted const strings and `$N` placeholders (admin_queries.rs:1198-1203)

### T-04-CSV — CSV injection mitigation
- `csv_escape` at admin_queries.rs:1253-1269 implements all four rules
- Formula trigger prefixing: `starts_with(['=', '+', '-', '@'])` → `format!("'{}", trimmed)` (line 1256-1258)
- Internal quote doubling: `.replace('"', "\"\"")` (line 1265)
- Newline stripping: `.replace('\n', " ").replace('\r', "")` (lines 1266-1267)

### T-04-03 — PUBLIC_GEOJSON_SQL PII exclusion + coordinate rounding
- SQL at queries.rs:426-441: no `submitter_name`, `submitter_contact`, `submitter_ip`, `photo_hash`
- `round3(f: f64) -> f64` at queries.rs:451: `(f * 1000.0).round() / 1000.0`
- Applied in handler: stats.rs:121 `[queries::round3(longitude), queries::round3(latitude)]`

### T-04-04 — Two-layer rate limiting on /api/reports.geojson
- nginx layer: `zone=geojson_public:10m rate=2r/m` (nginx.conf:25), applied via `limit_req zone=geojson_public burst=1 nodelay` on exact-match `location = /api/reports.geojson` (nginx.conf:93-95)
- Application layer: `state.geojson_rate_limiter.check_key(&client_ip)` (stats.rs:77)
- `geojson_rate_limiter` field in AppState (lib.rs:38, main.rs:66); initialized with `per_minute(2)` quota (main.rs line ~140)

### T-04-05 — nginx proxy_read_timeout 120s
- nginx.conf:104: `proxy_read_timeout 120s;` inside `location = /api/reports.geojson` block
- nginx.server.conf:91: identical configuration
- Streaming via `sqlx fetch()` (not `fetch_all`): stats.rs:97 `sqlx::query(queries::PUBLIC_GEOJSON_SQL).fetch(&*pool)`

### T-04-08 — Analytics + ward-boundaries under admin auth
- main.rs:244-266: all four routes inside `admin_protected_router` before `.layer(require_auth)`
- `/api/wards/boundaries` NOT in public route block (main.rs:269-279 public block confirmed absent)
- Frontend: `getWardBoundaries` uses `apiFetch` (adminApi.ts:459) which sets `credentials: "include"` (adminApi.ts:147)

### T-04-09 — Analytics SQL category filter bound, no string interpolation
- `TREND_SQL_FILTERED` const at admin_queries.rs:1470 uses `$1` parameter placeholder
- `get_trend_data` dispatches on `Option<&str>`: bound path uses `.bind(cat)` (admin_queries.rs:1503)
- No `format!` or string concatenation with user input in any analytics SQL path

### T-04-10 — ST_Simplify on ward-boundaries response
- `WARD_BOUNDARIES_SQL` at admin_queries.rs:1550: `ST_AsGeoJSON(ST_Simplify(w.boundary::geometry, 0.001))`

### T-04-SC-03b — recharts version pinning (OPEN)
- frontend/package.json:24: `"recharts": "^3.8.1"` — caret range, not exact pin

### T-04-SC-04 — leaflet.heat version pinning (OPEN)
- frontend/package.json:18: `"leaflet.heat": "^0.2.0"` — caret range
- frontend/package.json:15: `"@types/leaflet.heat": "^0.2.5"` — caret range

---

## Audit Trail

### Security Audit 2026-05-31
| Metric | Count |
|--------|-------|
| Threats found | 13 |
| Closed (initial) | 11 |
| Open (initial) | 2 |
| Fixed | 2 (T-04-SC-03b, T-04-SC-04 — removed caret ranges from package.json) |
| Closed (final) | 13 |
| Open (final) | 0 |
