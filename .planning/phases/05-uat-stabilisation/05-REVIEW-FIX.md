---
phase: 05-uat-stabilisation
fixed_at: 2026-06-05T12:30:00Z
review_path: .planning/phases/05-uat-stabilisation/05-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-06-05T12:30:00Z
**Source review:** .planning/phases/05-uat-stabilisation/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (4 Critical + 9 Warning)
- Fixed: 13
- Skipped: 0

## Fixed Issues

### CR-01: Honeypot field changed from `type="hidden"` to visually-hidden `type="text"`

**Files modified:** `frontend/app/report/page.tsx`
**Commit:** 45f8e31
**Applied fix:** Changed all three step-branch honeypot inputs from `type="hidden"` (which bots skip) to `type="text"` with `name="website"`, `aria-hidden="true"`, `tabIndex={-1}`, `autoComplete="off"`, and absolute off-screen CSS positioning. Bots can now fill the field; legitimate users cannot see or interact with it. The existing `querySelector('[data-hp="1"]')` reader in the submit handler is unchanged.

---

### CR-02: `location_source` validated against enum whitelist before DB insert

**Files modified:** `backend/src/handlers/reports.rs`
**Commit:** 66144c0
**Applied fix:** Replaced the bare `field.text()` assignment with a `match` expression that whitelists `GPS_API`, `EXIF_GPS`, `MANUAL_ADJUST` (canonical) and `exif`, `manual_pin` (legacy pre-015 clients). Any unrecognised value silently defaults to `GPS_API` instead of being forwarded to the PostgreSQL enum column and producing an unhandled 500.

---

### CR-03: `photo-store.ts` — blob URL revoked on overwrite, SSR guards added

**Files modified:** `frontend/app/lib/photo-store.ts`
**Commit:** 31252a2
**Applied fix:** `storePendingPhoto` now revokes the previous `previewUrl` blob URL via `URL.revokeObjectURL` before overwriting (prevents accumulation on repeated photo picks on low-memory iOS). Both `storePendingPhoto` and `consumePendingPhoto` now guard against SSR with `typeof window === "undefined"` checks.

---

### CR-04 + WR-01: nginx CSP `connect-src` fixed for admin Leaflet tiles and Nominatim

**Files modified:** `nginx/nginx.conf`
**Commit:** af9196d
**Applied fix (CR-04):** The admin `location /admin` CSP block's `connect-src` was `'self'` only. Added `https://*.tile.openstreetmap.org` so the FIX-05 Leaflet map works on iOS Safari in the admin panel (which fetches tiles via XHR, governed by `connect-src`).
**Applied fix (WR-01):** The public `location /` CSP block's `connect-src` was missing `nominatim.openstreetmap.org`. The wildcard `*.tile.openstreetmap.org` does not cover the `nominatim` subdomain. Added `https://nominatim.openstreetmap.org` to unblock BUG-4 nearby road reverse geocoding on strict browsers.

---

### WR-02: `SuccessCard` now shares the specific report URL, not the homepage

**Files modified:** `frontend/app/components/redesign/SuccessCard.tsx`
**Commit:** 956b150
**Applied fix:** `handleShare` now constructs `${origin}/reports/${reportId}` when `reportId` is available, falling back to `origin` only when `reportId` is absent. Both the Web Share API call and the clipboard fallback use the specific report URL.

---

### WR-03: `statusActionLabel` updated to reflect live status enum values

**Files modified:** `frontend/app/admin/page.tsx`
**Commit:** c41a6c0
**Applied fix:** Replaced the dead `under_review` branch (never emitted by the live DB since migration 008) with correct mappings: `resolved` and `closed` → "Resolved"; `in_progress`, `assigned`, and `acknowledged` → "In progress"; everything else (open + unknown) → "New".

---

### WR-04: Migration 015 non-atomic UPDATE risk documented; PG version comment corrected

**Files modified:** `backend/migrations/015_rename_location_source.sql`
**Commit:** 9825474
**Applied fix:** Added an `ATOMICITY NOTE` comment above the UPDATE statements explaining that they run outside the transaction (due to `sqlx:noTransaction`) and that both predicates are idempotent (retry-safe). Also corrected the comment that claimed the `ALTER TYPE ADD VALUE` restriction applies only to "PostgreSQL < 12" — the restriction applies to all PostgreSQL versions; PG 12 changed visibility semantics but not the transaction requirement.

---

### WR-05: `compressImage` and `MAX_BYTES` extracted to shared `image-utils.ts`

**Files modified:** `frontend/app/lib/image-utils.ts` (created), `frontend/app/components/ReportCTA.tsx`, `frontend/app/report/page.tsx`
**Commit:** 0dca560
**Applied fix:** Created `frontend/app/lib/image-utils.ts` exporting `MAX_BYTES` and `compressImage`. Removed the verbatim duplicate implementations from both `ReportCTA.tsx` and `report/page.tsx` and replaced with `import { MAX_BYTES, compressImage } from "@/app/lib/image-utils"`. Any future change to the quality ladder or size limit now needs to be made in one place only.

---

### WR-06: `ReportsMap` `fetchReports` infinite-loop risk fixed with stable ref

**Files modified:** `frontend/app/components/ReportsMap.tsx`
**Commit:** a618c06
**Applied fix:** Added `useRef` import, created `onLoadedRef` with a syncing `useEffect`, replaced `onReportsLoaded?.(items)` with `onLoadedRef.current?.(items)` inside `fetchReports`, and removed `onReportsLoaded` from the `useCallback` dependency array. An inline callback from a caller no longer causes `fetchReports` to be recreated every render.

---

### WR-07: Nominatim `User-Agent` derived from config constant `NOMINATIM_USER_AGENT`

**Files modified:** `frontend/app/lib/config.ts`, `frontend/app/report/page.tsx`
**Commit:** 8bb9114
**Applied fix:** Added `NOMINATIM_USER_AGENT` export to `config.ts` — derives from `NEXT_PUBLIC_SITE_URL` env var (defaults to `nammadaari.com`). Replaced the hardcoded staging subdomain string in `report/page.tsx` with `NOMINATIM_USER_AGENT`. Per CLAUDE.md config rule, all env-var-derived config now lives in `config.ts`.

---

### WR-08: Test `list_admin_reports_with_org_id_includes_recursive_cte` rewritten to match production CTE structure

**Files modified:** `backend/src/db/admin_queries.rs`
**Commit:** 7c0422c
**Applied fix:** Rewrote the test to replicate the actual top-level CTE prefix pattern used by production `list_admin_reports` (CTE as a `WITH RECURSIVE ...` prefix before the main SELECT, not as an inline CTE inside `IN(...)`). Added a third assertion verifying that the CTE starts at the top level of the SQL string. The test now validates the SQL pattern that the live database actually receives.
**Note:** Requires human verification — this is a logic correctness fix in a test. (fixed: requires human verification)

---

### WR-09: `photo-store.ts` hard-reload and tab-discard limitation documented

**Files modified:** `frontend/app/lib/photo-store.ts`
**Commit:** 1ab1123
**Applied fix:** Added a `KNOWN LIMITATION (WR-09)` block in the module header explaining that `window.__pendingPhoto` does not survive hard reloads or iOS tab discard under memory pressure, that the UI recovers correctly (returns to photo step) but the photo is silently lost, and documenting the `sessionStorage` hardening path for future work.

---

_Fixed: 2026-06-05T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
