---
status: complete
phase: 07-admin-triage-ux-public-map
source: [07-11-SUMMARY.md, 07-12-SUMMARY.md, 07-13-SUMMARY.md]
kind: re-verification
note: Targeted re-test of 3 remaining gaps from 07-REVERIFY-UAT.md after gap-closure plans 07-11, 07-12, 07-13
started: 2026-06-24T08:30:00Z
updated: 2026-06-24T09:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Public Map Status Filter Intersection (TRIAGE-03)
expected: Open /map on desktop. With both "Blocked" category chip AND "In progress" status chip active, the map shows only reports that are both Blocked-category AND In-progress status. An acknowledged or assigned report must NOT appear when "In progress" is selected — it must only appear under "Open". Selecting "Open" status chip shows open/acknowledged/assigned reports. No cross-contamination.
result: pass
note: No in-progress reports in dataset; tested Blocked AND Open and other combinations — all working correctly.

### 2. Ward Polygon Click — No Black Rectangle (TRIAGE-04b)
expected: Open /map on desktop. Enable ward boundaries (WARDS toggle, bottom-right). Click on any ward polygon (interior or boundary). No black focus/selection rectangle should appear around the clicked ward. The polygon stays teal-outlined with no visual artifact after clicking. Hovering still shows the ward name tooltip.
result: pass

### 3. Ward Marker Click With Boundary Overlay On
expected: Open /map on desktop. Enable ward boundaries (WARDS toggle). Click on any report marker (CircleMarker pin) while ward boundaries are visible. The report detail popup should open correctly — it must not be swallowed by the ward boundary layer. Previously the transparent ward fill intercepted clicks above the markers.
result: pass

### 4. Admin Analytics Chart Lines Visible on Mobile (MOB-03)
expected: On a mobile viewport (or iOS Safari), navigate to /admin/analytics. Without tapping or interacting, the reports-per-week chart should immediately show visible colored data lines on first load. The chart must NOT be blank/empty on initial render. Lines remain visible after page finishes loading. (A single dot without a connecting line is a fail.)
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
