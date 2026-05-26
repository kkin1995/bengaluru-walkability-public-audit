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
- [x] **Phase 02.4: Self-Hosted Infrastructure — Arch Linux + Cloudflare Tunnel** - Decommission Railway, host backend + DB on Arch Linux desktop via Docker Compose, expose via Cloudflare tunnel, self-hosted GitHub Actions runner (INSERTED — must complete before Phase 3) (completed 2026-05-20)
- [x] **Phase 02.4.1: Security Hardening** - JPEG magic-bytes upload validation, logout cookie SameSite fix, nginx Content-Type override, weekly backups (pg_dump + uploads) with systemd timer, secret rotation + restore docs, external uptime monitor (INSERTED — must complete before Phase 3) (completed 2026-05-20)
- [x] **Phase 02.5: Admin Portal UI Redesign** - Implement the hybrid "B-voice × A-structure" design system for the admin portal at /admin — teal Console palette, JetBrains Mono chrome, A-pattern report cards, light+dark mode, full accessibility pass (INSERTED — visual polish before GBA handoff) (completed 2026-05-22)
- [ ] **Phase 02.6: Build Metadata & Version Stamping** - Inject `package.json` version into both the citizen-facing UI footer and the admin console brand string at build time via `NEXT_PUBLIC_APP_VERSION`; auto-update on every release (INSERTED — polish before GBA handoff)
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

- [x] 01-01-PLAN.md — GBA ward KML download, GeoJSON conversion, wards + organizations migration SQL
- [x] 01-02-PLAN.md — Ward and Organization Rust models, get_ward_for_point query, org CRUD API endpoints
- [x] 01-03-PLAN.md — Admin dashboard ward column (reports queue) and org assignment UI (users page)
- [x] 01-04-PLAN.md — Gap closure: fix admin reports JSON shape contract and add ward_name JOIN
- [x] 01-05-PLAN.md — Gap closure: fix wards.ward_name column reference (was wards.name) in list_admin_reports SQL
- [x] 01-06-PLAN.md — Gap closure: implement org-scoped report visibility (WARD-03 / ROADMAP SC#3)

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

- [x] 02-01-PLAN.md — Rate limiting (governor, IP+geohash-6 key) and honeypot (website field, CSS off-screen, fake 200) with migration 007 schema additions
- [x] 02-02-PLAN.md — Photo hash dedup (SHA256 before EXIF strip), async proximity dedup job (ST_DWithin 50m, 5-min poll), admin queue duplicate signals
- [x] 02-03-PLAN.md — Gap closure: fix duplicate sub-table rendering (ward_name, dates, StatusBadge, clickable rows) and create /admin/reports/[id] detail page

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

- [x] 02.3-01-PLAN.md — Admin category labels (BUG-01), table scroll gradient (UX-01), map label consolidation (UX-03)
- [x] 02.3-02-PLAN.md — iOS camera UX label-wrapping fix (BUG-02)
- [x] 02.3-03-PLAN.md — Admin sidebar extraction with mobile hamburger drawer (UX-02)

### Phase 02.3.2: Walkable BLR — Frontend gap-fill (3 missing design pieces) (INSERTED)

**Goal:** Close the five design pieces deferred from Phase 02.3.1: gallery escape hatch on home page, CategoryGrid 2-col × 3-row revert with privacy notice, live count verification, map filter chip strip with 7 chips, and per-category counts derived from the fetched reports array — all on a dedicated branch from main.
**Requirements**: UI-GALLERY-ESCAPE-HATCH, UI-CATEGORY-GRID, UI-LIVE-COUNT-VERIFY, UI-MAP-FILTER-CHIPS, UI-PER-CATEGORY-COUNTS (phase-local)
**Depends on:** Phase 02.3.1
**Plans:** 3 plans

Plans:

- [x] 02.3.2-01-PLAN.md — Branch setup + gallery escape hatch (ReportCTA.tsx) + CategoryGrid 2-col revert + privacy row + live count verification (page.tsx)
- [x] 02.3.2-02-PLAN.md — ReportsMap.tsx prop extensions (categoryFilter, onReportsLoaded) + map/page.tsx chip strip + filter wiring + per-category counts
- [x] 02.3.2-03-PLAN.md — Build/lint verification + visual checkpoint + PR readiness confirmation

### Phase 02.4: Self-Hosted Infrastructure — Arch Linux + Cloudflare Tunnel (INSERTED)

**Goal:** Decommission Railway (subscription expired), host the Rust/Axum backend + PostGIS database on the Arch Linux desktop using Docker Compose, expose it publicly via a Cloudflare tunnel (cloudflared), update GitHub Actions deploy workflow to use a self-hosted runner on the desktop, and update the Vercel frontend to point to the new Cloudflare tunnel URL.
**Depends on:** Phase 02.3.2
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):

  1. The Rust/Axum backend and PostGIS database run via docker compose on the Arch Linux desktop using docker-compose.yml + docker-compose.server.yml override (which removes the frontend container dependency from nginx)
  2. A Cloudflare tunnel (cloudflared systemd service) routes public HTTPS traffic to desktop nginx:80, and `curl https://<tunnel-url>/health` returns `{"status":"ok"}` from the internet
  3. A GitHub Actions self-hosted runner on the desktop executes the deploy job on every push to main — building and restarting services via docker compose — with zero manual SSH steps
  4. The Vercel-hosted Next.js frontend successfully calls the backend through the Cloudflare tunnel URL (NEXT_PUBLIC_API_URL updated, Vercel redeploy triggered)
  5. The full admin login + report submission flow works end-to-end across the Vercel frontend ↔ Cloudflare tunnel ↔ desktop backend boundary (cookies, CORS, HTTPS all verified)

