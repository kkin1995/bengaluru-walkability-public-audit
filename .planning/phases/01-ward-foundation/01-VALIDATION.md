---
phase: 1
slug: ward-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: cargo test / Frontend: Jest 29 + jsdom + React Testing Library |
| **Config file** | Backend: `Cargo.toml` / Frontend: `frontend/jest.config.js` |
| **Quick run command** | `cd backend && cargo test` |
| **Full suite command** | `cd backend && cargo test && cd frontend && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && cargo test`
- **After every plan wave:** Run `cd backend && cargo test && cd frontend && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | WARD-01 | unit (Rust) | `cargo test ward` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | WARD-01 | unit (Rust) | `cargo test ward` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | WARD-01 | unit (Rust) | `cargo test reports` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 0 | WARD-02 | unit (Rust) | `cargo test organization` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 0 | WARD-02 | unit (Rust) | `cargo test org_queries` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 0 | WARD-03 | unit (Rust) | `cargo test admin_queries` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 0 | WARD-03 | unit (Rust) | `cargo test admin_queries` | ❌ W0 | ⬜ pending |
| 1-01-08 | 01 | 0 | WARD-04 | migration SQL | `cargo test migration` | ❌ W0 | ⬜ pending |
| 1-01-09 | 01 | 0 | WARD-01 | React unit | `npm test -- --testPathPattern=reports-page` | ❌ W0 | ⬜ pending |
| 1-01-10 | 01 | 0 | WARD-03 | React unit | `npm test -- --testPathPattern=users-page` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | WARD-04 | migration SQL | `cargo test migration` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | WARD-01 | unit (Rust) | `cargo test ward` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 2 | WARD-02 | unit (Rust) | `cargo test organization` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 2 | WARD-03 | unit (Rust) | `cargo test admin` | ❌ W0 | ⬜ pending |
| 1-02-05 | 02 | 3 | WARD-01 | React unit | `npm test -- --testPathPattern=reports-page-ward` | ❌ W0 | ⬜ pending |
| 1-02-06 | 02 | 3 | WARD-03 | React unit | `npm test -- --testPathPattern=users-page-org` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/db/tests/test_ward_queries.rs` — ward lookup logic unit tests (WARD-01)
- [ ] `backend/src/db/tests/test_org_queries.rs` — org hierarchy + scoped query unit tests (WARD-02, WARD-03)
- [ ] `backend/src/models/tests/test_ward_model.rs` — Ward/WardResponse struct serialization (WARD-04)
- [ ] `backend/src/models/tests/test_organization_model.rs` — Organization struct, parent_id nullable (WARD-02)
- [ ] `backend/migrations/tests/test_004_migration.rs` — migration SQL validation (WARD-04)
- [ ] `frontend/app/admin/__tests__/reports-page-ward.test.tsx` — ward name column in triage queue (WARD-01)
- [ ] `frontend/app/admin/__tests__/users-page-org.test.tsx` — org assignment UI (WARD-03)

*Existing infrastructure: `frontend/jest.config.js`, `frontend/jest.setup.ts`, `frontend/__mocks__/` present. Backend `cargo test` works without live DB — all new tests follow the same no-live-DB pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GBA KML → GeoJSON conversion produces 369 valid ward polygons | WARD-04 | KML content not inspectable without actual KML file; geometry validity requires visual + count check | Download KML, run `ogr2ogr`, verify `jq '.features | length'` = 369, inspect 3 random ward polygons on geojson.io |
| Admin triage queue shows correct ward name for a real Bengaluru coordinate | WARD-01 | Requires PostGIS live DB with ward data loaded | Submit report at 12.9716, 77.5946 (Bengaluru center), verify ward name appears in admin queue |
| Org assignment limits triage queue to org-scoped reports only | WARD-03 | Requires seeded org tree + multiple reports | Assign admin to "Central" corporation, verify only Central ward reports appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
