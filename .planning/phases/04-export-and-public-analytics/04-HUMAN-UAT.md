---
status: partial
phase: 04-export-and-public-analytics
source: [04-VERIFICATION.md]
started: 2026-05-31T12:30:00Z
updated: 2026-05-31T12:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Heatmap toggle on public /map page

expected: Load `/map` in a browser; layer control appears top-right; toggle "Issue Density" adds/removes heatmap; only open-status reports contribute density; no SSR console error
result: [pending]

### 2. Ward choropleth click-to-filter drilldown on /admin/analytics

expected: Log in as admin, navigate to `/admin/analytics`, click a ward polygon — WardTable row highlights, TrendChart caption shows ward name, "Clear filter" button resets both
result: [pending]

### 3. CSV download with active filters from /admin/reports

expected: Apply category filter, click "Export CSV" — file downloads promptly (streaming), rows match filter, ward_name column present, dates DD/MM/YYYY, formula-injection fields prefixed with `'`
result: [pending]

### 4. Rate limit enforcement on /api/reports.geojson

expected: Three rapid requests from same IP — first two succeed (200, valid GeoJSON with 3dp rounded coords), third returns 429
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
