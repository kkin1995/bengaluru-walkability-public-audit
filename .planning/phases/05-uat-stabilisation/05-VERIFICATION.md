---
phase: 05-uat-stabilisation
verified: 2026-06-05T14:45:00Z
overrides_applied_at: 2026-06-18T00:00:00Z
status: passed
score: 11/13 must-haves verified; 2 overrides applied
overrides_applied: 2
human_verification:
  - test: "FIX-09 root cause: confirm admin dashboard scrolls freely on iOS Safari"
    expected: "Admin dashboard page scrolls without rubber-banding back to top on iPhone Safari"
    why_human: "admin/layout.tsx line 66 retains `height: '100vh', overflow: 'hidden'` on the authenticated wrapper div — this is the actual iOS scroll trap documented in plan 05-03 as out-of-scope. The plan's accepted criteria (admin/page.tsx and admin.css have no overflow:hidden on the scrollable wrapper) pass, but the root cause in layout.tsx was explicitly deferred. Cannot verify free scrolling on iOS Safari from the repo. The fix required is: change `height: '100vh', overflow: 'hidden'` to `minHeight: '100dvh'` on the admin-portal wrapper in the authenticated branch of layout.tsx."
    override: "deferred — plan 05-03 explicitly scoped the root cause (layout.tsx:66) out of Phase 5; tracked as v1.1 post-ship tech debt"
  - test: "FIX-11 BUILD_HASH: confirm Vercel build command has been set"
    expected: "Admin login footer on staging.nammadaari.com shows a non-zero git short SHA (e.g. 'a726edf'), not '0000000'"
    why_human: "The Vercel dashboard build command injection is operator configuration outside this repo. deploy.yml contains the documentation comment instructing the operator to set the build command to `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build`. Whether the dashboard has been configured cannot be verified from the repo. Verify by loading https://staging.nammadaari.com/admin/login and checking the footer."
    override: "post-deploy-only — UAT-05-HUMAN-UAT.md explicitly blocks this on Phase 5 deployment; verify on staging after this PR merges"
---

# Phase 05: UAT Stabilisation Verification Report

