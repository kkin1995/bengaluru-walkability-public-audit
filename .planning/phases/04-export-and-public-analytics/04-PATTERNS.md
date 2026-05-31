# Phase 04: Export and Public Analytics — Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 18 new/modified files
**Analogs found:** 17 / 18

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/src/db/admin_queries.rs` (ADD functions) | service | streaming, CRUD | self — `list_admin_reports`, `get_intake_stats` | exact |
| `backend/src/db/queries.rs` (ADD `get_public_stats`) | service | CRUD | self — `get_ward_label_for_point` | role-match |
| `backend/src/handlers/admin.rs` (ADD export + analytics handlers) | handler | streaming, request-response | self — `admin_list_reports`, `admin_get_intake_stats` | exact |
| `backend/src/handlers/stats.rs` (NEW — public stats) | handler | request-response | `backend/src/handlers/wards.rs` — `ward_lookup` | role-match |
| `backend/migrations/011_analytics_mv.sql` (NEW) | migration | batch | `backend/migrations/008_workflow.sql` | role-match |
| `backend/src/main.rs` (EXTEND router + AppState) | config | — | self — existing route registrations + AppState | exact |
| `nginx/nginx.conf` (ADD rate-limit zone + location) | config | — | self — existing `admin_login` zone pattern | exact |
| `nginx/nginx.server.conf` (ADD same rate-limit changes) | config | — | self — `nginx/nginx.conf` | exact |
| `frontend/app/admin/analytics/page.tsx` (NEW) | page | request-response | `frontend/app/admin/page.tsx` | role-match |
| `frontend/app/stats/page.tsx` (NEW) | page | request-response | `frontend/app/reports/[id]/page.tsx` | role-match |
| `frontend/app/admin/reports/page.tsx` (EXTEND — export buttons) | page | request-response | self | exact |
| `frontend/app/admin/components/AdminSidebar.tsx` (EXTEND — Analytics nav entry) | component | — | self | exact |
| `frontend/app/admin/lib/adminApi.ts` (EXTEND — export + analytics functions) | utility | request-response | self — `getIntakeStats`, `apiFetch` | exact |
| `frontend/app/admin/components/KpiCards.tsx` (NEW) | component | — | `frontend/app/admin/components/StatsCards.tsx` | role-match |
| `frontend/app/admin/components/TrendChart.tsx` (NEW) | component | — | `frontend/app/admin/components/Sparkbars.tsx` (purpose analog) | partial |
| `frontend/app/admin/components/WardTable.tsx` (NEW) | component | — | `frontend/app/admin/components/ReportsTable.tsx` | role-match |
| `frontend/app/admin/analytics/ChoroplethMap.tsx` (NEW) | component | — | `frontend/app/components/ReportsMap.tsx` | partial |
| `frontend/app/components/HeatmapLayer.tsx` (NEW) | component | — | `frontend/app/components/ReportsMap.tsx` | partial |

---

## Pattern Assignments

### `backend/src/db/admin_queries.rs` — ADD streaming export functions + analytics queries

**Analog:** self (`backend/src/db/admin_queries.rs` lines 877–909, `list_admin_reports` lines 311–435)

**Imports pattern** (lines 1–17, already present):
```rust
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use crate::errors::AppError;
```

**SQL const pattern** (lines 877–883 — `INTAKE_SQL`):
```rust
// Define SQL as a const so tests reference the exact same string (no drift).
// Security note: filter values are always bound parameters — never interpolated.
const EXPORT_CSV_SQL: &str = "SELECT \
    reports.id, \
    reports.created_at, \
    reports.category::TEXT AS category, \
    ...
    FROM reports
    LEFT JOIN wards ON wards.id = reports.ward_id
    LEFT JOIN organizations o ON o.id = reports.assigned_org_id
    {where_clause}
    ORDER BY reports.created_at DESC";
```

**Dynamic WHERE clause pattern** (lines 189–228 — `build_report_where_clause`):
```rust
// Reuse existing build_report_where_clause for export filter params.
// Export adds `ward_name` filter — extend by adding ward_id lookup condition.
fn build_report_where_clause(
    category: Option<&str>,
    status: Option<&str>,
    severity: Option<&str>,
    date_from: Option<DateTime<Utc>>,
    date_to: Option<DateTime<Utc>>,
    start_idx: i32,
) -> (String, i32)
```

**Streaming rows pattern** (new — use `fetch` not `fetch_all`):
```rust
// DO NOT use fetch_all — use fetch() which returns a Stream row-by-row.
// Combined with mpsc channel, this prevents OOM on large exports.
use futures::StreamExt;  // for .next().await on the stream

