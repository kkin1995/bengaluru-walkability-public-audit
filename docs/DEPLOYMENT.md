<!-- generated-by: gsd-doc-writer -->
# Deployment

This document covers production self-hosted deployment via Docker Compose, the staging environment on Railway + Vercel, environment variable setup, database migrations, nginx configuration, image persistence, rolling updates, and health checks.

For a complete list of all environment variables and their defaults, see [CONFIGURATION.md](CONFIGURATION.md).

---

## Deployment Targets

| Target | Config File | Notes |
|--------|-------------|-------|
| Self-hosted (Docker Compose) | `docker-compose.yml` | Production reference; nginx on port 80, all services containerised |
| Staging — Backend | `backend/railway.toml` | Railway Hobby plan; auto-deploy on push to `main` |
| Staging — Frontend | Vercel project settings | Vercel free tier; auto-deploy on push to `main` |
| Local development | `docker-compose.dev.yml` | Overlaid on top of `docker-compose.yml`; hot-reload for both backend and frontend |

The `nginx/` directory and `docker-compose.yml` are the canonical production target. Staging uses Railway (backend) and Vercel (frontend) without nginx — see [Staging Deployment](#staging-deployment-railway--vercel) below.

---

## Production Deployment (Self-Hosted Docker Compose)

### Prerequisites

- Docker Engine 24+ and Docker Compose v2 installed on the host <!-- VERIFY: minimum Docker version for host -->
- Port 80 open in the host firewall <!-- VERIFY: production host firewall configuration -->
- DNS record pointing your domain to the host IP <!-- VERIFY: DNS provider and record configuration -->

### Step 1 — Clone and configure

```bash
git clone https://github.com/kkin1995/bengaluru-walkability-public-audit.git
cd bengaluru-walkability-public-audit
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set all required values. At minimum:

```bash
POSTGRES_PASSWORD=<strong-random-password>
DATABASE_URL=postgres://walkability:<strong-random-password>@localhost:5432/walkability
JWT_SECRET=$(openssl rand -hex 64)
COOKIE_SECURE=true
ADMIN_SEED_EMAIL=admin@yourdomain.com
ADMIN_SEED_PASSWORD=<strong-initial-password>
```

The two variables `POSTGRES_PASSWORD` and `JWT_SECRET` must also be present in the shell environment (or a `.env` file at the project root) when running `docker compose`, because `docker-compose.yml` reads them directly:

```bash
export POSTGRES_PASSWORD=<same-value-as-above>
export JWT_SECRET=<same-value-as-above>
```

Or create a `.env` file at the project root:

```
POSTGRES_PASSWORD=<strong-random-password>
JWT_SECRET=<64-char-hex-string>
```

### Step 2 — Build and start

```bash
docker compose up --build -d
```

Docker Compose starts services in dependency order:

1. `db` (PostGIS) — waits for `pg_isready` health check to pass
2. `backend` (Rust/Axum) — waits for `db` to be healthy; runs migrations automatically on startup
3. `frontend` (Next.js) — waits for `backend` to start
4. `nginx` — waits for both `backend` and `frontend` health checks to pass before accepting traffic

### Step 3 — Verify

```bash
# Health check via nginx
curl -f http://localhost/health
# Expected: {"status":"ok"}

# Check all containers are running
docker compose ps
```

The admin dashboard is available at `http://<host>/admin/login`. Log in with the `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` values set above. Change the password immediately after first login.

---

## Database Migrations

Migrations run automatically each time the backend container starts. No manual migration step is needed.

The backend uses `sqlx::migrate!()` which applies all pending SQL files from `backend/migrations/` in filename order at startup. Applied migrations are tracked in the `_sqlx_migrations` table so each file runs only once.

| Migration | Contents |
|-----------|----------|
| `001_init.sql` | `reports` table, enums, PostGIS geography index, triggers |
| `002_admin.sql` | `admin_users`, `status_history`, `user_role` enum |
| `003_super_admin.sql` | `is_super_admin BOOLEAN` column on `admin_users` |
| `004_ward_boundaries.sql` | Ward boundary geometry data |
| `005_organizations.sql` | `organizations` table |
| `006_ward_org_scoping.sql` | Ward-to-organisation scoping links |
| `007_anti_abuse.sql` | Honeypot and abuse prevention fields |

The `reports.location` column (GEOGRAPHY type) is populated automatically from `lat`/`lng` values via a trigger — never set it directly.

**Required PostgreSQL extensions:** `postgis`, `pgcrypto`. Both are pre-installed in the `postgis/postgis:16-3.4-alpine` image used by `docker-compose.yml`.

---

## nginx Configuration

nginx acts as the reverse proxy, entry point, and rate limiter. The config lives at `nginx/nginx.conf` and is bind-mounted read-only into the nginx container.

### Port and TLS

nginx listens on port 80 only. TLS must be terminated upstream — by a cloud load balancer (e.g., AWS ALB, Cloudflare) or by extending `nginx.conf` to add a TLS listener.

To enable TLS directly on nginx:

1. Mount your certificate files: add `- ./certs:/etc/letsencrypt:ro` to the nginx volumes in `docker-compose.yml`.
2. Uncomment the TLS block in `nginx/nginx.conf` and update `server_name` to your domain.
3. `COOKIE_SECURE=true` is already the default in `docker-compose.yml` — no change needed there.

The commented TLS block in `nginx.conf` shows the exact `ssl_certificate`, `ssl_certificate_key`, `ssl_protocols`, and `ssl_ciphers` directives to use.

### Routing rules

| Path pattern | Upstream | Notes |
|---|---|---|
| `/health` | `backend:3001` | Health probe; no rate limiting |
| `= /api/admin/auth/login` | `backend:3001` | 5 req/min per IP, burst 3 (`admin_login` zone) |
| `/api/admin/*` | `backend:3001` | 60 req/min per IP, burst 10 (`admin_api` zone) |
| `/api/*` | `backend:3001` | 5 POST req/min per IP, burst 2 (`upload` zone); GET/HEAD requests are not counted |
| `/uploads/*` | `backend:3001` | Served by Axum `ServeDir`; cached 30 days at the browser |
| `/admin*` | `frontend:3000` | Security headers applied: `X-Frame-Options: DENY`, CSP, `X-Content-Type-Options`, `Referrer-Policy` |
| `/` | `frontend:3000` | All other requests |

### Request size limits

- `client_max_body_size 20M` — maximum upload size
- `client_body_buffer_size 10m` — in-memory buffer before spooling to disk

### Memory limits

Each service has a Docker resource cap defined in `docker-compose.yml`:

| Service | Memory limit |
|---------|-------------|
| `db` | 512 MB |
| `backend` | 256 MB |
| `frontend` | 256 MB |
| `nginx` | 64 MB |

Increase these limits in `docker-compose.yml` if the application grows beyond the current usage profile.

---

## Image Persistence (Uploads Volume)

Uploaded photos are stored in a named Docker volume (`uploads`) mounted at `/app/uploads` inside the backend container. This volume persists across container restarts and image rebuilds.

```yaml
# docker-compose.yml
volumes:
  postgres_data:   # database files
  uploads:         # user-uploaded photos
```

The `entrypoint.sh` script re-applies the correct ownership to `/app/uploads` on each container start (the named volume mount overwrites the image layer, so ownership must be fixed at runtime):

```sh
chown -R appuser:appuser /app/uploads
exec gosu appuser "$@"
```

The backend process runs as a non-root system user (`appuser`) for security. It cannot write outside `/app/uploads` even if a path-traversal bug exists in the upload handler.

**Production note:** The current storage implementation uses the local filesystem via Axum `tower-http ServeDir`. The code is structured for straightforward migration to S3-compatible object storage (S3, R2) when self-hosted volume capacity becomes a constraint.

---

## Health Checks

All four services expose health checks that Docker Compose uses to gate startup ordering.

| Service | Health check command | Interval | Timeout | Start period | Retries |
|---------|---------------------|----------|---------|--------------|---------|
| `db` | `pg_isready -U walkability -d walkability` | 5s | 5s | — | 10 |
| `backend` | `curl -f http://localhost:3001/health` | 10s | 5s | 30s | 3 |
| `frontend` | `wget -qO- http://127.0.0.1:3000/` | 10s | 5s | 30s | 3 |
| `nginx` | `curl -f http://localhost/health` | 30s | 5s | 10s | 3 |

nginx only starts after both `backend` and `frontend` report healthy. This prevents nginx from returning 502 errors on the first real request after a fresh deployment.

The backend `/health` endpoint returns `{"status":"ok"}` when the server is accepting connections.

---

## Rolling Updates

To deploy a new version without downtime:

```bash
# Pull the latest code
git pull origin main

# Rebuild only the changed services and restart them
docker compose up --build -d --no-deps backend frontend

# Verify health after restart
curl -f http://localhost/health
docker compose ps
```

`--no-deps` prevents Compose from also restarting `db` and `nginx`. The `unless-stopped` restart policy means the backend and frontend containers restart automatically if they crash during or after the update.

If you need to update nginx configuration only (no code change):

```bash
docker compose exec nginx nginx -s reload
```

### Restart policies

| Service | Policy | Rationale |
|---------|--------|-----------|
| `db` | `always` | Stateful — must recover from OOM or host reboots |
| `backend` | `unless-stopped` | Restart on crash; respect intentional `docker compose stop` |
| `frontend` | `unless-stopped` | Same as backend |
| `nginx` | `unless-stopped` | Stateless; restart freely on failure |

---

## Build Pipeline (CI/CD)

Two GitHub Actions workflows manage CI and deployment.

### CI (`ci.yml`)

Triggers on every push and pull request to any branch.

1. **Frontend checks** — `npm run lint`, `npm test`, `npm audit --audit-level=critical` (Node 20)
2. **Backend checks** — `cargo clippy -- -D warnings`, `cargo test`, `cargo audit` (Rust stable)
3. **Docker build** — `docker compose build` with dummy secrets to verify all images build cleanly

### Deploy (`deploy.yml`)

Triggers on push to `main` and supports manual `workflow_dispatch`.

1. Runs the full CI workflow (reuses `ci.yml`)
2. After CI passes, runs a smoke test against the Railway staging environment:
   - Waits 30 seconds for Railway and Vercel to begin redeployment
   - Retries the Railway `/health` endpoint up to 5 times with 15-second intervals
   - Checks `/api/reports` responds successfully
   - Checks the Vercel staging frontend returns HTTP 200

The smoke test requires the `RAILWAY_BACKEND_URL` GitHub Actions secret. If the secret is not set, smoke tests are skipped (a workflow notice is emitted but the job does not fail).

---

## Staging Deployment (Railway + Vercel)

The staging environment replaces Docker Compose + nginx with managed cloud services. nginx is not used for staging — Railway terminates HTTPS for the backend and Vercel terminates HTTPS for the frontend.

| Layer | Platform | Notes |
|-------|----------|-------|
| Frontend | Vercel (free tier) | Auto-deploy from `main`; root directory set to `frontend` |
| Backend | Railway (Hobby plan) | Rust/Axum Docker service; root directory set to `backend` |
| Database | Railway PostGIS template | Postgres 16 + PostGIS 3.4 + pgcrypto — use the PostGIS template, not standard Railway Postgres |
| HTTPS | Railway + Vercel | Each platform terminates TLS for its own service |

For full staging setup steps, see [STAGING-SETUP.md](../STAGING-SETUP.md).

### Critical staging deployment order

Railway must be fully deployed and running before Vercel builds the frontend. `NEXT_PUBLIC_API_URL` is baked into the Next.js JavaScript bundle at Vercel build time.

```
1. Railway PostGIS DB     → provision; wait for "Running" status
2. Railway Backend        → deploy; verify /health responds
3. Vercel Frontend        → set NEXT_PUBLIC_API_URL to Railway URL; deploy
4. DNS                    → add CNAME after Vercel domain is confirmed
```

### Staging environment variables

**Railway backend service:**

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_PRIVATE_URL}}` (Railway internal reference) |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `COOKIE_SECURE` | `true` |
| `CORS_ORIGIN` | Exact staging frontend URL (no trailing slash) |
| `UPLOADS_DIR` | `./uploads` |
| `PORT` | `3001` |
| `ADMIN_SEED_EMAIL` | Initial admin email |
| `ADMIN_SEED_PASSWORD` | Initial admin password (min 12 chars) |

**Vercel frontend project:**

| Variable | Value | Note |
|----------|-------|------|
| `NEXT_PUBLIC_API_URL` | Railway backend public URL | Baked at build time; redeploy required if it changes |
| `INTERNAL_API_URL` | Railway backend public URL | Server-side fetches; not baked at build time |

### Railway config-as-code

`backend/railway.toml` configures the Railway service:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
```

