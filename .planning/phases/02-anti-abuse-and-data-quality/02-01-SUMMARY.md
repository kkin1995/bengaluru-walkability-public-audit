---
phase: 02-anti-abuse-and-data-quality
plan: "01"
subsystem: api
tags: [rust, axum, governor, geohash, rate-limiting, honeypot, anti-abuse, react, nextjs]

# Dependency graph
requires:
  - phase: 01-ward-foundation
    provides: AppState, create_report handler, reports table, frontend ReportPage form

provides:
  - Per-IP+geohash-6 rate limiting (2/hour) via governor crate in create_report
  - Honeypot bot detection via hidden website field (fake 200 response)
  - AppError::RateLimited variant mapping to HTTP 429
  - AppState.rate_limiter: Arc<DefaultKeyedRateLimiter<String>>
  - Migration 007: photo_hash, duplicate_of_id, duplicate_count, duplicate_confidence, submitter_ip columns
  - Frontend hidden website honeypot input (position:absolute; left:-9999px)

affects: [02-02, phase-3-government-workflow]

# Tech tracking
tech-stack:
  added: [governor 0.10, geohash 0.13, sha2 0.10, digest 0.10]
  patterns:
    - Pure helper functions extracted from handler for testability (is_honeypot_triggered, build_rate_limit_key, extract_client_ip, fake_success_response)
    - ConnectInfo extractor for TCP peer address fallback when X-Real-IP absent
    - Fake success response pattern for honeypot (nil UUID signals detection without error leakage)

key-files:
  created:
    - backend/migrations/007_anti_abuse.sql
    - frontend/app/report/__tests__/page.honeypot.test.tsx
  modified:
    - backend/Cargo.toml
    - backend/src/errors.rs
    - backend/src/main.rs
    - backend/src/handlers/reports.rs
    - backend/src/models/report.rs
    - frontend/app/report/page.tsx

key-decisions:
  - "geohash precision=6 gives ~1.2km x 0.6km cells — appropriate for hyperlocal anti-flood; key format is {ip}:{geohash6}"
  - "Honeypot uses position:absolute;left:-9999px (not display:none) — bots detect display:none via computed style inspection"
  - "Fake success returns nil UUID Uuid::nil() — bots get no error signal, nil UUID identifies bot submissions in logs"
  - "X-Real-IP header read first (set by nginx), TCP peer address as fallback — works both behind proxy and in dev without proxy"
  - "submitter_ip stored in CreateReportRequest but NOT yet wired to SQL INSERT — Plan 02 deduplication pipeline handles persistence"
  - "axum::serve uses into_make_service_with_connect_info::<SocketAddr>() to enable ConnectInfo extractor in create_report"

patterns-established:
  - "Anti-abuse helpers: extract as pure fn, test separately, call from handler"
  - "Honeypot pattern: read DOM input value in handleSubmit, append to FormData"

requirements-completed: [ABUSE-01, ABUSE-02]

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 2 Plan 01: Anti-Abuse Defences Summary

**Per-IP+geohash-6 rate limiting (2/hour via governor) and CSS-hidden honeypot bot detection wired into Rust create_report handler, with migration 007 adding deduplication columns**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-13T04:51:22Z
- **Completed:** 2026-03-13T04:56:22Z
- **Tasks:** 2 (TDD: RED then GREEN)
- **Files modified:** 8

## Accomplishments

- Rate limiter blocks > 2 submissions/hour per IP+geohash-6 cell with HTTP 429 and user-facing message
- Honeypot returns silent HTTP 200 fake success for any non-empty `website` form field
- Migration 007 adds 5 columns (photo_hash, duplicate_of_id, duplicate_count, duplicate_confidence, submitter_ip) for Plan 02 deduplication
- 5 new backend unit tests + 2 frontend tests all pass; total 209 backend + 583 frontend tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for rate limiting, honeypot (RED)** - `67f8c31` (test)
2. **Task 2: Implement rate limiting and honeypot defences (GREEN)** - `2decf60` (feat)

_Note: TDD tasks have separate RED (test) and GREEN (implementation) commits_

## Files Created/Modified

- `backend/migrations/007_anti_abuse.sql` - Adds photo_hash, duplicate_of_id, duplicate_count, duplicate_confidence, submitter_ip to reports table
- `backend/Cargo.toml` - Added governor 0.10, geohash 0.13, sha2 0.10, digest 0.10
- `backend/src/errors.rs` - Added AppError::RateLimited → HTTP 429
- `backend/src/main.rs` - Added rate_limiter to AppState, governor initialization, ConnectInfo service
- `backend/src/handlers/reports.rs` - Added pure helpers + honeypot/rate-limit checks in create_report
- `backend/src/models/report.rs` - Added submitter_ip field to CreateReportRequest
- `frontend/app/report/page.tsx` - Added hidden website honeypot input + reads it in handleSubmit
- `frontend/app/report/__tests__/page.honeypot.test.tsx` - ABUSE-02 automated honeypot field assertions

## Decisions Made

- **geohash precision 6**: ~1.2km x 0.6km cells. Tight enough to prevent location-hop flooding, loose enough to not penalise legitimate users who move a few blocks.
- **Fake success vs. 400**: Returning HTTP 200 with nil UUID gives bots no signal that detection occurred. 400 would let bots iterate around the honeypot.
- **X-Real-IP first**: nginx sets this header from the original client; TCP peer address is the nginx container IP in production. Both paths handled.
- **submitter_ip not yet persisted in SQL**: Plan 02 will update insert_report() SQL. Storing in CreateReportRequest now means the field is ready with zero additional handler changes needed.
- **position:absolute not display:none**: CSS display:none and visibility:hidden are detectable by automated tools. Off-screen positioning is invisible to users but not flagged by bot detection evasion logic.

## Deviations from Plan

None — plan executed exactly as written. The only addition was wiring `honeypot_el?.value` reading into `handleSubmit` FormData assembly (required for the honeypot to function end-to-end since the page uses manual FormData, not a form submit).

## Issues Encountered

None. All five backend tests compiled and passed immediately after implementing the helpers. Frontend tests passed first run after adding the hidden input.

## User Setup Required

None — no external service configuration required. The governor in-memory rate limiter resets on server restart (appropriate for initial anti-abuse; persistent rate limiting can be added via Redis in a future phase if needed).

## Next Phase Readiness

- Plan 02 can use the 5 new columns (photo_hash, submitter_ip etc.) added by migration 007
- `AppState.rate_limiter` is live and counting from first deploy
- `CreateReportRequest.submitter_ip` is populated by create_report — Plan 02 only needs to thread it through to `insert_report()`
- No blockers for Plan 02 (photo deduplication)

---
*Phase: 02-anti-abuse-and-data-quality*
*Completed: 2026-03-13*
