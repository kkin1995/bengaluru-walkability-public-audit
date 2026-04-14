---
status: awaiting_human_verify
trigger: "PATCH /api/admin/reports/:id/status returns an error — frontend shows 'Failed to update status. Please try again.'"
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED — INSERT into status_history used column name "status" which does not exist; schema has "new_status"
test: cross-referenced admin_queries.rs INSERT with 001_init.sql + 002_admin.sql schema definitions
expecting: fix resolves HTTP 500 on every PATCH /api/admin/reports/:id/status call
next_action: await human verification that status update works end-to-end

## Symptoms

expected: Clicking Confirm in the Change Report Status modal calls PATCH /api/admin/reports/:id/status with { status: "under_review" } and the report status updates successfully.
actual: The modal shows "Failed to update status. Please try again." — the request fails.
errors: No browser console error visible in screenshot. The error is caught in the frontend and shown as a user-facing message.
reproduction: Go to /admin/reports, click "Change Status" on any report, change dropdown to "Under Review", click Confirm.
timeline: Just introduced — the modal was added today as a bug fix. The underlying PATCH /api/admin/reports/:id/status endpoint existed before this change.

## Eliminated

- hypothesis: Route not registered in router
  evidence: main.rs line 167 correctly registers .route("/api/admin/reports/:id/status", patch(admin_update_report_status))
  timestamp: 2026-03-12T00:00:30Z

- hypothesis: Frontend sending wrong Content-Type or body format
  evidence: adminApi.ts updateReportStatus() sends "Content-Type: application/json" with JSON.stringify({ status }). UpdateStatusRequest deserializes { status: String, note: Option<String> } — correct match.
  timestamp: 2026-03-12T00:00:35Z

- hypothesis: JWT cookie missing or invalid causing 401
  evidence: Same browser session lists reports successfully using the same JWT; auth is not the issue.
  timestamp: 2026-03-12T00:00:40Z

- hypothesis: Invalid status value failing is_valid_status()
  evidence: Frontend dropdown values are "under_review"/"submitted"/"resolved" — exactly the three valid values. Would return 400, not 500.
  timestamp: 2026-03-12T00:00:45Z

- hypothesis: Report not found (404)
  evidence: Reports are already listed on the page from successful GET /api/admin/reports, so they exist in DB.
  timestamp: 2026-03-12T00:00:50Z

## Evidence

- timestamp: 2026-03-12T00:00:55Z
  checked: backend/migrations/001_init.sql status_history table definition
  found: |
    Columns: id, report_id, old_status, new_status, changed_at, note
    (002_admin.sql ALTER TABLE adds: changed_by UUID)
    Final columns: id, report_id, old_status, new_status, changed_at, note, changed_by
  implication: The column for the new status value is "new_status", NOT "status"

- timestamp: 2026-03-12T00:01:00Z
  checked: backend/src/db/admin_queries.rs update_report_status INSERT query (lines 480-491)
  found: |
    INSERT INTO status_history (report_id, status, note, changed_by)
    Column "status" does not exist in the status_history table.
  implication: |
    PostgreSQL error at runtime: column "status" of relation "status_history" does not exist
    → sqlx returns Error::Database → AppError::Database → HTTP 500
    → apiFetch throws "HTTP 500" → frontend catch block fires → shows "Failed to update status"

## Resolution

root_cause: |
  backend/src/db/admin_queries.rs update_report_status() inserts into status_history using the
  column name "status" but the actual schema column is "new_status" (defined in 001_init.sql).
  Every call to PATCH /api/admin/reports/:id/status fails with a PostgreSQL column-not-found
  error → HTTP 500, which the frontend catch block converts to the user-facing error message.

fix: |
  Changed the INSERT in update_report_status() from:
    INSERT INTO status_history (report_id, status, note, changed_by)
  to:
    INSERT INTO status_history (report_id, new_status, note, changed_by)
  This is the only change. One line, one file.

verification: |
  cargo check: passes (0 errors, 3 pre-existing dead_code warnings)
  cargo test:  211 tests pass (204 unit + 7 migration), 0 failed
  End-to-end: awaiting human confirmation

files_changed:
  - backend/src/db/admin_queries.rs
