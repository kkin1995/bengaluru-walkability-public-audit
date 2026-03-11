# Phase 1: Ward Foundation - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Import GBA 2025 ward boundary polygons into PostGIS and auto-tag every incoming report to the correct ward at submission time. Build the flexible GBA → corporation → ward office organization hierarchy as a self-referential data table and link admin users to an organization so their triage queue is scoped accordingly.

Citizen-facing UI, status lifecycle, and report assignment UI are NOT part of this phase.

</domain>

<decisions>
## Implementation Decisions

### Ward boundary data source
- Use the GBA Corporations Delimitation 2025 page as the canonical source: https://gba.karnataka.gov.in/gba-corporations-delimitation-2025/index.html
- Download the ward boundary GeoJSON/shapefile from that page and commit it to the repository
- Use GBA 2025 ward structure — NOT the old 198 BBMP wards
- If the portal has gaps or unusable format, Datameet Bengaluru is the fallback

### Import mechanism
- Ward boundaries imported via a SQL migration file (`004_ward_boundaries.sql`) — runs automatically at startup via `sqlx::migrate!`
- No runtime network dependency; data is committed and reproducible
- Committed GeoJSON file lives alongside the migration as the source of truth

### Claude's Discretion
- Ward assignment mechanism: trigger vs handler approach (researcher should evaluate trade-offs; either is acceptable)
- Ward table schema: columns, naming, SRID check constraint design
- Org hierarchy seeding: whether to seed placeholder GBA/corporation data or leave empty pending GBA engagement
- Admin org scoping: strict filter vs soft-highlight; top-level admin visibility
- How ward name surfaces in admin triage queue (column, badge, filter — planner decides)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reports.location` (GEOGRAPHY(POINT, 4326)): already has a GIST index — ready for ST_Within spatial lookups with no schema changes to the existing column
- `set_location_from_lat_lng()` trigger function: existing pattern for DB triggers that auto-populate spatial columns — ward assignment trigger can follow the same pattern
- `touch_updated_at()` trigger function: reusable for any new tables (wards, organizations)
- `handlers/reports.rs::create_report`: existing handler where ward_id lookup would attach at submission time
- `handlers/admin.rs`: existing file for all admin handlers — org assignment endpoints go here
- `admin_queries.rs`: existing file for admin DB queries — org queries go here
- `adminApi.ts`: typed frontend client — new admin org endpoints need additions here

### Established Patterns
- Migrations: sequential numbered SQL files (`001_init.sql`, `002_admin.sql`, `003_super_admin.sql`) applied automatically at startup — next is `004_ward_boundaries.sql`, then `005_organizations.sql`
- DB structs vs Response structs: DB model holds all data; `*Response` struct is the safe serializable shape — follow for any new `Organization` / `Ward` models
- `AppError` enum: all handlers return `Result<_, AppError>` — new handlers follow the same error pattern
- `require_auth` middleware: protect all new admin org endpoints the same way existing admin endpoints are protected

### Integration Points
- `backend/migrations/`: add `004_ward_boundaries.sql` and `005_organizations.sql` (or combine if appropriate)
- `backend/src/handlers/reports.rs`: add ward_id lookup in `create_report` (after bbox validation, before DB insert)
- `backend/src/handlers/admin.rs`: add org CRUD handlers (list orgs, assign admin to org)
- `backend/src/db/queries.rs`: add ward lookup query (`get_ward_for_point(lat, lng)`)
- `backend/src/db/admin_queries.rs`: add org assignment query
- `backend/src/models/`: add `Ward`, `Organization` model structs
- `frontend/app/admin/lib/adminApi.ts`: add org assignment API call
- `frontend/app/admin/reports/page.tsx`: surface ward name in triage queue
- `frontend/app/admin/users/page.tsx`: org assignment UI for admin users

</code_context>

<specifics>
## Specific Ideas

- GBA source URL: https://gba.karnataka.gov.in/gba-corporations-delimitation-2025/index.html — researcher should validate what formats are available (GeoJSON, shapefile, or only PDF/map viewer)
- Ward boundary data committed to repo so import is fully reproducible — no network calls at runtime

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-ward-foundation*
*Context gathered: 2026-03-11*
