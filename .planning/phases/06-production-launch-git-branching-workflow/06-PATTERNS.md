# Phase 06: Production Launch + Git Branching Workflow — Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/deploy.yml` | config (CI/CD workflow) | event-driven | `.github/workflows/deploy.yml` (current) | exact — extend in place |
| `docker-compose.production-server.yml` | config (infrastructure) | — | `docker-compose.server.yml` (renamed) | exact — rename + update refs |
| `docker-compose.staging-server.yml` | config (infrastructure) | — | `docker-compose.server.yml` | exact — independent copy with port overrides |
| `nginx/nginx.staging-server.conf` | config (reverse proxy) | request-response | `nginx/nginx.server.conf` | exact — copy with upstream port change |
| `frontend/app/page.tsx` (main branch only) | component (page) | request-response | `frontend/app/page.tsx` (current) | same file — full replacement |
| `frontend/app/coming-soon.module.css` | config (styles) | — | `frontend/app/globals.css` | role-match — scoped CSS variables |
| `.planning/config.json` | config | — | `.planning/config.json` (current) | exact — additive key |

---

## Pattern Assignments

### `.github/workflows/deploy.yml` (CI/CD workflow, event-driven)

**Analog:** `.github/workflows/deploy.yml` (current file, lines 1-100)

**Trigger pattern** (current lines 21-26 — replace this block):
```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:
```

**New trigger pattern** (replace with):
```yaml
on:
  push:
    branches:
      - main
      - staging
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        description: "Target environment for manual deploy"
        options: [staging, production]
        default: staging
```

**CI reuse pattern** (current lines 27-31 — keep unchanged):
```yaml
jobs:
  ci:
    name: "Run CI checks"
    uses: ./.github/workflows/ci.yml
    permissions:
      contents: read
```

**Existing deploy job pattern** (current lines 32-54 — this becomes `deploy-production`):
```yaml
  deploy:
    name: "Deploy to Namma Daari LXC"
    needs: ci
    runs-on: [self-hosted, linux, walkability-prod]
    environment: production
    permissions:
      contents: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Copy updated files to LXC
        run: |
          rsync -avz --exclude='.git' \
            -e "ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no" \
            ./ root@192.168.1.152:/opt/nammadaari/

      - name: Build and deploy on LXC
        run: |
          ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no root@192.168.1.152 \
            "cd /opt/nammadaari && \
             docker compose -f docker-compose.yml -f docker-compose.server.yml build backend && \
             docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --remove-orphans db backend nginx"

      - name: Wait for local health
        run: |
          for i in 1 2 3 4 5 6; do
            if ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no root@192.168.1.152 \
              "curl -sf --max-time 5 http://localhost/health"; then
              echo ""
              echo "Local health OK on attempt $i"
              exit 0
            fi
            echo "Attempt $i/6 failed, retrying in 10s..."
            sleep 10
          done
          echo "Local health check failed after 6 attempts"
          exit 1
```

**Existing smoke-test pattern** (current lines 71-100 — this becomes `smoke-test-production`):
```yaml
  smoke-test:
    name: "Smoke test"
    needs: deploy
    runs-on: ubuntu-latest
    permissions: {}
    steps:
      - name: "Health check — Cloudflare tunnel backend (with retry)"
        run: |
          for i in 1 2 3 4 5; do
            if curl -sf --max-time 10 "${{ vars.BACKEND_URL }}/health"; then
              echo ""
              echo "Backend healthy on attempt $i"
              exit 0
            fi
            echo "Attempt $i/5 failed, retrying in 15s..."
            sleep 15
          done
          echo "Backend health check failed after 5 attempts"
          exit 1

      - name: "API check — reports endpoint"
        run: |
          curl -sf --max-time 10 "${{ vars.BACKEND_URL }}/api/reports" | head -c 200

      - name: "Frontend check — Vercel"
        run: |
          status=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 15 "${{ vars.FRONTEND_URL }}")
          echo "Frontend HTTP $status"
          [ "$status" -eq 200 ]
```

