---
phase: 07-admin-triage-ux-public-map
plan: "04"
subsystem: frontend/admin
tags: [triage, filter-bar, ward-select, corp-select, admin-ui, TRIAGE-01]
status: complete

dependency_graph:
  requires:
    - "07-01 (corp/ward backend endpoints: GET /api/admin/corporations, GET /api/admin/wards)"
  provides:
    - "Corp select + searchable ward popover in admin filter bar"
    - "AdminReportFilters.ward_id + .corporation_id fields"
    - "getAdminCorporations() + getAdminWards() API functions"
  affects:
    - "frontend/app/admin/reports/page.tsx (filter bar, fetchReports)"
    - "frontend/app/admin/lib/adminApi.ts (types, fetchers, filter params)"

tech_stack:
  added: []
  patterns:
    - "Custom popover (no third-party dropdown library, per threat model T-07-SC)"
    - "position: relative wrapper + position: absolute popover (no fixed — iOS Safari safe)"
    - "Ref pattern (corpIdRef, wardIdRef) to avoid stale closures in fetchReports"
    - "Promise.all for parallel corp/ward options fetch on mount"
    - "mousedown listener for outside-click popover dismiss"

key_files:
  created: []
  modified:
    - frontend/app/admin/lib/adminApi.ts
    - frontend/app/admin/reports/page.tsx

decisions:
  - "Custom popover built from scratch — no third-party dropdown (T-07-SC threat mitigated, D-01)"
  - "position: absolute on popovers (not fixed) to avoid iOS Safari scroll offset bug (D-04 note)"
  - "Parallel fetch of corp + ward options via Promise.all on mount; individual error tracking per filter"
  - "Corp change resets wardId to empty before narrowing ward list — avoids stale ward selection crossing corp boundary (D-02)"
  - "corpIdRef + wardIdRef refs mirror the categoryRef/statusRef pattern for fetchReports stale-closure safety"
  - "NEW indicator ring (outline: 1.5px solid var(--accent-border)) set on both triggers; cleared after first user interaction"

metrics:
  duration: "~20 min"
  completed: "2026-06-23T02:00:00Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 07 Plan 04: Admin Corp/Ward Filter UI Summary

**One-liner:** Corp select + searchable ward popover wired inline in the admin reports filter bar, narrowing by geography via Plan 01 backend endpoints.

## What Was Built

### Task 1: adminApi extensions (commit `3121c32`)

Extended `frontend/app/admin/lib/adminApi.ts`:

- Added `ward_id?: string` and `corporation_id?: string` to `AdminReportFilters` interface (D-04)
- Updated `getAdminReports()` to serialize both new params into the query string using the existing conditional-append pattern
- Exported `CorporationOption` type: `{ id: string; name: string }`
- Exported `WardOption` type: `{ id: string; ward_name: string; ward_number: number }`
- Added `getAdminCorporations(): Promise<CorporationOption[]>` → GET /api/admin/corporations
- Added `getAdminWards(corpId?: string): Promise<WardOption[]>` → GET /api/admin/wards (appends `?corp_id=<corpId>` when corpId provided)

Both new functions use the existing `apiFetch` helper (credentials: include, non-2xx rejection).

### Task 2: Admin filter bar UI (commit `dd27b0b`)

Added to `frontend/app/admin/reports/page.tsx`:

**New sub-components (inline in the same file):**

- `FilterTrigger` — 32px height, JetBrains Mono 12px, muted label prefix (CORP:/WARD:), ink value text, accent-bg active state, accent-border NEW ring, aria-label + aria-busy attributes
- `CorpPopover` — 236px wide, header "CORPORATION · {N}", corp name rows (13px bold), All corps option, selected row highlight var(--accent-bg)
- `WardPopover` — 296px wide, search input (`placeholder="grep ward name or no…"`), header "Showing {N} / 369 · {corp_name}", ward number (mono 11px muted, tabular) + ward name (12px, ellipsis), All wards option, no-match state `"no ward matches '{q}'"` (muted mono, centered), client-side filter on ward_name + ward_number

**State added:**
- `corporationId`, `wardId` — selected IDs
- `corporations`, `wards` — option arrays from API
- `isLoadingFilters`, `filterError.corp`, `filterError.ward` — per-filter loading/error tracking
- `corpPopoverOpen`, `wardPopoverOpen`, `corpIsNew`, `wardIsNew` — UI state
- `corpIdRef`, `wardIdRef` — mirrors categoryRef/statusRef pattern for fetchReports

**Behavior wired (D-02, D-04):**
- On mount: `Promise.all([getAdminCorporations(), getAdminWards()])` — parallel fetch
- Corp change: reset wardId, refetch `getAdminWards(corpId)` to narrow list, call `fetchReports` with corporation_id and empty ward_id
- Corp cleared ("All corps"): reset ward list to all 369, refetch without corporation_id
- Ward change: call `fetchReports` with ward_id
- Both popovers dismiss on outside click (mousedown listener)
- Loading: "Loading…" disabled trigger state; Error: "Unavailable" disabled trigger state

**Layout (D-01):**
- Horizontal `display: flex`, `gap: 8px`, `overflow-x: auto`, `.no-scrollbar` — no wrap on tablet
- Vertical 1px solid var(--border) separator preceding the geo selects
- Admin.css tokens only: `--accent-bg`, `--accent-ink`, `--accent-border`, `--surface-2`, `--r-xs`, `--muted`, `--ink`, `--border`, `--font-mono` (D-29)

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| `grep -c "getAdminCorporations\|getAdminWards" adminApi.ts` ≥ 2 | 2 (function definitions + calls) |
| AdminReportFilters has ward_id? and corporation_id? | Confirmed |
| getAdminReports serializes ward_id, corporation_id | Confirmed |
| npm run lint passes | PASS — no ESLint errors |
| `grep -c "grep ward name or no"` = 1 | 1 |
| `grep -c "All corps\|All wards"` ≥ 2 | 6 |
| `grep -c "Showing"` ≥ 1 | 1 |
| Corp-change handler resets wardId, calls getAdminWards(corpId) | Confirmed |
| fetchReports passes corporation_id and ward_id | Confirmed |
| No position:fixed on new popovers | 0 matches (popovers use position:absolute) |
| npm run build succeeds | PASS — all 16 routes compiled |

## Deviations from Plan

None — plan executed exactly as written.

The plan noted "Claude's discretion" for searchability approach (D-04 / Risk 4). Custom popover with `position: absolute` (relative to wrapper) was chosen exactly as specified. No architectural changes were needed.

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-07-08: corp_id/ward_id from client | Mitigated — UI only sends IDs returned by the admin option endpoints; backend binds as Option<Uuid> |
| T-07-09: scoped admin querying other corps | Accepted — backend scopes results; out-of-scope selections yield empty |
| T-07-SC: npm install supply chain | Mitigated — zero new npm packages; custom popover built from React primitives |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `3121c32` | feat(07-04): extend adminApi with corp/ward types, fetchers, and filter params |
| Task 2 | `dd27b0b` | feat(07-04): add corporation select + searchable ward popover to admin filter bar |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `frontend/app/admin/reports/page.tsx` exists | FOUND |
| `frontend/app/admin/lib/adminApi.ts` exists | FOUND |
| `07-04-SUMMARY.md` exists | FOUND |
| Commit `3121c32` in log | FOUND |
| Commit `dd27b0b` in log | FOUND |
