# Phase 1: Ward Foundation - Research

**Researched:** 2026-03-11
**Domain:** PostGIS spatial routing, self-referential org hierarchy, Rust/Axum SQLx patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Ward boundary data source:** GBA Corporations Delimitation 2025 page as canonical source: https://gba.karnataka.gov.in/gba-corporations-delimitation-2025/index.html. Download ward boundary GeoJSON/shapefile and commit it to the repository. Use GBA 2025 ward structure — NOT the old 198 BBMP wards. Datameet Bengaluru is the fallback.
- **Import mechanism:** Ward boundaries imported via SQL migration file (`004_ward_boundaries.sql`) — runs automatically at startup via `sqlx::migrate!`. No runtime network dependency; data is committed and reproducible. Committed GeoJSON file lives alongside the migration as the source of truth.

### Claude's Discretion
- Ward assignment mechanism: trigger vs handler approach (either is acceptable)
- Ward table schema: columns, naming, SRID check constraint design
- Org hierarchy seeding: whether to seed placeholder GBA/corporation data or leave empty pending GBA engagement
- Admin org scoping: strict filter vs soft-highlight; top-level admin visibility
- How ward name surfaces in admin triage queue (column, badge, filter — planner decides)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WARD-01 | Reports are automatically assigned to the correct Bengaluru ward via PostGIS `ST_Within` query at submission time | ST_Within handler pattern, nullable ward_id on reports, get_ward_for_point query |
| WARD-02 | An `organizations` table stores the flexible GBA → corporation → ward office hierarchy as data (not hardcoded), with self-referential parent_id | Adjacency list pattern, recursive CTE queries, 005_organizations.sql |
| WARD-03 | Each admin user is assigned to an organization, controlling which reports they see and can act on | ALTER TABLE admin_users ADD org_id FK, scoped list query, org assignment endpoint |
| WARD-04 | Ward boundary data for Bengaluru is imported into PostGIS and kept as the spatial source of truth for routing | GBA 2025 KML → GeoJSON conversion, 004_ward_boundaries.sql, GEOMETRY(MULTIPOLYGON,4326) with GIST index |

</phase_requirements>

---

## Summary

The GBA reorganized Bengaluru from 198 BBMP wards into **369 wards across 5 corporations** (Central, South, East, West, North), notified November 19, 2025. GeoJSON is NOT directly published by GBA; the canonical OpenCity dataset (`data.opencity.in`) provides KML files. The planner must account for a **KML-to-GeoJSON conversion step** (via `ogr2ogr` or Node.js `togeojson`) before the SQL migration can be written. This conversion happens once, offline, and the resulting GeoJSON is committed to the repo.

Ward assignment should be implemented at the **handler level** (not a trigger), using a `get_ward_for_point(pool, lat, lng)` query that returns `Option<Uuid>`. This matches the existing pattern in `queries.rs`, keeps business logic testable in pure Rust unit tests without a live database, and avoids the 45-second trigger overhead reported for spatial trigger patterns. The `ward_id` column is `NULLABLE` on `reports` so a report at a coordinate that fails the lookup (boundary gap, coordinate outside any ward) still commits successfully.

The organizations hierarchy uses a **self-referential adjacency list** (`parent_id UUID REFERENCES organizations(id)`). For the current 3-level GBA tree (GBA → corporation → ward office), recursive CTEs are sufficient and closure tables would add unnecessary complexity. Admin scoping uses a direct FK `admin_users.org_id → organizations.id` with a SQL query that filters `reports.ward_id IN (SELECT ward_id FROM organizations WHERE id = $org_id OR parent_id = $org_id)` — super-admins and unassigned admins see all reports.

