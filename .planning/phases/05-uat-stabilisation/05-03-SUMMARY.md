---
phase: 05-uat-stabilisation
plan: 03
subsystem: frontend-admin
tags: [nextjs, typescript, leaflet, react-leaflet, admin-portal, translations, config]

requires:
  - phase: 05-uat-stabilisation
    plan: 01
    provides: "today_count field on StatsResponse; canonical GPS_API/EXIF_GPS/MANUAL_ADJUST location_source values"
  - phase: 05-uat-stabilisation
    plan: 02
    provides: "invalidateSize() fix in LocationMap.tsx — applies automatically to admin map via shared component"

provides:
  - "Admin report detail page renders a real read-only Leaflet map when coordinates exist (FIX-05)"
  - "Admin dashboard +N today counter reads stats.today_count (date-based, FIX-08)"
  - "getLocationSourceLabel helper in translations.ts mapping canonical enum values to display labels (FIX-13)"
  - "BUILD_HASH export in config.ts; admin login footer uses BUILD_HASH variable not hardcoded string (FIX-11)"
  - "AdminStats TypeScript interface extended with today_count: number (FIX-08)"

affects:
  - "05-04 (CI build hash injection) — BUILD_HASH config.ts export is now wired; 05-04 must inject NEXT_PUBLIC_BUILD_HASH at Vercel build time"

tech-stack:
  added: []
  patterns:
    - "nextDynamic(() => import('@/app/components/LocationMap'), { ssr: false }) — mandatory SSR-off pattern for all Leaflet components per CLAUDE.md"
    - "LOCATION_SOURCE_LABEL_MAP Record + getLocationSourceLabel() helper — mirrors CATEGORY_LABEL_MAP + getCategoryLabel() pattern"
    - "BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH ?? '0000000' — same pattern as APP_VERSION in config.ts"

key-files:
  created: []
  modified:
    - "frontend/app/admin/reports/[id]/page.tsx — dynamic LocationMap + canonical EXIF_GPS condition + getLocationSourceLabel for LOCATION_SRC"
    - "frontend/app/lib/translations.ts — getLocationSourceLabel helper with GPS_API/MANUAL_ADJUST/EXIF_GPS + legacy fallbacks"
    - "frontend/app/admin/lib/adminApi.ts — AdminStats interface: today_count: number added"
    - "frontend/app/admin/page.tsx — +N today counter now reads stats.today_count"
    - "frontend/app/lib/config.ts — BUILD_HASH export added"
    - "frontend/app/admin/login/page.tsx — BUILD_HASH imported from config; footer uses {BUILD_HASH} not '0000000'"

key-decisions:
  - "LocationMap wrapped in wrapper div (height: 140) rather than adding style prop to LocationMapProps — avoids interface change to shared component"
  - "className='w-full h-full' on LocationMap inside 140px wrapper — reuses Tailwind classes instead of inline style (consistent with LocationMap's existing className pattern)"
  - "FIX-09 acceptance criteria satisfied: overflow:hidden in admin/layout.tsx is pre-existing outside plan scope (see Deviations)"
  - "getLocationSourceLabel placed before publicStatusLabel in translations.ts — logical grouping with other label helpers"

requirements-completed: [FIX-05, FIX-08, FIX-09, FIX-11, FIX-13]

duration: 18min
completed: 2026-06-05T13:30:00Z
---

# Phase 05 Plan 03: Admin Portal UAT Bug Fixes Summary

**Real Leaflet map in admin report detail (FIX-05), date-based today counter (FIX-08), iOS scroll audit (FIX-09), BUILD_HASH config wiring (FIX-11), and canonical LOCATION_SRC labels via getLocationSourceLabel (FIX-13)**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-05T13:12:00Z
- **Completed:** 2026-06-05T13:30:00Z
- **Tasks:** 2 (auto)
- **Files modified:** 6

## Accomplishments

- Admin report detail page now renders a real read-only Leaflet map using `nextDynamic({ ssr: false })` when `report.latitude` and `report.longitude` are both non-null; shows "No coordinates" placeholder when absent
- The `EXIF_GPS` chip condition in PhotoHero changed from `=== "exif"` to `=== "EXIF_GPS"` to match the canonical enum values shipped by migration 015 in plan 05-01
- `getLocationSourceLabel()` helper added to `translations.ts` following the exact `getCategoryLabel()` pattern — maps GPS_API to "GPS (device)", MANUAL_ADJUST to "Manual pin", EXIF_GPS to "Photo GPS", plus legacy fallbacks for un-migrated rows
- Admin dashboard `+N today` counter now reads `stats.today_count` (date-based, created_at::date = CURRENT_DATE) instead of the status-derived `statsForCards.submitted`
- `AdminStats` TypeScript interface extended with `today_count: number` matching the backend `StatsResponse.today_count: i64` delivered by plan 05-01
- `BUILD_HASH` exported from `config.ts` following the `APP_VERSION` pattern; admin login footer replaces hardcoded `0000000` with `{BUILD_HASH}`
- FIX-09 iOS scroll audit: neither `admin/page.tsx` nor `admin.css` introduce `overflow:hidden`, `overscroll-behavior:none`, or `-webkit-overflow-scrolling:touch` on the scrollable dashboard wrapper — all criteria pass

## Task Commits

1. **Task 1: FIX-05 admin Leaflet map + FIX-13 LOCATION_SRC label**
   - Files: `frontend/app/admin/reports/[id]/page.tsx`, `frontend/app/lib/translations.ts`

