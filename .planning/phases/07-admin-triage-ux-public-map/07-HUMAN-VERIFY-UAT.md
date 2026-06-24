---
status: complete
phase: 07-admin-triage-ux-public-map
source: [07-VERIFICATION.md human_verification items]
kind: human-verification
note: iOS Safari physical-device confirmation of 5 behavior-unverified items + 1 DevTools test from 07-VERIFICATION.md
started: 2026-06-24T11:03:09Z
updated: 2026-06-24T11:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Admin Corp/Ward Filter State Transition — iOS Safari (TRIAGE-01)
expected: |
  On iOS Safari at staging.nammadaari.com/admin/reports:
  1. Open Corp select → select any corporation (e.g. BBMP)
  2. Open Ward select → it shows only that corp's wards with "Showing N / 369 · [corp name]"
  3. Select a ward → report list filters to only that ward's reports
  4. Clear corp ("All corps") → ward list returns to all 369 wards
result: pass
note: All 4 steps confirmed on staging with real reports submitted during testing.

### 2. Ward Boundary Overlay — iOS Safari (TRIAGE-04)
expected: |
  On iOS Safari at staging.nammadaari.com/map:
  1. Tap WARDS button (bottom-right) → teal stroke-only ward polygons appear over map
  2. "Ward boundaries · 369 wards" banner appears below search bar
  3. Tap any ward polygon interior → ward name tooltip appears; NO black focus rectangle
  4. Tap WARDS again → overlay hides
  5. Tap WARDS a third time → instant re-render, no loading delay (cache working)
result: pass

### 3. Status Chip Intersection — iOS Safari (TRIAGE-03)
expected: |
  On iOS Safari at staging.nammadaari.com/map:
  1. Select "Blocked" category chip → only Blocked reports show
  2. Also select "In progress" status chip → only Blocked + in_progress reports show (NOT acknowledged/assigned)
  3. Switch to "Open" status chip → acknowledged/assigned reports now appear
result: pass
note: Confirmed on staging — Blocked AND Open combination works as expected. All 3 steps verified with real reports.

### 4. Before/After Photo Layout — Resolved Report (TRIAGE-05)
expected: |
  Navigate to a resolved report with a resolution photo (find one via admin portal):
  - Desktop (≥768px): two photos side-by-side, "Before" label left + "After" label right with floating green "RESOLUTION" badge
  - Mobile (≤375px viewport): photos stack vertically
  Navigate to an unresolved report:
  - Single photo labeled "Photo" (not "Before"), no empty After slot
result: pass
note: Confirmed on staging — submitted report via citizen flow, uploaded resolution photo via admin flow, verified side-by-side layout on desktop and stacked on mobile.

### 5. Analytics Chart Lines — iOS Safari First Paint (MOB-03)
expected: |
  On iOS Safari at staging.nammadaari.com, log in as admin → navigate to /admin/analytics:
  - Without tapping anything, chart shows visible colored data lines on first load
  - Lines visible before any interaction (no tap required)
  - Legend shows human-readable names (e.g. "Blocked Footpath" not "blocked_footpath")
result: pass
note: Confirmed on staging — chart data shows immediately on page load without interaction. Two dots only (expected — all reports from same day, no connecting line with single-day data). Legend shows human-readable names.

### 6. Choropleth Null GeoJSON Fallback — DevTools Request Block (MOB-06)
expected: |
  In desktop Chrome DevTools (Network → Block request URL → block /api/admin/wards/boundaries):
  - Navigate to /admin/analytics
  - Page does NOT crash or show white screen
  - Graceful fallback: error text or blank choropleth area shown
result: pass
note: Confirmed on staging — blocked /api/admin/wards/boundaries via DevTools, navigated to /admin/analytics. Message shown above map: "Failed to load ward boundaries. The choropleth map will not show data." No crash, no white screen.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
