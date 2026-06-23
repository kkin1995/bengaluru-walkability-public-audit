---
status: testing
phase: 07-admin-triage-ux-public-map
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-07-SUMMARY.md, 07-08-SUMMARY.md]
started: 2026-06-23T17:43:39Z
updated: 2026-06-23T17:43:39Z
note: A human-signed 07-UAT-CHECKLIST.md (all 13 req PASS) already exists. This conversational session verifies the same requirements interactively.
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Admin Corp/Ward Filter (TRIAGE-01)
expected: |
  Navigate to /admin/reports on desktop. The filter bar contains a "CORP:" trigger and a "WARD:" trigger separated from the existing filters by a vertical divider. Opening the Corp select shows a popover listing corporation names. Selecting a corp narrows the Ward list to that corp's wards only. The Ward popover has a search input (placeholder "grep ward name or no…") and shows "Showing N / 369". Selecting a ward filters the report list to that ward's reports. Clearing the corp ("All corps") resets the ward list to all 369 wards.
awaiting: user response

## Tests

### 1. Admin Corp/Ward Filter (TRIAGE-01)
expected: Navigate to /admin/reports on desktop. The filter bar contains a "CORP:" trigger and a "WARD:" trigger separated from the existing filters by a vertical divider. Opening the Corp select shows a popover listing corporation names. Selecting a corp narrows the Ward list to that corp's wards only. The Ward popover has a search input (placeholder "grep ward name or no…") and shows "Showing N / 369". Selecting a ward filters the report list to that ward's reports. Clearing the corp ("All corps") resets the ward list to all 369 wards.
result: issue
reported: "I can see CORP and WARDS at the top. I cannot click on CORP. When I click on Ward it changes to a text box with the text 'grep ward name or no...'. I enter 'Sam' and press enter, it does not do anything as the complaint in ward 'Hoysala Nagara Central' is still visible"
severity: major

### 2. Public Map Category Chips (TRIAGE-02)
expected: Open /map on desktop. A chip row is visible at the top: "All · N", "Damaged · N", "Blocked · N", "No path · N", "Crossing · N", "Lighting · N", "Other · N". Clicking "Damaged" activates the chip (dark background) and the map pins update to show only damaged-category reports. Clicking "All" resets to all pins.
result: [pending]

### 3. Public Map Status Filter Chips (TRIAGE-03)
expected: Open /map on desktop. Below the category chip row, a second row shows 4 status chips: "All statuses · N", "● Open · N" (red dot), "● In progress · N" (amber dot), "● Resolved · N" (green dot). Clicking "Open" shows only open/acknowledged/assigned reports on the map. Clicking "Resolved" shows only resolved/closed. With both "Damaged" category AND "Resolved" status active simultaneously, the map shows only damaged + resolved reports (AND logic).
result: [pending]

### 4. Ward Boundary Overlay (TRIAGE-04)
expected: Open /map on desktop. A ward toggle button (WARDS label, grid icon, 52×52px) is visible bottom-right above the "Report here" FAB. Clicking it triggers a brief loading state (button dims) then teal stroke-only ward polygon outlines appear across the map. A "Ward boundaries · 369 wards" banner appears near the map top. Hovering over a ward polygon shows a tooltip with the ward name. Clicking the toggle again hides the overlay. Clicking a third time restores the overlay immediately (cached — no loading delay).
result: [pending]

### 5. Before/After Resolution Photo on Report Detail (TRIAGE-05)
expected: Open a resolved report's public detail page (/reports/[id]) that has a resolution photo. On desktop (≥768px): two photos side-by-side — left labeled "Before" with a sub-label, right labeled "After" with a floating green "RESOLUTION" badge. On mobile (<768px): the two photos stack vertically. For an unresolved report: a single photo labeled "Photo" with no empty "After" slot.
result: [pending]

### 6. Admin Ops Page — Bottom Nav Clearance on iOS Safari (MOB-01)
expected: On iOS Safari, navigate to /admin (ops dashboard). Scroll to the very bottom of the page content. The last item on the page is fully visible above the bottom navigation bar — nothing is clipped or hidden behind the nav.
result: [pending]

### 7. Admin Reports Queue — Bottom Nav Clearance on iOS Safari (MOB-02)
expected: On iOS Safari, navigate to /admin/reports (reports queue). Scroll to the bottom of the report list. The last report card is fully visible above the bottom nav bar and "Load more" (if present) is tappable without the nav obscuring it.
result: [pending]

### 8. Admin Analytics Chart Renders on iOS Safari (MOB-03)
expected: On iOS Safari, navigate to /admin/analytics. The reports-per-week chart area shows visible colored data lines — NOT a blank rectangle. The chart container is not cut off.
result: [pending]

### 9. Admin Analytics Chart Legend Shows Readable Labels (MOB-04)
expected: On the admin analytics page, the chart legend shows human-readable category names (e.g., "Damaged footpath", "Blocked footpath", "Unsafe crossing") — NOT raw enum strings (e.g., "broken_footpath", "blocked_footpath").
result: [pending]

### 10. Choropleth Map Visible on Mobile (MOB-05)
expected: On iOS Safari (or mobile viewport), navigate to /admin/analytics. Scroll to the choropleth map section. The map has visible height and renders colored ward regions — NOT an empty/invisible container. No horizontal scroll required to see the map.
result: [pending]

### 11. Choropleth Handles Null GeoJSON Gracefully (MOB-06)
expected: Simulate a network failure when loading /admin/analytics (e.g., offline in DevTools before navigation). The page renders without a JavaScript crash or white screen. The choropleth section shows a graceful fallback (blank area or error message) — not an unhandled exception.
result: [pending]

### 12. Admin Map Leaflet Controls Above Bottom Nav (MOB-07)
expected: On iOS Safari, navigate to /admin/map (admin map view). Look at the bottom area of the map. The Leaflet attribution ("Leaflet | © OpenStreetMap") and any map controls are visible ABOVE the bottom nav bar — not hidden behind it.
result: [pending]

### 13. Backend Orientation Unit Test (TEST-01)
expected: Run `cd backend && cargo test bake_orientation_6` in a terminal. Both tests pass: `bake_orientation_6_swaps_width_height` and `bake_orientation_6_iphone_portrait_dimensions`. Output shows "2 passed; 0 failed".
result: [pending]

## Summary

total: 13
passed: 0
issues: 1
pending: 12
skipped: 0
blocked: 0

## Gaps

- truth: "CORP trigger opens a popover listing corporations; WARD search filters the ward list by name as you type; pressing Enter selects the first match"
  status: fixed
  reason: "User reported: CORP button not clickable (popover never opens); WARD search input appears but typing and pressing Enter does not filter the ward list"
  severity: major
  test: 1
  root_cause: "overflow-x:auto on the geo filter bar forces overflow-y:auto (CSS spec §overflow: one non-visible axis forces the other), which clips position:absolute popovers vertically. Corp popover: all clickable rows are clipped below the filter bar edge. Ward popover: search <input> is at the very top so it barely peeks through; the ward list below it is fully clipped. Enter key: no onKeyDown handler existed on the ward search input."
  artifacts:
    - path: "frontend/app/admin/reports/page.tsx"
      issue: "overflowX:'auto' on geo filter bar div — removed; onKeyDown Enter handler missing on WardPopover search input — added"
  missing:
    - "Remove overflowX:'auto' from geo filter bar (done in fix/07-corp-ward-filter-popover-clip)"
    - "Add onKeyDown Enter → select first ward match (done in fix/07-corp-ward-filter-popover-clip)"
  debug_session: ""
