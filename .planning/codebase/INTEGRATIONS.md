# External Integrations

**Analysis Date:** 2026-05-20
**Last updated:** 2026-05-20 — full refresh; added `admin_assign_user_org` / `admin_list_organizations` endpoints, verified admin proxy route, confirmed Cloudflare Tunnel as production TLS provider

## APIs & External Services

**Mapping / Tiles:**
- OpenStreetMap (via Leaflet default tile layer) — public map display and interactive pin placement
  - SDK/Client: `leaflet ^1.9.4` + `react-leaflet ^4.2.1`
  - Auth: None (public tile CDN)
  - Used in: `frontend/app/components/ReportsMap.tsx`, `frontend/app/admin/reports/map/page.tsx`, `frontend/app/components/LocationMap.tsx`, `frontend/app/report/page.tsx`
  - Tile URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
  - Leaflet CSS loaded from `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` in `frontend/app/layout.tsx` (CDN dependency at runtime — known accepted risk, tracked for migration to `frontend/public/leaflet/`)
  - Marker icon images also loaded from `https://unpkg.com/leaflet@1.9.4/dist/images/` in `frontend/app/components/LocationMap.tsx`

**Reverse Geocoding:**
- Nominatim (OpenStreetMap) — converts pinned lat/lng to human-readable address
  - SDK/Client: Direct `fetch` to `https://nominatim.openstreetmap.org/reverse?lat=&lon=&format=json`
  - Auth: None (public API; usage policy: max 1 req/s — not enforced in code)
  - Used in: `frontend/app/components/ReviewStrip.tsx` (map review strip), `frontend/app/report/page.tsx` (report submission flow)

**CDN / Infrastructure:**
- Cloudflare Tunnel (`cloudflared`) — TLS termination for self-hosted production deployment on Arch Linux desktop
  - The nginx instance listens on port 80; Cloudflare presents HTTPS to the public internet
  - No certificates managed locally — Cloudflare origin certificate is handled automatically by `cloudflared`
  - Config: selected via `docker-compose.server.yml` override and `nginx/nginx.server.conf`

## Internal API Contracts

All backend API endpoints are served by the Axum server (`backend/src/main.rs`) on port 3001. Nginx proxies to `backend:3001`.

### Public Endpoints (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — returns 200 OK |
| POST | `/api/reports` | Submit a report (multipart/form-data, max 20 MB) |
| GET | `/api/reports` | List reports (`?page=&limit=&category=&status=`) |
| GET | `/api/reports/:id` | Get single report |
| GET | `/api/wards/lookup` | Ward name lookup by coordinates (`?lat=&lng=`) |
| GET | `/uploads/:filename` | Serve uploaded images (via `tower-http ServeDir`) |

### Admin Auth Endpoints (no JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/auth/login` | Login — sets `admin_token` HttpOnly cookie |

### Admin Protected Endpoints (JWT cookie required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/auth/logout` | Clears `admin_token` cookie |
| GET | `/api/admin/auth/me` | Returns current admin user |
| PATCH | `/api/admin/auth/profile` | Update display name |
| POST | `/api/admin/auth/change-password` | Change password (Argon2id verification) |
| GET | `/api/admin/reports` | List reports with admin filters |
| GET | `/api/admin/reports/:id` | Get single report (full detail) |
| PATCH | `/api/admin/reports/:id/status` | Update report status |
| DELETE | `/api/admin/reports/:id` | Delete report |
| GET | `/api/admin/stats` | Aggregate counts by status/category |
| GET | `/api/admin/users` | List admin users |
| POST | `/api/admin/users` | Create admin user |
| DELETE | `/api/admin/users/:id` | Deactivate admin user |
| PATCH | `/api/admin/users/:id/org` | Assign user to organization |
| GET | `/api/admin/organizations` | List organizations (GBA hierarchy) |

Handlers: `backend/src/handlers/admin.rs`, `backend/src/handlers/reports.rs`, `backend/src/handlers/wards.rs`, `backend/src/handlers/health.rs`

## Frontend ↔ Backend Communication

**Public API calls (browser → backend, direct or via nginx):**
- Client uses `API_BASE_URL` from `frontend/app/lib/config.ts` as prefix
- In Docker: `API_BASE_URL = ""` → relative URLs → nginx routes `/api/*` to backend
- In Vercel staging: `API_BASE_URL = "https://walkability-api.up.railway.app"` (Railway URL baked at build time)
- Pattern: `fetch(\`${API_BASE_URL}/api/reports\`, { method: "POST", body: formData })`
- Files: `frontend/app/report/page.tsx`, `frontend/app/components/ReviewStrip.tsx`