let mut rows = sqlx::query(EXPORT_CSV_SQL)
    .bind(category)
    // ... bind all filter params in same order as WHERE clause
    .fetch(&*pool);   // returns BoxStream<'_, Result<PgRow, sqlx::Error>>

while let Some(row) = rows.next().await {
    match row {
        Ok(r) => { /* format and send chunk */ }
        Err(e) => { let _ = tx.send(Err(std::io::Error::other(e.to_string()))).await; break; }
    }
}
```

**Error handling pattern** (lines 145–157 — `create_admin_user`):
```rust
// Propagate via AppError::Database(e) for sqlx errors.
// Streaming tasks: send Err to channel; handler returns error body on channel close.
```

**Test-only SQL string helper pattern** (lines 1085–1126):
```rust
// For every new SQL const, expose a pub fn returning &'static str so tests
// can verify column presence without a live DB:
#[allow(dead_code)]
pub fn export_csv_sql_fragment() -> &'static str { EXPORT_CSV_SQL }

#[allow(dead_code)]
pub fn public_geojson_sql_fragment() -> &'static str { PUBLIC_GEOJSON_SQL }
```

**CSV date formatting** (new `fn format_csv_date`):
```rust
use chrono::{DateTime, Utc};
fn format_csv_date(dt: &DateTime<Utc>) -> String {
    dt.format("%d/%m/%Y").to_string()
}
fn format_csv_date_opt(dt: Option<&DateTime<Utc>>) -> String {
    dt.map(|d| d.format("%d/%m/%Y").to_string()).unwrap_or_default()
}
```

**CSV cell escaping** (new `fn csv_escape`):
```rust
// Wraps free-text field in double-quotes; escapes internal quotes by doubling.
// Also prepend single-quote to Excel formula injection triggers (=,+,-,@).
fn csv_escape(s: &str) -> String {
    let trimmed = s.trim();
    let sanitized = if trimmed.starts_with(['=', '+', '-', '@']) {
        format!("'{}", trimmed)
    } else {
        trimmed.to_string()
    };
    format!("\"{}\"", sanitized.replace('"', "\"\"").replace('\n', " ").replace('\r', ""))
}
```

**Analytics SQL const pattern** (mirrors `INTAKE_SQL` lines 877–883):
```rust
const WARD_ANALYTICS_SQL: &str = "SELECT \
    w.ward_name, w.ward_number, \
    COUNT(r.id) FILTER (WHERE r.status NOT IN ('resolved', 'closed')) AS unresolved_count, \
    COUNT(r.id) AS total_count \
    FROM wards w \
    LEFT JOIN reports r ON r.ward_id = w.id \
    GROUP BY w.id, w.ward_name, w.ward_number \
    ORDER BY unresolved_count DESC \
    LIMIT 10";

const TREND_SQL: &str = "SELECT \
    DATE_TRUNC('week', created_at AT TIME ZONE 'UTC')::DATE::TEXT AS week_start, \
    category::TEXT AS category, \
    COUNT(*)::BIGINT AS count \
    FROM reports \
    WHERE created_at >= NOW() - INTERVAL '12 weeks' \
    GROUP BY 1, 2 ORDER BY 1, 2";