**Primary recommendation:** Convert the GBA KML to GeoJSON before writing the migration. Implement ward lookup in the handler, not a trigger. Use adjacency list for org hierarchy. Keep `ward_id` nullable and `org_id` nullable on admin_users.

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| PostGIS | already installed (postgis extension) | Spatial polygon storage and ST_Within queries | Already in migration 001; GIST index on `reports.location` already exists |
| SQLx (runtime API) | 0.7 (in Cargo.toml) | All DB queries — runtime `query_as::<_, T>()` pattern | Established project pattern; `cargo test` works without live DB |
| ogr2ogr (GDAL) | any recent | One-time offline KML → GeoJSON conversion | Standard geospatial tool; converts KML placemark polygons to RFC 7946 GeoJSON |
| togeojson (Node.js) | mapbox/togeojson | Alternative KML → GeoJSON if GDAL unavailable | Lightweight, Node-based, no system dependency |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| serde_json | 1 (in Cargo.toml) | Parse GeoJSON features in seed script if needed | Only if conversion validation is done in Rust |
| uuid crate | 1 (in Cargo.toml) | `Option<Uuid>` for nullable ward_id / org_id fields | Already in use for all UUID columns |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Handler-level ward lookup | DB trigger BEFORE INSERT | Trigger is more "magic" but harder to unit test and can cause severe insert latency (45s reported) with complex spatial ops on many polygons |
| Adjacency list org hierarchy | Closure table | Closure table faster for deep ancestor queries but overkill for 3-level GBA tree; recursive CTE handles it fine |
| GEOMETRY(MULTIPOLYGON,4326) typmod | geometry + CHECK constraint | Typmod is the modern PostGIS recommendation; check constraints are the legacy approach |

**Installation:** No new Rust crates needed. `ogr2ogr` is a one-time dev tool for data preparation.

---

## Architecture Patterns

### Recommended Project Structure

New files to add (no existing files deleted):

```
backend/
├── migrations/
│   ├── 004_ward_boundaries.sql   ← NEW: wards table + GeoJSON import
│   └── 005_organizations.sql     ← NEW: organizations table + admin_users.org_id FK
├── src/
│   ├── models/
│   │   ├── ward.rs               ← NEW: Ward, WardResponse structs
│   │   └── organization.rs       ← NEW: Organization, OrganizationResponse structs
│   ├── db/
│   │   ├── queries.rs            ← MODIFY: add get_ward_for_point()
│   │   └── admin_queries.rs      ← MODIFY: add org queries
│   └── handlers/
│       ├── reports.rs            ← MODIFY: ward lookup in create_report
│       └── admin.rs              ← MODIFY: org CRUD + user org assignment
data/
└── gba_wards_2025.geojson        ← NEW: converted from OpenCity KML, committed
```

### Pattern 1: Ward Boundary Table Schema (004_ward_boundaries.sql)

**What:** A `wards` table using GEOMETRY typmod (not GEOGRAPHY) for SRID enforcement + GIST index.
**When to use:** Polygon containment queries perform better with GEOMETRY than GEOGRAPHY because ST_Within is a 2D planar operation; GEOGRAPHY spherical math is unnecessary for intra-city polygons.

```sql
-- Source: PostGIS official docs (postgis.net/docs/using_postgis_dbmanagement.html)
CREATE TABLE wards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_number   INT  NOT NULL,
  ward_name     TEXT NOT NULL,
  corporation   TEXT NOT NULL,          -- e.g. 'Central', 'South', 'East', 'West', 'North'
  boundary      GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wards_boundary ON wards USING GIST(boundary);

-- SRID 4326 is enforced by typmod on the GEOMETRY column definition above.
-- No separate check constraint needed — typmod rejects any geometry with wrong SRID at INSERT time.
```

GEOMETRY(MULTIPOLYGON, 4326) typmod: typmod is the modern PostGIS approach; it enforces SRID at the column definition level, rejecting mismatched SRIDs at INSERT time without a separate CHECK constraint. This satisfies WARD-04's "check constraint prevents mismatched spatial references" requirement — typmod acts as an implicit constraint. If the project requires an explicit CHECK constraint to satisfy that wording exactly, add: `CONSTRAINT enforce_srid_boundary CHECK (ST_SRID(boundary) = 4326)`.

### Pattern 2: Ward Assignment in Handler (WARD-01)

**What:** After bbox validation in `create_report`, call `get_ward_for_point(pool, lat, lng)` which returns `Option<Uuid>`. Store in a nullable `ward_id` column on reports.
**When to use:** Handler-level lookup keeps logic testable as pure Rust unit tests. No trigger overhead.

```sql
-- Source: PostGIS Point-in-Polygon pattern (postgis-patterns, PostGIS docs)
-- get_ward_for_point query (runtime sqlx pattern)
SELECT id FROM wards
WHERE ST_Within(
    ST_SetSRID(ST_MakePoint($2, $1), 4326),   -- $1=lat, $2=lng → MakePoint(lng, lat)
    boundary
)
LIMIT 1
```

