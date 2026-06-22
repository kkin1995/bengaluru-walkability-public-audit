---
phase: "06-production-launch-git-branching-workflow"
plan: "05"
subsystem: "frontend"
status: checkpoint
tags:
  - coming-soon
  - launch
  - branch-main
  - server-component
  - css-module

dependency_graph:
  requires:
    - "06-01"
  provides:
    - "coming-soon-page-on-main"
  affects:
    - "frontend/app/page.tsx"
    - "frontend/app/coming-soon.module.css"

tech_stack:
  added: []
  patterns:
    - "CSS Modules for scoped page styles"
    - "Server Component with no API calls (static render)"
    - "Branch-from-main pattern for main-only changes"

key_files:
  created:
    - "frontend/app/coming-soon.module.css"
  modified:
    - "frontend/app/page.tsx"
    - "frontend/app/__tests__/home-page.test.tsx"

decisions:
  - "Used CSS Modules (coming-soon.module.css) for all page-specific styles — no global namespace pollution"
  - "Instagram SVG icon inlined directly (no icon component) per UI-SPEC.md Component Mapping"
  - "No Bi, Btn, or SectionLabel imports — design uses inline span pattern per UI-SPEC.md"
  - "Tests for home page replaced entirely — old citizen-home tests were stale after page.tsx replacement"

metrics:
  duration: "~17 minutes"
  completed: "2026-06-22T10:17:50Z"
  tasks_completed: 3
  tasks_total: 4
  files_changed: 3
---

# Phase 06 Plan 05: Coming Soon Page Summary

Server Component coming soon page implemented on `phase/06-coming-soon` (branched from `main`), with CSS module for scoped styles and updated tests. Paused at Task 4 checkpoint awaiting Vercel verification, PR creation to main, and deployment confirmation.

## One-liner

Coming soon page with Namma Daari wordmark, pulsing status chip, hero tagline, and Instagram CTA — static Server Component, zero API calls, all design tokens from globals.css.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Branch setup — phase/06-coming-soon from main | (no source files — git branch only) | git refs |
| 2+3 | Create coming-soon.module.css + Replace page.tsx | 28415c5 | frontend/app/coming-soon.module.css, frontend/app/page.tsx, frontend/app/__tests__/home-page.test.tsx |

All commits landed on `phase/06-coming-soon`. After checkpoint, returned to `phase/06-ui-spec`.

## What Was Built

### `frontend/app/coming-soon.module.css`

- 20 scoped CSS classes: `.page`, `.topbar`, `.wordmark`, `.en`, `.kn`, `.statusChip`, `.dot`, `.hero`, `.eyebrow`, `.soft`, `.tagline`, `.taglineKn`, `.translit`, `.desc`, `.ctaRow`, `.igBtn`, `.handle`, `.ctaNote`, `.footer`, `.tags`, `.tag`
- All colors use `var(--...)` tokens from globals.css — no hardcoded hex values
- Background radial gradients applied on `.page` (fixed attachment)
- Responsive breakpoints: `≤560px` (mobile) and `≤380px` (narrow wordmark column)
- Does not redeclare `.press`, `.pulse`, `.kn` (global), `.mono` (global)

### `frontend/app/page.tsx`

- Replaced citizen home page with coming soon Server Component
- No `"use client"` directive, no `async`, no fetch calls
- Exports `metadata.title = "Namma Daari — Coming Soon"`
- Instagram CTA: `<a href="https://instagram.com/nammadaariblr" target="_blank" rel="noopener">`
- Inline SVG Instagram icon with `aria-hidden="true"`
- All copy matches 06-UI-SPEC.md Copywriting Contract exactly
- Uses global classes: `kn` (Kannada font on wordmark), `pulse` (status dot animation), `mono` (translit), `press` (CTA active scale)

### `frontend/app/__tests__/home-page.test.tsx`

- Replaced 15 stale citizen-home tests with 22 coming soon page tests
- Tests cover: wordmark, status chip, eyebrow, tagline, description, CTA (href, target, rel, handle text), footer text and tags, and regression guards against old content

## Verification Results

- `npm run lint -- --max-warnings 0`: PASS (no warnings or errors)
- `npm test -- --passWithNoTests --watchAll=false`: PASS (916 tests, 57 suites)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale home page tests**
- **Found during:** Task 3 verification
- **Issue:** `app/__tests__/home-page.test.tsx` contained 15 tests for the old citizen home page (Fix the footpath., Walkable BLR, Report an issue, etc.). Replacing page.tsx caused 15 test failures.
- **Fix:** Rewrote tests to cover the new coming soon page content. 22 new tests added covering all UI-SPEC.md elements. Old stale tests removed.
- **Files modified:** `frontend/app/__tests__/home-page.test.tsx`
- **Commit:** 28415c5 (included in same commit as the coming soon implementation)

### Design HTML vs UI-SPEC.md Discrepancies (applied design HTML values)

The locked design HTML (`.planning/phases/06-production-launch-git-branching-workflow/design/Namma Daari - Coming Soon.html`) is the authoritative reference. Where the design HTML differed from the spec text, the design HTML values were used:

| Property | UI-SPEC text | Design HTML (used) |
|----------|-------------|-------------------|
| `.wordmark` gap | 8px | 10px |
| `.statusChip` padding | `5px 10px` | `6px 12px 6px 10px` |
| `.statusChip` font | var(--font-sans) | var(--font-mono) |
| `.statusChip` text-transform | none | uppercase |
| `.igBtn` gap | 10px | 11px |
| `.igBtn` padding | `14px 22px` | `14px 22px 14px 18px` |
| `.cta-note` max-width | 380px | 280px |
| `.footer` gap | 12px | 16px |
| `.eyebrow` text-transform | none | uppercase |
| `.eyebrow` font | var(--font-sans) | var(--font-mono) |
| `.taglineKn` display | block | inline-flex |

## Known Stubs

None. The coming soon page has no data-dependent content. All text is static copy from the Copywriting Contract. No API calls.

## Threat Surface Scan

No new security-relevant surface introduced. The page is a static Server Component with no user input, no authentication, no API calls, and no environment variable access. The only external link (`https://instagram.com/nammadaariblr`) uses `rel="noopener"` (T-06-05-02 mitigation confirmed).

## Checkpoint Status

**Paused at Task 4 (human verify).**

Task 4 requires the user to:
1. Verify Vercel domain assignments (nammadaari.com → main, staging.nammadaari.com → staging)
2. Set Vercel environment variables per branch (D-22)
3. Push `phase/06-coming-soon` and open a PR to `main`
4. Approve and merge the PR (gh pr review --approve && gh pr merge --squash)
5. Verify nammadaari.com shows the coming soon page
6. Verify staging.nammadaari.com still shows the full citizen app

**Resume signal:** Type "coming soon live" after verifying both domains, or describe any issues.

## Self-Check

Files created/modified on `phase/06-coming-soon`:

- [x] `frontend/app/coming-soon.module.css` — created on phase/06-coming-soon at commit 28415c5
- [x] `frontend/app/page.tsx` — modified on phase/06-coming-soon at commit 28415c5
- [x] `frontend/app/__tests__/home-page.test.tsx` — modified on phase/06-coming-soon at commit 28415c5

Commits verified:
- [x] 28415c5 exists on phase/06-coming-soon

## Self-Check: PASSED
