---
phase: 02-anti-abuse-and-data-quality
verified: 2026-03-13T12:30:00Z
status: passed
score: 9/9 must-haves verified
gaps: []
human_verification:
  - test: "Rate limiting UAT — submit 3+ reports from same ~1km location within 1 hour"
    expected: "First 2 succeed; 3rd returns HTTP 429 with 'You've submitted too many reports from this area recently. Try again in an hour.'"
    why_human: "governor crate uses in-memory state; cannot test hour-window behaviour in automated unit tests; requires real HTTP traffic to running server"
  - test: "Proximity dedup 5-minute job — two near reports in same category"
    expected: "After up to 5 minutes, the newer report gains 'Duplicate' label in admin queue; original shows orange badge with count"
    why_human: "Job polls on 300-second tokio interval; cannot fast-forward real time in automated tests; integration test needs running PostGIS and a live server"
  - test: "Photo hash dedup — re-upload identical photo"
    expected: "Second upload returns apparent HTTP 200 success but no new report row appears in admin queue or DB"
    why_human: "check_photo_hash_exists queries live DB; requires running PostGIS; unit tests confirm the logic path exists but not end-to-end file upload flow"
  - test: "Admin sub-table navigation — click a duplicate row"
    expected: "Browser navigates to /admin/reports/{id} and renders the full report detail page with photo, description, status, ward, dates"
    why_human: "window.location.assign is untestable in jsdom; requires real browser or Playwright; sub-table link structure is verified by Jest sr-only anchor tests but click navigation needs a browser"
---

# Phase 2: Anti-Abuse and Data Quality — Verification Report

**Phase Goal:** Add anti-abuse controls (rate limiting, honeypot, photo dedup, proximity dedup) and admin triage queue signals so the platform can detect and suppress duplicate/spam reports before they pollute the public map.
**Verified:** 2026-03-13T12:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A POST /api/reports with non-empty `website` field returns HTTP 200 with fake success — no report stored | VERIFIED | `is_honeypot_triggered()` helper + match arm `"website"` in `create_report` returns `fake_success_response()`; 3 backend unit tests pass |
| 2 | A POST from same IP+geohash-6 exceeding 2/hour returns HTTP 429 with prescribed message | VERIFIED | `build_rate_limit_key()` wired to `state.rate_limiter.check_key()`; `AppError::RateLimited` maps to `StatusCode::TOO_MANY_REQUESTS`; 4 backend unit tests pass |
| 3 | Identical photo (same SHA256) returns HTTP 200 fake success — no file written, no row inserted | VERIFIED | `check_photo_hash_exists()` in `queries.rs`; hash computed via `Sha256::digest()` before `strip_exif`; returns `fake_success_response()` on match |
| 4 | Background dedup job finds unlinked reports within 50m same-category and links them atomically | VERIFIED | `run_dedup_loop()` in `dedup_job.rs` polls every 300s; `FIND_NEARBY_OPEN_REPORT_SQL` uses `ST_DWithin(..., 50.0)`; 6 SQL-constant unit tests pass |
| 5 | `duplicate_count` increments atomically; `duplicate_confidence` set to 'high' on distinct IPs >= 2 | VERIFIED | `INCREMENT_DUPLICATE_COUNT_SQL` uses `duplicate_count = duplicate_count + 1` and `COUNT(DISTINCT submitter_ip) >= 2`; 2 unit tests verify both conditions |
| 6 | Admin triage queue shows orange pill badge with `duplicate_count` for qualifying rows | VERIFIED | `data-testid="duplicate-count-badge"` rendered when `duplicate_count > 0`; `page.dedup.test.tsx` asserts badge visible with value "3" |
| 7 | Admin queue shows "Duplicate" label on rows with `duplicate_of_id` set | VERIFIED | `data-testid="duplicate-label"` rendered when `report.duplicate_of_id` is truthy; `page.dedup.test.tsx` asserts label visible |
| 8 | Sub-table shows ward name, formatted date, StatusBadge, and rows link to report detail page | VERIFIED | `ReportsTable.tsx` sub-table has `<thead>`, `ward_name ?? "—"`, `toLocaleDateString()`, `<StatusBadge>`, sr-only `<a href=/admin/reports/{id}>`; 10 subtable tests pass |
| 9 | Report detail page at /admin/reports/[id] shows photo, description, category, severity, status, ward | VERIFIED | `frontend/app/admin/reports/[id]/page.tsx` exists; calls `getAdminReport(params.id)`; renders all fields with loading/error states; 12 detail page tests pass |