### Staging known limitations

- **Ephemeral uploads:** Railway does not persist the `uploads/` directory across redeploys. Test photos are lost on each Railway redeploy. For production, mount a Railway persistent volume at `/app/uploads` or migrate to S3/R2 object storage.
- **Single CORS origin:** `CORS_ORIGIN` accepts exactly one origin. The backend uses `allow_credentials(true)`, which prohibits wildcard origins per the CORS spec.
- **Build-time API URL:** If the Railway backend URL changes, update `NEXT_PUBLIC_API_URL` in Vercel and trigger a manual redeploy.

---

## Environment Setup Reference

See [CONFIGURATION.md](CONFIGURATION.md) for the full variable reference with defaults and validation rules.

### Generate secrets

```bash
# JWT secret (minimum 32 chars; 64-char hex recommended)
openssl rand -hex 64

# Database password (32-char hex)
openssl rand -hex 32
```

### Admin seed

The backend seeds an initial super-admin user on first boot if `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` are both set. On subsequent boots, if an admin already exists, seeding is skipped.

```
# First boot deploy log
Admin seed: seeded admin user admin@yourdomain.com

# Subsequent boots
Admin seed: admin already exists, skipping
```

Remove `ADMIN_SEED_PASSWORD` from the environment after the first login and password change. A startup warning is logged whenever this variable is present.

---

## Rollback Procedure

### Docker Compose (self-hosted)

Redeploy the previous Docker image by checking out the previous commit and rebuilding:

```bash
git checkout <previous-commit-sha>
docker compose up --build -d --no-deps backend frontend
```

Or, if you tag releases, pull the previous tag:

```bash
git checkout v<previous-version>
docker compose up --build -d
```

Database migrations are forward-only. If a migration must be reversed, write a new migration file that undoes the schema change — do not delete or reorder existing migration files.

### Staging (Railway + Vercel)

- **Railway:** Go to the Railway service → Deployments → select a previous deployment → Redeploy.
- **Vercel:** Go to Project → Deployments → select a previous deployment → Promote to Production.

---

## Monitoring

No third-party monitoring library is currently integrated.

The backend emits structured tracing logs via the `tracing` crate. The `RUST_LOG` environment variable controls the log level (`info` in production, `debug` for troubleshooting). nginx emits JSON-formatted access logs to `/var/log/nginx/access.log` with fields: `time`, `request_id`, `method`, `uri`, `status`, `bytes_sent`, `request_time`, `remote_addr`, `http_user_agent`.

To stream logs in production:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f nginx
```
