# Self-Hosted Deployment Guide

Production deployment for the Bengaluru Walkability Public Audit: backend on an Arch Linux desktop, frontend on Vercel, connected via Cloudflare Tunnel.

**Last updated:** 2026-06-22

---

## 1. Overview

The production stack runs in two places. The **backend** (Rust/Axum API + PostGIS database + nginx) runs inside Docker Compose on an Arch Linux desktop machine. The **frontend** (Next.js) is deployed to Vercel. A Cloudflare Tunnel bridges the desktop to the public internet — the tunnel daemon running on the desktop connects outbound to Cloudflare's edge, exposing port 80 over HTTPS without requiring a public IP address, open firewall ports, or a static IP lease.

Traffic from citizens and the admin dashboard flows like this:

```
Citizen browser ──────────────────────────────────────────────────────────────┐
                                                                              ▼
                                                                    Vercel (Next.js frontend)
                                                                    https://nammadaari.com (or staging.nammadaari.com)
                                                                              │
                                                                              │ server-side fetch + API calls
                                                                              ▼
                                                             Cloudflare edge (HTTPS)
                                                             https://api.nammadaari.com (or staging-api.nammadaari.com)
                                                                              │
                                                                              │ TLS-terminated; plain HTTP inside
                                                                              ▼
                                                             cloudflared daemon (desktop, systemd)
                                                                              │
                                                                              │ http://localhost:80
                                                                              ▼
                                                               ┌──────────────────────────────┐
                                                               │  Docker network (desktop)    │
                                                               │                              │
                                                               │  nginx:80                    │
                                                               │    ├─ /api/*  ───────────►  backend:3001 (Rust/Axum)
                                                               │    ├─ /uploads/ ──────────► backend:3001 (ServeDir)
                                                               │    ├─ /health  ───────────► backend:3001
                                                               │    └─ /* → 404             │
                                                               │                             │
                                                               │                             │ sqlx queries
                                                               │                             ▼
                                                               │                          db:5432 (PostGIS 16)
                                                               └──────────────────────────────┘
```

**What runs where:**

| Component | Where | Notes |
|-----------|-------|-------|
| Frontend (Next.js) | Vercel | Auto-deploy from `main`; free tier |
| Backend (Rust/Axum) | Desktop / Docker | Managed by `docker-compose.production-server.yml` override (production) or `docker-compose.staging-server.yml` (staging) |
| Database (PostGIS) | Desktop / Docker | Persistent volume on host disk |
| nginx (reverse proxy) | Desktop / Docker | Uses `nginx/nginx.server.conf` — backend only |
| Cloudflare Tunnel | Cloudflare edge ↔ desktop cloudflared daemon | Outbound-only; no firewall changes needed |

**Why Cloudflare Tunnel?** The desktop typically sits behind a home router with NAT and no public static IP. Cloudflare Tunnel establishes an outbound connection from the desktop to Cloudflare's edge; Cloudflare then terminates HTTPS for the public hostname and forwards plain HTTP to the tunnel daemon on port 80. This means no port-forwarding rules, no static IP contract, no self-managed TLS certificates, and automatic DDoS protection from Cloudflare's network — all for free on the Cloudflare free tier.

---

## 1a. Branching Workflow

This project uses a three-tier branching model wired to two separate deployment environments:

```
feature/fix branch  →  PR to staging  →  merge to main (milestone only)
```

| Branch | Purpose | Deploys to |
|--------|---------|------------|
| `main` | Production — current milestone release | `nammadaari.com` (Vercel) + `api.nammadaari.com` (Docker on LXC) |
| `staging` | Integration — accumulates work from feature branches | `staging.nammadaari.com` (Vercel) + `staging-api.nammadaari.com` (Docker on LXC, port 3011) |
| `feat/*`, `fix/*`, `phase/*` | Working branches — created from `staging` | No direct deployment |

**Rules:**