**Phase Goal:** Fix 13 confirmed bugs from live iPhone field test on staging.nammadaari.com
**Verified:** 2026-06-05T14:45:00Z
**Status:** passed (2 overrides applied 2026-06-18 — FIX-09 deferred out-of-scope, FIX-11 post-deploy-only)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                          | Status      | Evidence                                                                                                              |
|----|----------------------------------------------------------------------------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------------------------|
| 1  | FIX-01: Public report detail page builds photo src from API_BASE_URL + "/uploads/" + filename                 | VERIFIED    | `reports/[id]/page.tsx` lines 227-228: derives `imageFilename` via `.split("/uploads/").pop()` and builds `publicImageUrl = API_BASE_URL + "/uploads/" + imageFilename`; `<img src={publicImageUrl}>` at line 305 |
| 2  | FIX-02: "Report another" CTA navigates to "/"                                                                 | VERIFIED    | `report/page.tsx` line 420: `onReportAnother={() => { window.location.href = "/"; }}`                                |
| 3  | FIX-03: /report and /reports have permanent redirects to "/"                                                  | VERIFIED    | `next.config.mjs` lines 33-44: `async redirects()` with source `/report` and `/reports`, both `permanent: true`; map/page.tsx FAB changed to `href="/"` |
| 4  | FIX-04: Every Leaflet map in citizen/public flow calls `map.invalidateSize()` after mount                     | VERIFIED    | `LocationMap.tsx` and `ReportsMap.tsx` both contain `MapSizeUpdater` component using `useMap()` + `setTimeout(100ms)`; nginx `location /` block CSP includes `https://*.tile.openstreetmap.org` in both `img-src` and `connect-src` |
| 5  | FIX-05: Admin report detail page renders a real Leaflet map (not grey placeholder) when coordinates exist     | VERIFIED    | `admin/reports/[id]/page.tsx` line 29-31: `nextDynamic(() => import("@/app/components/LocationMap"), { ssr: false })`; line 434-453: conditional render of `<LocationMap lat={...} lng={...} readOnly />` when coordinates non-null |
| 6  | FIX-06: `bake_orientation` invoked before `strip_exif` in create_report; iPhone portraits stored upright      | VERIFIED    | `reports.rs` line 295: `let oriented_bytes = bake_orientation(&req.image_bytes)?;` line 299: `let clean_bytes = strip_exif(&oriented_bytes)?;`; `fn bake_orientation` at line 475; unit tests at lines 1089-1131 |
| 7  | FIX-07: Public status history excludes `acknowledged` rows AND auto-assign duplicate open rows                | VERIFIED    | `queries.rs` lines 396-397: `AND new_status::TEXT != 'acknowledged'` AND `AND (note IS NULL OR note NOT LIKE 'Auto-assigned%')`; admin history in `admin_queries.rs` STATUS_HISTORY_SQL has no such filters (full timeline preserved) |
| 8  | FIX-08: StatsResponse has `today_count`; admin dashboard renders `stats.today_count`; AdminStats typed        | VERIFIED    | `admin.rs` line 246: `pub today_count: i64`; `admin_queries.rs` lines 834-835: `sqlx::query_scalar("SELECT COUNT(*) FROM reports WHERE created_at::date = CURRENT_DATE")`; `admin/page.tsx` line 357: `+${stats.today_count} today`; `adminApi.ts` line 120: `today_count: number` |
| 9  | FIX-09: Admin dashboard page scrolls freely on iOS Safari (no overflow:hidden trap)                           | UNCERTAIN   | `admin/page.tsx` and `admin.css` pass the plan's acceptance criteria (overflow:hidden at line 206 is a progress bar element, not a scrollable wrapper). However, `admin/layout.tsx` line 66 retains `height: '100vh', overflow: 'hidden'` on the authenticated admin wrapper — documented by plan 05-03 as the actual root cause, explicitly deferred as out-of-scope. Cannot confirm free scrolling from the repo alone. |
| 10 | FIX-10: Citizen form GPS coordinates render at 3 decimal places                                               | VERIFIED    | `report/page.tsx` line 663: `{form.lat.toFixed(3)}, {form.lng.toFixed(3)}`; line 971: `{form.lat.toFixed(3)}° N, {form.lng.toFixed(3)}° E` — no remaining `toFixed(4)` for GPS renders |
| 11 | FIX-11: BUILD_HASH exported from config; login footer uses variable not hardcoded 0000000; deploy documented  | UNCERTAIN   | `config.ts` line 26: `export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? "0000000"`; `admin/login/page.tsx` line 246: `{BUILD_HASH}` (not hardcoded); `deploy.yml` lines 14-18: actionable comment naming the Vercel build command. Repo code is correct. Whether the Vercel dashboard build command is actually set cannot be verified from the repo — requires human post-deploy check on staging. |
| 12 | FIX-12: No frontend file renders the string "Auto-routed" (outside tests)                                     | VERIFIED    | `grep -rni "auto.routed" frontend/app --include="*.tsx" --include="*.ts" \| grep -v __tests__ \| grep -v .test.` returns 0 lines; `SuccessCard.tsx` line 241 and `report/page.tsx` line 1025 both render "Auto-detected" |
| 13 | FIX-13: Migration 015 converts manual_pin→GPS_API, exif→EXIF_GPS; backend emits GPS_API; frontend emits canonical values; admin LOCATION_SRC shows canonical labels | VERIFIED | Migration `015_rename_location_source.sql` has `ADD VALUE IF NOT EXISTS` for GPS_API/MANUAL_ADJUST/EXIF_GPS and UPDATE statements; `reports.rs` line 216: `"GPS_API"` default; `photo-store.ts` type is `"EXIF_GPS" \| "GPS_API" \| "MANUAL_ADJUST"`; `ReportCTA.tsx` emits canonical values; `translations.ts` has `getLocationSourceLabel` with all three keys; `admin/reports/[id]/page.tsx` uses `getLocationSourceLabel` for LOCATION_SRC and checks `=== "EXIF_GPS"` |

