# Phase 7 UAT Checklist

**Phase:** 07 — Admin Triage UX + Public Map
**Staging URL:** https://staging.nammadaari.com
**Requirements covered:** 13 (TRIAGE-01..05, MOB-01..07, TEST-01)
**Authored:** 2026-06-23
**Status:** Awaiting human sign-off

---

## How to use this checklist

1. Work through each requirement entry in order.
2. Perform every numbered step on the specified device/environment.
3. Record the result in the **Result** column: `PASS` or `FAIL: <brief description>`.
4. For failures, note the exact step that failed and any observable symptoms.
5. When all 13 are complete, reply with "approved" (all pass) or list the failing requirement IDs.

---

## Requirements

---

### TRIAGE-01 — Admin ward/corp filter

**Intent:** Admin can filter the reports queue by ward or corporation.
**Environment:** Desktop Chrome + iOS Safari on https://staging.nammadaari.com/admin/reports
**Type:** Manual

**Steps:**
1. Log in to the admin portal on desktop Chrome.
2. Navigate to the Reports queue page (`/admin/reports`).
3. Confirm the filter bar contains two new selects: "CORP:" trigger and "WARD:" trigger, separated from the existing category/status/severity filters by a vertical divider.
4. Open the Corp select — confirm a popover appears listing corporation names (e.g., BBMP East, BBMP West) with zone sub-labels and report counts.
5. Select one corporation. Confirm the Ward select narrows to show only wards belonging to that corporation.
6. Open the Ward select — confirm a search input with placeholder "grep ward name or no…" appears; type a partial ward name and confirm the list filters, showing "Showing N / 369" count.
7. Select a ward. Confirm the report list updates to show only reports from that ward.
8. Clear the Corp select ("All corps"). Confirm the Ward select resets to show all 369 wards.
9. On iOS Safari: repeat steps 3–7. Confirm the corp and ward popovers are scrollable and tappable without offset/positioning issues.

**Expected result:** Corp and Ward selects work independently and in combination; selecting a corp narrows the ward list; filtering changes the report list; popovers render correctly on iOS Safari.

**Result:** ___________

---

### TRIAGE-02 — Public map category chips (already implemented — smoke-verify only)

**Intent:** Public `/map` provides filter chips for report category, matching the admin chip strip.
**Environment:** Desktop Chrome + iOS Safari on https://staging.nammadaari.com/map
**Type:** Manual (smoke-verify only — implementation confirmed present, NOT reimplemented)

**Implementation evidence (verified, no code change made):**
- File: `frontend/app/map/page.tsx`
- `CHIPS` array: lines 15–23 — defines 7 category chips: All, Damaged, Blocked, No path, Crossing, Lighting, Other
- `chipLabel` helper: lines 47–58 — formats chip label with live count
- Category chip rendering loop: lines 265–310 — renders all CHIPS with active/inactive styles, `aria-pressed`, `.press` class

**Steps:**
1. Open https://staging.nammadaari.com/map on desktop Chrome.
2. Confirm the top chip row (row 1) is visible above the map: "All · N", "Damaged · N", "Blocked · N", "No path · N", "Crossing · N", "Lighting · N", "Other · N".
3. Tap/click "Damaged". Confirm the chip becomes active (dark background) and the map pins update to show only damaged footpath reports.
4. Tap/click "All". Confirm all pins return and the active state resets.
5. On iOS Safari: repeat steps 2–4. Confirm chips scroll horizontally without clipping.

**Expected result:** All 7 category chips are present, counts are non-zero (or zero for empty categories), tapping a chip filters the map, tapping "All" resets the filter.

**Result:** ___________

---

### TRIAGE-03 — Public map status chips

**Intent:** Public `/map` provides filter chips for report status (open, in progress, resolved).
**Environment:** Desktop Chrome + iOS Safari on https://staging.nammadaari.com/map
**Type:** Manual