- All feature and fix work branches from `staging` (not `main`)
- PRs target `staging`: CI must pass (all three jobs: `frontend-checks`, `backend-checks`, `docker-build`) and 1 approval is required before merge
- Direct pushes to `staging` or `main` are blocked by GitHub branch protection rules — no bypass, including for admins
- `main` only ever receives a merge from `staging` — this happens at milestone completion via `/gsd-complete-milestone`
- `/gsd-ship` creates PRs targeting `staging` (configured via `.planning/config.json branching.working_branch`)

---

## 1b. Staging Stack Setup

The staging environment runs on the same Proxmox LXC (192.168.1.152) as production but is fully isolated with its own containers, volumes, and network ports.

**Directory:** `/opt/nammadaari-staging/` on the LXC

**Start the staging stack:**

```bash
docker compose -f docker-compose.yml -f docker-compose.staging-server.yml up -d db backend nginx
```

**Key differences from production:**

| Property | Production | Staging |
|----------|-----------|---------|
| Compose override | `docker-compose.production-server.yml` | `docker-compose.staging-server.yml` |
| nginx host port | 80 (Cloudflare Tunnel entry point) | 3011 (Cloudflare Tunnel second ingress) |
| Backend internal port | 3001 | 3011 |
| PostgreSQL data volume | `postgres_data` | `postgres_staging_data` |
| Uploads volume | `uploads` | `uploads_staging` |
| `PUBLIC_URL` | `https://api.nammadaari.com` | `https://staging-api.nammadaari.com` |
| `CORS_ORIGIN` (GitHub Environment secret) | `https://nammadaari.com` | `https://staging.nammadaari.com` |
| Vercel branch domain | `nammadaari.com` → `main` | `staging.nammadaari.com` → `staging` |

Both stacks can run simultaneously — they never share ports or volumes.

---

## 1c. Cloudflare Tunnel: Hostname Rename and Staging Ingress

These are **manual steps** that must be performed on the Arch Linux VM (or LXC) where `cloudflared` runs. They are not automated by the deploy workflow.

**Step 1: Edit the cloudflared config**

```bash
sudo nano /etc/cloudflared/config.yml
```

**Step 2: Update the ingress rules**

Replace the existing single-ingress config with the two-ingress config below. Replace `<TUNNEL-UUID>` with your actual tunnel UUID.

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /etc/cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: api.nammadaari.com
    service: http://localhost:80
  - hostname: staging-api.nammadaari.com
    service: http://localhost:3011
  - service: http_status:404
```

Changes made:
- Updated production hostname to `api.nammadaari.com` (D-16)
- Added second ingress rule: `staging-api.nammadaari.com` → `http://localhost:3011` (D-17)

**Step 3: Update Cloudflare DNS**

In the Cloudflare dashboard → your zone → DNS:

1. Add CNAME: `api` → `<TUNNEL-UUID>.cfargotunnel.com` (Proxy enabled)
2. Add CNAME: `staging-api` → `<TUNNEL-UUID>.cfargotunnel.com` (Proxy enabled)
3. Remove the old CNAME for the prior production API subdomain once `api.nammadaari.com` is verified working

**Step 4: Restart cloudflared**

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager
```

**Step 5: Verify**

After starting the staging stack (Section 1b), confirm the tunnel routes traffic correctly:

```bash
curl https://staging-api.nammadaari.com/health
# Expected: {"status":"ok"}

