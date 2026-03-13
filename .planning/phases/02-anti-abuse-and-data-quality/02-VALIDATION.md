---
phase: 2
slug: anti-abuse-and-data-quality
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust `cargo test` (unit, no live DB) + Jest 29 (frontend) |
| **Config file** | Backend: inline `#[cfg(test)]`; Frontend: `frontend/jest.config.js` |
| **Quick run command** | `cd backend && cargo test 2>/dev/null \| tail -5` |
| **Full suite command** | `cd backend && cargo test && cd ../frontend && npm test -- --passWithNoTests` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && cargo test 2>/dev/null | tail -5`
- **After every plan wave:** Run `cd backend && cargo test && cd ../frontend && npm test -- --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | ABUSE-01 | unit | `cargo test rate_limit` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | ABUSE-01 | unit | `cargo test geohash_coordinate_order` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 0 | ABUSE-02 | unit | `cargo test honeypot` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 0 | ABUSE-02 | unit | `npm test -- report/page` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 0 | ABUSE-03 | unit | `cargo test proximity_query` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 0 | ABUSE-03 | unit | `cargo test dedup_update_sql` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 0 | ABUSE-04 | unit | `cargo test duplicate_confidence` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 0 | ABUSE-05 | unit | `cargo test photo_hash_before_exif` | ❌ W0 | ⬜ pending |
| 02-02-05 | 02 | 0 | ABUSE-05 | unit | `cargo test photo_hash_dedup` | ❌ W0 | ⬜ pending |
| 02-02-06 | 02 | 0 | ABUSE-06 | unit | `cargo test admin_reports_includes_dedup_cols` | ❌ W0 | ⬜ pending |
| 02-02-07 | 02 | 0 | ABUSE-06 | unit | `npm test -- admin/reports/page` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/handlers/reports_abuse_tests.rs` (or inline `#[cfg(test)]`) — honeypot, rate limit key, photo hash, coordinate order tests
- [ ] `backend/src/db/dedup_job_tests.rs` — proximity SQL string tests, dedup update SQL tests
- [ ] `backend/src/db/admin_queries_abuse_tests.rs` — admin_reports dedup column selection tests
- [ ] `frontend/app/report/__tests__/page.honeypot.test.tsx` — frontend honeypot field render test
- [ ] `frontend/app/admin/reports/__tests__/page.dedup.test.tsx` — admin badge render test (duplicate_count badge)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Silent discard (honeypot) gives no console/log signal | ABUSE-02 | Log output only visible at runtime | Submit with `website` filled; confirm no server log entry for rejection |
| Background dedup job runs and links reports | ABUSE-03 | Requires live PostGIS + two real reports | Submit two reports within 50m, same category; wait 5+ min; verify `duplicate_of_id` set via DB query |
| Admin expandable row shows linked duplicates inline | ABUSE-06 | UI interaction requiring browser | Open admin reports page; find a report with `duplicate_count > 0`; expand row; verify linked duplicates display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