**Plans**: 4 plans

Plans:

- [x] 02.4-01-PLAN.md — nginx.server.conf + docker-compose.server.yml (backend-only compose override, stripped nginx config with no frontend upstream)
- [x] 02.4-02-PLAN.md — Rewrite deploy.yml (remove Railway, add self-hosted runner deploy job + smoke test against Cloudflare tunnel URL)
- [x] 02.4-03-PLAN.md — Desktop setup runbook (cloudflared install, tunnel creation, systemd service, self-hosted runner, first manual deploy)
- [x] 02.4-04-PLAN.md — Vercel + GitHub Secrets/Vars update checklist (NEXT_PUBLIC_API_URL, INTERNAL_API_URL, remove RAILWAY_BACKEND_URL, add BACKEND_URL/FRONTEND_URL/CORS_ORIGIN vars)

### Phase 02.4.1: Security Hardening (INSERTED)

**Goal:** Close the remaining application-level and operational security gaps before Phase 3 GBA launch: JPEG magic-bytes upload validation (stored XSS via SVG), admin logout cookie SameSite fix (cross-domain logout actually clears), nginx Content-Type override on /uploads/, weekly backups of PostgreSQL + uploads volume via systemd timer with 10 KB size validation and 30-day retention, secret rotation + restore documentation in DEPLOYMENT.md, and a free-tier external uptime monitor on /health.
**Depends on:** Phase 02.4
**Requirements**: D-01..D-18 (CONTEXT.md decisions; no global REQUIREMENTS.md IDs — pre-launch security hardening pass)
**Success Criteria** (what must be TRUE):

  1. POST /api/reports with a non-JPEG body returns HTTP 400 "Only JPEG images are accepted"; valid JPEG (FF D8) accepted
  2. admin_logout builds a removal cookie with SameSite=None + conditional Secure mirroring admin_login; browser actually clears admin_token cross-domain
  3. Both nginx configs append `add_header Content-Type "image/jpeg" always;` to the /uploads/ location block; curl -I on the deployed tunnel shows a single Content-Type: image/jpeg header
  4. backup/backup.sh + three systemd units exist; weekly walkability-backup.timer is enabled on the desktop; a smoke run produces a > 10 KB .sql.gz under /data/backups/db and a .tar.gz under /data/backups/uploads
  5. DEPLOYMENT.md gains §10 Secret Rotation (JWT_SECRET, POSTGRES_PASSWORD, ADMIN_SEED_PASSWORD) and §11 Backup and Restore (pg_dump restore + uploads volume restore)
  6. An external uptime monitor (UptimeRobot or Cloudflare Health Checks) polls `<tunnel-url>/health` on a 5-minute cadence with email alerts to amit@orbitak.com
  7. Tech debt cleanup: zero `TODO: implement` doc-comment lines in handlers/admin.rs or models/admin.rs; Bengaluru bounding-box constants exist exactly once at module level in handlers/reports.rs; stale Railway comment replaced with Cloudflare tunnel reference

