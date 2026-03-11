# Architecture Research: Missing Components Integration

**Dimension:** How missing features integrate into existing Rust/Axum + PostGIS architecture
**Date:** 2026-03-11
**Existing architecture:** Locked — Rust/Axum backend, Next.js 14 frontend, PostGIS, Docker Compose, Nginx

---

## Component Overview

Five missing components need to be designed and integrated:

1. **Ward Boundary Layer** — PostGIS polygon data + auto-tagging trigger
2. **Duplicate Detection** — Geospatial proximity + category clustering
3. **Government Triage Workflow** — Multi-tier routing without hardcoded org structure
4. **Data Export Pipeline** — Streaming CSV/GeoJSON from PostGIS
5. **Public Analytics** — Pre-aggregated stats for map and dashboard

---

## 1. Ward Boundary Layer

### Data Flow
```
Source (OSM/BBMP GeoJSON)
    → migration SQL script (import via ST_GeomFromGeoJSON)
    → wards table (id, name, corporation_id, boundary GEOMETRY(POLYGON, 4326))
    → DB trigger on reports INSERT: ST_Within(report.location, ward.boundary) → reports.ward_id
```

### Schema Addition
```sql
CREATE TABLE wards (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,           -- "Ward 42 - Koramangala"
  number     INT NOT NULL,
  corporation_id INT REFERENCES corporations(id),
  boundary   GEOMETRY(POLYGON, 4326) NOT NULL
);
CREATE INDEX ON wards USING GIST(boundary);

ALTER TABLE reports ADD COLUMN ward_id INT REFERENCES wards(id);
-- Trigger: on INSERT/UPDATE of reports, set ward_id via ST_Within lookup
```

### Key Decision: Trigger vs Application Layer
Use a PostgreSQL trigger for ward assignment — ensures ward_id is always set even on direct DB inserts. Application layer is unreliable (race conditions, code changes). Trigger is the source of truth.

### Ward Boundary Source
OSM Overpass API for Bengaluru ward boundaries. GBA ward structure (post-BBMP dissolution) is in flux — build `ward_source` metadata column so boundaries can be updated when GBA finalizes.

---

## 2. Duplicate Detection

### Algorithm
```
On new report submission:
1. Query: SELECT id, category FROM reports
   WHERE ST_DWithin(location::geography, NEW.location::geography, 50)  -- 50m radius
   AND category = NEW.category
   AND created_at > NOW() - INTERVAL '30 days'
   AND status != 'resolved'
   LIMIT 5;

2. If matches found: set reports.potential_duplicate_of = [first match id]
                     set reports.duplicate_confidence = 'high'|'medium'
3. Increment original report's duplicate_count
4. Admin sees both in triage queue with "possible duplicate" flag
```

### Schema Addition
```sql
ALTER TABLE reports
  ADD COLUMN potential_duplicate_of INT REFERENCES reports(id),
  ADD COLUMN duplicate_confidence TEXT,  -- 'high', 'medium', null
  ADD COLUMN duplicate_count INT NOT NULL DEFAULT 0;
```

### Key Decision: Flag, Don't Auto-Merge
Duplicates are flagged for admin review, not auto-merged. Reasons:
- Two reports 30m apart may be genuinely different issues (one end of a broken footpath vs. the other)
- Admin has local context to confirm
- "Me too" count (duplicate_count) becomes a severity signal in the triage queue

---

## 3. Government Triage Workflow

### Org Structure (Flexible, Not Hardcoded)
GBA oversees 5 corporations. Structure may change. Use a flexible hierarchy:

```sql
CREATE TABLE organizations (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,           -- "BBMP North", "GBA", etc.
  type       TEXT NOT NULL,           -- 'gba', 'corporation', 'ward_office'
  parent_id  INT REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_users (
  -- existing table
  organization_id INT REFERENCES organizations(id)  -- ADD THIS
);
```

### Status Lifecycle
```
Open → Acknowledged → Assigned → In Progress → Resolved → Closed
         (GBA/admin)   (to org)   (field team)  (evidence)  (verified)
```

Each transition writes to `status_history` (already exists). Add:
```sql
ALTER TABLE reports
  ADD COLUMN assigned_to_org_id INT REFERENCES organizations(id),
  ADD COLUMN assigned_to_admin_id INT REFERENCES admin_users(id),
  ADD COLUMN resolution_notes TEXT,
  ADD COLUMN resolution_photo_path TEXT;
```