**Admin API calls (browser → Next.js → backend, via proxy route):**
- Admin endpoints always use relative URLs (`ADMIN_API_BASE_URL = ""`); browser calls `/api/admin/*`
- Next.js catch-all proxy route `frontend/app/api/admin/[...path]/route.ts` forwards requests to `INTERNAL_API_URL/api/admin/...`
- Proxy explicitly forwards `Cookie` header (for session auth) and back-propagates `Set-Cookie` (so `admin_token` lands on the correct domain on Vercel)
- This design works around Next.js `rewrites()` silently dropping `Set-Cookie` headers
- `INTERNAL_API_URL` = `http://backend:3001` (Docker) or `http://localhost:3001` (bare metal)

**Server-side fetch (Next.js server components → backend):**
- Used in `frontend/app/admin/layout.tsx` — calls `GET /api/admin/auth/me` via `INTERNAL_API_URL`
- Runs inside the container; never exposes backend URL to browser

**Client-side EXIF extraction (browser only, no network):**
- `exifr ^7.1.3` loaded via `require("exifr")` in `frontend/app/components/PhotoCapture.tsx` and `frontend/app/report/page.tsx`
- Extracts GPS (lat/lng) and `DateTimeOriginal` from photo EXIF in browser memory
- Raw GPS coordinates never transmitted to the server; only the extracted float values are sent in the form payload
- UMD interop pattern: `const exifr = exifrModule.default ?? exifrModule`

## Data Storage

**Databases:**
- PostgreSQL 16 with PostGIS 3.4 (`postgis/postgis:16-3.4-alpine`)
  - Connection env var: `DATABASE_URL` (format: `postgres://user:pass@host:5432/dbname`)
  - Client: `sqlx 0.7` with compile-time query verification (`runtime-tokio-rustls`)
  - Extensions: `postgis` (GEOGRAPHY type, GIST indexes, spatial functions), `pgcrypto` (`gen_random_uuid()`)
  - Pool: max 10 connections (`backend/src/main.rs` line 87)
  - Compile-time metadata: `backend/.sqlx/` directory (generated by `cargo sqlx prepare`)

**File Storage:**
- Local filesystem — uploaded photos at `backend/uploads/` (Docker named volume: `uploads`)
  - Served via `tower-http ServeDir` at `/uploads` path
  - EXIF GPS metadata stripped by `img-parts 0.3` before write to disk (server-side belt-and-suspenders)
  - SHA-256 hash computed on raw bytes before EXIF strip for exact-duplicate detection
  - Body limit: 20 MB (nginx `client_max_body_size 20M` + Axum `DefaultBodyLimit::max(20 * 1024 * 1024)`)
  - S3 migration: abstraction-ready — images accessed only via `/uploads/:filename` URL path

**Caching:**
- None (no Redis or in-memory cache)
- Nginx serves uploaded images with `Cache-Control: public, no-transform` and `Expires: 30d`

## Authentication & Identity

**Auth Provider:** Custom — no third-party identity provider

**Admin session mechanism:**
- Cookie name: `admin_token` (HttpOnly, `SameSite` set appropriately for context)
- Algorithm: HS256 only — `alg:none` explicitly rejected in `backend/src/middleware/auth.rs`
- Secret: `JWT_SECRET` env var (minimum 32 chars, panics if absent or shorter)
- Session duration: `JWT_SESSION_HOURS` env var (default 24h, clamped 1–168h, read once at startup)
- Password hashing: Argon2id via `argon2 0.5`
- Roles: `admin` (full access) and `reviewer` (read + status update)
- Super-admin flag: `is_super_admin BOOLEAN` on `admin_users` (migration `003_super_admin.sql`) — prevents deactivation of super-admin accounts
- Implementation files: `backend/src/middleware/auth.rs`, `backend/src/handlers/admin.rs`, `backend/src/db/admin_seed.rs`

**Frontend auth gate:**
- Next.js Edge Middleware `frontend/middleware.ts` — cookie presence check, redirects unauthenticated requests from `/admin/*` to `/admin/login`
- Server-side layout `frontend/app/admin/layout.tsx` — calls `GET /api/admin/auth/me` for server-to-server session verification via `INTERNAL_API_URL`

**Public reporting:**
- Anonymous — no auth required for `POST /api/reports` or `GET /api/reports`
- Public lat/lng rounded to 3 decimal places (~111 m precision) in `backend/src/models/report.rs` `Report::into_response()` — privacy-preserving

## Database Integration Approach

**Compile-time query verification:** SQLx verifies all queries against the database schema at compile time. Offline metadata is captured in `backend/.sqlx/` via `cargo sqlx prepare --database-url "..."`. This must be re-run after any migration or query change.

**Migration strategy:** `sqlx::migrate!("./migrations")` runs automatically at server startup. Migrations are applied in order, are idempotent on re-run, and cannot be skipped. The `location` column on `reports` is auto-populated from `latitude`/`longitude` via a PostgreSQL trigger — never set `location` directly in SQL.