curl https://api.nammadaari.com/health
# Expected: {"status":"ok"} (production, must be running)
```

---

## 2. Prerequisites

**Host requirements:**

- Arch Linux (or an Arch-based distro such as Manjaro) with `sudo` access
- A Cloudflare account with the zone `kinariwala.com` already added (DNS must be managed by Cloudflare)
- A GitHub account with admin access to the `kkin1995/bengaluru-walkability-public-audit` repository
- Outbound HTTPS (port 443) reachable from the desktop — no special inbound rules required

**What will be installed during this runbook** (do not install these in advance unless noted):

- `docker` + `docker-compose-plugin` (Section 3)
- `cloudflared` AUR package (Section 4)
- GitHub Actions self-hosted runner binary (Section 7)

---

## 3. Arch Linux Desktop Setup

### 3a. Install Docker and the Compose plugin

```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker.service
```

Verify both tools are available:

```bash
docker --version
docker compose version
```

Expected output (versions may differ):

```
Docker version 26.x.x, build ...
Docker Compose version v2.x.x
```

### 3b. Add your user to the docker group

```bash
sudo usermod -aG docker $USER
```

> **Important:** The group membership change does not take effect in your current shell session.
> You MUST log out and log back in (or run `newgrp docker`) before `docker` commands work
> without `sudo`. Failing to do this will cause all `docker compose` commands in the deploy
> workflow to fail with "permission denied".

Verify after re-login:

```bash
groups
# docker should appear in the list
docker run --rm hello-world
```

### 3c. Docker log rotation (optional but recommended)

Docker's default logging is sufficient for this workload. For long-running servers, add size caps to prevent unbounded log growth:

```bash
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
```

Then restart Docker to apply: `sudo systemctl restart docker.service`

---

## 4. Cloudflare Tunnel Setup

### 4a. Install cloudflared from AUR

```bash
yay -S cloudflared
# or with paru:
paru -S cloudflared
```

Verify:

```bash
cloudflared --version
```

### 4b. Authenticate cloudflared with your Cloudflare account

```bash
cloudflared tunnel login
```

This prints a URL. Open it in a browser, log in to Cloudflare, and select the `kinariwala.com` zone. A certificate file is written to `~/.cloudflared/cert.pem` — this authorises `cloudflared` to manage tunnels and DNS records for the zone.

### 4c. Create the tunnel

```bash
cloudflared tunnel create walkability-prod
```

Output will look like:

```
Created tunnel walkability-prod with id 3e2c4f7a-1234-5678-abcd-0123456789ab
Tunnel credentials written to /home/<user>/.cloudflared/3e2c4f7a-1234-5678-abcd-0123456789ab.json
```

**Copy the UUID** — you will need it in the next step.

### 4d. Write `/etc/cloudflared/config.yml`

First, copy the credentials JSON to `/etc/cloudflared/`:

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<TUNNEL-UUID>.json /etc/cloudflared/<TUNNEL-UUID>.json
sudo chown root:root /etc/cloudflared/<TUNNEL-UUID>.json
sudo chmod 600 /etc/cloudflared/<TUNNEL-UUID>.json
```

Then create the config file:

```bash
sudo nano /etc/cloudflared/config.yml
```

Paste the following template, replacing `<TUNNEL-UUID>` with the UUID from Section 4c:

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /etc/cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: api.nammadaari.com
    service: http://localhost:80
  - hostname: staging-api.nammadaari.com
    service: http://localhost:3011
  - service: http_status:404
