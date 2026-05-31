# Phase 04: Export and Public Analytics — Research

**Researched:** 2026-05-31
**Domain:** Streaming exports (Rust/Axum), PostgreSQL materialized views + triggers, recharts, leaflet.heat, nginx rate limiting, admin analytics
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Heatmap Visualization (MAP-02, ANALYTICS-05)**
- D-01: Two separate visual layers — `/map`: `leaflet.heat` point-density heatmap; `/admin/analytics`: ward choropleth using react-leaflet GeoJSON layer
- D-02: Public heatmap shows open/unresolved reports only — resolved reports do not add heat
- D-03: Heatmap toggle lives in native Leaflet layer control (`L.control.layers`, top-right) — not the chip filter strip
- D-04: Admin choropleth is interactive — clicking a ward filters the analytics tables and trend chart

**Admin Analytics Page Structure**
- D-05: New dedicated `/admin/analytics` route with sidebar nav entry; existing `/admin` dashboard unchanged
- D-06: Page layout: KPI cards + trend chart at top (full width); ward table + choropleth map side-by-side at bottom
- D-07: Export buttons (CSV + GeoJSON) appear on BOTH pages: `/admin/reports` (uses existing filter bar) and `/admin/analytics` (simplified date picker or defaults)
- D-08: Public stats page is `/stats` (not embedded in home page `/`)

**Charts Library (ANALYTICS-04)**
- D-09: Use recharts for all chart components
- D-10: Trend chart is a line chart (reports per week × 12 weeks) — not bar
- D-11: Category filter on trend chart: multi-select with legend toggle

**CSV Export (EXPORT-01)**
- D-12: CSV uses English category labels — no Kannada text
- D-13: Column set: `id`, `submission_date` (DD/MM/YYYY), `category` (English), `severity`, `status`, `ward_name`, `corporation`, `latitude`, `longitude`, `description`, `assigned_org`, `photo_hash`, `duplicate_count`, `submitter_contact`, `resolved_at` (when present), `resolution_notes` (when present)
- D-14: UTF-8 without BOM
- D-15: Streaming response — no memory buffering; tokio-util + bytes pattern

**GeoJSON Export (EXPORT-02, EXPORT-03)**
- D-16: Admin GeoJSON: streaming FeatureCollection, filtered by same params as CSV
- D-17: Public GeoJSON: includes `id`, `category`, `severity`, `status`, `ward_name`, `corporation`, `submitted_at` (date only), `description`, `after_photo_url` (when present), `resolution_notes` (when present), `resolved_at` (when present). Coordinates rounded to 3 decimal places. No PII.
- D-18: Public GeoJSON rate-limited at both layers (nginx zone + governor crate)

**Materialized View (ANALYTICS-01)**
- D-19: Public stats materialized view refreshes via PostgreSQL trigger on reports table — `REFRESH MATERIALIZED VIEW CONCURRENTLY`. No pg_cron.

**Road Network**
- D-20: Road network KML deferred to Phase 6

### Claude's Discretion

- Exact recharts component props, ResponsiveContainer sizing, tooltip formatting
- Ward choropleth color scale (low unresolved = light teal, high = deep red/amber)
- leaflet.heat intensity/radius parameters for Bengaluru city zoom level
- `/stats` public page visual design (Direction-A, globals.css)
- nginx zone name and rate for public GeoJSON endpoint
- Whether public GeoJSON URL is `/api/reports.geojson` or `/api/reports/export.geojson`

### Deferred Ideas (OUT OF SCOPE)

- Road network KML import (road_segments, road_width_segments) — Phase 6
- Ward boundary polygon overlay on public map (MAP-V2-02)
- Category and status filter controls on public map (MAP-V2-01)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-02 | Toggleable heatmap layer on public map showing issue density | leaflet.heat section; L.control.layers pattern |
| EXPORT-01 | Admin filtered CSV export (DD/MM/YYYY dates, ward name, streaming) | Streaming pattern section; CSV column mapping |
| EXPORT-02 | Admin filtered GeoJSON export (streaming, valid for QGIS) | Streaming GeoJSON pattern section |
| EXPORT-03 | Public unauthenticated GeoJSON (coords rounded to 3dp, no PII) | Rate limiting section; governor crate pattern |
| ANALYTICS-01 | Public stats page from materialized view (total, resolved, top 3 categories) | Materialized view section; trigger pattern |
| ANALYTICS-02 | Admin top 10 wards by unresolved report count | Ward analytics SQL section |
| ANALYTICS-03 | Admin resolution rate per corporation | Corporation analytics SQL section |
| ANALYTICS-04 | Admin trend chart: reports/week × 12 weeks, filterable by category | recharts section |
| ANALYTICS-05 | Admin choropleth: ward fill color by unresolved report density | react-leaflet GeoJSON section; /api/wards/boundaries section |
</phase_requirements>

---

## Summary

Phase 4 extends the existing Rust/Axum backend and Next.js 14 admin portal with four capabilities: streaming CSV/GeoJSON exports behind admin auth, a public unauthenticated GeoJSON data endpoint, a public `/stats` page fed by a PostgreSQL materialized view, an admin analytics dashboard at `/admin/analytics` using recharts, and a toggleable heatmap on the public map using leaflet.heat.

The backend work is entirely additive — new DB functions in `admin_queries.rs`, new handlers wired into `main.rs`, two new nginx rate-limit zones (one in both `nginx.conf` and `nginx.server.conf`), and one new migration (materialized view + trigger). The frontend adds recharts line/bar charts in a new `/admin/analytics` page, leaflet.heat in the existing `/map` page, and a standalone `/stats` public page.

The most complex piece is streaming — `tokio-util` and `bytes` are already in `Cargo.toml` and the `AppState` pattern is established. The materialized view CONCURRENTLY refresh via a trigger is a standard PostgreSQL pattern that works reliably in PostGIS environments. recharts and leaflet.heat both exist on npm and have established usage in the React/Leaflet ecosystems.

**Primary recommendation:** Build in plan order — 04-01 (streaming exports, unlocks GBA use case), 04-02 (public GeoJSON + /stats, lowest risk), 04-03 (admin analytics dashboard), 04-04 (heatmap). No cross-plan dependencies except 04-03 and 04-04 can share the `GET /api/wards/boundaries` endpoint introduced in 04-03.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSV streaming export | API / Backend (Rust/Axum) | — | Streams row-by-row; no frontend buffering |
| Admin GeoJSON export | API / Backend (Rust/Axum) | — | Same as CSV; streaming FeatureCollection |
| Public GeoJSON endpoint | API / Backend (Rust/Axum) + nginx | — | Rate limiting at both layers per D-18 |
| Public stats data | Database (materialized view) + API/Backend | — | Materialized view feeds the stats API endpoint |
| Public stats page | Frontend Server (Next.js) | API/Backend | Page can SSR-fetch from materialized view endpoint |
| Admin analytics KPIs | API / Backend + Database | Frontend (recharts) | Backend aggregates, frontend renders |
| Ward choropleth GeoJSON | API / Backend (new /api/wards/boundaries) | Frontend (react-leaflet) | Ward polygons served as GeoJSON FeatureCollection |
| Trend chart | Frontend (recharts) | API/Backend (weekly aggregation query) | Backend provides data, recharts renders |
| Heatmap layer | Frontend / Browser (leaflet.heat) | API/Backend | Heatmap renders in browser from fetched coordinates |
| nginx rate limiting | CDN / Static (nginx) | — | First line of defense per D-18 |
| App-layer rate limiting | API / Backend (governor) | — | Second line of defense per D-18 |