**Query files:**
- `backend/src/db/queries.rs` — public report queries
- `backend/src/db/admin_queries.rs` — admin report, user, org queries
- `backend/src/db/admin_seed.rs` — idempotent admin user seeding on startup
- `backend/src/db/dedup_job.rs` — background proximity deduplication loop (polls every 5 minutes, links duplicate reports via `duplicate_of_id`)

## Monitoring & Observability

**Error Tracking:** None (no Sentry, Datadog, or equivalent)

**Logs:**
- Backend: structured JSON via `tracing-subscriber` `json()` formatter written to stderr
  - Log level: `RUST_LOG` env var (default `bengaluru_walkability_backend=info,tower_http=info`)
  - `X-Request-ID` header from nginx propagated into tracing spans via `request_id_middleware` in `backend/src/main.rs`
- Nginx: JSON access logs (`json_combined` format) at `/var/log/nginx/access.log`
  - Fields: `time`, `request_id`, `method`, `uri`, `status`, `bytes_sent`, `request_time`, `remote_addr`, `http_user_agent`

## CI/CD & Deployment

**Staging:**
- Frontend: Vercel (Next.js, auto-deploys from `main`)
- Backend: Railway (Rust Docker image; config at `backend/railway.toml`)
  - `builder = "DOCKERFILE"`, `dockerfilePath = "Dockerfile"`, `rootDirectory = "backend/"`
  - `healthcheckPath = "/health"`, `healthcheckTimeout = 300`
  - `restartPolicyType = "ON_FAILURE"`

**Self-hosted production (Arch Linux):**
- Backend + nginx via `docker compose -f docker-compose.yml -f docker-compose.server.yml up -d db backend nginx`
- Frontend served by Vercel

**CI Pipeline (`.github/workflows/ci.yml`):**
- Triggers: push to any branch, PRs, `workflow_call` from `deploy.yml`
- Jobs (parallel): `frontend-checks` (Node 20: lint, test, npm audit), `backend-checks` (Rust stable: clippy `-D warnings`, cargo test, cargo audit), `docker-build` (verifies images build)

**Deploy Pipeline (`.github/workflows/deploy.yml`):**
- Triggers: push to `main`
- Calls `ci.yml` as reusable workflow, then runs `smoke-tests` (retry on Railway `/health`, check `/api/reports`, verify Vercel 200)
- Smoke tests skip gracefully if `RAILWAY_BACKEND_URL` secret is not set

## Environment Configuration

**Required (no defaults — hard failure if absent):**
- `POSTGRES_PASSWORD` — database password
- `JWT_SECRET` — minimum 32 chars

**Required for HTTPS production:**
- `COOKIE_SECURE=true`
- `CORS_ORIGIN` — production domain

**Optional with defaults:**
- `POSTGRES_DB` / `POSTGRES_USER` — default `walkability`
- `UPLOADS_DIR` — default `./uploads`
- `PORT` — default `3001`
- `PUBLIC_URL` — default `http://localhost` (empty string treated as absent)
- `JWT_SESSION_HOURS` — default `24`
- `COOKIE_SECURE` — default `false`
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` — empty default (no seed)
- `INTERNAL_API_URL` — default `http://localhost:3001` (set to `http://backend:3001` in docker-compose)
- `NEXT_PUBLIC_API_URL` — default `""` in docker-compose (relative URLs)

**Secrets location:**
- Docker Compose: `.env` at repo root; also `backend/.env` for bare-metal dev
- CI/CD: GitHub Actions secrets

## Rate Limiting

**Nginx layer** (`nginx/nginx.conf`, applied to full-stack; `nginx/nginx.server.conf` for backend-only):

| Zone | Target | Rate | Burst | Status |
|------|--------|------|-------|--------|
| `upload` | `POST /api/*` only (via `$request_method` map) | 5 req/min per IP | 2 | 429 |
| `admin_login` | `POST /api/admin/auth/login` (exact match) | 5 req/min per IP | 3 | 429 |
| `admin_api` | `/api/admin/*` (all methods) | 60 req/min per IP | 10 | 429 |

**Application layer** (`governor 0.10` crate, `backend/src/handlers/reports.rs`):

| Target | Rate | Key |
|--------|------|-----|
| `POST /api/reports` | 2 submissions per hour | `{ip}:{geohash6}` (~1.2 km × 0.6 km cell) |

IP read from `X-Real-IP` header (set by nginx) with TCP peer address as fallback. Geohash-6 key permits a citizen to report across a neighbourhood while throttling repeated submissions at the same ~100 m location.

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

---

*Integration audit: 2026-05-20*
