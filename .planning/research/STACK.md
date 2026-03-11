# Stack Research: Bengaluru Walkability Public Audit

**Dimension:** Additional libraries for brownfield gaps
**Date:** 2026-03-11
**Note:** Existing stack is LOCKED (Rust/Axum + Next.js 14 + PostGIS + Docker Compose). This document covers only what's needed for the missing features.

---

## Missing Feature Areas

The existing app lacks: ward boundary auto-tagging, duplicate detection, government triage workflow, data export (CSV/GeoJSON), and public analytics dashboard.

---

## Backend (Rust / Axum) — Additional Libraries

### Ward Boundary & Geospatial Queries

| Library | Version | Purpose | Confidence |
|---------|---------|---------|-----------|
| PostGIS `ST_Within` / `ST_Contains` | DB function | Auto-tag reports to ward polygon | High |
| `geojson` crate | 0.24 | Parse ward boundary GeoJSON for import | High |
| `shapefile` crate | 0.6 | Parse Shapefile format (BBMP ward boundaries available as SHP) | Medium |

**Rationale:** No additional Rust library needed for spatial queries — `sqlx` + raw PostGIS SQL is sufficient. Ward boundaries loaded via migration SQL from GeoJSON/SHP source.

### Rate Limiting & Anti-Abuse (Application Layer)

| Library | Version | Purpose | Confidence |
|---------|---------|---------|-----------|
| `governor` crate | 0.6 | Token-bucket rate limiter as Axum middleware | High |
| `axum-extra` | 0.9 | `TypedHeader` for IP extraction (X-Forwarded-For) | High |
| Nginx `limit_req_zone` | existing | Per-IP rate limiting at proxy layer (already configured) | High |

**Rationale:** `governor` is the standard Rust rate-limiting library. Double-layer: Nginx (coarse, DDoS) + `governor` (fine-grained per-route). Redis-backed rate limiting is overkill for this scale — in-process `governor` with DashMap is sufficient.

**Do NOT use:** Redis for rate limiting at MVP scale. Adds operational complexity for no benefit under 10k submissions/day.

### Duplicate Detection

| Approach | Implementation | Confidence |
|----------|---------------|-----------|
| PostGIS `ST_DWithin(geography, geography, meters)` | SQL query | High |
| Similarity threshold | Same `issue_category` + within 50m + submitted within 30 days | High |

**Rationale:** No external ML library needed. Pure PostGIS proximity query: `ST_DWithin(a.location::geography, b.location::geography, 50)` with same category filter. Flag as `potential_duplicate` rather than auto-merge — let admin confirm.

### Data Export (CSV / GeoJSON)

| Library | Version | Purpose | Confidence |
|---------|---------|---------|-----------|
| `csv` crate | 1.3 | Streaming CSV serialization | High |
| `serde_json` | existing | GeoJSON serialization (already in deps) | High |
| `tokio-util` | existing | Streaming response body for large exports | High |

**Rationale:** No dedicated export library needed. Axum's streaming response + `csv` crate handles bulk exports. PostGIS `ST_AsGeoJSON()` converts geometries. Stream response rather than buffering — reports table can grow large.

### Analytics / Aggregation

| Approach | Implementation | Confidence |
|----------|---------------|-----------|
| SQL aggregation queries | `GROUP BY ward_id, category, status` | High |
| Materialized views | PostgreSQL `MATERIALIZED VIEW` for ward-level counts | Medium |

**Rationale:** No dedicated analytics DB needed at MVP scale. PostgreSQL materialized views refreshed hourly provide fast read access to aggregate stats without real-time query cost.

---

## Frontend (Next.js 14) — Additional Libraries

### Analytics Charts

| Library | Version | Purpose | Confidence |
|---------|---------|---------|-----------|
| `recharts` | 2.12 | Bar/line charts for trend data (React-native, SSR-compatible) | High |
| `react-leaflet` | existing | Already in use for map | High |

**Do NOT use:** D3.js directly — too low-level, recharts wraps it well. Chart.js — bundle size heavier than recharts for equivalent features.

### Ward Heatmap / Density Layer

| Library | Version | Purpose | Confidence |
|---------|---------|---------|-----------|
| `leaflet.heat` | 0.2 | Heatmap layer for Leaflet | High |
| Custom `L.GeoJSON` layer | built-in | Ward boundary choropleth (fill color by count) | High |

**Rationale:** `leaflet.heat` is the standard Leaflet heatmap plugin. For ward choropleth, use `react-leaflet`'s `GeoJSON` layer with dynamic style function — no additional library needed.

### Data Export (Frontend Trigger)

No library needed — frontend triggers a streaming download from the backend export endpoint. Browser handles the download natively via `Content-Disposition: attachment` header.

---

## Data Sources

### Bengaluru Ward Boundaries

| Source | Format | Confidence |
|--------|--------|-----------|
| BBMP Open Data Portal | GeoJSON / SHP | Medium |
| OpenStreetMap (Overpass API) | GeoJSON | High |
| Karnataka government data.gov.in | Various | Low |
| Datameet India civic data repo | GeoJSON | Medium |

**Recommendation:** OSM Overpass API — most current, freely available, can be scripted. BBMP ward boundaries changed with GBA formation — verify polygon count (198 wards under old BBMP, GBA structure TBD). Use as best-effort with admin ability to correct ward assignments.

---

## What NOT to Add

| Technology | Reason |
|------------|--------|
| Redis | Overkill for rate limiting at MVP scale; adds operational complexity |
| Elasticsearch | Reports table doesn't need full-text search at this stage |
| Message queues (RabbitMQ/Kafka) | No async processing needed; sync Rust handlers are fast enough |
| ML spam detection | Rule-based rate limiting sufficient for MVP; revisit at 10k+ reports |
| Dedicated analytics DB (ClickHouse) | PostgreSQL materialized views sufficient until 1M+ rows |

---

*Confidence: High = verified standard choice, Medium = reasonable but verify, Low = uncertain*
