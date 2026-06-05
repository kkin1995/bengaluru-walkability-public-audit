# Phase 5: UAT Stabilisation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05T07:17:13Z
**Phase:** 05-uat-stabilisation
**Areas discussed:** Photo URL (FIX-01), Leaflet iOS Safari (FIX-04/05), EXIF orientation baking (FIX-06), Status history dedup (FIX-07), Deprecated routes (FIX-02/03), Today counter (FIX-08), GPS precision (FIX-10), Location source (FIX-13), iOS scroll (FIX-09), Build hash (FIX-11), Ward label (FIX-12)

---

## Photo URL (FIX-01)

### Where should the fix live?

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend-only patch | Fix how the public reports/[id] page constructs the image src using NEXT_PUBLIC_API_URL/uploads/... | ✓ |
| Backend API fix + frontend cleanup | Change public reports API to return image_url consistently, then update frontend | |
| Nginx investigation first | Check nginx auth-gating before touching code | |

**User's choice:** Frontend-only patch
**Notes:** Keep it minimal. Don't resolve the image_url vs image_path tech debt in this phase.

### URL base to use?

| Option | Description | Selected |
|--------|-------------|----------|
| NEXT_PUBLIC_API_URL + /uploads/filename | Use established config.ts pattern | ✓ |
| Relative /uploads/filename via Next.js rewrite | Add rewrite rule | |
| You decide | Claude picks based on admin portal pattern | |

### Verify nginx?

| Option | Description | Selected |
|--------|-------------|----------|
| Verify nginx too | Read nginx.conf to confirm /uploads/ has no auth guard | ✓ |
| Frontend only, skip nginx check | Trust admin photos work so nginx isn't the issue | |

---

## Leaflet iOS Safari (FIX-04, FIX-05)

### Primary investigation approach?

| Option | Description | Selected |
|--------|-------------|----------|
| CSP header audit first | Confirm tile.openstreetmap.org in CSP img-src/connect-src | ✓ |
| Force map resize on mount | map.invalidateSize() after container mounts | |
| Switch tile provider to CartoDB | Avoid CSP changes entirely | |

### Fallback if CSP doesn't fully resolve?

| Option | Description | Selected |
|--------|-------------|----------|
| Also add map.invalidateSize() | Belt-and-suspenders: CSP + resize | ✓ |
| Switch tile provider | CartoDB as second attempt | |
| You decide | Claude determines based on code inspection | |

### Scope — which map components?

| Option | Description | Selected |
|--------|-------------|----------|
| All Leaflet components | CSP change is global; apply invalidateSize everywhere | ✓ |
| Only confirmed broken ones | LocationMap.tsx + admin detail map only | |

---

## EXIF Orientation Baking (FIX-06)

### Which Rust approach?

| Option | Description | Selected |
|--------|-------------|----------|
| img-parts (read tag) + image crate (rotate) | img-parts already in Cargo.toml; add image crate | ✓ |
| kamadak-exif + image crate | More precise EXIF parsing | |
| You decide | Claude picks after reading reports.rs | |

### JPEG re-encode quality?

| Option | Description | Selected |
|--------|-------------|----------|
| 85% JPEG quality | Standard lossy, minimal visible loss | ✓ |
| 95% JPEG quality | Near-lossless, larger files | |
| You decide | Claude picks based on typical mobile photo sizes | |

### Scope — existing photos?

| Option | Description | Selected |
|--------|-------------|----------|
| New uploads only | No bulk migration | ✓ |
| New uploads + one-time migration script | Re-process all existing photos | |

---

## Status History Dedup (FIX-07)

### Fix approach?

| Option | Description | Selected |
|--------|-------------|----------|
| Filter Acknowledged from public query | Full audit trail preserved internally; public query hides Acknowledged | ✓ |
| Don't write status_history on Acknowledge | Simpler but loses acknowledge timestamp | |

### Apply filter in admin portal too?

| Option | Description | Selected |
|--------|-------------|----------|
| Public page only — admin sees full history | Admin keeps full timeline for triage accountability | ✓ |
| Both public and admin filter Acknowledged | Consistent but loses admin accountability | |

---

## Deprecated Routes (FIX-02 + FIX-03)

### What to do with deprecated /report and /reports after updating links?

| Option | Description | Selected |
|--------|-------------|----------|
| Add 301 redirect to / for both | Existing bookmarks still work | ✓ |
| Leave deprecated routes as-is | Just fix the two links | |
| Remove deprecated routes entirely | Delete pages — breaks any external links | |

---

## Today Counter (FIX-08)

### Backend or frontend fix?

| Option | Description | Selected |
|--------|-------------|----------|
| Backend query fix | Change SQL in admin_queries.rs to COUNT WHERE created_at::date = CURRENT_DATE | ✓ |
| Frontend display fix | Recalculate from full reports list | |

---

## GPS Precision (FIX-10)

### Fix scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Display fix + verify DB precision | Round JS display + grep backend for existing rounding | ✓ |
| Display fix only, trust the backend | Change only frontend formatting | |

---

## Location Source Labels (FIX-13)

### Where does the fix live?

**User's free-text response:** "The label needs to reflect where the app actually got the location from clearly and unambiguously both in the frontend and in the backend"

**Follow-up — migrate existing rows?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — migrate existing rows + backend code + frontend | Full fix: canonical values everywhere | ✓ |
| Change backend code + frontend only; leave historical | New submissions correct, old stay as MANUAL_PIN | |

**Notes:** User wants full canonical accuracy in storage and display. Migration 015 renames MANUAL_PIN → GPS_API for all existing rows.

---

## iOS Scroll (FIX-09)

### CSS approach?

| Option | Description | Selected |
|--------|-------------|----------|
| Audit container CSS + fix overflow | overflow-y: auto, no fixed height, no overscroll-behavior conflicts | ✓ |
| Add -webkit-overflow-scrolling: touch | Deprecated property | |
| You decide | Claude inspects dashboard CSS | |

---

## Build Hash (FIX-11)

### Where to inject NEXT_PUBLIC_BUILD_HASH?

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions workflow env var | git rev-parse --short HEAD in deploy.yml | ✓ |
| Vercel project settings | Static hash, doesn't update per deployment | |
| Both — CI injects, Vercel as fallback | More complex | |

---

## Ward Label (FIX-12)

### Scope of the standardisation?

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + standardize all citizen-facing screens | Grep and replace all occurrences of "Auto-routed" | ✓ |
| Fix only the confirmation screen | Minimal change | |

---

## Claude's Discretion

None — all areas were decided by the user.

## Deferred Ideas

- Dedup job `closed` status exclusion (WARNING-01) — deferred to v1.2 per REQUIREMENTS.md
- AdminReport.image_url vs image_path type mismatch — deferred; Phase 5 works around it without resolving it
- Bulk re-encode of existing rotated photos — deferred; too few live reports to justify risk
