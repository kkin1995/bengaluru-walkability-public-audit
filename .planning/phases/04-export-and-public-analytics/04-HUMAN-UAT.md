---
status: complete
phase: 04-export-and-public-analytics
source: [04-VERIFICATION.md]
started: 2026-05-31T12:30:00Z
updated: 2026-05-31T14:08:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Heatmap toggle on public /map page

expected: Load `/map` in a browser; layer control appears top-right; toggle "Issue Density" adds/removes heatmap; only open-status reports contribute density; no SSR console error
result: pass
note: "Heatmap toggle present and works. Intermittent 'Couldn't load reports — tap to retry' error appeared on hard-refresh when reports hadn't loaded yet — logged as minor gap below."

### 2. Ward choropleth click-to-filter drilldown on /admin/analytics

expected: Log in as admin, navigate to `/admin/analytics`, click a ward polygon — WardTable row highlights, TrendChart caption shows ward name, "Clear filter" button resets both
result: pass
note: "User requested enhancement — ward table rows should also be clickable to activate filter (UX improvement, not a bug)"

### 3. CSV download with active filters from /admin/reports

expected: Apply category filter, click "Export CSV" — file downloads promptly (streaming), rows match filter, ward_name column present, dates DD/MM/YYYY, formula-injection fields prefixed with `'`
result: pass
note: "Files downloaded. CSV: ward_name present, dates DD/MM/YYYY. GeoJSON: valid FeatureCollection. Formula-injection prefix not exercisable with current clean data."

### 4. Rate limit enforcement on /api/reports.geojson

expected: Three rapid requests from same IP — first two succeed (200, valid GeoJSON with 3dp rounded coords), third returns 429
result: pass
note: "Verified via curl: requests 1+2 returned 200, request 3 returned 429. Coords confirmed 3dp (77.591/12.975, 77.641/12.977)."

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Reports on /map page load reliably across hard refreshes"
  status: failed
  reason: "Intermittent 'Couldn't load reports — tap to retry' error appeared during rapid hard-refreshes; resolved on retry. Heatmap toggle itself works correctly."
  severity: minor
  test: 1
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

## Enhancements

- source: test 2
  request: "Ward table rows on /admin/analytics should be clickable to activate the ward filter (in addition to clicking the map polygon)"
  priority: medium
