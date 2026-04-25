<!-- generated-by: gsd-doc-writer -->
# Configuration

This document covers all environment variables and configuration files for the Bengaluru Walkability Public Audit stack: the Rust/Axum backend, the Next.js frontend, and the Docker Compose orchestration layer.

---

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in the values marked as required.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Required** | — | Full PostgreSQL connection string. Example: `postgres://walkability:secret@localhost:5432/walkability`. Panics on startup if absent. |
| `JWT_SECRET` | **Required** | — | HMAC-SHA256 signing key for admin session JWTs. Minimum 32 characters. Generate with `openssl rand -hex 64`. Panics on startup if absent or shorter than 32 characters. |
| `PORT` | Optional | `3001` | TCP port the Axum server binds on. |
| `UPLOADS_DIR` | Optional | `./uploads` | Filesystem path where uploaded images are written. Created automatically on startup if it does not exist. |
| `CORS_ORIGIN` | Optional | `http://localhost:3000` | Single origin allowed for cross-origin requests (passed verbatim to the CORS `Allow-Origin` header). Must exactly match the frontend origin, including protocol and port. |
| `PUBLIC_URL` | Optional | `http://localhost` | Base URL of the deployed service, used to construct absolute URLs in API responses. Empty string is treated as absent and falls back to the default. |
| `JWT_SESSION_HOURS` | Optional | `24` | Admin session duration in hours. Clamped to the range 1–168 at startup. |
| `COOKIE_SECURE` | Optional | `false` (dev) / `true` (prod) | Set to `true` in production to require HTTPS for the `admin_token` cookie. The production `docker-compose.yml` defaults this to `true`. |
| `ADMIN_SEED_EMAIL` | Optional | — | Email address for the initial super-admin account. Seeding is skipped if either seed variable is absent or empty. |
| `ADMIN_SEED_PASSWORD` | Optional | — | Plaintext password for the initial super-admin account, hashed with Argon2id before storage. **Remove from the environment after first login and password change.** A startup warning is logged whenever this variable is present. |
| `RUST_LOG` | Optional | `bengaluru_walkability_backend=info,tower_http=info` | Tracing filter passed to `tracing_subscriber::EnvFilter`. Set in `docker-compose.yml` as `info`. |

### Frontend (`frontend/.env.local`)

Copy `frontend/.env.local.example` to `frontend/.env.local`. All configuration logic is centralised in `frontend/app/lib/config.ts` — do not reference `process.env.*` directly in component files.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Optional | `""` (empty string) | Client-side base URL for public API calls (report submission, map data). Set to `""` in Docker so the browser uses relative URLs resolved against the nginx proxy. Set to `http://localhost:3001` for local dev without Docker. **Baked into the Next.js bundle at build time** — a rebuild is required if this value changes. |
| `INTERNAL_API_URL` | Optional | `http://localhost:3001` | Server-side base URL for Next.js server components and `next.config.mjs` rewrites. Never sent to the browser. In Docker, set to `http://backend:3001` (Docker internal hostname). |
| `NEXT_OUTPUT` | Optional | — | Set to `"standalone"` to enable Next.js standalone output mode, required for Docker/self-hosted builds. Not needed on Vercel. |

### Docker Compose variables (`.env` at project root or shell environment)

These variables are consumed by `docker-compose.yml` and forwarded to the appropriate service containers.

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_PASSWORD` | **Required** | — | PostgreSQL superuser password. No fallback — compose will hard-fail if absent. |
| `JWT_SECRET` | **Required** | — | Forwarded to the backend container. Compose will hard-fail (`${JWT_SECRET:?}`) if absent. |
| `POSTGRES_DB` | Optional | `walkability` | PostgreSQL database name. |
| `POSTGRES_USER` | Optional | `walkability` | PostgreSQL username. |
| `CORS_ORIGIN` | Optional | `http://localhost` | Forwarded to the backend. Override for staging or custom domains. |
| `COOKIE_SECURE` | Optional | `true` | Forwarded to the backend. Default is `true` in the production compose file; overridden to `false` in `docker-compose.dev.yml`. |
| `JWT_SESSION_HOURS` | Optional | `24` | Forwarded to the backend. |
| `ADMIN_SEED_EMAIL` | Optional | — | Forwarded to the backend. |
| `ADMIN_SEED_PASSWORD` | Optional | — | Forwarded to the backend. Remove after first login. |

---

## Config File Format

### Backend — `backend/src/config.rs`

`Config::from_env()` reads `DATABASE_URL` (panics if absent) and the optional variables `PORT`, `UPLOADS_DIR`, `CORS_ORIGIN`, and `PUBLIC_URL`. `JWT_SECRET` is NOT part of the `Config` struct — it is read and validated directly in `main.rs` (panics if absent or shorter than 32 characters), independently of `Config::from_env()`. There is no separate config file: all values come from environment variables, and misconfigured deployments fail fast at startup rather than at request time.