**Critical: ST_MakePoint takes (longitude, latitude) order** — same as the existing `set_location_from_lat_lng()` trigger function in migration 001. This is a known gotcha.

The reports table needs a new column via migration 004:
```sql
ALTER TABLE reports ADD COLUMN ward_id UUID REFERENCES wards(id) ON DELETE SET NULL;
CREATE INDEX idx_reports_ward_id ON reports(ward_id);
```

Rust struct change:
```rust
// In models/report.rs — Report struct gains:
pub ward_id: Option<Uuid>,
// ReportResponse struct gains:
pub ward_name: Option<String>,   // joined at query time for admin response
```

### Pattern 3: Organizations Adjacency List (WARD-02)

**What:** A self-referential `organizations` table with `parent_id` nullable FK. Supports GBA (top) → corporation → ward office (leaf) tree.
**When to use:** 3-level tree, reads are infrequent admin operations, writes are configuration changes. Recursive CTEs handle ancestor/descendant queries at this depth without performance concern.

```sql
-- Source: PostgreSQL hierarchical models pattern
CREATE TABLE organizations (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  org_type    TEXT    NOT NULL,   -- 'gba' | 'corporation' | 'ward_office'
  parent_id   UUID    REFERENCES organizations(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_parent_id ON organizations(parent_id);

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

### Pattern 4: Admin User Org Assignment (WARD-03)

**What:** Add nullable `org_id` FK to `admin_users`. Null = unscoped (sees all, same as super-admin). Non-null = scoped to that org and its children.

```sql
-- In 005_organizations.sql (after organizations table exists):
ALTER TABLE admin_users ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_admin_users_org_id ON admin_users(org_id);
```

Admin-scoped report list query pattern:
```sql
-- When admin has org_id set: show reports in wards belonging to their org or child orgs
SELECT r.* FROM reports r
JOIN wards w ON r.ward_id = w.id
WHERE w.corporation IN (
    SELECT name FROM organizations
    WHERE id = $org_id OR parent_id = $org_id
)
ORDER BY r.created_at DESC
LIMIT $limit OFFSET $offset;