```

---

### `backend/src/handlers/admin.rs` — ADD export + analytics handlers

**Analog:** self — `admin_get_intake_stats` and `admin_list_reports` patterns (lines 250–350)

**Imports pattern** (lines 45–74, extend with):
```rust
use axum::{
    body::Body,
    http::{header, StatusCode},
    response::Response,
    extract::{Extension, Query, State},
};
use bytes::Bytes;
use tokio_stream::wrappers::ReceiverStream;
use std::sync::Arc;
use crate::middleware::auth::JwtClaims as AuthJwtClaims;
use crate::AppState;
use crate::errors::AppError;
```

**Auth guard pattern** — all export handlers are inside `admin_protected_router`, so `require_auth` middleware already enforces auth. Handler receives `Extension(claims): Extension<AuthJwtClaims>` for user identity.

**Streaming handler pattern** (new — follows `Body::from_stream` Axum 0.7):
```rust
pub async fn admin_export_csv(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<AuthJwtClaims>,
    Query(filters): Query<AdminReportFilters>,
) -> Result<Response, AppError> {
    // Channel buffer=32: prevents writer from racing too far ahead of TCP send buffer.
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Bytes, std::io::Error>>(32);

    let pool = Arc::clone(&state.pool);
    tokio::spawn(async move {
        // 1. Send CSV header line
        let header_line = "id,submission_date,category,...\n";
        let _ = tx.send(Ok(Bytes::from(header_line))).await;

        // 2. Stream rows from DB
        // ... (use admin_queries::stream_csv_export which returns rows via fetch())
        // On error: tx.send(Err(...)) then break
    });

    let stream = ReceiverStream::new(rx);
    let body = Body::from_stream(stream);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"walkability-reports.csv\"",
        )
        .body(body)
        .unwrap())
}
```

**GeoJSON streaming pattern** (new — coordinate order is [lng, lat]):
```rust
// Opening delimiter:
let _ = tx.send(Ok(Bytes::from_static(b"{\"type\":\"FeatureCollection\",\"features\":[\n"))).await;
// Per feature (first=true for first row to manage commas):
let feature = serde_json::json!({
    "type": "Feature",
    "geometry": { "type": "Point", "coordinates": [lng_rounded, lat_rounded] },  // NOTE: lng first
    "properties": { "id": row_id, "category": category, ... }
});
let mut chunk = feature.to_string();
if !is_last { chunk.push(','); }
let _ = tx.send(Ok(Bytes::from(chunk))).await;
// Closing:
let _ = tx.send(Ok(Bytes::from_static(b"\n]}"))).await;
```

**Non-streaming analytics handler pattern** (mirrors `admin_get_intake_stats`):
```rust
pub async fn admin_get_ward_analytics(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<AuthJwtClaims>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows = admin_queries::get_ward_analytics(&state.pool).await?;
    Ok(Json(serde_json::json!({ "data": rows })))
}
```

---

### `backend/src/handlers/stats.rs` (NEW — public unauthenticated stats + public GeoJSON)

**Analog:** `backend/src/handlers/wards.rs` (lines 1–83) — same pattern: public, no-auth, Query params, returns Json

**Full file pattern:**
```rust
use axum::{
    extract::{ConnectInfo, State},
    http::HeaderMap,
    Json,
};
use serde::Serialize;
use std::{net::SocketAddr, sync::Arc};

use crate::{db::queries, errors::AppError, AppState};

// Public stats response — reads materialized view public_stats_mv
#[derive(Serialize)]
pub struct PublicStatsResponse {
    pub total_reports: i64,
    pub resolved_count: i64,
    pub top_categories: serde_json::Value,
}

/// GET /api/stats — public, no auth.
/// Reads the public_stats_mv materialized view.
pub async fn public_get_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<PublicStatsResponse>, AppError> {
    let stats = queries::get_public_stats(&state.pool).await?;
    Ok(Json(stats))
}