```rust
// Required — panics with "DATABASE_URL must be set" if absent
DATABASE_URL=postgres://walkability:secret@localhost:5432/walkability

// Required — panics if absent or shorter than 32 characters
JWT_SECRET=<output of: openssl rand -hex 64>

// Optional with defaults
UPLOADS_DIR=./uploads
PORT=3001
CORS_ORIGIN=http://localhost:3000
PUBLIC_URL=http://localhost
JWT_SESSION_HOURS=24
COOKIE_SECURE=false
```

### Frontend — `frontend/app/lib/config.ts`

All environment-variable-based configuration for the frontend is centralised here. Never reference `process.env.*` directly in component or page files.

```typescript
// Resolved at runtime (client-side)
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Always empty string — admin routes use Next.js rewrites
export const ADMIN_API_BASE_URL = "";

// Server-side only — never sent to the browser
export const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ?? "http://localhost:3001";
```

### nginx — `nginx/nginx.conf`

nginx is configured via `nginx/nginx.conf` (mounted read-only into the container). Key settings that affect the application:

| Setting | Value | Purpose |
|---|---|---|
| `client_max_body_size` | `20M` | Matches the Axum `DefaultBodyLimit` (20 MB) to allow iPhone JPEG uploads. |
| `client_body_buffer_size` | `10m` | Buffers upload bodies in memory before spooling to disk. |
| Upload rate limit (`/api/`) | 5 req/min, burst 2 | POST-only; GET requests are not throttled. |
| Admin login rate limit | 5 req/min, burst 3 | Applied to `POST /api/admin/auth/login` only. |
| Admin API rate limit | 60 req/min, burst 10 | Applied to all other `/api/admin/*` routes. |

---

## Required vs Optional Settings

Settings that cause the application to fail on startup if absent:

| Variable | Component | Failure message |
|---|---|---|
| `DATABASE_URL` | Backend | `DATABASE_URL must be set` (Rust `expect`) |
| `JWT_SECRET` | Backend | `JWT_SECRET environment variable must be set` / panics if shorter than 32 chars |
| `POSTGRES_PASSWORD` | Docker Compose (db service) | Compose hard-failure — no fallback defined |
| `JWT_SECRET` | Docker Compose | `JWT_SECRET must be set in the environment or .env file` (compose `${VAR:?}` syntax) |

All other variables have defaults and will not cause startup failure.

---

## Defaults

| Variable | Default value | Where set |
|---|---|---|
| `PORT` | `3001` | `config.rs`: `unwrap_or_else(|_| "3001".to_string())` |
| `UPLOADS_DIR` | `./uploads` | `config.rs`: `unwrap_or_else(|_| "./uploads".to_string())` |
| `CORS_ORIGIN` | `http://localhost:3000` | `config.rs`: `unwrap_or_else(|_| "http://localhost:3000".to_string())` |
| `PUBLIC_URL` | `http://localhost` | `config.rs`: empty or absent value falls back to `"http://localhost"` |
| `JWT_SESSION_HOURS` | `24` | `main.rs`: `.unwrap_or(24).clamp(1, 168)` |
| `POSTGRES_DB` | `walkability` | `docker-compose.yml`: `${POSTGRES_DB:-walkability}` |
| `POSTGRES_USER` | `walkability` | `docker-compose.yml`: `${POSTGRES_USER:-walkability}` |
| `CORS_ORIGIN` (compose) | `http://localhost` | `docker-compose.yml`: `${CORS_ORIGIN:-http://localhost}` |
| `COOKIE_SECURE` (compose) | `true` | `docker-compose.yml`: `${COOKIE_SECURE:-true}` |
| `INTERNAL_API_URL` | `http://localhost:3001` | `frontend/app/lib/config.ts`: `?? "http://localhost:3001"` |
| `NEXT_PUBLIC_API_URL` | `""` | `frontend/app/lib/config.ts`: `?? ""` |

---

## Per-Environment Overrides

### Local development (without Docker)

```bash
# backend/.env
DATABASE_URL=postgres://walkability:secret@localhost:5432/walkability
PORT=3001
CORS_ORIGIN=http://localhost:3000
COOKIE_SECURE=false
JWT_SECRET=<min-32-chars>
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=<strong-password>

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
INTERNAL_API_URL=http://localhost:3001
```

### Local development (Docker Compose dev mode)

`docker-compose.dev.yml` overrides the production compose file. Key overrides:

- `CORS_ORIGIN=http://localhost:3000` (backend)
- `COOKIE_SECURE=false` (backend)
- `NEXT_PUBLIC_API_URL=http://localhost:3001` (frontend build arg and runtime env)
- Database port `5432` exposed to host for direct psql/pgAdmin access
- Backend runs with `cargo watch -x run` (hot reload)
- Frontend runs with `npm run dev` (hot reload)

Run with both files:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Production (Docker Compose)

