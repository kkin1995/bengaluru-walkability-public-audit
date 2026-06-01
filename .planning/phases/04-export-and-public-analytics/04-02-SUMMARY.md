---
phase: 04-export-and-public-analytics
plan: 02
subsystem: backend/public-api, nginx, frontend/stats
tags: [geojson, stats, materialized-view, rate-limiting, nginx, ssr]
dependency_graph:
  requires:
    - backend/migrations/011_analytics_mv.sql (resolved_at + public_stats_mv — built by 04-01)
  provides:
    - backend/src/db/queries.rs (PUBLIC_GEOJSON_SQL, round3, get_public_stats, PublicStatsRow)
    - backend/src/handlers/stats.rs (public_get_stats, public_get_geojson)
    - backend/src/handlers/mod.rs (pub mod stats)
    - backend/src/main.rs (geojson_rate_limiter field + /api/stats + /api/reports.geojson routes)
    - backend/src/lib.rs (geojson_rate_limiter added to lib AppState)
    - backend/tests/public_geojson_tests.rs (4 Wave 0 tests GREEN)
    - nginx/nginx.conf (geojson_public zone + location = /api/reports.geojson)
    - nginx/nginx.server.conf (identical changes)
    - frontend/app/stats/page.tsx (public SSR stats page)
    - frontend/app/stats/__tests__/StatsPage.test.tsx (4 tests GREEN)
    - frontend/app/admin/lib/adminApi.ts (PublicStats + getPublicStats)
  affects:
    - 04-03a/04-03b (public_stats_mv exists; analytics endpoints build on same AppState pattern)
tech_stack:
  added: []
  patterns:
    - governor DefaultKeyedRateLimiter keyed by client IP (per_minute quota)
    - streaming GeoJSON via mpsc + ReceiverStream + Body::from_stream (same as 04-01)
    - D-17 column whitelist (zero PII) + round3() coordinate privacy (~111m precision)
    - nginx exact-match location with geojson_public zone + proxy_read_timeout 120s
    - Next.js Server Component with revalidate: 60 SSR fetch + graceful zero-state fallback
key_files:
  created:
    - backend/src/handlers/stats.rs
    - backend/tests/public_geojson_tests.rs
    - frontend/app/stats/page.tsx
    - frontend/app/stats/__tests__/StatsPage.test.tsx
  modified:
    - backend/src/db/queries.rs
    - backend/src/handlers/mod.rs
    - backend/src/main.rs
    - backend/src/lib.rs
    - nginx/nginx.conf
    - nginx/nginx.server.conf
    - frontend/app/admin/lib/adminApi.ts
self_check:
  passed: true
  notes: |
    - cargo check: clean (0 errors)
    - cargo test --lib: 241/241 passed
    - cargo test --test public_geojson_tests: 4/4 passed
    - npm run build: /stats page added to route manifest (○ static)
    - npm test StatsPage: 4/4 passed
    - nginx geojson_public zone present in both config files (grep confirmed)
    - /api/stats and /api/reports.geojson registered in public route block (no auth)
deviations:
  - Task 1 (migration 011 MV+trigger) was completed in a prior partial session;
    this plan executed Tasks 2 and 3 only and produced the SUMMARY covering all three.
  - Executed inline (orchestrator) rather than via worktree subagent due to Bash
    permission restriction on subagents in this session.
must_haves_verified:
  - "A public unauthenticated GET /api/reports.geojson returns a FeatureCollection with
     coordinates rounded to 3 decimal places and zero PII fields: YES — PUBLIC_GEOJSON_SQL
     excludes all PII; round3() applied to lat/lng in handler"
  - "The public GeoJSON endpoint returns 429 when the per-IP governor rate limit is exceeded:
     YES — geojson_rate_limiter.check_key() returns AppError::RateLimited (HTTP 429)"
  - "A public_stats_mv materialized view exists and refreshes automatically via a trigger
     on reports insert/update: YES — migration 011 contains MV + unique index + trigger"
  - "A public /stats page renders total reports, resolved count, top 3 categories, and a
     GeoJSON open-data download link without requiring auth: YES — /stats built as Server
     Component with SSR fetch, no auth middleware"
---

## Summary

Plan 04-02 completed in 3 tasks (Task 1 was partial from prior session; Tasks 2+3 executed inline):

**Task 1 (migration):** `public_stats_mv` materialized view + unique index + CONCURRENTLY-safe
refresh trigger appended to migration 011 (already on main branch).

**Task 2 (backend):** `PUBLIC_GEOJSON_SQL` with D-17 whitelist (no PII), `round3()` coordinate
privacy helper, `get_public_stats()` reading `public_stats_mv`. New `handlers/stats.rs` with
`public_get_stats` (reads MV, returns JSON) and `public_get_geojson` (governor rate check →
streaming Body::from_stream GeoJSON with [lng, lat] coordinates rounded to 3dp). Routes registered
in public block of main.rs; `geojson_rate_limiter` added to AppState in both main.rs and lib.rs.
4 Wave 0 tests: no_pii, coords_rounded, fields_present, stats_mv_includes_top_categories — all GREEN.

**Task 3 (nginx + frontend):** Both nginx configs gain `limit_req_zone geojson_public 2r/m` and
an exact-match location block with `proxy_read_timeout 120s`. `/stats` Server Component SSR-fetches
`/api/stats` with `revalidate: 60`; shows total, resolved%, top 3 categories (via getCategoryLabel),
and a GeoJSON download link. `getPublicStats()` added to adminApi.ts. 4 StatsPage smoke tests GREEN.

All must-haves verified. Backend: 241 unit tests + 4 Wave 0 integration tests. Frontend: build clean,
4 StatsPage tests. Nginx: `geojson_public` zone present in both config files.
