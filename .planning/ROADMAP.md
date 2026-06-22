# Roadmap: Bengaluru Walkability Public Audit

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 + 10 insertions (shipped 2026-06-01) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Stabilise, Launch, and Triage** — Phases 5–7 (in progress)

---

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4 + 10 insertions) — SHIPPED 2026-06-01</summary>

- [x] Phase 1: Ward Foundation (6/6 plans) — completed 2026-03-12
- [x] Phase 2: Anti-Abuse and Data Quality (3/3 plans) — completed 2026-03-13 / gap closure 2026-05-20
- [x] Phase 02.1: OWASP Hardening (2/2 plans, INSERTED) — completed 2026-04-20
- [x] Phase 02.2: Vercel Staging Deployment (3/3 plans, INSERTED) — completed 2026-04-22
- [x] Phase 02.3: UAT Bug Fixes (3/3 plans, INSERTED) — completed 2026-04-24
- [x] Phase 02.3.1: Walkable BLR UI Redesign (4/4 plans, INSERTED) — completed 2026-04-25
- [x] Phase 02.3.2: Frontend Gap-fill (3/3 plans, INSERTED) — completed 2026-04-25
- [x] Phase 02.4: Self-Hosted Infrastructure (4/4 plans, INSERTED) — completed 2026-05-20
- [x] Phase 02.4.1: Security Hardening (3/3 plans, INSERTED) — completed 2026-05-20
- [x] Phase 02.5: Admin Portal UI Redesign (4/4 plans, INSERTED) — completed 2026-05-22
- [x] Phase 02.6: Build Metadata & Version Stamping (3/3 plans, INSERTED) — completed 2026-05-25
- [x] Phase 3: Government Triage Workflow (5/5 plans) — completed 2026-05-31
- [x] Phase 3.1: Admin Report Detail Split Layout (1/1 plan, INSERTED) — completed 2026-05-26
- [x] Phase 3.2: Dashboard Chart Period Filter + Status History Attribution (2/2 plans, INSERTED) — completed 2026-05-30
- [x] Phase 3.3: Intake Chart Real Data + Attribution Fallback (2/2 plans, INSERTED) — completed 2026-05-30
- [x] Phase 3.4: Org Auto-Assignment + Compact-Row Navigation (2/2 plans, INSERTED) — completed 2026-06-01
- [x] Phase 4: Export and Public Analytics (5/5 plans) — completed 2026-05-31
- [x] Phase 04.1: Ward-Org Link Gap Closure (4/4 plans, INSERTED) — completed 2026-06-01

Total: 18 substantive phases, 59/59 plans — **48/48 v1 requirements satisfied**

</details>

---

### 🚧 v1.1 Stabilise, Launch, and Triage (In Progress)

**Milestone Goal:** Fix all live UAT issues found in the v1.0 field test, ship nammadaari.com with a coming soon page, wire the main/staging/feature branching workflow for CI/CD, and improve admin triage UX + public map for daily use.

- [x] **Phase 5: UAT Stabilisation** — Fix 13 confirmed bugs from live iPhone field test on staging.nammadaari.com (completed 2026-06-05)
- [ ] **Phase 6: Production Launch + Git Branching Workflow** — Ship nammadaari.com coming soon page and wire CI/CD for main/staging branches
- [ ] **Phase 7: Admin Triage UX + Public Map** — Add ward/corp filter to admin queue, filter chips and ward overlay to public map, before/after resolution photo on detail page

---

## Phase Details

### Phase 5: UAT Stabilisation

