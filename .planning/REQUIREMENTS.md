# Requirements: Bengaluru Walkability Public Audit

**Defined:** 2026-03-11
**Core Value:** Citizens can report a broken footpath in 60 seconds and the government can act on it — every report is a data point that builds the case for systemic walkability investment.

---

## v1 Requirements

Requirements for MVP — scoped for soft launch with Walkaluru / GBA.

### Ward & Spatial Routing

- [x] **WARD-01**: Reports are automatically assigned to the correct Bengaluru ward via PostGIS `ST_Within` query at submission time
- [x] **WARD-02**: An `organizations` table stores the flexible GBA → corporation → ward office hierarchy as data (not hardcoded), with self-referential parent_id
- [x] **WARD-03**: Each admin user is assigned to an organization, controlling which reports they see and can act on
- [x] **WARD-04**: Ward boundary data for Bengaluru is imported into PostGIS and kept as the spatial source of truth for routing

### Security Hardening (Phase 02.1)

- [x] **SEC-01**: `submitter_name` is absent from public API responses at the struct level (compile-time guarantee via `ReportResponse`)
- [x] **SEC-02**: Single canonical `require_role` from `middleware::auth` with admin-is-superset semantics — no local duplicates in handlers
- [x] **SEC-03**: No `.unwrap()` on `serde_json::to_value` in production handler paths — all serialization errors produce `AppError::Internal`
- [x] **SEC-04**: `COOKIE_SECURE` defaults to `true` in production `docker-compose.yml`; explicit `false` override required for local dev
- [x] **SEC-05**: nginx CSP `style-src` has no `unsafe-inline`; TLS termination expectations documented in nginx config comments
- [x] **SEC-06**: Admin login page never surfaces raw server error messages (A07 hardening); generic messages for 401/429/5xx
- [x] **SEC-07**: Password validation threshold aligned frontend/backend at 12 characters; CI runs `cargo audit` and `npm audit --audit-level=high` on every PR

### Staging Deployment (Phase 02.2)

- [x] **STAGING-01**: Admin login works on staging (staging-walkability.kinariwala.com) with cross-domain SameSite=None cookie on Vercel domain
- [x] **STAGING-02**: Public report submission works on staging via Vercel frontend → Railway backend
- [x] **STAGING-03**: `deploy.yml` CI workflow triggers smoke tests after push-to-main verifying Railway backend health and Vercel frontend reachability
- [x] **STAGING-04**: Complete `STAGING-SETUP.md` with step-by-step provisioning for Railway, Vercel, DNS, and GitHub Actions secrets
- [x] **STAGING-05**: All `cargo test` and `npm run build` pass with cross-domain auth changes in place

### Self-Hosted Infrastructure (Phase 02.4)

- [ ] **INFRA-01**: The Rust/Axum backend and PostGIS database run via `docker compose` on the Arch Linux desktop using `docker-compose.yml` + a new `docker-compose.server.yml` override that removes the `frontend` container dependency from `nginx`
- [ ] **INFRA-02**: A Cloudflare tunnel (`cloudflared` systemd service) routes public HTTPS traffic to the desktop `nginx:80`, and `curl https://<tunnel-url>/health` returns `{"status":"ok"}` from the internet
- [ ] **INFRA-03**: A GitHub Actions self-hosted runner on the desktop executes the deploy job on every push to `main` — building and restarting services via `docker compose` — with zero manual SSH steps
- [ ] **INFRA-04**: The Vercel-hosted Next.js frontend successfully calls the backend through the Cloudflare tunnel URL (`NEXT_PUBLIC_API_URL` updated, Vercel redeploy triggered)
- [ ] **INFRA-05**: The full admin login + report submission flow works end-to-end across the Vercel frontend ↔ Cloudflare tunnel ↔ desktop backend boundary (cookies, CORS, HTTPS all verified)

### UAT Bug Fixes (Phase 02.3)

- [x] **BUG-01**: Admin reports table Category column shows human-readable labels (e.g. "Damaged Footpath") via `getCategoryLabel()` from `translations.ts`
- [x] **BUG-02**: On iOS Safari, "Take Photo" opens camera directly and "Upload from Gallery" opens photo library — no shared action sheet
- [x] **UX-01**: Admin reports table has a right-edge fade gradient on mobile (md:hidden) indicating horizontal scroll
- [x] **UX-02**: Hamburger button visible on mobile admin pages opens a slide-in sidebar drawer with all nav links
- [x] **UX-03**: Map legend, map popup, and admin table show identical category labels sourced from `translations.ts`