/// GET /api/reports.geojson — public, no auth, rate-limited.
/// Extracts IP for governor check same pattern as create_report:
pub async fn public_get_geojson(
    State(state): State<Arc<AppState>>,
    ConnectInfo(peer_addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<axum::response::Response, AppError> {
    // Extract IP (same as reports.rs extract_client_ip)
    let client_ip = headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| peer_addr.ip().to_string());

    // Governor rate limit check (new geojson_rate_limiter field on AppState)
    if state.geojson_rate_limiter.check_key(&client_ip).is_err() {
        return Err(AppError::RateLimited(
            "Rate limit exceeded for public data endpoint. Try again later.".to_string(),
        ));
    }

    // Stream GeoJSON body (same streaming pattern as admin export handlers)
    // ...
    Ok(response)
}
```

---

### `backend/src/main.rs` — EXTEND router + AppState

**Analog:** self (lines 44–57 for AppState, lines 173–235 for router)

**AppState extension pattern** (lines 44–57):
```rust
// Add new field to AppState struct:
pub struct AppState {
    pub pool: Arc<sqlx::PgPool>,
    pub uploads_dir: String,
    pub api_base_url: String,
    pub jwt_secret: Arc<Vec<u8>>,
    pub jwt_session_hours: u64,
    pub rate_limiter: Arc<governor::DefaultKeyedRateLimiter<String>>,
    // Phase 04 — separate quota pool for public GeoJSON (D-18):
    pub geojson_rate_limiter: Arc<governor::DefaultKeyedRateLimiter<String>>,
}
```

**Rate limiter init pattern** (lines 123–126 — existing `rate_limiter`):
```rust
// New geojson_rate_limiter — same pattern, different quota (2 req/min):
let geojson_quota = governor::Quota::per_minute(
    std::num::NonZeroU32::new(2).unwrap()
);
let geojson_rate_limiter = Arc::new(governor::RateLimiter::keyed(geojson_quota));
```

**Router extension pattern** (lines 216–235):
```rust
// Public routes — add alongside existing /api/reports routes:
.route("/api/stats", get(handlers::stats::public_get_stats))
.route("/api/reports.geojson", get(handlers::stats::public_get_geojson))
.route("/api/wards/boundaries", get(handlers::admin::admin_get_wards_boundaries))

// Protected admin routes — add export + analytics:
.route("/api/admin/reports/export/csv", get(admin_export_csv))
.route("/api/admin/reports/export/geojson", get(admin_export_geojson))
.route("/api/admin/analytics/wards", get(admin_get_ward_analytics))
.route("/api/admin/analytics/corporations", get(admin_get_corporation_analytics))
.route("/api/admin/analytics/trend", get(admin_get_trend_data))
```

---

### `backend/migrations/011_analytics_mv.sql` (NEW)

**Analog:** `backend/migrations/008_workflow.sql` — migration file structure

**Migration structure pattern** (migration 008, lines 1–44):
```sql
-- Standard header: note-no-transaction if ALTER TYPE needed (not needed here).
-- Plain SQL file for sqlx::migrate! to apply in order.

-- 1. Add resolved_at column (needed by EXPORT-01/D-13):
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 2. Create materialized view:
CREATE MATERIALIZED VIEW IF NOT EXISTS public_stats_mv AS
SELECT
    COUNT(*) AS total_reports,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS resolved_count,
    (
        SELECT json_agg(cat_row ORDER BY cnt DESC)
        FROM (
            SELECT category::TEXT AS category, COUNT(*) AS cnt
            FROM reports
            GROUP BY category
            ORDER BY cnt DESC
            LIMIT 3
        ) cat_row
    ) AS top_categories
FROM reports
WITH DATA;

-- 3. Unique index required for CONCURRENTLY refresh:
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_stats_mv ON public_stats_mv ((1));

-- 4. Trigger function:
CREATE OR REPLACE FUNCTION refresh_public_stats_mv()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public_stats_mv;
    RETURN NULL;
END;
$$;

-- 5. Trigger on reports (AFTER statement level to batch multiple-row operations):
DROP TRIGGER IF EXISTS trg_refresh_public_stats ON reports;
CREATE TRIGGER trg_refresh_public_stats
AFTER INSERT OR UPDATE ON reports
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_public_stats_mv();
```

---

### `nginx/nginx.conf` (EXTEND — new rate-limit zone + location)

**Analog:** self — existing `admin_login` zone and `upload` zone (lines 1–19, 86–115)

**Zone definition pattern** (lines 1–18 — existing zones to copy):
```nginx
# Add alongside existing limit_req_zone declarations at top of file:
# Public GeoJSON open-data endpoint — primary rate-limiting layer per D-18.
# 2 req/min prevents bulk scraping of the full dataset.
limit_req_zone $binary_remote_addr zone=geojson_public:10m rate=2r/m;
```

**Location block pattern** (lines 86–97 — `admin_login` exact-match location):
```nginx
# More specific than /api/ prefix — exact-match takes precedence per nginx rules.
location = /api/reports.geojson {
    limit_req zone=geojson_public burst=1 nodelay;
    limit_req_status 429;
    proxy_pass http://backend;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Streaming endpoint: extend beyond default 30s (GeoJSON may take >30s):
    proxy_read_timeout 120s;
}
```

Apply identical changes to `nginx/nginx.server.conf`.

---

### `frontend/app/admin/lib/adminApi.ts` (EXTEND — export + analytics API functions)

**Analog:** self (lines 139–260 — `apiFetch`, `getIntakeStats`, `getAdminReports`)

**apiFetch reuse pattern** (lines 139–158):
```typescript
// All new functions route through apiFetch — never call fetch() directly.
// credentials: 'include' is applied automatically.

// Export download: returns Blob (not JSON) — special case:
export async function downloadCsvExport(filters?: AdminReportFilters): Promise<Blob> {
  const params = buildFilterParams(filters);
  const qs = params.toString();
  const url = `${BASE}/api/admin/reports/export/csv${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();  // Blob for URL.createObjectURL download
}
```

**URL parameter building pattern** (lines 185–201 — `getAdminReports`):
```typescript
// Reuse same filter params shape (AdminReportFilters) for export endpoints.
// Export just adds format suffix to the URL.
const params = new URLSearchParams();
if (filters?.category) params.set("category", filters.category);
if (filters?.status) params.set("status", filters.status);
// ... etc
```

**New interface pattern** (lines 112–118 — `AdminStats`):
```typescript
// Add new typed interfaces for analytics responses:
export interface WardAnalytics {
  ward_name: string;
  ward_number: number;
  unresolved_count: number;
  total_count: number;
}

export interface TrendDataPoint {
  week_start: string;  // "YYYY-MM-DD"
  category: string;
  count: number;
}

export interface PublicStats {
  total_reports: number;
  resolved_count: number;
  top_categories: Array<{ category: string; cnt: number }>;
}
```

**apiFetch for JSON analytics** (lines 139–157):
```typescript
export async function getWardAnalytics(): Promise<WardAnalytics[]> {
  return apiFetch<WardAnalytics[]>(`${BASE}/api/admin/analytics/wards`);
}

export async function getTrendData(category?: string): Promise<TrendDataPoint[]> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const qs = params.toString();
  return apiFetch<TrendDataPoint[]>(`${BASE}/api/admin/analytics/trend${qs ? `?${qs}` : ""}`);
}

export async function getWardBoundaries(): Promise<GeoJSON.FeatureCollection> {
  return apiFetch<GeoJSON.FeatureCollection>(`${BASE}/api/wards/boundaries`);
}

// Public (no auth) — use plain fetch but through same BASE:
export async function getPublicStats(): Promise<PublicStats> {
  const res = await fetch(`${API_BASE_URL}/api/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

---

### `frontend/app/admin/analytics/page.tsx` (NEW — admin analytics page)

**Analog:** `frontend/app/admin/page.tsx` (full file — 557 lines)

**Page structure pattern** (admin/page.tsx lines 1–61):
```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { getWardAnalytics, getTrendData, getWardBoundaries, downloadCsvExport } from "../lib/adminApi";
import { Card } from "../components/Card";
import { Btn } from "../components/Btn";
import { SectionLabel } from "../components/SectionLabel";
import dynamic from "next/dynamic";

// Chart components must be client-only (recharts uses browser DOM):
const TrendChart = dynamic(() => import("../components/TrendChart"), { ssr: false });
// Map components — Leaflet uses window:
const ChoroplethMap = dynamic(() => import("./ChoroplethMap"), { ssr: false });
```

**State + fetch pattern** (admin/page.tsx lines 30–60):
```typescript
export default function AnalyticsPage() {
  const [wardData, setWardData] = useState<WardAnalytics[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [wards, trend] = await Promise.all([
        getWardAnalytics(),
        getTrendData(),
      ]);
      setWardData(wards);
      setTrendData(trend);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAnalytics(); }, [fetchAnalytics]);
```

**Page layout pattern** (admin/page.tsx lines 525–557 — padding + maxWidth):
```typescript
return (
  <div style={{ padding: "24px 32px", maxWidth: 1200, marginLeft: "auto", marginRight: "auto" }}>
    <h1 style={{
      fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600,
      color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.08em",
    }}>Analytics</h1>

    {/* KPI row — full width */}
    <KpiCards wardData={wardData} isLoading={isLoading} />

    {/* Trend chart — full width */}
    <Card style={{ marginBottom: 24 }}>
      <TrendChart data={trendData} />
    </Card>

    {/* Ward table + choropleth — side by side (D-06) */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <WardTable data={wardData} selectedWard={selectedWard} />
      <ChoroplethMap onWardClick={setSelectedWard} />
    </div>
  </div>
);
```

**Export button pattern** — trigger file download via Blob URL:
```typescript
async function handleCsvDownload() {
  const blob = await downloadCsvExport(currentFilters);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "walkability-reports.csv";
  a.click();
  URL.revokeObjectURL(url);
}
// Render:
<Btn variant="ghost" size="sm" onClick={handleCsvDownload}>
  Export CSV
</Btn>
```

---

### `frontend/app/stats/page.tsx` (NEW — public stats page)

**Analog:** `frontend/app/reports/[id]/page.tsx` (lines 1–15) — Direction-A server component pattern

**Server component + SSR fetch pattern** (reports/[id]/page.tsx lines 1–15):
```typescript
// No "use client" — this is a Next.js Server Component.
// Data fetched server-side via INTERNAL_API_URL.
import { INTERNAL_API_URL } from "@/app/lib/config";
import { getCategoryLabel } from "@/app/lib/translations";

export default async function StatsPage() {
  // SSR fetch — runs on the server, reads internal URL
  let stats = null;
  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/stats`, {
      next: { revalidate: 60 },  // ISR: revalidate every 60s
    });
    if (res.ok) stats = await res.json();
  } catch {
    // Stats unavailable — render zero state
  }

  return (
    <main style={{ /* Direction-A tokens from globals.css */ }}>
      {/* ... */}
    </main>
  );
}
```

**Public page layout pattern** (Direction-A — globals.css, NOT admin.css):
```typescript
// Use var(--bg), var(--ink), var(--accent) from globals.css
// NOT var(--surface), var(--border) from admin.css
// Include "Download open data (GeoJSON)" link to /api/reports.geojson
<a href="/api/reports.geojson" download="walkability-open-data.geojson">
  Download open data (GeoJSON)