---

## Standard Stack

### Core (No New Backend Dependencies Needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tokio-util | 0.7 (in Cargo.toml) | ReaderStream / StreamBody conversion | Already in Cargo.toml [VERIFIED: Cargo.toml] |
| bytes | 1 (in Cargo.toml) | Bytes / BytesMut for chunk assembly | Already in Cargo.toml [VERIFIED: Cargo.toml] |
| governor | 0.10 (in Cargo.toml) | App-layer rate limiting for public GeoJSON | Already in use for ABUSE-01 [VERIFIED: Cargo.toml] |
| sqlx | 0.7 (in Cargo.toml) | PostgreSQL queries + materialized view | Already in use [VERIFIED: Cargo.toml] |
| serde_json | 1 (in Cargo.toml) | JSON assembly for GeoJSON chunks | Already in use [VERIFIED: Cargo.toml] |
| chrono | 0.4 (in Cargo.toml) | Date formatting for CSV (DD/MM/YYYY) | Already in use [VERIFIED: Cargo.toml] |

### New Frontend Dependencies

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 | Line/bar charts for analytics dashboard | Established React charting library; MIT; GitHub: recharts/recharts [VERIFIED: npm registry] |
| leaflet.heat | 0.2.0 | Heatmap layer plugin for Leaflet | Official Leaflet plugin; GitHub: Leaflet/Leaflet.heat [VERIFIED: npm registry] |
| @types/leaflet.heat | 0.2.5 | TypeScript types for leaflet.heat | DefinitelyTyped maintained [VERIFIED: npm registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | nivo | nivo has better default aesthetics but heavier bundle; recharts is simpler to integrate with Direction-B CSS tokens; user locked recharts (D-09) |
| leaflet.heat | deck.gl | deck.gl is overkill for MVP density heatmap; leaflet.heat integrates directly with existing Leaflet instance |
| PostgreSQL trigger refresh | pg_cron | pg_cron requires extension install; trigger approach works with existing PostGIS setup per D-19 |

**Installation:**
```bash
cd frontend
npm install recharts leaflet.heat @types/leaflet.heat
```

**Version verification (confirmed 2026-05-31):**
- recharts: `3.8.1` (published 2026-03-25, GitHub: recharts/recharts, MIT)
- leaflet.heat: `0.2.0` (published 2022-06-19, GitHub: Leaflet/Leaflet.heat, no explicit license — BSD-2 in source)
- @types/leaflet.heat: `0.2.5` (DefinitelyTyped, updated 2025-09-03)

---

## Package Legitimacy Audit

> slopcheck 0.6.1 was available but incorrectly checked PyPI (Python registry) for npm packages — both `recharts` and `leaflet.heat` were flagged as PyPI SLOP, which is a cross-ecosystem false positive. Manual npm registry verification was performed instead.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| recharts | npm | ~10 yrs | Very high (core React charts lib) | github.com/recharts/recharts | N/A (cross-ecosystem FP — verified on npm) | Approved |
| leaflet.heat | npm | ~12 yrs | Moderate | github.com/Leaflet/Leaflet.heat | N/A (cross-ecosystem FP) | Approved |
| @types/leaflet.heat | npm | ~5 yrs | Low (types package) | github.com/DefinitelyTyped/DefinitelyTyped | N/A (cross-ecosystem FP) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (all flags were cross-ecosystem false positives — packages are npm, slopcheck checked PyPI)
**Packages flagged as suspicious [SUS]:** none

**No suspicious postinstall scripts detected** — `npm view recharts scripts.postinstall` and `npm view leaflet.heat scripts.postinstall` returned no output.

**Cross-ecosystem note:** slopcheck 0.6.1 on this machine defaults to PyPI registry. All three packages are Node.js/npm packages confirmed via `npm view` against the official npm registry. The SLOP verdict is a known false-positive pattern for PyPI-defaulting slopcheck on npm packages.

---

## Architecture Patterns

### System Architecture Diagram

```
Admin browser                          Public browser
     │                                      │
     │ GET /api/admin/reports/export/csv     │ GET /api/reports.geojson (or /export.geojson)
     │ GET /api/admin/reports/export/geojson │
     │ GET /api/admin/analytics              │ GET /api/stats (materialized view)
     │                                       │
     ▼                                       ▼
  nginx (with rate-limit zones)         nginx (geojson_public zone)
     │                                       │
     ▼                                       ▼
  Axum (require_auth middleware)      Axum (governor crate check)
     │                                       │
     ├── stream_csv_export()                 ├── list_public_geojson() → coords rounded
     │     └── build_report_where_clause()   │
     ├── stream_geojson_export()             └── get_public_stats() → reads materialized view
     │     └── same filter params            
     ├── get_ward_analytics()        
     │     └── top 10 wards by unresolved count
     ├── get_corporation_analytics()
     │     └── resolution rate per corp
     ├── get_trend_data()            
     │     └── reports/week × 12 weeks
     └── GET /api/wards/boundaries
           └── ward polygons + unresolved_count
     
  PostgreSQL / PostGIS
     │
     ├── reports table (trigger: AFTER INSERT OR UPDATE)
     │       └── REFRESH MATERIALIZED VIEW CONCURRENTLY public_stats_mv
     ├── public_stats_mv (total, resolved, top_3_categories)
     ├── wards table (boundary geometry + ward_name + corporation)
     └── organizations table (corporation names)

Frontend: Next.js 14
  ├── /admin/analytics (new)
  │     ├── recharts LineChart (trend)
  │     ├── recharts BarChart (ward table / corp resolution)
  │     └── react-leaflet GeoJSON layer (choropleth from /api/wards/boundaries)
  ├── /admin/reports (extend existing)
  │     └── Export CSV/GeoJSON download buttons
  ├── /map (extend existing)
  │     └── leaflet.heat layer + L.control.layers toggle
  └── /stats (new public page)
        └── reads /api/stats
```

### Recommended Project Structure (new files only)

```
backend/src/
├── db/
│   ├── admin_queries.rs      — ADD: stream_csv_export, stream_geojson_export, 
│   │                           get_ward_analytics, get_corporation_analytics,
│   │                           get_trend_data, get_public_geojson
│   └── queries.rs            — ADD: get_public_stats (reads materialized view)
├── handlers/
│   └── admin.rs              — ADD: admin_export_csv, admin_export_geojson,
│                               admin_get_ward_analytics, admin_get_corporation_analytics,
│                               admin_get_trend_data, admin_get_wards_boundaries
├── handlers/
│   └── stats.rs              — NEW: public_get_stats (unauthenticated)
└── migrations/
    └── 011_analytics_mv.sql  — NEW: materialized view + trigger

frontend/app/
├── admin/analytics/
│   └── page.tsx              — NEW: admin analytics page
├── stats/
│   └── page.tsx              — NEW: public stats page
├── admin/reports/
│   └── page.tsx              — EXTEND: add export buttons
└── admin/
    └── AdminSidebar.tsx      — EXTEND: add "Analytics" nav entry
```

### Pattern 1: Streaming CSV Export in Axum

**What:** Build a streaming `Response` from an async row stream using `tokio_util::io::ReaderStream` + `axum::body::Body::from_stream`. Each row is serialized to a CSV line and yielded as a `Bytes` chunk.

**When to use:** Any download endpoint that must avoid loading all rows into memory. Use for CSV (EXPORT-01) and GeoJSON (EXPORT-02) admin exports.

**Example:**
```rust
// Source: [ASSUMED] — tokio-util + axum Body pattern; verified tokio-util 0.7 is in Cargo.toml
use axum::{
    body::Body,
    http::{header, StatusCode},
    response::Response,
};
use bytes::Bytes;
use tokio_util::io::ReaderStream;
use tokio::sync::mpsc;
use futures::stream::StreamExt;

pub async fn admin_export_csv(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthJwtClaims>,
    Query(filters): Query<AdminReportFilters>,
) -> Result<Response, AppError> {
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Bytes, std::io::Error>>(32);

    // Spawn writer task
    let pool = Arc::clone(&state.pool);
    tokio::spawn(async move {
        // Write CSV header
        let header = "id,submission_date,category,...\n";
        let _ = tx.send(Ok(Bytes::from(header))).await;

        // Stream rows
        let mut rows = sqlx::query(EXPORT_SQL)
            .bind(/* filters */)
            .fetch(&*pool);

        while let Some(row) = rows.next().await {
            match row {
                Ok(r) => {
                    let line = format_csv_row(&r);
                    let _ = tx.send(Ok(Bytes::from(line))).await;
                }
                Err(e) => {
                    let _ = tx.send(Err(std::io::Error::other(e.to_string()))).await;
                    break;
                }
            }
        }
    });

    let stream = tokio_stream::wrappers::ReceiverStream::new(rx);
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

**Key pitfalls:**
- `Body::from_stream` requires `Item = Result<Bytes, E>` where `E: Into<BoxError>`. Use `std::io::Error` as the error type.
- The mpsc channel buffer (32 rows) prevents the spawned writer from running ahead of the TCP send buffer. Tune based on row size.
- `sqlx::query().fetch()` returns a `Stream` — use `.next().await` in a loop, not `.fetch_all()`.

---

### Pattern 2: Streaming GeoJSON FeatureCollection

**What:** Manually assemble a valid GeoJSON FeatureCollection by streaming the opening delimiter, features one-by-one (comma-delimited), then the closing delimiter. This avoids buffering the full collection in memory.

```rust
// GeoJSON streaming pattern — Source: [ASSUMED]
// Opening:
let _ = tx.send(Ok(Bytes::from_static(b"{\"type\":\"FeatureCollection\",\"features\":[\n"))).await;

// Per feature (coordinates rounded to 3dp):
let feature = serde_json::json!({
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": [lng_rounded, lat_rounded]  // GeoJSON is [lng, lat]
    },
    "properties": {
        "id": row_id,
        "category": category,
        // ...
    }
});
let mut chunk = feature.to_string();
if !is_last { chunk.push(','); }
let _ = tx.send(Ok(Bytes::from(chunk))).await;

