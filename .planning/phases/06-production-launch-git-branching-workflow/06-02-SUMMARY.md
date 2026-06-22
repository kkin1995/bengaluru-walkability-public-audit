---
phase: "06"
plan: "02"
subsystem: ci-cd
status: complete
tags: [github-actions, docker-compose, deploy-workflow, staging, production, railway-cleanup]
dependency_graph:
  requires: ["06-01"]
  provides: ["06-03", "06-04"]
  affects: [".github/workflows/deploy.yml", "docker-compose.production-server.yml"]
tech_stack:
  added: []
  patterns:
    - "Branch-conditional GitHub Actions jobs using github.ref == 'refs/heads/<branch>' if: conditions"
    - "GitHub Environments for per-environment secret and variable scoping"
    - "workflow_dispatch with type: choice input for manual re-triggers"
key_files:
  created:
    - docker-compose.production-server.yml
  modified:
    - .github/workflows/deploy.yml
  deleted:
    - docker-compose.server.yml
    - backend/railway.toml
decisions:
  - "Renamed docker-compose.server.yml → docker-compose.production-server.yml using git mv (R100 — content unchanged, history preserved)"
  - "Removed backend/railway.toml — Railway decommissioned in Phase 02.4 per D-29"
  - "deploy.yml restructured: 3 jobs → 5 jobs; triggers on [main, staging]; workflow_dispatch requires environment input"
  - "Staging local health check targets http://localhost:3011/health (staging nginx on host port 3011)"
  - "Production local health check targets http://localhost/health (production nginx on host port 80)"
  - "smoke-test-* jobs use environment-scoped vars.BACKEND_URL and vars.FRONTEND_URL — no RAILWAY_BACKEND_URL conditionals"
metrics:
  completed_date: "2026-06-22T10:06:47Z"
  duration_minutes: 12
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 06 Plan 02: Deploy Workflow Restructure + Compose Rename Summary

Dual-branch deploy.yml with staging and production GitHub Environments, plus docker-compose.server.yml renamed to docker-compose.production-server.yml and railway.toml deleted.

## What Was Built

### Task 1: Rename docker-compose.server.yml and delete railway.toml

- `docker-compose.server.yml` renamed to `docker-compose.production-server.yml` using `git mv` (R100 — byte-for-byte identical content, history preserved)
- `backend/railway.toml` removed via `git rm` — Railway was decommissioned in Phase 02.4; the file was stale config-as-code that no longer corresponded to any live deployment target
- Both changes staged before Task 2 and committed atomically

### Task 2: Restructure deploy.yml for staging and production dual-branch deployment

Rewrote `.github/workflows/deploy.yml` from a single-job production-only workflow to a five-job dual-environment workflow:

**Trigger section** (per D-08):
- `on.push.branches: [main, staging]`
- `workflow_dispatch` with `environment` input (type: choice, options: [staging, production]) — prevents manual triggers from accidentally defaulting to production

**Job structure:**
| Job | Trigger | Runner | Environment |
|-----|---------|--------|-------------|
| ci | always | ubuntu-latest (via workflow_call) | — |
| deploy-staging | refs/heads/staging or workflow_dispatch staging | [self-hosted, linux, walkability-staging] | staging |
| deploy-production | refs/heads/main or workflow_dispatch production | [self-hosted, linux, walkability-prod] | production |
| smoke-test-staging | same as deploy-staging | ubuntu-latest | staging |
| smoke-test-production | same as deploy-production | ubuntu-latest | production |

**Key changes from prior deploy.yml:**
- `if:` conditions use full ref path `refs/heads/staging` / `refs/heads/main` (not bare branch names)
- Staging deploy: `mkdir -p /opt/nammadaari-staging` step added (directory may not pre-exist on LXC)
- Staging deploy: uses `docker-compose.staging-server.yml` (created in Plan 03)
- Production deploy: uses `docker-compose.production-server.yml` (renamed in Task 1)
- Staging local health check: `http://localhost:3011/health` (staging nginx on host port 3011)
- Production local health check: `http://localhost/health` (production nginx on host port 80)
- Smoke tests: `vars.BACKEND_URL` and `vars.FRONTEND_URL` resolve from GitHub Environment — no `RAILWAY_BACKEND_URL` conditional

## Verification Results

All post-commit checks passed:

1. `python3 -c "import yaml; d=yaml.safe_load(open(...)); print(list(d['jobs'].keys()))"` → `['ci', 'deploy-staging', 'deploy-production', 'smoke-test-staging', 'smoke-test-production']`
2. `grep -c "docker-compose.server.yml" .github/workflows/deploy.yml` → `0`
3. `grep -c "docker-compose.production-server.yml" .github/workflows/deploy.yml` → `2`
4. `ls docker-compose.production-server.yml` → exists
5. `ls docker-compose.server.yml` → correctly absent
6. `ls backend/railway.toml` → correctly absent

## Deviations from Plan

None — plan executed exactly as written.

The plan specified committing Tasks 1 and 2 together in a single atomic commit. This was followed: git mv + git rm were staged first (Task 1 verification), then deploy.yml was written and staged (Task 2), and a single commit captured all three file changes.

## Threat Mitigations Applied

Per plan threat model:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-06-02-01 | Job-level if: conditions use `refs/heads/staging` vs `refs/heads/main` — no ambiguity in branch routing |
| T-06-02-02 | `backend/railway.toml` deleted — Railway no longer a live deployment target |
| T-06-02-03 | `grep -c "docker-compose.server.yml" deploy.yml` = 0 — all references replaced |
| T-06-02-04 | `workflow_dispatch` environment input prevents defaulting to production on manual triggers |

## Known Stubs

- `docker-compose.staging-server.yml` referenced in deploy-staging job but not yet created — this file is created in Plan 03. The staging deploy job will fail until Plan 03 is executed.
- Runner label `walkability-staging` referenced in deploy-staging job but not yet added to the self-hosted runner — this is a manual step documented in RESEARCH.md Environment Availability table.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The deploy.yml changes route existing CI/CD paths to new environments; no new trust boundaries created.

## Self-Check: PASSED

- `docker-compose.production-server.yml` exists: FOUND
- `.github/workflows/deploy.yml` exists: FOUND
- `docker-compose.server.yml` absent: CONFIRMED
- `backend/railway.toml` absent: CONFIRMED
- Commit c926bea exists: CONFIRMED (git log shows `ci(06-02): restructure deploy.yml...`)