**New job `if:` guard pattern to add to both deploy and smoke-test jobs:**
```yaml
# On deploy-production:
    if: github.ref == 'refs/heads/main' || (github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'production')

# On deploy-staging:
    if: github.ref == 'refs/heads/staging' || (github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'staging')
```

**Reference update in deploy jobs** — change `docker-compose.server.yml` to `docker-compose.production-server.yml` in the production deploy step. Staging uses `docker-compose.staging-server.yml`. Railway BACKEND_URL conditional from smoke tests should be removed entirely (D-30 — no RAILWAY_BACKEND_URL in current file; current smoke test already uses `vars.BACKEND_URL` cleanly).

---

### `docker-compose.production-server.yml` (infrastructure config)

**Analog:** `docker-compose.server.yml` (current file, lines 1-35 — full file, rename in place)

**Full current content** (copy verbatim, rename file only):
```yaml
# Backend-only production override for self-hosted desktop deployment behind a Cloudflare tunnel.
#
# Usage:
#   docker compose -f docker-compose.yml -f docker-compose.production-server.yml up -d db backend nginx

services:
  nginx:
    depends_on:
      backend:
        condition: service_healthy
      frontend:
        condition: service_started
        required: false
    volumes:
      - ./nginx/nginx.server.conf:/etc/nginx/conf.d/default.conf:ro

  frontend:
    profiles:
      - frontend-only
```

**Additionally add `PUBLIC_URL` override to backend service** (anti-pitfall 3 from RESEARCH.md):
```yaml
  backend:
    environment:
      PUBLIC_URL: https://api.nammadaari.com
```

**Port safety note:** The base `docker-compose.yml` publishes nginx `ports: ["80:80"]`. This override does NOT change the nginx ports — production owns host port 80.

---

### `docker-compose.staging-server.yml` (infrastructure config)

**Analog:** `docker-compose.server.yml` (current file) — independent copy with three overrides

**Full new file pattern:**
```yaml
# Backend-only staging override. Mirrors docker-compose.production-server.yml but uses
# isolated ports and volumes to avoid collision with the production stack on the same host.
#
# Usage:
#   docker compose -f docker-compose.yml -f docker-compose.staging-server.yml up -d db backend nginx
#
# Key differences from production:
#   - nginx publishes host port 3011 (not 80 — production owns 80)
#   - backend internal PORT is 3011
#   - Named volumes: postgres_staging_data, uploads_staging
#   - Nginx config: nginx/nginx.staging-server.conf (upstream backend:3011)
#   - PUBLIC_URL: https://staging-api.nammadaari.com

services:
  backend:
    expose:
      - "3011"
    environment:
      PORT: "3011"
      PUBLIC_URL: https://staging-api.nammadaari.com
    volumes:
      - uploads_staging:/app/uploads

  nginx:
    ports:
      - "3011:80"     # host:container — staging nginx exposed on host port 3011
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

  db:
    volumes:
      - postgres_staging_data:/var/lib/postgresql/data

volumes:
  postgres_staging_data:
  uploads_staging:
```

**Critical:** `postgres_data` and `uploads` volumes from `docker-compose.yml` base file are NOT repeated here — staging has its own named volumes. The `db` service volume override is required to redirect the mount point.

---

### `nginx/nginx.staging-server.conf` (reverse proxy config, request-response)

**Analog:** `nginx/nginx.server.conf` (full file, lines 1-164)

**Only difference from production config** — line 36 of production file:
```nginx
# Production:
upstream backend {
    server backend:3001;
}

# Staging (only this block changes):
upstream backend {
    server backend:3011;
}
```

**Copy pattern:** Copy `nginx/nginx.server.conf` verbatim. Change only the `upstream backend { server backend:3001; }` block to `server backend:3011;`. All rate-limit zones, location blocks, proxy headers, log format, and listen port remain identical.

**Note on listen port:** The staging nginx still listens on container port 80. The host port mapping (`3011:80`) is in `docker-compose.staging-server.yml`. The conf file does not need to change the listen directive.