**Goal**: All 13 confirmed UAT bugs from the v1.0 live iPhone field test are fixed so citizens can submit and view reports correctly and admins can triage without UI breakage
**Depends on**: Phase 04.1 (last completed v1.0 phase)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07, FIX-08, FIX-09, FIX-10, FIX-11, FIX-12, FIX-13
**Success Criteria** (what must be TRUE):

  1. A citizen visiting a public report detail page (unauthenticated) sees the submitted photo load correctly
  2. After submitting a report, tapping "Report another" and the map FAB both navigate to the home page, not the deprecated /report route
  3. The embedded Leaflet map renders with visible tiles in iOS Safari on both the citizen confirm screen and the admin report detail view
  4. Report photos appear upright (no 90-degree rotation) in the admin portal; public STATUS HISTORY shows exactly one "Open" entry per report
  5. The admin footer BUILD_HASH shows a real git SHA; the admin dashboard scrolls freely on iOS Safari; GPS coordinates in the citizen form display at 3dp; ward label and LOCATION_SRC labels use the correct canonical strings

**Plans**: 4 plansPlans:
**Wave 1**

- [x] 05-01-PLAN.md — Backend fixes: EXIF orientation bake, public status-history filter, today_count stat, location_source migration
- [x] 05-02-PLAN.md — Citizen/public frontend: photo URL, route redirects, map invalidateSize, 3dp coords, ward label, location_source emission
- [x] 05-04-PLAN.md — Infra/CI: nginx public-route CSP for OSM tiles, BUILD_HASH build-time injection (checkpoint)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-03-PLAN.md — Admin frontend: read-only map, today_count render, iOS scroll fix, BUILD_HASH wiring, LOCATION_SRC labels

**UI hint**: yes

### Phase 6: Production Launch + Git Branching Workflow

**Goal**: nammadaari.com serves a coming soon page auto-deployed from main, staging.nammadaari.com auto-deploys from the staging branch, and the feature/fix branch workflow is documented and enforced
**Depends on**: Phase 5
**Requirements**: LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05
**Success Criteria** (what must be TRUE):

  1. Visiting nammadaari.com shows a coming soon page with the @nammadaariblr Instagram CTA, matching the citizen portal design language
  2. Pushing a commit to main triggers a GitHub Actions CI run that deploys the updated app to nammadaari.com via the existing Cloudflare Tunnel
  3. Pushing a commit to the staging branch triggers a CI run that deploys to staging.nammadaari.com
  4. DEPLOYMENT.md documents the branching model (feature/fix → staging → main at milestone) so any contributor can follow it without asking

**Plans**: 4/5 plans executed

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Create staging branch, GitHub Environments, runner label, branch protection (LAUNCH-02, LAUNCH-03)

**Wave 2** *(parallel — depends on Wave 1)*

- [x] 06-02-PLAN.md — Restructure deploy.yml for dual-branch, rename docker-compose.server.yml, delete railway.toml (LAUNCH-02, LAUNCH-03)
- [x] 06-03-PLAN.md — Create staging Docker Compose stack and nginx config (port 3011, isolated volumes) (LAUNCH-03)
- [x] 06-05-PLAN.md — Coming soon page on main branch per UI-SPEC.md (LAUNCH-01) [targets main branch]

**Wave 3** *(depends on Wave 2)*

- [ ] 06-04-PLAN.md — Update DEPLOYMENT.md, add GSD branching config to config.json (LAUNCH-04, LAUNCH-05)

**UI hint**: yes

### Phase 7: Admin Triage UX + Public Map

