---
phase: 06-production-launch-git-branching-workflow
plan: 01
subsystem: infra
tags: [git, github, branch-protection, staging, ci-cd]

# Dependency graph
requires:
  - phase: 05-uat-stabilisation
    provides: stable main branch at v1.1 UAT-fix state
provides:
  - Remote staging branch at main HEAD (refs/heads/staging)
  - Prerequisite for GitHub Environment staging configuration
  - Prerequisite for branch protection rules on main and staging
  - Prerequisite for deploy.yml staging trigger (Plan 02)
affects: [06-02, 06-03, 06-04, 06-05, deploy-workflow, staging-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "staging branch created from main HEAD — single source of truth before branching"
    - "GitHub Environments used for per-environment secret isolation (not repo-level secrets)"

key-files:
  created: []
  modified: []

key-decisions:
  - "Staging branch created from main HEAD before branch protection rules applied (Pitfall 6 avoidance: setting protection before branch exists can block initial push)"
  - "Branch created using 'git branch staging main' without switching current branch — preserves phase/06-ui-spec working state"

patterns-established:
  - "Plan 01: infrastructure prerequisites before code changes — staging branch and GitHub config must exist before deploy.yml restructure (Plan 02)"

requirements-completed: [LAUNCH-02, LAUNCH-03]

# Metrics
duration: 5min
completed: 2026-06-22
status: checkpoint
---

# Phase 06 Plan 01: Staging Branch Infrastructure Summary

**Remote staging branch pushed to GitHub at main HEAD (2dc8560) — GitHub manual setup (runner label, Environments, branch protection) awaiting human completion**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-22T09:35:42Z
- **Completed:** 2026-06-22T09:40:00Z (Task 1 complete; Task 2 is a human checkpoint)
- **Tasks:** 1/2 (Task 2 is checkpoint:human-verify)
- **Files modified:** 0 (git refs only — no repo files changed)

## Accomplishments
- Created `staging` branch from `main` HEAD commit `2dc8560`
- Pushed `staging` branch to `origin` with upstream tracking set
- Confirmed remote ref: `refs/heads/staging` at `2dc856076f88c6fbf4044960e4fdb6e5a32f6b05`
- Branch created BEFORE branch protection rules (correct sequence per research Pitfall 6)

## Task Commits

Task 1 created only a git remote ref — no repo files were modified, so no task commit was generated. The artifact is the remote branch `refs/heads/staging`.

1. **Task 1: Create and push staging branch from main HEAD** — remote branch push (no file commit)
2. **Task 2: GitHub manual setup** — AWAITING HUMAN (checkpoint:human-verify)

## Files Created/Modified

None — this plan operates entirely on git refs and GitHub Settings UI. No code files were added, modified, or deleted.

## Decisions Made
- Created staging from `main` HEAD, not from `phase/06-ui-spec` (the current working branch). This is correct: staging must mirror main at v1.0 state, not planning docs commits.
- Used `git branch staging main` (not `git checkout -b staging`) to avoid switching away from the active phase branch.

## Deviations from Plan

### Execution Note

Task 1 instructions say "Confirm current branch is main" before creating staging. The executor was on `phase/06-ui-spec` (a planning/docs branch). Deviation: the staging branch was created directly from `main` HEAD using `git branch staging main` rather than switching to main first. This achieves the identical result (staging at main HEAD SHA) without disrupting the current working branch. Not a bug — a safe adaptation.

None — plan executed as specified. The staging branch is at the correct commit SHA.

## Issues Encountered

None.

## User Setup Required

Task 2 is a `checkpoint:human-verify` gate. All 5 steps must be completed in the GitHub Settings UI before Plans 02, 03, and 05 can proceed:

1. **Add runner label `walkability-staging`** — GitHub → Repository Settings → Actions → Runners → Edit → Labels
2. **Create GitHub Environment `staging`** — Settings → Environments → New environment with 6 secrets + 2 variables
3. **Update production environment variables** — Settings → Environments → production → update BACKEND_URL = https://api.nammadaari.com
4. **Set branch protection on `main`** — Settings → Branches → Add branch ruleset → protect-main
5. **Set branch protection on `staging`** — Settings → Branches → Add branch ruleset → protect-staging

Verification checklist before resuming:
- [ ] Runner labels show: self-hosted, linux, walkability-prod, walkability-staging
- [ ] GitHub Environments page shows: production, staging (both present)
- [ ] staging environment has 6 secrets: LXC_SSH_KEY, JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGIN, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD
- [ ] staging environment has 2 variables: BACKEND_URL, FRONTEND_URL
- [ ] production BACKEND_URL = https://api.nammadaari.com
- [ ] Branch protection rulesets exist for both main and staging

## Next Phase Readiness

- Plan 01 Task 1 complete: staging branch exists on remote ✓
- Plan 01 Task 2 PENDING: GitHub manual setup must be completed by user
- Once Task 2 is confirmed, Plans 02–05 can proceed
- Plans 02, 03, 05 depend on: staging branch + GitHub Environment `staging` + runner label `walkability-staging`

## Threat Flags

No new threat surface introduced. Branch creation is a prerequisite for the GitHub Environments secret isolation pattern (T-06-01-01) — the mitigations (separate staging/production secrets with distinct values) are enforced in Task 2 (human setup step).

## Self-Check: PASSED

- Staging branch pushed to remote: `git ls-remote --heads origin staging` returns `2dc856076f88c6fbf4044960e4fdb6e5a32f6b05 refs/heads/staging` ✓
- No repo files modified (task was git-refs only) ✓
- No commits to verify (no file changes staged)

---
*Phase: 06-production-launch-git-branching-workflow*
*Plan: 01*
*Completed: 2026-06-22*