```

The `ingress` block maps public hostnames to local ports where nginx is listening inside Docker. `api.nammadaari.com` routes to production nginx (port 80); `staging-api.nammadaari.com` routes to the staging nginx (port 3011). The catch-all `http_status:404` returns 404 for any hostname not matched above.

> **Note:** If you are setting up a fresh tunnel (not using an existing tunnel), replace the hostname values with your actual domain names. For an existing tunnel, update `/etc/cloudflared/config.yml` per Section 1c.

> **Permissions note:** `/etc/cloudflared/config.yml` should be owned by root and readable
> by the cloudflared systemd service. `sudo chown root:root /etc/cloudflared/config.yml &&
> sudo chmod 644 /etc/cloudflared/config.yml` is correct.

### 4e. Create the DNS CNAME record

**Option A (recommended) — automatic via cloudflared:**

```bash
cloudflared tunnel route dns walkability-prod api.nammadaari.com
cloudflared tunnel route dns walkability-prod staging-api.nammadaari.com
```

This creates proxied CNAMEs pointing to `<TUNNEL-UUID>.cfargotunnel.com` in your Cloudflare zone automatically.

**Option B — manual via the Cloudflare dashboard:**

1. Go to the Cloudflare dashboard → your zone `nammadaari.com` → DNS → Add record
2. Add the production API record:
   - **Type:** CNAME
   - **Name:** `api`
   - **Target:** `<TUNNEL-UUID>.cfargotunnel.com`
   - **Proxy status:** Enabled (orange cloud)
3. Add the staging API record:
   - **Type:** CNAME
   - **Name:** `staging-api`
   - **Target:** `<TUNNEL-UUID>.cfargotunnel.com`
   - **Proxy status:** Enabled (orange cloud)
4. Save both records.

### 4f. Install and start the systemd service

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared.service
sudo systemctl status cloudflared --no-pager
```

Confirm the tunnel is connected:

```bash
cloudflared tunnel info walkability-prod
```

The output should show at least one connector registered. If it shows 0 connectors, check `sudo journalctl -u cloudflared -f` for errors.

---

## 5. Production Environment Variables

Production environment variables live in a `.env` file at the repository root (next to `docker-compose.yml`). The deploy workflow (`.github/workflows/deploy.yml`) injects them from GitHub Secrets and Variables into the runner environment for CI deploys; manual deploys on the desktop read them from `.env`.

| Variable | Generation command / example | Notes |
|----------|------------------------------|-------|
| `POSTGRES_PASSWORD` | `openssl rand -base64 32` | Strong random; never share; rotating requires DB restart |
| `JWT_SECRET` | `openssl rand -hex 32` | Min 32 chars; rotating invalidates all admin sessions |
| `COOKIE_SECURE` | `true` (literal) | Cloudflare terminates TLS so cookies always travel over HTTPS; never set to `false` in production |
| `CORS_ORIGIN` | `https://nammadaari.com` (production) / `https://staging.nammadaari.com` (staging) | Exact frontend URL; no trailing slash; no wildcard. Set per environment in GitHub Environments, not in `.env` |
| `PUBLIC_URL` | `https://api.nammadaari.com` (production) / `https://staging-api.nammadaari.com` (staging) | Used to construct image URLs in API responses. Set in the Compose server override file, not `.env` |
| `ADMIN_SEED_EMAIL` | `admin@example.com` | Initial super-admin created on first boot. Remove from GitHub Environment secrets after first successful login (see note below) |
| `ADMIN_SEED_PASSWORD` | `openssl rand -base64 24` | Min 12 chars; change via admin UI after first login. Remove from GitHub Environment secrets after first successful login (see note below) |
| `POSTGRES_DB` | `walkability` (default) | Override only if running multiple instances |
| `POSTGRES_USER` | `walkability` (default) | Override only if running multiple instances |

> **Admin seed secret hygiene (D-27):** After the first successful admin login on the production stack, remove `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` from the GitHub `production` Environment secrets page. The seed function is idempotent (runs only when no admin users exist) so future deploys are unaffected, but removing the secrets prevents accidental exposure and reduces the attack surface. Go to: GitHub repo → Settings → Environments → production → remove both variables.

**Example `.env` file** (replace placeholder values before use):

```bash
# .env — production secrets for the desktop deploy
# NEVER commit this file to git. It is in .gitignore.

POSTGRES_PASSWORD=REPLACE_WITH_openssl_rand_base64_32
POSTGRES_DB=walkability
POSTGRES_USER=walkability

JWT_SECRET=REPLACE_WITH_openssl_rand_hex_32

COOKIE_SECURE=true
CORS_ORIGIN=https://nammadaari.com

ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=REPLACE_WITH_strong_password_min_12_chars
```

---

## 6. First Manual Deploy

### 6a. Clone the repository

