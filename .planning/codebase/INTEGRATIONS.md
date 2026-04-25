# External Integrations

**Analysis Date:** 2026-03-11
**Last updated:** 2026-04-25 — updated CI/CD to Vercel+Railway staging, added all 7 migrations, added deploy.yml smoke tests, cargo/npm audit, ward lookup endpoint

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

**Ward Lookup (Internal):**
- `GET /api/wards/lookup?lat=&lng=` — backend endpoint that returns the ward name for a given coordinate using PostGIS `ST_Within` query against the `wards` table
  - Used in: report flow after location pin confirmation to display ward name to the citizen
  - Auth: None (public endpoint)

## Data Storage

**Databases:**
- PostgreSQL 16 with PostGIS 3.4 (Alpine image `postgis/postgis:16-3.4-alpine`)
  - Connection env var: `DATABASE_URL` (format: `postgres://user:pass@host:5432/dbname`)
  - Client: `sqlx 0.7` with `runtime-tokio-rustls` (async, TLS-capable)
  - Extensions: `postgis` (geospatial queries, GEOGRAPHY type), `pgcrypto` (`gen_random_uuid()`)
  - Schema migrations (applied automatically on backend startup via `sqlx::migrate!`):
    - `001_init.sql` — `reports` table, enums (`issue_category`, `severity_level`, `report_status`, `location_source`), PostGIS triggers
    - `002_admin.sql` — `admin_users`, `status_history`, `user_role` enum
    - `003_super_admin.sql` — `is_super_admin BOOLEAN` on `admin_users`
    - `004_ward_boundaries.sql` — `wards` table with PostGIS MULTIPOLYGON boundaries (SRID 4326)
    - `005_organizations.sql` — `organizations` table with self-referential `parent_id` (flexible GBA hierarchy)
    - `006_ward_org_scoping.sql` — `wards.org_id` FK + recursive CTE for org-scoped admin report visibility
    - `007_anti_abuse.sql` — `photo_hash`, `duplicate_of_id`, `duplicate_count`, `duplicate_confidence` columns on `reports`

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
- **Staging:** Frontend on Vercel (Next.js standalone, auto-deploys from main), backend on Railway (Rust Docker image, `railway.toml` config-as-code)
- **Self-hosted (Docker Compose):** Single server deployment on port 80 via nginx; intended for production when GBA launches

**CI Pipeline (`ci.yml`):**
- GitHub Actions — `.github/workflows/ci.yml`
- Four parallel jobs:
  1. `frontend-checks`: Node 20, `npm ci`, `npm run lint` (ESLint), `npm test`, `npm audit --audit-level=high`
  2. `backend-checks`: Rust stable + clippy (`-D warnings`), `cargo test`, `cargo audit` (with allowlist for suppressed advisories)
  3. `docker-build`: `docker compose build` (verifies image builds; does not start containers)
- Triggers: push to any branch, PRs to any branch, and `workflow_call` from `deploy.yml`

**Deploy Pipeline (`deploy.yml`):**
- GitHub Actions — `.github/workflows/deploy.yml`
- Triggers: push to `main`
- Jobs: calls `ci.yml` as reusable workflow, then runs `smoke-tests` job
- Smoke tests: retry loop on `$RAILWAY_BACKEND_URL/health`, check `$RAILWAY_BACKEND_URL/api/reports`, verify Vercel frontend returns HTTP 200
- Smoke tests skip gracefully (`if: secrets.RAILWAY_BACKEND_URL != ''`) before Railway is provisioned

**Railway Config (`railway.toml`):**
- `builder = "DOCKERFILE"`, `dockerfilePath = "Dockerfile"` (relative to `rootDirectory = "backend/"`)
- `healthcheckPath = "/health"`, `healthcheckTimeout = 300` (accommodates Rust cold-start on first deploy)
- `restartPolicyType = "ON_FAILURE"`

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

## Rate Limiting

**nginx layer** (`nginx/nginx.conf`):

| Zone | Target | Rate | Burst |
|------|--------|------|-------|
| `upload` | `POST /api/*` | 5 req/min per IP | 2 |
| `admin_login` | `POST /api/admin/auth/login` (exact match) | 5 req/min per IP | 3 |
| `admin_api` | `/api/admin/*` (all methods) | 60 req/min per IP | 10 |

**Application layer** (`governor` crate, `backend/src/handlers/reports.rs`):

| Target | Rate | Key |
|--------|------|-----|
| `POST /api/reports` | 2 reports per hour | IP + geohash-6 (~1.2 km × 0.6 km cell) |

IP is read from `X-Real-IP` header (set by nginx) with TCP peer address as fallback. The geohash-6 key allows a citizen to report multiple issues while walking around a neighbourhood but throttles repeated submissions at the same ~100 m location.

---

*Integration audit: 2026-03-11 | Last updated: 2026-04-25*