// Closing:
let _ = tx.send(Ok(Bytes::from_static(b"\n]}"))).await;
```

**Critical:** GeoJSON coordinate order is `[longitude, latitude]`, not `[latitude, longitude]`. The existing codebase already handles this for ST_MakePoint — apply the same discipline here.

---

### Pattern 3: Application-Layer Rate Limiting (governor) for Public GeoJSON

**What:** Use the existing `governor` pattern from `create_report` handler to add a keyed rate limiter on the public GeoJSON endpoint. Use a different limiter instance (not the same one as ABUSE-01) to avoid cross-contaminating rate limits.

**Option A — Add a new limiter field to AppState:**
```rust
// In AppState struct:
pub geojson_rate_limiter: Arc<governor::DefaultKeyedRateLimiter<String>>,

// In main():
let geojson_quota = governor::Quota::per_minute(
    std::num::NonZeroU32::new(2).unwrap()  // 2 req/min per IP
);
let geojson_rate_limiter = Arc::new(governor::RateLimiter::keyed(geojson_quota));
```

**Option B — IP-only unkeyed limiter (simpler for public endpoint):**
```rust
// Governor also supports DefaultRateLimiter (not keyed) for per-IP limiting
// when the key is always the IP address only.
let geojson_quota = governor::Quota::per_minute(
    std::num::NonZeroU32::new(2).unwrap()
);
// Keyed by IP string — same pattern as existing rate_limiter
```

**Recommendation:** Option A (new limiter field on AppState). Separate quota pools prevent a spike on GeoJSON downloads from affecting report submission rates (ABUSE-01). [ASSUMED]

---

### Pattern 4: PostgreSQL Materialized View + Trigger Refresh

**What:** Create a materialized view for the public stats query, then refresh it on every INSERT or UPDATE to the reports table using a `AFTER INSERT OR UPDATE ON reports FOR EACH STATEMENT EXECUTE FUNCTION` trigger.

**Important PostgreSQL constraint:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index on the materialized view. The planner must include `CREATE UNIQUE INDEX` in the migration after creating the view.

**Migration skeleton:**
```sql
-- 011_analytics_mv.sql
CREATE MATERIALIZED VIEW public_stats_mv AS
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

-- Required for CONCURRENTLY refresh:
CREATE UNIQUE INDEX idx_public_stats_mv ON public_stats_mv ((1));

CREATE OR REPLACE FUNCTION refresh_public_stats_mv()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public_stats_mv;
    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_refresh_public_stats
AFTER INSERT OR UPDATE ON reports
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_public_stats_mv();
```

**Constraint:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires the view to have at least one unique index. The `(1)` expression trick creates a pseudo-unique index on a constant — valid for single-row aggregate views. [ASSUMED — verify works in PostGIS 3.x]

**Alternative if trigger refresh is too slow at scale:** Refresh only after a status change to 'resolved'/'closed' — filter the trigger with `WHEN (NEW.status IN ('resolved', 'closed'))`. At MVP scale (< 10k reports) a full-table refresh is < 50ms.

---

### Pattern 5: recharts Line Chart with Multi-Select Legend

**What:** Render a `<LineChart>` with one line per category, driven by weekly aggregated data. Recharts natively supports legend click-to-hide (D-11) via the `onClick` prop on `<Legend>`.

```tsx
// Source: [ASSUMED] — recharts 3.x API
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';

