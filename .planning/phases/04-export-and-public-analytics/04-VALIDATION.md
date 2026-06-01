---
phase: 4
slug: export-and-public-analytics
status: audited
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-31T09:00:00Z
audited: 2026-05-31T10:30:00Z
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (backend) / jest / next build (frontend) |
| **Config file** | backend/Cargo.toml / frontend/package.json |
| **Quick run command** | `cargo test -q 2>&1 | tail -5` |
| **Full suite command** | `cargo test && cd frontend && npm run build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test -q 2>&1 | tail -5`
- **After every plan wave:** Run `cargo test && cd frontend && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | EXPORT-01 | T-04-01 | CSV omits PII fields | unit | `cargo test --test export_tests` | ✅ | ✅ green |
| 04-01-02 | 01 | 1 | EXPORT-02 | T-04-02 | GeoJSON streams, no memory buffer | unit | `cargo test --test export_tests` | ✅ | ✅ green |
| 04-01-03 | 01 | 1 | EXPORT-01 | — | Export requires admin auth (401 without) | manual | — | ↗ manual | ↗ manual |
| 04-02-01 | 02 | 1 | EXPORT-03 | T-04-03 | Public GeoJSON has no PII, coords 3dp | unit | `cargo test --test public_geojson_tests` | ✅ | ✅ green |
| 04-02-02 | 02 | 1 | EXPORT-03 | T-04-03 | Rate limiter returns 429 on burst | unit | `cargo test --test rate_limit_tests` | ✅ | ✅ green |
| 04-02-03 | 02 | 1 | ANALYTICS-01 | — | Materialized view refresh trigger fires on insert | manual | — | ↗ manual | ↗ manual |
| 04-02-04 | 02 | 2 | ANALYTICS-01 | — | /stats page builds without SSR error | build | `cd frontend && npm run build 2>&1 | grep -i error` | ✅ | ✅ green |
| 04-03-01 | 03 | 2 | ANALYTICS-02 | — | Top wards query returns correct count | unit | `cargo test --test analytics_tests` | ✅ | ✅ green |
| 04-03-02 | 03 | 2 | ANALYTICS-03 | — | Resolution rate query returns 0–100 value | unit | `cargo test --test analytics_tests` | ✅ | ✅ green |
| 04-03-03 | 03 | 2 | ANALYTICS-04 | — | Trend query returns 12 weeks of data | unit | `cargo test --test analytics_tests` | ✅ | ✅ green |
| 04-03-04 | 03 | 2 | ANALYTICS-02 | — | /admin/analytics page builds without error | build | `cd frontend && npm run build 2>&1 | grep -i error` | ✅ | ✅ green |
| 04-04-01 | 04 | 3 | MAP-02 | — | Heatmap layer toggle mounts without window error | build | `cd frontend && npm run build 2>&1 | grep -i error` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ↗ manual*

---

## Wave 0 Requirements

- [x] `backend/tests/export_tests.rs` — EXPORT-01, EXPORT-02 (5 unit tests, all green)
- [x] `backend/tests/analytics_tests.rs` — ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05 (4 unit tests, all green)
- [x] `backend/tests/public_geojson_tests.rs` — EXPORT-03, ANALYTICS-01 (4 unit tests, all green)
- [x] `backend/tests/rate_limit_tests.rs` — EXPORT-03 rate limit behavior (2 unit tests, all green)

*Frontend verification is build-time (next build) — no new test files needed there.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSV opens correctly in Excel (no truncation, DD/MM/YYYY) | EXPORT-01 | Requires Excel or LibreOffice UI | Export CSV, open in Excel, verify dates and column widths |
| GeoJSON imports correctly into QGIS | EXPORT-02 | Requires QGIS desktop | Export admin GeoJSON, drag-drop into QGIS, verify features load |
| Heatmap visible and readable at Bengaluru zoom level | MAP-02 | Visual inspection | Open /map, toggle heatmap, zoom to city level, verify density visible |
| Ward choropleth click-to-filter drilldown | ANALYTICS-05 | Interaction test | Click a ward on choropleth, verify tables + chart filter to that ward |
| Public /stats page shareable URL loads without auth | ANALYTICS-01 | E2E UX check | Open incognito browser, navigate to /stats, verify page loads fully |
| Export endpoints return 401 without admin auth | EXPORT-01 | Requires live HTTP + auth middleware (routes confirmed in admin_protected_router with require_auth layer at main.rs:263–266) | Send unauthenticated GET /api/admin/reports/export/csv, verify 401 response |
| Materialized view refresh trigger fires on insert | ANALYTICS-01 | Requires live PostgreSQL with triggers active | Insert test report, wait for trigger, SELECT from public_stats_mv, verify total_reports incremented |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (rate_limit_tests.rs added for 04-02-02)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [ ] `nyquist_compliant: true` — 2 manual-only items remain (04-01-03, 04-02-03); see Manual-Only table

**Approval:** 10 automated (all green) · 2 manual-only · 0 pending

---

## Validation Audit 2026-05-31

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved (automated) | 1 (04-02-02 — rate_limit_tests.rs added) |
| Moved to manual-only | 2 (04-01-03 auth, 04-02-03 MV trigger) |
| All automated tests | 15 unit + 3 build = 18 total, all green |