### Anti-Abuse & Data Quality

- [x] **ABUSE-01**: Report submission is rate-limited at the application layer (max 2 reports per IP per geohash-6 cell per hour) using `governor` crate, supplementing existing Nginx rate limiting — allows a citizen to report multiple issues while walking around, but throttles repeated submissions at the same ~100m location
- [x] **ABUSE-02**: A honeypot hidden field silently discards submissions from bots without any error message shown to human users
- [x] **ABUSE-03**: Reports within 50m of an existing open report of the same category are flagged as `potential_duplicate` with a `duplicate_count` increment on the original
- [x] **ABUSE-04**: When multiple users submit reports from the same location (within 50m, same category), `duplicate_confidence` is set to `high` — treated as a strong severity signal, not discarded
- [x] **ABUSE-05**: Exact duplicate photos (same SHA256 hash) are silently rejected at upload
- [x] **ABUSE-06**: `duplicate_count` on a report is visible in the admin triage queue as a severity indicator

### Government Workflow

- [x] **WFLOW-01**: Reports support an extended status lifecycle: `Open → Acknowledged → Assigned → In Progress → Resolved → Closed`
- [x] **WFLOW-02**: Every status transition is recorded in `status_history` with timestamp and acting admin user ID
- [x] **WFLOW-03**: Admin can assign a report to an organization (corporation or ward office)
- [ ] **WFLOW-04**: Admin can add resolution notes when closing a report
- [ ] **WFLOW-05**: Admin can upload a resolution photo (after-photo) when marking a report as Resolved

### Public Map

- [ ] **MAP-01**: Public map pins are color-coded by report status (distinct colors for Open, In Progress, Resolved)
- [ ] **MAP-02**: A heatmap layer on the public map shows issue density by geographic area, togglable by the user
- [ ] **MAP-03**: Report status is visible in the popup when a map pin is clicked

### Data Export

- [ ] **EXPORT-01**: Admin can export filtered reports as CSV (filters: ward, category, status, date range); CSV uses DD/MM/YYYY date format and includes ward name column
- [ ] **EXPORT-02**: Admin can export filtered reports as GeoJSON FeatureCollection (streaming response, no memory buffering)
- [ ] **EXPORT-03**: A public unauthenticated GeoJSON endpoint returns all reports with coordinates rounded to 3 decimal places and no PII fields

### Public Analytics

- [ ] **ANALYTICS-01**: A public stats page shows total report count, resolved count, and top 3 issue categories — updated from a materialized view
- [ ] **ANALYTICS-02**: Admin analytics view shows top 10 wards by unresolved report count
- [ ] **ANALYTICS-03**: Admin analytics view shows resolution rate per corporation (resolved / total reports in their wards)
- [ ] **ANALYTICS-04**: Admin analytics view shows trend chart: reports submitted per week over the last 12 weeks, filterable by category
- [ ] **ANALYTICS-05**: Admin analytics map shows ward choropleth: ward fill color by unresolved report density

---

## v2 Requirements

Deferred to post-launch based on GBA engagement and real user feedback.

### Government Workflow (Extended)

- **WFLOW-V2-01**: Field team mobile view — mobile-optimized list of assigned reports with map, for use on Android phones in the field
- **WFLOW-V2-02**: Before/after photo comparison on public map — citizen-visible proof of resolution
- **WFLOW-V2-03**: Ward filter in admin triage queue — filter reports by ward or corporation

### Public Map (Extended)

- **MAP-V2-01**: Category and status filter controls on public map
- **MAP-V2-02**: Ward boundary polygon overlay on public map

### Notifications

- **NOTIF-V2-01**: Weekly email digest to GBA admins: new report count in their ward/corporation this week
- **NOTIF-V2-02**: Reporter email notification when their report status changes (optional email at submission)

### PWN Algorithm (Future Milestone)

