---
phase: 07-admin-triage-ux-public-map
plan: 10
subsystem: frontend/admin
tags: [mobile, layout, nav-clearance, compact-rows, gap-closure]
status: complete

dependency_graph:
  requires: [07-07]
  provides: [MOB-01-refix, MOB-02-refix]
  affects: [frontend/app/admin/admin.css, frontend/app/admin/components/ReportsTable.tsx]

tech_stack:
  added: []
  patterns:
    - "76px admin-safe-bottom = 67px actual nav height + 9px buffer"
    - "CompactRow 2-row deterministic layout (photo | column[row1, row2])"
    - "env(safe-area-inset-bottom, 0px) explicit fallback for non-viewport-fit Safari"

key_files:
  created: []
  modified:
    - frontend/app/admin/admin.css
    - frontend/app/admin/components/ReportsTable.tsx

decisions:
  - "Increased admin-safe-bottom from 56px to 76px: actual rendered nav is ~67px (8+44+14+1), not the 56px from UI-SPEC"
  - "CompactRow restructured to photo+column layout with two deterministic rows — badges and buttons never wrap on 375px mobile"
  - "DupeExpandButton and StatusBadge do not accept style prop — left without flexShrink:0; they are in flex rows alongside flex:1 elements so they naturally do not expand"

metrics:
  duration: "~25 minutes"
  completed_at: "2026-06-23T18:44:07Z"
  tasks_total: 3
  tasks_completed: 3
  files_modified: 2
---

# Phase 07 Plan 10: Mobile Nav Clearance + CompactRow Layout Re-fix Summary

Gap closure for MOB-01 and MOB-02 UAT failures not fully resolved by Plan 07-07 — 76px bottom padding and 2-row CompactRow replacing flexWrap layout.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Increase admin-safe-bottom padding to 76px | edd4ba9 | frontend/app/admin/admin.css |
| 2 | Restructure CompactRow to 2-row mobile-safe layout | e98f265 | frontend/app/admin/components/ReportsTable.tsx |
| 3 | Verify build and lint clean | (no files — verification only) | — |

## What Was Built

**Task 1 — admin-safe-bottom padding (MOB-01/02 re-fix):**

Plan 07-07 used 56px as the bottom nav height, sourced from UI-SPEC. The actual rendered nav is ~67px (8px top padding + 44px content + 14px bottom padding + 1px border). Without `viewport-fit:cover` in the page metadata, `env(safe-area-inset-bottom)` returns 0 on iOS Safari — making the effective padding only 56px. With a 67px nav, 11px of the last content item was hidden.

Fix: `padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px))` — 67px nav + 9px visible buffer + explicit `0px` fallback.

**Task 2 — CompactRow 2-row layout (MOB-02 re-fix):**

The old CompactRow used `flexWrap: "wrap"` on a single row containing the photo, info column, badge group, and action buttons. On 375px mobile, these wrapped to a second line in an uncontrolled way — badges overlapped text, action buttons wrapped independently.

Fix: restructured to `photo (flexShrink:0) | right column (flexDirection:column)` where:
- Row 1: `category name (flex:1, truncate) | SeverityIndicator | StatusBadge`
- Row 2: `ID·ward·time meta (flex:1, truncate) | DupeExpandButton | Status btn | Delete btn`

No wrapping occurs — all items fit within their designated row. The DuplicateSubTable expansion block below the clickable row was not modified.

## Verification Results

| Check | Result |
|-------|--------|
| `grep "76px" admin.css` | Match on admin-safe-bottom line |
| Old `56px` in admin-safe-bottom | Removed |
| `grep -c "flexWrap.*wrap" ReportsTable.tsx` | 1 (CardStreamRow only — CompactRow has 0) |
| `flexDirection: "column"` in CompactRow right column | Present |
| `npm run lint` | PASS — no ESLint warnings or errors |
| `npm run build` | PASS — all 16 routes compiled successfully |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed invalid style prop from StatusBadge and DupeExpandButton**
- **Found during:** Task 2 — TypeScript interface check
- **Issue:** Plan's implementation spec suggested adding `style={{ flexShrink: 0 }}` to all child elements including `StatusBadge` and `DupeExpandButton`. However, `StatusBadge`'s TypeScript interface does not include a `style` prop, and `DupeExpandButton` is an internal function component with no `style` prop. Adding these would cause TypeScript compilation errors.
- **Fix:** Removed `style={{ flexShrink: 0 }}` from `StatusBadge` and `DupeExpandButton`. Both components are inside flex rows with a `flex: 1` sibling that absorbs all available space — they naturally do not expand without explicit `flexShrink: 0`. The `SeverityIndicator` component does accept `style` and retains it.
- **Files modified:** frontend/app/admin/components/ReportsTable.tsx
- **Commit:** e98f265

## Known Stubs

None — this plan addresses layout/CSS fixes only. No data or UI stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- frontend/app/admin/admin.css: FOUND — contains `76px` in admin-safe-bottom rule
- frontend/app/admin/components/ReportsTable.tsx: FOUND — contains `flexDirection: "column"` in CompactRow
- Commit edd4ba9: FOUND — admin-safe-bottom fix
- Commit e98f265: FOUND — CompactRow 2-row layout
