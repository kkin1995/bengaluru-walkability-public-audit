---
status: complete
phase: 05-uat-stabilisation
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md]
started: 2026-06-05T13:52:28Z
updated: 2026-06-05T14:41:42Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: docker compose up --build boots cleanly — backend starts, migrations complete, health check responds.
result: issue
reported: "backend panicked: Failed to run database migrations: unsafe use of new value GPS_API of enum type location_source (55P04)"
severity: blocker
fixed: "Split migration 015 into 015 (ALTER TYPE ADD VALUE only) and 016 (UPDATE rows). SQLx 0.7 has no noTransaction pragma; the new enum values must commit in their own migration before the data migration can use them. Commit f5b9914."

### 2. Public report photo displays correctly
expected: Visit /reports/[id] for any existing report. The photo loads and displays. No broken-image icon. URL in DevTools Network tab should resolve to http://localhost:3001/uploads/... (not http://backend:3001/...)
result: pass
note: "Photo works on /reports/[id]. Does NOT show on /map popup when clicking a report dot — the map popup uses raw image_url (backend:3001 hostname), FIX-01 was only applied to reports/[id]/page.tsx. Logged as separate gap below."

### 2b. "Report another" navigates to home page
expected: Submit a report through the full citizen flow. On the success card, click "Report another issue". You should be taken to the home page (/) — not the old /report route.
result: pass

### 3. Deprecated /report and /reports routes redirect
expected: Visit http://localhost:3000/report — you should be redirected to /. Visit http://localhost:3000/reports — you should also be redirected to /. Both are permanent redirects (301). The /map page's "+" FAB should also link to / not /report.
result: pass

### 4. GPS coordinates display at 3 decimal places
expected: During the citizen report flow, when coordinates are detected (EXIF or browser geolocation), the coordinate pill shows 3 decimal places — e.g. "12.971, 77.594" not "12.9714, 77.5946". Check both the "Photo ready" card and the confirm step.
result: pass

### 5. Success card shows "Auto-detected" ward label
expected: After submitting a report that gets auto-assigned to a ward, the success card (SuccessCard) shows "Auto-detected" as the ward attribution label. It must NOT show "Auto-routed".
result: pass

### 6. Admin report detail page shows a Leaflet map
expected: Log in to admin (/admin/login). Open any report that has coordinates. The report detail page should show a real interactive read-only Leaflet map pinned to the report's location — not a blank card or placeholder. Reports without coordinates should show a "No coordinates" placeholder.
result: pass

### 7. Admin today counter shows date-based count
expected: On the admin dashboard (/admin), the "+N today" counter beneath the Submitted card reflects reports submitted today (by creation date), not a status-derived count. If you submit a new test report today, the counter should increment by 1 immediately after refresh.
result: pass

### 8. Admin location source label is human-readable
expected: In admin report detail, the "Location Source" chip/label shows a human-readable string: "GPS (device)" for GPS_API reports, "Photo GPS" for EXIF_GPS reports, "Manual pin" for MANUAL_ADJUST reports. It should NOT show raw enum values like GPS_API, EXIF_GPS, or the old "exif" / "manual_pin" strings.
result: pass

### 9. Public status history shows exactly one "Open" entry
expected: Visit /reports/[id] for any report. The status history section should show exactly one "Open" entry — not two. Previously auto-assigned reports showed a duplicate Open entry (one from submission, one from the auto-assign audit row).
result: pass
note: "Verified on a freshly submitted report — one Open entry. Older reports with multiple cycles (Open→Resolved→Open) show multiple entries correctly — those are legitimate admin transitions, not duplicates."

### 10. Leaflet map renders fully without grey tiles on confirm step
expected: In the citizen report flow, navigate to the confirm step (where the location map is shown). The Leaflet map should render completely — no large grey areas or tiles that only load after a manual window resize. The map should be correctly sized immediately on load.
result: pass
note: "The confirm step shows an intentional CSS map-tile placeholder by default. The real Leaflet map appears after tapping Adjust — tiles load correctly there."

### 11. iPhone portrait photo displays upright
expected: Submit a report using a portrait photo taken on an iPhone (EXIF orientation = 6, typically tall portrait mode). The stored/displayed photo should appear upright — not rotated 90° sideways. The orientation fix bakes rotation into pixels before EXIF is stripped.
result: skipped
reason: Verify on staging after ship.

### 12. Public map tiles load on iOS Safari (CSP fix)
expected: On an iOS Safari browser (device or simulator), open the public reports map. Map tiles from OpenStreetMap should load and render correctly — not blocked by CSP errors. Previously the nginx CSP for the public route was missing the connect-src allowlist for tile.openstreetmap.org.
result: skipped
reason: Verify on staging after ship.

## Summary

total: 13
passed: 9
issues: 3
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "docker compose up --build boots without errors"
  status: fixed
  reason: "backend panicked on migration 015: unsafe use of new value GPS_API of enum type location_source (PostgreSQL 55P04). SQLx 0.7 has no noTransaction pragma — every migration runs in a transaction, so the new enum values added by ALTER TYPE ADD VALUE cannot be used in the same transaction. Fix: split into migration 015 (ALTER TYPE ADD VALUE only) + 016 (UPDATE rows). Commit f5b9914."
  severity: blocker
  test: 1

- truth: "Photo displays when clicking a report dot on /map popup"
  status: failed
  reason: "User reported: photo does not show up when clicking report dot on /map. Works on /reports/[id]. FIX-01 was only applied to reports/[id]/page.tsx; the map popup component still uses raw image_url with internal backend:3001 hostname."
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "After selecting a photo on home page, the report flow proceeds to /report form"
  status: fixed
  reason: "FIX-03 added permanent redirect /report → / in next.config.mjs. Next.js redirects intercept client-side router.push() — so ReportCTA's router.push('/report') after photo selection sent users back to home page silently. Fix: removed /report from redirects (page is still active). Commit c165e67."
  severity: blocker
  test: 4
