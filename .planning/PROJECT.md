# Bengaluru Walkability Public Audit

## Current Milestone: v1.1 Stabilise, Launch, and Triage

**Goal:** Fix all live UAT issues found in the v1.0 field test, ship nammadaari.com with a coming soon page, wire the main/staging/feature branching workflow for CI/CD, and improve admin triage UX + public map for daily use.

**Target features:**
- UAT stabilisation: 11 confirmed bugs fixed (1 critical, 1 high, 7 medium, 3 low)
- Production launch: coming soon page on nammadaari.com + Git branching model wired for main/staging/feature branches
- Admin triage UX: ward/corporation filter in queue, before/after resolution photo on public detail page
- Public map: category + status filters, ward boundary polygon overlay

---

## What This Is

A civic-tech platform where citizens photograph and geolocate subpar pedestrian infrastructure in Bengaluru. Reports are automatically ward-tagged, visible on a public map, and feed into a full government triage workflow (GBA / BBMP corporations) for resolution. Admins get a redesigned analytics dashboard with ward choropleth, corporation resolution rates, and streaming export. Long-term, the accumulated data will power a Priority Walking Network (PWN) algorithm to guide infrastructure investment toward maximum public transit ridership impact.

## Core Value

Citizens can report a broken footpath in 60 seconds and the government can act on it — every report is a data point that builds the case for systemic walkability investment.

## Requirements

### Validated

**Phase 1 — Ward Foundation (2026-03-12):**
- ✓ Citizen can submit a photo report with GPS coordinates (EXIF auto-extracted or manual pin) — Phase 1
- ✓ Report categories and severity levels captured at submission — Phase 1
- ✓ EXIF GPS extracted client-side (privacy-respecting; raw GPS never sent to server) — Phase 1
- ✓ EXIF metadata stripped server-side before image stored — Phase 1
- ✓ Location privacy: lat/lng rounded to 3 decimal places (~111m) in public API — Phase 1
- ✓ Bengaluru bounding-box validated server-side (no out-of-city submissions) — Phase 1
- ✓ PostGIS spatial storage (GEOGRAPHY type, ST_SetSRID trigger) — Phase 1
- ✓ Admin dashboard with JWT auth for report management — Phase 1
- ✓ Public map showing submitted reports — Phase 1
- ✓ Ward boundary data for Bengaluru imported into PostGIS (369 wards) — Phase 1
- ✓ Reports automatically assigned to correct ward via ST_Within query — Phase 1 (WARD-01)
- ✓ Organizations table with self-referential hierarchy (GBA → corporation → ward office) — Phase 1 (WARD-02)
- ✓ Admin org assignment controls report visibility via recursive CTE — Phase 1 + Phase 04.1 (WARD-03)

**Phase 2 — Anti-Abuse & Data Quality (2026-03-13 / gap closure 2026-05-20):**
- ✓ Super-admin protection (deactivation guard, is_super_admin flag) — Phase 2
- ✓ Admin audit trail (status_history table) — Phase 2
- ✓ Nginx reverse proxy with rate limiting and CSP hardening — Phase 2
- ✓ CI/CD pipeline (GitHub Actions: frontend + backend + Docker build) — Phase 2
- ✓ Structured logging with request ID propagation (tracing + json) — Phase 2
- ✓ Per-IP geohash-6 rate limiting (governor crate, 2 reports/IP/cell/hour) — Phase 2 (ABUSE-01)
- ✓ CSS-offset honeypot with fake-200, no error signal — Phase 2 (ABUSE-02)
- ✓ Proximity duplicate detection (ST_DWithin 50m, async 5-min poll) — Phase 2 (ABUSE-03/04)
- ✓ SHA256 photo dedup (before EXIF strip; silent reject) — Phase 2 (ABUSE-05)
- ✓ duplicate_count visible in admin triage queue — Phase 2 (ABUSE-06)

