---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 02.4.1 context gathered
last_updated: "2026-05-20T17:58:51.462Z"
last_activity: 2026-05-20 -- Phase 02.4.1 execution started
progress:
  total_phases: 11
  completed_phases: 8
  total_plans: 33
  completed_plans: 28
  percent: 73
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Citizens can report a broken footpath in 60 seconds and the government can act on it
**Current focus:** Phase 02.4.1 — security-hardening

## Current Position

Phase: 02.4.1 (security-hardening) — EXECUTING
Plan: 1 of 3
Status: Executing Phase 02.4.1
Last activity: 2026-05-20 -- Phase 02.4.1 execution started

Progress: [█████████░] 92%

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
| Phase 02.2 P01 | 2 | 1 tasks | 5 files |
| Phase 02.2 P02 | 12 | 2 tasks | 2 files |
| Phase 02.2 P03 | 5 | 1 tasks | 1 files |
| Phase 02.3 P03 | 1 | 2 tasks | 2 files |
| Phase 02.3 P02 | 15 | 2 tasks | 2 files |
| Phase 02.3 P01 | 2min | 2 tasks | 4 files |
| Phase 02.3.1 P01 | 35min | 3 tasks | 18 files |
| Phase 02.3.1 P02 | 25min | 2 tasks | 3 files |
| Phase 02.3.1 P03 | 40min | 2 tasks | 8 files |
| Phase 02.3.1 P04 | 4min | 2 tasks | 7 files |
| Phase 02.3.2 P01 | 3min | 2 tasks | 3 files |
| Phase 02.3.2 P02 | 3min | 2 tasks | 2 files |
| Phase 02.3.2 P03 | 10min | 2 tasks | 0 files |

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
- [Phase 02.2]: STAGING-SETUP.md is a standalone operational document at repo root — not embedded in planning files — so any future contributor finds it immediately
- [Phase 02.2]: Deployment ordering constraint (Railway-first) is the highest-risk misconfiguration for Vercel+Railway split architecture; documented prominently before env var checklist in STAGING-SETUP.md
- [Phase 02.2]: SameSite=None cookie required for Vercel+Railway cross-domain auth; Secure=true enforced by COOKIE_SECURE env var
- [Phase 02.2]: Next.js rewrites() proxy /api/admin/* to INTERNAL_API_URL so admin cookie is set on Vercel domain
- [Phase 02.2]: ADMIN_API_BASE_URL is hardcoded empty string (not env-var) so admin calls always use relative URLs; public /api/reports NOT proxied to avoid Vercel 4.5MB body limit
- [Phase 02.2]: smoke-test job skips gracefully via if: secrets.RAILWAY_BACKEND_URL != '' — prevents CI failure before Railway is provisioned
- [Phase 02.2]: dockerfilePath = 'Dockerfile' (relative to Root Directory = backend/) in railway.toml — not backend/Dockerfile
- [Phase 02.2]: healthcheckTimeout = 300 in railway.toml to accommodate Rust Docker build cold-start on first deploy
- [Phase 02.3]: Extract admin sidebar to AdminSidebar.tsx client component so useState manages mobile drawer while layout.tsx remains a server component handling auth
- [Phase 02.3]: Label-wrapping pattern: iOS Safari respects capture='environment' only on native label-triggered inputs, not programmatic .click() — use label-wrapped sr-only inputs for all iOS file inputs going forward
- [Phase 02.3]: getCategoryLabel from translations.ts is the single source of truth for all category labels across admin table, map legend, and map popup
- [Phase 02.3]: Scroll gradient for admin table uses md:hidden so only mobile/tablet users see the right-edge fade
- Branch ui-redesign created from phase-02.3-uat-fixes — all citizen-facing redesign work isolated here; do not merge to main until explicitly requested
- data-* attributes (data-tone, data-variant, data-size, data-component) added to primitives — jsdom strips CSS var() from inline styles; data attributes are the testable substitute for CSS-variable-driven variants
- next/font/google Jest mock added at __mocks__/next/font/google.js — build-time font loading cannot execute in Jest environment
- photo-store module singleton: storePendingPhoto/consumePendingPhoto for home CTA → /report photo handoff without localStorage or URL params
- ReportCTA label-wrapped hidden file input: label+input with inset-0/opacity-0 positioning for iOS camera capture from home page
- Contact accordion UAT deferral overridden: GAP 4 major severity — implemented expand/collapse per UAT evidence, superseding CONTEXT.md display-only deferral
- Gallery input has no capture attribute — this forces the OS full photo picker instead of camera-only on iOS and Android
- handleGalleryChange is an exact copy of handleChange — identical EXIF/compress/storePendingPhoto pipeline; behavioral difference is exclusively in the input element (no capture attribute)
- CategoryGrid gridTemplateColumns reverted from 1fr 1fr 1fr to 1fr 1fr — UI-SPEC (approved 2026-04-25) is authoritative, overriding prior CONTEXT.md D-08 value
- Privacy notice fontSize set to 13 (Caption scale) per UI-SPEC typography section, not 12 as originally in CONTEXT.md D-10
- Ternary style split used for chip button styles (two complete style objects) rather than spread approach — avoids TypeScript union error where border appears in both base and conditional spread
- categoryFilter passed as undefined (not 'all') when activeFilter === 'all' — keeps ReportsMap filter logic clean: undefined means show all
- onReportsLoaded added to useCallback dependency array — required by exhaustive-deps; setAllReports identity is stable from useState
- Local CORS_ORIGIN misconfiguration (port 3002 instead of 3000) caused 'Couldn't load reports' during verification — fixed locally; unrelated to code changes on this branch

### Roadmap Evolution

- Phase 02.1 inserted after Phase 02: OWASP Secure Coding Practices Audit and Hardening (URGENT)
- Phase 02.2 inserted after Phase 02: Vercel Staging Deployment and Pre-UAT Hardening (URGENT) — traffic police contact may get app adopted by GBA; staging needed for partner UAT before Phase 3
- Phase 02.3 inserted after Phase 02: UAT Bug Fixes — admin category label, iOS camera UX, admin mobile layout, map legend consistency (URGENT) — 5 issues found in 02.2-HUMAN-UAT.md field test; fix before Phase 3 executes
- Phase 02.3.1 inserted after Phase 02.3: Implement Walkable BLR UI redesign from design file on separate branch (URGENT)
- Phase 02.4 inserted after Phase 02.3.2: Self-Hosted Infrastructure — Arch Linux + Cloudflare Tunnel: decommission Railway, host backend on desktop via Cloudflare tunnel (URGENT)
- Phase 02.4.1 inserted after Phase 02.4: Security Hardening (URGENT)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Ward boundary data source unvalidated — OSM Overpass API may have pre-2024 data predating GBA reorganization. Contact Datameet Bengaluru before writing import migration.
- [Phase 3]: GBA org structure unconfirmed — which wards fall under which corporation TBD pending Arun Pai / Walkaluru engagement. Organizations table is data-not-code; delay seeding specific corporations until structure is confirmed.

## Session Continuity

Last session: 2026-05-20T17:58:51.454Z
Stopped at: Phase 02.4.1 context gathered
Resume file: None

**Planned Phase:** 02.3.1 (implement-walkable-blr-ui-redesign-from-design-file-on-separate-branch) — 4 plans — 2026-04-24T20:47:49.668Z
