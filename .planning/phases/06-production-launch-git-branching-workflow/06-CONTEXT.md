# Phase 6: Production Launch + Git Branching Workflow - Context

**Gathered:** 2026-06-21T18:14:38Z
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the permanent staging/main branching model, create separate backend stacks for staging and production, publish a coming soon page on nammadaari.com (main), and keep staging.nammadaari.com running as the full app (staging branch). This phase ends when:
- Pushing to `staging` auto-deploys the full app to staging.nammadaari.com
- Pushing to `main` auto-deploys nammadaari.com (coming soon page for now)
- Both branches have GitHub branch protection rules enforced
- DEPLOYMENT.md reflects the new branching model
- GSD config documents `staging` as the working branch target

No new product features. No new backend API endpoints. No database schema changes.

</domain>

<decisions>
## Implementation Decisions

### Branching model
- **D-01:** Working branches (`feat/*`, `fix/*`, `phase/*`) target `staging` as their merge destination. `/gsd-ship` creates a PR from the working branch to `staging`. Direct pushes to `staging` or `main` are blocked by GitHub branch protection rules.
- **D-02:** Milestone promotion: `/gsd-complete-milestone` merges `staging` into `main`. This is the only way code reaches `main`. At that point nammadaari.com serves the full app.
- **D-03:** `staging` branch does not yet exist in remote — it must be created from the current `main` HEAD as part of this phase.

### GitHub branch protection
- **D-04:** Both `main` and `staging` have GitHub branch protection rules enabled.
- **D-05:** Rules for both branches: PR required before merging; CI must pass (all three jobs: `frontend-checks`, `backend-checks`, `docker-build`); 1 approval required.
- **D-06:** Self-approve is allowed (solo developer workflow) — the PR author can approve their own PR on `staging`. On `main`, same rule applies (milestone merges are deliberate manual events).
- **D-07:** Direct pushes to `main` or `staging` are blocked for all users. No bypass even for admins — the CI gate is the safety net.

### Deploy workflow
- **D-08:** One `deploy.yml` with branch conditionals. Triggers on push to `main` OR `staging`. Job-level `if:` conditions determine which Compose stack and GitHub Environment to use.
- **D-09:** GitHub Environments: two separate environments — `staging` and `production` — each holding their own secrets (JWT_SECRET, POSTGRES_PASSWORD, CORS_ORIGIN, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD).
- **D-10:** Self-hosted runner labels: the existing runner on the Arch Linux VM gets a second label `walkability-staging` in addition to `walkability-prod`. Staging deploy job uses `[self-hosted, linux, walkability-staging]`, production deploy job uses `[self-hosted, linux, walkability-prod]`.
- **D-11:** `deploy.yml` deploys the backend only. Frontend deploys are handled by Vercel (triggered by pushes to `staging` or `main` automatically). Smoke tests hit the backend health endpoint + Vercel frontend URL for each environment.

### Docker Compose stacks
- **D-12:** Two separate Compose stacks on the same Proxmox LXC. Each is fully isolated with its own containers, volumes, and env vars.
- **D-13:** `docker-compose.server.yml` → renamed to `docker-compose.production-server.yml`. All references in `deploy.yml`, `DEPLOYMENT.md`, and `CLAUDE.md` updated accordingly.
- **D-14:** New `docker-compose.staging-server.yml` for the staging stack. Mirrors `docker-compose.production-server.yml` but overrides ports and volumes:
  - Backend internal port: **3011** (production: 3001)
  - PostgreSQL internal port: **5433** (production: 5432)
  - Named volumes: `postgres_staging_data`, `uploads_staging` (production: `postgres_data`, `uploads`)
  - Nginx config: `nginx/nginx.staging-server.conf` (production: `nginx/nginx.server.conf`)
- **D-15:** New `nginx/nginx.staging-server.conf` — independent copy of `nginx/nginx.server.conf` with upstream pointing to backend port 3011 instead of 3001. The two nginx configs are independent files; no conditionals or shared includes.

### Domains and API URLs
- **D-16:** Production API domain changes from `api-walkability.nammadaari.com` → **`api.nammadaari.com`**. The existing Cloudflare Tunnel hostname is updated (not a new tunnel, just a hostname rename in the tunnel config). A second ingress rule is added for `staging-api.nammadaari.com` → nginx on port 3011.
- **D-17:** Staging API domain: **`staging-api.nammadaari.com`**.
- **D-18:** All backend `CORS_ORIGIN` values:
  - Production GitHub Environment: `https://nammadaari.com`
  - Staging GitHub Environment: `https://staging.nammadaari.com`