**Phase 02.1 — OWASP Hardening (2026-04-20):**
- ✓ submitter_name absent from public API at struct level (compile-time) — Phase 02.1 (SEC-01)
- ✓ Single canonical require_role with admin-is-superset semantics — Phase 02.1 (SEC-02)
- ✓ No .unwrap() on serde_json serialization in production handlers — Phase 02.1 (SEC-03)
- ✓ COOKIE_SECURE defaults to true in production; explicit false override for dev — Phase 02.1 (SEC-04)
- ✓ CSP style-src without unsafe-inline; TLS termination documented in nginx — Phase 02.1 (SEC-05)
- ✓ Login page never surfaces raw server error messages (A07 hardening) — Phase 02.1 (SEC-06)
- ✓ Password validation threshold aligned frontend/backend (12 chars); CI runs cargo audit + npm audit — Phase 02.1 (SEC-07)

**Phase 02.2 — Staging Deployment (2026-04-22):**
- ✓ Cross-domain admin auth (SameSite=None cookie + Next.js rewrite proxy for /api/admin/*) — Phase 02.2 (STAGING-01)
- ✓ Public report submission works on staging — Phase 02.2 (STAGING-02)
- ✓ CI-gated staging smoke tests (deploy.yml: /health retry loop, /api/reports check, Vercel HTTP 200) — Phase 02.2 (STAGING-03)
- ✓ STAGING-SETUP.md operational runbook — Phase 02.2 (STAGING-04)
- ✓ cargo test + npm run build pass with cross-domain auth changes — Phase 02.2 (STAGING-05)

**Phase 02.3 — UAT Bug Fixes (2026-04-24):**
- ✓ Admin category labels show human-readable text (getCategoryLabel from translations.ts) — Phase 02.3 (BUG-01)
- ✓ iOS camera UX: separate "Take Photo" (camera) and "Upload from Gallery" (library) buttons — Phase 02.3 (BUG-02)
- ✓ Admin reports table mobile scroll gradient — Phase 02.3 (UX-01)
- ✓ Admin sidebar extracted to AdminSidebar.tsx with mobile hamburger drawer — Phase 02.3 (UX-02)
- ✓ Consistent category labels across admin table, map legend, and map popup — Phase 02.3 (UX-03)

**Phase 02.3.1 — Walkable BLR UI Redesign (2026-04-25):**
- ✓ CSS variable design system (--color-*, --font-*, --radius-* tokens) — Phase 02.3.1
- ✓ UI primitives: Bi, Icon, Btn, Pill, SectionLabel components — Phase 02.3.1
- ✓ Redesigned Home page (/) and Map page (/map) overlay — Phase 02.3.1
- ✓ Redesigned 2-step report flow (Category → Confirm → Success) with CategoryGrid, SeverityGrid, SuccessCard — Phase 02.3.1
- ✓ Contact accordion, photo-store singleton, browser geolocation fallback, ward lookup display — Phase 02.3.1

**Phase 02.3.2 — Frontend Gap-fill (2026-04-25):**
- ✓ Gallery escape hatch on home page (ReportCTA.tsx) — Phase 02.3.2
- ✓ CategoryGrid 2-col × 3-row with privacy notice — Phase 02.3.2
- ✓ Map filter chip strip with 7 chips + per-category counts — Phase 02.3.2

**Phase 02.4 — Self-Hosted Infrastructure (2026-05-20):**
- ✓ Rust/Axum backend + PostGIS on Arch Linux desktop via Docker Compose + docker-compose.server.yml — Phase 02.4 (INFRA-01)
- ✓ Cloudflare tunnel (cloudflared systemd service) routes public HTTPS to nginx:80 — Phase 02.4 (INFRA-02)
- ✓ GitHub Actions self-hosted runner deploys on every push to main — Phase 02.4 (INFRA-03)
- ✓ Vercel frontend calls backend through Cloudflare tunnel URL — Phase 02.4 (INFRA-04)
- ✓ End-to-end admin login + report submission via Vercel ↔ Cloudflare ↔ desktop backend — Phase 02.4 (INFRA-05)

**Phase 02.4.1 — Security Hardening (2026-05-20):**
- ✓ JPEG magic-bytes guard (POST /api/reports with non-JPEG returns HTTP 400) — Phase 02.4.1
- ✓ Admin logout cookie SameSite=None + conditional Secure fix — Phase 02.4.1
- ✓ nginx Content-Type override on /uploads/ in both nginx configs — Phase 02.4.1
- ✓ Weekly pg_dump + uploads backup with systemd timer, 10KB size validation, 30-day retention — Phase 02.4.1
- ✓ DEPLOYMENT.md §10 Secret Rotation + §11 Backup and Restore — Phase 02.4.1
- ✓ External uptime monitor (UptimeRobot) polling /health on 5-min cadence — Phase 02.4.1

**Phase 02.5 — Admin Portal UI Redesign (2026-05-22):**
- ✓ admin.css CSS variable layer — single source of truth for all admin-portal colors/fonts/radii/shadows — Phase 02.5
- ✓ Hybrid design system: Direction-B teal palette, JetBrains Mono chrome, Direction-A card structure — Phase 02.5
- ✓ Light + dark mode (toggled by .dark class on <html>, no flash-of-wrong-theme) — Phase 02.5
- ✓ All admin screens (Login, Dashboard, Reports, Report detail, Map, Users, Orgs, Profile, Empty/Error) — Phase 02.5
- ✓ WCAG 1.4.1: severity never color-only (bars + text + color) — Phase 02.5
- ✓ ≥44px tap targets on mobile — Phase 02.5

**Phase 02.6 — Build Metadata (2026-05-25):**
- ✓ NEXT_PUBLIC_APP_VERSION injected from package.json at build time (next.config.mjs) — Phase 02.6
- ✓ Citizen footer and admin console brand string both show APP_VERSION — Phase 02.6
- ✓ Sticky-footer layout + admin logout hard-navigation (window.location.replace) — Phase 02.6

**Phase 3 — Government Triage Workflow (2026-05-31):**
- ✓ 6-state status lifecycle: Open → Acknowledged → Assigned → In Progress → Resolved → Closed — Phase 3 (WFLOW-01)
- ✓ status_history records every transition with timestamp and acting admin user ID — Phase 3 (WFLOW-02)
- ✓ Admin can assign a report to any organization in the hierarchy — Phase 3 (WFLOW-03)
- ✓ Admin can add resolution notes when closing a report — Phase 3 (WFLOW-04)
- ✓ Admin can upload a resolution photo when marking a report as Resolved — Phase 3 (WFLOW-05)
- ✓ Public map pins color-coded by status — Phase 3 (MAP-01)
- ✓ Report status visible in map popup — Phase 3 (MAP-03)

**Phase 3.1 — Split Layout (2026-05-26):**
- ✓ /admin/reports/[id] two-column split layout: left (photo + metadata, sticky) + right (action panels, independently scrollable) — Phase 3.1
- ✓ GbaHierarchyPanel display bugs ISSUE-01/03/04/05 resolved — Phase 3.1
- ✓ Status timeline dot color map ISSUE-06 resolved — Phase 3.1

**Phases 3.2, 3.3, 3.4 — Admin UAT Gap Fixes (2026-05-30 – 2026-06-01):**
- ✓ 7D/14D/30D intake chart period filter wired (dashboard updates chart on period selection) — Phase 3.2
- ✓ Real status history timestamps and admin attribution (COALESCE display_name, email) — Phase 3.2 + 3.3
- ✓ Real per-day intake endpoint (GET /api/admin/stats/intake?days=N, clamp [1,90]) replacing STUB_SPARKBARS — Phase 3.3
- ✓ Auto-assign corporation org from ward geography at report creation time — Phase 3.4
- ✓ CORP column in admin reports list shows organisation name (not raw ward geography) — Phase 3.4
- ✓ Mobile compact-row cards fully tappable (sr-only anchor + window.location.assign + stopPropagation on action buttons) — Phase 3.4

**Phase 4 — Export + Public Analytics (2026-05-31):**
- ✓ Streaming CSV export with DD/MM/YYYY dates, ward name column, category labels — Phase 4 (EXPORT-01)
- ✓ Streaming GeoJSON export (admin-filtered, no memory buffering) — Phase 4 (EXPORT-02)
- ✓ Public unauthenticated GeoJSON endpoint (3dp coords, no PII, rate-limited 2 req/min) — Phase 4 (EXPORT-03)
- ✓ Public stats page (total reports, resolved count, top 3 categories) via materialized view — Phase 4 (ANALYTICS-01)
- ✓ Admin analytics: top 10 wards by unresolved count — Phase 4 (ANALYTICS-02)
- ✓ Admin analytics: corporation resolution rate (resolved/total) per BBMP corporation — Phase 4 + 04.1 (ANALYTICS-03)
- ✓ Admin analytics: 12-week trend chart (reports/week, filterable by category) with recharts — Phase 4 (ANALYTICS-04)
- ✓ Admin analytics: ward choropleth (fill by unresolved density, click-to-drilldown) — Phase 4 (ANALYTICS-05)
- ✓ Toggleable issue-density heatmap on public /map (leaflet.heat, open reports only) — Phase 4 (MAP-02)

**Phase 04.1 — Ward-Org Link Gap Closure (2026-06-01):**
- ✓ Migration 014 links all 369 wards to parent corporation via ILIKE (idempotent) — Phase 04.1 (NF-04.1-A)
- ✓ SQL-string unit tests guard ILIKE pattern drift + ::float8 cast in CORP_ANALYTICS_SQL — Phase 04.1 (NF-04.1-B)
- ✓ AdminReport TypeScript interface: corporation: string | null field, no as-unknown-as cast — Phase 04.1 (NF-04.1-C)

### Active

#### v1.1 — UAT Stabilisation
- [ ] Photos broken on public report detail page (PUBLIC_URL / image_url fallback) — UAT-01-06
- [ ] "Report another" + map FAB route to deprecated /report instead of / — UAT-01-05
- [ ] Leaflet map tiles blank in iOS Safari on citizen Step 2 + admin detail map — UAT-01-03/09
- [ ] Report photo rotated 90° in admin — EXIF orientation stripped before baking rotation — UAT-01-07
- [ ] Duplicate "Open" entries in public STATUS HISTORY when admin acknowledges — UAT-01-10
- [ ] Admin "+N today" counter decrements on status changes — UAT-01-11
- [ ] Admin dashboard rubber-bands back to top on scroll release (iOS Safari) — UAT-01-12
- [ ] GPS coordinates shown at 4dp (~11m) in citizen submission form; should be 3dp — UAT-01-02
- [ ] BUILD_HASH: 0000000 in admin footer — build-time env var not injected — UAT-01-01
- [ ] Ward attribution label inconsistency: "Auto-detected" vs "Auto-routed" — UAT-01-04
- [ ] LOCATION_SRC: MANUAL_PIN label misleading (GPS_API / MANUAL_ADJUST) — UAT-01-08

#### v1.1 — Production Launch + Git Branching Workflow ✓ Complete — Phase 06
- ✓ nammadaari.com coming soon page with @nammadaariblr Instagram CTA — Phase 06 (LAUNCH-01)
- ✓ Git branching model: main → nammadaari.com, staging → staging.nammadaari.com; feature/fix branches merge to staging; staging merges to main at milestone completions — Phase 06 (LAUNCH-04/05)
- ✓ CI/CD auto-deploy from both main and staging branches (5-job deploy.yml, live-verified) — Phase 06 (LAUNCH-02/03)
- ✓ Domain-switch infrastructure: staging stack isolated on port 3011, concurrent with production — Phase 06 (LAUNCH-03)

#### v1.1 — Admin Triage UX + Public Map
- [ ] Ward/corporation filter in admin reports queue — UAT-01 enhancement
- [ ] Category + status filter chips on public /map
- [ ] Ward boundary polygon overlay on public /map
- [ ] Before/after resolution photo comparison on public report detail page

#### Future — Notifications
- [ ] Weekly email digest to GBA admins: new report count in their ward/corporation
- [ ] Reporter email notification when report status changes

### Out of Scope

- PWN algorithm — future milestone after minimum 6–12 months of real report data
- External government system integration (BBMP/GBA APIs) — pending GBA engagement via Walkaluru / Arun Pai
- SMS/WhatsApp reporter notifications — may add post-launch based on GBA requirements
- Native mobile app — web PWA is sufficient for MVP
- Citizen accounts / login — reports stay anonymous by default
- Real-time collaborative features — not needed at this scale
- ML-based spam detection — rule-based rate limiting sufficient at MVP scale

## Context

**Current codebase state (v1.0):**
- Backend: ~10,725 lines of Rust (Axum, SQLx, PostGIS, Argon2id, tower-http)
- Frontend: ~29,415 lines of TypeScript/TSX (Next.js 14 App Router, Leaflet, recharts)
- 14 PostgreSQL migrations (through 014_link_wards_to_organisations.sql)
- 683 git commits over 89 days (2026-03-04 → 2026-06-01)
- Self-hosted: Arch Linux desktop + Cloudflare Tunnel + Vercel frontend

**Stakeholder path to launch:** Soft launch planned alongside Walkaluru (started by Arun Pai) which has GBA support. MVP shipped and ready for GBA presentation. Multi-tier government workflow is live; GBA org structure TBD pending engagement with Arun Pai.

**GBA context:** BBMP has been dissolved; the Greater Bengaluru Authority (GBA) now oversees the 5 city corporations. Government workflow is live and flexible — organizations table is data-configurable, not hardcoded.

**Data downstream use:** Reports feed three audiences — GBA planners (budget/repair prioritization via admin analytics), Walkaluru advocates (press, lobbying via public stats/GeoJSON export), and the future PWN algorithm (routing optimization using complaints + BMTC bus stops + Namma Metro stops).

**Known tech debt (v1.0):**
- Dedup job excludes `resolved` but not `closed` from matching pool (dedup_job.rs:19)
- Dashboard activity feed hardcoded — no activity log API (intentional per D-13)
- 6 phases at `human_needed` verification status — code verified, live browser confirmation pending
- AdminReport.image_url type mismatch vs backend image_path; fallback in reports/[id]/page.tsx:75 prevents crash

## Constraints

- **Tech stack**: Rust/Axum + Next.js 14 + PostGIS + Docker Compose — locked, no changes
- **Privacy**: Reports anonymous by default; location data rounded before public exposure; EXIF stripped
- **Security**: Public-facing app with anonymous submissions — must withstand spam and scraping
- **Stakeholder alignment**: Government workflow must remain flexible until GBA engagement completes
- **Infrastructure**: Single self-hosted Arch Linux desktop + Cloudflare Tunnel + Vercel

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Anonymous-by-default reporting | Lowers barrier to submission; protects reporters; Bengaluru civic context | ✓ Good — no abuse spike at MVP scale |
| Rust/Axum backend | Type-safe, low memory, self-hostable — good fit for resource-constrained civic deployment | ✓ Good |
| PostGIS for spatial storage | Enables ward-level queries, proximity dedup, future PWN algorithm input | ✓ Good |
| Multi-tier gov routing (flexible org table) | GBA structure not yet confirmed — build adaptable workflow, not hardcoded org chart | ✓ Good — wards linked to corps geographically via Phase 04.1 |
| Self-hosted on Arch Linux + Cloudflare Tunnel | Railway subscription expired; Cloudflare free tier + home desktop avoids recurring infra cost | ✓ Good |
| Soft launch with Walkaluru/GBA | External credibility and immediate real-world data vs. solo launch | — Pending (soft launch ready as of v1.0) |
| PWN algorithm deferred | Need minimum 6–12 months of real report data to make algorithm meaningful | ✓ Good — data collection begins at soft launch |
| geohash precision=6 for rate limiting | ~1.2km × 0.6km cells — allows walking citizen to report multiple issues while throttling same-location floods | ✓ Good |
| SHA256 before EXIF strip for dedup | Re-uploads of same photo match regardless of client-side EXIF handling | ✓ Good |
| plain REFRESH MATERIALIZED VIEW (not CONCURRENTLY) | Constant-expression index incompatible with CONCURRENTLY; <50ms lock at MVP scale is acceptable | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-22 — after Phase 06 (Production Launch + Git Branching Workflow)*