**Score:** 9/9 truths verified

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `backend/migrations/007_anti_abuse.sql` | 5 schema columns (photo_hash, duplicate_of_id, duplicate_count, duplicate_confidence, submitter_ip) | VERIFIED | All 5 columns present; unique index on photo_hash; partial index on created_at for dedup scans |
| `backend/src/errors.rs` | `AppError::RateLimited` variant → HTTP 429 | VERIFIED | Variant at line 49; match arm at line 76 maps to `StatusCode::TOO_MANY_REQUESTS` |
| `backend/src/main.rs` | `rate_limiter: Arc<DefaultKeyedRateLimiter<String>>` in AppState; dedup job spawn | VERIFIED | `rate_limiter` field at line 60; `tokio::spawn(run_dedup_loop(...))` at line 103; `into_make_service_with_connect_info::<SocketAddr>()` at line 226 |
| `backend/Cargo.toml` | governor 0.10, geohash 0.13, sha2 0.10, digest 0.10 | VERIFIED | All 4 dependencies present at lines 39-42 |
| `backend/src/handlers/reports.rs` | Honeypot check + photo hash check + rate limit check in `create_report` | VERIFIED | Three checks wired in correct order: honeypot (line 168) → photo hash (line 201) → rate limit (line 225) |
| `backend/src/db/dedup_job.rs` | Background proximity dedup with SQL constants + `run_dedup_loop` | VERIFIED | Full implementation with loop, 5-minute interval, `run_dedup_pass`, `link_duplicate`; no `unimplemented!` stubs |
| `backend/src/models/report.rs` | Report struct extended with 5 new fields | VERIFIED | All 5 fields present (lines 30-42); `make_report()` test helper includes defaults |
| `backend/src/db/queries.rs` | `check_photo_hash_exists()` + updated `insert_report` with new columns | VERIFIED | `check_photo_hash_exists` at line 40; photo_hash in INSERT at line 61 and RETURNING |
| `backend/src/db/admin_queries.rs` | `ADMIN_REPORT_DEDUP_COLS` constant + `list_admin_reports` extended + `get_duplicate_reports_for_original` | VERIFIED | Constant at line 781; `get_duplicate_reports_for_original` at line 415; dedup cols in JSON map at lines 403-404 |
| `frontend/app/report/page.tsx` | Hidden `website` honeypot input with CSS off-screen positioning | VERIFIED | Input at line 443 with `position: absolute`, `left: -9999px`, `tabIndex={-1}` |
| `frontend/app/report/__tests__/page.honeypot.test.tsx` | Automated honeypot field assertions | VERIFIED | 2 tests pass: off-screen CSS check + not display:none check |
| `frontend/app/admin/lib/adminApi.ts` | `AdminReport` with 3 dedup fields + `getDuplicatesForReport()` | VERIFIED | Fields at lines 53-55; `getDuplicatesForReport` at line 195; `getAdminReport` at line 167 |
| `frontend/app/admin/components/ReportsTable.tsx` | Badge + label + expandable row + fixed sub-table | VERIFIED | All 4 features present with correct `data-testid` attributes; sub-table has `<thead>`, `ward_name`, `toLocaleDateString()`, `StatusBadge`, sr-only anchor |
| `frontend/app/admin/reports/[id]/page.tsx` | Report detail page fetching via `getAdminReport()` | VERIFIED | Full page with loading/error states; data-testid="report-detail"; uses `getAdminReport(params.id)` |
| `frontend/app/admin/reports/__tests__/page.dedup.test.tsx` | Automated badge and label assertions | VERIFIED | 3 tests pass (badge visible with count "3"; label visible for duplicate rows) |
| `frontend/app/admin/components/__tests__/ReportsTable.subtable.test.tsx` | Sub-table structure and navigation tests | VERIFIED | 10 tests pass covering thead, ward_name, formatted date, StatusBadge, and sr-only link |
| `frontend/app/admin/reports/[id]/__tests__/page.test.tsx` | Detail page data fetching and rendering tests | VERIFIED | 12 tests pass covering loading state, error state, all report fields |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `create_report` handler | `AppState.rate_limiter` | `check_key("{ip}:{geohash6}")` | WIRED | `state.rate_limiter.check_key(&rate_key)` at line 225 of reports.rs |
| `create_report` handler (honeypot) | `fake_success_response()` | website field non-empty check | WIRED | Match arm "website" at line 164 → `is_honeypot_triggered` → `fake_success_response()` |
| `create_report` handler (photo hash) | `queries::check_photo_hash_exists` | SHA256 before strip_exif | WIRED | `Sha256::digest(&req.image_bytes)` → `check_photo_hash_exists` → `fake_success_response()` |
| `backend/src/main.rs` | `db::dedup_job::run_dedup_loop` | `tokio::spawn` at startup | WIRED | `tokio::spawn(crate::db::dedup_job::run_dedup_loop(Arc::clone(...)))` |
| `dedup_job::run_dedup_pass` | `FIND_NEARBY_OPEN_REPORT_SQL` | ST_DWithin 50m, same category | WIRED | SQL constant used in `fetch_optional` call at line 75 of dedup_job.rs |
| Frontend admin reports page | `AdminReport.duplicate_count` | badge when `duplicate_count > 0` | WIRED | `(report.duplicate_count ?? 0) > 0` condition renders `data-testid="duplicate-count-badge"` |
| Frontend admin reports page | `adminApi.getDuplicatesForReport` | fetch on expand | WIRED | `toggleExpand` calls `getDuplicatesForReport(reportId)` on first expand |
| `ReportsTable.tsx` sub-table rows | `/admin/reports/[id]/page.tsx` | sr-only `<a href=...>` + onClick | WIRED | `href={\`/admin/reports/${dupe.id}\`}` in sr-only anchor; `window.location.assign` in onClick |
| `/admin/reports/[id]/page.tsx` | `adminApi.getAdminReport` | `useEffect` on mount | WIRED | `getAdminReport(params.id).then(setReport)` in useEffect |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ABUSE-01 | 02-01 | Rate limit: max 2 reports/IP/geohash-6/hour using governor | SATISFIED | `build_rate_limit_key`, governor keyed limiter in AppState, `RateLimited` → 429; 4 unit tests |
| ABUSE-02 | 02-01 | Honeypot hidden field silently discards bot submissions | SATISFIED | Hidden `website` input with off-screen CSS; `is_honeypot_triggered` in handler; 2 Jest tests |
| ABUSE-03 | 02-02 | Reports within 50m same category flagged as `potential_duplicate` with `duplicate_count` increment | SATISFIED | `ST_DWithin(..., 50.0)` in `FIND_NEARBY_OPEN_REPORT_SQL`; `LINK_DUPLICATE_SQL` + `INCREMENT_DUPLICATE_COUNT_SQL` |
| ABUSE-04 | 02-02 | `duplicate_confidence = 'high'` when multiple distinct IPs submit same location+category | SATISFIED | `COUNT(DISTINCT submitter_ip) >= 2 THEN 'high'` in `INCREMENT_DUPLICATE_COUNT_SQL` |
| ABUSE-05 | 02-02 | Exact duplicate photos (same SHA256) silently rejected | SATISFIED | `check_photo_hash_exists`, SHA256 before strip_exif, fake_success_response on match |
| ABUSE-06 | 02-02 + 02-03 | `duplicate_count` visible in admin triage queue as severity indicator | SATISFIED | Orange badge (`data-testid="duplicate-count-badge"`); "Duplicate" label; expandable sub-table with proper fields and navigation link; 22 automated tests across 2 test files |