interface WeeklyDataPoint {
  week: string;  // "2025-W12" format
  [category: string]: number | string;  // one key per category
}

const CATEGORY_COLORS: Record<string, string> = {
  broken_footpath: 'var(--danger)',
  blocked_footpath: 'var(--warn)',
  no_footpath: 'var(--accent)',
  // ...
};

// Legend click-to-hide uses state:
const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

const handleLegendClick = (data: { dataKey: string }) => {
  setHiddenLines(prev => {
    const next = new Set(prev);
    if (next.has(data.dataKey)) next.delete(data.dataKey);
    else next.add(data.dataKey);
    return next;
  });
};

// In JSX:
<ResponsiveContainer width="100%" height={280}>
  <LineChart data={weeklyData}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
    <XAxis dataKey="week" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
    <YAxis style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
    <Tooltip />
    <Legend onClick={handleLegendClick} />
    {CATEGORIES.map(cat => (
      <Line
        key={cat}
        type="monotone"
        dataKey={cat}
        stroke={CATEGORY_COLORS[cat]}
        strokeWidth={2}
        dot={false}
        hide={hiddenLines.has(cat)}
      />
    ))}
  </LineChart>
</ResponsiveContainer>
```

**Note:** recharts `<Line hide={true}>` suppresses the line but keeps it in the legend. The `onClick` on `<Legend>` receives `{ dataKey, value }`. [ASSUMED — verify against recharts 3.8.1 docs]

---

### Pattern 6: leaflet.heat Integration in Next.js 14

**What:** leaflet.heat is a Leaflet plugin that adds a `L.heatLayer` function. In a Next.js 14 SSR context it must be dynamically imported with `ssr: false` (same as react-leaflet maps). The heat layer is added to the Leaflet map instance via `useEffect`.

**Critical:** leaflet.heat attaches itself to the `L` global when imported. In a Next.js module system, use:
```typescript
// Inside the component file that is already SSR-disabled:
import 'leaflet.heat';
// After this import, L.heatLayer() is available via the leaflet instance
```

**Pattern:**
```tsx
// In the ReportsMap component (already dynamic/ssr:false):
import 'leaflet.heat';  // side-effect import — attaches to L

const heatmapLayer = useRef<L.HeatLayer | null>(null);

// When map is ready and open reports data changes:
useEffect(() => {
  if (!mapRef.current) return;
  
  if (heatmapLayer.current) {
    heatmapLayer.current.remove();
  }
  
  const openReports = reports.filter(r => r.status === 'open');
  const heatPoints: [number, number, number][] = openReports.map(r => [
    r.latitude, r.longitude, 1.0  // [lat, lng, intensity]
  ]);
  
  heatmapLayer.current = (L as any).heatLayer(heatPoints, {
    radius: 25,
    blur: 15,
    maxZoom: 14,
    gradient: { 0.4: '#00bcd4', 0.65: '#ff9800', 1: '#f44336' }
  });
  
  // Add to layer control
}, [reports, showHeatmap]);
```

**L.control.layers integration:**
```tsx
// In the map setup useEffect:
const heatLayerRef = L.heatLayer([], { radius: 25 });
const baseMaps = {};
const overlays = {
  'Issue Density': heatLayerRef
};
L.control.layers(baseMaps, overlays, { position: 'topright' }).addTo(map);
```

**TypeScript:** `@types/leaflet.heat` provides `L.HeatLayer` and `L.heatLayer`. If the types don't merge cleanly with the leaflet namespace, cast with `(L as any).heatLayer(...)`. [ASSUMED — verify with @types/leaflet.heat 0.2.5]

---

### Pattern 7: Ward Choropleth with react-leaflet GeoJSON

**What:** Use `<GeoJSON>` from `react-leaflet` to render ward boundary polygons with `style` prop computing fill color from `unresolved_count` property.

```tsx
// Source: [ASSUMED] — react-leaflet 4.x API (4.2.1 in package.json)
import { GeoJSON } from 'react-leaflet';

interface WardFeature extends GeoJSON.Feature<GeoJSON.MultiPolygon> {
  properties: {
    ward_name: string;
    ward_number: number;
    unresolved_count: number;
  };
}

const getWardColor = (count: number): string => {
  if (count === 0) return 'var(--surface-2)';
  if (count < 5)  return 'oklch(0.85 0.08 185)';  // light teal
  if (count < 15) return 'oklch(0.75 0.12 60)';   // amber
  if (count < 30) return 'oklch(0.65 0.16 40)';   // orange
  return 'oklch(0.56 0.20 25)';                    // danger red
};

<GeoJSON
  data={wardBoundaries}
  style={(feature) => ({
    fillColor: getWardColor(feature?.properties?.unresolved_count ?? 0),
    fillOpacity: 0.6,
    weight: 1,
    color: 'var(--border-strong)',
  })}
  onEachFeature={(feature, layer) => {
    layer.on('click', () => {
      onWardClick(feature.properties.ward_name);
    });
  }}
/>
```

**New backend endpoint required:** `GET /api/wards/boundaries` — returns GeoJSON FeatureCollection of ward polygons with `unresolved_count` joined. The ward geometry is the `boundary` column (GEOGRAPHY type) — needs `ST_AsGeoJSON(boundary)` to convert for the API response.

---

### Pattern 8: CSV Date Formatting (DD/MM/YYYY)

```rust
// Source: [VERIFIED: Cargo.toml — chrono 0.4 in project]
use chrono::{DateTime, Utc};

fn format_csv_date(dt: &DateTime<Utc>) -> String {
    dt.format("%d/%m/%Y").to_string()
}

