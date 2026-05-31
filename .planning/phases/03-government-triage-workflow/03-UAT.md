---
status: complete
phase: 03-government-triage-workflow
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-05-31T00:00:00Z
updated: 2026-05-31T00:00:00Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Start from scratch (docker compose up OR cargo run + npm run dev). Server boots without errors, migrations 008/009/010 apply cleanly (no checksum panics, no VersionMismatch), and GET /health returns 200.
result: pass

### 2. StatusBadge — 6 Status Values
expected: In the admin reports list, a report showing each of the six statuses (open, acknowledged, assigned, in_progress, resolved, closed) displays the correct human-readable label. No raw enum value (e.g. "in_progress") appears — it should show "In Progress". No "submitted" or "under_review" labels remain visible anywhere.
result: pass

### 3. Organizations Seeded — CORP Column in Admin List
expected: In the admin reports list, there is a "Corporation" column (or equivalent). For a report whose ward falls within a BBMP corporation zone (e.g. South, East, West, Mahadevapura, Dasarahalli), that corporation name appears in the column. For unassigned wards the column is empty/dash — not an error.
result: issue
reported: "Screenshot shows Cards view with no corporation field visible. Additionally, status filter tabs show old enum labels 'SUBMITTED 0' and 'REVIEW 0' instead of 'Open' and 'Acknowledged' — the enum was renamed in migration 008 but admin list UI filter labels were not updated. Plan 03-03 (admin frontend) was never executed."
severity: major

### 4. Admin Assign Report to Organization
expected: Open a report in the admin detail view. An "Org Assignment" panel or dropdown is visible. Select one of the 5 BBMP corporations and save. The assignment succeeds (no error, the selected org name appears), and the report's status changes to "assigned". The corporation name is now visible in the admin list for that report.
result: issue
reported: "Organisation Assignment panel is visible with a dropdown. Selecting 'Bengaluru North Corporation' and clicking Save shows 'Failed to save assignment. Please try again.' in red — the POST to assign-org is failing."
severity: major

### 5. Admin Resolve Report with Photo
expected: Open an in_progress (or open) report in admin. A "Resolve" action is available. Submitting resolve WITHOUT a photo is blocked — an error message appears requiring a photo. Upload a resolution photo and submit. The report status changes to "resolved". The resolution photo is visible in the admin detail view.
result: issue
reported: "Photo-required validation works correctly — 'A photo is required to mark this report as resolved.' blocks submission with no photo. However, when a photo is uploaded and submitted, the backend returns HTTP 500. The resolve endpoint is failing server-side."
severity: major

### 6. Public Report Detail — Status History
expected: Navigate to GET /api/reports/:id (or the public /reports/[id] page if it exists) for a report that has had at least one status change. The response/page includes a "history" array with status entries and timestamps — e.g. [{status: "open", changed_at: "..."}, {status: "resolved", changed_at: "..."}]. No "Invalid Date", no empty history when transitions exist.
result: pass

### 7. Public Report Detail — Ward Hierarchy
expected: GET /api/reports/:id returns a "ward_hierarchy" object with at minimum: ward_name, corporation, zone_name, assembly_constituency, parliamentary_constituency, mla_name, mp_name. For a ward with backfilled data (any of the 369 rows), all fields are populated — no "undefined" values. For a ward with no backfill, fields are null (not missing keys).
result: pass

### 8. Resolution Photo Privacy — Notes Not Leaked
expected: GET /api/reports/:id (public endpoint) does NOT include "resolution_notes" in the response body even if resolution notes were stored in the database. The field must be absent from the public JSON shape.
result: pass

## Summary

total: 8
passed: 5
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Admin reports list shows corporation name for each report and status filter tabs use current enum labels (Open, Acknowledged, Assigned, In Progress, Resolved, Closed)"
  status: failed
  reason: "User reported: No corporation column visible in Cards view. Filter tabs still show old enum labels 'SUBMITTED 0' and 'REVIEW 0' instead of new values. Plan 03-03 (admin frontend update) was never executed."
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "Admin can assign a report to an organization — POST /api/admin/reports/:id/assign-org succeeds and report shows assigned org"
  status: failed
  reason: "User reported: 'Failed to save assignment. Please try again.' — assign-org API call is returning an error. Org panel and dropdown are visible and functional."
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "Admin can resolve a report with a resolution photo — POST /api/admin/reports/:id/resolve succeeds, status changes to resolved, photo stored"
  status: failed
  reason: "Photo-required client-side validation works correctly. But submitting with a photo returns HTTP 500 from the backend. Both resolve and assign-org endpoints are failing — likely a shared root cause (uploads directory, DB transaction, or Docker config)."
  severity: major
  test: 5
  artifacts: []
  missing: []
