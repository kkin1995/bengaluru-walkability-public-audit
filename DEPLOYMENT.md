# Self-Hosted Deployment Guide

Production deployment for the Bengaluru Walkability Public Audit: backend on an Arch Linux desktop, frontend on Vercel, connected via Cloudflare Tunnel.

**Last updated:** 2026-05-20

---

## 1. Overview

The production stack runs in two places. The **backend** (Rust/Axum API + PostGIS database + nginx) runs inside Docker Compose on an Arch Linux desktop machine. The **frontend** (Next.js) is deployed to Vercel. A Cloudflare Tunnel bridges the desktop to the public internet — the tunnel daemon running on the desktop connects outbound to Cloudflare's edge, exposing port 80 over HTTPS without requiring a public IP address, open firewall ports, or a static IP lease.

Traffic from citizens and the admin dashboard flows like this:

```
Citizen browser ──────────────────────────────────────────────────────────────┐
                                                                              ▼
                                                                    Vercel (Next.js frontend)
                                                                    https://staging-walkability.kinariwala.com
                                                                              │
                                                                              │ server-side fetch + API calls
                                                                              ▼
                                                             Cloudflare edge (HTTPS)
                                                             https://api-walkability.kinariwala.com
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
| Backend (Rust/Axum) | Desktop / Docker | Managed by `docker-compose.server.yml` override |
| Database (PostGIS) | Desktop / Docker | Persistent volume on host disk |
| nginx (reverse proxy) | Desktop / Docker | Uses `nginx/nginx.server.conf` — backend only |
| Cloudflare Tunnel | Cloudflare edge ↔ desktop cloudflared daemon | Outbound-only; no firewall changes needed |

**Why Cloudflare Tunnel?** The desktop typically sits behind a home router with NAT and no public static IP. Cloudflare Tunnel establishes an outbound connection from the desktop to Cloudflare's edge; Cloudflare then terminates HTTPS for the public hostname and forwards plain HTTP to the tunnel daemon on port 80. This means no port-forwarding rules, no static IP contract, no self-managed TLS certificates, and automatic DDoS protection from Cloudflare's network — all for free on the Cloudflare free tier.

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
  - hostname: api-walkability.kinariwala.com
    service: http://localhost:80
  - service: http_status:404
```

The `ingress` block maps the public hostname to `http://localhost:80` where nginx is listening inside Docker. The catch-all `http_status:404` returns 404 for any hostname not matched above.

> **Permissions note:** `/etc/cloudflared/config.yml` should be owned by root and readable
> by the cloudflared systemd service. `sudo chown root:root /etc/cloudflared/config.yml &&
> sudo chmod 644 /etc/cloudflared/config.yml` is correct.

### 4e. Create the DNS CNAME record

**Option A (recommended) — automatic via cloudflared:**

```bash
cloudflared tunnel route dns walkability-prod api-walkability.kinariwala.com
```

This creates a proxied CNAME `api-walkability → <TUNNEL-UUID>.cfargotunnel.com` in your Cloudflare zone automatically.

**Option B — manual via the Cloudflare dashboard:**

1. Go to the Cloudflare dashboard → your zone `kinariwala.com` → DNS → Add record
2. Fill in:
   - **Type:** CNAME
   - **Name:** `api-walkability`
   - **Target:** `<TUNNEL-UUID>.cfargotunnel.com`
   - **Proxy status:** Enabled (orange cloud)
3. Save.

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
| `CORS_ORIGIN` | `https://staging-walkability.kinariwala.com` | Exact frontend URL; no trailing slash; no wildcard |
| `ADMIN_SEED_EMAIL` | `admin@example.com` | Initial super-admin created on first boot |
| `ADMIN_SEED_PASSWORD` | `openssl rand -base64 24` | Min 12 chars; change via admin UI after first login |
| `POSTGRES_DB` | `walkability` (default) | Override only if running multiple instances |
| `POSTGRES_USER` | `walkability` (default) | Override only if running multiple instances |

**Example `.env` file** (replace placeholder values before use):

```bash
# .env — production secrets for the desktop deploy
# NEVER commit this file to git. It is in .gitignore.

POSTGRES_PASSWORD=REPLACE_WITH_openssl_rand_base64_32
POSTGRES_DB=walkability
POSTGRES_USER=walkability

JWT_SECRET=REPLACE_WITH_openssl_rand_hex_32

COOKIE_SECURE=true
CORS_ORIGIN=https://staging-walkability.kinariwala.com

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
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --build db backend nginx
```