// For resolved_at (may be None): 
fn format_csv_date_opt(dt: Option<&DateTime<Utc>>) -> String {
    dt.map(|d| d.format("%d/%m/%Y").to_string()).unwrap_or_default()
}
```

### Anti-Patterns to Avoid

- **Buffering all rows:** Never use `fetch_all` in export handlers — use `fetch` (streaming) and send chunks via mpsc channel
- **Missing unique index on materialized view:** `REFRESH MATERIALIZED VIEW CONCURRENTLY` silently fails without a unique index on the view
- **Leaflet.heat before Leaflet init:** The heat layer must be added after the map instance is created (in `whenReady` or `useEffect` after map ref is set)
- **Rendering recharts in SSR context:** Recharts uses browser APIs — wrap in `'use client'` or dynamic import with `ssr: false`
- **GeoJSON coordinate order:** GeoJSON uses `[longitude, latitude]` not `[latitude, longitude]` — invert from the existing Rust backend convention
- **CONCURRENTLY on non-unique view:** A view with non-unique rows cannot be refreshed CONCURRENTLY. The aggregate stats view must yield exactly one row, guaranteeing uniqueness.
- **Inline `process.env` in components:** Per CLAUDE.md, all env-var-based config must live in `frontend/app/lib/config.ts`. The new `/stats` page must import `API_BASE_URL` from there.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trend chart rendering | Custom SVG/canvas line chart | recharts `<LineChart>` | Recharts handles responsive sizing, legend, tooltip, animation, accessibility out of the box |
| Heatmap density map | Custom canvas kernel density estimation | leaflet.heat | Leaflet.heat implements Gaussian blur kernel with WebGL fallback — non-trivial math |
| CSV serialization | String concatenation with manual escaping | chrono formatting + manual but simple output (no dependencies needed) | CSV escaping is subtler than it looks (commas in descriptions, quotes in notes) — use `format!` with explicit quoting for Description and Notes fields |
| Ward choropleth geometry | Custom polygon rendering | react-leaflet `<GeoJSON>` + `ST_AsGeoJSON()` | PostGIS ST_AsGeoJSON produces valid RFC 7946 GeoJSON; react-leaflet handles the canvas rendering |
| App-layer rate limiting | Token bucket from scratch | governor crate (already in Cargo.toml) | governor implements correct GCRA algorithm; already used for ABUSE-01 |

**Key insight:** The combination of `tokio-util` + `bytes` + `Body::from_stream` is the established Axum pattern for streaming responses. Any hand-rolled alternative using `Vec<u8>` buffers will OOM on large datasets.

---

## Schema Investigation: Missing Fields for EXPORT-01/D-13

CONTEXT.md D-13 specifies the CSV export should include `resolved_at`, `after_photo_url`, and `assigned_org`. None of these column names exist in the current schema:

- **`resolved_at`:** The reports table has no `resolved_at` timestamp column. The closest is `status_history` (records when status changed to 'resolved'). **The planner must decide:** either add a `resolved_at` column to reports (set via trigger or in `resolve_report()` function), or derive it via a subquery on `status_history` in the export query.
  - Recommended: Add `resolved_at TIMESTAMPTZ` to reports in migration 011, set in `resolve_report()` DB function alongside resolution_photo_path.

- **`after_photo_url`:** The column name in the schema is `resolution_photo_path` (image path, not URL). The export should transform this to a URL using `api_base_url`. For CSV, the column header should be `after_photo_url` but the value is constructed as `{api_base}/uploads/{resolution_photo_path}`.

- **`assigned_org`:** Reports have `assigned_org_id` (UUID FK to organizations). The export needs the org name — requires a LEFT JOIN with organizations table in the export query. Column in export: `assigned_org` (name string, not UUID).

- **`submitter_contact`:** Already exists on reports table as `submitter_contact` (TEXT, nullable). No migration needed.

These gaps require a new migration (011) with at minimum:
```sql
ALTER TABLE reports ADD COLUMN resolved_at TIMESTAMPTZ;
```
Plus updating `resolve_report()` in `admin_queries.rs` to SET `resolved_at = NOW()` when transitioning to 'resolved' or 'closed'.

---

## nginx Rate Limiting for Public GeoJSON (Claude's Discretion)

**Recommended values:**
- Zone name: `geojson_public`
- Rate: `2r/m` per IP (2 requests per minute)
- Burst: `1 nodelay`
- Memory: `10m` (same as existing zones)

**Rationale:** The full GeoJSON payload could be 5-50 MB at scale. 2 req/min prevents a single IP from repeatedly downloading the full dataset. The nginx zone is the primary layer (D-18); governor provides defense-in-depth at the same threshold.

**nginx config addition (both `nginx.conf` and `nginx.server.conf`):**
```nginx
# Public GeoJSON open-data endpoint — rate limited to prevent bulk scraping.
# Primary layer per D-18; application-layer governor provides defense-in-depth.
limit_req_zone $binary_remote_addr zone=geojson_public:10m rate=2r/m;
```

**Location block (in both configs, under the `/api/` location or as a more specific match):**
```nginx
# More specific than /api/ — exact endpoint protection
location = /api/reports.geojson {
    limit_req zone=geojson_public burst=1 nodelay;
    limit_req_status 429;
    proxy_pass http://backend;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;  # Streaming endpoint; extend from default 30s
}
```

**URL decision (Claude's discretion):** Use `/api/reports.geojson` — cleaner URL semantically (the GeoJSON IS the reports resource), and an exact-match location `= /api/reports.geojson` takes precedence over the prefix `/api/` block. If `/api/reports/export.geojson` is preferred, use prefix match `location /api/reports/export.geojson`.

**IMPORTANT:** The `proxy_read_timeout` for streaming endpoints must be extended beyond the default 30s. A full GeoJSON export of thousands of reports may take > 30s to complete streaming to the client.

---

## Common Pitfalls

### Pitfall 1: Axum StreamBody vs Body::from_stream (Axum 0.7)
**What goes wrong:** Documentation examples often show `StreamBody` (Axum 0.6 API) which was removed in Axum 0.7. Using it produces a compile error.
**Why it happens:** LLM training data and many Stack Overflow posts predate Axum 0.7.
**How to avoid:** In Axum 0.7, use `axum::body::Body::from_stream(stream)`. The stream item type must be `Result<impl Into<Bytes>, impl Into<BoxError>>`.
**Warning signs:** `StreamBody` import not found; compiler suggests no such type in `axum::body`.

### Pitfall 2: REFRESH MATERIALIZED VIEW CONCURRENTLY Requires Unique Index
**What goes wrong:** Running `REFRESH MATERIALIZED VIEW CONCURRENTLY` on a view with no unique index fails with: `ERROR: cannot refresh materialized view "public_stats_mv" concurrently — Data-modifying statements are not allowed in rules.`
**Why it happens:** CONCURRENTLY requires PostgreSQL to compute a diff, which needs a unique key.
**How to avoid:** Always add `CREATE UNIQUE INDEX` immediately after `CREATE MATERIALIZED VIEW`. For a single-row aggregate view, `CREATE UNIQUE INDEX ON mv_name ((1))` (constant expression index) works.
**Warning signs:** Migration applies but triggers fail at runtime with the above error.

### Pitfall 3: leaflet.heat TypeScript namespace conflict
**What goes wrong:** `@types/leaflet.heat` augments the `L` namespace. If imported in a file that also does `import * as L from 'leaflet'`, TypeScript may not merge the augmentation, leading to "Property 'heatLayer' does not exist on type 'typeof L'".
**Why it happens:** TypeScript namespace augmentation requires the augmenting module to be in the same scope.
**How to avoid:** Import `leaflet.heat` as a side-effect import (`import 'leaflet.heat'`) in the same component file that uses `L.heatLayer`. If types still don't resolve, use `(L as any).heatLayer(...)` with a local type assertion.
**Warning signs:** TypeScript error on `L.heatLayer` despite @types/leaflet.heat being installed.

### Pitfall 4: GeoJSON Coordinate Order (longitude, latitude)
**What goes wrong:** GeoJSON RFC 7946 specifies coordinates as `[longitude, latitude]` (X, Y), but the existing backend stores and returns data as `latitude, longitude`. Feeding `[lat, lng]` to GeoJSON produces coordinates that appear in the ocean off West Africa.
**Why it happens:** The Rust codebase uses `lat` first (correct for PostGIS — ST_MakePoint takes (lng, lat)), but GeoJSON consumers (QGIS, Mapbox) expect `[lng, lat]`.
**How to avoid:** In the GeoJSON export handler, always write `"coordinates": [longitude_rounded, latitude_rounded]` — note the reversal from the database column names.
**Warning signs:** Exported GeoJSON imports into QGIS with all points clustered near 0°N, 0°E.

### Pitfall 5: CSV Description/Notes Field Escaping
**What goes wrong:** Report descriptions and resolution notes are free-text and may contain commas, double quotes, or newlines — all of which break naive CSV output.
**Why it happens:** No CSV library is being added to Cargo.toml; manual CSV generation requires explicit escaping rules.
**How to avoid:** Wrap every free-text field in double quotes and escape internal double quotes by doubling them: `"` → `""`. Newlines in fields should be removed or replaced with spaces before CSV serialization.
**Pattern:**
```rust
fn csv_escape(s: &str) -> String {
    format!("\"{}\"", s.replace('"', "\"\"").replace('\n', " ").replace('\r', ""))
}
```
**Warning signs:** Excel opens the CSV with rows merging into each other; fields spill into the wrong columns.

