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

### Anti-Abuse & Data Quality

- [ ] **ABUSE-01**: Report submission is rate-limited at the application layer (max 5 reports/hour per IP) using `governor` crate, supplementing existing Nginx rate limiting
- [ ] **ABUSE-02**: A honeypot hidden field silently discards submissions from bots without any error message shown to human users
- [ ] **ABUSE-03**: Reports within 50m of an existing open report of the same category are flagged as `potential_duplicate` with a `duplicate_count` increment on the original
- [ ] **ABUSE-04**: When multiple users submit reports from the same location (within 50m, same category), `duplicate_confidence` is set to `high` — treated as a strong severity signal, not discarded
- [ ] **ABUSE-05**: Exact duplicate photos (same SHA256 hash) are silently rejected at upload
- [ ] **ABUSE-06**: `duplicate_count` on a report is visible in the admin triage queue as a severity indicator

### Government Workflow

- [ ] **WFLOW-01**: Reports support an extended status lifecycle: `Open → Acknowledged → Assigned → In Progress → Resolved → Closed`
- [ ] **WFLOW-02**: Every status transition is recorded in `status_history` with timestamp and acting admin user ID
- [ ] **WFLOW-03**: Admin can assign a report to an organization (corporation or ward office)
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
| WARD-01 | Phase 1 | Complete |
| WARD-02 | Phase 1 | Complete |
| WARD-03 | Phase 1 | Complete |
| WARD-04 | Phase 1 | Complete |
| ABUSE-01 | Phase 2 | Pending |
| ABUSE-02 | Phase 2 | Pending |
| ABUSE-03 | Phase 2 | Pending |
| ABUSE-04 | Phase 2 | Pending |
| ABUSE-05 | Phase 2 | Pending |
| ABUSE-06 | Phase 2 | Pending |
| WFLOW-01 | Phase 3 | Pending |
| WFLOW-02 | Phase 3 | Pending |
| WFLOW-03 | Phase 3 | Pending |
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
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---

*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 — traceability updated after roadmap creation*
