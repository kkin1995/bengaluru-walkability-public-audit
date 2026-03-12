---
phase: 01-ward-foundation
plan: "01"
subsystem: database
tags: [postgis, geojson, kml, migrations, sql, ward-boundaries, organizations]

# Dependency graph
requires: []
provides:
  - "369 GBA 2025 ward boundary polygons in wards table (GEOMETRY MULTIPOLYGON, 4326)"
  - "organizations table with self-referential parent_id hierarchy (GBA/corporation/ward_office)"
  - "reports.ward_id FK column for spatial ward assignment"
  - "admin_users.org_id FK column for organization-scoped report access"
affects:
  - 01-02-ward-lookup
  - 01-03-org-hierarchy
  - 02-anti-abuse
  - 03-government-workflow

# Tech tracking
tech-stack:
  added:
    - "@mapbox/togeojson (npx, KML->GeoJSON conversion)"
  patterns:
    - "Migration SQL tests as Rust string-validation unit tests (include_str! + assert!, no live DB)"
    - "ST_Multi(ST_GeomFromGeoJSON(...))::geometry(MULTIPOLYGON,4326) for ward boundary import"
    - "GeometryCollection->MultiPolygon conversion for multi-part wards"
    - "Self-referential adjacency list for org hierarchy (parent_id with ON DELETE RESTRICT)"

key-files:
  created:
    - data/gba_wards_2025.geojson
    - gba-369-wards-december-2025.kml
    - backend/migrations/004_ward_boundaries.sql
    - backend/migrations/005_organizations.sql
    - backend/src/migrations_tests/mod.rs
    - backend/src/migrations_tests/test_004_migration.rs
    - backend/src/migrations_tests/test_005_migration.rs
  modified:
    - .gitignore
    - backend/src/main.rs

key-decisions:
  - "ST_Multi() wraps every Polygon insert so all rows are MULTIPOLYGON — avoids mixed-type column issues when PostGIS validates geometry type"
  - "4 GeometryCollection wards (Aerocity, Byrathi, Bandepalya, Kengeri) converted to explicit MultiPolygon before ST_GeomFromGeoJSON to avoid type mismatch"
  - "organizations table seeded empty at migration time — GBA org structure unconfirmed pending Arun Pai engagement (see STATE.md blocker)"
  - "Migration SQL tests live in backend/src/migrations_tests/ module (not a separate crate) — follows existing Rust test pattern, no extra build config needed"
  - "org_type CHECK constraint uses allowlist ('gba', 'corporation', 'ward_office') not an enum — easier to extend without ALTER TYPE migration"

patterns-established:
  - "Migration SQL test pattern: include_str!('../../migrations/NNN_name.sql'), assert!, no DB"
  - "All migration INSERT geometry uses ST_Multi() wrapper for consistent MULTIPOLYGON storage"

requirements-completed:
  - WARD-04
  - WARD-02

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 1 Plan 01: Ward Boundary Data and Schema Foundation Summary

**GeoJSON conversion of 369 GBA 2025 wards, PostGIS wards table with MULTIPOLYGON geometry, and organizations hierarchy table with admin/reports FK columns**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T04:13:53Z
- **Completed:** 2026-03-12T04:18:13Z
- **Tasks:** 3
- **Files created/modified:** 9

## Accomplishments

- Converted `gba-369-wards-december-2025.kml` (already present in repo) to `data/gba_wards_2025.geojson` with all 369 ward features
- Wrote `backend/migrations/004_ward_boundaries.sql`: wards table with GEOMETRY(MULTIPOLYGON,4326), GIST index, SRID constraint, and 369 ward INSERT statements sourced from GeoJSON
- Wrote `backend/migrations/005_organizations.sql`: organizations self-referential hierarchy table, updated_at trigger, and FK columns on both `reports` (ward_id) and `admin_users` (org_id)
- Added 11 migration SQL validation tests (Rust, no live DB required); full suite now 181 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Download GBA 2025 KML and convert to GeoJSON** - `5f88dd9` (chore)
2. **RED phase: failing migration tests** - `aed971c` (test)
3. **Task 2: Write 004_ward_boundaries.sql migration** - `4796524` (feat)
4. **Task 3: Write 005_organizations.sql migration** - `cf3aa1c` (feat)

## Files Created/Modified

- `gba-369-wards-december-2025.kml` - Source KML file committed to repo (raw download from data.opencity.in)
- `data/gba_wards_2025.geojson` - Converted GeoJSON FeatureCollection with 369 ward features; properties: ward_id, ward_name, Corporation
- `backend/migrations/004_ward_boundaries.sql` - PostGIS wards table DDL + 369 ward bulk inserts
- `backend/migrations/005_organizations.sql` - organizations hierarchy table + admin_users.org_id FK
- `backend/src/migrations_tests/test_004_migration.rs` - 6 SQL string validation tests for migration 004
- `backend/src/migrations_tests/test_005_migration.rs` - 5 SQL string validation tests for migration 005
- `backend/src/migrations_tests/mod.rs` - Module registration
- `backend/src/main.rs` - Added `mod migrations_tests`
- `.gitignore` - Added `input/` for raw KML download staging

## Decisions Made

- **ST_Multi() wraps every insert**: ensures uniform MULTIPOLYGON column type; avoids PostGIS geometry type constraint violations
- **GeometryCollection handling**: 4 wards (Aerocity, Byrathi, Bandepalya, Kengeri) had multi-part KML geometries → converted to explicit MultiPolygon coordinates before wrapping in ST_GeomFromGeoJSON
- **organizations table empty at migration time**: GBA org structure (which wards belong to which corporation) unconfirmed; seeding happens out-of-band per STATE.md blocker
- **org_type as TEXT + CHECK not ENUM**: allows extending allowed values without an ALTER TYPE migration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Handled GeometryCollection geometry type for 4 multi-part wards**
- **Found during:** Task 2 (generating INSERT statements from GeoJSON)
- **Issue:** 4 features (Aerocity, Byrathi, Bandepalya, Kengeri) had `GeometryCollection` type containing multiple Polygons — `ST_GeomFromGeoJSON` on a GeometryCollection would not produce a valid MULTIPOLYGON for the typed column
- **Fix:** Node.js generation script detects GeometryCollection features and builds an explicit `{"type":"MultiPolygon","coordinates":[...]}` object from the contained Polygon coordinates before passing to `ST_Multi(ST_GeomFromGeoJSON(...))`
- **Files modified:** (in-script logic; no extra committed file)
- **Verification:** All 369 INSERT statements use `ST_Multi(ST_GeomFromGeoJSON(...))`; migration test `migration_004_uses_st_multi_cast` passes
- **Committed in:** `4796524` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix)
**Impact on plan:** Necessary for correctness — would have caused PostGIS type errors on import. No scope creep.

## Issues Encountered

- KML download was already present as `gba-369-wards-december-2025.kml` in the repo root (untracked), so Task 1's manual download step was skipped and the conversion was automated directly
- `ogr2ogr` not available; used `npx @mapbox/togeojson` instead (equivalent output, 369 features confirmed)

## Next Phase Readiness

- `wards` table schema is in place; Plan 02 (ward lookup Rust code) can proceed
- `organizations` table schema ready; Plan 03 (org hierarchy Rust code) can proceed
- Blocker remains: GBA org structure unconfirmed — organizations table will be seeded out-of-band after structure is confirmed

---
*Phase: 01-ward-foundation*
*Completed: 2026-03-12*
