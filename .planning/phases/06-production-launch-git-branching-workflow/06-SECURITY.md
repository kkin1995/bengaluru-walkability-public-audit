---
phase: 06
slug: production-launch-git-branching-workflow
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-22
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| GitHub → self-hosted runner | Workflow YAML instructs runner to SSH into LXC; secrets injected as env vars from GitHub Environments | SSH keys, JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGIN — all secrets-class |
| staging environment → production environment | Two independent GitHub Environments with separate secret sets; no shared values | None — environments are isolated by design |
| GitHub Actions → self-hosted runner | Workflow YAML is the trust boundary; only branches matching `if:` conditions reach each runner | Deployment commands, SSH private key |
| deploy-staging environment | Staging secrets injected into deploy-staging job only — production runner never sees staging secrets | Staging credentials only |
| deploy-production environment | Production secrets injected into deploy-production job only — staging runner never sees production secrets | Production credentials only |
| Staging nginx (port 3011) → staging backend (port 3011) | Internal Docker network; no host exposure of staging backend | API requests/responses — no PII at this boundary |
| Host port 3011 → staging nginx | Cloudflare Tunnel second ingress routes staging-api.nammadaari.com to localhost:3011 | Public API traffic |
| config.json → GSD tooling | GSD reads `branching.working_branch` to route /gsd-ship PRs | Config values only — no secrets |
| Browser → nammadaari.com (coming soon page) | Static Server Component; no auth, no user input, no API calls | None — fully static render |
| Instagram CTA anchor | Opens external URL in new tab; `rel="noopener"` prevents tab-napping | None — one-way navigation |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01-01 | Information Disclosure | staging secrets match production | mitigate | D-09: staging JWT_SECRET and POSTGRES_PASSWORD generated fresh with `openssl rand`; separate from production values. Human-confirmed: GitHub Environment `staging` created with 6 independent secrets. | closed |
| T-06-01-02 | Elevation of Privilege | branch protection bypass | mitigate | D-07: no admin bypass in branch protection rulesets. Human-confirmed: `protect-main` and `protect-staging` rulesets created; all merges require CI + PR. | closed |
| T-06-01-03 | Spoofing | staging branch created from wrong commit | mitigate | Task 1 verified current branch is `main` before branching; `git ls-remote` confirms push. Evidence: `git ls-remote --heads origin staging` returns `d43b87fa6a1cfe1d56f8ea23e312dd31a4395f16`. | closed |
| T-06-01-SC | Tampering | npm/pip/cargo installs | accept | No package manager installs in this plan — git and GitHub UI only. | closed |
| T-06-02-01 | Elevation of Privilege | staging job accidentally running against production | mitigate | Job-level `if:` conditions use full ref path `refs/heads/staging` vs `refs/heads/main` — no ambiguity. Verified: `deploy-staging` uses `environment: staging` and `runs-on: [self-hosted, linux, walkability-staging]`. | closed |
| T-06-02-02 | Information Disclosure | railway.toml left in repo exposes stale config | mitigate | D-29: `backend/railway.toml` deleted via `git rm`. Verified absent from `origin/staging`. | closed |
| T-06-02-03 | Tampering | docker-compose.server.yml reference left in deploy.yml | mitigate | Acceptance: `grep -c "docker-compose.server.yml" deploy.yml` = 0 on `origin/staging`. Verified. | closed |
| T-06-02-04 | Spoofing | workflow_dispatch manual trigger hitting wrong environment | mitigate | `workflow_dispatch` environment input prevents default-to-production confusion (RESEARCH.md Pitfall 5). Wired in deploy.yml. | closed |
| T-06-02-SC | Tampering | npm/pip/cargo installs | accept | No new packages installed in this plan. | closed |
| T-06-03-01 | Spoofing | staging nginx accidentally using production volumes | mitigate | D-14: distinct volume names `postgres_staging_data`, `uploads_staging` prevent collision. Verified: YAML parse confirms correct volume names in `docker-compose.staging-server.yml`. | closed |
| T-06-03-02 | Spoofing | production nginx port conflict with staging nginx | mitigate | Staging nginx publishes `3011:80` (not `80:80`). Verified: `nginx: ports: ['3011:80']` in staging Compose override. | closed |
| T-06-03-03 | Information Disclosure | PUBLIC_URL defaulting to http://localhost on staging | mitigate | Pitfall 3 (RESEARCH.md): `PUBLIC_URL=https://staging-api.nammadaari.com` explicitly set in staging Compose override. Verified via YAML parse. | closed |
| T-06-03-04 | Tampering | staging nginx config sharing includes with production | mitigate | D-15: `nginx/nginx.staging-server.conf` and `nginx/nginx.server.conf` are independent files. Verified: `grep -c backend:3011 nginx.staging-server.conf = 1`; production conf unchanged (`backend:3001 = 1`). | closed |
| T-06-03-SC | Tampering | npm/pip/cargo installs | accept | No new packages installed in this plan. | closed |
| T-06-04-01 | Tampering | config.json branching section malformed JSON | mitigate | `python3 json.load` validation exits 0. Confirmed in 06-04-SUMMARY.md. | closed |
| T-06-04-02 | Information Disclosure | DEPLOYMENT.md showing old domain api-walkability | mitigate | `grep -c "api-walkability" DEPLOYMENT.md` = 0 on `origin/staging`. Confirmed. | closed |
| T-06-04-03 | Tampering | Partial DEPLOYMENT.md update leaving inconsistent docker-compose references | mitigate | `grep -c "docker-compose.server.yml" DEPLOYMENT.md` = 0; Edit (scoped) not Write used. Confirmed. | closed |
| T-06-04-SC | Tampering | npm/pip/cargo installs | accept | Documentation and config changes only — no packages installed. | closed |
| T-06-05-01 | Tampering | Coming soon page accidentally merged to staging | mitigate | Task 1 enforced branch from `main`; checkpoint verified staging serves citizen app. Verified: `page.tsx` on `origin/staging` imports citizen app components — not the coming soon component. | closed |
| T-06-05-02 | Information Disclosure | Instagram CTA tab-napping (window.opener access) | mitigate | `rel="noopener"` on CTA anchor. Verified: `grep -c 'rel="noopener"' page.tsx` = 1 on `origin/main`. | closed |
| T-06-05-03 | Tampering | CSS variables not resolving (custom properties undefined) | mitigate | All `var(--)` tokens verified against `globals.css` before use. Verified: `coming-soon.module.css` has 37 `var(--)` references, zero hardcoded hex values. | closed |
| T-06-05-04 | Information Disclosure | Vercel env vars leaking production API URL to staging | mitigate | D-22: separate env var values per Vercel branch. Human-confirmed during Plan 05 Task 4: `staging.nammadaari.com` routes to staging branch with staging-specific env vars. | closed |
| T-06-05-SC | Tampering | npm/pip/cargo installs | accept | Coming soon page uses only existing project components and CSS — no new packages. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-01-SC | No npm/pip/cargo installs in Phase 06 Plan 01 — git and GitHub UI operations only. Supply chain attack surface is zero. | project team | 2026-06-22 |
| AR-06-02 | T-06-02-SC | No npm/pip/cargo installs in Phase 06 Plan 02 — CI/CD YAML and file deletion only. | project team | 2026-06-22 |
| AR-06-03 | T-06-03-SC | No npm/pip/cargo installs in Phase 06 Plan 03 — Docker Compose and nginx config authoring only. | project team | 2026-06-22 |
| AR-06-04 | T-06-04-SC | No npm/pip/cargo installs in Phase 06 Plan 04 — documentation and GSD config only. | project team | 2026-06-22 |
| AR-06-05 | T-06-05-SC | No npm/pip/cargo installs in Phase 06 Plan 05 — reuses existing project components and CSS. | project team | 2026-06-22 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-22 | 24 | 24 | 0 | Claude (gsd-security-auditor via gsd-secure-phase) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-22