```bash
git clone https://github.com/kkin1995/bengaluru-walkability-public-audit.git
cd bengaluru-walkability-public-audit
```

### 6b. Place the `.env` file

Create `.env` at the repository root with the values from Section 5. The file must be in the same directory as `docker-compose.yml`.

```bash
nano .env
# Paste the template from Section 5, fill in all placeholder values
```

### 6c. Run the first-deploy command

This command builds the backend image from source and starts the three production services (`db`, `backend`, `nginx`). The frontend service is gated behind a Compose profile and will not start.

```bash
docker compose -f docker-compose.yml -f docker-compose.production-server.yml up -d --build db backend nginx
```

The `docker-compose.production-server.yml` override:
- Swaps nginx's config to `nginx/nginx.server.conf` (backend-only, no frontend upstream)
- Drops the nginx dependency on the frontend container
- Parks the frontend service behind the `frontend-only` profile

### 6d. Verify locally and publicly

**Check all services are healthy:**

```bash
docker compose -f docker-compose.yml -f docker-compose.production-server.yml ps
```

All three services (`db`, `backend`, `nginx`) should show `healthy` status. If `backend` is starting, wait 30 seconds — it has a `start_period: 30s` health check.

**Check the local health endpoint:**

```bash
curl -f http://localhost/health
```

Expected: `{"status":"ok"}`

**Check the public tunnel endpoint:**

```bash
curl -f https://api.nammadaari.com/health
```

Expected: same `{"status":"ok"}` response arriving from the public internet via the Cloudflare Tunnel.

**If anything is wrong — check backend logs:**

```bash
docker compose -f docker-compose.yml -f docker-compose.production-server.yml logs -f backend
```

---

## 7. GitHub Actions Self-Hosted Runner

The deploy workflow (`.github/workflows/deploy.yml`) targets a runner with labels `self-hosted`, `linux`, and `walkability-prod`. The runner must be installed on the same desktop machine where Docker and the Cloudflare Tunnel are running.

### 7a. Generate the runner token from GitHub

Go to: **GitHub repo → Settings → Actions → Runners → "New self-hosted runner"**

Select **Linux** / **x64**. GitHub displays a download command block with a registration token embedded. Keep this page open — you will use the `./config.sh` command in the next steps.

### 7b. Create a dedicated runner user (recommended)

Running the GitHub Actions runner as a dedicated user isolates it from your personal session and avoids permission confusion:

```bash
sudo useradd -m -s /bin/bash gh-runner
sudo usermod -aG docker gh-runner
```

> **The `docker` group membership is mandatory.** Without it, every deploy step that runs
> `docker compose` will fail with "permission denied while connecting to the Docker daemon".
> Run `groups gh-runner` to verify after the `usermod` call.

### 7c. Download and configure the runner binary

Switch to the `gh-runner` user:

```bash
sudo -u gh-runner -i
```

Run the download and configure commands shown on the GitHub page (example; use the exact commands from GitHub as the token and URL are unique to your repo):

```bash
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.x.x.tar.gz -L https://github.com/actions/runner/releases/download/v2.x.x/actions-runner-linux-x64-2.x.x.tar.gz
tar xzf ./actions-runner-linux-x64-2.x.x.tar.gz
./config.sh --url https://github.com/kkin1995/bengaluru-walkability-public-audit --token <TOKEN-FROM-GITHUB>
```

When `./config.sh` prompts for **additional labels**, enter:

```
walkability-prod
```

The `self-hosted` and `linux` labels are added automatically. Only `walkability-prod` needs to be entered manually — this is the label the deploy workflow uses to target this specific machine.

### 7d. Install and start the runner as a systemd service

From inside the `actions-runner` directory (still as `gh-runner`):

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

The runner is now managed by systemd and will start automatically on boot.

### 7e. Verify in GitHub

Go to: **GitHub repo → Settings → Actions → Runners**

