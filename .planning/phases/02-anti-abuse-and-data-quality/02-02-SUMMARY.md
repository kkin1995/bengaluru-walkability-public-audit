---
phase: 02-anti-abuse-and-data-quality
plan: "02"
subsystem: anti-abuse
tags:
  - deduplication
  - photo-hash
  - background-job
  - admin-ui
dependency_graph:
  requires:
    - 02-01  # rate limiting and honeypot (provides RateLimiter in AppState, sha2 crate)
  provides:
    - photo-hash exact-duplicate rejection
    - proximity dedup background job (ST_DWithin 50m)
    - admin triage queue duplicate signals
    - expandable duplicate sub-table in admin reports
  affects:
    - backend/src/models/report.rs        # 5 new columns on Report struct
    - backend/src/db/queries.rs           # insert_report + list_reports + get_report_by_id updated
    - backend/src/db/admin_queries.rs     # list_admin_reports + new get_duplicate_reports_for_original
    - backend/src/handlers/reports.rs     # photo hash check wired before rate limit
    - backend/src/handlers/admin.rs       # duplicate_of_id branch in admin_list_reports
    - backend/src/main.rs                 # tokio::spawn dedup_job at startup
    - frontend/app/admin/lib/adminApi.ts  # AdminReport interface + getDuplicatesForReport
    - frontend/app/admin/components/ReportsTable.tsx  # badge + label + expandable row
tech_stack:
  added:
    - sha2 crate (already in Cargo.toml via Plan 01) — SHA256 for photo dedup
    - tokio::time::interval — polling dedup background task
  patterns:
    - SQL constant strings exposed for unit testing without a live DB
    - Fake HTTP 200 on duplicate photo (same as honeypot pattern from Plan 01)
    - tokio::spawn at server startup for background polling loop
    - React.useState per-row expand/collapse with async fetch on first expand
key_files:
  created:
    - backend/src/db/dedup_job.rs
    - frontend/app/admin/reports/__tests__/page.dedup.test.tsx
  modified:
    - backend/src/models/report.rs
    - backend/src/db/queries.rs
    - backend/src/db/admin_queries.rs
    - backend/src/handlers/reports.rs
    - backend/src/handlers/admin.rs
    - backend/src/models/admin.rs
    - backend/src/main.rs
    - frontend/app/admin/lib/adminApi.ts
    - frontend/app/admin/components/ReportsTable.tsx
decisions:
  - "SHA256 hash computed from raw image bytes BEFORE strip_exif so re-uploads of same photo match regardless of client-side EXIF handling"
  - "Photo hash match returns fake HTTP 200 (same as honeypot) — bots and double-tapping users get no error signal"
  - "Dedup job scans last 15 minutes window on each 5-minute poll — balances completeness vs DB load"
  - "duplicate_confidence set to 'high' only when COUNT(DISTINCT submitter_ip) >= 2 — single-IP flood does not gain 'high' confidence"
  - "ADMIN_REPORT_DEDUP_COLS constant extracted for SQL-string unit testing without live DB"
  - "Expandable row fetches duplicates on first expand only (not pre-fetched) — avoids N+1 on page load"
  - "duplicate_of_id query param branch in admin_list_reports handler — reuses existing paginated endpoint rather than adding a dedicated route"
metrics:
  duration_seconds: 338
  completed_date: "2026-03-13"
  completed_tasks: 2
  total_tasks: 2
  files_created: 2
  files_modified: 9
---

# Phase 02 Plan 02: Anti-Abuse Data Quality — Deduplication Summary

**One-liner:** SHA256 photo dedup + ST_DWithin 50m proximity background job + admin triage queue orange badge/Duplicate label/expandable duplicate sub-table.

## What Was Built

### Task 1 (TDD RED) — Failing tests for dedup infrastructure
Commit: `287b30b`

