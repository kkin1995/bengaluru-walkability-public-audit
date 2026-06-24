---
status: complete
phase: 07-admin-triage-ux-public-map
source: [07-09-SUMMARY.md, 07-10-SUMMARY.md, bc568ee, edd4ba9, e98f265, edf035f]
kind: re-verification
note: Targeted re-test of 6 issues from 07-UAT.md after gap-closure plans 07-09 and 07-10
started: 2026-06-24T05:56:29Z
updated: 2026-06-24T06:12:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Public Map Status Filter Intersection (TRIAGE-03)
expected: Open /map on desktop. With both "Blocked" category chip AND "In progress" status chip active, the map shows only reports that are both blocked-category AND in-progress status (AND logic). Selecting "Open" status should show reports with open/acknowledged/assigned status. No cross-contamination — an open-status report should NOT appear when "In progress" is selected.
result: issue
reported: "When I click on Open AND Blocked, it shows one complaint which is correct. When I click on In Progress AND Blocked, that first complaint disappears and another shows which is Open AND Blocked."
severity: major

### 2. Ward Boundary Hover on Polygon Interior (TRIAGE-04)
expected: Open /map on desktop. Enable ward boundaries (WARDS toggle, bottom-right). Hover the mouse over the interior of a ward polygon (not on the boundary line itself, but the filled area inside). The ward name tooltip should appear. Previously it only showed when hovering the boundary edge.
result: pass
note: Hover on polygon interior works (tooltip shows ward name). New issue found: clicking a ward shows a black focus rectangle around the polygon — logged as TRIAGE-04b.

### 2b. Ward Polygon Click Black Rectangle (TRIAGE-04b) [NEW]
expected: Clicking a ward polygon on /map should not produce a visible black focus/selection rectangle around the ward. The polygon should be hover-only; clicks should produce no visual artifact.
result: issue
reported: "Yes it does! However, when I click on a ward, this black rectangle appears. Can we remove that please?"
severity: cosmetic

### 3. Admin Ops Bottom Nav Clearance — iOS Safari (MOB-01)
expected: On iOS Safari, navigate to /admin (ops dashboard). Scroll to the very bottom of the page. The last content item (bottom edge of box) must be fully visible above the bottom nav bar — NOT clipped behind it. Fix raised bottom padding to 76px.
result: pass
note: Verified in browser simulated mobile (375px). All content including RECENT ACTIVITY section fully visible above the nav bar. Real iOS Safari not testable — phone cannot reach local dev server on campus WiFi.

### 4. Admin Reports Bottom Nav + CompactRow Layout — iOS Safari (MOB-02)
expected: On iOS Safari, navigate to /admin/reports. (a) Scroll to the very bottom — the last report card's bottom edge must be fully visible above the nav bar. (b) In the compact/rows view on a 375px wide screen, each row shows two clean lines: line 1 = category name + severity + status badge; line 2 = ID/ward/time meta + action buttons. No text wrapping across badges, no overlapping elements.
result: pass
note: Verified in browser simulated mobile (375px).

### 5. Admin Analytics Chart Renders on iOS Safari (MOB-03)
expected: On iOS Safari, navigate to /admin/analytics. The reports-per-week chart shows visible colored lines immediately on page load — NOT a blank rectangle. No tap required to see lines. Lines remain visible after the page finishes loading.
result: issue
reported: "Without clicking: chart area is blank, no lines visible (only grid/axes). With clicking: a single dot appears at the data point with tooltip, but the line connecting data points is still not drawn."
severity: major

### 6. Admin Analytics Chart Tooltip Human-Readable Labels (MOB-04)
expected: On /admin/analytics, tap the chart to trigger the tooltip. The tooltip shows human-readable category names such as "Blocked Footpath", "Damaged Footpath" — NOT raw enum strings like "blocked_footpath" or "broken_footpath". The chart legend also shows human-readable names (not raw enums).
result: pass
note: Tooltip shows "Blocked Footpath : 2" (human-readable). Legend shows "Blocked Footpath" and "No Footpath". Confirmed in MOB-03 screenshots.

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Selecting 'In Progress' status chip shows only in-progress reports — Open-status reports must not appear"
  status: failed
  reason: "User reported: When I click on In Progress AND Blocked, that first complaint disappears and another shows which is Open AND Blocked. Status chip shows 'In progress · 0' but an Open report still renders on the map."
  severity: major
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Clicking a ward polygon on /map should produce no visible black focus/selection rectangle"
  status: failed
  reason: "User reported: when I click on a ward, this black rectangle appears. Can we remove that please?"
  severity: cosmetic
  test: "2b"
  root_cause: "Leaflet renders a default SVG path focus outline when a polygon is clicked. The fill:true + fillOpacity:0 fix (for hover hit area) made the polygon clickable/interactive, which now receives focus on click and shows the browser's default outline."
  artifacts:
    - path: "frontend/app/map/components/WardBoundaryLayer.tsx"
      issue: "GeoJSON layer needs outline:none on SVG path focus state, or eventHandlers with blur() on click"
  missing:
    - "Add CSS outline:none to Leaflet SVG paths, or call e.target.closePopup()/e.target._path.blur() in the polygon click handler"
  debug_session: ""

- truth: "Reports-per-week chart on /admin/analytics shows visible colored lines immediately on page load"
  status: failed
  reason: "Without clicking: chart area is blank, no lines visible (only grid/axes). With clicking: a single dot appears at the data point with tooltip, but the connecting line is still not drawn. The isAnimationActive={false} fix in plan 07-09 did not resolve this in Chrome simulated mobile."
  severity: major
  test: 5
  root_cause: "isAnimationActive={false} on Line elements disables animation but does not resolve the underlying Recharts rendering issue where line paths are not painted when the SVG container dimensions change after mount. Likely cause: ResponsiveContainer still not measuring correctly in simulated mobile — or the dot renderer and line renderer diverge (dot shows, path does not). Needs investigation: possibly stroke is missing/transparent, or the line path d attribute is empty on first paint."
  artifacts:
    - path: "frontend/app/admin/components/TrendChart.tsx"
      issue: "Line elements have dots but no visible stroke path — may need dot={true} explicit, stroke explicitly set, or a different container sizing approach"
  missing:
    - "Investigate why line SVG path is not rendered while dot is — check if stroke color, strokeWidth, or the path d attribute is missing on first paint"
    - "Consider switching to LineChart with explicit width/height instead of ResponsiveContainer for mobile"
  debug_session: ""
