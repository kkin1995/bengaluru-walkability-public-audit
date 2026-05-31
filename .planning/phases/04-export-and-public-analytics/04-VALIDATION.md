---
phase: 4
slug: export-and-public-analytics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31T09:00:00Z
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
| 04-01-01 | 01 | 1 | EXPORT-01 | T-04-01 | CSV omits PII fields | integration | `cargo test export::csv` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | EXPORT-02 | T-04-02 | GeoJSON streams, no memory buffer | integration | `cargo test export::geojson_admin` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | EXPORT-01 | — | Export requires admin auth (401 without) | integration | `cargo test export::requires_auth` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | EXPORT-03 | T-04-03 | Public GeoJSON has no PII, coords 3dp | integration | `cargo test export::public_geojson` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | EXPORT-03 | T-04-03 | Rate limiter returns 429 on burst | integration | `cargo test export::rate_limit` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | ANALYTICS-01 | — | Materialized view refresh trigger fires on insert | integration | `cargo test analytics::mv_refresh` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 2 | ANALYTICS-01 | — | /stats page builds without SSR error | build | `cd frontend && npm run build 2>&1 | grep -i error` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | ANALYTICS-02 | — | Top wards query returns correct count | integration | `cargo test analytics::top_wards` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | ANALYTICS-03 | — | Resolution rate query returns 0–100 value | integration | `cargo test analytics::resolution_rate` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 2 | ANALYTICS-04 | — | Trend query returns 12 weeks of data | integration | `cargo test analytics::trend_12w` | ❌ W0 | ⬜ pending |
| 04-03-04 | 03 | 2 | ANALYTICS-02 | — | /admin/analytics page builds without error | build | `cd frontend && npm run build 2>&1 | grep -i error` | ✅ | ⬜ pending |
| 04-04-01 | 04 | 3 | MAP-02 | — | Heatmap layer toggle mounts without window error | build | `cd frontend && npm run build 2>&1 | grep -i error` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/export_tests.rs` — stubs for EXPORT-01, EXPORT-02, EXPORT-03
- [ ] `backend/tests/analytics_tests.rs` — stubs for ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04
- [ ] `backend/tests/rate_limit_tests.rs` — stubs for rate limiting behavior

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

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