</a>
```

---

### `frontend/app/admin/components/AdminSidebar.tsx` (EXTEND — Analytics nav entry)

**Analog:** self (lines 17–22 — `NAV_ITEMS` array and `MOBILE_TABS` array)

**Nav item extension pattern** (lines 17–22):
```typescript
// Add "analytics" entry to NAV_ITEMS array:
const NAV_ITEMS = [
  { key: "dashboard", href: "/admin",            icon: "activity" as const, label: "OPS"       },
  { key: "reports",   href: "/admin/reports",    icon: "inbox"    as const, label: "QUEUE"     },
  { key: "analytics", href: "/admin/analytics",  icon: "chart"    as const, label: "ANALYTICS" },  // NEW
  { key: "map",       href: "/admin/reports/map",icon: "map"      as const, label: "MAP"       },
  { key: "users",     href: "/admin/users",      icon: "users"    as const, label: "USERS", roleGated: true },
];
// Apply same addition to MOBILE_TABS (lines 24–30).
```

---

### `frontend/app/admin/components/KpiCards.tsx` (NEW — analytics KPI row)

**Analog:** `frontend/app/admin/components/StatsCards.tsx` (full file — 187 lines)

**Component structure pattern** (StatsCards.tsx lines 1–187):
```typescript
"use client";