All 6 ABUSE requirements satisfied. No orphaned requirements found — REQUIREMENTS.md traceability table maps all 6 to Phase 2 and marks them complete.

---

## Anti-Patterns Found

No blockers or warnings found. The three `placeholder=` hits in `frontend/app/report/page.tsx` are legitimate HTML input placeholder attribute text (not code stubs).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

---

## Test Results Summary

| Suite | Count | Status |
|-------|-------|--------|
| Backend cargo tests (all) | 217 pass, 0 fail | GREEN |
| Frontend Jest tests (all) | 608 pass, 0 fail | GREEN |
| Anti-abuse specific (honeypot + dedup + subtable + detail) | 27 pass, 0 fail | GREEN |

---

## Human Verification Required

### 1. Rate Limiting — 3rd Submission Blocked

**Test:** On a running server, submit a report successfully. Submit a second from within the same ~1km geohash-6 cell within the same hour. Attempt a third submission from the same location within the same hour.
**Expected:** First two succeed with HTTP 200. Third returns HTTP 429 with "You've submitted too many reports from this area recently. Try again in an hour."
**Why human:** governor uses in-memory state with real clock; hour-window cannot be simulated in unit tests; requires real HTTP traffic to a running server.

### 2. Proximity Dedup Job — Linked Reports

**Test:** On a running server with PostGIS, submit two reports within ~50m of each other in the same category. Wait up to 5 minutes.
**Expected:** In the admin triage queue, the newer report gains a "Duplicate" label; the original shows an orange badge with count "1".
**Why human:** `tokio::time::interval(300s)` cannot be fast-forwarded; requires live PostGIS with real location data and a running backend process.

### 3. Photo Hash Dedup — Silent Rejection

**Test:** Submit a report with a photo. Start a new report and upload the exact same photo file. Submit.
**Expected:** Second submission shows success to the user but no new row appears in admin queue; photo is not written to `uploads/` directory.
**Why human:** `check_photo_hash_exists` queries live DB; requires running PostGIS; logic path is verified by unit tests but end-to-end file upload + DB check requires integration environment.

### 4. Admin Sub-table Row Navigation

**Test:** In admin queue, expand a row with duplicates, then click on one of the sub-table rows.
**Expected:** Browser navigates to `/admin/reports/{id}` and the detail page renders with photo, description, category, severity, status badge, ward, dates.
**Why human:** `window.location.assign` is not testable in jsdom; requires real browser. Sr-only link DOM structure is verified by Jest, but actual navigation requires a browser environment.

---

## Gaps Summary

No gaps. All 9 observable truths verified. All 6 ABUSE requirements satisfied. All key links wired. 217 backend + 608 frontend tests green. UAT Tests 1-6 confirmed passed by user; Test 7 UAT gap (sub-table rendering and detail route) was identified, a gap-closure plan (02-03) was executed, and UAT status is now marked "resolved" in 02-UAT.md.

---

_Verified: 2026-03-13T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
