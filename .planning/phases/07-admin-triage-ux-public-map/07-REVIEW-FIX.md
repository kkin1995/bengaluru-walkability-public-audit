---
phase: "07"
fixed_at: 2026-06-23T10:45:00Z
review_path: .planning/phases/07-admin-triage-ux-public-map/07-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-06-23T10:45:00Z
**Source review:** .planning/phases/07-admin-triage-ux-public-map/07-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (3 Critical, 7 Warning)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: Admin map page uses pre-Phase-03 status values — all pins render gray

**Files modified:** `frontend/app/admin/reports/map/page.tsx`
**Commit:** 2433766
**Applied fix:** Replaced all occurrences of `"submitted"` and `"under_review"` strings with the current six-value enum (`open`, `acknowledged`, `assigned`, `in_progress`, `resolved`, `closed`) in `getPinColor`, `getStatusCssColor`, `STATUS_OPTIONS`, `STATUS_CHIP_OPTIONS`, `StatusFilter` type, and the map legend at the bottom. Every pin now renders with the correct color and every status filter returns real results.

---

### CR-02: Public map status filter has overlapping buckets

**Files modified:** `frontend/app/map/page.tsx`, `frontend/app/components/ReportsMap.tsx`
**Commit:** 4418f9b
**Applied fix:** Made status buckets mutually exclusive in `statusMatch` (map/page.tsx) and `reportStatusMatch` (ReportsMap.tsx). `open` now matches only `"open"`; `in_progress` matches `acknowledged | assigned | in_progress`; `resolved` matches `resolved | closed`. Updated `statusCounts` in map/page.tsx to use the same mapping so chip count labels agree with the visible pin set.

---

### CR-03: Public report detail page crashes with TypeError when `report.history` is absent

**Files modified:** `frontend/app/reports/[id]/page.tsx`
**Commit:** 2b4a493
**Applied fix:** Added null guards at all three unguarded `report.history` accesses:
- Line ~421: `[...(report.history ?? [])].reverse()` — prevents spread of undefined
- Line ~738: `(report.history ?? []).length === 0` — prevents `.length` on null
- Line ~744: `(report.history ?? []).map(...)` — prevents `.map` on null
- Line ~748: `(report.history ?? []).length - 1` — prevents arithmetic on null length

---

### WR-01: Admin map page caps at 200 reports silently

**Files modified:** `frontend/app/admin/reports/map/page.tsx`
**Commit:** 90e523b
**Applied fix:** Added a `warn`-tone `Pill` component beside the report count in the top bar that appears when `reports.length >= 200`, displaying "Showing first 200 — map may be partial". Uses the existing `Pill` component's `tone="warn"` variant.

---

### WR-02: CSV/GeoJSON export omits active corp/ward filters

**Files modified:** `frontend/app/admin/reports/page.tsx`
**Commit:** f7931b9
**Applied fix:** Added `corporationId` and `wardId` forwarding to both `handleCsvDownload` and `handleGeoJsonDownload`. Both now set `filters.corporation_id` and `filters.ward_id` when those state values are non-empty. The `AdminReportFilters` interface already had both fields; no type changes needed.

---

### WR-03: Handler-layer email check weaker than model-layer helper

**Files modified:** `backend/src/handlers/admin.rs`, `backend/src/models/admin.rs`
**Commit:** c4dacf9
**Applied fix:** Replaced `email.is_empty() || !email.contains('@')` in `validate_create_user_request` with `!crate::models::admin::validate_email_format(email)`, which correctly rejects double-`@` addresses, empty local parts, and domains without `.`. Also removed `#[allow(dead_code)]` from `validate_email_format` in models/admin.rs since it is now called in production code.

---

### WR-04: `AdminUser` TypeScript interface declares `org_id` that backend never serializes

**Files modified:** `frontend/app/admin/lib/adminApi.ts`
**Commit:** cd222f3
**Applied fix:** Changed `org_id: string | null` to `org_id?: string | null` (optional) in the `AdminUser` interface. This correctly models that the backend never serializes the field (it is always `undefined`, not `null`) while avoiding a cascade of TypeScript errors at existing call sites in `users/page.tsx` and `profile/page.tsx` that reference `user.org_id`. Comment added explaining when to make it required again.

---

### WR-05: Resolution photo shown for non-resolved reports

**Files modified:** `frontend/app/reports/[id]/page.tsx`
**Commit:** 19f9d7d
**Applied fix:** Changed `const hasResolutionPhoto = publicResolutionUrl !== ""` to `const hasResolutionPhoto = publicResolutionUrl !== "" && isResolved`. The Before/After grid and RESOLUTION badge now only appear when both a resolution photo URL is present AND the report status is `resolved` or `closed`.

---

### WR-06: nginx adds duplicate `Cache-Control` header on `/api/wards/boundaries`

**Files modified:** `nginx/nginx.conf`, `nginx/nginx.server.conf`
**Commit:** 9786a08
**Applied fix:** Removed `add_header Cache-Control "public, max-age=86400"` from the `/api/wards/boundaries` location block in both `nginx.conf` and `nginx.server.conf`. The Axum handler in `handlers/wards.rs` remains the single source of truth for this header. `add_header Vary "Accept-Encoding"` is retained in nginx as it is not set by the backend.

---

### WR-07: Filter load effect fires `setIsLoadingFilters(false)` while retry is in-flight

**Files modified:** `frontend/app/admin/reports/page.tsx`
**Commit:** 4326f4c
**Applied fix:** Replaced the `Promise.all + catch(retry) + finally` pattern with `Promise.allSettled`. Partial failures are now handled inline (each result is inspected independently) and the loading state is cleared exactly once after all results are known. Added a `cancelled` flag to guard against state updates after unmount.

---

## Skipped Issues

None — all 10 in-scope findings were fixed.

---

_Fixed: 2026-06-23T10:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