---

### `frontend/app/page.tsx` — coming soon page (main branch only) (component, static render)

**Analog:** `frontend/app/page.tsx` (current file, lines 1-253 — full replacement, not extension)

**Server Component pattern** (from current page.tsx lines 41-43 — keep this, remove all API call logic):
```tsx
// No "use client" — this is a Server Component
// No hooks, no API calls, no imports from lib/config
export default async function HomePage() {
```

**CSS variable usage pattern** (from current page.tsx — inline style with var() tokens):
```tsx
style={{
  background: "var(--bg)",
  color: "var(--ink)",
  fontFamily: "var(--font-sans)",
}}
```

**Global class reuse pattern** (from globals.css lines 91-108):
```tsx
// Use these global classes directly — do NOT re-declare in coming-soon.module.css:
// .press   — scale(0.97) on :active, 0.12s ease transition
// .pulse   — pulse-soft keyframe, 2s ease-in-out infinite (reduced-motion gated)
// .kn      — font-family: var(--font-kn)
// .mono    — font-family: var(--font-mono)
```

**Metadata override pattern** (from current page.tsx pattern, per Next.js 14 App Router):
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Namma Daari — Coming Soon",
};
```

**CSS Module import pattern** (standard Next.js pattern):
```tsx
import styles from "./coming-soon.module.css";
// Usage: className={styles.page}, className={styles.wordmark}, etc.
```

**Instagram CTA anchor pattern** (UI-SPEC.md §Component Mapping — NOT `<Btn>`):
```tsx
<a
  href="https://instagram.com/nammadaariblr"
  target="_blank"
  rel="noopener"
  className={`${styles["ig-btn"]} press`}
>
  {/* inline SVG 20×20 aria-hidden */}
  Follow <span className={styles.handle}>@nammadaariblr</span>
</a>
```

**Wordmark inline pattern** (UI-SPEC.md — NOT `<Bi>`):
```tsx
<div className={styles.wordmark}>
  <span className={styles.en}>Namma Daari</span>
  <span className={`${styles.kn} kn`}>ನಮ್ಮ ದಾರಿ</span>
</div>
```

**Status chip + pulse pattern** (globals.css line 103-108 provides `.pulse`):
```tsx
<div className={styles["status-chip"]}>
  <span className={`${styles.dot} pulse`} aria-hidden="true" />
  Coming soon · Bengaluru
</div>
```

---

### `frontend/app/coming-soon.module.css` (CSS module, styles)

**Analog:** `frontend/app/globals.css` (lines 16-56 for CSS variable reference, lines 91-108 for `.press`/`.pulse` pattern)

**Pattern:** All page-specific classes go here as CSS Modules. Global classes (`.press`, `.pulse`, `.kn`, `.mono`) are NOT re-declared — used directly by className. CSS variables from `:root` in globals.css are consumed here via `var(--token-name)`.

**Background pattern** (from UI-SPEC.md §Layout):
```css
.page {
  background-color: var(--bg);
  background-image:
    radial-gradient(circle at 18% 22%, oklch(0.96 0.03 145) 0%, transparent 42%),
    radial-gradient(circle at 84% 78%, rgba(180, 165, 140, 0.18) 0%, transparent 46%);
  background-attachment: fixed;
}
```

**CSS variable tokens available** (from globals.css lines 16-56 — full list):
- Color: `--bg`, `--surface`, `--surface-2`, `--border`, `--border-strong`, `--ink`, `--ink-2`, `--muted`, `--muted-2`, `--accent`, `--accent-ink`, `--accent-bg`, `--accent-border`
- Font: `--font-sans`, `--font-mono`, `--font-kn`
- Radius: `--r-sm`, `--r-md`, `--r-lg`, `--r-xl`, `--r-full`
- Shadow: `--shadow-sm`, `--shadow-md`, `--shadow-lg`

**Responsive breakpoint pattern** (from UI-SPEC.md §Responsive):
```css
@media (max-width: 560px) {
  .page { padding: 22px 20px 24px; }
  /* ... */
}

