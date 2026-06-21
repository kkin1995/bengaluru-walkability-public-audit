# Phase 06: Production Launch + Git Branching Workflow — Research

**Researched:** 2026-06-22T00:00:00Z
**Domain:** GitHub Actions CI/CD, Docker Compose multi-stack, Vercel branch deployments, Next.js coming soon page, GSD config
**Confidence:** HIGH (all findings derived from direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Branching model**
- D-01: Working branches (`feat/*`, `fix/*`, `phase/*`) target `staging` as their merge destination. `/gsd-ship` creates a PR from working branch to `staging`. Direct pushes to `staging` or `main` are blocked by GitHub branch protection rules.
- D-02: Milestone promotion: `/gsd-complete-milestone` merges `staging` into `main`. This is the only way code reaches `main`.
- D-03: `staging` branch does not yet exist in remote — must be created from current `main` HEAD.

**GitHub branch protection**
- D-04: Both `main` and `staging` have GitHub branch protection rules enabled.
- D-05: Rules for both branches: PR required before merging; CI must pass (all three jobs: `frontend-checks`, `backend-checks`, `docker-build`); 1 approval required.
- D-06: Self-approve is allowed (solo developer workflow).
- D-07: Direct pushes to `main` or `staging` are blocked for all users. No bypass even for admins.

**Deploy workflow**
- D-08: One `deploy.yml` with branch conditionals. Triggers on push to `main` OR `staging`. Job-level `if:` conditions determine which Compose stack and GitHub Environment to use.
- D-09: GitHub Environments: two — `staging` and `production` — each holding own secrets (JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGIN, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD).
- D-10: Existing runner gets a second label `walkability-staging`. Staging deploy uses `[self-hosted, linux, walkability-staging]`, production uses `[self-hosted, linux, walkability-prod]`.
- D-11: `deploy.yml` deploys backend only. Frontend deploys via Vercel. Smoke tests hit backend health endpoint + Vercel frontend URL per environment.

**Docker Compose stacks**
- D-12: Two separate Compose stacks on same Proxmox LXC. Fully isolated — own containers, volumes, env vars.
- D-13: `docker-compose.server.yml` → renamed to `docker-compose.production-server.yml`. All references in `deploy.yml`, `DEPLOYMENT.md`, `CLAUDE.md` updated atomically.
- D-14: New `docker-compose.staging-server.yml`. Backend internal port: 3011 (prod: 3001). PostgreSQL internal port: 5433 (prod: 5432). Named volumes: `postgres_staging_data`, `uploads_staging`. Nginx config: `nginx/nginx.staging-server.conf`.
- D-15: New `nginx/nginx.staging-server.conf` — independent copy of `nginx/nginx.server.conf` with upstream pointing to backend port 3011. No shared includes.

**Domains and API URLs**
- D-16: Production API domain: `api-walkability.nammadaari.com` → `api.nammadaari.com`. Cloudflare Tunnel hostname rename (not a new tunnel). A second ingress rule added for `staging-api.nammadaari.com` → nginx port 3011.
- D-17: Staging API domain: `staging-api.nammadaari.com`.
- D-18: CORS_ORIGIN: Production = `https://nammadaari.com`; Staging = `https://staging.nammadaari.com`.
- D-19: PUBLIC_URL: Production = `https://api.nammadaari.com`; Staging = `https://staging-api.nammadaari.com`.
- D-20: DEPLOYMENT.md §Environment Variables: update CORS_ORIGIN example from `https://staging-walkability.kinariwala.com` to `https://nammadaari.com`.

**Vercel frontend setup**
- D-21: One Vercel project, two branch-to-domain mappings: `nammadaari.com` → `main`; `staging.nammadaari.com` → `staging`.
- D-22: Vercel env vars per branch: `main` branch: NEXT_PUBLIC_API_URL=`https://api.nammadaari.com`, INTERNAL_API_URL=`https://api.nammadaari.com`. `staging` branch: NEXT_PUBLIC_API_URL=`https://staging-api.nammadaari.com`, INTERNAL_API_URL=`https://staging-api.nammadaari.com`.

**Coming soon page (main branch)**
- D-23: `frontend/app/page.tsx` on `main` replaced with coming soon page. No Next.js middleware gate; no env var toggle.
- D-24: Uses CSS variable tokens, existing design system. See UI-SPEC.md for full locked design.
- D-25: Copy is FINAL — documented in `06-UI-SPEC.md` Copywriting Contract section.
- D-26: Flip mechanism: milestone merge naturally overwrites the file. No code removal step.

**Admin seed for production**
- D-27: Production GitHub Environment includes ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD. Remove after first successful login.

**GSD config update (LAUNCH-05)**
- D-28: Add `branching` section to `.planning/config.json` (exact JSON documented in CONTEXT.md).

**Railway cleanup**
- D-29: Remove `backend/railway.toml` — Railway no longer used.
- D-30: Remove RAILWAY_BACKEND_URL references from `deploy.yml` smoke tests. Replace with explicit staging/production smoke test steps per environment.

### Claude's Discretion

None — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Full production launch (app going live): nammadaari.com serving full app happens at next milestone completion.
- Email signup on coming soon page: No email capture. Instagram CTA only.
- Countdown timer on coming soon: Not included.
- `auto-assign-org-from-ward.md` todo: unrelated to production launch, deferred.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAUNCH-01 | `nammadaari.com` displays a coming soon page with @nammadaariblr Instagram CTA, matching citizen portal design language | UI-SPEC.md provides locked design; `page.tsx` will be replaced on `main` branch only |
| LAUNCH-02 | `main` branch auto-deploys to `nammadaari.com` via Cloudflare Tunnel + GitHub Actions CI | `deploy.yml` updated to trigger on `main` push with production environment; Vercel domain mapping for `main` → `nammadaari.com` |
| LAUNCH-03 | `staging` branch auto-deploys to `staging.nammadaari.com` via GitHub Actions CI | `deploy.yml` updated to trigger on `staging` push; new staging Compose stack and nginx config; Vercel branch domain `staging.nammadaari.com` |
| LAUNCH-04 | Branching workflow documented in DEPLOYMENT.md | DEPLOYMENT.md updated with new branching model, Compose file names, domain table |
| LAUNCH-05 | GSD branching config updated so `fix/*` and `feat/*` branches are working default; direct commits guarded | `.planning/config.json` `branching` section added per D-28 |

</phase_requirements>

---

## Summary

Phase 6 is an infrastructure and DevOps phase with zero new product features. All decisions are locked from the CONTEXT.md discussion session. The work divides into five concrete workstreams:

1. **Branch creation and protection**: Create the `staging` branch from `main` HEAD, push to remote, configure GitHub branch protection rules on both `main` and `staging` (D-01 through D-07).

2. **deploy.yml restructure**: Extend the existing single-trigger workflow to handle both `main` (production) and `staging` deployments using GitHub Environments and `if:` conditionals on jobs. The existing runner gets a second label. Railway references removed (D-08 through D-11, D-30).

3. **Docker Compose staging stack**: Rename `docker-compose.server.yml` to `docker-compose.production-server.yml` (updating all 14+ references found in `deploy.yml` and `DEPLOYMENT.md`). Create `docker-compose.staging-server.yml` with isolated ports (3011/5433) and volumes. Create `nginx/nginx.staging-server.conf` as an independent copy with port 3011 upstream (D-12 through D-15).

4. **Coming soon page on `main`**: Replace `frontend/app/page.tsx` with the locked coming soon design from `06-UI-SPEC.md`. Create `coming-soon.module.css` for page-scoped styles. This is a `main`-branch-only change — `staging` retains the citizen app `page.tsx` (D-23 through D-26).

5. **Config and documentation**: Update Cloudflare Tunnel ingress (manual step), update Vercel domain mappings (manual step), update `DEPLOYMENT.md`, add `branching` section to `.planning/config.json`, remove `backend/railway.toml` (D-16 through D-22, D-28, D-29).

**Primary recommendation:** Execute in strict dependency order: (1) create + push `staging` branch, (2) restructure `deploy.yml` + rename Compose files, (3) add staging Compose + nginx files, (4) replace `page.tsx` on `main`, (5) update config and docs. The `staging` branch must exist before branch protection can be configured and before the deploy.yml staging trigger has anything to run against.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Branch routing to deployments | CI/CD (GitHub Actions) | Vercel (frontend) | `deploy.yml` job conditionals handle backend; Vercel handles frontend per branch config |
| Backend staging isolation | Infrastructure (Docker Compose) | CI/CD | Separate Compose stack with isolated ports/volumes ensures prod/staging never share state |
| Frontend environment routing | Vercel (CDN/Static) | — | Vercel branch-to-domain mapping; env vars differ per branch |
| Coming soon page content | Frontend Server (Next.js static render) | — | Server Component, no client state, no API calls — pure static output on `main` |
| Cloudflare Tunnel ingress | Infrastructure (Cloudflare) | — | Ingress rule update is a dashboard/config change; not a code change |
| GSD branching enforcement | GSD tooling (config.json) | — | `branching` key in config.json; GSD reads this to route PRs to correct target branch |
| Secret management per environment | GitHub Environments | — | Separate `staging` and `production` environments each hold independent secret sets |

---

## Standard Stack

No new packages are installed in this phase.

### Core (existing — reads confirm current state)
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| GitHub Actions | N/A | CI/CD orchestration | Existing `ci.yml` + `deploy.yml`; `deploy.yml` restructured |
| Docker Compose v2 | v2.20+ | Multi-stack isolation | `required: false` on nginx depends_on needs v2.20+ |
| nginx:alpine | latest | Reverse proxy | Two independent config files for prod/staging |
| Next.js | 14.x | Frontend framework | Server Component for coming soon page; no new deps |
| Vercel | N/A | Frontend CDN | Branch-to-domain mappings; env var per branch |

### Package Legitimacy Audit

No external packages are installed in this phase. All tooling is existing project infrastructure.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| (none) | — | — | Not applicable |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

After Phase 6, the deployment topology has two parallel stacks:

```
GitHub push to `staging` branch
  └─► GitHub Actions deploy.yml (if: staging)
        ├─► CI jobs (frontend-checks, backend-checks, docker-build) via workflow_call
        ├─► Deploy job [self-hosted, linux, walkability-staging]
        │     rsync → /opt/nammadaari-staging/
        │     docker compose -f docker-compose.yml -f docker-compose.staging-server.yml
        │     backend port 3011, postgres port 5433
        │     volumes: postgres_staging_data, uploads_staging
        └─► Smoke tests → https://staging-api.nammadaari.com/health
                        → https://staging.nammadaari.com (Vercel)

GitHub push to `main` branch
  └─► GitHub Actions deploy.yml (if: main)
        ├─► CI jobs (same three jobs)
        ├─► Deploy job [self-hosted, linux, walkability-prod]
        │     rsync → /opt/nammadaari/
        │     docker compose -f docker-compose.yml -f docker-compose.production-server.yml
        │     backend port 3001, postgres port 5432
        │     volumes: postgres_data, uploads
        └─► Smoke tests → https://api.nammadaari.com/health
                        → https://nammadaari.com (Vercel — coming soon page)

Cloudflare Tunnel (single daemon, two ingress rules):
  https://api.nammadaari.com → localhost:80 (production nginx)
  https://staging-api.nammadaari.com → localhost:3011 (staging nginx, port-exposed)

Vercel (one project, two branch domains):
  nammadaari.com ← main branch → coming soon page.tsx
  staging.nammadaari.com ← staging branch → full citizen app page.tsx
```

### Recommended File Additions

```
repo root/
├── docker-compose.production-server.yml   ← renamed from docker-compose.server.yml
├── docker-compose.staging-server.yml      ← new; mirrors production override, port 3011
└── nginx/
    ├── nginx.server.conf                  ← unchanged (production)
    └── nginx.staging-server.conf          ← new; copy with upstream backend:3011

frontend/app/
├── page.tsx                               ← replaced on main with coming soon
└── coming-soon.module.css                 ← new; scoped styles for coming soon page

.planning/
└── config.json                            ← branching section added

backend/
└── railway.toml                           ← DELETED
```

### Pattern 1: Branch-conditional deploy.yml

```yaml
# Source: locked CONTEXT.md D-08
on:
  push:
    branches:
      - main
      - staging
  workflow_dispatch:

jobs:
  ci:
    uses: ./.github/workflows/ci.yml
    permissions:
      contents: read

  deploy-staging:
    name: "Deploy to Staging"
    needs: ci
    if: github.ref == 'refs/heads/staging'
    runs-on: [self-hosted, linux, walkability-staging]
    environment: staging
    steps: [...]

  deploy-production:
    name: "Deploy to Production"
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: [self-hosted, linux, walkability-prod]
    environment: production
    steps: [...]

  smoke-test-staging:
    needs: deploy-staging
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps: [...]

  smoke-test-production:
    needs: deploy-production
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps: [...]
```

**Critical:** `workflow_dispatch` must also work — add `if:` conditionals based on `github.ref` or `github.event.inputs.environment` to handle manual triggers.

### Pattern 2: docker-compose.staging-server.yml structure

```yaml
# Source: locked CONTEXT.md D-14
services:
  backend:
    expose:
      - "3011"
    environment:
      PORT: "3011"
    ports:
      - "3011:3011"    # NOTE: may need host binding for nginx health check; see pitfall below

  nginx:
    depends_on:
      backend:
        condition: service_healthy
      frontend:
        condition: service_started
        required: false
    volumes:
      - ./nginx/nginx.staging-server.conf:/etc/nginx/conf.d/default.conf:ro

  frontend:
    profiles:
      - frontend-only

volumes:
  postgres_staging_data:
  uploads_staging:
```

The staging nginx still listens on port 80 within its container network. The Cloudflare Tunnel's second ingress rule routes `staging-api.nammadaari.com` to `localhost:3011` — which means the staging nginx must expose port 3011 on the host (or the Cloudflare Tunnel must point to a different localhost port).

**Resolution:** The staging Compose stack's nginx must publish port 3011 → 80 on the host. The Cloudflare Tunnel ingress rule for staging points to `http://localhost:3011`. The staging nginx container listens on container port 80, published to host port 3011.

```yaml
# nginx service in staging override:
services:
  nginx:
    ports:
      - "3011:80"   # host:container — publishes staging nginx on host port 3011
```

This is the correct architecture: the Cloudflare Tunnel sees `http://localhost:3011` and routes to the staging nginx, which proxies to the staging backend on the internal Docker network.

### Pattern 3: coming-soon.module.css + page.tsx structure

The UI-SPEC.md is the complete locked design contract. Key implementation facts:
- `frontend/app/page.tsx` on `main` is replaced entirely (not a conditional render)
- The page is a Server Component — no `"use client"`, no hooks, no API calls
- All page-specific CSS in `coming-soon.module.css` (do NOT add to `globals.css`)
- Global classes to reuse from `globals.css`: `.press`, `.pulse`, `.kn`, `.mono`
- `<Bi>` and `<Btn>` components are NOT used on this page (UI-SPEC.md §Component Mapping)
- Instagram CTA is an `<a>` anchor with className `ig-btn press`, NOT `<Btn>`
- Wordmark uses inline `<span className="en">` / `<span className="kn">` — NOT `<Bi>`
- Copy is final: see UI-SPEC.md §Copywriting Contract (page title, all text, CTA href)
- Layout has `<html lang="en">` from existing `layout.tsx` — no change needed there

### Anti-Patterns to Avoid

- **Sharing Docker volumes between stacks**: Named volumes (`postgres_data`, `uploads`) belong to production. Staging must use distinct names (`postgres_staging_data`, `uploads_staging`). Docker volume names are global to the daemon — two Compose stacks on the same host will collide if volumes share a name.
- **Having staging nginx bind port 80 on the host**: Production nginx owns port 80 on the host (it's published in `docker-compose.yml`). Staging nginx must use a different host port (3011) or the `up` command fails with "address already in use".
- **Forgetting `required: false` for frontend in staging Compose**: The staging stack, like production, does not run the Next.js container. Without `required: false` on the frontend dependency, nginx will wait forever for a container that never starts.
- **Adding `PUBLIC_URL` to `docker-compose.yml` base file**: The base `docker-compose.yml` has `PUBLIC_URL: http://localhost`. Each server override must supply the correct value per environment. This must be added to the server override files, not the base file, since the base file is also used for local dev.
- **Mixing `workflow_dispatch` with branch conditionals carelessly**: `workflow_dispatch` does not set `github.ref` to a branch name in the same way a push event does. Use `github.ref == 'refs/heads/staging'` (not `github.ref == 'staging'`) in `if:` conditions, and ensure `workflow_dispatch` has a way to target the correct environment.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-environment secrets in CI | Env vars in workflow YAML | GitHub Environments | Environments provide secret scoping, audit trail, required reviewers, and deployment history |
| Branch protection enforcement | Script or hook | GitHub branch protection rules | Rules are enforced server-side; git hooks are client-side and bypassable |
| Multi-stack Docker isolation | Shared Compose file with conditionals | Separate override files per environment | Compose overlay merging is complex; independent files are explicit and auditable |

---

## Common Pitfalls

### Pitfall 1: Staging nginx port conflicts with production nginx

**What goes wrong:** Both production and staging nginx containers try to publish port 80 on the host. The second `docker compose up` fails with "bind: address already in use".

**Why it happens:** `docker-compose.yml` base file publishes nginx `ports: ["80:80"]`. The staging override inherits this if the nginx service is not overridden to use a different host port.

**How to avoid:** In `docker-compose.staging-server.yml`, override the nginx service to use `ports: ["3011:80"]` (host port 3011, container port 80). The production Compose stack retains its existing `ports: ["80:80"]`.

**Warning signs:** `docker compose -f docker-compose.yml -f docker-compose.staging-server.yml up` exits immediately with "bind" error.

### Pitfall 2: Broken references after docker-compose.server.yml rename

**What goes wrong:** Renaming `docker-compose.server.yml` to `docker-compose.production-server.yml` without updating every reference causes the deploy job to fail silently (docker compose reports file not found).

**Why it happens:** The file is referenced in at least 14 locations in `DEPLOYMENT.md` and 2 in `deploy.yml`. A partial rename leaves broken references.

**How to avoid:** Do the rename + all reference updates in a single atomic commit. References to update: `deploy.yml` (2 occurrences), `DEPLOYMENT.md` (multiple), and `CLAUDE.md` (check — grep confirms 0 occurrences currently). Use `grep -r "docker-compose.server.yml"` to find all references before committing.

**Warning signs:** `deploy.yml` "Build and deploy on LXC" step fails with "no such file or directory".

### Pitfall 3: `PUBLIC_URL` not set in staging Compose override

**What goes wrong:** The staging backend builds image URLs using `PUBLIC_URL`, which defaults to `http://localhost` in the base `docker-compose.yml`. Image URLs in API responses from the staging environment point to `http://localhost/uploads/...` instead of `https://staging-api.nammadaari.com/uploads/...`.

**Why it happens:** `docker-compose.server.yml` currently does not override `PUBLIC_URL` (confirmed by grep — it only overrides nginx service and frontend profile). The production backend relies on the `PUBLIC_URL` being set in the GitHub Environment secret, but it's not in the Compose file directly. The staging Compose override must explicitly set `PUBLIC_URL: https://staging-api.nammadaari.com` under the backend service environment.

**How to avoid:** Add `PUBLIC_URL` to the backend service environment in both `docker-compose.production-server.yml` and `docker-compose.staging-server.yml`.

**Warning signs:** API responses contain `image_url` values starting with `http://localhost`.

### Pitfall 4: `coming-soon page.tsx` lands on `staging` branch instead of `main` only

**What goes wrong:** The `page.tsx` replacement is committed to the working branch, which targets `staging`. After merge, both `staging.nammadaari.com` (full app) and `nammadaari.com` (coming soon) lose the citizen app home page.

**Why it happens:** Confusion between which branch the coming soon page lives on. CONTEXT.md D-23 explicitly states this change goes on `main`, not `staging`.

**How to avoid:** The coming soon `page.tsx` must be committed directly to `main` (or to a branch that PRs to `main`). This is one of the few changes in this phase that targets `main` directly. Since `main` has branch protection requiring CI + approval, the commit flow is: create `phase/06-coming-soon-main` branch → PR to `main` → approve → merge.

**Warning signs:** `staging.nammadaari.com` shows "Coming soon" after deploy instead of the citizen report form.

### Pitfall 5: `workflow_dispatch` triggers deploy to wrong environment

**What goes wrong:** `workflow_dispatch` triggers `deploy.yml` but `github.ref` is `refs/heads/main` by default, so only the production deploy job runs even when the operator intended to trigger a staging re-deploy.

**Why it happens:** `workflow_dispatch` defaults to the default branch (`main`). The `if:` conditionals based on `github.ref` work correctly for branch push events but may mislead operators for manual triggers.

**How to avoid:** Add a `workflow_dispatch` input parameter `environment: { type: choice, options: [staging, production] }` and adjust `if:` conditions to check both `github.ref` and the input. Alternatively, document clearly that `workflow_dispatch` from `staging` branch requires selecting the staging branch in the GitHub UI "Run workflow" dropdown.

### Pitfall 6: GitHub branch protection blocks the staging branch creation itself

**What goes wrong:** Attempting to set branch protection on `staging` before the branch exists on remote will succeed (GitHub allows protecting non-existent branches), but the first push to create the branch may be blocked.

**Why it happens:** Branch protection rules can be set up before the branch exists, but they immediately apply — including the "no direct push" rule. Creating a new branch by pushing to remote counts as a direct push.

**How to avoid:** The correct sequence is: (1) create `staging` locally from `main` HEAD, (2) push `staging` to remote, (3) set branch protection rules. Do NOT set protection rules before the initial push.

---

## Runtime State Inventory

> This phase is not a rename/refactor. However, it does involve renaming a Compose file and updating domain names. Relevant runtime state is documented below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | PostgreSQL `walkability` database on production LXC at `/opt/nammadaari/` — volumes `postgres_data` and `uploads` | No migration needed; Compose file rename does not affect named volumes |
| Live service config | Cloudflare Tunnel daemon (`cloudflared.service`) on Arch Linux VM — config at `/etc/cloudflared/config.yml` — currently has one ingress rule for `api-walkability.nammadaari.com` | Manual step: edit config, add `staging-api.nammadaari.com` ingress, rename `api-walkability` to `api` ingress, restart cloudflared |
| OS-registered state | GitHub Actions self-hosted runner on Arch VM with labels `[self-hosted, linux, walkability-prod]` | Manual step: add `walkability-staging` label via GitHub Settings → Actions → Runners → Edit |
| Secrets/env vars | GitHub Environment `production` has JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGIN. New `staging` GitHub Environment needed with its own secret values | Create `staging` environment via GitHub Settings → Environments; populate secrets |
| Build artifacts | `backend/railway.toml` — stale artifact from Railway era | Code deletion (D-29); no data migration needed |

**Domain state:** `api-walkability.nammadaari.com` CNAME exists in Cloudflare DNS pointing to the tunnel. After the hostname rename in cloudflared config, the DNS record for `api-walkability.nammadaari.com` should be removed and `api.nammadaari.com` CNAME added. `staging-api.nammadaari.com` CNAME must be added.

---

## Code Examples

### Verified patterns from codebase inspection

#### deploy.yml branch-conditional job structure
```yaml
# Source: locked decisions D-08, D-10 — derived from existing deploy.yml structure
jobs:
  ci:
    uses: ./.github/workflows/ci.yml
    permissions:
      contents: read

  deploy-staging:
    needs: ci
    if: github.ref == 'refs/heads/staging'
    runs-on: [self-hosted, linux, walkability-staging]
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Copy files to LXC
        run: |
          rsync -avz --exclude='.git' \
            -e "ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no" \
            ./ root@192.168.1.152:/opt/nammadaari-staging/
      - name: Build and deploy staging stack
        run: |
          ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no root@192.168.1.152 \
            "cd /opt/nammadaari-staging && \
             docker compose -f docker-compose.yml -f docker-compose.staging-server.yml build backend && \
             docker compose -f docker-compose.yml -f docker-compose.staging-server.yml up -d --remove-orphans db backend nginx"

  deploy-production:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: [self-hosted, linux, walkability-prod]
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Copy files to LXC
        run: |
          rsync -avz --exclude='.git' \
            -e "ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no" \
            ./ root@192.168.1.152:/opt/nammadaari/
      - name: Build and deploy production stack
        run: |
          ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no root@192.168.1.152 \
            "cd /opt/nammadaari && \
             docker compose -f docker-compose.yml -f docker-compose.production-server.yml build backend && \
             docker compose -f docker-compose.yml -f docker-compose.production-server.yml up -d --remove-orphans db backend nginx"
```

#### nginx.staging-server.conf upstream block (only difference from production)
```nginx
# Source: locked decision D-15 — independent copy with port 3011
upstream backend {
    server backend:3011;
}
```

#### config.json branching section (exact per D-28)
```json
"branching": {
  "working_branch": "staging",
  "protected": ["main", "staging"],
  "merge_targets": {
    "feat": "staging",
    "fix": "staging",
    "phase": "staging"
  },
  "milestone_merge": {
    "from": "staging",
    "to": "main"
  }
}
```

#### Coming soon page metadata override
```tsx
// Source: locked UI-SPEC.md — page title override required
export const metadata: Metadata = {
  title: "Namma Daari — Coming Soon",
};
```

Note: This page-level `metadata` export overrides the root layout metadata for this route only, which is standard Next.js 14 App Router behaviour. No layout.tsx change needed.

---

## Environment Availability

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| `staging` branch on remote | Branch protection setup, Vercel domain mapping | No — must be created | Push from local `main` HEAD before any other step |
| GitHub Environment `staging` | D-09 secret isolation | No — must be created | Settings → Environments → New environment |
| Runner label `walkability-staging` | D-10 staging deploy job targeting | No — must be added | Settings → Actions → Runners → Edit existing runner |
| `staging-api.nammadaari.com` DNS CNAME | D-17 staging API domain | No — must be added | Cloudflare dashboard; add CNAME to tunnel UUID |
| `api.nammadaari.com` DNS CNAME | D-16 production API domain rename | No — must be updated | Rename `api-walkability` CNAME to `api` in Cloudflare DNS |
| Vercel branch domain `staging.nammadaari.com` | D-21 staging frontend | Likely already exists (staging UAT was running) | Verify in Vercel Project Settings → Domains |
| Vercel domain `nammadaari.com` → `main` branch | D-21 production frontend | Likely already exists | Verify in Vercel Project Settings → Domains |

**Missing dependencies with no fallback (block phase execution):**
- `staging` branch must be created before branch protection rules can be applied
- GitHub Environment `staging` must exist before staging deploy can reference its secrets
- Runner label `walkability-staging` must be added before staging deploy job can route to the runner

**Missing dependencies with manual-only resolution (Cloudflare dashboard):**
- Cloudflare Tunnel config update (hostname rename + new ingress rule) — no CLI automation; must be done in the cloudflared config file on the LXC and restarted

---

## Validation Architecture

> `nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Frontend framework | Jest (via `npm test` in `frontend/`) |
| Backend framework | `cargo test` (unit tests in `backend/src/`) |
| Config | `frontend/package.json` → `"test"` script; `backend/Cargo.toml` |
| Quick run (frontend) | `cd frontend && npm test -- --passWithNoTests --watchAll=false` |
| Quick run (backend) | `cd backend && cargo test` |
| Full suite | `npm test -- --passWithNoTests --watchAll=false && cargo test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAUNCH-01 | Coming soon page renders with correct copy and CTA | Manual — browser visual verification | N/A (no Playwright/Cypress) | N/A |
| LAUNCH-02 | Push to `main` triggers production deploy | Manual — GitHub Actions run observation | N/A | N/A |
| LAUNCH-03 | Push to `staging` triggers staging deploy | Manual — GitHub Actions run observation | N/A | N/A |
| LAUNCH-04 | DEPLOYMENT.md reflects new workflow | Manual — document review | N/A | N/A |
| LAUNCH-05 | config.json has `branching` section | Automated — `cat .planning/config.json | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'branching' in d"` | N/A | ✅ config.json exists |

**Note:** LAUNCH-01 through LAUNCH-04 are infrastructure and documentation changes. Their verification is inherently manual (deploy run observation, browser check). The existing CI suite (`frontend-checks`, `backend-checks`, `docker-build`) validates that the codebase still compiles and passes linting — this is the automated gate.

### Sampling Rate

- **Per task commit:** `cd frontend && npm test -- --passWithNoTests --watchAll=false && cd ../backend && cargo test`
- **Per wave merge:** Same as above — no integration test suite exists
- **Phase gate:** CI passes on GitHub Actions for both `staging` and `main` branches; manual smoke tests per environment confirm health endpoints respond

### Wave 0 Gaps

None — no new test files are required. The coming soon page is a pure UI static render with no logic to unit test. CI already validates compilation and lint.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Admin auth unchanged; no new auth in this phase |
| V3 Session Management | No | Session cookies unchanged |
| V4 Access Control | Partial | GitHub branch protection enforces PR requirement (CI gate) |
| V5 Input Validation | No | No new user inputs |
| V6 Cryptography | No | JWT_SECRET and POSTGRES_PASSWORD are existing secrets, not new |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Staging credentials matching production | Information Disclosure | D-09: separate GitHub Environments with independent secrets; staging POSTGRES_PASSWORD must differ from production |
| Production nginx port accidentally exposed as staging port | Spoofing | Staging nginx uses host port 3011 (not 80); production owns port 80 exclusively |
| Railway cleanup exposes unused deploy path | Elevation of Privilege | D-29: `railway.toml` removed; Railway is no longer a live deployment target and the file's presence is confusing |
| ADMIN_SEED_PASSWORD left in production environment after first boot | Information Disclosure | D-27: document removal of seed secrets after first successful admin login in DEPLOYMENT.md |

---

## Open Questions

1. **Staging LXC directory path**
   - What we know: Production deploys to `/opt/nammadaari/` on LXC at `192.168.1.152`
   - What's unclear: Does `/opt/nammadaari-staging/` already exist on the LXC, or does the initial rsync create it? Docker Compose's first `up` will create the directory if rsync doesn't.
   - Recommendation: The deploy job should include a `mkdir -p /opt/nammadaari-staging` step before rsync, or verify rsync creates the parent. This is a plan-level decision, not a research gap.

2. **Cloudflare Tunnel second ingress port targeting**
   - What we know: The existing tunnel config has one ingress: `api-walkability.nammadaari.com → http://localhost:80`
   - What's unclear: The second ingress for `staging-api.nammadaari.com` should point to `http://localhost:3011` (the staging nginx host port). This is confirmed by D-14/D-16, but the actual cloudflared config file on the LXC must be edited manually — its current state is unknown.
   - Recommendation: Flag as a manual checkpoint in the plan. The planner should include a verification step: `curl http://localhost:3011/health` from the LXC to confirm staging nginx is reachable before testing the tunnel.

3. **workflow_dispatch environment selection**
   - What we know: The current `deploy.yml` has `workflow_dispatch:` with no inputs
   - What's unclear: After restructuring, `workflow_dispatch` will need to target either staging or production. Without an environment input, manual triggers from main always hit production.
   - Recommendation: Add `workflow_dispatch` input `environment: { type: choice, options: [staging, production] }` and update `if:` conditions accordingly. Otherwise document the limitation.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to This Phase |
|-----------|----------------------|
| All env-var config in `frontend/app/lib/config.ts` | Coming soon page has no env-var config; `NEXT_PUBLIC_API_URL` change is a Vercel env var, not a code change. `config.ts` unchanged. |
| Leaflet map components use `dynamic(..., { ssr: false })` | Not relevant — coming soon page has no map. |
| EXIF stripping server-side | Not relevant — no new uploads in this phase. |
| SQLx compile-time checks: run `cargo sqlx prepare` after SQL changes | Not relevant — no SQL changes in this phase. |
| `docker-compose.dev.yml` for local dev | Not relevant — this phase modifies server-only overrides. Dev workflow unchanged. |
| Git Safety Rules: Never commit code edits directly to `main`, `master`, `release-*`, or `phase-*` during audit/UAT/fix work | EXCEPTION: The coming soon `page.tsx` MUST land on `main`. This is not an audit/fix session — it is a planned phase execution. The correct branch discipline is: create `phase/06-coming-soon` → PR to `main` → merge. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel project already has `staging.nammadaari.com` domain assigned (staging UAT was live) | Environment Availability | Low — easily verified in Vercel dashboard before execution; if absent, add domain mapping |
| A2 | The LXC at `192.168.1.152` has root SSH access available via the same `nammadaari-lxc` key for both production and staging deploys | Architecture Patterns | Medium — if staging requires a separate SSH key or user, the deploy job must be updated |
| A3 | `workflow_dispatch` without an environment input will default to running all jobs where `github.ref == 'refs/heads/main'` (i.e., only production jobs) | Common Pitfalls | Low — this is documented GitHub Actions behaviour; the risk is operator confusion, not a broken deploy |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `main` branch deploys to single environment | `staging` → staging stack; `main` → production stack | This phase | Enables safe testing before production promotion |
| Railway backend hosting | Self-hosted Arch Linux + Cloudflare Tunnel | Phase 02.4 | `railway.toml` removal is cleanup from this migration |
| `docker-compose.server.yml` | `docker-compose.production-server.yml` | This phase | Clearer naming; both stacks coexist |

**Deprecated/outdated after this phase:**
- `docker-compose.server.yml`: deleted, replaced by `docker-compose.production-server.yml`
- `backend/railway.toml`: deleted, Railway decommissioned in Phase 02.4
- `api-walkability.nammadaari.com`: renamed to `api.nammadaari.com` (Cloudflare Tunnel hostname)
- Existing DEPLOYMENT.md: entirely rewritten to reflect new branching model and domain names

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `.github/workflows/deploy.yml` — existing trigger, job structure, rsync commands, smoke test pattern
- `.github/workflows/ci.yml` — three CI jobs (`frontend-checks`, `backend-checks`, `docker-build`), `workflow_call` trigger
- `docker-compose.server.yml` — existing production override structure, volume names, nginx dependency pattern
- `docker-compose.yml` — base service definitions, volume names, PORT env var, PUBLIC_URL default
- `nginx/nginx.server.conf` — complete production nginx config; upstream `backend:3001`; all rate-limiting zones
- `frontend/app/page.tsx` — current home page to be replaced on main
- `frontend/app/globals.css` — `.press`, `.pulse`, `.kn`, `.mono` global classes confirmed present
- `frontend/app/lib/config.ts` — `NEXT_PUBLIC_API_URL` env var usage confirmed
- `frontend/app/layout.tsx` — Root layout, font vars, metadata structure
- `.planning/phases/06-production-launch-git-branching-workflow/06-UI-SPEC.md` — locked coming soon design contract
- `.planning/config.json` — current config structure; `branching` key absent
- `DEPLOYMENT.md` — 14+ occurrences of `docker-compose.server.yml` to update; domain names to update
- `backend/railway.toml` — confirmed present; to be deleted

### Secondary (MEDIUM confidence — locked decisions from discuss session)
- `06-CONTEXT.md` — 30 locked decisions covering all aspects of this phase; treated as authoritative

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all tooling confirmed in codebase
- Architecture: HIGH — derived from direct file inspection and locked CONTEXT.md decisions
- Pitfalls: HIGH — identified from concrete file state (port conflicts, missing PUBLIC_URL, 14+ references to rename)
- Coming soon page design: HIGH — locked in UI-SPEC.md with complete pixel-accurate contract

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (30 days — infrastructure decisions are stable)
