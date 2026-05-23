---
slug: uat-iphone-design-gaps-2
status: resolved
trigger: "iPhone 16 Pro Max UAT on staging-walkability.kinariwala.com — 5 gaps vs design document found 2026-04-25"
created: 2026-04-25
updated: 2026-05-23
---

## Symptoms

- **Expected:** All screens match the design reference in `design-ref/` strictly.
- **Actual:** Five deviations from design found during live UAT test.
- **Errors:** None — all are silent UI gaps.
- **Timeline:** Introduced during Phase 02.3.1 UI redesign; design-ref is the canonical source of truth.
- **Reproduction:** Walk through report flow on staging-walkability.kinariwala.com on mobile.

## Current Focus

hypothesis: "Root causes are all fully understood from design-ref comparison and code review. BUG-1=hardcoded '412' on homepage; BUG-2=missing Retake button in category step; BUG-3=category confirm card missing Kannada name + timestamp; BUG-4=ward display is plain text not styled card, and no near-road; BUG-5=SuccessCard missing ward+near."
test: "Read design-ref/screens-confirm.jsx, design-ref/screen-category.jsx, frontend/app/report/page.tsx, frontend/app/components/redesign/SuccessCard.tsx"
expecting: "All five bugs confirmed from code inspection"
next_action: "Implement all five fixes on a feature branch and commit"

## Bug Detail

### BUG-1 (STATIC): Homepage hardcoded "412 reports"
- File: `frontend/app/page.tsx:175`
- Root cause: `<span className="mono">412</span>` is hardcoded — never fetches real count.
- Fix:
  - Backend: add `total` field to `list_reports` response via `SELECT COUNT(*) FROM reports`.
  - Frontend: fetch `/api/reports?limit=1` on page load, display `total` with a fallback.
  - The home page is a Server Component (Next.js App Router) so this can be a server-side fetch.

### BUG-2 (MISSING): No "Retake" button in Photo Ready strip (category step)
- File: `frontend/app/report/page.tsx:649-650`
- Design: `design-ref/screen-category.jsx:46-48` — small button with "Retake" text, right-aligned in photo strip.
- Root cause: No Retake button rendered; the photo strip ends after the GPS pill.
- Fix: Add `<button onClick={resetAll}>Retake</button>` aligned to right of photo strip.
  - `resetAll()` already exists and brings user back to photo step.

### BUG-3 (MISSING): Confirm step review card — missing Kannada category name and photo timestamp
- File: `frontend/app/report/page.tsx:793-798`
- Design: `design-ref/screens-confirm.jsx:37-43`
  - Category shows `<Bi en={activeCat?.en} kn={activeCat?.kn} />` (both languages)
  - Below category: `{new Date().toLocaleTimeString()} · Just now`
- Root cause:
  - Line 796: `{getCategoryLabel(form.category).en}` — English only, no `<Bi>` component.
  - No timestamp field stored in form state, so nothing to display.
- Fix:
  - Change line 796 to use `<Bi en={...} kn={...} />`.
  - Add `photoTime: Date | null` to `FormState`; populate it when photo is processed in `handleFile`.
  - Display `{photoTime.toLocaleTimeString()} · Just now` in review card.
  - EXIF provides `DateTimeOriginal` via `exifr.parse(file, { DateTimeOriginal: true })`.

### BUG-4 (DESIGN): Ward display is unstyled plain text; missing "Near" road
- File: `frontend/app/report/page.tsx:886-897`
- Design: `design-ref/screens-confirm.jsx:76-91`
  - Full card: "GBA" badge (font-mono, surface-2 bg), ward number+name (bold), "Auto-detected" subtitle, check_circle icon.
  - Below card: "Near {road}, {suburb}" as `fontSize: 12, color: var(--ink-2)`.
- Root cause:
  - Ward label rendered as plain `<div style={{ fontSize: 12 }}>{wardLabel}</div>`.
  - No reverse geocoding call for nearby road — the `wardLabel` state exists but near-road does not.
- Fix:
  - Replace the plain ward label div with the full GBA card component matching the design.
  - Add `nearRoad: string | null` to state.
  - After GPS is confirmed, call Nominatim reverse geocoding:
    `https://nominatim.openstreetmap.org/reverse?lat=LAT&lon=LNG&format=json`
  - Extract `address.road ?? address.suburb ?? address.neighbourhood` as the near-road label.
  - Display below the ward card: `Near {nearRoad}` if available.