**Plans**: 3 plans

Plans:

- [x] 02.4.1-01-PLAN.md — Backend security + cleanup: JPEG magic-bytes guard + bbox dedup (handlers/reports.rs), logout cookie SameSite fix + TODO removal + Railway-reference fix (handlers/admin.rs, models/admin.rs)
- [x] 02.4.1-02-PLAN.md — nginx Content-Type override on /uploads/ in both nginx.conf and nginx.server.conf + deployed-tunnel curl -I verification checkpoint
- [x] 02.4.1-03-PLAN.md — Operational ops + docs: backup/backup.sh + 3 systemd units, DEPLOYMENT.md §10 Secret Rotation + §11 Backup and Restore, external uptime monitor checkpoint on /health

### Phase 02.5: Admin Portal UI Redesign (INSERTED)

**Goal:** Implement the hybrid "Walkability Console × Daari Ops" design system for all admin portal screens at /admin — CSS variable token layer, JetBrains Mono chrome, Direction-B teal palette, Direction-A card structure (photo tile + status badge + meta line), light + dark mode, and a full accessibility pass — as a pixel-faithful translation of the design prototype in design-ref/admin-portal/.
**Depends on:** Phase 02.4.1
**Requirements**: ADMIN-UI-01..ADMIN-UI-08 (phase-local; design contract in 02.5-UI-SPEC.md)
**Success Criteria** (what must be TRUE):

  1. All admin screens (Login, Dashboard, Reports list, Report detail, Map, Users, Organizations, Profile, Empty/Error states) render with the hybrid design system tokens — Direction B palette + Direction A card structure
  2. A `admin.css` CSS variable file exists at `frontend/app/admin/admin.css` and is the single source of truth for all admin-portal colors, fonts, radii, and shadows — no hardcoded hex/oklch values in component files
  3. Light mode and dark mode both work, toggled by a `.dark` class on the `<html>` element, with no flash-of-wrong-theme on reload
  4. Severity is never color-only: every severity indicator shows bars (1/2/3 lit) + text label + color; passes WCAG 1.4.1
  5. All interactive elements have ≥ 44px tap target on mobile
  6. The offline/error state shows a pending-changes card with queued action descriptions and a reassurance copy string that does not use technical jargon
  7. Report cards on the reports list show: photo thumbnail, category label (human-readable, not API enum), status badge, ward · time meta line, duplicate badge when present
  8. `npm run build` passes with zero TypeScript errors and zero new ESLint warnings

**Plans**: 4 plans

Plans:

- [x] 02.5-01-PLAN.md — Token layer + font setup + primitives (tokens.css → CSS vars, next/font for Inter + JetBrains Mono + Noto Sans Kannada, shared admin components)
- [x] 02.5-02-PLAN.md — Login + Dashboard screens (mobile + desktop, light + dark)
- [x] 02.5-03-PLAN.md — Reports list (card stream + compact rows) + Report detail screen
- [x] 02.5-04-PLAN.md — Map view + Users management + Organizations + Profile + Empty/Error states

### Phase 02.3.1: Implement Walkable BLR UI redesign from design file on separate branch (INSERTED)

**Goal:** On a dedicated `ui-redesign` branch, implement a pixel-faithful Next.js redesign of the 5 citizen-facing screens (Home, Category step, Confirm step, Success, Public Map) per the Walkable BLR design file — introducing a CSS-variable design system, Google Fonts via next/font, and 5 TSX primitives (Bi, Icon, Btn, Pill, SectionLabel) — without merging to main.
**Requirements**: UI-FOUNDATION, UI-HOME, UI-MAP, UI-REPORT-FLOW (phase-local; no global REQUIREMENTS.md IDs)
**Depends on:** Phase 02.3
**Plans:** 3 plans

