# Roadmap: Bengaluru Walkability Public Audit

## Overview

The citizen-facing submission and admin dashboard already exist. This milestone closes the loop between citizen reports and government action: first by grounding every report in a ward (Phase 1), then hardening the platform against abuse before any public launch (Phase 2), then building the government triage workflow that makes GBA want to use the platform (Phase 3), and finally surfacing the aggregated data as exports and public analytics that make the platform policy-relevant (Phase 4). Each phase gates the next; skipping the order produces features that either cannot be tested or will require rework.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Ward Foundation** - Import ward boundaries, auto-tag all reports to wards, build flexible organization hierarchy (completed 2026-03-12)
- [x] **Phase 2: Anti-Abuse and Data Quality** - Per-IP rate limiting, honeypot, proximity duplicate flagging, photo hash dedup (gap closure in progress) (completed 2026-03-13)
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
**Plans**: 6 plans

Plans:
- [ ] 01-01-PLAN.md — GBA ward KML download, GeoJSON conversion, wards + organizations migration SQL
- [ ] 01-02-PLAN.md — Ward and Organization Rust models, get_ward_for_point query, org CRUD API endpoints
- [ ] 01-03-PLAN.md — Admin dashboard ward column (reports queue) and org assignment UI (users page)
- [ ] 01-04-PLAN.md — Gap closure: fix admin reports JSON shape contract and add ward_name JOIN
- [ ] 01-05-PLAN.md — Gap closure: fix wards.ward_name column reference (was wards.name) in list_admin_reports SQL
- [ ] 01-06-PLAN.md — Gap closure: implement org-scoped report visibility (WARD-03 / ROADMAP SC#3)

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
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Rate limiting (governor, IP+geohash-6 key) and honeypot (website field, CSS off-screen, fake 200) with migration 007 schema additions
- [ ] 02-02-PLAN.md — Photo hash dedup (SHA256 before EXIF strip), async proximity dedup job (ST_DWithin 50m, 5-min poll), admin queue duplicate signals
- [ ] 02-03-PLAN.md — Gap closure: fix duplicate sub-table rendering (ward_name, dates, StatusBadge, clickable rows) and create /admin/reports/[id] detail page

### Phase 02.3: UAT Bug Fixes — admin category label, iOS camera UX, admin mobile layout, map legend consistency (INSERTED)

**Goal:** Fix all 5 issues found in the 2026-04-15 field UAT so admin table shows human-readable labels, iOS camera UX differentiates camera vs. gallery, admin sidebar is reachable on mobile, and category labels are consistent across all surfaces
**Depends on:** Phase 2
**Requirements**: BUG-01, BUG-02, UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Admin reports table Category column shows "Damaged Footpath" (not "broken_footpath") using getCategoryLabel() from translations.ts
  2. On iOS Safari, "Take Photo" opens the camera directly and "Upload from Gallery" opens the photo library — no shared action sheet
  3. Admin reports table has a right-edge fade gradient on mobile indicating horizontal scroll
  4. A hamburger button is visible on mobile admin pages, opening a slide-in sidebar drawer with all nav links
  5. Map legend, map popup, and admin table all show identical category labels sourced from translations.ts
**Plans**: 3 plans

Plans:
- [ ] 02.3-01-PLAN.md — Admin category labels (BUG-01), table scroll gradient (UX-01), map label consolidation (UX-03)
- [ ] 02.3-02-PLAN.md — iOS camera UX label-wrapping fix (BUG-02)
- [x] 02.3-03-PLAN.md — Admin sidebar extraction with mobile hamburger drawer (UX-02)

### Phase 02.3.1: Implement Walkable BLR UI redesign from design file on separate branch (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 02.3
**Plans:** 1/3 plans executed

Plans:
- [ ] TBD (run /gsd:plan-phase 02.3.1 to break down)

### Phase 02.2: Vercel Staging Deployment and Pre-UAT Hardening (INSERTED)

**Goal:** Get the full stack onto a publicly accessible staging URL (staging-walkability.kinariwala.com) with cross-domain auth working so GBA/Walkaluru stakeholders can do UAT before Phase 3 ships
**Depends on:** Phase 2
**Requirements**: STAGING-01, STAGING-02, STAGING-03, STAGING-04, STAGING-05, STAGING-06
**Success Criteria** (what must be TRUE):
  1. Admin login works on staging: navigating to staging-walkability.kinariwala.com/admin/login and entering credentials produces a valid session cookie on the Vercel domain
  2. Public report submission works on staging: a citizen can submit a photo with GPS coordinates via the staging URL
  3. The deploy.yml workflow triggers smoke tests after push-to-main that verify Railway backend health and Vercel frontend reachability
  4. A complete STAGING-SETUP.md exists with step-by-step provisioning for Railway, Vercel, DNS, and GitHub Actions secrets
  5. All existing cargo test and npm run build pass with the cross-domain auth changes
**Plans**: 3 plans

Plans:
- [x] 02.2-01-PLAN.md — Backend SameSite cookie fix + Next.js admin API rewrites + split config for cross-domain auth
- [x] 02.2-02-PLAN.md — CI/CD smoke test wiring in deploy.yml + Railway config-as-code (railway.toml)
- [x] 02.2-03-PLAN.md — STAGING-SETUP.md operational guide with env var checklist and pre-UAT verification

### Phase 02.1: OWASP Secure Coding Practices Audit and Hardening (INSERTED)

**Goal:** All OWASP-relevant security findings on the public submission path and admin JWT auth path are remediated or formally accepted with documented rationale before GBA soft launch
**Depends on:** Phase 02
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. Public API responses (GET /api/reports, GET /api/reports/:id) do not contain submitter_name PII
  2. All production handlers use the single canonical require_role from middleware (admin-is-superset semantics)
  3. No .unwrap() calls on serde_json::to_value in production handler paths
  4. COOKIE_SECURE defaults to true in production docker-compose
  5. nginx.conf documents TLS termination expectations and CSP style-src has no unsafe-inline
  6. Login page and password validation are hardened against information leakage and threshold mismatch
  7. CI pipeline runs cargo audit and npm audit --audit-level=high on every PR
**Plans**: 2 plans

Plans:
- [ ] 02.1-01-PLAN.md — Backend hardening: strip submitter_name from public API, remove duplicate require_role, fix serde_json unwraps
- [ ] 02.1-02-PLAN.md — Config/frontend/CI hardening: COOKIE_SECURE default, TLS docs, CSP, login error, password threshold, dependency audits

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
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — DB migrations 008/009 (ENUM rename + add values), Report/ReportResponse struct extension, get_report_stats fix
- [ ] 03-02-PLAN.md — Backend: expanded validate_status, resolve_report and assign_report_org DB fns, two new handler routes
- [ ] 03-03-PLAN.md — Admin frontend: StatusBadge expansion, ResolveModal, OrgPicker, detail page wiring
- [ ] 03-04-PLAN.md — Public map: STATUS_COLORS pin colors, popup status label + after-photo, map legend update

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
Phases execute in numeric order: 1 → 2 → 2.1 → 2.2 → 2.3 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ward Foundation | 6/6 | Complete   | 2026-03-12 |
| 2. Anti-Abuse and Data Quality | 3/3 | Complete   | 2026-03-13 |
| 2.1 OWASP Hardening | 0/2 | Not started | - |
| 2.2 Staging Deployment | 3/3 | Complete | - |
| 2.3 UAT Bug Fixes | 0/3 | Not started | - |
| 3. Government Triage Workflow | 0/4 | Not started | - |
| 4. Export and Public Analytics | 0/4 | Not started | - |