The `docker-compose.server.yml` override:
- Swaps nginx's config to `nginx/nginx.server.conf` (backend-only, no frontend upstream)
- Drops the nginx dependency on the frontend container
- Parks the frontend service behind the `frontend-only` profile

### 6d. Verify locally and publicly

**Check all services are healthy:**

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml ps
```

All three services (`db`, `backend`, `nginx`) should show `healthy` status. If `backend` is starting, wait 30 seconds — it has a `start_period: 30s` health check.

**Check the local health endpoint:**

```bash
curl -f http://localhost/health
```

Expected: `{"status":"ok"}`

**Check the public tunnel endpoint:**

```bash
curl -f https://api-walkability.kinariwala.com/health
```

Expected: same `{"status":"ok"}` response arriving from the public internet via the Cloudflare Tunnel.

**If anything is wrong — check backend logs:**

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml logs -f backend
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

| Operation | Command |
|-----------|---------|
| Deploy a new build (automatic) | Push to `main` → GitHub Actions runs `deploy.yml` automatically |
| Deploy manually (force redeploy) | `docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --remove-orphans db backend nginx` |
| Trigger workflow_dispatch | GitHub → Actions → Deploy → "Run workflow" |
| View backend logs | `docker compose -f docker-compose.yml -f docker-compose.server.yml logs -f backend` |
| View nginx logs | `docker compose -f docker-compose.yml -f docker-compose.server.yml logs -f nginx` |
| View tunnel logs | `sudo journalctl -u cloudflared -f` |
| Restart a single service | `docker compose -f docker-compose.yml -f docker-compose.server.yml restart backend` |
| Update env vars | Edit `.env` → re-run the `up` command → containers pick up new env on restart |
| Stop everything (data preserved) | `docker compose -f docker-compose.yml -f docker-compose.server.yml down` |
| Check service health | `docker compose -f docker-compose.yml -f docker-compose.server.yml ps` |

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Tunnel not connecting / `cloudflared tunnel info` shows 0 connectors | Credentials file missing, wrong path in config.yml, or wrong UUID | Verify `/etc/cloudflared/config.yml` — `tunnel:` must match the UUID from `cloudflared tunnel create`. Credentials JSON must be at the path listed in `credentials-file:`. `sudo systemctl restart cloudflared` after fixing. |
| `docker: permission denied` when running docker commands | User not in `docker` group, or not re-logged-in after `usermod` | Run `groups` to check. Log out and back in. For the runner user: verify `groups gh-runner` includes `docker`. |
| GitHub runner shows offline in repo settings | `svc.sh` service not running, or runner crashed | `sudo ./svc.sh status` from the `actions-runner` directory. If not running: `sudo ./svc.sh start`. Check `sudo journalctl -u actions.runner.* -f` for crash details. |
| Deploy job fails at "Wait for local health" step | Backend not healthy after deploy | `docker compose -f docker-compose.yml -f docker-compose.server.yml logs backend`. Common causes: missing or invalid `POSTGRES_PASSWORD` or `JWT_SECRET` env vars; DB not ready (increase `start_period` or check DB logs). |
| `curl https://<tunnel-url>/health` hangs or returns 502 | nginx or backend not running, or tunnel ingress points to wrong port | (1) `docker compose ps` — all three services must be healthy. (2) Verify `/etc/cloudflared/config.yml` ingress: `service: http://localhost:80` (not 3001 — nginx is the entry point). (3) `sudo systemctl status cloudflared`. |
| Admin login redirects back to login on production | `COOKIE_SECURE` not `true`, or `CORS_ORIGIN` mismatch | Check `.env`: `COOKIE_SECURE=true`. Check `CORS_ORIGIN` matches the Vercel frontend URL exactly — no trailing slash, no protocol mismatch (`https://` required). |
| Push to `main` does not trigger deploy | "production" environment missing, or required reviewers blocking approval | GitHub → Settings → Environments → verify `production` exists. Check the deploy job status in Actions — it may be "Waiting" for environment approval. |
| `docker compose config` fails with "service frontend" error | Compose version incompatibility with `required: false` in override | Update docker-compose-plugin: `sudo pacman -Syu docker-compose`. Compose v2.20+ supports `required: false` natively. |