import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";

// New: uses Phase 03 6-value status semantics (not old 3-value shape).
// Do NOT reuse StatsCards.tsx directly — its interface is locked to old shape.
interface KpiCardsProps {
  wardData: WardAnalytics[];
  isLoading?: boolean;
}

// Skeleton pattern (StatsCards.tsx lines 32–63):
function SkeletonCard() {
  return (
    <div
      data-testid="skeleton"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 16,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// KPI count style (StatsCards.tsx lines 143–150):
const countStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 28,
  fontWeight: 700,
  color: "var(--ink)",
  lineHeight: 1.1,
  marginTop: 6,
};

// Grid layout (StatsCards.tsx lines 152–162):
return (
  <div style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 24,
  }}>
    <Card><SectionLabel>Top Unresolved Ward</SectionLabel><p style={countStyle}>{topWard}</p></Card>
    <Card><SectionLabel>Resolution Rate</SectionLabel><p style={countStyle}>{rate}%</p></Card>
    {/* ... */}
  </div>
);
```

---

### `frontend/app/admin/components/TrendChart.tsx` (NEW — recharts line chart)

**Analog:** `frontend/app/admin/components/Sparkbars.tsx` (conceptual analog — same purpose: visualize report intake over time)

**No existing recharts analog in codebase.** Follow RESEARCH.md Pattern 5 exactly.

**Component structure pattern** (RESEARCH.md Pattern 5):
```typescript
"use client";
// recharts requires browser DOM — must be in client component (or dynamic import).
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";
import { useState } from "react";

interface TrendChartProps {
  data: TrendDataPoint[];  // from adminApi.ts
}

const CATEGORY_COLORS: Record<string, string> = {
  broken_footpath: "var(--danger)",
  blocked_footpath: "var(--warn)",
  no_footpath: "var(--accent)",
  unsafe_crossing: "oklch(0.65 0.16 260)",
  poor_lighting: "oklch(0.75 0.12 90)",
  encroachment: "oklch(0.65 0.16 300)",
  no_curb_ramp: "oklch(0.70 0.14 200)",
  other: "var(--muted)",
};

