# Requirements: Bengaluru Walkability Public Audit — v1.1

**Defined:** 2026-06-05
**Milestone:** v1.1 — Stabilise, Launch, and Triage
**Core Value:** Citizens can report a broken footpath in 60 seconds and the government can act on it — every report is a data point that builds the case for systemic walkability investment.

---

## v1.1 Requirements

### FIX — UAT Stabilisation

Bug fixes confirmed in live field UAT on staging.nammadaari.com (2026-06-01, iPhone 16 Pro Max iOS 26.5).

- [ ] **FIX-01**: Public report detail page renders the submitted photo correctly for unauthenticated users
- [ ] **FIX-02**: "Report another" CTA on confirmation screen navigates to home page (`/`)
- [ ] **FIX-03**: "Report here" FAB on public `/map` navigates to home page (`/`)
- [ ] **FIX-04**: Embedded Leaflet map tiles load correctly in iOS Safari on citizen Step 2 confirm screen
- [ ] **FIX-05**: Embedded Leaflet map tiles load correctly in iOS Safari on admin report detail view
- [ ] **FIX-06**: Report photos render in correct upright orientation in admin portal (EXIF orientation baked into pixels before EXIF strip)
- [ ] **FIX-07**: Public STATUS HISTORY shows exactly one "Open" entry per report submission (not two when admin acknowledges)
- [ ] **FIX-08**: Admin dashboard "+N today" counter reflects total reports created today regardless of current status
- [ ] **FIX-09**: Admin dashboard page scrolls freely on iOS Safari without rubber-banding back to top
- [ ] **FIX-10**: GPS coordinates displayed to submitter in citizen report form are rounded to 3 decimal places (~111m precision)
- [ ] **FIX-11**: Admin footer `BUILD_HASH` shows real git commit SHA (NEXT_PUBLIC_BUILD_HASH injected at build time)
- [ ] **FIX-12**: Ward attribution label is consistently "Auto-detected" on both citizen Step 2 form and confirmation screen
- [ ] **FIX-13**: Admin report detail `LOCATION_SRC` label uses `GPS_API`, `MANUAL_ADJUST`, or `EXIF_GPS` — never `MANUAL_PIN`

### LAUNCH — Production Domain + Git Branching Workflow

- [x] **LAUNCH-01**: `nammadaari.com` displays a coming soon page with @nammadaariblr Instagram CTA, matching the citizen portal design language
- [x] **LAUNCH-02**: `main` branch auto-deploys to `nammadaari.com` via Cloudflare Tunnel + GitHub Actions CI
- [x] **LAUNCH-03**: `staging` branch auto-deploys to `staging.nammadaari.com` via GitHub Actions CI
- [x] **LAUNCH-04**: Branching workflow is documented in DEPLOYMENT.md: feature/fix branches → staging (merge when ready + tested) → main (merge at each numbered milestone completion)
- [x] **LAUNCH-05**: GSD branching config updated so `fix/*` and `feat/*` branches are the working default; direct commits to `main` or `staging` are guarded

### TRIAGE — Admin Triage UX + Public Map Enhancements

- [x] **TRIAGE-01**: Admin can filter the reports queue by ward or corporation
- [ ] **TRIAGE-02**: Public `/map` provides filter chips for report category (mirrors admin chip strip)
- [x] **TRIAGE-03**: Public `/map` provides filter chips for report status (open, in progress, resolved)
- [x] **TRIAGE-04**: Public `/map` displays a toggleable ward boundary polygon overlay
- [x] **TRIAGE-05**: Public report detail page shows the resolution photo alongside the original when a resolution photo has been uploaded by admin

---

## Future Requirements (v1.2+)

### Notifications

- **NOTIF-01**: GBA admins receive a weekly email digest with new report count for their ward/corporation
- **NOTIF-02**: Submitter receives email notification when their report status changes

### Government Workflow (Extended)

- **GWF-01**: Field team can view assigned reports with map on Android mobile (mobile-optimised admin view)

---

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| PWN algorithm | Needs 6–12 months of real report data |
| External government system integration (BBMP/GBA APIs) | Pending GBA engagement via Walkaluru / Arun Pai |
| SMS/WhatsApp reporter notifications | May add post-launch based on GBA requirements |
| Native mobile app | Web PWA sufficient |
| Citizen accounts / login | Reports stay anonymous by default |
| Real-time collaborative features | Not needed at this scale |
| ML-based spam detection | Rule-based rate limiting sufficient |
| Dedup job `closed` status fix (WARNING-01) | Low priority tech debt; dedup excludes resolved but not closed |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 5 | Pending |
| FIX-02 | Phase 5 | Pending |
| FIX-03 | Phase 5 | Pending |
| FIX-04 | Phase 5 | Pending |
| FIX-05 | Phase 5 | Pending |
| FIX-06 | Phase 5 | Pending |
| FIX-07 | Phase 5 | Pending |
| FIX-08 | Phase 5 | Pending |
| FIX-09 | Phase 5 | Pending |
| FIX-10 | Phase 5 | Pending |
| FIX-11 | Phase 5 | Pending |
| FIX-12 | Phase 5 | Pending |
| FIX-13 | Phase 5 | Pending |
| LAUNCH-01 | Phase 6 | Complete |
| LAUNCH-02 | Phase 6 | Complete |
| LAUNCH-03 | Phase 6 | Complete |
| LAUNCH-04 | Phase 6 | Complete |
| LAUNCH-05 | Phase 6 | Complete |
| TRIAGE-01 | Phase 7 | Complete |
| TRIAGE-02 | Phase 7 | Pending |
| TRIAGE-03 | Phase 7 | Complete |
| TRIAGE-04 | Phase 7 | Complete |
| TRIAGE-05 | Phase 7 | Complete |
