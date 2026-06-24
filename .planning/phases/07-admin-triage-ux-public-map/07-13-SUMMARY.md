---
phase: 07-admin-triage-ux-public-map
plan: 13
subsystem: frontend/analytics
status: complete
tags: [mob-03, recharts, trenChart, mobile, fix, tdd]
requirements: [MOB-03]

dependency_graph:
  requires: []
  provides: [MOB-03-fix]
  affects: [frontend/app/admin/components/TrendChart.tsx, frontend/app/admin/analytics/page.tsx]

tech_stack:
  added: []
  patterns: [useRef+ResizeObserver measured width, conditional render on width>0]

key_files:
  created:
    - frontend/app/admin/components/__tests__/TrendChart.test.tsx
  modified:
    - frontend/app/admin/components/TrendChart.tsx

decisions:
  - "TrendChart now uses useRef+ResizeObserver+useState to measure container width; LineChart renders only when width>0 so Recharts always has concrete geometry on first paint"
  - "Tests assert on recharts-legend-item and recharts-legend-icon DOM elements (not recharts-line-curve paths) because jsdom provides no layout height so the clip-rect has height=0 and line paths are not rendered in jsdom"
  - "Pre-existing test failures (22 tests in 4 suites: page.dedup, reports-page, reports/[id], reports/map) confirmed pre-existing — not introduced by this plan"

metrics:
  duration: 6m
  completed_date: "2026-06-24T06:50:34Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 07 Plan 13: TrendChart Measured-Width Fix (MOB-03 re-fix) Summary

**One-liner:** Replaced the deferred-measurement wrapper in TrendChart with useRef + ResizeObserver → React state so Recharts always receives a concrete pixel width on first render, computing SVG line paths synchronously (MOB-03 re-fix).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD-RED) | Add failing TrendChart tests | e8fa0a9 | frontend/app/admin/components/__tests__/TrendChart.test.tsx |
| 1 (TDD-GREEN) | Implement measured-width TrendChart | 4d61f52 | TrendChart.tsx + test updates |
| 2 | Lint, build, test suite verification | b5b8f1f | (no file changes — verification) |

## What Was Built

### TrendChart.tsx — measured explicit width (MOB-03 re-fix)

**Root cause confirmed:** The previous approach (`07-09`) replaced the sizing wrapper but still wrapped LineChart inside it. On mobile (and Chrome simulated mobile) the container's measured width arrives as 0 after first paint, so Recharts computes each Line's SVG path `d` against a zero width — the path geometry is empty, leaving only the static grid/axes visible. `isAnimationActive={false}` cannot fix this because the geometry itself is never computed.

**Fix:** TrendChart now:
1. Attaches `containerRef = useRef<HTMLDivElement>(null)` to the outer wrapper div
2. Measures `containerRef.current.getBoundingClientRect().width` (fallback to `clientWidth`) synchronously on mount
3. Subscribes to width changes via `ResizeObserver` (handles orientation change, viewport resize)
4. Stores measured width in `const [width, setWidth] = useState(0)` 
5. Renders `<LineChart data={chartData} width={width} height={300}>` only when `width > 0`

With a concrete numeric `width`, Recharts computes the line `d` path synchronously on render — the colored lines paint immediately on first load without any interaction.

**Preserved (MOB-04):** Tooltip `formatter={(value, name) => [value, getCategoryLabel(String(name)).en]}`, Legend `formatter` via `getCategoryLabel`, all `CATEGORY_COLORS` strokes, `strokeWidth={2}`, `isAnimationActive={false}`, `dot={false}`, legend click toggle.

### TrendChart.test.tsx — 8 unit tests

Tests stub `ResizeObserver` and `getBoundingClientRect` to inject width=600 in jsdom, then assert:
- `recharts-wrapper` exists with positive width (LineChart rendered)
- Legend items count matches category count (one Line per category)
- Legend icons carry non-empty hex stroke colors from CATEGORY_COLORS
- `recharts-responsive-container` class is absent (deferred-measurement wrapper removed)
- MOB-04: legend/tooltip label formatting via getCategoryLabel preserved
- Empty data renders without crashing

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `grep -c "ResponsiveContainer" TrendChart.tsx` returns 0 | 0 |
| `grep -c "useRef" TrendChart.tsx` returns >= 1 | 2 |
| `grep -c "ResizeObserver" TrendChart.tsx` returns >= 1 | 4 |
| `grep -c "width={width}" TrendChart.tsx` returns >= 1 | 2 |
| `grep -c "getCategoryLabel" TrendChart.tsx` returns >= 2 | 4 |
| `npx jest TrendChart.test.tsx` exits 0 | 8/8 PASS |
| `npm run lint` exits 0 | PASS |
| `npm run build` exits 0 | PASS (16 routes) |
| No regressions in existing tests | CONFIRMED (22 pre-existing failures unchanged) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertions adapted for jsdom SVG rendering limitations**
- **Found during:** Task 1 GREEN phase
- **Issue:** Tests initially asserted on `.recharts-line-curve` CSS selector. In jsdom, recharts 3.8.1 renders SVG paths with zero height in the clip-rect (`<rect height="0">`) because jsdom provides no layout engine — so line-curve paths are never painted even though the LineChart renders with a positive width.
- **Fix:** Updated assertions to use `.recharts-legend-item` (count = lines declared) and `.recharts-legend-icon` (stroke color verification) — both are rendered by recharts regardless of layout height. Also added `await act(async () => {})` to flush the useEffect that sets width state.
- **Files modified:** `frontend/app/admin/components/__tests__/TrendChart.test.tsx`
- **Commit:** 4d61f52 (included in GREEN commit)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (failing tests) | e8fa0a9 | PASS — 6 of 8 tests failing before implementation |
| GREEN (implementation) | 4d61f52 | PASS — 8 of 8 tests passing after implementation |
| REFACTOR | n/a | No refactor needed |

## Known Stubs

None — implementation is complete. The measured-width fix is wired to the real container DOM node.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. This is a pure client-side rendering fix in an admin-only component.

## Self-Check: PASSED

- [x] `frontend/app/admin/components/TrendChart.tsx` exists and has `useRef`, `ResizeObserver`, `width={width}`
- [x] `frontend/app/admin/components/__tests__/TrendChart.test.tsx` exists with 8 tests
- [x] Commits e8fa0a9, 4d61f52, b5b8f1f exist in git log
- [x] `grep -c "ResponsiveContainer" TrendChart.tsx` = 0

## Checkpoint: Human Verify Required

Human visual verification needed before plan can be marked complete. See checkpoint task in PLAN.md for exact steps.