**Goal**: Admins can filter the reports queue by ward or corporation; the public map gains category/status filter chips, a ward boundary overlay, and before/after resolution photos; all admin portal mobile Safari layout bugs are fixed; and the bake_orientation unit test covers the orientation=6 path
**Depends on**: Phase 6
**Requirements**: TRIAGE-01, TRIAGE-02, TRIAGE-03, TRIAGE-04, TRIAGE-05, MOB-01, MOB-02, MOB-03, MOB-04, MOB-05, MOB-06, MOB-07, TEST-01
**Success Criteria** (what must be TRUE):

  1. An admin can select a ward or corporation from a filter control in the reports queue and see only reports belonging to that geographic scope
  2. A citizen visiting /map can tap a category chip to show only reports of that category, and a status chip to show only open, in-progress, or resolved reports
  3. A citizen can toggle a ward boundary overlay on the public /map to see ward polygons drawn over the base map
  4. A citizen viewing a resolved report's detail page sees both the original submission photo and the admin-uploaded resolution photo side by side
  5. On mobile Safari, the Ops page and Queue page scroll to their full content without being clipped behind the bottom nav bar (MOB-01, MOB-02)
  6. The Analytics "Reports per week (12 weeks)" chart renders data lines correctly; chart legend shows human-readable category labels, not raw DB enum strings; the ward choropleth map is fully visible without horizontal scrolling; and the ward boundary GeoJSON loads without error (MOB-03, MOB-04, MOB-05, MOB-06)
  7. On mobile Safari, the /admin/map Leaflet attribution bar and legend panel are positioned above the bottom nav bar height + safe-area-inset-bottom so nav tabs remain accessible (MOB-07)
  8. A backend unit test feeds a synthetic JPEG with EXIF orientation=6 through `bake_orientation` and asserts output dimensions are 3024×4032 (TEST-01)

**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Ward Foundation | v1.0 | 6/6 | ✅ Complete | 2026-03-12 |
| 2. Anti-Abuse and Data Quality | v1.0 | 3/3 | ✅ Complete | 2026-03-13 |
| 02.1 OWASP Hardening | v1.0 | 2/2 | ✅ Complete | 2026-04-20 |
| 02.2 Staging Deployment | v1.0 | 3/3 | ✅ Complete | 2026-04-22 |
| 02.3 UAT Bug Fixes | v1.0 | 3/3 | ✅ Complete | 2026-04-24 |
| 02.3.1 Walkable BLR UI Redesign | v1.0 | 4/4 | ✅ Complete | 2026-04-25 |
| 02.3.2 Frontend Gap-fill | v1.0 | 3/3 | ✅ Complete | 2026-04-25 |
| 02.4 Self-Hosted Infrastructure | v1.0 | 4/4 | ✅ Complete | 2026-05-20 |
| 02.4.1 Security Hardening | v1.0 | 3/3 | ✅ Complete | 2026-05-20 |
| 02.5 Admin Portal UI Redesign | v1.0 | 4/4 | ✅ Complete | 2026-05-22 |
| 02.6 Build Metadata & Version Stamping | v1.0 | 3/3 | ✅ Complete | 2026-05-25 |
| 3. Government Triage Workflow | v1.0 | 5/5 | ✅ Complete | 2026-05-31 |
| 3.1 Admin Report Detail Split Layout | v1.0 | 1/1 | ✅ Complete | 2026-05-26 |
| 3.2 Chart Period Filter + Attribution | v1.0 | 2/2 | ✅ Complete | 2026-05-30 |
| 3.3 Intake Chart + Attribution Fallback | v1.0 | 2/2 | ✅ Complete | 2026-05-30 |
| 3.4 Org Auto-assign + Compact Nav | v1.0 | 2/2 | ✅ Complete | 2026-06-01 |
| 4. Export and Public Analytics | v1.0 | 5/5 | ✅ Complete | 2026-05-31 |
| 04.1 Ward-Org Link Gap Closure | v1.0 | 4/4 | ✅ Complete | 2026-06-01 |
| 5. UAT Stabilisation | v1.1 | 4/4 | Complete   | 2026-06-05 |
| 6. Production Launch + Git Branching | v1.1 | 4/5 | In Progress|  |
| 7. Admin Triage UX + Public Map | v1.1 | 0/TBD | Not started | — |

---

*v1.0 shipped: 2026-06-01 — archive: .planning/milestones/v1.0-ROADMAP.md*  
*v1.1 roadmap created: 2026-06-05*

---

## Backlog (v1.1)

*(empty — all items promoted to Phase 7)*