Plans:

- [x] 02.3.1-01-PLAN.md — Branch setup + design-ref preservation + CSS variables + next/font + 5 UI primitives (Bi, Icon, Btn, Pill, SectionLabel) with tests
- [x] 02.3.1-02-PLAN.md — Home page (`/`) redesign + Map page (`/map`) overlay redesign + updated home-page tests
- [x] 02.3.1-03-PLAN.md — Report flow 2-step rewrite (Category → Confirm → Success) + CategoryGrid / SeverityGrid / SuccessCard components + updated report-page tests
- [x] 02.3.1-04-PLAN.md — UAT gap closure: contact accordion, photo-store singleton, ReportCTA label-wrap, browser geolocation fallback, ward lookup display

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

- [x] 02.1-01-PLAN.md — Backend hardening: strip submitter_name from public API, remove duplicate require_role, fix serde_json unwraps
- [x] 02.1-02-PLAN.md — Config/frontend/CI hardening: COOKIE_SECURE default, TLS docs, CSP, login error, password threshold, dependency audits

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
**Wave 1**

- [x] 03-01-PLAN.md — DB migrations 008 (ENUM rename + reports columns, no-transaction) + 009 (wards hierarchy columns + 369-row backfill), Report/ReportResponse struct extension, validate_status + get_report_stats updates, Wave 0 test scaffolds

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 03-02-PLAN.md — Backend: resolve_report + assign_report_org DB fns, admin_resolve_report (multipart) + admin_assign_report_org (JSON) handlers, public GET /api/reports/:id extension (history + ward_hierarchy)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-03-PLAN.md — Admin frontend (Direction B): StatusBadge 6-value extension, StatusActionPanel + OrgAssignPanel + GbaHierarchyPanel + ResolveModal components, /admin/reports/[id] panel wiring, CORP column on reports list, adminApi extension
- [ ] 03-04-PLAN.md — Public frontend (Direction A): ReportsMap STATUS_COLORS pin coloring, extended popup (corporation + ward + status + Read More), status-based map legend, NEW public /reports/[id] server component page

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

Plans: *(not yet created — Phase 4 has no plan files on disk; planning begins after Phase 3 ships)*

- [ ] 04-01-PLAN.md — Streaming CSV and GeoJSON export endpoints (backend streaming handlers, admin export UI)
- [ ] 04-02-PLAN.md — Public GeoJSON endpoint and public stats page (unauthenticated endpoint, materialized view, stats page)
- [ ] 04-03-PLAN.md — Admin analytics dashboard (top wards, resolution rate, trend chart, recharts integration)
- [ ] 04-04-PLAN.md — Public map heatmap layer (leaflet.heat integration, toggle control)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 2.1 → 2.2 → 2.3 → 2.3.1 → 2.3.2 → 2.4 → 2.4.1 → 2.5 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ward Foundation | 6/6 | Complete | 2026-03-12 |
| 2. Anti-Abuse and Data Quality | 3/3 | Complete   | 2026-05-20 |
| 2.1 OWASP Hardening | 2/2 | Complete | 2026-04-20 |
| 2.2 Staging Deployment | 3/3 | Complete | 2026-04-22 |
| 2.3 UAT Bug Fixes | 3/3 | Complete | 2026-04-24 |
| 2.3.1 UI Redesign | 4/4 | Complete | 2026-04-25 |
| 2.3.2 Frontend Gap-fill | 3/3 | Complete | 2026-04-25 |
| 2.4 Self-Hosted Infrastructure | 4/4 | Complete | 2026-05-20 |
| 2.4.1 Security Hardening | 3/3 | Complete   | 2026-05-20 |
| 2.5 Admin Portal UI Redesign | 4/4 | Complete   | 2026-05-22 |
| 3. Government Triage Workflow | 1/4 | In Progress|  |
| 4. Export and Public Analytics | 0/4 | Future — not yet scaffolded | - |