@media (max-width: 380px) {
  .wordmark { flex-direction: column; gap: 2px; }
  .wordmark .kn { font-size: 14px; }
}
```

---

### `.planning/config.json` (config, additive key)

**Analog:** `.planning/config.json` (current file, lines 1-20 — full file)

**Current structure** (lines 1-20 — all existing keys must be preserved):
```json
{
  "mode": "yolo",
  "granularity": "standard",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "_auto_chain_active": false
  },
  "graphify": {
    "enabled": true
  },
  "ui": {
    "spacing_exceptions_allowed": true
  }
}
```

**New `branching` key to add** (D-28 — additive, no existing keys removed):
```json
{
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
}
```

---

## Shared Patterns

### SSH + rsync deploy pattern
**Source:** `.github/workflows/deploy.yml` lines 44-54
**Apply to:** Both `deploy-production` and `deploy-staging` jobs
```yaml
- name: Copy updated files to LXC
  run: |
    rsync -avz --exclude='.git' \
      -e "ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no" \
      ./ root@192.168.1.152:/opt/nammadaari/

- name: Build and deploy on LXC
  run: |
    ssh -i /home/gh-runner/.ssh/nammadaari-lxc -o StrictHostKeyChecking=no root@192.168.1.152 \
      "cd /opt/nammadaari && \
       docker compose -f docker-compose.yml -f docker-compose.production-server.yml build backend && \
       docker compose -f docker-compose.yml -f docker-compose.production-server.yml up -d --remove-orphans db backend nginx"
```
Staging job: change target path to `/opt/nammadaari-staging/`, Compose file to `docker-compose.staging-server.yml`. Add `mkdir -p /opt/nammadaari-staging` before rsync.

### Local health check retry pattern
**Source:** `.github/workflows/deploy.yml` lines 56-69
**Apply to:** Both deploy jobs — staging health check hits `http://localhost:3011/health` (not port 80):
```yaml
- name: Wait for local health
  run: |
    for i in 1 2 3 4 5 6; do
      if ssh ... root@192.168.1.152 "curl -sf --max-time 5 http://localhost/health"; then
        echo "Local health OK on attempt $i"
        exit 0
      fi
      sleep 10
    done
    exit 1
```

### nginx proxy_pass + header pattern
**Source:** `nginx/nginx.server.conf` lines 85-92 (applied to every location block)
**Apply to:** `nginx/nginx.staging-server.conf` — identical headers, only upstream port changes:
```nginx
proxy_pass http://backend;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Request-ID      $request_id;
```

### CSS variable token consumption pattern
**Source:** `frontend/app/globals.css` lines 16-56; `frontend/app/page.tsx` throughout
**Apply to:** `frontend/app/coming-soon.module.css` and inline styles in coming soon `page.tsx`
```css
/* Always use tokens — never hardcoded hex values on this page */
color: var(--ink);
background: var(--bg);
border: 1px solid var(--border);
font-family: var(--font-sans);
border-radius: var(--r-md);
```

---

## No Analog Found

No files in this phase lack a codebase analog. All new files have direct analogs as noted above.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | Not applicable |

---

## Deletions (No Pattern Needed)

| File | Action | Reason |
|------|--------|--------|
| `docker-compose.server.yml` | Delete (renamed to `docker-compose.production-server.yml`) | File rename; no new pattern required |
| `backend/railway.toml` | Delete | Railway decommissioned in Phase 02.4 (D-29) |

**Reference update scope for rename:** `deploy.yml` (2 occurrences on lines 53-54), `DEPLOYMENT.md` (14+ occurrences — grep confirms), `CLAUDE.md` (0 occurrences — confirmed by RESEARCH.md).

---

## Metadata

**Analog search scope:** `.github/workflows/`, `docker-compose*.yml`, `nginx/`, `frontend/app/`, `.planning/`
**Files scanned:** 9 source files read directly
**Pattern extraction date:** 2026-06-22