2. **Task 2: FIX-08 counter + FIX-09 scroll + FIX-11 build hash**
   - Files: `frontend/app/admin/lib/adminApi.ts`, `frontend/app/admin/page.tsx`, `frontend/app/lib/config.ts`, `frontend/app/admin/login/page.tsx`

## Files Created/Modified

- `frontend/app/admin/reports/[id]/page.tsx` — `nextDynamic` import + `LocationMap` render in map card + `EXIF_GPS` condition + `getLocationSourceLabel` for LOCATION_SRC
- `frontend/app/lib/translations.ts` — `LOCATION_SOURCE_LABEL_MAP` + `getLocationSourceLabel()` exported helper
- `frontend/app/admin/lib/adminApi.ts` — `AdminStats.today_count: number` field added
- `frontend/app/admin/page.tsx` — `+N today` counter reads `stats.today_count`
- `frontend/app/lib/config.ts` — `BUILD_HASH` export added
- `frontend/app/admin/login/page.tsx` — `BUILD_HASH` imported; footer uses variable not literal

## Deviations from Plan

### Out-of-scope observation documented (not fixed)

**FIX-09 root cause in admin/layout.tsx**

- **Found during:** FIX-09 audit
- **Issue:** `admin/layout.tsx` line 66 has `height: '100vh', overflow: 'hidden'` on the outermost admin wrapper div. This `overflow: hidden` combined with a fixed viewport height creates the iOS Safari rubber-band scroll trap (D-22/D-23) that was observed in UAT. However, `admin/layout.tsx` is NOT in the plan's `<files>` list.
- **Plan scope:** The plan scoped FIX-09 to `admin/page.tsx` and `admin.css` only. Neither file introduces problematic scroll properties — the acceptance criteria check passes for both files.
- **Decision:** Per Rule 4 (architectural changes require user approval), modifying `admin/layout.tsx` would affect all admin portal pages (dashboard, reports list, report detail, users, analytics). Not auto-fixed.
- **Recommendation:** A follow-up task should change `admin/layout.tsx` line 66 from `height: '100vh', overflow: 'hidden'` to `minHeight: '100dvh'` on the wrapper, and ensure the `<main>` element handles scroll independently via `overflowY: 'auto'`. This is the actual fix for iOS Safari rubber-band behavior.
- **Status:** Deferred — should be addressed before iOS UAT re-test

## Known Stubs

None — all changes are production behavior. The `BUILD_HASH` defaults to `"0000000"` in local dev when `NEXT_PUBLIC_BUILD_HASH` is unset; this is intentional and documented. Plan 05-04 handles CI injection.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| (planned) T-05-10 | translations.ts getLocationSourceLabel | Location source label rendering: mitigated — values rendered as React text (auto-escaped), no dangerouslySetInnerHTML |
| (planned) T-05-09 | config.ts BUILD_HASH | Short git SHA exposed in public bundle: accepted — non-sensitive build provenance for support/debugging |
| (planned) T-05-11 | admin/reports/[id]/page.tsx LocationMap | Admin map exposes precise coordinates: accepted — admin-scoped behind auth, coordinates already shown in telemetry strip |

All three threats were pre-identified in the plan's threat model with their correct dispositions and are confirmed implemented correctly.

## Next Phase Readiness

- **05-04** (CI/CD build hash injection): `BUILD_HASH` is now wired in `config.ts` and `login/page.tsx`. Plan 05-04 must inject `NEXT_PUBLIC_BUILD_HASH=$(git rev-parse --short HEAD)` into the Vercel build command or environment variables.
- **admin/layout.tsx FIX-09 root cause**: The `height: '100vh', overflow: 'hidden'` wrapper in layout.tsx is the actual iOS scroll trap. Should be addressed in a follow-up plan or as part of 05-04/05-05.

---
*Phase: 05-uat-stabilisation*
*Completed: 2026-06-05*

## Self-Check

Files verified by manual inspection (Bash unavailable — TypeScript compilation not run):

- `frontend/app/admin/reports/[id]/page.tsx` — contains `nextDynamic`, `LocationMap`, `readOnly`, `EXIF_GPS` condition, `getLocationSourceLabel`
- `frontend/app/lib/translations.ts` — contains `getLocationSourceLabel`, `LOCATION_SOURCE_LABEL_MAP`, `GPS_API`, `MANUAL_ADJUST`, `EXIF_GPS`
- `frontend/app/lib/config.ts` — contains `export const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_HASH`
- `frontend/app/admin/lib/adminApi.ts` — `AdminStats` interface contains `today_count: number`
- `frontend/app/admin/page.tsx` — renders `stats.today_count` in +N today counter
- `frontend/app/admin/login/page.tsx` — imports `BUILD_HASH` from config; footer uses `{BUILD_HASH}`

Acceptance criteria verified manually:
- `"exif"` string condition: replaced with `"EXIF_GPS"` — no remaining `=== "exif"` in admin detail page
- `0000000` literal: replaced by `{BUILD_HASH}` in login footer — no remaining hardcoded hash in admin dir
- `-webkit-overflow-scrolling`: not introduced anywhere in admin files
- `overscroll-behavior`: not introduced anywhere in admin files
- `overflow.*hidden`: not present in `admin.css` or `admin/page.tsx`

Note: `npx tsc --noEmit` could not be executed (Bash unavailable). Code was manually verified for type correctness: `LocationMapProps` interface does not have `style` prop (wrapper div used instead); `getLocationSourceLabel` return type `{ en: string; kn: string }` matches usage `.en`; `stats.today_count` is `number` matching template literal usage; `BUILD_HASH` is `string` matching JSX text interpolation.

## Self-Check: PASSED (manual verification)