### Admin View Hierarchy
- **Super admin (GBA level):** sees all reports across all corporations
- **Corporation admin:** sees reports in their wards only (filter by `ward.corporation_id`)
- **Ward officer:** sees reports assigned to their org

Enforced by: existing JWT auth + new `organization_id` on admin_users + SQL `WHERE` filter on org.

### Field Team View
Lightweight read-only view: assigned reports sorted by proximity. No separate app — mobile-responsive admin panel. Field officer opens on phone, marks "in progress" and "resolved" with optional photo.

---

## 4. Data Export Pipeline

### Architecture
```
GET /api/admin/reports/export?format=csv&ward=42&category=footpath&from=2026-01-01
    → Axum handler streams response
    → SQL: SELECT ... FROM reports LEFT JOIN wards WHERE [filters]
    → csv crate serializes rows as they stream from DB cursor
    → Content-Disposition: attachment; filename="walkability-reports-2026-03-11.csv"
```

```
GET /api/admin/reports/export?format=geojson&...
    → Same handler, different serializer
    → ST_AsGeoJSON(location) from PostGIS
    → Stream GeoJSON FeatureCollection
```

### Key Decision: Streaming, Not Buffered
Do NOT load all reports into memory. Use `sqlx`'s `.fetch()` (stream) rather than `.fetch_all()`. Reports table will grow to 10k–100k rows — buffering will OOM the container.

### Public vs Admin Export
- Admin export: full data (exact coordinates, phone, name, status history)
- Public export (future): rounded coordinates, no PII, only resolved reports

---

## 5. Public Analytics

### Pre-Aggregation Strategy
```sql
-- Materialized view refreshed hourly (cron job or pg_cron)
CREATE MATERIALIZED VIEW ward_report_stats AS
SELECT
  w.id           AS ward_id,
  w.name         AS ward_name,
  r.category,
  r.status,
  COUNT(*)       AS report_count,
  MIN(r.created_at) AS oldest_open
FROM reports r
JOIN wards w ON r.ward_id = w.id
GROUP BY w.id, w.name, r.category, r.status;

CREATE MATERIALIZED VIEW public_summary_stats AS
SELECT
  COUNT(*) FILTER (WHERE status != 'resolved') AS open_count,
  COUNT(*) FILTER (WHERE status = 'resolved')  AS resolved_count,
  COUNT(*)                                     AS total_count,
  COUNT(DISTINCT ward_id)                      AS wards_affected
FROM reports;
```

### API Endpoints for Analytics
```
GET /api/stats              → public_summary_stats (no auth)
GET /api/stats/by-ward      → ward_report_stats aggregated (no auth, rounded coords)
GET /api/admin/analytics    → full analytics with date range filters (auth required)
```

### Key Decision: Separate Public and Admin Analytics APIs
Public stats: pre-aggregated, cached, no auth, returns counts not raw data.
Admin analytics: real-time queries with filters, auth required, returns detailed breakdowns.

---

## Build Order (Dependencies)

```
Phase 1: Ward foundation
    ├── wards table + boundary data import
    ├── ward auto-tagging trigger on reports
    └── organizations table + admin org assignment

Phase 2: Anti-abuse + quality
    ├── duplicate detection (depends on ward data for accuracy)
    ├── per-IP rate limiting (governor middleware)
    └── image validation improvements

Phase 3: Government workflow
    ├── status lifecycle expansion (depends on org structure)
    ├── admin triage queue with ward/org filters
    └── field team view + resolution photo

Phase 4: Export + analytics
    ├── streaming CSV/GeoJSON export (depends on ward data for ward filter)
    ├── materialized views for stats
    └── public analytics API + dashboard
```

---

## Integration Points with Existing Code

| Existing Component | Integration Point |
|-------------------|------------------|
| `reports` table | Add: ward_id, assigned_to_org_id, duplicate_count, resolution_* columns |
| `status_history` | No change needed — already tracks transitions |
| `admin_users` table | Add: organization_id FK |
| Admin handlers (`backend/src/handlers/admin.rs`) | Add: ward filter, org assignment, export endpoints |
| `Report::into_response()` | Add: ward_name, duplicate_count, status to public API |
| `ReportsMap.tsx` | Add: ward boundary overlay, status filter, heatmap layer |
| `AdminDashboard` | Add: triage queue, ward filter, export button, analytics charts |

---

*Build order is sequential — ward data must exist before duplicate detection, which must exist before meaningful triage.*