### Pitfall 6: recharts SSR in Next.js 14
**What goes wrong:** recharts imports browser-only APIs (ResizeObserver, SVG methods). Rendering a recharts component in a Next.js Server Component or in a `use client` component without SSR guard causes hydration errors or server-side crashes.
**Why it happens:** Next.js 14 App Router components default to server-rendering. recharts requires the browser DOM.
**How to avoid:** Mark analytics page as `'use client'` OR use `next/dynamic` with `ssr: false` for the chart section. The chart data can be fetched server-side and passed as props; only the rendering component needs `'use client'`.
**Warning signs:** `window is not defined` or `ResizeObserver is not a constructor` errors in server logs.

### Pitfall 7: ST_AsGeoJSON for Ward Boundaries — returns GEOMETRY not GEOGRAPHY
**What goes wrong:** The `boundary` column in the wards table is GEOGRAPHY type. `ST_AsGeoJSON` works on GEOGRAPHY but returns coordinates in the order they're stored (lon, lat for SRID 4326 geography). Passing the raw text output to react-leaflet `<GeoJSON>` is correct, but large boundary polygons may be very verbose JSON.
**Why it happens:** Ward boundary polygons (from migration 004) are MULTIPOLYGON types with many vertices.
**How to avoid:** Use `ST_AsGeoJSON(ST_Simplify(boundary::geometry, 0.001))` to reduce vertex count for the choropleth visualization (0.001 degrees ≈ 100m simplification). The simplified geometry is sufficient for visual display; the full geometry remains in the DB for spatial queries.
**Warning signs:** `/api/wards/boundaries` response is > 10MB; browser tab freezes when rendering.

### Pitfall 8: resolved_at Column Does Not Exist Yet
**What goes wrong:** EXPORT-01/D-13 specifies `resolved_at` in the CSV export. The current `reports` table has no `resolved_at` column — only `resolution_photo_path` and `resolution_notes`. Querying for `resolved_at` without the migration causes a runtime SQL error.
**Why it happens:** The column was not added in migration 008 (workflow migration).
**How to avoid:** Migration 011 must add `resolved_at TIMESTAMPTZ` to reports. The `resolve_report()` DB function must SET `resolved_at = NOW()` when transitioning to 'resolved' or 'closed'.
**Warning signs:** Export query fails with "column reports.resolved_at does not exist".

---

## Code Examples

### CSV Date Formatting Pattern
```rust
// Source: [VERIFIED: Cargo.toml — chrono 0.4 in project]
use chrono::{DateTime, Utc};

fn format_dd_mm_yyyy(dt: &DateTime<Utc>) -> String {
    dt.format("%d/%m/%Y").to_string()
}
```

### Public GeoJSON Endpoint: governor Rate Check
```rust
// Source: [VERIFIED: Cargo.toml — governor 0.10 in project]
// Pattern derived from existing create_report handler (reports.rs lines 251-252)
if state.geojson_rate_limiter.check_key(&client_ip).is_err() {
    return Err(AppError::RateLimited(
        "Rate limit exceeded for public data endpoint. Try again later.".to_string()
    ));
}
```

### SQL: Top 10 Wards by Unresolved Count (ANALYTICS-02)
```sql
-- Source: [ASSUMED] — derived from existing schema knowledge
SELECT
    w.ward_name,
    w.ward_number,
    COUNT(r.id) FILTER (
        WHERE r.status NOT IN ('resolved', 'closed')
    ) AS unresolved_count,
    COUNT(r.id) AS total_count
FROM wards w
LEFT JOIN reports r ON r.ward_id = w.id
GROUP BY w.id, w.ward_name, w.ward_number
ORDER BY unresolved_count DESC
LIMIT 10
```

### SQL: Resolution Rate per Corporation (ANALYTICS-03)
```sql
-- Source: [ASSUMED] — derived from existing schema knowledge
SELECT
    o.name AS corporation,
    COUNT(r.id) AS total_reports,
    COUNT(r.id) FILTER (
        WHERE r.status IN ('resolved', 'closed')
    ) AS resolved_count,
    ROUND(
        100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('resolved', 'closed'))
        / NULLIF(COUNT(r.id), 0),
        1
    ) AS resolution_rate_pct
FROM organizations o
JOIN wards w ON w.org_id = o.id
LEFT JOIN reports r ON r.ward_id = w.id
WHERE o.org_type = 'corporation'
GROUP BY o.id, o.name
ORDER BY resolution_rate_pct DESC NULLS LAST
```

### SQL: Trend Data — Reports/Week × 12 Weeks (ANALYTICS-04)
```sql
-- Source: [ASSUMED] — derived from existing INTAKE_SQL pattern in admin_queries.rs
SELECT
    DATE_TRUNC('week', created_at AT TIME ZONE 'UTC')::DATE::TEXT AS week_start,
    category::TEXT AS category,
    COUNT(*) AS report_count
FROM reports
WHERE created_at >= NOW() - INTERVAL '12 weeks'
GROUP BY 1, 2
ORDER BY 1, 2
```