The runner should appear with status **Idle** and labels including `self-hosted`, `Linux`, `X64`, and `walkability-prod`.

Double-check docker group membership on the runner user:

```bash
groups gh-runner
# must include: docker
```

---

## 8. Ongoing Operations

### Production stack operations (in `/opt/nammadaari/`)

| Operation | Command |
|-----------|---------|
| Deploy a new build (automatic) | Push to `main` → GitHub Actions runs `deploy.yml` automatically |
| Deploy manually (force redeploy) | `docker compose -f docker-compose.yml -f docker-compose.production-server.yml up -d --remove-orphans db backend nginx` |
| Trigger workflow_dispatch | GitHub → Actions → Deploy → "Run workflow" (select `main` branch) |
| View backend logs | `docker compose -f docker-compose.yml -f docker-compose.production-server.yml logs -f backend` |
| View nginx logs | `docker compose -f docker-compose.yml -f docker-compose.production-server.yml logs -f nginx` |
| View tunnel logs | `sudo journalctl -u cloudflared -f` |
| Restart a single service | `docker compose -f docker-compose.yml -f docker-compose.production-server.yml restart backend` |
| Update env vars | Edit `.env` → re-run the `up` command → containers pick up new env on restart |
| Stop everything (data preserved) | `docker compose -f docker-compose.yml -f docker-compose.production-server.yml down` |
| Check service health | `docker compose -f docker-compose.yml -f docker-compose.production-server.yml ps` |

### Staging stack operations (in `/opt/nammadaari-staging/`)

| Operation | Command |
|-----------|---------|
| Deploy staging (automatic) | Push to `staging` → GitHub Actions runs `deploy.yml` automatically |
| Deploy staging manually | `docker compose -f docker-compose.yml -f docker-compose.staging-server.yml up -d --remove-orphans db backend nginx` |
| View staging backend logs | `docker compose -f docker-compose.yml -f docker-compose.staging-server.yml logs -f backend` |
| View staging nginx logs | `docker compose -f docker-compose.yml -f docker-compose.staging-server.yml logs -f nginx` |
| Restart staging service | `docker compose -f docker-compose.yml -f docker-compose.staging-server.yml restart backend` |
| Stop staging (data preserved) | `docker compose -f docker-compose.yml -f docker-compose.staging-server.yml down` |
| Check staging health | `docker compose -f docker-compose.yml -f docker-compose.staging-server.yml ps` |
| Check staging health endpoint | `curl https://staging-api.nammadaari.com/health` |

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Tunnel not connecting / `cloudflared tunnel info` shows 0 connectors | Credentials file missing, wrong path in config.yml, or wrong UUID | Verify `/etc/cloudflared/config.yml` — `tunnel:` must match the UUID from `cloudflared tunnel create`. Credentials JSON must be at the path listed in `credentials-file:`. `sudo systemctl restart cloudflared` after fixing. |
| `docker: permission denied` when running docker commands | User not in `docker` group, or not re-logged-in after `usermod` | Run `groups` to check. Log out and back in. For the runner user: verify `groups gh-runner` includes `docker`. |
| GitHub runner shows offline in repo settings | `svc.sh` service not running, or runner crashed | `sudo ./svc.sh status` from the `actions-runner` directory. If not running: `sudo ./svc.sh start`. Check `sudo journalctl -u actions.runner.* -f` for crash details. |
| Deploy job fails at "Wait for local health" step | Backend not healthy after deploy | Production: `docker compose -f docker-compose.yml -f docker-compose.production-server.yml logs backend`. Staging: `docker compose -f docker-compose.yml -f docker-compose.staging-server.yml logs backend`. Common causes: missing or invalid `POSTGRES_PASSWORD` or `JWT_SECRET` env vars; DB not ready (increase `start_period` or check DB logs). |
| `curl https://api.nammadaari.com/health` hangs or returns 502 | nginx or backend not running, or tunnel ingress points to wrong port | (1) `docker compose ps` — all three services must be healthy. (2) Verify `/etc/cloudflared/config.yml` ingress: `api.nammadaari.com` → `http://localhost:80` and `staging-api.nammadaari.com` → `http://localhost:3011`. (3) `sudo systemctl status cloudflared`. |
| Admin login redirects back to login on production | `COOKIE_SECURE` not `true`, or `CORS_ORIGIN` mismatch | Check `.env`: `COOKIE_SECURE=true`. Check `CORS_ORIGIN` matches the Vercel frontend URL exactly — no trailing slash, no protocol mismatch (`https://` required). |
| Push to `main` does not trigger deploy | "production" environment missing, or required reviewers blocking approval | GitHub → Settings → Environments → verify `production` exists. Check the deploy job status in Actions — it may be "Waiting" for environment approval. |
| `docker compose config` fails with "service frontend" error | Compose version incompatibility with `required: false` in override | Update docker-compose-plugin: `sudo pacman -Syu docker-compose`. Compose v2.20+ supports `required: false` natively. |