**Steps:**
1. Open https://staging.nammadaari.com/map on desktop Chrome.
2. Confirm a second chip row (row 2) is visible below the category chips: "All statuses · N", "● Open · N", "● In progress · N", "● Resolved · N" where ● is a colored dot (red / amber / green respectively).
3. Tap "Open". Confirm the map shows only open/acknowledged/assigned reports.
4. Tap "In progress". Confirm the map switches to show only in-progress reports.
5. Tap "Resolved". Confirm the map shows only resolved/closed reports.
6. Tap "All statuses". Confirm all reports return.
7. With "Damaged" chip active (row 1) AND "Resolved" chip active (row 2): confirm the map shows only reports that are BOTH damaged AND resolved (AND logic).
8. On iOS Safari: repeat steps 2–6. Confirm the status chip row scrolls horizontally.

**Expected result:** 4 status chips present with colored dots; each filters the map correctly; AND logic applies when both category and status are selected; chip row scrolls horizontally on mobile.

**Result:** ___________

---

### TRIAGE-04 — Ward boundary overlay

**Intent:** Public `/map` displays a toggleable ward boundary polygon overlay.
**Environment:** Desktop Chrome + iOS Safari on https://staging.nammadaari.com/map
**Type:** Manual (HTTPS required for stable map tile loading)

**Steps:**
1. Open https://staging.nammadaari.com/map on desktop Chrome.
2. Confirm a ward toggle button (52×52px, grid icon + "WARDS" label) is visible bottom-right of the map, above the "Report here" FAB.
3. Tap the ward toggle button. Confirm a brief "loading" state (button fades to 50% opacity) before the overlay loads.
4. Confirm teal ward boundary outlines appear across the map (stroke-only, no fill).
5. Confirm "Ward boundaries · 369 wards" banner appears near the top of the map.
6. Confirm the toggle button changes to active state (teal/accent background, white icon).
7. Hover over a ward polygon (desktop) — confirm a tooltip appears showing the ward name.
8. Tap the ward toggle button again. Confirm the boundaries disappear and the button returns to OFF state.
9. Tap the toggle again (second activation). Confirm the overlay returns immediately without a new loading delay (GeoJSON cached).
10. On iOS Safari: repeat steps 3–8. Tap a ward polygon — confirm a popup showing the ward name appears.

**Expected result:** Ward toggle button present; tapping loads teal boundary outlines; banner shows "Ward boundaries · 369 wards"; ward name shown on hover/tap; re-toggle hides/shows overlay; second activation uses cached GeoJSON.

**Result:** ___________

---

### TRIAGE-05 — Before/after resolution photo on public report detail

**Intent:** Public report detail page shows the resolution photo alongside the original when admin has uploaded one.
**Environment:** Desktop Chrome + iOS Safari on https://staging.nammadaari.com/reports/[id]
**Type:** Manual

**Steps (report WITH resolution photo):**
1. Find an admin-resolved report that has a resolution photo uploaded (check admin portal for a report with status "Resolved" + resolution photo). Note the report ID.
2. Open https://staging.nammadaari.com/reports/[id] on desktop Chrome (not logged in as admin — public view).
3. Confirm two photos are displayed side-by-side (desktop ≥768px): left labeled "Before" with sub-label "DD MMM · CITIZEN", right labeled "After" with sub-label "DD MMM · [CORP_NAME]".
4. Confirm the "After" photo has a floating "RESOLUTION" badge (green/teal pill, top-left corner).
5. On iOS Safari (mobile <768px): open the same report URL. Confirm the photos are stacked vertically (Before on top, After below).

**Steps (report WITHOUT resolution photo):**
6. Find an open/unresolved report. Open its public detail page.
7. Confirm only a single photo is displayed, labeled "Photo" (NOT "Before").
8. Confirm there is no empty "After" slot or placeholder.

**Expected result:** Resolved report with resolution photo shows Before/After layout with RESOLUTION badge; unresolved report shows single "Photo" label with no empty slot.

**Result:** ___________

---

### MOB-01 — Ops page content visible above bottom nav (iOS Safari)

**Intent:** Admin ops page scrolls fully past the bottom nav without content clipping.
**Environment:** iOS Safari on https://staging.nammadaari.com/admin
**Type:** Manual (HTTPS + iOS Safari required)

