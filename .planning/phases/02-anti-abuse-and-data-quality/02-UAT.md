---
status: complete
phase: 02-anti-abuse-and-data-quality
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md]
started: 2026-03-13T00:00:00Z
updated: 2026-03-13T00:00:00Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Run: docker compose up --build (or cargo run + npm run dev). Server boots without errors, migration 007_anti_abuse.sql applies cleanly, and GET http://localhost:3001/health returns a live response. No panic or startup crash.
result: pass

### 2. Rate Limiting — 429 on excess submissions
expected: Submit a report successfully. Then immediately submit another from the same location (same geohash-6 cell, ~1km area). The third submission within the same hour from that location should be blocked with HTTP 429 and a user-facing error message (e.g. "Too many submissions from this location"). The first two succeed normally.
result: pass

### 3. Honeypot Bot Detection — silent fake success
expected: Open browser DevTools, find the hidden "website" input in the report form (it exists in the DOM but is positioned off-screen via CSS, not visible to users). Manually set its value to any text (e.g. "http://bot.example.com") then submit the report. The form returns an apparent success (HTTP 200) with no error shown — but no report is actually created in the database. Legitimate users who leave the field empty are unaffected.
result: pass

### 4. Photo Hash Deduplication — silent rejection of identical photos
expected: Submit a report with a photo. Then start a new report and upload the exact same photo file again. The second submission should appear to succeed (HTTP 200 fake success) but no duplicate report should appear in the admin queue or public list. The identical-photo check fires before rate limiting.
result: pass

### 5. Proximity Dedup Background Job — nearby reports linked
expected: Submit two reports within ~50 metres of each other in the same category (e.g. two "pothole" reports at nearly the same GPS pin). Wait up to 5 minutes for the background job to run. In the admin triage queue, the later report should gain a "Duplicate" label and be linked to the earlier one. The original report should show a duplicate count badge.
result: pass

### 6. Admin Duplicate Count Badge
expected: In the admin triage queue (http://localhost:3000/admin/reports), any report that has been identified as having duplicates shows an orange pill badge with the duplicate count (e.g. "2 dupes"). Reports with no duplicates show no badge.
result: pass

### 7. Admin Expandable Duplicate Sub-table
expected: For a report showing the duplicate count badge in the admin queue, click the expand button on that row. An inline sub-table appears beneath it listing the linked duplicate reports (ID, category, status, submitted date). Collapsing the row hides the sub-table. The sub-table is only fetched on first expand — subsequent expand/collapse toggles use cached data.
result: issue
reported: "pass. The inline-subtable appears. However, the sub-table shows a random string of characters like an ID which has no meaning to the viewer. Also, there is no way to click on any of the reports to see further details like a photo, an audit log, description, details of the submitter etc"
severity: major

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Expandable duplicate sub-table shows meaningful report details (category, status, date, ward) and provides a way to navigate to the full report (photo, description, audit log, submitter details)"
  status: failed
  reason: "User reported: the sub-table shows a random string of characters like an ID which has no meaning to the viewer. Also, there is no way to click on any of the reports to see further details like a photo, an audit log, description, details of the submitter etc"
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
