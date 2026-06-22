---
phase: 06-production-launch-git-branching-workflow
verified: 2026-06-22T11:15:36Z
status: human_needed
score: 9/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/10
  gaps_closed:
    - "deploy.yml dual-branch structure (5 jobs) now on origin/staging via infra PR #21"
    - "docker-compose.staging-server.yml exists on origin/staging with port 3011, isolated volumes, correct PUBLIC_URL"
    - "nginx/nginx.staging-server.conf exists on origin/staging with upstream backend:3011"
    - "docker-compose.production-server.yml exists on origin/staging (renamed from docker-compose.server.yml)"
    - "DEPLOYMENT.md updated on origin/staging: 0 docker-compose.server.yml refs, 17 production-server.yml refs, 0 api-walkability refs, new branching/staging/cloudflare sections"
    - ".planning/config.json branching section on origin/staging: working_branch=staging, protected=[main,staging]"
    - "GitHub manual setup confirmed by human: runner label walkability-staging, staging Environment (6 secrets + 2 vars), branch protection rulesets protect-main + protect-staging, production BACKEND_URL updated"
    - "LAUNCH-02 re-assessed as VERIFIED: origin/main deploy.yml (3-job) is self-consistent — it references docker-compose.server.yml which still exists on origin/main; push to main triggers production deploy correctly"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Visit https://nammadaari.com in a browser"
    expected: "Coming soon page with Namma Daari wordmark, 'Coming soon · Bengaluru' pulsing chip, 'Snap a broken footpath.' tagline, description paragraph mentioning BBMP/GBA, and Instagram CTA @nammadaariblr"
    why_human: "Live Vercel deployment and Cloudflare routing cannot be verified from the codebase; the code is correct on origin/main but whether Vercel built and served it is external state. Human confirmed HTTP 200 — visual confirmation of content needed."
  - test: "Visit https://staging.nammadaari.com in a browser"
    expected: "Full citizen app home page (report submission interface with photo CTA) — NOT the coming soon page"
    why_human: "Vercel branch-to-domain routing (staging.nammadaari.com → staging branch) is external Vercel dashboard configuration; page.tsx on origin/staging correctly shows the citizen app but actual DNS/CDN routing requires browser confirmation"
---

# Phase 6: Production Launch + Git Branching Workflow Verification Report

