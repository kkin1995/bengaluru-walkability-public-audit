<!-- generated-by: gsd-doc-writer -->
# Staging Setup Guide

**Staging URL:** `https://staging-walkability.kinariwala.com`
**Last updated:** 2026-04-14

---

## Overview

The staging environment mirrors the production architecture but replaces Docker Compose + nginx with managed cloud services:

| Layer | Tool | Notes |
|-------|------|-------|
| Frontend | Vercel (free tier) | Next.js auto-deploy from GitHub |
| Backend | Railway (Hobby plan, ~$5/mo) | Rust/Axum Docker service |
| Database | Railway PostGIS template | Postgres 16 + PostGIS 3.4 + pgcrypto |
| HTTPS termination | Railway (backend) + Vercel (frontend) | nginx is NOT used for staging |
| Custom domain | `staging-walkability.kinariwala.com` | CNAME → Vercel |

**nginx is dropped for staging.** Railway handles HTTPS termination for the backend. Vercel handles HTTPS for the frontend. The `nginx/` directory and `docker-compose.yml` remain unchanged for future production self-hosting.

**Cost:** Railway Hobby plan includes $5/mo credit. At zero staging traffic, the backend + PostGIS service runs within the free credit window.

---

## Prerequisites

Before starting, ensure you have:

- Access to the `bengaluru-walkability-public-audit` GitHub repository
- A **Railway** account ([railway.com](https://railway.com)) on the Hobby plan (required for custom domains and sufficient resources)
- A **Vercel** account ([vercel.com](https://vercel.com)) on the free tier
- DNS management access to `kinariwala.com` at your registrar

---

## Deployment Ordering (CRITICAL)

**Railway MUST be fully deployed and running BEFORE Vercel builds the frontend.**

Reason: `NEXT_PUBLIC_API_URL` is baked into the JavaScript bundle at Vercel build time. If the Railway backend URL is not set when Vercel builds, every client-side API call will fail with network errors.

**Required order:**

```
1. Railway PostGIS DB     → provision and wait for "Running" status
2. Railway Backend        → deploy, note public URL, verify /health responds
3. Vercel Frontend        → set NEXT_PUBLIC_API_URL to Railway URL, then deploy
4. DNS                    → add CNAME after Vercel domain is configured
```

**If the Railway URL ever changes:** update both `NEXT_PUBLIC_API_URL` and `INTERNAL_API_URL` in Vercel project settings, then trigger a manual Vercel redeploy (Project > Deployments > Redeploy latest).

---

## Step 1: Railway — Provision PostGIS Database

> **IMPORTANT:** Use the PostGIS template, not standard Railway Postgres.
> Standard Postgres does NOT include PostGIS library files. `CREATE EXTENSION postgis` will fail with
> "could not open extension control file". The PostGIS template is mandatory.

1. Go to [https://railway.com/new](https://railway.com/new) and create a new project. Name it something like `walkability-staging`.

2. Click **"Deploy Template"** and search for **"PostGIS"**.
   Direct link: [https://railway.com/deploy/postgis](https://railway.com/deploy/postgis)

3. The template deploys:
   - Postgres 16
   - PostGIS 3.4 (geospatial extension)
   - pgcrypto (contrib extension, required for `gen_random_uuid()`)

4. Wait for the PostGIS service to show **"Running"** status in the Railway dashboard.

5. Note the internal reference for later use in the backend service:
   ```
   ${{Postgres.DATABASE_PRIVATE_URL}}
   ```
   This Railway reference syntax is resolved at runtime — you do not need the raw value.

---

## Step 2: Railway — Deploy Backend Service

1. In the same Railway project, click **"New Service"** → **"GitHub Repo"**.

2. Select the `bengaluru-walkability-public-audit` repository.

3. **Set Root Directory to `backend`.**
   This is required — Railway's Docker build context must be `backend/` for the Dockerfile's `COPY` commands to work correctly. Without this, the build will fail with missing file errors.

4. Railway will detect the `Dockerfile` automatically (aided by `backend/railway.toml`).

5. Set all environment variables from the checklist in the [Environment Variable Checklist](#environment-variable-checklist) section below.

6. For `DATABASE_URL`, use Railway's internal reference:
   ```
   ${{Postgres.DATABASE_PRIVATE_URL}}
   ```

7. Click **"Deploy"** (or Railway will auto-deploy on save).

8. Monitor the deploy logs. A successful first deployment shows:
   ```
   Listening on 0.0.0.0:<PORT>
   Seeded super-admin user: <your-staging-admin-email>
   ```
   On subsequent boots:
   ```
   Admin seeding skipped: admin_users table already has <N> row(s)
   ```

9. **Note the public Railway URL** (e.g., `https://walkability-api.up.railway.app`).
   You will need this for Vercel and GitHub Actions configuration.

10. Verify the backend is live:
    ```bash
    curl -f https://walkability-api.up.railway.app/health
    ```
    Expected response: `{"status":"ok"}`

---

## Step 3: Vercel — Deploy Frontend

1. Go to [https://vercel.com/new](https://vercel.com/new) and click **"Import Git Repository"**.

2. Select the `bengaluru-walkability-public-audit` repository.

3. **Before deploying, configure the Root Directory:**
   Click **"Edit"** next to Root Directory and set it to `frontend`.
   Vercel will auto-detect Next.js from the `package.json` in that directory.

4. **Set environment variables BEFORE the first build** (see [Environment Variable Checklist](#environment-variable-checklist) below).
   Set variables in **both Production and Preview** scopes.
   `NEXT_PUBLIC_API_URL` is baked at build time — it MUST be set before the first deploy.

5. Click **"Deploy"**. Vercel will build and deploy the frontend automatically.

6. After deploy, note the auto-assigned Vercel URL (e.g., `https://walkability-frontend.vercel.app`).
   You will replace this with the custom domain in the next step.

---

## Step 4: DNS — Configure Custom Domain

1. In the Vercel Dashboard: go to **Project → Settings → Domains → Add**.
   Enter: `staging-walkability.kinariwala.com`

2. Vercel will display the required DNS record. It will typically be a CNAME:
   ```
   CNAME  staging-walkability  cname.vercel-dns.com
   ```
   Use the exact value Vercel shows — it may be project-specific (e.g., `d1d4fc829fe7bc7c.vercel-dns-017.com`).

3. At your DNS registrar for `kinariwala.com`, add the CNAME record:
   - **Type:** CNAME
   - **Name / Host:** `staging-walkability`
   - **Value / Target:** `cname.vercel-dns.com` (or the project-specific value from Vercel)
   - **TTL:** 300 (5 minutes) or your registrar's minimum

4. DNS propagation typically takes **5–30 minutes**.

5. Once DNS propagates, Vercel auto-provisions a TLS certificate (Let's Encrypt).

6. Verify: `https://staging-walkability.kinariwala.com` should load the frontend.

---

## Step 5: GitHub Actions — Configure Secrets

The `.github/workflows/deploy.yml` smoke test job needs the Railway backend URL.

1. Go to GitHub repository → **Settings → Secrets and variables → Actions**.

2. Click **"New repository secret"** and add:

   | Secret | Value |
   |--------|-------|
   | `RAILWAY_BACKEND_URL` | `https://walkability-api.up.railway.app` (your actual Railway URL) |

3. This secret enables the CI smoke test to verify staging health after each push to `main`.

4. To manually trigger a staging validation run:
   Go to **Actions → Deploy → Run workflow** (the `workflow_dispatch` trigger).

---

## Environment Variable Checklist

### Railway Backend Service

Set these in the Railway service's **Variables** tab. All are required before first deploy.

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_PRIVATE_URL}}` | Railway internal reference to PostGIS service. Resolved at runtime. |
| `JWT_SECRET` | _(generate: `openssl rand -hex 32`)_ | Min 32 characters. Must be kept secret. Never reuse across environments. |
| `COOKIE_SECURE` | `true` | Required for SameSite=None cookies over HTTPS. Do NOT set to false on staging. |
| `CORS_ORIGIN` | `https://staging-walkability.kinariwala.com` | Exact match. No trailing slash. No wildcard. The Axum backend uses `allow_credentials(true)` — wildcards are rejected. |
| `UPLOADS_DIR` | `./uploads` | Ephemeral on Railway (lost on redeploy). Acceptable for UAT — see Known Limitations. |
| `PORT` | `3001` | Railway also injects `$PORT` at runtime. Explicit value ensures consistency. |
| `RUST_LOG` | `info` | Logging level for tracing subscriber. Use `debug` for troubleshooting, `info` for normal operation. |
| `ADMIN_SEED_EMAIL` | _(choose staging admin email)_ | Creates the initial super-admin user on first boot. Must be a valid email format. |
| `ADMIN_SEED_PASSWORD` | _(choose strong password, min 12 chars)_ | Used only for initial seed. Change it via Admin UI after first login. |

**Generate a JWT secret:**
```bash
openssl rand -hex 32
```

### Vercel Frontend Project

Set these in Vercel **Project → Settings → Environment Variables**. Set in **both Production and Preview** scopes.

| Variable | Value | Scope | Notes |
|----------|-------|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://walkability-api.up.railway.app` _(example)_ | Production + Preview | Railway backend public URL. **Baked at build time.** Changing this requires a Vercel redeploy. |
| `INTERNAL_API_URL` | `https://walkability-api.up.railway.app` _(example)_ | Production + Preview | Same Railway URL. Used by Next.js server-side fetches and server components. Not baked at build time. |

### GitHub Actions Secrets

Set in **GitHub repository → Settings → Secrets and variables → Actions**.

| Secret | Value | Notes |
|--------|-------|-------|
| `RAILWAY_BACKEND_URL` | `https://walkability-api.up.railway.app` _(example)_ | Railway backend public URL. Used by smoke test job in `deploy.yml`. |

---

## Pre-UAT Verification Checklist

Run through this checklist **before sharing the staging URL with GBA/Walkaluru partners.** Do not share the link until all items are checked.

- [ ] **Railway backend is deployed and healthy**
  ```bash
  curl -f https://<railway-url>/health
  ```
  Expected: `{"status":"ok"}`

- [ ] **PostGIS migrations ran successfully**
  Railway deploy logs show no `postgis.control` errors. All migration files applied cleanly.

- [ ] **Admin seed ran**
  Railway deploy logs show `Admin seed: seeded admin user` (first boot) or `admin already exists, skipping` (subsequent boots).

- [ ] **Vercel frontend loads**
  Visit `https://staging-walkability.kinariwala.com` — the app renders without blank page or console errors.

- [ ] **HTTPS is active on staging URL**
  Browser shows padlock icon on `https://staging-walkability.kinariwala.com`. Certificate is valid (Let's Encrypt).

- [ ] **Admin login works**
  1. Navigate to `https://staging-walkability.kinariwala.com/admin/login`
  2. Enter `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` credentials
  3. Confirm redirect to `/admin/reports` after successful login

- [ ] **Admin cookie is set correctly**
  After login, open browser DevTools → Application → Cookies.
  Confirm `admin_token` cookie is present under `staging-walkability.kinariwala.com`.
  Attributes should include `Secure` and `HttpOnly`.

- [ ] **Admin pages are protected (auth guard works)**
  Open an incognito/private window.
  Navigate directly to `https://staging-walkability.kinariwala.com/admin/reports`.
  Should redirect to `/admin/login` — not render the page.

- [ ] **Public report submission works**
  Navigate to `https://staging-walkability.kinariwala.com/report`.
  Submit a test photo with GPS coordinates (use EXIF photo or manually pin on map).
  Confirm success message.

- [ ] **Reports appear on public map**
  Navigate to `https://staging-walkability.kinariwala.com/map`.
  Confirm the test report pin appears at the submitted location.

- [ ] **Admin report management works**
  Log into `/admin/reports`.
  Confirm the test report submitted above appears in the admin list.
  Change its status and confirm the change persists on refresh.

- [ ] **CI smoke test passes**
  Go to **GitHub → Actions → Deploy → Run workflow** (workflow_dispatch).
  Confirm the Deploy workflow completes successfully.

---

## Known Limitations

### Ephemeral Uploads

Railway does not persist the `uploads/` directory across redeploys. Uploaded photos are stored in the container filesystem at `UPLOADS_DIR=./uploads` and are lost when the backend container restarts or redeploys.

**Impact for UAT:** Test photos will disappear after any Railway redeploy. This is acceptable for UAT — re-upload test photos after redeploy.

**For production:** Either provision a Railway persistent volume (`/app/uploads` mounted as a volume in railway.toml) or migrate to S3/R2 object storage. This must be addressed before production launch.

### Single CORS Origin

`CORS_ORIGIN` accepts exactly one origin. The Axum backend uses `allow_credentials(true)`, which prohibits wildcard origins per the CORS spec.

If you need to test from both `staging-walkability.kinariwala.com` and a Vercel preview URL (e.g., `walkability-frontend-abc123.vercel.app`), you must update `CORS_ORIGIN` to match whichever URL you are actively using. Only one origin can be active at a time without backend code changes.

### Build-Time API URL

`NEXT_PUBLIC_API_URL` is baked into the JavaScript bundle at Vercel build time. If the Railway backend URL changes:
1. Update `NEXT_PUBLIC_API_URL` in Vercel project settings
2. Trigger a Vercel redeploy: **Project → Deployments → Redeploy latest**

### Railway Cold Start

The first request after a period of inactivity may take **5–15 seconds** while Railway's container spins up. Subsequent requests are fast. This is normal behavior for hobby-plan Railway services.

### No Rate Limiting Equivalent for nginx

The staging setup drops nginx and its rate limiting zones. Rate limiting is implemented in the Axum layer via the `governor` crate. CORS and cookie security are enforced at the application level. There is no nginx-equivalent WAF in front of staging — this is acceptable for partner UAT but should be revisited for public launch.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Frontend shows blank page / all API calls return 404 | `NEXT_PUBLIC_API_URL` not set or points to wrong URL | Set the correct Railway URL in Vercel env vars (`NEXT_PUBLIC_API_URL`), then redeploy Vercel |
| Frontend loads but admin login immediately redirects back to login | Cookie domain mismatch or `SameSite` issue | Verify `COOKIE_SECURE=true` on Railway. Verify admin requests go to the correct Railway URL. Check browser DevTools → Network for the login response cookie. |
| `CREATE EXTENSION postgis` fails in migration logs | Using standard Railway Postgres, not PostGIS template | Delete the Postgres service. Deploy the PostGIS template from `railway.com/deploy/postgis` instead. |
| Smoke test fails in CI with connection refused | `RAILWAY_BACKEND_URL` secret not set, or Railway is still deploying | Add `RAILWAY_BACKEND_URL` in GitHub Settings → Secrets. Wait 1–2 minutes after Railway deploy completes before re-running. |
| CORS error in browser console (`Access-Control-Allow-Origin` missing) | `CORS_ORIGIN` on Railway does not match the browser-visible URL | Set `CORS_ORIGIN` to the exact staging URL: `https://staging-walkability.kinariwala.com` (include `https://`, no trailing slash) |
| Photos disappear after redeploy | Ephemeral uploads — Railway filesystem reset on container restart | Expected behavior for UAT. Re-upload test photos after each Railway redeploy. See Known Limitations. |
| Railway deploy fails with "COPY failed: file not found" | Root Directory not set to `backend` in Railway service settings | In Railway: Service → Settings → Source → Root Directory → set to `backend` |
| Vercel build fails: "Cannot find module" or TypeScript errors | `npm install` or type issues in `frontend/` | Check Vercel build logs. Ensure Root Directory is set to `frontend` in Vercel project settings. |
| Admin API calls fail from browser (CORS ok, 401/403) | `INTERNAL_API_URL` not set on Vercel | Set `INTERNAL_API_URL` to the Railway backend URL in Vercel env vars (Production + Preview scope) |
| DNS not resolving after adding CNAME | Propagation delay or wrong CNAME target | Wait 30 minutes. Use `dig staging-walkability.kinariwala.com CNAME` to verify propagation. Use exact Vercel-provided CNAME value. |

---

## Re-deployment Reference

### After Code Changes

Both platforms auto-deploy on push to `main`:
- **Railway:** detects Dockerfile in `backend/`, rebuilds and redeploys automatically
- **Vercel:** detects changes in `frontend/`, rebuilds and redeploys automatically

### Triggering Manual Staging Validation

```bash
# Via GitHub Actions UI
# Go to: Actions → Deploy → Run workflow
```

### Updating Environment Variables

**Railway:** Service → Variables → edit value → Railway redeploys automatically.

**Vercel:** Project → Settings → Environment Variables → edit value → must trigger a manual redeploy (Vercel does NOT redeploy automatically on env var changes for Production).
For `NEXT_PUBLIC_API_URL` specifically, a redeploy is mandatory because it is baked at build time.

---

*This document is the canonical staging setup reference. Update it whenever the staging architecture changes.*
