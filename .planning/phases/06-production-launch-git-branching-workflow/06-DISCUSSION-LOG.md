# Phase 6: Production Launch + Git Branching Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21T18:14:38Z
**Phase:** 06-production-launch-git-branching-workflow
**Areas discussed:** Coming soon scope, Staging Vercel setup, Coming soon → full app flip, Branch protection enforcement, Staging backend API domain, Deploy workflow structure, Staging ports, GitHub Environments, Runner labels, Coming soon content, Staging nginx config, Vercel env vars, Admin seed, GSD config, Compose file naming, Railway cleanup, Cloudflare Tunnel, Compose file rename, PR approval model

---

## Branching model (user-initiated context)

| Option | Description | Selected |
|--------|-------------|----------|
| Current: main → staging.nammadaari.com | All feature work merges to main; main deploys to staging | |
| New: staging branch → staging.nammadaari.com | Dedicated staging branch; main → nammadaari.com (production) | ✓ |

**User's choice:** New permanent branching model. staging branch = working integration target; main = production-only, populated via milestone merges.
**Notes:** User clarified that the frontend is already on Vercel at staging.nammadaari.com, backend is at api-walkability.nammadaari.com on an LXC on a Proxmox box. Runner is on an Arch Linux VM on the same Proxmox box. Current workflow: branches merge to main, deploy to staging. Goal: flip this so main → nammadaari.com (production) and staging branch → staging.nammadaari.com.

---

## Coming soon scope

| Option | Description | Selected |
|--------|-------------|----------|
| Coming soon page only (hard gate) | Whole site shows coming soon; /map, /report inaccessible | |
| Coming soon page + app behind it | / = coming soon, full app still reachable via direct URL | ✓ (implied) |
| Env var toggle | NEXT_PUBLIC_COMING_SOON gate; flip without code change | |

**User's choice:** Home page only (app/page.tsx on main = coming soon). Full app unlinked but accessible. Flip via staging→main milestone merge.
**Notes:** User asked for industry best practice. Recommendation: home page only — cleanest match for the merge-based flip workflow; admin routes still work; no env var debt.

---

## Staging Vercel setup

| Option | Description | Selected |
|--------|-------------|----------|
| Two Vercel projects | One project per environment; independent env vars | |
| One Vercel project, two branches | Same project; staging branch gets staging.nammadaari.com via branch-specific domain | ✓ |

**User's choice:** One Vercel project, two branches.
**Notes:** Vercel Project Settings → Domains: assign nammadaari.com to main, staging.nammadaari.com to staging branch.

---

## Backend separation

