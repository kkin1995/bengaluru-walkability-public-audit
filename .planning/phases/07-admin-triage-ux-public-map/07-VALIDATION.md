---
phase: 7
slug: admin-triage-ux-public-map
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (Rust) + next build / next lint (Next.js) |
| **Config file** | `backend/Cargo.toml` / `frontend/package.json` |
| **Quick run command** | `cd backend && cargo test 2>&1 | tail -20` |
| **Full suite command** | `cd backend && cargo test && cd ../frontend && npm run build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && cargo test 2>&1 | tail -20`
- **After every plan wave:** Run `cd backend && cargo test && cd ../frontend && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 7-01-01 | Backend TRIAGE-01 | 1 | TRIAGE-01 | Admin-gated endpoints; super-admin sees all | integration | `cargo test` | ⬜ pending |
| 7-01-02 | Backend TRIAGE-04 | 1 | TRIAGE-04 | Public endpoint; no auth required | integration | `cargo test` | ⬜ pending |
| 7-02-01 | Frontend TRIAGE-01 | 2 | TRIAGE-01 | Corp/ward selects filter reports correctly | manual | Browser UAT | ⬜ pending |
| 7-02-02 | Frontend TRIAGE-03 | 2 | TRIAGE-03 | Status chips filter map pins client-side | manual | Browser UAT | ⬜ pending |
| 7-02-03 | Frontend TRIAGE-04 | 2 | TRIAGE-04 | Ward overlay toggles on/off; lazy fetch | manual | Browser UAT | ⬜ pending |
| 7-02-04 | Frontend TRIAGE-05 | 2 | TRIAGE-05 | Before/after layout on desktop and mobile | manual | Browser UAT | ⬜ pending |
| 7-03-01 | MOB fixes | 3 | MOB-01–07 | No content clipped by bottom nav on Safari | manual | Mobile Safari UAT | ⬜ pending |
| 7-04-01 | TEST-01 | 1 | TEST-01 | bake_orientation=6 outputs 3024×4032 | unit | `cargo test bake_orientation` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Corp/ward filter narrows admin report queue | TRIAGE-01 | UI interaction with live data | Select a corporation; confirm ward dropdown narrows; confirm report list updates |
| Status chips filter public map pins | TRIAGE-02/03 | Client-side state; no API test | Tap "Resolved" chip; confirm only resolved pins visible |
| Ward boundary overlay toggles | TRIAGE-04 | Leaflet layer render; visual | Tap toggle; confirm 369 ward polygons appear as teal stroke |
| Before/after photo layout | TRIAGE-05 | Visual layout check | Visit a resolved report with resolution_photo_url; confirm side-by-side on desktop |
| Bottom-nav clipping on mobile Safari | MOB-01–07 | iOS Safari specific | Load admin pages on iPhone Safari; scroll to bottom; confirm no nav overlap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