**Steps:**
1. Log in to admin portal on iOS Safari.
2. Navigate to the Ops/Dashboard page (`/admin`).
3. Scroll to the bottom of the page content.
4. Confirm the last item on the page is fully visible above the bottom navigation bar (not hidden behind it).
5. Confirm there is no rubber-banding back to the top during scroll.

**Expected result:** All ops page content scrolls fully into view above the bottom nav; no content clipping at the bottom.

**Result:** ___________

---

### MOB-02 — Queue page content visible above bottom nav (iOS Safari)

**Intent:** Admin reports queue page scrolls fully past the bottom nav without content clipping.
**Environment:** iOS Safari on https://staging.nammadaari.com/admin/reports
**Type:** Manual (HTTPS + iOS Safari required)

**Steps:**
1. Navigate to the Reports queue page (`/admin/reports`) on iOS Safari.
2. Scroll to the bottom of the report list.
3. Confirm the last report card is fully visible above the bottom navigation bar.
4. Confirm tapping "Load more" (if present) works and newly loaded items are visible.

**Expected result:** Report queue scrolls fully into view; bottom report not hidden behind nav bar.

**Result:** ___________

---

### MOB-03 — Analytics chart data lines render (iOS Safari)

**Intent:** Admin analytics page renders chart data lines correctly, not a blank chart.
**Environment:** iOS Safari on https://staging.nammadaari.com/admin/analytics
**Type:** Manual (iOS Safari required — Recharts container sizing issue is Safari-specific)

**Steps:**
1. Navigate to the Analytics page (`/admin/analytics`) on iOS Safari.
2. Confirm the chart area renders visible data lines (not a blank rectangle).
3. Scroll to confirm the chart container is not cut off or hidden.

**Expected result:** Chart renders data lines visibly on iOS Safari; no blank chart area.

**Result:** ___________

---

### MOB-04 — Analytics chart legend shows category names (iOS Safari)

**Intent:** Analytics chart legend shows human-readable category names, not raw enum strings.
**Environment:** iOS Safari on https://staging.nammadaari.com/admin/analytics
**Type:** Manual (iOS Safari required)

**Steps:**
1. Navigate to the Analytics page (`/admin/analytics`) on iOS Safari.
2. Locate the chart legend.
3. Confirm legend labels read as human-readable names (e.g., "Damaged footpath", "Blocked footpath", "Unsafe crossing") — NOT raw enum strings (e.g., "broken_footpath", "blocked_footpath", "unsafe_crossing").

**Expected result:** Chart legend shows human-readable category names throughout.

**Result:** ___________

---

### MOB-05 — Choropleth map is visible (admin analytics, iOS Safari)

**Intent:** Admin analytics choropleth map is visible and fully rendered on iOS Safari.
**Environment:** iOS Safari on https://staging.nammadaari.com/admin/analytics
**Type:** Manual (iOS Safari required)

**Steps:**
1. Navigate to the Analytics page (`/admin/analytics`) on iOS Safari.
2. Scroll to the choropleth map section.
3. Confirm the choropleth map has an explicit visible height and renders the ward color blocks (not a blank/invisible container).
4. Confirm no console-level GeoJSON error causes a blank map (check by visual presence of colored ward regions).

**Expected result:** Choropleth map is visible with explicit container height and colored ward regions; not a blank rectangle.

**Result:** ___________

---

### MOB-06 — Choropleth handles null GeoJSON gracefully (no crash)

**Intent:** Choropleth map handles null or missing GeoJSON without crashing or showing an error.
**Environment:** Desktop Chrome DevTools (simulate GeoJSON failure by throttling network to offline briefly during analytics load), then iOS Safari
**Type:** Manual

**Steps:**
1. On desktop Chrome: open DevTools → Network → set to "Offline" before navigating to `/admin/analytics`.
2. Navigate to the Analytics page.
3. Confirm the choropleth map section shows a graceful fallback (blank map or empty container) — NOT a JavaScript error or white screen of death.
4. Re-enable network. Navigate to `/admin/analytics` normally on iOS Safari.
5. Confirm the choropleth renders correctly with network available.

**Expected result:** Null/missing GeoJSON does not crash the page; the choropleth renders correctly when GeoJSON is available.