---

## 10. Secret Rotation

### When to rotate

- Suspected credential leak
- Staff offboarding
- Annual rotation policy

### JWT_SECRET rotation

1. Generate new secret: `openssl rand -hex 32`
2. Update GitHub Actions secret: repo Settings → Secrets → Actions → `JWT_SECRET`
3. Update `.env` on the desktop server: `JWT_SECRET=<new-value>`
4. Restart backend to invalidate current JWTs:
   `docker compose -f docker-compose.yml -f docker-compose.production-server.yml restart backend`
5. All logged-in admins will be immediately logged out — warn GBA team before rotating

### POSTGRES_PASSWORD rotation

1. Update in `.env`: `POSTGRES_PASSWORD=<new-value>`
2. Update inside the running database:
   `docker exec -it <db-container> psql -U walkability -c "ALTER USER walkability PASSWORD '<new-value>';"`
3. Restart backend: `docker compose -f docker-compose.yml -f docker-compose.production-server.yml restart backend`

### ADMIN_SEED_PASSWORD rotation

The seed password only applies to the initial seeded admin account. The seed only runs if no `admin_users` rows exist; an existing database is unaffected by changing this env var. To reset the password for an existing admin, use the admin dashboard: `PATCH /api/admin/auth/change-password`

---

## 11. Backup and Restore

### Schedule and storage

Backups run weekly via `walkability-backup.timer` (systemd). Backup files land on the separate HDD at:

- `/data/backups/db/walkability_<timestamp>.sql.gz` — full PostgreSQL dump
- `/data/backups/uploads/uploads_<timestamp>.tar.gz` — uploads volume archive

Files older than 30 days are automatically deleted after each successful backup. If a backup run fails, `walkability-backup-failure.service` writes a tagged journal entry — check with: `journalctl -u walkability-backup-failure`

### Restore PostgreSQL from backup

1. Stop the backend (not the db):
   `docker compose -f docker-compose.yml -f docker-compose.production-server.yml stop backend`
2. Drop and recreate the database:
   `docker exec -it <db-container> psql -U walkability -c "DROP DATABASE walkability; CREATE DATABASE walkability;"`
3. Restore from backup:
   `gunzip -c /data/backups/db/walkability_YYYYMMDD_HHMMSS.sql.gz | docker exec -i <db-container> psql -U walkability walkability`
4. Restart the backend:
   `docker compose -f docker-compose.yml -f docker-compose.production-server.yml start backend`
5. Verify: `curl https://<tunnel-url>/health`

### Restore uploads volume from backup

1. Clear the volume: `docker run --rm -v uploads:/data alpine sh -c "rm -rf /data/*"`
2. Restore: `docker run --rm -v uploads:/data -v /data/backups/uploads:/backup alpine tar xzf /backup/uploads_YYYYMMDD_HHMMSS.tar.gz -C /data`