- **D-19:** `PUBLIC_URL` (used to construct image URLs in API responses):
  - Production: `https://api.nammadaari.com`
  - Staging: `https://staging-api.nammadaari.com`
- **D-20:** DEPLOYMENT.md §Environment Variables table: update `CORS_ORIGIN` example from `https://staging-walkability.kinariwala.com` to `https://nammadaari.com`.

### Vercel frontend setup
- **D-21:** One Vercel project, two branch-to-domain mappings. In Vercel Project Settings → Domains:
  - `nammadaari.com` assigned to the `main` branch (production domain)
  - `staging.nammadaari.com` assigned to the `staging` branch (branch-specific production domain)
- **D-22:** Vercel env vars per branch:
  - `main` branch: `NEXT_PUBLIC_API_URL=https://api.nammadaari.com`, `INTERNAL_API_URL=https://api.nammadaari.com`
  - `staging` branch: `NEXT_PUBLIC_API_URL=https://staging-api.nammadaari.com`, `INTERNAL_API_URL=https://staging-api.nammadaari.com`
  - Note: On Vercel there is no internal Docker network, so `INTERNAL_API_URL` = `NEXT_PUBLIC_API_URL` for both environments.

### Coming soon page (main branch)
- **D-23:** `frontend/app/page.tsx` on the `main` branch is replaced with a coming soon page. The rest of the app routes (`/map`, `/report`, `/reports`, `/admin`) remain intact and accessible via direct URL — but are not linked from the coming soon page. No Next.js middleware gate; no env var toggle.
- **D-24:** The coming soon page matches the existing frontend design system: uses CSS variable tokens (`--color-*`, `--font-*`, `--radius-*`), `Bi` component for bilingual English/Kannada text, `Btn` component for the Instagram CTA, and `SectionLabel` if a section heading is used.
- **D-25:** Coming soon page content: brand name (Namma Daari / ನಮ್ಮ ದಾರಿ) + tagline (one line) + 2–3 sentence description of the platform + Instagram CTA (@nammadaariblr). **Exact copy is a pending input** — user will provide the copy generated from the LLM prompt before plan execution begins.
- **D-26:** Flip mechanism: when `/gsd-complete-milestone` merges `staging` into `main`, the full `app/page.tsx` from staging naturally overwrites the coming soon page. No code removal step needed beyond the merge itself.

### Admin seed for production
- **D-27:** Production GitHub Environment includes `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` secrets. First boot of the production stack seeds the super-admin. These secrets should be removed from the GitHub Environment after the first successful admin login to prevent accidental re-seed on future deploys (the seed function is idempotent, but removing them is good hygiene).

### GSD config update (LAUNCH-05)
- **D-28:** Add a `branching` section to `.planning/config.json`:
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

### Railway cleanup
- **D-29:** Remove `backend/railway.toml` — Railway is no longer used (replaced by self-hosted Proxmox in Phase 02.4).
- **D-30:** Remove `RAILWAY_BACKEND_URL` references from `deploy.yml` smoke tests (the conditional that skips Railway health checks if the secret is unset). Replace with explicit staging/production smoke test steps per environment.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §LAUNCH — All 5 LAUNCH requirements with acceptance criteria (LAUNCH-01 through LAUNCH-05)
- `.planning/PROJECT.md` §Active — Active v1.1 production launch items list

### Existing infrastructure files (must be read before modifying)
- `.github/workflows/deploy.yml` — Current deploy workflow (triggers on `main` only; must be extended for `staging` branch)
- `.github/workflows/ci.yml` — Current CI workflow (triggered on all branches; read before wiring branch protection)
- `docker-compose.server.yml` → will be renamed to `docker-compose.production-server.yml`; read before creating staging counterpart
- `nginx/nginx.server.conf` — Production nginx config; staging config is a copy of this with port changed to 3011
- `DEPLOYMENT.md` — Current runbook; update branching model, domains, env var table, and Compose file names

### Frontend files (coming soon page)
- `frontend/app/page.tsx` — Current home page; replaced on `main` with the coming soon page
- `frontend/app/lib/config.ts` — ALL env-var config including `API_BASE_URL`; NEXT_PUBLIC_API_URL change lands here indirectly (Vercel env var, not code change)
- `frontend/app/components/ui/Bi.tsx` — Bilingual text component; use for English/Kannada text on coming soon page
- `frontend/app/components/ui/Btn.tsx` — Button component; use for Instagram CTA
- `frontend/app/globals.css` (or equivalent) — CSS variable tokens that coming soon page must use
- `frontend/app/admin/admin.css` — Admin CSS variable reference (to understand the design system)