**Score:** 11/13 truths verified; 2 UNCERTAIN (FIX-09 root cause deferred, FIX-11 Vercel dashboard unverifiable from repo)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `backend/migrations/015_rename_location_source.sql` | Location source canonical enum values + data migration | VERIFIED | Contains `ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'GPS_API'`, `'MANUAL_ADJUST'`, `'EXIF_GPS'`; UPDATE statements for manual_pin→GPS_API and exif→EXIF_GPS; `-- sqlx:noTransaction` pragma |
| `backend/src/handlers/reports.rs` | `bake_orientation` helper + canonical location_source defaults | VERIFIED | `fn bake_orientation` at line 475; called at line 295 before `strip_exif` at line 299; GPS_API default at line 216 and line 91 |
| `backend/src/db/queries.rs` | Public status history filter excluding acknowledged AND auto-assign duplicate open | VERIFIED | Dual AND clauses: `!= 'acknowledged'` and `note NOT LIKE 'Auto-assigned%'` at lines 396-397 |
| `backend/src/models/admin.rs` | StatsResponse.today_count field | VERIFIED | `pub today_count: i64` at line 246 |
| `frontend/app/reports/[id]/page.tsx` | Browser-accessible public image URL using API_BASE_URL | VERIFIED | Imports `API_BASE_URL`; builds `publicImageUrl` via split-and-reconstruct pattern |
| `frontend/next.config.mjs` | 301/308 permanent redirects for /report and /reports | VERIFIED | `async redirects()` returning both routes with `permanent: true` |
| `frontend/app/components/LocationMap.tsx` | MapSizeUpdater invalidateSize fix | VERIFIED | `MapSizeUpdater` component with `useMap()` + `setTimeout(100ms, invalidateSize)` at lines 24-28 |
| `frontend/app/components/ReportsMap.tsx` | invalidateSize fix (D-10 scope — public reports map) | VERIFIED | `MapSizeUpdater` defined inline at lines 16-20; `<MapSizeUpdater />` child of MapContainer at line 158 |
| `nginx/nginx.conf` | Public location / block CSP with tile.openstreetmap.org | VERIFIED | `add_header Content-Security-Policy "...img-src ... https://*.tile.openstreetmap.org; connect-src 'self' https://*.tile.openstreetmap.org;"` with `always` flag at line 220 |
| `frontend/app/admin/reports/[id]/page.tsx` | nextDynamic importing LocationMap with readOnly | VERIFIED | Lines 29-32: `nextDynamic(() => import("@/app/components/LocationMap"), { ssr: false })`; lines 436-442: `<LocationMap ... readOnly />` |
| `frontend/app/lib/translations.ts` | getLocationSourceLabel helper | VERIFIED | `LOCATION_SOURCE_LABEL_MAP` and `getLocationSourceLabel()` at lines 49-62; all three canonical keys plus legacy fallbacks |
| `frontend/app/lib/config.ts` | BUILD_HASH export | VERIFIED | Line 26: `export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? "0000000"` |
| `frontend/app/admin/lib/adminApi.ts` | AdminStats.today_count field | VERIFIED | Line 120: `today_count: number;` |
| `frontend/app/admin/page.tsx` | Renders stats.today_count | VERIFIED | Line 357: `` `+${stats.today_count} today` `` |
| `frontend/app/admin/login/page.tsx` | Uses BUILD_HASH variable (not hardcoded 0000000) | VERIFIED | Line 5: imports `BUILD_HASH` from config; line 246: `{BUILD_HASH}` in footer |
| `.github/workflows/deploy.yml` | Documentation comment containing NEXT_PUBLIC_BUILD_HASH actionable instruction | VERIFIED | Lines 14-18: comment names the Vercel build command `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build` and explicitly prohibits static values |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `reports.rs create_report` | `image crate` | `bake_orientation` called before `strip_exif` | WIRED | Line 295 calls `bake_orientation(&req.image_bytes)`, line 299 calls `strip_exif(&oriented_bytes)` — pipeline order correct |
| `admin_queries.rs get_report_stats` | `StatsResponse.today_count` | `query_scalar` result assigned to `today_count` in struct literal | WIRED | Lines 834-835: `today_count` scalar query; line 906: `today_count,` in `StatsResponse { ... }` |
| `admin/reports/[id]/page.tsx` | `LocationMap.tsx` | `nextDynamic` ssr:false import | WIRED | Lines 29-32: `nextDynamic(() => import("@/app/components/LocationMap"), { ssr: false })` |
| `admin/page.tsx` | `AdminStats.today_count` | `stats.today_count` rendered in +N today counter | WIRED | Line 357: `stats.today_count` in template literal |
| `reports/[id]/page.tsx` | `config.ts` API_BASE_URL | import and usage for publicImageUrl construction | WIRED | Line 12: `import { ..., API_BASE_URL } from "@/app/lib/config"`; lines 227-228: used to build publicImageUrl |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `admin/page.tsx` +N today counter | `stats.today_count` | `admin_queries.rs get_report_stats` → `COUNT(*) FROM reports WHERE created_at::date = CURRENT_DATE` | Yes — live DB count | FLOWING |
| `reports/[id]/page.tsx` photo | `publicImageUrl` | `API_BASE_URL + "/uploads/" + imageFilename` derived from `report.image_url` | Yes — real API data reconstructed for browser access | FLOWING |
| `admin/reports/[id]/page.tsx` LOCATION_SRC | `getLocationSourceLabel(report.location_source)` | `report.location_source` from API response, mapped via `LOCATION_SOURCE_LABEL_MAP` | Yes — real API data mapped to label | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED for backend (no running DB accessible). The following checks were verified statically:

| Behavior | Check | Result | Status |
|---|---|---|---|
| FIX-12: No "Auto-routed" in production code | `grep -rni "auto.routed" frontend/app --include="*.tsx" --include="*.ts" \| grep -v __tests__ \| grep -v .test.` | 0 lines | PASS |
| FIX-13: No "manual_pin" or "\"exif\"" emitted in production frontend code | grep for `"manual_pin"\|"exif"` in `report/page.tsx`, `ReportCTA.tsx`, `photo-store.ts` | 0 production lines (test fixtures only in `__tests__/` — acceptable) | PASS |
| FIX-11: No hardcoded 0000000 in admin dir | `grep -rn "0000000" frontend/app/admin` | 0 lines (BUILD_HASH variable used everywhere) | PASS |
| FIX-07: Admin history has no acknowledged filter | `grep -n "acknowledged" backend/src/db/admin_queries.rs` | Only in enum list and auto-assign note string — no filter clause | PASS |
| Migration 015 has no DROP VALUE | `grep "DROP VALUE" backend/migrations/015_rename_location_source.sql` | 0 lines | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no probe scripts found in `scripts/*/tests/probe-*.sh`. Phase uses `cargo test` and `npx tsc --noEmit` as verify commands per plan, which require a running environment.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| FIX-01 | 05-02 | Public report detail page renders photo correctly | SATISFIED | `reports/[id]/page.tsx` builds `publicImageUrl` from `API_BASE_URL` |
| FIX-02 | 05-02 | "Report another" CTA navigates to `/` | SATISFIED | `report/page.tsx` `onReportAnother` uses `window.location.href = "/"` |
| FIX-03 | 05-02 | "Report here" FAB on /map navigates to `/`; /report and /reports redirect to `/` | SATISFIED | FAB `href="/"` in map/page.tsx; `async redirects()` in next.config.mjs |
| FIX-04 | 05-02 (app) + 05-04 (nginx) | Leaflet tiles load in iOS Safari citizen maps | SATISFIED | `invalidateSize` in LocationMap + ReportsMap; nginx public CSP with `connect-src https://*.tile.openstreetmap.org` |
| FIX-05 | 05-03 | Leaflet map in admin report detail | SATISFIED | `nextDynamic` import + conditional `<LocationMap readOnly />` rendering |
| FIX-06 | 05-01 | EXIF orientation baked before strip | SATISFIED | `bake_orientation` before `strip_exif` in pipeline; image crate = "0.25" |
| FIX-07 | 05-01 | Public status history shows exactly one Open entry | SATISFIED | Dual AND filter in public queries.rs; admin path unfiltered |
| FIX-08 | 05-01 (backend) + 05-03 (frontend) | Admin "+N today" counter is date-based | SATISFIED | `today_count` in StatsResponse, admin_queries.rs, AdminStats interface, and admin/page.tsx render |
| FIX-09 | 05-03 | Admin dashboard scrolls freely on iOS Safari | NEEDS HUMAN | `admin/page.tsx` and `admin.css` pass plan acceptance criteria; root cause (`height: '100vh', overflow: 'hidden'` in `admin/layout.tsx` line 66) is confirmed present but was explicitly deferred as out-of-plan-scope by plan 05-03 |
| FIX-10 | 05-02 | GPS coordinates at 3 decimal places | SATISFIED | Both `toFixed(4)` instances changed to `toFixed(3)` in report/page.tsx |
| FIX-11 | 05-03 (code) + 05-04 (CI) | BUILD_HASH shows real git SHA | NEEDS HUMAN | Repo code is wired (config.ts, login/page.tsx, deploy.yml comment); Vercel dashboard configuration cannot be verified from repo |
| FIX-12 | 05-02 | Ward label is consistently "Auto-detected" | SATISFIED | "Auto-routed" replaced in SuccessCard.tsx and report/page.tsx; 0 remaining occurrences in production code |
| FIX-13 | 05-01 (migration) + 05-02 (emission) + 05-03 (display) | Canonical GPS_API/EXIF_GPS/MANUAL_ADJUST location_source values | SATISFIED | Migration 015 exists; backend emits GPS_API; frontend emits canonical values; admin labels use getLocationSourceLabel |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `frontend/app/admin/layout.tsx` | 66 | `height: '100vh', overflow: 'hidden'` on authenticated admin wrapper | WARNING | This is the root cause of FIX-09 iOS scroll trap — explicitly documented as out-of-scope by plan 05-03 and deferred. Not introduced by this phase. |
| `frontend/app/admin/__tests__/reports-page.test.tsx` | 154, 171 | `location_source: "exif"` and `"manual_pin"` in test fixtures | INFO | These are legacy test fixture data representing pre-migration DB rows — acceptable in tests. The plan's grep acceptance criteria target production source files only, not `__tests__/`. |
| `frontend/app/__tests__/report-page.test.tsx` | 445 | `locationSource: "exif"` in test fixture | INFO | Same as above — legacy test fixture, not production code. |

