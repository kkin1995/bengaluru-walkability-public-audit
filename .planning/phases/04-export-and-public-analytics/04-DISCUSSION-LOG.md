# Phase 4: Export and Public Analytics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 04-export-and-public-analytics
**Areas discussed:** Heatmap visualization, Admin analytics structure, Charts library choice, Road network KML scope, CSV export column set + Excel encoding, Materialized view refresh strategy, Public GeoJSON field spec

---

## Heatmap Visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate layers | Public = leaflet.heat heatmap, Admin = ward choropleth | ✓ |
| Choropleth only on both | Ward fill on both surfaces; no leaflet.heat | |
| Heatmap only (skip choropleth) | Only leaflet.heat; admin shows tabular counts | |

**User's choice:** Two separate layers
**Notes:** Different audiences warrant different tools. Public map = point density heatmap for citizens; admin analytics = ward choropleth for GBA planners.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Open/unresolved only | Resolved reports don't contribute to heat | ✓ |
| All reports, all statuses | Cumulative activity heatmap | |

**User's choice:** Open/unresolved only
**Notes:** Heatmap communicates active problem density. Resolved reports staying as green pins without contributing heat is the right semantics.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Leaflet layer control | Native L.control.layers top-right toggle | ✓ |
| Custom toggle button | Styled chip in existing filter strip | |

**User's choice:** Leaflet layer control

---

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only with tooltip | Hover shows ward name + count | |
| Interactive with filter drilldown | Click ward → filter analytics tables | ✓ |

**User's choice:** Interactive with filter drilldown
**Notes:** Adds coordination between map and table state but makes the analytics page meaningfully interactive.

---

## Admin Analytics Structure

| Option | Description | Selected |
|--------|-------------|----------|
| New /admin/analytics route | Dedicated page with nav entry | ✓ |
| Expand /admin dashboard | Everything on one scrolling page | |

**User's choice:** New /admin/analytics route

---

| Option | Description | Selected |
|--------|-------------|----------|
| KPI+chart top / table+map bottom | Standard analytics layout | ✓ |
| Tabs: Overview / Wards / Map | Three-tab split | |

**User's choice:** KPI cards + trend chart at top; ward table + choropleth map side-by-side at bottom

---

| Option | Description | Selected |
|--------|-------------|----------|
| /admin/reports only | Export alongside existing filter bar | |
| /admin/analytics only | Export on analytics page | |
| Both pages | Export on reports page + quick export on analytics | ✓ |

**User's choice:** Both pages

---

| Option | Description | Selected |
|--------|-------------|----------|
| New /stats page | Standalone shareable URL | ✓ |
| Stats section on home page (/) | Embedded in home page | |

**User's choice:** New /stats page
**Notes:** Shareable URL is important for Walkaluru press and advocacy use.

---

## Charts Library Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Recharts | React-native, 50kb, covers all Phase 4 chart types | ✓ (conditional) |
| CSS-only (extend Sparkbars) | No library, Direction-B consistent | |
| Nivo | More capable, heavier | fallback |

**User's choice:** Recharts if it covers all requirements; else something aesthetic and fast
**Notes:** Recharts confirmed to cover all Phase 4 chart types (line, bar). Choropleth is react-leaflet, not recharts. Nivo not needed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bar chart | Discrete weekly bars | |
| Line chart | Shows trend/slope | ✓ |

**User's choice:** Line chart for trend

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single-select | One category at a time | |
| Multi-select (legend toggle) | Multiple category lines, recharts legend click-to-hide | ✓ |

**User's choice:** Multi-select with legend toggle

---

## Road Network KML Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 5 / future milestone | Keep Phase 4 focused | ✓ (as Phase 6) |
| Include road segment import only | road_segments table + nearest-road snap | |
| Include both road datasets | Full import + reports-per-km analytics | |

**User's choice:** Defer — explicitly to **Phase 6** (Phase 5 already has defined scope)

---

## CSV Export Column Set + Excel Encoding

| Option | Description | Selected |
|--------|-------------|----------|
| Core columns only | ID, date, category, severity, status, ward, corp, lat/lng, description | |
| Core + resolution columns | Core + resolved_at, resolution_notes | |
| Full audit export | All fields including assigned_org, photo_hash, duplicate_count, submitter contact | ✓ |

**User's choice:** Full audit export

---

| Option | Description | Selected |
|--------|-------------|----------|
| UTF-8 BOM | Needed for Excel + Kannada text | |
| Pure UTF-8 | No Kannada in CSV | ✓ |

**User's choice:** No Kannada text in CSV exports (overrides REQUIREMENTS.md EXPORT-01)
**Notes:** This is a significant override of the written requirement. English category labels in CSV. No BOM needed.

---

## Materialized View Refresh Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Trigger on insert (REFRESH MATERIALIZED VIEW CONCURRENTLY) | Always fresh, no cron | ✓ |
| Periodic refresh (pg_cron / systemd timer) | Slightly stale, decoupled | |
| On-demand admin endpoint | Manual refresh | |

**User's choice:** Trigger on report insert

---

## Public GeoJSON Field Spec

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal public set | id, category, severity, status, ward, corporation, submitted_at | |
| Extended research set | Minimal + description + after_photo_url | |
| Full open data set | All public fields + resolution_notes + resolved_at | ✓ |

**User's choice:** Full open data set, but **strongly rate limited** — infrastructure protection is top priority
**Notes:** Both layers: nginx rate-limit zone + application governor (defense in depth).

---

| Option | Description | Selected |
|--------|-------------|----------|
| nginx rate limit only | Dedicated zone, first line of defense | |
| governor (application layer) only | Flexible 429 JSON response | |
| Both layers together | Defense in depth | ✓ |

**User's choice:** Both layers together

---

## Claude's Discretion

- Ward choropleth color scale (low unresolved = light teal, high = deep red/amber)
- leaflet.heat intensity/radius parameters for Bengaluru city zoom
- `/stats` page visual design (Direction-A, globals.css)
- nginx rate limit zone name and threshold for public GeoJSON
- Public GeoJSON URL path (`/api/reports.geojson` vs `/api/reports/export.geojson`)
- recharts ResponsiveContainer sizing, tooltip formatting

## Deferred Ideas

- Road network KML import → Phase 6 (road_segments, road_width_segments, reports-per-km, corridor clustering)
- Ward boundary polygon overlay on public map (MAP-V2-02) → post-Phase 4
- Category + status filter controls on public map (MAP-V2-01) → v2
