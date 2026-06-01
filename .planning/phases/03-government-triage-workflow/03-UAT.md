---
status: complete
phase: 03-government-triage-workflow
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-05-31T00:00:00Z
updated: 2026-06-01T03:20:00Z
---

## Current Test

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
result: pass
note: "Re-tested 2026-06-01 after Plan 03-03 executed. Desktop table view shows CORP column with correct geographic corporation (CENTRAL for both test wards). Filter chips confirmed: OPEN / IN REVIEW labels correct. Original gaps (stale labels + missing column) are resolved."

### 4. Admin Assign Report to Organization
expected: Open a report in the admin detail view. An "Org Assignment" panel or dropdown is visible. Select one of the 5 BBMP corporations and save. The assignment succeeds (no error, the selected org name appears), and the report's status changes to "assigned". The corporation name is now visible in the admin list for that report.
result: pass
note: "Re-tested 2026-06-01 after migration 012 fixed CONCURRENTLY MV bug. Bengaluru Central Corporation assigned successfully. Org persists after hard refresh. Status auto-advances to Assigned confirmed."

### 5. Admin Resolve Report with Photo
expected: Open an in_progress (or open) report in admin. A "Resolve" action is available. Submitting resolve WITHOUT a photo is blocked — an error message appears requiring a photo. Upload a resolution photo and submit. The report status changes to "resolved". The resolution photo is visible in the admin detail view.
result: pass
note: "Re-tested 2026-06-01. Photo upload accepted, status changed to Resolved. Same migration 012 fix resolved the HTTP 500."

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
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### Resolved (original 3 gaps — fixed by subsequent plans)

- truth: "Admin reports list shows corporation name and correct status filter labels"
  status: resolved
  resolved_by: "Plan 03-03 (filter chips, CORP column), migration 012 (CONCURRENTLY MV fix)"
  tests: [3, 4, 5]

### New findings — logged 2026-06-01

- id: NF-03-A
  truth: "Mobile compact-rows view — tapping a report row navigates to the single report detail page"
  status: resolved
  resolved_by: "Phase 03.4 Plan 02 — CompactRow outer div onClick + sr-only anchor + Status/Delete stopPropagation"
  reason: "In mobile compact-rows (ROWS toggle), only the tiny WLK-xxxxx ID text is an <a> link. The entire card is not a tappable target. On mobile the tap zone is too small to use reliably."
  severity: minor
  artifacts:
    - path: "frontend/app/admin/components/ReportsTable.tsx"
      issue: "CompactRow renders <a href=/admin/reports/:id> only around the WLK-xxxxx ID chip (line ~244). Whole card div has no onClick or wrapping anchor."
  missing:
    - "Wrap the CompactRow card body in an <a> or add an onClick that navigates to /admin/reports/:id, excluding the Status and Delete button tap zones."

- id: NF-03-B
  truth: "On report creation, the system automatically assigns the matching BBMP corporation organisation based on the ward's geographic territory. The CORP column in the admin list reflects this auto-assignment from day one. Admins can change the assignment at any time, and any manual change is recorded in the audit log."
  status: resolved
  resolved_by: "Phase 03.4 Plan 01 — get_org_for_ward, insert_report assigned_org_id, create_report auto-assign + audit insert, list_admin_reports CORP JOIN"
  reason: "Currently reports are created with assigned_org_id = NULL. The CORP column in the desktop table shows wards.corporation (a short geographic label e.g. 'Central') but this is NOT the assigned org — it is derived from the ward JOIN, not from reports.assigned_org_id. When admin manually assigns 'Bengaluru North Corporation' to a report in a 'Central' ward, the CORP column still shows 'CENTRAL' because it reads ward geography, not the assignment. Product decision: auto-assign the matching organisation on creation so the column reflects real routing."
  severity: major
  product_direction: |
    On report creation (create_report handler):
    1. After ward_id is resolved, query: SELECT id FROM organizations WHERE org_type = 'corporation'
       AND name ILIKE '%' || ward.corporation || '%' LIMIT 1
       (e.g. ward.corporation='Central' → 'Bengaluru Central Corporation')
    2. Set reports.assigned_org_id = matched_org.id (status stays 'open' — no auto-advance)
    3. Insert status_history row: changed_by = NULL (system), notes = 'Auto-assigned based on ward geography'
    Admin change via OrgAssignPanel:
    - Existing assign_report_org already writes status_history with changed_by_id (admin JWT) ✓
    - No additional changes needed for audit trail
    List query:
    - Replace wards.corporation AS corporation with o.name AS corporation (LEFT JOIN organizations o ON o.id = reports.assigned_org_id)
      so the CORP column shows the actual assigned org name, not the raw ward geography string
  artifacts:
    - path: "backend/src/handlers/reports.rs"
      issue: "create_report does not set assigned_org_id; reports always created with NULL"
    - path: "backend/src/db/admin_queries.rs:386"
      issue: "list_admin_reports uses wards.corporation AS corporation — shows ward geography string, not assigned org name"
