---
phase: 07-admin-triage-ux-public-map
plan: "02"
subsystem: api
tags: [rust, axum, geojson, nginx, cache-control, ward-boundaries, postgis]

# Dependency graph
requires:
  - phase: 07-01
    provides: corp/ward filter backend + admin_list_wards/admin_list_corporations handlers
provides:
  - "GET /api/wards/boundaries — public unauthenticated ward GeoJSON endpoint (369 wards, no auth)"
  - "GET /api/admin/wards/boundaries — renamed admin-gated ward GeoJSON endpoint (with unresolved_count)"
  - "nginx Cache-Control: public, max-age=86400 location block for public ward endpoint"
affects: [07-05, frontend-map-overlay, public-ward-geojson]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public handler returning (headers_tuple, Json(body)) IntoResponse for Cache-Control without middleware"
    - "Exact-match nginx location = /path placed before prefix /api/ block to guarantee precedence"
    - "Admin DB query reused by public handler — public payload strips sensitive fields (unresolved_count, id)"

key-files:
  created: []
  modified:
    - backend/src/handlers/wards.rs
    - backend/src/main.rs
    - frontend/app/admin/lib/adminApi.ts
    - nginx/nginx.conf
    - nginx/nginx.server.conf

key-decisions:
  - "Public handler uses ([(header::CACHE_CONTROL, value)], Json(body)) tuple return — no middleware needed"
  - "Admin route renamed from /api/wards/boundaries to /api/admin/wards/boundaries (stays inside admin_protected_router)"
  - "Public payload omits unresolved_count and internal id — only ward_name + ward_number + geometry (T-07-04)"
  - "No rate limit on /api/wards/boundaries per D-23 — 24h nginx + Cloudflare edge caching eliminates DoS risk"
  - "cargo sqlx prepare ran — no new SQLx query macros; .sqlx/ metadata unchanged"

patterns-established:
  - "Route conflict resolution: move admin route to /api/admin/* prefix; register public variant on unauthenticated router"
  - "nginx exact-match location = /path before prefix block; no limit_req on cached static-ish data endpoints"

requirements-completed: [TRIAGE-04]

# Metrics
duration: 15min
completed: 2026-06-23
status: complete
---

# Phase 7 Plan 02: Public Ward Boundary GeoJSON Endpoint Summary

**Public `GET /api/wards/boundaries` serving all 369 ward polygons as GeoJSON with 24h nginx + Cloudflare edge caching, resolving the admin route conflict that blocked the public map overlay**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-23T00:00:00Z
- **Completed:** 2026-06-23T00:15:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Created `public_get_ward_boundaries` handler in `wards.rs` — no auth, returns GeoJSON with only ward_name/ward_number + geometry (T-07-04 security)
- Resolved route conflict: admin route renamed to `/api/admin/wards/boundaries` (stays auth-gated); public route registered on unauthenticated app router
- Cache-Control: public, max-age=86400 set via axum header tuple on the public handler response; nginx exact-match location block in both nginx.conf and nginx.server.conf without any rate limit (D-22/D-23)
- Updated `getWardBoundaries()` in adminApi.ts to call renamed admin path — admin choropleth continues to receive authenticated data with unresolved_count

## Task Commits

1. **Task 1: Rename admin ward boundaries route + add public handler and route** - `e646469` (feat)
2. **Task 2: Update admin choropleth caller to renamed admin endpoint** - `303a443` (feat)
3. **Task 3: Add nginx Cache-Control location + regenerate SQLx** - `d1860f0` (feat)

## Files Created/Modified

- `backend/src/handlers/wards.rs` — Added `public_get_ward_boundaries` handler; public payload strips unresolved_count and internal UUID from properties
- `backend/src/main.rs` — Renamed admin route to `/api/admin/wards/boundaries`; registered `/api/wards/boundaries` on public router
- `frontend/app/admin/lib/adminApi.ts` — Updated `getWardBoundaries()` to call `/api/admin/wards/boundaries`
- `nginx/nginx.conf` — Added `location = /api/wards/boundaries` exact-match block with Cache-Control and no limit_req
- `nginx/nginx.server.conf` — Mirrored the same location block for the server/staging config

## Decisions Made

- Admin route renamed to `/api/admin/wards/boundaries` — keeps it inside `admin_protected_router` with JWT auth (T-07-05). This is the authoritative breaking change that unblocks Plan 05 (frontend overlay).
- Public handler uses axum's tuple IntoResponse `([(CACHE_CONTROL, "public, max-age=86400")], Json(body))` — no middleware layer required, simpler than a custom response type.
- `unresolved_count` and internal `id` UUID intentionally excluded from public payload per T-07-04 (ASVS V4 — public endpoint returns geographic data only).
- No rate limit on the public endpoint per D-23 — 24h caching at nginx and Cloudflare edge means origin hits are negligible; adding a rate limit would be unnecessary complexity.
- `cargo sqlx prepare` ran successfully — no new `sqlx::query!` macros were added (public handler calls the existing `get_ward_boundaries` function which uses dynamic `sqlx::query`), so `.sqlx/` metadata is unchanged.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers:
- T-07-04 mitigated: public payload excludes counts and UUIDs
- T-07-05 mitigated: admin choropleth endpoint stays auth-gated
- T-07-06 accepted: no rate limit; 24h caching eliminates DoS concern

## Known Stubs

None — this plan is backend/infra only; no UI stubs introduced.

## User Setup Required

None — nginx config changes take effect on next `docker compose up`. No environment variable changes required.

## Next Phase Readiness

- Plan 05 (frontend ward boundary overlay) can now fetch `GET /api/wards/boundaries` without auth
- The endpoint returns a GeoJSON FeatureCollection with ward_name and ward_number per Feature properties (D-14/D-15)
- Admin choropleth (ChoroplethMap.tsx) continues to work via the renamed admin path with unresolved_count

---
*Phase: 07-admin-triage-ux-public-map*
*Completed: 2026-06-23*
