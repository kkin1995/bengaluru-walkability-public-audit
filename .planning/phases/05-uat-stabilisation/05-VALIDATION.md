---
phase: 5
slug: uat-stabilisation
status: draft
nyquist_compliant: false
nyquist_override: true
wave_0_complete: false
created: 2026-06-05
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (Rust backend) + next lint / tsc (frontend) |
| **Config file** | `backend/Cargo.toml` / `frontend/tsconfig.json` |
| **Quick run command** | `cd backend && cargo check && cd ../frontend && npm run lint` |
| **Full suite command** | `cd backend && cargo test && cd ../frontend && npm run build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && cargo check && cd ../frontend && npm run lint`
- **After every plan wave:** Run `cd backend && cargo test && cd ../frontend && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | FIX-01 | — | Public /uploads/ not auth-gated | manual | nginx config audit | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | FIX-01 | — | Photo URL resolves in browser | manual | Load public report page, check img src | ✅ | ⬜ pending |
| 05-02-01 | 02 | 1 | FIX-02, FIX-03 | — | /report and /reports 301 redirect to / | manual | curl -I /report, curl -I /reports | ✅ | ⬜ pending |
| 05-03-01 | 03 | 1 | FIX-04, FIX-05 | — | Leaflet tiles visible on iOS Safari | manual | Test on iOS Safari / staging | ✅ | ⬜ pending |
| 05-04-01 | 04 | 2 | FIX-06 | — | Uploaded photo stored upright | manual | Upload portrait photo, view in admin | ✅ | ⬜ pending |
| 05-05-01 | 05 | 2 | FIX-07 | — | Public status history shows one Open entry | manual | Submit report, check public detail page | ✅ | ⬜ pending |
| 05-05-02 | 05 | 2 | FIX-08 | — | +N today counter counts by created_at not status | manual | Change report status, verify counter unchanged | ✅ | ⬜ pending |
| 05-06-01 | 06 | 3 | FIX-09 | — | Admin dashboard scrolls freely on iOS Safari | manual | Test scroll on iOS Safari staging | ✅ | ⬜ pending |
| 05-06-02 | 06 | 3 | FIX-10 | — | GPS coordinates show at 3dp | manual | Submit report, check Step 2 display | ✅ | ⬜ pending |
| 05-06-03 | 06 | 3 | FIX-11 | — | BUILD_HASH shows real git SHA | manual | Deploy, check admin footer | ✅ | ⬜ pending |
| 05-07-01 | 07 | 3 | FIX-12, FIX-13 | — | Ward label: "Auto-detected"; location_source: canonical values | manual | Submit report, check labels in UI and DB | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `cargo check` passes (Rust changes compile cleanly)
- [ ] `cargo sqlx prepare` updated after migration 015_rename_location_source.sql
- [ ] `npm run lint` passes (frontend TS/lint changes)
- [ ] `npm run build` passes after redirects and CSP changes

*Note: This phase is primarily integration fixes. Most verification is manual on iOS Safari at staging.nammadaari.com.*

---

## Nyquist Override (explicit)

**`nyquist_override: true` — declared on this phase and on plan 05-01.**

Rationale: This is an integration-fix phase. Primary verification is manual iOS Safari testing on staging.nammadaari.com. The automated `<verify>` commands confirm Rust compilation (`cargo build`), DB migration validity, and offline SQLx metadata (`cargo sqlx prepare`) — they do not assert unit-test coverage of every behavior.

Wave 0 test scaffolds that the Nyquist check flagged as gaps are intentionally NOT created:
- `bake_orientation` (05-01 T1): a unit test for orientation 1 (passthrough) and orientation 6 (width/height swap) is authored inline within Task 1; no separate Wave 0 scaffold is required.
- public history filter (05-01 T2 / FIX-07): the change is SQL-layer only; verified by `cargo build` + `cargo sqlx prepare` + manual public-detail-page check on staging.
- `today_count` (05-01 T2 / FIX-08): SQL-layer COUNT; verified by `cargo build` + `cargo sqlx prepare` + manual admin-dashboard check.

This override resolves the VALIDATION blocker (`nyquist_compliant: false` with no Wave 0 plan). No Wave 0 plan is added; the gaps are accepted under this documented override.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Leaflet tiles visible on iOS Safari | FIX-04, FIX-05 | Requires real iOS device + network | Open staging on iPhone, navigate to a report with map |
| Photo uploads upright | FIX-06 | Requires taking portrait photo with orientation metadata | Take portrait photo, submit, view admin portal |
| Admin dashboard scrolls on iOS Safari | FIX-09 | Requires real iOS device | Open admin dashboard on iPhone, scroll |
| BUILD_HASH is real git SHA | FIX-11 | Requires CI deploy to run | Push commit, check deploy, verify footer |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
