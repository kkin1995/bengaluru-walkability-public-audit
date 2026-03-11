# Roadmap: Bengaluru Walkability Public Audit

## Overview

The citizen-facing submission and admin dashboard already exist. This milestone closes the loop between citizen reports and government action: first by grounding every report in a ward (Phase 1), then hardening the platform against abuse before any public launch (Phase 2), then building the government triage workflow that makes GBA want to use the platform (Phase 3), and finally surfacing the aggregated data as exports and public analytics that make the platform policy-relevant (Phase 4). Each phase gates the next; skipping the order produces features that either cannot be tested or will require rework.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Ward Foundation** - Import ward boundaries, auto-tag all reports to wards, build flexible organization hierarchy
- [ ] **Phase 2: Anti-Abuse and Data Quality** - Per-IP rate limiting, honeypot, proximity duplicate flagging, photo hash dedup
- [ ] **Phase 3: Government Triage Workflow** - Full status lifecycle, org assignment, resolution notes and photo, public map reflects status
- [ ] **Phase 4: Export and Public Analytics** - Streaming CSV/GeoJSON export, public stats page, admin analytics dashboard, heatmap

## Phase Details

### Phase 1: Ward Foundation
**Goal**: Every report is automatically routed to the correct Bengaluru ward, and the flexible GBA organization hierarchy is in place so admins can be assigned to organizations
**Depends on**: Nothing (existing codebase is the foundation)
**Requirements**: WARD-01, WARD-02, WARD-03, WARD-04
**Success Criteria** (what must be TRUE):
  1. A report submitted at any valid Bengaluru GPS coordinate automatically shows the correct ward name in the admin triage queue — no manual tagging required
  2. The organization hierarchy table exists and can represent GBA → corporation → ward office relationships without any code changes (data-only configuration)
  3. An admin user can be assigned to an organization, and that assignment controls which reports they see in the triage queue
  4. Ward boundary data is stored in PostGIS with SRID 4326 enforced, and a check constraint prevents mismatched spatial references
**Plans**: TBD

Plans:
- [ ] 01-01: Ward boundary data import (PostGIS migration, SRID validation, ST_Within trigger on reports)
- [ ] 01-02: Organizations table and admin org assignment (migration, backend handlers, admin UI)

### Phase 2: Anti-Abuse and Data Quality
**Goal**: The platform can withstand anonymous public submissions without spam, bots, or duplicate flooding corrupting the dataset before GBA launch
**Depends on**: Phase 1
**Requirements**: ABUSE-01, ABUSE-02, ABUSE-03, ABUSE-04, ABUSE-05, ABUSE-06
**Success Criteria** (what must be TRUE):
  1. A user who submits more than 5 reports in one hour from the same IP is silently throttled — they receive an error, legitimate users are unaffected
  2. A bot that fills all form fields (including the honeypot) has its submission silently discarded with no error or signal that detection occurred
  3. A report submitted within 50m of an existing open report of the same category is flagged as potential_duplicate — the original report's duplicate_count increments; both remain visible on the public map
  4. When multiple users report the same location within 50m (same category), the duplicate_confidence field is set to high — visible to admins as a severity signal
  5. An identical photo (same SHA256) submitted a second time is silently rejected without storing a duplicate image
  6. The admin triage queue shows duplicate_count on each report so high-count reports sort toward the top
**Plans**: TBD

Plans:
- [ ] 02-01: Governor rate limiting middleware and honeypot field (backend Axum middleware, frontend hidden field)
- [ ] 02-02: Proximity duplicate detection and photo hash dedup (ST_DWithin query, SHA256 check, schema additions, admin queue display)

### Phase 3: Government Triage Workflow
**Goal**: GBA admins can move reports through a full status lifecycle, assign reports to the correct corporation or ward office, attach resolution evidence, and the public map reflects every status change in real time
**Depends on**: Phase 2
**Requirements**: WFLOW-01, WFLOW-02, WFLOW-03, WFLOW-04, WFLOW-05, MAP-01, MAP-03
**Success Criteria** (what must be TRUE):
  1. An admin can transition a report through Open → Acknowledged → Assigned → In Progress → Resolved → Closed, and each transition is recorded in status_history with the acting admin's ID and timestamp
  2. An admin can assign a report to any organization in the hierarchy; the assigned organization's admins see that report in their queue
  3. An admin can add plain-text resolution notes when marking a report Resolved or Closed — notes are stored and visible in the admin detail view
  4. An admin can upload a resolution photo when marking a report Resolved — the after-photo is stored and linked to the report
  5. Public map pins display distinct colors for Open, In Progress, and Resolved — a citizen clicking any pin sees the current status in the popup
**Plans**: TBD

Plans:
- [ ] 03-01: Status lifecycle expansion (DB migration for new statuses, status_history trigger/handler, backend API)
- [ ] 03-02: Org assignment and resolution evidence (assign handler, resolution notes field, resolution photo upload)
- [ ] 03-03: Public map status display (color-coded pins by status, status field in map popup)

### Phase 4: Export and Public Analytics
**Goal**: GBA planners can download actionable exports in their preferred format, citizens can see high-level progress statistics, and admins have ward-level analytics to identify where investment is most needed
**Depends on**: Phase 3
**Requirements**: MAP-02, EXPORT-01, EXPORT-02, EXPORT-03, ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05
**Success Criteria** (what must be TRUE):
  1. An admin can click "Export CSV" with active filters and receive a streaming download with DD/MM/YYYY dates, ward name column, and Kannada category labels — the file opens correctly in Excel without truncation
  2. An admin can export filtered reports as a GeoJSON FeatureCollection that streams without buffering all rows in memory — the file is valid GeoJSON importable into QGIS
  3. A public unauthenticated GeoJSON endpoint returns all reports with coordinates rounded to 3 decimal places and zero PII fields
  4. A public stats page shows total report count, resolved count, and top 3 issue categories — data sourced from a materialized view so page load is fast
  5. The admin analytics view shows top 10 wards by unresolved report count, resolution rate per corporation, and a trend chart of reports per week over the last 12 weeks
  6. A heatmap layer on the public map shows issue density by geographic area and can be toggled on or off by the user
**Plans**: TBD

Plans:
- [ ] 04-01: Streaming CSV and GeoJSON export endpoints (backend streaming handlers, admin export UI)
- [ ] 04-02: Public GeoJSON endpoint and public stats page (unauthenticated endpoint, materialized view, stats page)
- [ ] 04-03: Admin analytics dashboard (top wards, resolution rate, trend chart, recharts integration)
- [ ] 04-04: Public map heatmap layer (leaflet.heat integration, toggle control)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ward Foundation | 0/2 | Not started | - |
| 2. Anti-Abuse and Data Quality | 0/2 | Not started | - |
| 3. Government Triage Workflow | 0/3 | Not started | - |
| 4. Export and Public Analytics | 0/4 | Not started | - |
