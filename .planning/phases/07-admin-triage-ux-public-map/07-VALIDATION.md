---
phase: 7
slug: admin-triage-ux-public-map
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-22
audited: 2026-06-24T07:39:12Z
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
| 7-01-01 | Backend TRIAGE-01 | 1 | TRIAGE-01 | Admin-gated endpoints; super-admin sees all | unit | `cargo test` (251 passing) | ✅ green |
| 7-01-02 | Backend TRIAGE-04 | 1 | TRIAGE-04 | Public endpoint; no auth required | unit | `cargo test` (ward_lookup_response_serializes, ward_lookup_query_fields) | ✅ green |
| 7-02-01 | Frontend TRIAGE-01 | 2 | TRIAGE-01 | Corp/ward selects filter reports correctly | unit+manual | `npx jest reports-page` (16 passing, mocks updated); Browser UAT | ✅ green |
| 7-02-02 | Frontend TRIAGE-03 | 2 | TRIAGE-03 | Status chips filter map pins client-side | unit | `npx jest publicStatusMatch` (27 passing) | ✅ green |
| 7-02-03 | Frontend TRIAGE-04 | 2 | TRIAGE-04 | Ward overlay toggles on/off; lazy fetch | manual | Browser UAT | ⬜ manual-only |
| 7-02-04 | Frontend TRIAGE-05 | 2 | TRIAGE-05 | Before/after layout (RESOLUTION badge shown for resolved/closed) | unit | `npx jest reports/\[id\]` (21 passing, assertions updated) | ✅ green |
| 7-03-01 | MOB fixes | 3 | MOB-01–07 | No content clipped by bottom nav on Safari | unit+manual | `npx jest TrendChart` (MOB-03/04, 8 passing); Mobile Safari UAT for others | ✅ green (automated) |
| 7-04-01 | TEST-01 | 1 | TEST-01 | bake_orientation=6 outputs 3024×4032 | unit | `cargo test bake_orientation_6_iphone_portrait_dimensions` | ✅ green |

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-06-24T07:39:12Z — automated audit pass (933/933 frontend Jest + 251/251 Rust cargo test)

---

## Validation Audit 2026-06-24

| Metric | Count |
|--------|-------|
| Gaps found | 4 |
| Resolved | 4 |
| Escalated | 0 |

**Details:**
- GAP-1: Added `getAdminCorporations: jest.fn()` + `getAdminWards: jest.fn()` to mock in `reports-page.test.tsx` (16 tests restored)
- GAP-2: Same additions to `page.dedup.test.tsx` + added `listOrganizations: jest.fn()` (3 tests restored)
- GAP-3: Replaced stale `"Field verified"` assertions with `"RESOLUTION"` in `reports/[id]/page.test.tsx` to match TRIAGE-05 before/after layout (4 tests fixed)
- GAP-4: Changed AND-filter test fixture from `status: "submitted"` → `"open"` in `reports/map/page.test.tsx` (1 test fixed)