```bash
# Copy and fill in the required secrets
cp backend/.env.example backend/.env
# Edit backend/.env:
#   POSTGRES_PASSWORD=<strong-password>
#   DATABASE_URL=postgres://walkability:<strong-password>@localhost:5432/walkability
#   JWT_SECRET=<openssl rand -hex 64>
#   COOKIE_SECURE=true
#   ADMIN_SEED_EMAIL=admin@yourdomain.com
#   ADMIN_SEED_PASSWORD=<strong-password>  # remove after first login

docker compose up --build
```

In production:
- `COOKIE_SECURE` defaults to `true` (HTTPS required for the admin session cookie).
- `NEXT_PUBLIC_API_URL` is set to `""` so the browser uses relative URLs — nginx proxies `/api/*` and `/uploads/*` to the backend internally.
- `INTERNAL_API_URL` is set to `http://backend:3001` (Docker internal network hostname).
- TLS must be terminated upstream (cloud load balancer or a TLS listener added to nginx). <!-- VERIFY: production TLS termination method -->

---

## Frontend Dockerfile Build-Time Variables

The `frontend/Dockerfile` declares two additional variables at the builder stage that are not set via `.env.local` but are fixed at image build time.

| Variable | Stage | Default | Description |
|---|---|---|---|
| `NEXT_OUTPUT` | Build arg (`ARG`) | `standalone` | Controls the Next.js output mode. Defaults to `"standalone"` in the Dockerfile — required for Docker/self-hosted deploys. Override to `""` only when building for Vercel (which manages its own output format). |
| `NEXT_TELEMETRY_DISABLED` | Build + runtime (`ENV`) | `1` | Disables Next.js anonymous telemetry. Hardcoded to `1` in the Dockerfile and is not configurable via `.env.local`. |

`NEXT_OUTPUT` can be overridden at `docker compose build` time by passing a build arg:

```bash
docker compose build --build-arg NEXT_OUTPUT=standalone frontend
```

---

## Additional nginx Settings

The following `nginx/nginx.conf` settings are relevant to operations but not covered in the main table above.

### Proxy timeouts

| Directive | Value | Scope |
|---|---|---|
| `proxy_connect_timeout` | `5s` | All proxied locations |
| `proxy_send_timeout` | `30s` | All proxied locations |
| `proxy_read_timeout` | `30s` | All proxied locations |

These are set globally on the `server` block and repeated explicitly on the admin login location. Increase `proxy_read_timeout` if long-running admin queries (e.g. large report exports) begin timing out.

### Upload body temp path

`client_body_temp_path /tmp/nginx_upload_temp` — nginx spools request bodies larger than `client_body_buffer_size` to this directory. The directory must be writable by the nginx worker process. The `nginx:alpine` container image writes to `/tmp` by default; no volume mount is required unless you want to place it on a dedicated fast volume.

### Static image caching (`/uploads/`)

Responses served from `/uploads/` carry `Cache-Control: public, no-transform` with an `Expires` header set 30 days in the future. This is appropriate for immutable uploaded files. If an uploaded image is replaced (same filename), downstream caches will serve the stale version for up to 30 days.

### Security headers on `/admin` routes

nginx adds the following response headers to all requests matching the `/admin` location prefix. These headers are **not** applied to public routes (`/`, `/api/*`) to avoid restricting the public map (which uses `blob:` and `data:` URIs for Leaflet tiles and marker icons).

| Header | Value | Purpose |
|---|---|---|
| `X-Frame-Options` | `DENY` | Prevents clickjacking of the admin dashboard. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing on admin page responses. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referer leakage when navigating away from admin pages. |
| `Content-Security-Policy` | See `nginx/nginx.conf` | Restricts script/style/image sources. `script-src 'unsafe-inline'` is an accepted risk — Next.js injects inline script chunks at build time. Full nonce-based remediation is tracked for post-launch. |

### Structured JSON access logging

All requests are logged in JSON format to `/var/log/nginx/access.log` using the `json_combined` log format. Each log line includes: `time`, `request_id`, `method`, `uri`, `status`, `bytes_sent`, `request_time`, `remote_addr`, and `http_user_agent`. The `request_id` field is sourced from the `$request_id` nginx variable and is also forwarded to the backend via the `X-Request-ID` request header, enabling correlation of nginx access logs with backend trace logs.

---

## Backend In-Process Rate Limiter

In addition to the nginx-layer rate limits, the backend applies its own per-submission rate limit using the `governor` crate. This limit is **hardcoded** and is not configurable via environment variables.

| Limit | Key | Value |
|---|---|---|
| Report submission | Per submitter IP + geohash-6 cell | 2 submissions per hour |

The key format is `"{ip}:{geohash6}"`. A submitter who changes location by more than approximately 1.2 km (one geohash-6 cell width) starts a fresh quota bucket. This limit is enforced inside the `POST /api/reports` handler independently of the nginx upload rate limit (5 req/min, burst 2) — both limits must pass for a submission to be accepted.

To change this limit, edit `main.rs`:

```rust
let quota = governor::Quota::per_hour(std::num::NonZeroU32::new(2).unwrap());
```