-- When admin has org_id NULL: show all reports (existing behavior)
```

### Pattern 5: GeoJSON Import in SQL Migration

**What:** The migration SQL reads the ward boundary polygons from inline GeoJSON geometry strings via `ST_GeomFromGeoJSON()`.
**When to use:** Committed data in migration, fully reproducible, no file I/O at runtime.

```sql
-- Source: PostGIS docs ST_GeomFromGeoJSON
-- Pattern for per-ward INSERT (repeated for all 369 wards in generated migration):
INSERT INTO wards (ward_number, ward_name, corporation, boundary)
VALUES (
  1,
  'Ward Name Here',
  'Central',
  ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[...]}'))::geometry(MULTIPOLYGON,4326)
);
```

The migration file will be large (369 ward INSERT statements). This is acceptable — it runs once at startup and SQLx handles it identically to any other migration file.

### Anti-Patterns to Avoid

- **Trigger-based ward assignment:** Using a BEFORE INSERT trigger to call ST_Within is tempting (mirrors the existing `set_location_from_lat_lng` trigger) but creates silent failures — if no ward is found, the trigger has nowhere to return the value, complicating error handling. Handler-level lookup allows explicit `Option<Uuid>` and clean logging.
- **GEOGRAPHY type for ward boundaries:** Using GEOGRAPHY(MULTIPOLYGON,4326) instead of GEOMETRY causes ST_Within to require spherical computation — unnecessary for intra-city use and incompatible with some spatial index operations. The existing `reports.location` is GEOGRAPHY for correct distance calculations; ward boundaries should be GEOMETRY.
- **Mixing GEOGRAPHY point with GEOMETRY polygon in ST_Within:** You cannot call `ST_Within(geography, geometry)` — the types must match. The `get_ward_for_point` query must construct a GEOMETRY point via `ST_SetSRID(ST_MakePoint(lng, lat), 4326)`, not cast from the `reports.location` GEOGRAPHY column.
- **Closure table for 3-level org tree:** Adds write complexity and a second table for a hierarchy that will have at most ~375 nodes (1 GBA + 5 corps + 369 ward offices).
- **Hard-deleting organizations:** Use `ON DELETE RESTRICT` on `parent_id` to prevent orphaning child orgs. Use soft-delete (is_active flag) if org removal is needed.
- **Seeding corporation data before GBA confirms structure:** State.md records this as a known concern. Leave org table empty at migration time; data-only seeding can happen later without code changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| KML polygon parsing | Custom KML parser | `ogr2ogr -f GeoJSON` (GDAL) | KML has complex namespace handling, placemark variants, coordinate order quirks |
| KML → GeoJSON for small datasets | ogr2ogr (heavy GDAL dep) | `mapbox/togeojson` Node.js library | Lightweight, handles GBA-style KML placemarks, no system install required |
| Ward boundary storage | WKT strings in TEXT column | `GEOMETRY(MULTIPOLYGON, 4326)` typmod column | typmod gives SRID enforcement, GIST index support, and ST_Within compatibility |
| Org tree ancestor query | Recursive application code | PostgreSQL recursive CTE (`WITH RECURSIVE`) | DB handles tree traversal; application just consumes flat result |
| Scoped report count for org | Application-side filtering | SQL JOIN + WHERE on ward/org hierarchy | Push filtering to DB where the GIST spatial index is available |

**Key insight:** The entire data pipeline (KML → GeoJSON → SQL migration → PostGIS) is a one-time offline transformation. Don't try to do this at runtime or inside the Rust server.

---

## Common Pitfalls

### Pitfall 1: ST_MakePoint Coordinate Order
**What goes wrong:** `ST_MakePoint(lat, lng)` produces a point in the Indian Ocean; `ST_Within` returns no wards; every report gets `ward_id = NULL`.
**Why it happens:** PostGIS convention is (longitude, latitude) = (X, Y). The existing trigger in migration 001 uses `ST_MakePoint(NEW.longitude, NEW.latitude)` — the ward lookup query must follow the same order.
**How to avoid:** Always pass `ST_MakePoint(lng_value, lat_value)` — longitude first.
**Warning signs:** Zero rows returned from `get_ward_for_point` for coordinates known to be inside Bengaluru.

### Pitfall 2: GEOGRAPHY vs GEOMETRY Type Mismatch
**What goes wrong:** `ST_Within(reports.location::geography, wards.boundary::geometry)` raises a type error. PostGIS will not implicitly cast between the two types in a WHERE clause.
**Why it happens:** `reports.location` is `GEOGRAPHY(POINT,4326)`; the new `wards.boundary` is `GEOMETRY(MULTIPOLYGON,4326)`. These are different type families in PostGIS.
**How to avoid:** Construct a fresh GEOMETRY point in `get_ward_for_point` using `ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)` rather than referencing `reports.location`.
**Warning signs:** SQLx runtime error: "function st_within(geography, geometry) does not exist".

### Pitfall 3: Large Migration File Performance
**What goes wrong:** The 004_ward_boundaries.sql with 369 INSERT statements is slow in CI or on cold starts.
**Why it happens:** 369 individual inserts, each parsing a GeoJSON geometry string.
**How to avoid:** Wrap all INSERTs in a single transaction in the migration file (`BEGIN; ... COMMIT;`). SQLx migrations already run in a transaction by default, but making it explicit prevents partial imports on error. Alternatively, collapse into a multi-row VALUES insert.
**Warning signs:** CI timing out on migration step; partial ward data in DB.

### Pitfall 4: Ward Boundary Gaps (Coordinate in No Ward)
**What goes wrong:** Reports near ward boundaries or in newly-added areas (airports, lakes, cantonment) match no ward polygon; `ward_id` is NULL. If NULL is treated as an error, valid reports are rejected.
**Why it happens:** KML boundary data may have small gaps between adjacent ward polygons; floating point boundary math.
**How to avoid:** `ward_id` must be NULLABLE; handler logs a warning but does not fail the insert. Consider `ST_DWithin` fallback (nearest ward within N meters) for NULL cases — but this is optional for Phase 1.
**Warning signs:** Valid Bengaluru coordinates returning NULL from `get_ward_for_point`.

### Pitfall 5: sqlx FromRow with Option<Uuid> for ward_id
**What goes wrong:** `Report` struct `FromRow` derivation fails because `ward_id` is a new nullable column not present in the existing SELECT list.
**Why it happens:** Every existing query in `queries.rs` has an explicit column list. Adding `ward_id` to the `reports` table means every `SELECT *` or explicit-column SELECT that omits `ward_id` will still work for the struct if we add `ward_id: Option<Uuid>` with `#[sqlx(default)]` or update all SELECTs.
**How to avoid:** Add `ward_id` to all RETURNING and SELECT column lists in `queries.rs` when adding the field to the `Report` struct. Pattern already established — see how `updated_at` is not in the Report struct (it isn't selected), follow the same discipline.
**Warning signs:** `sqlx` runtime error about missing column or type mismatch.

### Pitfall 6: Org Scoping — Super-Admin and Unassigned Admins
**What goes wrong:** An admin with `org_id = NULL` sees zero reports (treated as "no org = no access") instead of all reports.
**Why it happens:** Naive `WHERE org_id = $org_id` returns nothing when `org_id IS NULL`.
**How to avoid:** Admin list handler checks: if `org_id IS NULL`, use unscoped query (existing behavior). If `org_id IS NOT NULL`, apply the ward-join filter. Super-admin flag bypasses scoping regardless of `org_id`.
**Warning signs:** Super-admin or newly-created admin sees empty triage queue.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Ward Lookup Query (runtime sqlx pattern)
```rust
// Pattern: sqlx runtime API, consistent with queries.rs
// ST_MakePoint(longitude, latitude) — X,Y order
pub async fn get_ward_for_point(
    pool: &PgPool,
    lat: f64,
    lng: f64,
) -> Result<Option<Uuid>, AppError> {
    let row = sqlx::query_as::<_, (Uuid,)>(
        r#"
        SELECT id FROM wards
        WHERE ST_Within(
            ST_SetSRID(ST_MakePoint($2, $1), 4326),
            boundary
        )
        LIMIT 1
        "#,
    )
    .bind(lat)
    .bind(lng)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(id,)| id))
}
```

### Handler Integration (create_report, after bbox validation)
```rust
// Existing pattern in reports.rs after bbox validation block:
let ward_id = queries::get_ward_for_point(&state.pool, req.latitude, req.longitude)
    .await
    .unwrap_or_else(|e| {
        tracing::warn!("Ward lookup failed: {e}");
        None
    });
// Pass ward_id to insert_report()
```

### Org Hierarchy — Recursive CTE for descendant wards
```sql
-- Source: PostgreSQL recursive CTE pattern (postgresql.org docs)
WITH RECURSIVE org_tree AS (
    SELECT id FROM organizations WHERE id = $1
    UNION ALL
    SELECT o.id FROM organizations o
    JOIN org_tree ot ON o.parent_id = ot.id
)
SELECT r.* FROM reports r
JOIN wards w ON r.ward_id = w.id
JOIN organizations o ON o.name = w.corporation
JOIN org_tree ot ON o.id = ot.id
ORDER BY r.created_at DESC
LIMIT $2 OFFSET $3;
```

### SRID-Enforced Geometry Column (from PostGIS docs)
```sql
-- Source: PostGIS official docs (postgis.net/docs/using_postgis_dbmanagement.html)
-- Typmod enforces SRID at column definition — no separate CHECK needed
boundary GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
-- If explicit CHECK is also wanted to satisfy WARD-04 wording:
CONSTRAINT enforce_srid_boundary CHECK (ST_SRID(boundary) = 4326)
```

### KML to GeoJSON Conversion Command
```bash
# Using ogr2ogr (GDAL) — run offline, commit output to data/
ogr2ogr -f GeoJSON data/gba_wards_2025.geojson \
    -t_srs EPSG:4326 \
    input/gba_final_wards_dec2025.kml

# Using togeojson (Node.js alternative, no system GDAL required)
npx @mapbox/togeojson input/gba_final_wards_dec2025.kml > data/gba_wards_2025.geojson
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AddGeometryColumn() + separate check constraints | GEOMETRY(type, srid) typmod in column definition | PostGIS 2.0 (2012) | Typmod enforces SRID at DDL level; check constraints no longer needed |
| 198 BBMP wards | 369 GBA wards across 5 corporations | Nov 2025 | All existing BBMP ward data (Datameet, OSM) is STALE — do not use for spatial routing |
| Shapefile as GIS interchange format | GeoJSON (RFC 7946) | Industry shift ~2016 | GeoJSON is web-native, directly parseable by PostGIS ST_GeomFromGeoJSON |

**Deprecated/outdated:**
- Datameet BBMP 198-ward data: predates GBA reorganization; using it would route reports to non-existent wards
- OSM Overpass API for ward boundaries: STATE.md flags this as potentially pre-2024 data; verified risk
- `AddGeometryColumn()` function: legacy approach; use column typmod instead

---

## Data Source Finding — CRITICAL

**GeoJSON is NOT directly available from the GBA portal or OpenCity.** The canonical dataset at `data.opencity.in/dataset/gba-wards-delimitation-2025` provides only KML files (as of 2026-01-07). The KML file "GBA Final Wards Map With Population - Dec 2025" represents 369 final wards and is the most current dataset.

**Recommended data preparation workflow (done once by developer, output committed):**
1. Download KML from OpenCity: `https://data.opencity.in/dataset/gba-wards-delimitation-2025`
2. Convert to GeoJSON: `ogr2ogr -f GeoJSON data/gba_wards_2025.geojson -t_srs EPSG:4326 input.kml`
3. Inspect output: verify ward names, corporation assignments, polygon validity
4. Generate `004_ward_boundaries.sql` from the GeoJSON features (script or manual for 369 wards)
5. Commit both `data/gba_wards_2025.geojson` and the migration

**Confidence on data availability:** MEDIUM — OpenCity dataset confirmed as of 2026-01-07 update. Direct portal URL (gba.karnataka.gov.in) returned SSL error during research; OpenCity is the reliable fallback.

---

## Open Questions

1. **KML polygon geometry type: Polygon vs MultiPolygon**
   - What we know: GeoJSON output from ogr2ogr may produce Polygon or MultiPolygon depending on the source KML. The migration uses `GEOMETRY(MULTIPOLYGON, 4326)`.
   - What's unclear: Whether all 369 ward boundaries are simple Polygons or have island parcels requiring MultiPolygon.
   - Recommendation: Use `ST_Multi()` to cast any Polygon to MultiPolygon at INSERT time: `ST_Multi(ST_GeomFromGeoJSON(...))::GEOMETRY(MULTIPOLYGON,4326)`. This handles both cases safely.

2. **Ward name field in KML**
   - What we know: KML placemarks have a `<name>` element. GBA documents use Kannada names in some notifications.
   - What's unclear: Whether the Dec 2025 KML uses English names, Kannada names, or both. Whether ward numbers are in the KML or only in the PDF documents.
   - Recommendation: Inspect KML before writing migration. Schema should have `ward_name TEXT` (store whatever is in the KML) and `ward_number INT`.

3. **Org scoping — ward-to-corporation join strategy**
   - What we know: Wards have a `corporation TEXT` column; organizations have a `name TEXT` column. A join like `WHERE w.corporation = o.name` works if names are consistent.
   - What's unclear: Whether to link wards to organizations via a FK (`wards.org_id → organizations.id`) vs a text-join (`wards.corporation = organizations.name`).
   - Recommendation: Add `corp_id UUID REFERENCES organizations(id)` to wards table (nullable initially, populated when orgs are seeded). Fall back to text-join for Phase 1 if org seeding is deferred.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Backend: cargo test (177 tests passing) / Frontend: Jest 29 + jsdom + React Testing Library |
| Config file | Backend: Cargo.toml / Frontend: `frontend/jest.config.js` |
| Quick run command | `cd backend && cargo test` / `cd frontend && npm test -- --testPathPattern=admin` |
| Full suite command | `cd backend && cargo test && cd frontend && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WARD-01 | `get_ward_for_point` returns correct `Option<Uuid>` for known Bengaluru coordinates | unit (pure Rust) | `cargo test ward` | ❌ Wave 0 |
| WARD-01 | `get_ward_for_point` returns `None` for coordinate outside all ward polygons | unit (pure Rust) | `cargo test ward` | ❌ Wave 0 |
| WARD-01 | `create_report` handler stores non-null `ward_id` when point is in a known ward | unit (mock pool) | `cargo test reports` | ❌ Wave 0 |
| WARD-01 | `create_report` handler stores `ward_id = NULL` gracefully when lookup returns None | unit (mock pool) | `cargo test reports` | ❌ Wave 0 |
| WARD-02 | Organization struct has `parent_id: Option<Uuid>` and serializes correctly | unit | `cargo test organization` | ❌ Wave 0 |
| WARD-02 | `list_organizations` query returns correct parent-child relationships | unit | `cargo test org_queries` | ❌ Wave 0 |
| WARD-03 | Admin user with `org_id = None` sees all reports (unscoped) | unit | `cargo test admin_queries` | ❌ Wave 0 |
| WARD-03 | Admin user with `org_id = Some(id)` only sees reports in their org's wards | unit | `cargo test admin_queries` | ❌ Wave 0 |
| WARD-03 | `assign_org` endpoint sets `org_id` on admin user | unit | `cargo test admin` | ❌ Wave 0 |
| WARD-04 | Ward migration SQL: `wards` table has GEOMETRY(MULTIPOLYGON,4326) column | migration SQL test | `cargo test migration` | ❌ Wave 0 |
| WARD-04 | Ward migration SQL: GIST index on `boundary` column | migration SQL test | `cargo test migration` | ❌ Wave 0 |
| WARD-01 | Frontend: reports table shows ward name column | React unit test | `npm test -- --testPathPattern=reports-page` | ❌ Wave 0 |
| WARD-03 | Frontend: users page shows org assignment dropdown | React unit test | `npm test -- --testPathPattern=users-page` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && cargo test`
- **Per wave merge:** `cd backend && cargo test && cd frontend && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/src/db/tests/test_ward_queries.rs` — covers WARD-01 ward lookup logic (pure unit, no DB: test the SQL string construction and Option return type)
- [ ] `backend/src/db/tests/test_org_queries.rs` — covers WARD-02 org hierarchy, WARD-03 scoped query
- [ ] `backend/src/models/tests/test_ward_model.rs` — covers Ward/WardResponse struct serialization
- [ ] `backend/src/models/tests/test_organization_model.rs` — covers Organization struct, parent_id nullable
- [ ] `backend/migrations/tests/test_004_migration.rs` — migration SQL validation test (follows existing 7-test pattern)
- [ ] `frontend/app/admin/__tests__/reports-page-ward.test.tsx` — ward name column display in triage queue
- [ ] `frontend/app/admin/__tests__/users-page-org.test.tsx` — org assignment UI

*(Existing infrastructure: `frontend/jest.config.js`, `frontend/jest.setup.ts`, `frontend/__mocks__/` are all present. Backend `cargo test` works without live DB — all new tests follow the same pattern.)*

---

## Sources

### Primary (HIGH confidence)

- PostGIS official docs (postgis.net/docs/using_postgis_dbmanagement.html) — GEOMETRY typmod SRID enforcement, GIST indexing
- Existing codebase (migrations/001_init.sql) — ST_MakePoint coordinate order, trigger patterns, GEOGRAPHY vs GEOMETRY choices
- Existing codebase (backend/src/db/queries.rs) — runtime sqlx pattern (`query_as::<_, T>()`)
- OpenCity CKAN dataset — `data.opencity.in/dataset/gba-wards-delimitation-2025` — confirmed 369 wards, KML-only format, updated 2026-01-07

### Secondary (MEDIUM confidence)

- Wikipedia / Deccan Herald / NewsFirst (verified GBA structure): 5 corporations, 369 wards, notified Nov 19 2025; North/South 72 wards each, Central 63, West 111, East 50
- PostGIS point-in-polygon pattern (dr-jts.github.io/postgis-patterns): ST_Within with LIMIT 1 for single polygon assignment
- PostgreSQL adjacency list pattern (ackee.agency/blog/hierarchical-models): self-referential parent_id, recursive CTE for descendant queries
- WebSearch finding on trigger spatial performance: insert time 45s vs 0.3s with complex spatial triggers — supports handler-level approach

### Tertiary (LOW confidence — validate before use)

- Ward name encoding in KML (Kannada vs English): unverified; requires inspecting actual KML file
- Whether GBA KML contains ward numbers: unverified; may need to cross-reference PDF documents
- ogr2ogr output geometry type (Polygon vs MultiPolygon): unverified until KML is inspected

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already in use; no new dependencies needed
- Architecture: HIGH — patterns directly extrapolated from existing codebase conventions
- PostGIS patterns: HIGH — verified against official PostGIS docs
- GBA data source: MEDIUM — confirmed OpenCity as source, format confirmed KML-only, but actual KML content (ward names, geometry types) not yet inspected
- Pitfalls: HIGH — coordinate order and type mismatch pitfalls directly derived from existing code and PostGIS constraints

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (GBA ward structure is stable post-Nov 2025 notification; OpenCity dataset unlikely to change)
