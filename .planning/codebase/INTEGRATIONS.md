# External Integrations

**Analysis Date:** 2026-03-11

## APIs & External Services

**Mapping / Tiles:**
- OpenStreetMap (via Leaflet default tile layer) — public map display and interactive pin placement
  - SDK/Client: `leaflet 1.9.4` + `react-leaflet 4.2.1`
  - Auth: None (public tile CDN)
  - Used in: `frontend/app/components/ReportsMap.tsx`, `frontend/app/admin/reports/map/page.tsx`, `frontend/app/report/page.tsx`

**Reverse Geocoding:**
- Nominatim (OpenStreetMap) — converts pinned lat/lng to human-readable address in the report review strip
  - SDK/Client: Direct `fetch` to `https://nominatim.openstreetmap.org/reverse`
  - Auth: None (public API, usage-policy: max 1 req/s)
  - Used in: `frontend/app/components/ReviewStrip.tsx`

## Data Storage

**Databases:**
- PostgreSQL 16 with PostGIS 3.4 (Alpine image `postgis/postgis:16-3.4-alpine`)
  - Connection env var: `DATABASE_URL` (format: `postgres://user:pass@host:5432/dbname`)
  - Client: `sqlx 0.7` with `runtime-tokio-rustls` (async, TLS-capable)
  - Extensions: `postgis` (geospatial queries, GEOGRAPHY type), `pgcrypto` (`gen_random_uuid()`)
  - Schema migrations: `backend/migrations/001_init.sql`, `002_admin.sql`, `003_super_admin.sql`
  - Applied automatically on backend startup via `sqlx::migrate!("./migrations")`

**File Storage:**
- Local filesystem — uploaded photos stored at `backend/uploads/` (Docker named volume `uploads`)
  - Served via `tower-http ServeDir` at `/uploads` path — `backend/src/main.rs`
  - EXIF GPS metadata stripped by `img-parts 0.3` before writing to disk
  - Body limit: 20 MB (nginx `client_max_body_size 20M` + Axum `DefaultBodyLimit::max(20MB)`)
  - Abstraction-ready for S3 swap (images accessed via `/uploads/:filename` URL pattern)

**Caching:**
- None (no Redis or in-memory cache layer)
- Nginx serves uploaded images with `Cache-Control: public, no-transform` and `expires 30d`

## Authentication & Identity

**Auth Provider:**
- Custom — no third-party identity provider
- Admin portal uses stateful JWT sessions stored as HttpOnly cookies
  - Cookie name: `admin_token`
  - Algorithm: HS256 (only; `alg:none` explicitly rejected)
  - Secret: `JWT_SECRET` env var (minimum 32 chars, required)
  - Session duration: `JWT_SESSION_HOURS` env var (default 24h, clamped 1–168h)
  - Password storage: Argon2id hashing via `argon2 0.5`
  - Implementation: `backend/src/middleware/auth.rs` (pure `extract_claims` + `require_role` functions + Axum middleware `require_auth`)
  - Roles: `admin` (full access, superset of all roles), `reviewer` (read + status update only)
  - Super-admin flag: `is_super_admin BOOLEAN` in `admin_users` table (migration `003_super_admin.sql`) — guards deactivation of super-admin accounts

**Public Reporting:**
- Anonymous — no auth required for submitting or viewing reports
- EXIF GPS extracted client-side by `exifr 7.1.3` (raw GPS data never sent to server)
- Public lat/lng rounded to 3 decimal places (~111m) in `Report::into_response()` — privacy-preserving

**Frontend Auth Gate:**
- Next.js Edge Middleware (`frontend/middleware.ts`) — cookie presence check redirects unauthenticated users from `/admin/*` to `/admin/login`
- Server-side layout fetch (`frontend/app/admin/layout.tsx`) — calls `GET /api/admin/auth/me` using `INTERNAL_API_URL` for server-to-server auth verification

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)

**Logs:**
- Backend: structured JSON logs via `tracing-subscriber` with `json()` formatter
  - Log level controlled by `RUST_LOG` env var (set to `info` in docker-compose)
  - `X-Request-ID` header propagated from nginx → backend → response headers, injected into tracing spans via `request_id_middleware` in `backend/src/main.rs`
- Nginx: JSON access logs with `request_id`, method, URI, status, bytes, timing, remote addr
  - Format: `json_combined` in `nginx/nginx.conf`
  - Path: `/var/log/nginx/access.log`

## CI/CD & Deployment

**Hosting:**
- Self-hosted single server (SSH deploy placeholder in `.github/workflows/deploy.yml`)
- Docker Compose deployment on port 80 via nginx

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml`
- Three parallel jobs:
  1. `frontend-checks`: Node 20, `npm ci`, `npm run lint` (ESLint), `npm test`
  2. `backend-checks`: Rust stable + clippy (`-D warnings`), `cargo test`
  3. `docker-build`: `docker compose build` (verifies image builds; does not start containers)
- Triggers: push to any branch, PRs to any branch, and `workflow_call` from `deploy.yml`
- Required CI secrets (not used in CI checks, only deploy): `JWT_SECRET`, `COOKIE_SECURE`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`

## Environment Configuration

**Required env vars (production):**
- `POSTGRES_PASSWORD` — no default (hard failure if absent)
- `JWT_SECRET` — no default, minimum 32 chars (hard panic if absent or short)
- `CORS_ORIGIN` — set to production domain
- `COOKIE_SECURE=true` — mandatory for HTTPS deployments

**Optional env vars with defaults:**
- `POSTGRES_DB` — default `walkability`
- `POSTGRES_USER` — default `walkability`
- `UPLOADS_DIR` — default `./uploads`
- `PORT` — default `3001`
- `JWT_SESSION_HOURS` — default `24`
- `COOKIE_SECURE` — default `false`
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` — empty by default (no seed)
- `PUBLIC_URL` — default `http://localhost`
- `INTERNAL_API_URL` — default `http://localhost:3001` (set to `http://backend:3001` in docker-compose)

**Secrets location:**
- Docker Compose: `.env` file at repo root (referenced via `${VAR}` substitution)
- CI: GitHub Actions secrets (referenced in `deploy.yml`)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Rate Limiting (nginx layer)

All rate limiting is enforced at `nginx/nginx.conf`:

| Zone | Target | Rate | Burst |
|------|--------|------|-------|
| `upload` | `POST /api/*` | 5 req/min per IP | 2 |
| `admin_login` | `POST /api/admin/auth/login` (exact match) | 5 req/min per IP | 3 |
| `admin_api` | `/api/admin/*` (all methods) | 60 req/min per IP | 10 |

---

*Integration audit: 2026-03-11*