### BUG-5 (MISSING): SuccessCard missing ward + near info
- Files:
  - `frontend/app/report/page.tsx:359-365` — renders `<SuccessCard>` without `wardLabel` or `nearRoad` props
  - `frontend/app/components/redesign/SuccessCard.tsx` — has `locationLabel` prop but no ward row
- Design: `design-ref/screens-confirm.jsx:191-200`
  - "Near" column in the status/near 2-col grid: shows nearby road
  - Bottom row in report ID card: "GBA" badge + "Ward N · Name" + "Auto-routed" label
- Fix:
  - Pass `wardLabel` and `nearRoad` from `report/page.tsx` to `SuccessCard`.
  - Add `wardLabel?: string` prop to `SuccessCard`.
  - Use existing `locationLabel` prop for the "Near" field (pass `nearRoad` as `locationLabel`).
  - Add a third dashed section below the status/near grid for the GBA ward row.

## Evidence

- timestamp: code-review-2026-04-25
  observation: "frontend/app/page.tsx:175 — `<span className=\"mono\">412</span>` hardcoded, no fetch"
  supports: BUG-1

- timestamp: code-review-2026-04-25
  observation: "report/page.tsx:649-650 — photo strip ends at GPS pill; no Retake button"
  supports: BUG-2

- timestamp: code-review-2026-04-25
  observation: "report/page.tsx:796 — `getCategoryLabel(form.category).en` English-only; no timestamp in FormState"
  supports: BUG-3

- timestamp: code-review-2026-04-25
  observation: "report/page.tsx:886-897 — wardLabel as plain `<div style={{ fontSize: 12 }}>`, no GBA card, no near-road state"
  supports: BUG-4

- timestamp: code-review-2026-04-25
  observation: "report/page.tsx:359-365 — SuccessCard receives only `reportId` and callbacks; wardLabel not passed"
  supports: BUG-5

- timestamp: screenshot-IMG_4312
  observation: "Homepage shows '412 reports' pill — static number"
  supports: BUG-1

- timestamp: screenshot-IMG_4315
  observation: "Category step: photo strip has GPS pill, no Retake button"
  supports: BUG-2

- timestamp: screenshot-IMG_4317
  observation: "Confirm step: review card shows 'No Footpath' in English only, no timestamp"
  supports: BUG-3

- timestamp: screenshot-IMG_4318
  observation: "Confirm step shows 'Ward 36 · Maruthi Seva Nagara' as plain text below coordinates; no GBA badge, no auto-detected, no near road"
  supports: BUG-4

- timestamp: screenshot-IMG_4320
  observation: "SuccessCard: Report ID card shows only Status+Submitted; no ward, no near field populated"
  supports: BUG-5

## Eliminated

(none)

## Resolution

root_cause: "All five bugs confirmed from code review: BUG-1=hardcoded '412' on homepage; BUG-2=missing Retake button in category step; BUG-3=category confirm card showing English-only label + no timestamp; BUG-4=ward display as plain text div, no GBA badge, no Nominatim near-road; BUG-5=SuccessCard not receiving wardLabel or locationLabel props."
fix: "BUG-1: Dynamic reportTotal fetched server-side from /api/reports; plural logic added (=== 1 ? 'report' : 'reports'). BUG-2: Retake button added at report/page.tsx:696-712, calls resetAll(). BUG-3: <Bi en kn> used at line 865-867; photoTime extracted from EXIF DateTimeOriginal and displayed at 873-882. BUG-4: GBA card component at line 978-1042; nearRoad state added, Nominatim reverse geocode called after GPS confirm; Near {nearRoad} displayed. BUG-5: wardLabel and locationLabel (nearRoad) props passed to SuccessCard at page.tsx:418-419; SuccessCard updated to render both."
verification: "All fixes confirmed via code inspection 2026-05-23. 764 frontend unit tests pass (npm test — exit 0)."
files_changed:
  - frontend/app/page.tsx
  - frontend/app/report/page.tsx
  - frontend/app/components/redesign/SuccessCard.tsx