**Result:** ___________

---

### MOB-07 — Admin /map Leaflet controls visible above bottom nav (iOS Safari)

**Intent:** Admin map page Leaflet attribution and any overlay controls are visible above the bottom nav bar.
**Environment:** iOS Safari on https://staging.nammadaari.com/admin/map (or equivalent admin map view)
**Type:** Manual (HTTPS + iOS Safari required)

**Steps:**
1. Navigate to the admin map view (`/admin/map`) on iOS Safari.
2. Scroll to the bottom area of the map.
3. Confirm the Leaflet attribution text ("Leaflet | © OpenStreetMap") is visible above the bottom nav bar — not hidden behind it.
4. Confirm any map overlay controls (zoom buttons, layer toggles) are accessible and not obstructed by the nav bar.

**Expected result:** Leaflet attribution and controls are offset above the bottom nav (56px + safe-area-inset-bottom); nothing hidden behind the nav.

**Result:** ___________

---

### TEST-01 — Backend bake_orientation unit test (automated)

**Intent:** `bake_orientation` function correctly rotates EXIF orientation=6 JPEG to upright portrait dimensions (3024×4032).
**Environment:** Terminal / CI — automated test (already green from Plan 03)
**Type:** Automated (run command; no browser required)

**Command to run:**
```bash
cd /path/to/bengaluru-walkability-public-audit/backend
cargo test bake_orientation_6
```

**Expected result:**
```
running 2 tests
test handlers::reports::bake_orientation_tests::bake_orientation_6_swaps_width_height ... ok
test handlers::reports::bake_orientation_tests::bake_orientation_6_iphone_portrait_dimensions ... ok

test result: ok. 2 passed; 0 failed
```

**Steps:**
1. Run `cargo test bake_orientation_6` in the `backend/` directory.
2. Confirm both tests pass with exit code 0.

**Result:** ___________

---

## Sign-off Summary

| Req ID | Intent (one-liner) | Environment | Result |
|--------|--------------------|-------------|--------|
| TRIAGE-01 | Admin corp/ward filter narrows report queue | Desktop + iOS Safari | ___ |
| TRIAGE-02 | Category chips present on public /map (smoke-verify) | Desktop + iOS Safari | ___ |
| TRIAGE-03 | Status chips filter public /map reports | Desktop + iOS Safari | ___ |
| TRIAGE-04 | Ward boundary overlay toggleable on /map | Desktop + iOS Safari | ___ |
| TRIAGE-05 | Before/After photo on resolved public report | Desktop + iOS Safari | ___ |
| MOB-01 | Ops page scrolls past bottom nav (no clipping) | iOS Safari | ___ |
| MOB-02 | Queue page scrolls past bottom nav (no clipping) | iOS Safari | ___ |
| MOB-03 | Analytics chart data lines render on iOS Safari | iOS Safari | ___ |
| MOB-04 | Analytics chart legend shows readable names | iOS Safari | ___ |
| MOB-05 | Choropleth map visible with explicit height | iOS Safari | ___ |
| MOB-06 | Choropleth handles null GeoJSON without crash | Chrome DevTools + iOS | ___ |
| MOB-07 | Admin /map Leaflet controls above bottom nav | iOS Safari | ___ |
| TEST-01 | `cargo test bake_orientation_6` passes (automated) | Terminal | ___ |

---

## TRIAGE-02 Implementation Evidence

TRIAGE-02 is already implemented and was NOT modified by this plan. Evidence recorded below for audit purposes.

**File:** `frontend/app/map/page.tsx`

| Evidence | Location |
|----------|----------|
| `CHIPS` array (7 category values) | Lines 15–23 |
| `chipLabel` helper (formats "Label · N" with live count) | Lines 47–58 |
| Category chip rendering loop (`CHIPS.map(...)`) | Lines 265–310 |
| `role="toolbar"`, `aria-label="Filter by category"` | Line 249–252 |
| Active/inactive chip styles matching D-08 spec | Lines 276–309 |

No code was added, removed, or modified in `map/page.tsx` to satisfy TRIAGE-02. The implementation was present and correct prior to Plan 08.