Created `backend/src/db/dedup_job.rs` with SQL constants (`FIND_NEARBY_OPEN_REPORT_SQL`, `LINK_DUPLICATE_SQL`, `INCREMENT_DUPLICATE_COUNT_SQL`) and 6 unit tests verifying:
- 50m radius in ST_DWithin
- Self-exclusion guard (`id != $1`)
- Existing-duplicate exclusion (`duplicate_of_id IS NULL`)
- Coordinate order (`ST_MakePoint($4, $3)` = longitude first)
- Atomic SQL increment (`duplicate_count = duplicate_count + 1`)
- Distinct-IP confidence threshold (`COUNT(DISTINCT submitter_ip) >= 2`)

Added `photo_hash_sha256_is_byte_order_sensitive` test to `queries.rs`. Added `admin_reports_includes_dedup_cols` test and empty `ADMIN_REPORT_DEDUP_COLS` constant (RED) to `admin_queries.rs`. Created `frontend/app/admin/reports/__tests__/page.dedup.test.tsx` with 3 ABUSE-06 tests.

### Task 2 (TDD GREEN) — Full implementation
Commit: `ee03337`

**Photo hash dedup (`handlers/reports.rs` + `queries.rs`):**
- `check_photo_hash_exists()` queries `reports.photo_hash` column
- SHA256 computed from raw bytes before `strip_exif()` call
- Hash match triggers `fake_success_response()` — no file write, no DB insert

**Proximity dedup job (`db/dedup_job.rs`):**
- `run_dedup_loop()` polls every 5 minutes via `tokio::time::interval`
- Each pass queries reports created in last 15 minutes without `duplicate_of_id`
- `ST_DWithin(ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, location, 50.0)` finds candidates
- Atomic transaction: `LINK_DUPLICATE_SQL` + `INCREMENT_DUPLICATE_COUNT_SQL`
- `duplicate_confidence` promoted to `'high'` when distinct IPs ≥ 2

**Report struct (`models/report.rs`):**
- 5 new fields: `photo_hash`, `duplicate_of_id`, `duplicate_count`, `duplicate_confidence`, `submitter_ip`
- All SELECT/INSERT/RETURNING clauses updated
- `submitter_ip` marked `#[allow(dead_code)]` — admin-only, not in `ReportResponse`

**Admin queries (`db/admin_queries.rs`):**
- `ADMIN_REPORT_DEDUP_COLS` constant set to real column list (turns RED test GREEN)
- `list_admin_reports` SELECT extended with 3 dedup columns; JSON map updated
- `get_duplicate_reports_for_original()` returns linked duplicates for expandable row

**Admin handler (`handlers/admin.rs` + `models/admin.rs`):**
- `AdminReportFilters` gains `duplicate_of_id: Option<Uuid>` field
- `admin_list_reports` handler checks for `duplicate_of_id` query param and routes to `get_duplicate_reports_for_original()` — bypasses paginated list

**Frontend (`adminApi.ts` + `ReportsTable.tsx`):**
- `AdminReport` interface: `duplicate_count?`, `duplicate_of_id?`, `duplicate_confidence?`
- `getDuplicatesForReport(originalId)` named export calls `?duplicate_of_id=` endpoint
- `ReportsTable` renders orange pill badge (`data-testid="duplicate-count-badge"`) for rows with `duplicate_count > 0`
- `ReportsTable` renders italic label (`data-testid="duplicate-label"`) for rows with `duplicate_of_id` set
- Expand toggle button (`data-testid="expand-duplicates-btn"`) fetches duplicates on first click, renders inline sub-table

**Server startup (`main.rs`):**
- `tokio::spawn(crate::db::dedup_job::run_dedup_loop(Arc::clone(&Arc::new(pool.clone()))))` at startup

## Test Results

| Suite | Before | After |
|-------|--------|-------|
| Backend cargo tests | 216 pass / 1 fail | 217 pass / 0 fail |
| Frontend Jest tests | 566 pass | 586 pass |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: `backend/src/db/dedup_job.rs`
- FOUND: `frontend/app/admin/reports/__tests__/page.dedup.test.tsx`
- FOUND: `.planning/phases/02-anti-abuse-and-data-quality/02-02-SUMMARY.md`
- FOUND commit `287b30b` (RED)
- FOUND commit `ee03337` (GREEN)
- Backend: 217 tests pass, 0 fail
- Frontend: 586 tests pass, 0 fail
