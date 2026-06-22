---
status: complete
phase: 06-production-launch-git-branching-workflow
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md]
started: 2026-06-22T12:00:00Z
updated: 2026-06-22T17:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running staging container stack. Run: docker compose -f docker-compose.yml -f docker-compose.staging-server.yml up -d db backend nginx. Stack boots without errors. Backend logs show "listening on 0.0.0.0:3011". Nginx starts on port 3011. curl http://localhost:3011/health returns {"status":"ok"}. No volume conflicts with any running production stack.
result: pass

### 2. nammadaari.com — Coming Soon Page
expected: Visit https://nammadaari.com in a browser. You should see a coming soon page with: the Namma Daari wordmark (ನಮ್ಮ ದಾರಿ), a pulsing "Coming soon · Bengaluru" status chip, "Snap a broken footpath." hero tagline, a description paragraph mentioning BBMP/GBA, and an Instagram CTA linking to @nammadaariblr. The page should NOT show the old citizen report submission UI.
result: pass

### 3. staging.nammadaari.com — Full Citizen App
expected: Visit https://staging.nammadaari.com in a browser. You should see the full citizen app home page — report submission interface with photo CTA — NOT the coming soon page. This confirms Vercel is routing staging branch to the staging domain.
result: pass

### 4. Staging Branch Visible on GitHub
expected: Open https://github.com/kkin1995/bengaluru-walkability-public-audit/branches (or run `git ls-remote --heads origin staging`). A `staging` branch is listed, pointing to the same HEAD as main at v1.1 UAT-fix state.
result: pass
reported: "4 branches visible: main, feat/phase-03.4-org-auto-assign..., fix/cleanup-untracked, staging"

### 5. GitHub Actions — Dual-Branch Deploy Workflow
expected: Open the Actions tab on GitHub. The deploy.yml workflow should show 5 jobs: ci, deploy-staging, deploy-production, smoke-test-staging, smoke-test-production. The workflow triggers on push to both `main` and `staging`. A push to `staging` runs deploy-staging (not deploy-production); a push to `main` runs deploy-production (not deploy-staging).
result: pass
reported: "Live run screenshot: CI (3 jobs, all green), Deploy to Staging (34s, green), Smoke test — Staging (6s, green). Deploy to Production and Smoke test — Production correctly skipped on staging push."

### 6. Staging GitHub Environment — Secrets + Runner
expected: In GitHub → Repository Settings → Environments, a `staging` environment exists with 6 secrets (LXC_SSH_KEY, JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGIN, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD) and 2 variables (BACKEND_URL, FRONTEND_URL). The self-hosted runner has the `walkability-staging` label visible in Settings → Actions → Runners.
result: pass

### 7. DEPLOYMENT.md — Branching Workflow Docs
expected: Open DEPLOYMENT.md in the repo root. It should contain a §1a Branching Workflow section describing the three-tier model (feature/fix → staging → main), a §1b Staging Stack Setup section with the docker-compose.staging-server.yml command, and §1c Cloudflare Tunnel instructions for the two-ingress config. The file should have zero occurrences of "docker-compose.server.yml" (replaced by "docker-compose.production-server.yml").
result: pass
reported: "§1a Branching Workflow, §1b Staging Stack Setup, and §1c Cloudflare Tunnel: Hostname Rename and Staging Ingress all present"

### 8. GSD Config — Branching Section
expected: Open .planning/config.json. It should contain a "branching" key with working_branch="staging", protected=["main","staging"], merge_targets.feat="staging", merge_targets.fix="staging", and milestone_merge.from="staging" to="main". This means /gsd-ship will target staging, not main.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