- **PWN-V2-01**: BMTC bus stop location data imported into PostGIS
- **PWN-V2-02**: Namma Metro station location data imported into PostGIS
- **PWN-V2-03**: PWN scoring algorithm: walkability deficit × transit proximity → priority corridors
- **PWN-V2-04**: PWN output as GeoJSON polylines for government and advocacy use

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Citizen accounts / login | Kills anonymous participation; FixMyStreet data shows 70%+ submission drop |
| Aadhaar / phone verification | Privacy risk; excludes marginalized communities; political liability |
| SMS/WhatsApp notifications | TRAI DLT registration complexity; public map is the status channel |
| Native Android/iOS app | Web PWA is sufficient; 1-developer constraint makes dual codebase unviable |
| CAPTCHA | Hostile mobile UX; honeypot + rate limiting is superior |
| ML-based spam detection | No training data yet; rule-based rate limiting sufficient at MVP scale |
| Gamification (badges, leaderboard) | Trivializes serious infrastructure failure; GBA credibility risk |
| Real-time WebSocket updates | Complexity without meaningful UX benefit at this scale |
| Voting/downvoting on reports | Enables organized suppression in politically sensitive wards |
| External BBMP/GBA system integration | Pending GBA engagement — build standalone first |
| PWN algorithm | Future milestone — needs 6–12 months of real report data first |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 02.1 | Complete |
| SEC-02 | Phase 02.1 | Complete |
| SEC-03 | Phase 02.1 | Complete |
| SEC-04 | Phase 02.1 | Complete |
| SEC-05 | Phase 02.1 | Complete |
| SEC-06 | Phase 02.1 | Complete |
| SEC-07 | Phase 02.1 | Complete |
| STAGING-01 | Phase 02.2 | Complete |
| STAGING-02 | Phase 02.2 | Complete |
| STAGING-03 | Phase 02.2 | Complete |
| STAGING-04 | Phase 02.2 | Complete |
| STAGING-05 | Phase 02.2 | Complete |
| BUG-01 | Phase 02.3 | Complete |
| BUG-02 | Phase 02.3 | Complete |
| UX-01 | Phase 02.3 | Complete |
| UX-02 | Phase 02.3 | Complete |
| UX-03 | Phase 02.3 | Complete |
| WARD-01 | Phase 1 | Complete |
| WARD-02 | Phase 1 | Complete |
| WARD-03 | Phase 1 | Complete |
| WARD-04 | Phase 1 | Complete |
| ABUSE-01 | Phase 2 | Complete |
| ABUSE-02 | Phase 2 | Complete |
| ABUSE-03 | Phase 2 | Complete |
| ABUSE-04 | Phase 2 | Complete |
| ABUSE-05 | Phase 2 | Complete |
| ABUSE-06 | Phase 2 | Complete |
| INFRA-01 | Phase 02.4 | Pending |
| INFRA-02 | Phase 02.4 | Pending |
| INFRA-03 | Phase 02.4 | Pending |
| INFRA-04 | Phase 02.4 | Pending |
| INFRA-05 | Phase 02.4 | Pending |
| WFLOW-01 | Phase 3 | Complete |
| WFLOW-02 | Phase 3 | Complete |
| WFLOW-03 | Phase 3 | Complete |
| WFLOW-04 | Phase 3 | Pending |
| WFLOW-05 | Phase 3 | Pending |
| MAP-01 | Phase 3 | Pending |
| MAP-02 | Phase 4 | Pending |
| MAP-03 | Phase 3 | Pending |
| EXPORT-01 | Phase 4 | Pending |
| EXPORT-02 | Phase 4 | Pending |
| EXPORT-03 | Phase 4 | Pending |
| ANALYTICS-01 | Phase 4 | Pending |
| ANALYTICS-02 | Phase 4 | Pending |
| ANALYTICS-03 | Phase 4 | Pending |
| ANALYTICS-04 | Phase 4 | Pending |
| ANALYTICS-05 | Phase 4 | Pending |

**Coverage:**
- Total requirements: 48 (26 v1 feature + 17 hardening/staging/UAT + 5 infra from inserted phases)
- Mapped to phases: 48
- Unmapped: 0
- Complete: 27 | Pending: 21

---

*Requirements defined: 2026-03-11*
*Last updated: 2026-05-20 — Added INFRA-01..05 (Phase 02.4 self-hosted infrastructure); updated traceability and coverage counts*