export default function TrendChart({ data }: TrendChartProps) {
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  const handleLegendClick = (data: { dataKey: string }) => {
    setHiddenLines(prev => {
      const next = new Set(prev);
      if (next.has(data.dataKey)) next.delete(data.dataKey); else next.add(data.dataKey);
      return next;
    });
  };

  // Transform flat TrendDataPoint[] to recharts wide format:
  // [{ week_start: "2025-W12", broken_footpath: 3, no_footpath: 5 }, ...]
  const chartData = transformTrendData(data);
  const categories = [...new Set(data.map(d => d.category))];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="week_start" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <YAxis style={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
        <Tooltip />
        <Legend onClick={handleLegendClick} />
        {categories.map(cat => (
          <Line key={cat} type="monotone" dataKey={cat}
            stroke={CATEGORY_COLORS[cat] ?? "var(--muted)"}
            strokeWidth={2} dot={false} hide={hiddenLines.has(cat)} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

### `frontend/app/admin/analytics/ChoroplethMap.tsx` (NEW — ward choropleth)

**Analog:** `frontend/app/components/ReportsMap.tsx` — same dynamic import pattern, same `useRef` for map instance

**Dynamic import + SSR guard pattern** (map/page.tsx lines 36–52):
```typescript
// This file itself should be imported with ssr:false from the analytics page:
// const ChoroplethMap = dynamic(() => import("./ChoroplethMap"), { ssr: false });
// Inside this file, import react-leaflet components directly (already SSR-guarded by parent):

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Ward color scale per CONTEXT.md D-01 (Claude's discretion for palette):
function getWardColor(count: number): string {
  if (count === 0) return "var(--surface-2)";
  if (count < 5)  return "oklch(0.85 0.08 185)";   // light teal
  if (count < 15) return "oklch(0.75 0.12 60)";    // amber
  if (count < 30) return "oklch(0.65 0.16 40)";    // orange
  return "oklch(0.56 0.20 25)";                     // danger red
}

interface ChoroplethMapProps {
  onWardClick: (wardName: string) => void;
}

export default function ChoroplethMap({ onWardClick }: ChoroplethMapProps) {
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    getWardBoundaries().then(setBoundaries).catch(() => null);
  }, []);

  return (
    <MapContainer center={[12.9716, 77.5946]} zoom={11} style={{ height: 400 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {boundaries && (
        <GeoJSON
          data={boundaries}
          style={(feature) => ({
            fillColor: getWardColor(feature?.properties?.unresolved_count ?? 0),
            fillOpacity: 0.6, weight: 1, color: "var(--border-strong)",
          })}
          onEachFeature={(feature, layer) => {
            layer.on("click", () => onWardClick(feature.properties.ward_name));
          }}
        />
      )}
    </MapContainer>
  );
}
```

---

### `frontend/app/components/HeatmapLayer.tsx` (NEW — leaflet.heat integration)

**Analog:** `frontend/app/components/ReportsMap.tsx` — existing Leaflet component with `useRef`, `useEffect`, dynamic import pattern

**Dynamic import guard** (map/page.tsx lines 36–52):
```typescript
// HeatmapLayer must be imported by map/page.tsx with ssr:false:
// const HeatmapLayer = dynamic(() => import("../components/HeatmapLayer"), { ssr: false });
// Inside this file, side-effect import leaflet.heat:
import "leaflet.heat";  // attaches L.heatLayer() to the leaflet namespace
import { useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
```

**useRef + useEffect Leaflet layer pattern** (from ReportsMap.tsx — useRef for map instance):
```typescript
interface HeatmapLayerProps {
  reports: Array<{ latitude: number; longitude: number; status: string }>;
  visible: boolean;  // controlled by L.control.layers toggle
}

export default function HeatmapLayer({ reports, visible }: HeatmapLayerProps) {
  const map = useMap();  // react-leaflet hook — gets the Leaflet map instance
  const layerRef = useRef<any>(null);  // L.HeatLayer | null

  useEffect(() => {
    if (!map) return;

    // Remove existing heat layer
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }

    if (!visible) return;

    // D-02: Only open/unresolved reports contribute to heat
    const openReports = reports.filter(r => r.status === "open");
    const heatPoints: [number, number, number][] = openReports.map(r => [
      r.latitude, r.longitude, 1.0  // [lat, lng, intensity] — leaflet.heat convention
    ]);

    layerRef.current = (L as any).heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 14,
      gradient: { 0.4: "#00bcd4", 0.65: "#ff9800", 1: "#f44336" },
    }).addTo(map);

    return () => {
      if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
    };
  }, [map, reports, visible]);

  return null;  // No DOM — Leaflet manages the canvas layer
}
```

**L.control.layers integration** — add in `map/page.tsx` after `ReportsMap` is ready:
```typescript
// Wire D-03: toggle via native Leaflet layer control (not chip filter strip).
// Add overlay registration when the map component initializes:
// Inside ReportsMap or a sibling useEffect in map/page.tsx:
const overlays = { "Issue Density": heatLayerRef.current };
L.control.layers({}, overlays, { position: "topright" }).addTo(map);
```

---

### `frontend/app/admin/reports/page.tsx` (EXTEND — export buttons)

**Analog:** self (lines 1–80 — existing filter state + fetch pattern)

**Export button placement** — add below the filter row, above `ReportsTable`:
```typescript
// In the JSX below existing filter controls, before <ReportsTable>:
<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
  <Btn variant="ghost" size="sm" onClick={handleCsvDownload} disabled={isLoading}>
    Export CSV
  </Btn>
  <Btn variant="ghost" size="sm" onClick={handleGeoJsonDownload} disabled={isLoading}>
    Export GeoJSON
  </Btn>
</div>
```

**Download handler pattern** (matches Btn.tsx + adminApi.ts `downloadCsvExport`):
```typescript
async function handleCsvDownload() {
  try {
    const blob = await downloadCsvExport({ category, status });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "walkability-reports.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // surface error via existing fetchError state pattern
  }
}
```

---

## Shared Patterns

### Authentication (admin endpoints)
**Source:** `backend/src/middleware/auth.rs` + `backend/src/main.rs` lines 210–214
**Apply to:** All handlers in `admin_protected_router` — export handlers, analytics handlers
```rust
// All admin export/analytics handlers are registered inside admin_protected_router
// which already applies require_auth middleware. No per-handler auth check needed.
// Handler signature receives Extension(claims): Extension<AuthJwtClaims> for user identity.
.layer(axum::middleware::from_fn_with_state(arc_state.clone(), require_auth))
```

### AppError enum
**Source:** `backend/src/errors.rs` (lines 9–82)
**Apply to:** All backend handlers — export handlers, stats handler, analytics handlers
```rust
// Use existing variants:
// AppError::RateLimited(msg) → 429 (public GeoJSON rate limit)
// AppError::Database(e) → 500 (sqlx errors, auto-From)
// AppError::NotFound → 404
// AppError::BadRequest(msg) → 400
// No new variants needed for Phase 04.
```

### CSS custom properties (no Tailwind)
**Source:** `frontend/app/admin/admin.css` (admin components), `frontend/app/globals.css` (public pages)
**Apply to:** All new frontend components
```typescript
// Admin analytics components (KpiCards, TrendChart, WardTable, ChoroplethMap):
//   Use var(--surface), var(--border), var(--ink), var(--font-mono), var(--r-lg)
//   from admin.css Direction-B tokens
// Public stats page (/stats):
//   Use var(--bg), var(--ink), var(--accent) from globals.css Direction-A tokens
// Never use Tailwind classes — inline style={{}} objects only
```

### `apiFetch` credential pattern
**Source:** `frontend/app/admin/lib/adminApi.ts` lines 139–158
**Apply to:** All new `adminApi.ts` functions (getWardAnalytics, getTrendData, getWardBoundaries)
```typescript
// All admin API calls route through apiFetch so credentials: 'include' is automatic.
// Export downloads (Blob responses) call fetch() directly but must include credentials: 'include'.
// Public /api/stats call does NOT need credentials.
```

### Dynamic import SSR guard for Leaflet
**Source:** `frontend/app/map/page.tsx` lines 36–52
**Apply to:** `ChoroplethMap.tsx`, `HeatmapLayer.tsx`
```typescript
// Any component that imports from leaflet, react-leaflet, or leaflet.heat must be
// loaded with: dynamic(() => import("./ComponentName"), { ssr: false })
// The component file itself does NOT need "use client" when imported this way,
// but the wrapping page does (or must be a server component that delegates rendering).
```

### SQL const + test helper pattern
**Source:** `backend/src/db/admin_queries.rs` lines 877–909, 1113–1126
**Apply to:** All new SQL constants in `admin_queries.rs` (EXPORT_CSV_SQL, PUBLIC_GEOJSON_SQL, WARD_ANALYTICS_SQL, TREND_SQL)
```rust
// 1. Define SQL as a module-level const &str
// 2. Expose a pub fn returning the const for tests (no live DB needed)
// 3. Tests assert on string fragments (column names, SQL keywords, bound params)
// This is the established pattern — never use sqlx::query! macros (require live DB at compile time)
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/src/handlers/stats.rs` (new public GeoJSON streaming) | handler | streaming | No streaming response handler exists in codebase yet — closest is the non-streaming `wards.rs`; streaming pattern must follow RESEARCH.md Pattern 1 exactly |

---

## Metadata

**Analog search scope:** `backend/src/`, `frontend/app/`, `nginx/`
**Files scanned:** 23 Rust files, 87 TypeScript/TSX files, 2 nginx configs, 10 migration files
**Pattern extraction date:** 2026-05-31

**Key patterns identified:**
1. SQL constants as `const &str` with test-only `pub fn fragment()` helpers — no compile-time sqlx macros
2. Dynamic WHERE clause via `build_report_where_clause` — reusable for export filter params
3. `apiFetch` with `credentials: 'include'` for all admin API calls — never bypass via direct `fetch()`
4. Direction-B CSS tokens (`var(--surface)`, `var(--border)`, etc.) via inline `style={{}}` — no Tailwind in admin components
5. `dynamic(() => import(...), { ssr: false })` for ALL Leaflet-touching components — required by Leaflet's `window` dependency
6. `AppError::RateLimited` + governor keyed rate limiter pattern — established in `reports.rs`; replicate for public GeoJSON with separate quota pool on `AppState`
7. `Body::from_stream` (Axum 0.7) + mpsc channel — the streaming export pattern; `StreamBody` does not exist in this codebase version
