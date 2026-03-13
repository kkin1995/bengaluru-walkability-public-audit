---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Completed 02-anti-abuse-and-data-quality/02-03-PLAN.md
last_updated: "2026-03-13T11:05:59.292Z"
last_activity: "2026-03-13 — Plan 02-02 complete: photo hash dedup, proximity dedup job, admin queue duplicate signals"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Citizens can report a broken footpath in 60 seconds and the government can act on it
**Current focus:** Phase 2 — Anti-Abuse and Data Quality

## Current Position

Phase: 2 of 4 (Anti-Abuse and Data Quality)
Plan: 2 of 2 in current phase (Phase 2 complete)
Status: Phase 2 complete — ready for Phase 3
Last activity: 2026-03-13 — Plan 02-02 complete: photo hash dedup, proximity dedup job, admin queue duplicate signals

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-ward-foundation P01 | 4 | 3 tasks | 9 files |
| Phase 01-ward-foundation P02 | 5 | 2 tasks | 9 files |
| Phase 01-ward-foundation P03 | 25 | 3 tasks | 7 files |
| Phase 01-ward-foundation P04 | 15 | 2 tasks | 4 files |
| Phase 01-ward-foundation P05 | 5 | 1 tasks | 1 files |
| Phase 01-ward-foundation P06 | 3 | 2 tasks | 4 files |
| Phase 02-anti-abuse-and-data-quality P01 | 5 | 2 tasks | 8 files |
| Phase 02-anti-abuse-and-data-quality P02 | 6 | 2 tasks | 11 files |
| Phase 02-anti-abuse-and-data-quality P03 | 5 | 2 tasks | 5 files |

## Accumulated Context

### Decisions

- [Roadmap]: MAP-01 and MAP-03 (status-colored pins, status in popup) assigned to Phase 3 — status display is only meaningful after the status lifecycle exists (WFLOW-01)
- [Roadmap]: MAP-02 (heatmap) assigned to Phase 4 — heatmap is a data visualization feature that requires real triage data from Phases 1-3 to be meaningful
- [Roadmap]: Phase 2 (Anti-Abuse) gates Phase 3 (Government Workflow) — exposing GBA to an unmanaged abuse spike during onboarding would destroy government trust faster than any bug
- [Phase 01-ward-foundation]: ST_Multi() wraps every ward INSERT so all boundary rows are MULTIPOLYGON — avoids mixed-type column violations in PostGIS
- [Phase 01-ward-foundation]: org_type stored as TEXT + CHECK constraint not ENUM — allows extending allowed values without ALTER TYPE migration
- [Phase 01-ward-foundation]: organizations table seeded empty at migration time — GBA corp structure unconfirmed pending Arun Pai engagement
- [Phase 01-02]: ST_MakePoint takes longitude first (X) then latitude (Y) —  is longitude,  is latitude in get_ward_for_point; tested to prevent coordinate-order regression
- [Phase 01-02]: Ward lookup failure is non-fatal: unwrap_or_else logs warning and stores NULL ward_id — report submission is never blocked by PostGIS unavailability
- [Phase Phase 01-ward-foundation]: unpkg.com added to nginx admin CSP style-src and img-src — Leaflet CDN requires both directives for CSS and marker PNG icons
- [Phase Phase 01-ward-foundation]: ReportsTable null guard (!reports) added defensively — typed prop can be undefined during Leaflet SSR hydration
- [Phase 01-04]: build_report_where_clause() extracted as shared helper — single source of truth for filter logic prevents WHERE clause drift between list and count queries
- [Phase 01-04]: tokio::try_join! used to run list_admin_reports and count_admin_reports concurrently — single round-trip overhead
- [Phase 01-04]: total_pages = ceil(total_count / limit).max(1) — minimum 1 so frontend pagination never receives total_pages: 0
- [Phase 01-ward-foundation]: Two-word surgical fix: wards.name → wards.ward_name in both production SQL and test SQL — nothing else changed
- [Phase 01-06]: org_id NOT stored in JwtClaims — fetched from DB per request via claims.sub to avoid token re-issue on every org reassignment
- [Phase 01-06]: wards.org_id FK added via migration 006 — enables direct JOIN in recursive CTE scoping query; NULL initially so org-scoped admins see zero reports until data is seeded
- [Phase 02-01]: geohash precision=6 gives ~1.2km x 0.6km cells for anti-flood rate limiting; key format is {ip}:{geohash6}
- [Phase 02-01]: Honeypot uses position:absolute;left:-9999px (not display:none) — bots detect display:none via computed style; fake success returns nil UUID with no error signal
- [Phase 02-01]: axum::serve uses into_make_service_with_connect_info::<SocketAddr>() to enable ConnectInfo extractor; X-Real-IP header read first, TCP peer as fallback
- [Phase 02-02]: SHA256 hash computed from raw image bytes BEFORE strip_exif — re-uploads of same photo match regardless of client-side EXIF handling
- [Phase 02-02]: Photo hash match returns fake HTTP 200 (same as honeypot) — bots and double-tapping users get no error signal
- [Phase 02-02]: Dedup job scans last 15 minutes on each 5-minute poll — balances completeness vs DB load
- [Phase 02-02]: duplicate_confidence promoted to 'high' only when COUNT(DISTINCT submitter_ip) >= 2 — single-IP flood does not gain high confidence
- [Phase 02-02]: ADMIN_REPORT_DEDUP_COLS constant extracted for SQL-string unit testing without live DB
- [Phase 02-02]: Expandable row fetches duplicates on first expand only — avoids N+1 on page load
- [Phase 02-02]: duplicate_of_id query param reuses existing admin reports endpoint rather than adding dedicated route
- [Phase 02-anti-abuse-and-data-quality]: sr-only anchor + onClick=window.location.assign used for navigable <tr> rows — avoids invalid HTML while satisfying test assertions for href presence
- [Phase 02-anti-abuse-and-data-quality]: data-testid='status-badge' added to StatusBadge component — makes badge presence testable across all consumer components without mocking

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Ward boundary data source unvalidated — OSM Overpass API may have pre-2024 data predating GBA reorganization. Contact Datameet Bengaluru before writing import migration.
- [Phase 3]: GBA org structure unconfirmed — which wards fall under which corporation TBD pending Arun Pai / Walkaluru engagement. Organizations table is data-not-code; delay seeding specific corporations until structure is confirmed.

## Session Continuity

Last session: 2026-03-13T11:05:59.290Z
Stopped at: Completed 02-anti-abuse-and-data-quality/02-03-PLAN.md
Resume file: None
