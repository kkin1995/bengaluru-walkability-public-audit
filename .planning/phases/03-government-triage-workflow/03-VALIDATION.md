---
phase: 3
slug: government-triage-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest + React Testing Library (frontend); cargo test (backend) |
| **Config file** | `frontend/jest.config.js` (existing) |
| **Quick run command** | `cd backend && cargo test` + `cd frontend && npm test -- --watchAll=false` |
| **Full suite command** | `cd backend && cargo test -- --test-threads=1` + `cd frontend && npm test -- --watchAll=false --coverage` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && cargo test` + `cd frontend && npm test -- --watchAll=false`
- **After every plan wave:** Run full suite with coverage
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-xx | 01 | 1 | WFLOW-01 | unit (Rust) | `cd backend && cargo test validate_status` | ❌ W0 | ⬜ pending |
| 3-01-xx | 01 | 1 | WFLOW-01 | unit (Jest) | `cd frontend && npm test -- StatusBadge --watchAll=false` | ❌ W0 | ⬜ pending |
| 3-01-xx | 01 | 1 | WFLOW-02 | unit (Rust) | `cd backend && cargo test resolve_report` | ❌ W0 | ⬜ pending |
| 3-02-xx | 02 | 2 | WFLOW-03 | unit (Jest) | `cd frontend && npm test -- adminApi --watchAll=false` | ❌ W0 | ⬜ pending |
| 3-02-xx | 02 | 2 | WFLOW-04 | unit (Jest) | `cd frontend && npm test -- ResolveModal --watchAll=false` | ❌ W0 | ⬜ pending |
| 3-02-xx | 02 | 2 | WFLOW-05 | unit (Rust) | `cd backend && cargo test admin_resolve_report_requires_photo` | ❌ W0 | ⬜ pending |
| 3-02-xx | 02 | 2 | WFLOW-05 | unit (Rust) | `cd backend && cargo test admin_resolve_report_saves_photo` | ❌ W0 | ⬜ pending |
| 3-03-xx | 03 | 3 | MAP-01 | unit (Jest) | `cd frontend && npm test -- ReportsMap --watchAll=false` | ✅ existing | ⬜ pending |
| 3-03-xx | 03 | 3 | MAP-03 | unit (Jest) | `cd frontend && npm test -- ReportsMap --watchAll=false` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/app/admin/components/__tests__/ResolveModal.test.tsx` — stubs for WFLOW-04, WFLOW-05 (frontend validation)
- [ ] `frontend/app/admin/components/__tests__/OrgPicker.test.tsx` — stubs for WFLOW-03 UI
- [ ] `backend/src/handlers/admin.rs` test module — extend `validate_status` tests to cover 6 new values + reject old values (WFLOW-01)
- [ ] New Rust unit test for resolve_report mandatory-photo validation (WFLOW-05)
- [ ] Extend `frontend/app/admin/components/__tests__/StatusBadge.test.tsx` to cover all 6 new status entries (WFLOW-01 frontend)
- [ ] Extend `frontend/app/components/__tests__/ReportsMap.test.tsx` to assert STATUS_COLORS usage and popup status label (MAP-01, MAP-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full status lifecycle transition flow (Open → Acknowledged → … → Closed) | WFLOW-01 | Requires live DB + session cookie; integration test cost exceeds value for this phase | Login as admin, open a report, cycle through all 6 statuses using the UI, verify each status_history row appears |
| Org assignment: assigned org's admins see report in their queue | WFLOW-02 | Requires two separate admin sessions with different org scope | Login as org-scoped admin after assignment; verify report appears in their filtered list |
| Resolution photo upload end-to-end | WFLOW-05 | File upload via multipart requires live server + storage | Use admin UI to resolve a report with photo; verify image displayed in admin detail view |
| Public map pin color changes on status change | MAP-01 | Requires live data + browser visual inspection | Submit report, change status in admin, reload public map, verify pin color matches status |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