**Phase Goal:** Establish production launch infrastructure — staging branch, dual-environment CI/CD, coming soon page on nammadaari.com, and documented branching workflow.
**Verified:** 2026-06-22T11:15:36Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (infra PR #21 merged to origin/staging)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visiting nammadaari.com shows a coming soon page with the @nammadaariblr Instagram CTA (LAUNCH-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | page.tsx on origin/main: no `use client`, no API calls, metadata.title = "Namma Daari — Coming Soon", href="https://instagram.com/nammadaariblr", rel="noopener". CSS module on origin/main: 37 var(--) references, no hardcoded hex. Human-confirmed: PR #20 merged, nammadaari.com returns HTTP 200 with coming soon content. Visual/layout check requires browser. |
| 2 | Pushing to main triggers CI that deploys to nammadaari.com via Cloudflare Tunnel (LAUNCH-02) | ✓ VERIFIED | origin/main deploy.yml: triggers on push to main, uses `environment: production`, runs on walkability-prod runner, uses docker-compose.server.yml which EXISTS on origin/main. Smoke test uses vars.BACKEND_URL and vars.FRONTEND_URL from the production environment. Self-consistent pipeline. Human-confirmed production environment variables and runner label present. |
| 3 | Pushing to staging triggers CI that deploys to staging.nammadaari.com (LAUNCH-03) | ✓ VERIFIED | origin/staging deploy.yml: on.push.branches=[main,staging], 5 jobs (ci, deploy-staging, deploy-production, smoke-test-staging, smoke-test-production). deploy-staging uses environment:staging and runs-on:[self-hosted,linux,walkability-staging]. docker-compose.staging-server.yml exists on origin/staging. Human-confirmed: runner label walkability-staging and GitHub Environment staging configured. |
| 4 | DEPLOYMENT.md documents the branching model (feature/fix → staging → main) and staging stack (LAUNCH-04) | ✓ VERIFIED | origin/staging DEPLOYMENT.md: grep docker-compose.server.yml = 0; docker-compose.production-server.yml = 17; api-walkability = 0; staging = many. Sections §1a Branching Workflow, §1b Staging Stack Setup, §1c Cloudflare Tunnel all present (grep "Branching Workflow|Staging Stack|Cloudflare Tunnel" = 11 matches). |
| 5 | GSD branching config updated so fix/* and feat/* target staging; main/staging guarded (LAUNCH-05) | ✓ VERIFIED | origin/staging .planning/config.json: branching.working_branch=staging, branching.protected=["main","staging"], branching.merge_targets.feat=staging, branching.merge_targets.fix=staging, branching.milestone_merge.from=staging/to=main. Valid JSON. |
| 6 | deploy.yml triggers on push to both 'main' and 'staging' branches | ✓ VERIFIED | origin/staging deploy.yml: on.push.branches=['main','staging'] confirmed via python3 yaml.safe_load. |
| 7 | A 'staging' branch exists on the remote repository | ✓ VERIFIED | git ls-remote --heads origin staging returns d43b87fa6a1cfe1d56f8ea23e312dd31a4395f16 refs/heads/staging. |
| 8 | Staging Docker Compose override (docker-compose.staging-server.yml) is correct and isolated | ✓ VERIFIED | On origin/staging: volumes=[postgres_staging_data,uploads_staging], nginx ports=['3011:80'], backend PORT=3011, backend PUBLIC_URL=https://staging-api.nammadaari.com, frontend profiles=[frontend-only], nginx volume mounts nginx.staging-server.conf. YAML valid. |
| 9 | nginx/nginx.staging-server.conf is an independent copy with upstream backend:3011 | ✓ VERIFIED | On origin/staging: grep -c backend:3011 = 1 (confirmed). grep -c backend:3001 = 0. All 7 location blocks present (/api/reports.geojson, /api/admin/auth/login, /api/admin/, /api/, /uploads/, /health, /). All 4 rate-limiting zones present. nginx.server.conf unchanged (backend:3001 = 1 still). |
| 10 | GitHub Environment 'staging' has 6 secrets, runner has 'walkability-staging' label, branch protection rules configured on both main and staging | ✓ VERIFIED (human-confirmed per prompt) | Human confirmed: runner label walkability-staging added; staging Environment created with LXC_SSH_KEY, JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGIN, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD (6 secrets) + BACKEND_URL, FRONTEND_URL (2 vars); production BACKEND_URL updated; protect-main and protect-staging rulesets created. |

**Score:** 9/10 truths verified (1 present with human-confirmed HTTP 200, visual confirmation needed)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/deploy.yml` on origin/staging | 5-job dual-branch deploy | ✓ VERIFIED | jobs: [ci, deploy-staging, deploy-production, smoke-test-staging, smoke-test-production]; push.branches: [main, staging]; staging env + runner wired correctly |
| `docker-compose.staging-server.yml` on origin/staging | Staging Compose override with port 3011, isolated volumes | ✓ VERIFIED | nginx:3011:80, backend PORT=3011, PUBLIC_URL=https://staging-api.nammadaari.com, volumes: postgres_staging_data+uploads_staging |
| `nginx/nginx.staging-server.conf` on origin/staging | Independent nginx config with upstream backend:3011 | ✓ VERIFIED | upstream backend { server backend:3011; } — 1 match, 0 backend:3001 refs |
| `docker-compose.production-server.yml` on origin/staging | Renamed from docker-compose.server.yml | ✓ VERIFIED | Exists on origin/staging; docker-compose.server.yml absent from origin/staging |
| `backend/railway.toml` | Deleted | ✓ VERIFIED | Absent from origin/staging (fatal: path does not exist) |
| `frontend/app/page.tsx` on origin/main | Coming soon Server Component | ✓ VERIFIED | No `use client`; nammadaariblr appears 2x; rel="noopener"; no API calls |
| `frontend/app/coming-soon.module.css` on origin/main | Scoped CSS module, no hardcoded hex | ✓ VERIFIED | 37 var(--) usages; no hex values; no .press/.pulse re-declarations; ig-btn class present |
| `DEPLOYMENT.md` on origin/staging | Updated with branching model, staging stack, domains | ✓ VERIFIED | Zero old refs; 17 production-server.yml refs; new sections §1a §1b §1c confirmed |
| `.planning/config.json` on origin/staging | branching section with working_branch=staging | ✓ VERIFIED | All 5 branching keys present with correct values |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| deploy.yml deploy-staging job | docker-compose.staging-server.yml | SSH: docker compose -f docker-compose.yml -f docker-compose.staging-server.yml | ✓ WIRED | Both on origin/staging; deploy-staging step verified in deploy.yml |
| deploy.yml deploy-production job | docker-compose.production-server.yml | SSH: docker compose -f docker-compose.yml -f docker-compose.production-server.yml | ✓ WIRED (on origin/staging) | origin/main still uses old deploy.yml with docker-compose.server.yml (which exists on main) — consistent |
| deploy.yml smoke-test-staging | environment: staging vars.BACKEND_URL / vars.FRONTEND_URL | GitHub Environment variables | ✓ WIRED | smoke-test-staging has environment: staging; uses ${{ vars.BACKEND_URL }} and ${{ vars.FRONTEND_URL }} |
| nginx.staging-server.conf upstream | docker-compose.staging-server.yml backend:3011 | upstream backend { server backend:3011; } | ✓ WIRED | nginx conf uses backend:3011; compose override sets backend PORT=3011 |
| .planning/config.json branching.working_branch | git remote origin/staging | GSD /gsd-ship reads working_branch to route PRs | ✓ WIRED | working_branch="staging"; origin/staging branch exists at d43b87f |
| DEPLOYMENT.md §Branching Workflow | GitHub branch protection rules | Documents feature → staging → main model | ✓ WIRED | Documentation accurate; human-confirmed protect-main and protect-staging rulesets exist |

---

### Data-Flow Trace (Level 4)

Not applicable for this phase — all artifacts are infrastructure/config/static-render. No dynamic data components.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| deploy.yml 5-job dual-branch structure on origin/staging | python3 yaml.safe_load (git show origin/staging:.github/workflows/deploy.yml) | jobs: [ci, deploy-staging, deploy-production, smoke-test-staging, smoke-test-production]; push.branches: [main, staging] | ✓ PASS |
| deploy.yml staging job environment | yaml check origin/staging | environment: staging; runs-on: [self-hosted, linux, walkability-staging] | ✓ PASS |
| deploy.yml no old references | grep -c "docker-compose.server.yml\|RAILWAY_BACKEND_URL" origin/staging deploy.yml | 0 | ✓ PASS |
| docker-compose.staging-server.yml valid YAML with correct values | python3 yaml.safe_load (git show origin/staging) | nginx:3011:80; backend PORT=3011; PUBLIC_URL=https://staging-api.nammadaari.com; volumes: postgres_staging_data+uploads_staging | ✓ PASS |
| nginx.staging-server.conf upstream port | grep -c backend:3011 origin/staging | 1 | ✓ PASS |
| nginx.server.conf production unchanged | grep -c backend:3001 origin/staging:nginx/nginx.server.conf | 1 | ✓ PASS |
| .planning/config.json branching values | python3 json.load assertions origin/staging | all 5 assertions green | ✓ PASS |
| DEPLOYMENT.md stale reference count | grep -c "docker-compose.server.yml" origin/staging | 0 | ✓ PASS |
| staging branch exists on remote | git ls-remote --heads origin staging | d43b87fa6a1cfe1d56f8ea23e312dd31a4395f16 refs/heads/staging | ✓ PASS |
| page.tsx on origin/main: no use client, no API calls | grep checks | use client=0; nammadaariblr=2; rel="noopener"=1; API imports=0 | ✓ PASS |

---

### Probe Execution

No probes declared for this phase. Step 7c: SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LAUNCH-01 | 06-05 | nammadaari.com shows coming soon page with @nammadaariblr CTA | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | page.tsx + CSS module on origin/main; code verified; human-confirmed HTTP 200; visual rendering requires browser |
| LAUNCH-02 | 06-01, 06-02 | main branch auto-deploys to nammadaari.com via Cloudflare Tunnel + CI | ✓ SATISFIED | origin/main deploy.yml: push to main → deploy job (environment: production) → docker-compose.server.yml (exists on main). Self-consistent. Human-confirmed production environment and runner operational. |
| LAUNCH-03 | 06-01, 06-02, 06-03 | staging branch auto-deploys to staging.nammadaari.com via CI | ✓ SATISFIED | origin/staging: dual-branch deploy.yml with deploy-staging job; docker-compose.staging-server.yml present; runner label walkability-staging confirmed; GitHub Environment staging confirmed |
| LAUNCH-04 | 06-04 | Branching workflow documented in DEPLOYMENT.md | ✓ SATISFIED | DEPLOYMENT.md §1a Branching Workflow, §1b Staging Stack Setup, §1c Cloudflare Tunnel present on origin/staging; all old references updated |
| LAUNCH-05 | 06-04 | GSD branching config for fix/* feat/* → staging; guarded branches | ✓ SATISFIED | .planning/config.json branching section on origin/staging; all values correct |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `docker-compose.production-server.yml` (origin/staging) | Usage comment | Comment reads `docker-compose.server.yml` (old name in the Usage: line) | INFO only | Comment artifact only — no functional reference; actual deploy.yml SSH commands reference `docker-compose.production-server.yml` correctly. Not a blocker. |

No TBD, FIXME, or XXX markers found in any files modified by this phase on origin/staging or origin/main.

**Note on oklch()/rgba() in coming-soon.module.css:** The CSS module uses oklch() and rgba() inline values in radial-gradient declarations. These are not hardcoded hex values. The design spec (06-UI-SPEC.md) explicitly specifies these gradient circle coordinates. The plan acceptance criterion states "no hardcoded hex color values" — this is satisfied. No blockers.

---

### Human Verification Required

#### 1. Confirm coming soon page visual content on nammadaari.com

**Test:** Visit https://nammadaari.com in a browser (Chrome or Firefox preferred for full CSS support)
**Expected:** Coming soon page renders with: Namma Daari wordmark (EN + Kannada), "Coming soon · Bengaluru" pulsing green dot chip, "Snap a broken footpath." / "Put it on Bengaluru's map." tagline (second line in muted color), description paragraph with "Every report lands in front of BBMP / GBA" in bold, Instagram CTA button with @nammadaariblr handle, footer with four tags (Footpaths, Crossings, Lighting, BBMP / GBA). Page title in browser tab: "Namma Daari — Coming Soon".
**Why human:** HTTP 200 already confirmed by human. The visual rendering — CSS variable resolution, animation, responsive layout — requires a live browser. The code is verified correct; this check confirms Vercel built and served it properly.

#### 2. Confirm staging.nammadaari.com shows the full citizen app

**Test:** Visit https://staging.nammadaari.com in a browser
**Expected:** Full citizen app home page with report submission interface (photo CTA, location, category) — NOT a coming soon page. No "Namma Daari — Coming Soon" in page title.
**Why human:** page.tsx on origin/staging is confirmed to be the citizen home page (imports Link, Icon, Pill, SectionLabel, ReportCTA — not the coming soon component). The domain routing (staging.nammadaari.com → staging branch in Vercel) is external Vercel configuration confirmed during Plan 05 Task 4; this check confirms the routing is still active and that the staging branch page.tsx is actually served.

---

### Note on Branch State

The infra changes (dual-branch deploy.yml, staging Compose stack, updated DEPLOYMENT.md, config.json branching section) are on **origin/staging** but not yet on **origin/main**. This is the correct intermediate state for the three-tier branching model: infra work merges to staging first; main receives it at milestone completion via `/gsd-complete-milestone`.

origin/main currently has the older single-job deploy.yml referencing docker-compose.server.yml (which still exists on main). This is self-consistent — main deploys correctly. The full dual-branch infrastructure will propagate to main when staging merges to main at milestone close.

---

_Verified: 2026-06-22T11:15:36Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after infra PR #21 merged to origin/staging_