### GSD config
- `.planning/config.json` — Add `branching` section per D-28

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Bi` component (`frontend/app/components/ui/Bi.tsx`): renders bilingual text (English primary, Kannada subtitle) — use for the coming soon tagline and description
- `Btn` component (`frontend/app/components/ui/Btn.tsx`): button with variant/size/tone props — use for the Instagram CTA button
- CSS variable tokens (`--color-*`, `--font-*`, `--radius-*`): coming soon page must use these directly, not hardcoded values
- `SectionLabel` component: optional section heading with Kannada subtitle

### Established Patterns
- **Config rule** (CLAUDE.md): all env-var config in `frontend/app/lib/config.ts`. `NEXT_PUBLIC_API_URL` change is a Vercel env var change, not a code change — `config.ts` already reads it correctly.
- **Deploy flow** (`deploy.yml`): SSH into LXC at `192.168.1.152` via runner, rsync files, then `docker compose ... build backend && up`. Staging deploy follows the same pattern, targeting the staging Compose stack.
- **Smoke tests**: current smoke tests call `${{ vars.BACKEND_URL }}/health` and `${{ vars.FRONTEND_URL }}`. After update, each environment (staging / production) has its own `BACKEND_URL` and `FRONTEND_URL` GitHub variables per Environment.
- **SSR caveat**: map components use `dynamic(() => import(...), { ssr: false })` — not relevant for the coming soon page (no map).

### Integration Points
- `deploy.yml` `on.push.branches`: currently `[main]` → must become `[main, staging]`
- `docker-compose.production-server.yml` (renamed): existing named volumes `postgres_data` and `uploads` must not change — renaming the file must not rename the volumes
- `nginx/nginx.server.conf`: the `proxy_pass http://backend:3001` line is the only significant difference from `nginx/nginx.staging-server.conf` (which will use `proxy_pass http://backend:3011`)
- `.planning/config.json`: `branching` key is new; existing keys (`mode`, `granularity`, etc.) must not change

</code_context>

<specifics>
## Specific Ideas

- **docker-compose.production-server.yml rename**: When renaming `docker-compose.server.yml`, verify ALL references in the repo — `deploy.yml`, `DEPLOYMENT.md`, `CLAUDE.md`, and any README snippets — are updated in the same commit. A broken reference in `deploy.yml` causes a silent deploy failure.
- **Coming soon page copy**: The exact English text and Kannada tagline are a pending input from the user (generated via an LLM social media manager prompt). The planner should scaffold the coming soon page component with placeholder text and note that copy must be substituted before shipping. The component structure and design should be finalized without the copy.
- **Cloudflare Tunnel hostname change**: `api-walkability.nammadaari.com` → `api.nammadaari.com` is a Cloudflare dashboard change (not a code change). It should be performed manually by the user as part of this phase. DEPLOYMENT.md should document the updated hostname. The planner should note this as a manual step, not an automated one.
- **`staging` branch creation**: The `staging` branch does not exist yet. It must be created from the current `main` HEAD before branch protection rules can be applied. The correct sequence: create `staging` branch → push to remote → configure Vercel domain → set GitHub branch protection rules → update `deploy.yml` trigger.
- **Volume name safety on rename**: `docker-compose.server.yml` rename to `docker-compose.production-server.yml` does NOT rename Docker volumes. Named volumes (`postgres_data`, `uploads`) are referenced by name in the Compose file — they persist across Compose file renames. No data loss risk from the rename.

</specifics>

<deferred>
## Deferred Ideas

- **Full production launch (app goes live)**: nammadaari.com serving the full citizen reporting app happens at the NEXT milestone completion (`/gsd-complete-milestone`), not in this phase. This phase only sets up the branching infrastructure and coming soon page.
- **Email signup on coming soon page**: No email capture. Instagram CTA only. Email notifications are a v1.2+ feature (NOTIF-01/02 in REQUIREMENTS.md).
- **Countdown timer on coming soon**: Not included. No committed launch date.
- **Reviewed todo (not folded)**: `auto-assign-org-from-ward.md` — matched Phase 6 keywords but is unrelated to production launch. Deferred; belongs in a future backend enhancement phase.

</deferred>

---

*Phase: 6-Production-Launch-Git-Branching-Workflow*
*Context gathered: 2026-06-21T18:14:38Z*