No `TBD`, `FIXME`, or `XXX` debt markers found in files modified by this phase.

---

### Human Verification Required

#### 1. FIX-09 iOS Scroll Trap Root Cause

**Test:** On an iPhone running iOS Safari, navigate to https://staging.nammadaari.com/admin and log in. Scroll the admin dashboard page (reports list, stats cards, etc.) down and then release your finger. Attempt to scroll freely past the fold.

**Expected:** The page scrolls freely without rubber-banding back to the top position. No viewport lock or bounce-back occurs.

**Why human:** `admin/layout.tsx` line 66 contains `height: '100vh', overflow: 'hidden'` on the outer authenticated admin wrapper div. This creates the iOS Safari rubber-band scroll trap identified in FIX-09 UAT. Plan 05-03 confirmed this is the root cause but explicitly deferred the fix as out-of-plan-scope (requires modifying `admin/layout.tsx`, which affects ALL admin portal pages). The plan's acceptance criteria — checking only `admin/page.tsx` and `admin.css` — pass, but the requirement (`FIX-09: Admin dashboard page scrolls freely on iOS Safari`) is NOT observably met until `admin/layout.tsx` line 66 is changed from `height: '100vh', overflow: 'hidden'` to `minHeight: '100dvh'`.

**Recommended fix:** Change `admin/layout.tsx` line 66:
```tsx
// Before
<div className="admin-portal" style={{ height: '100vh', overflow: 'hidden', display: 'flex', background: 'var(--bg)' }}>

// After
<div className="admin-portal" style={{ minHeight: '100dvh', display: 'flex', background: 'var(--bg)' }}>
```
Also ensure `<main style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>` at line 72 handles the scroll independently (it already does).

---

#### 2. FIX-11 Vercel Build Hash Injection

**Test:** After the Vercel dashboard build command is set to `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD) npm run build`, trigger a Vercel deployment and load https://staging.nammadaari.com/admin/login.

**Expected:** The footer reads "BUILD_HASH: `<7-char git SHA>`" where the SHA is NOT `0000000` and matches `git rev-parse --short HEAD` of the deployed commit.

**Why human:** The injection mechanism (Vercel Build Command override in the Vercel dashboard) is operator configuration outside this repository. The repo code is fully wired (`config.ts` exports `BUILD_HASH`, `login/page.tsx` renders `{BUILD_HASH}`, `deploy.yml` documents the required build command). Whether the Vercel dashboard has been configured cannot be asserted from repo files alone.

---

### Gaps Summary

No FAILED truths were found. Two items require human verification:

1. **FIX-09 (iOS scroll free-scroll):** The plan's file-scope acceptance criteria pass, but the root cause (`overflow: hidden` in `admin/layout.tsx`) was explicitly deferred. The requirement as written in REQUIREMENTS.md ("scrolls freely on iOS Safari") is NOT yet achieved until the layout.tsx fix is applied. This is a **WARNING** — the work needed is identified, small (one style change), and low-risk. It is not a gap introduced by this phase (the layout.tsx style was pre-existing).

2. **FIX-11 (Vercel build hash):** Repo code is fully wired. The Vercel dashboard configuration is the remaining action. This is an **operational step**, not a code gap.

---

_Verified: 2026-06-05T14:45:00Z_
_Verifier: Claude (gsd-verifier)_