### SQL: Ward Boundaries with Unresolved Count (ANALYTICS-05)
```sql
-- Source: [ASSUMED] — derived from existing schema knowledge + PostGIS ST_AsGeoJSON
SELECT
    w.id,
    w.ward_name,
    w.ward_number,
    ST_AsGeoJSON(ST_Simplify(w.boundary::geometry, 0.001)) AS boundary_geojson,
    COUNT(r.id) FILTER (
        WHERE r.status NOT IN ('resolved', 'closed')
    ) AS unresolved_count
FROM wards w
LEFT JOIN reports r ON r.ward_id = w.id
GROUP BY w.id, w.ward_name, w.ward_number, w.boundary
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Axum `StreamBody` | `axum::body::Body::from_stream` | Axum 0.7 (2023) | StreamBody import will not compile in this codebase |
| recharts v1/v2 SSR issues | recharts 3.x + `'use client'` directive | Next.js App Router (2023) | Must use client component boundary |
| `REFRESH MATERIALIZED VIEW` (blocking) | `REFRESH MATERIALIZED VIEW CONCURRENTLY` | PostgreSQL 9.4+ | Concurrent refresh allows reads during refresh; requires unique index |

**Deprecated/outdated:**
- `StreamBody` from `axum::body`: replaced by `Body::from_stream` in Axum 0.7 — the current Cargo.toml specifies Axum 0.7

---

## Open Questions (RESOLVED)

> All four questions are resolved by the phase plans. Resolutions recorded below.

1. **resolved_at column approach**
   - What we know: EXPORT-01/D-13 requires `resolved_at` in the CSV; the column does not exist
   - What's unclear: Whether to add `resolved_at` to reports table (migration 011) or derive it via subquery on status_history
   - Recommendation: Add the column to reports in migration 011; set it in `resolve_report()` DB function. Direct column is simpler and faster to query.
   - RESOLVED (by plan 04-01): Add a `resolved_at TIMESTAMPTZ` column to the reports table in migration 011 and set it in `resolve_report()`. Plan 04-01 owns migration 011 and the export query that reads the column.

2. **Public GeoJSON URL: `/api/reports.geojson` vs `/api/reports/export.geojson`**
   - What we know: Both paths work technically; nginx exact-match is cleaner for `/api/reports.geojson`
   - What's unclear: The CONTEXT.md leaves this to planner discretion
   - Recommendation: `/api/reports.geojson` — cleaner, REST-semantically reads as "the GeoJSON representation of the reports resource"
   - RESOLVED (by plan 04-02): Use `/api/reports.geojson`. Plan 04-02 registers this exact-match public route and the matching nginx `geojson_public` zone on `location = /api/reports.geojson`.

3. **leaflet.heat data timing** (heatmap data source)
   - What we know: D-02 says heatmap shows open/unresolved only; resolved reports' pins remain green on pin layer
   - What's unclear: When the heatmap receives data — does it share the same API call as the pin layer, or fetch separately?
   - Recommendation: Reuse the same `/api/reports` fetch that drives the pin layer; filter client-side to `status === 'open'` before passing to leaflet.heat. No new API call needed.
   - RESOLVED (by plan 04-04): Reuse the existing `/api/reports` fetch that drives the pin layer; HeatmapLayer filters to `status === 'open'` client-side. No new API call is added.

4. **StatsCards component vs new KPI components for /admin/analytics**
   - What we know: `StatsCards.tsx` uses old 3-value status shape (`submitted`, `under_review`, `resolved`) which is outdated post-Phase 3
   - What's unclear: Whether to update StatsCards for the analytics KPI row or create new components
   - Recommendation: Create new dedicated KPI card components for the analytics page with Phase 3 6-value status semantics. The existing StatsCards on the dashboard can remain as-is to avoid regression.
   - RESOLVED (by plan 04-03b): Create a new dedicated `KpiCards` component with Phase 3 6-value status semantics; do not reuse or modify `StatsCards.tsx`. The dashboard's existing StatsCards remain untouched.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install recharts/leaflet.heat | ✓ | 24.14.0 | — |
| npm | Package installation | ✓ | 11.9.0 | — |
| PostgreSQL (via Docker) | Materialized view migration | ✓ (via docker compose) | PostGIS-capable | — |
| Rust/Cargo | Backend compilation | ✓ (cargo available) | 2021 edition | — |

**Missing dependencies with no fallback:** none

**Note:** `resolved_at` column is absent from the current `reports` table schema — requires a new migration (011) before export queries will work. This is not a missing tool dependency but a schema gap.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frontend framework | Jest 29.7.0 + @testing-library/react 14 + jsdom |
| Backend framework | Rust built-in `#[cfg(test)]` (no live DB required) |
| Frontend config file | `frontend/jest.config.js` (or `.mjs`) |
| Frontend quick run | `cd frontend && npm test -- --testPathPattern=admin` |
| Frontend full suite | `cd frontend && npm test` |
| Backend quick run | `cd backend && cargo test` |
| Backend full suite | `cd backend && cargo test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPORT-01 | CSV export SQL includes all D-13 columns | unit (SQL string) | `cargo test export_csv_includes_all_columns` | ❌ Wave 0 |
| EXPORT-01 | CSV date format is DD/MM/YYYY | unit | `cargo test csv_date_format_dd_mm_yyyy` | ❌ Wave 0 |
| EXPORT-01 | CSV escapes commas/quotes in description | unit | `cargo test csv_escape_special_chars` | ❌ Wave 0 |
| EXPORT-02 | GeoJSON is [lng, lat] coordinate order | unit | `cargo test geojson_coordinate_order` | ❌ Wave 0 |
| EXPORT-03 | Public GeoJSON has no PII fields | unit (struct check) | `cargo test public_geojson_no_pii` | ❌ Wave 0 |
| ANALYTICS-01 | Materialized view SQL includes top_categories | unit (SQL string) | `cargo test stats_mv_includes_top_categories` | ❌ Wave 0 |
| ANALYTICS-02 | Ward analytics SQL uses FILTER (WHERE status NOT IN ('resolved','closed')) | unit (SQL string) | `cargo test ward_analytics_unresolved_filter` | ❌ Wave 0 |
| ANALYTICS-03 | Corporation analytics uses NULLIF for zero-division guard | unit (SQL string) | `cargo test corp_analytics_nullif_guard` | ❌ Wave 0 |
| ANALYTICS-04 | Trend data SQL uses DATE_TRUNC('week') | unit (SQL string) | `cargo test trend_sql_uses_week_trunc` | ❌ Wave 0 |
| MAP-02 | HeatmapLayer renders without crashing | unit (RTL) | `npm test -- --testPathPattern=HeatmapLayer` | ❌ Wave 0 |
| MAP-02 | HeatmapLayer accepts open reports only | unit (RTL) | `npm test -- --testPathPattern=HeatmapLayer` | ❌ Wave 0 |

**Pattern note:** All backend tests follow the established SQL-string unit test pattern from `admin_queries.rs` (no live DB required) — define SQL as `const` strings, test via pure functions that return those strings.

### Sampling Rate
- **Per task commit:** `cargo test 2>&1 | tail -3` + `cd frontend && npm test -- --passWithNoTests 2>&1 | tail -3`
- **Per wave merge:** Full `cargo test` + `npm test` + `npm run build` (zero TS errors required)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps (must exist before implementation begins)

**Backend (all in `admin_queries.rs` and a new `analytics_queries.rs`):**
- [ ] `const EXPORT_CSV_SQL` — define column list, test that all D-13 columns are present
- [ ] `const PUBLIC_GEOJSON_SQL` — test that no PII column names appear (no `submitter_name`, `submitter_contact`, `submitter_ip`, `photo_hash`)
- [ ] `const STATS_MV_SQL` — test that it contains `top_categories` and `resolved_count`
- [ ] `fn format_csv_date(dt: &DateTime<Utc>) -> String` — unit test DD/MM/YYYY output
- [ ] `fn csv_escape(s: &str) -> String` — unit test comma/quote escaping

**Frontend:**
- [ ] `frontend/app/admin/analytics/__tests__/AnalyticsPage.test.tsx` — smoke test (renders without crashing)
- [ ] `frontend/app/components/HeatmapLayer/__tests__/HeatmapLayer.test.tsx` — renders without crashing; filters open reports
- [ ] `frontend/app/stats/__tests__/StatsPage.test.tsx` — renders with mocked data

---

## Security Domain

> `security_enforcement` is not explicitly set to false in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (admin exports) | Existing `require_auth` middleware — no change needed |
| V3 Session Management | Yes (admin session) | Existing JWT cookie pattern — no change |
| V4 Access Control | Yes (admin vs public endpoints) | `require_auth` guards all `/api/admin/reports/export/*`; public GeoJSON is unauthenticated |
| V5 Input Validation | Yes (export filter params) | Reuse `build_report_where_clause` with bound parameters — no string interpolation |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via filter params | Tampering | Bound parameters via sqlx `.bind()` — already established pattern in `build_report_where_clause` |
| PII exposure in public GeoJSON | Information Disclosure | Whitelist approach: explicit column selection, no SELECT *, all fields reviewed against D-17 |
| Public GeoJSON DoS (bulk downloads) | Denial of Service | Two-layer rate limiting: nginx `geojson_public` zone + governor crate — D-18 |
| CSV injection (formula injection) | Tampering | Prefix cells starting with `=`, `+`, `-`, `@` with a single quote to neutralize Excel formula execution in description/notes fields |
| Streaming endpoint timeout abuse | DoS | nginx `proxy_read_timeout 120s` for streaming endpoints; governor limits request frequency |

**CSV injection mitigation pattern:**
```rust
fn sanitize_csv_cell_for_excel(s: &str) -> String {
    let trimmed = s.trim();
    if trimmed.starts_with(['=', '+', '-', '@']) {
        format!("'{}", trimmed)
    } else {
        trimmed.to_string()
    }
}
```
This is relevant for `description` and `resolution_notes` fields where user-supplied text lands in CSV cells. [ASSUMED — common CSV injection mitigation]

---

## Sources

### Primary (HIGH confidence)
- Cargo.toml [VERIFIED] — confirmed `tokio-util 0.7`, `bytes 1`, `governor 0.10`, `chrono 0.4`, `serde_json 1`, `sqlx 0.7`, `axum 0.7` all present
- npm registry [VERIFIED] — `recharts@3.8.1` (2026-03-25), `leaflet.heat@0.2.0` (Leaflet org), `@types/leaflet.heat@0.2.5` (DefinitelyTyped) confirmed via `npm view`
- Existing codebase [VERIFIED] — `admin_queries.rs` SQL patterns, `AppState` struct, `AppError` enum, `require_auth` middleware, `build_report_where_clause` helper, `INTAKE_SQL` const pattern all confirmed
- Migration files [VERIFIED] — schema baseline: `reports` table columns, `wards` table (boundary GEOGRAPHY), `organizations` table, `status` enum values, absence of `resolved_at` column confirmed

### Secondary (MEDIUM confidence)
- PostgreSQL docs pattern: `REFRESH MATERIALIZED VIEW CONCURRENTLY` unique index requirement — well-established PostgreSQL behavior
- nginx `limit_req_zone` + streaming `proxy_read_timeout` — standard nginx configuration

### Tertiary (LOW confidence / ASSUMED)
- Axum 0.7 `Body::from_stream` streaming pattern — derived from Axum 0.7 API; not directly verified via Context7
- recharts 3.8.1 `<Line hide={}>` + legend `onClick` behavior — derived from recharts docs knowledge; verify against recharts.org docs before implementation
- leaflet.heat namespace merging with TypeScript — `@types/leaflet.heat 0.2.5` behavior assumed; verify during implementation
- SQL queries for analytics (ward top 10, corporation resolution rate, trend data) — derived from existing schema; correct SQL but not tested against live DB
- Materialized view CONCURRENTLY with `(1)` constant expression unique index — standard PostgreSQL pattern; not verified against this specific PostGIS version

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Body::from_stream` is the correct Axum 0.7 streaming API | Pattern 1 | Compile error; would need to find correct streaming API |
| A2 | recharts `<Line hide={}>` prop suppresses line while keeping legend entry | Pattern 5 | Legend click-to-hide behavior may differ; would need alternative implementation |
| A3 | leaflet.heat side-effect import works with Next.js 14 module system | Pattern 6 | May need dynamic require() instead; potential SSR-related issues |
| A4 | `CREATE UNIQUE INDEX ON mv ((1))` enables CONCURRENTLY refresh on single-row view | Pattern 4 | CONCURRENTLY refresh fails; need non-concurrent refresh or alternative index |
| A5 | CSV injection prefix mitigation with single quote is sufficient for Excel | Security Domain | Excel may still interpret formula; alternative: wrap in `=TEXT(...)` or use XLSX instead of CSV |
| A6 | `ST_Simplify(boundary::geometry, 0.001)` tolerance is appropriate for Bengaluru ward choropleth | Pattern 7 | Over-simplification distorts ward boundaries; or under-simplification makes response too large |
| A7 | Adding `resolved_at` to reports and setting it in `resolve_report()` is the correct approach | Schema Investigation | Alternative (subquery on status_history) might be preferred to avoid data duplication |
| A8 | Governor keyed rate limiter can use a string IP address key for the public GeoJSON endpoint | Pattern 3 | Governor may require a different key type; existing pattern uses String keys so this should be fine |
| A9 | `recharts` renders correctly in Next.js 14 `'use client'` components without `dynamic` wrapping | Pattern 5 | SSR crash requiring dynamic import with `ssr: false` |

---

## Metadata

**Confidence breakdown:**
- Standard stack (new packages): HIGH — verified on npm registry with source repos
- Existing stack (Cargo.toml): HIGH — verified directly in codebase
- Architecture: HIGH — derived directly from existing codebase patterns
- SQL analytics queries: MEDIUM — correct from schema knowledge but not run against live DB
- Streaming Rust pattern: MEDIUM — Axum 0.7 specific; not verified via Context7
- leaflet.heat TypeScript: LOW — @types behavior not verified; flag for early implementation testing

**Research date:** 2026-05-31
**Valid until:** 2026-06-28 (30 days for stable ecosystem; recharts/leaflet are not fast-moving)