| Option | Description | Selected |
|--------|-------------|----------|
| One shared backend for both | Single stack, single DB | |
| Separate staging and production backends | Two stacks, two DBs, two uploads volumes | ✓ |
| One backend, two databases + uploads | Shared binary, separate data | (User's phrasing; resolved to two stacks) |

**User's choice:** Two Docker Compose stacks on the same Proxmox LXC — each with its own DB and uploads volume.
**Notes:** User asked "Can we have one backend and two databases and /uploads directories?" — resolved as two separate Compose stacks (industry best practice), each fully isolated. Production stack: ports 3001/5432, volumes postgres_data/uploads. Staging stack: ports 3011/5433, volumes postgres_staging_data/uploads_staging.

---

## Coming soon → full app flip

| Option | Description | Selected |
|--------|-------------|----------|
| Home page swap | app/page.tsx on main = coming soon; milestone merge replaces it | ✓ |
| Full site middleware gate | All routes redirect to / until milestone merge removes rule | |
| Env var toggle | NEXT_PUBLIC_COMING_SOON; flip without redeploy | |

**User's choice:** Home page only. Flip = staging merges to main at /gsd-complete-milestone.
**Notes:** Industry best practice recommendation accepted.

---

## Branch protection enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub branch protection rules | Real enforcement; PR + CI required; no direct push | ✓ |
| Documentation only | DEPLOYMENT.md documents workflow; trust-based | |
| Protection on main only | staging unprotected | |

**User's choice:** GitHub branch protection rules on both main and staging.

---

## PR approval model (staging)

| Option | Description | Selected |
|--------|-------------|----------|
| CI must pass, no PR required | Direct push allowed; only CI gates the branch | |
| PR required, self-approve allowed | PR created by author, approved by author, CI must pass | ✓ |

**User's choice:** PR required on staging too. 1 approval required; author can self-approve. /gsd-ship creates PR via gh pr merge --auto.

---

## Staging backend API domain

| Option | Description | Selected |
|--------|-------------|----------|
| staging-api.nammadaari.com | New subdomain for staging backend | ✓ |
| Same domain, path prefix | /staging/* on api-walkability.nammadaari.com | |

**User's choice:** staging-api.nammadaari.com for staging. Also: production backend renamed from api-walkability.nammadaari.com → api.nammadaari.com.

---

## Deploy workflow structure

| Option | Description | Selected |
|--------|-------------|----------|
| One file with branch conditionals | deploy.yml triggers on main + staging; job-level if: | ✓ |
| Two separate files | deploy-staging.yml + deploy-production.yml | |

**User's choice:** One file with conditionals.

---

## Staging ports

| Option | Description | Selected |
|--------|-------------|----------|
| Backend 3011, PostgreSQL 5433 | Non-conflicting with production (3001/5432) | ✓ |

**User's choice:** Backend 3011, PostgreSQL 5433. Confirmed.

---

## GitHub Environments

| Option | Description | Selected |
|--------|-------------|----------|
| Two environments (staging + production) | Independent secrets per environment | ✓ |
| One environment, separate secret names | STAGING_* vs PROD_* prefixes | |

**User's choice:** Two GitHub Environments.

---

## Runner labels

| Option | Description | Selected |
|--------|-------------|----------|
| Same runner, add walkability-staging label | One runner serves both; distinct labels for CI targeting | ✓ |
| Same runner, same label for both | Simpler; less distinguishable in logs | |

**User's choice:** Add walkability-staging label to existing runner.

---

## Coming soon page content

| Option | Description | Selected |
|--------|-------------|----------|
| Brand + tagline + Instagram CTA only | Minimal | |
| Brand + tagline + Instagram + brief description | 2–3 sentence mission description | ✓ |

**User's choice:** Brand + tagline + Instagram + brief description.
**Notes:** Exact copy will be generated by user via an LLM social media manager prompt and provided as a pending input before execution. Scaffold the component with placeholder copy.

---

## nginx staging config

| Option | Description | Selected |
|--------|-------------|----------|
| New nginx.staging-server.conf | Independent file; copy of nginx.server.conf with port 3011 | ✓ (industry best practice) |
| Extend nginx.server.conf | Conditionals in shared file | |

**User's choice:** New nginx.staging-server.conf. Industry best practice accepted.

---

## Vercel INTERNAL_API_URL

| Option | Description | Selected |
|--------|-------------|----------|
| Same as NEXT_PUBLIC_API_URL (public domain) | No Docker internal network on Vercel | ✓ |
| Different internal URL | User provides separate value | |

**User's choice:** INTERNAL_API_URL = NEXT_PUBLIC_API_URL for both environments on Vercel.

---

## Compose file name

| Option | Description | Selected |
|--------|-------------|----------|
| docker-compose.staging-server.yml | Consistent with existing .server.yml pattern | ✓ (industry best practice) |
| docker-compose.staging.yml | Shorter | |

**User's choice:** docker-compose.staging-server.yml. Industry best practice accepted.

---

## Production admin seed

| Option | Description | Selected |
|--------|-------------|----------|
| Seed via GitHub Environment secrets | Same pattern as staging; idempotent; remove after first login | ✓ |
| Start empty; create admin manually | More secure; more manual | |

**User's choice:** Seed via ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD in production GitHub Environment secrets.

---

## Cloudflare Tunnel

| Option | Description | Selected |
|--------|-------------|----------|
| Update existing tunnel hostname | api-walkability.nammadaari.com → api.nammadaari.com; add staging-api rule | ✓ |
| Handle manually outside this phase | Phase only documents expected hostnames | |

**User's choice:** Update existing tunnel (manual Cloudflare dashboard step; DEPLOYMENT.md documents it).

---

## docker-compose.server.yml rename

| Option | Description | Selected |
|--------|-------------|----------|
| Rename to docker-compose.production-server.yml | Symmetric naming with staging-server.yml | ✓ |
| Keep docker-compose.server.yml as-is | Less renaming; less confusion in live deployment | |

**User's choice:** Rename to docker-compose.production-server.yml.

---

## Railway cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Remove railway.toml + RAILWAY_BACKEND_URL from CI | Clean slate; Railway no longer used | ✓ |
| Leave as-is | Harmless; historical reference | |

**User's choice:** Remove railway.toml and all Railway references from deploy.yml.

---

## GSD config update

| Option | Description | Selected |
|--------|-------------|----------|
| Add branching section to .planning/config.json | Documents working_branch, protected branches, merge targets | ✓ |
| CLAUDE.md only | Update git safety rules section only | |

**User's choice:** Add branching section to config.json.

---

## Claude's Discretion

- **nginx.staging-server.conf content**: Exact copy of nginx.server.conf with `proxy_pass http://backend:3011`. Claude decides which lines to change vs keep identical.
- **deploy.yml conditional structure**: The exact `if:` expression syntax for branch conditionals (`github.ref == 'refs/heads/staging'` etc.). Claude follows GitHub Actions best practices.
- **Coming soon page component structure**: File name, component name, import structure — Claude follows existing Next.js App Router conventions in the project.

---

## Deferred Ideas

- **Full public launch**: Happens at the next `/gsd-complete-milestone`, not in this phase.
- **Email signup on coming soon page**: v1.2+ feature (NOTIF-01/02).
- **Countdown timer**: Not included; no committed launch date.
