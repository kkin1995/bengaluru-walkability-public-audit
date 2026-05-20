# Technology Stack

**Analysis Date:** 2026-05-20
**Last updated:** 2026-05-20 — full refresh from source files

## Languages

**Primary:**
- Rust (edition 2021) — backend API server (`backend/src/`)
- TypeScript `^5.0` — frontend app (`frontend/app/`)

**Secondary:**
- SQL (PostgreSQL dialect) — database migrations (`backend/migrations/`)
- JavaScript (ES modules) — Jest config and mocks (`frontend/jest.config.js`, `frontend/__mocks__/`)

## Runtime

**Backend:**
- Tokio `1.x` (async Rust runtime, `full` feature set)
- Binary compiled with Rust `1.88` (stable) — pinned in `backend/Dockerfile`

**Frontend:**
- Node.js 20 Alpine — pinned in `frontend/Dockerfile`

**Package Manager:**
- Frontend: npm (lockfile: `frontend/package-lock.json`, present)
- Backend: Cargo (lockfile: `backend/Cargo.lock`, present)

## Frameworks

**Core — Backend:**
- Axum `0.7` (HTTP framework, `multipart` feature for photo uploads) — `backend/src/main.rs`
- axum-extra `0.9` (cookie jar extraction for JWT auth) — `backend/src/middleware/auth.rs`

**Core — Frontend:**
- Next.js `14.2.35` (App Router, `output: "standalone"` for Docker) — `frontend/next.config.mjs`
- React `^18` — `frontend/package.json`
- react-leaflet `^4.2.1` + leaflet `^1.9.4` (interactive maps) — all map components use `dynamic(() => import(...), { ssr: false })`

**Styling:**
- Tailwind CSS `^3.4.4` — utility-first styling
- PostCSS `^8` + autoprefixer `^10` — CSS processing

**UI Utilities:**
- lucide-react `^0.400.0` — icon library

**UI Primitives (`frontend/app/components/ui/`):**
- `Bi` — bilingual text block (English + Kannada) — `frontend/app/components/ui/Bi.tsx`
- `Icon` — Bootstrap Icons wrapper with size/tone data attributes — `frontend/app/components/ui/Icon.tsx`
- `Btn` — button with variant/size/tone — `frontend/app/components/ui/Btn.tsx`
- `Pill` — status/category badge — `frontend/app/components/ui/Pill.tsx`
- `SectionLabel` — section heading with optional Kannada subtitle — `frontend/app/components/ui/SectionLabel.tsx`

**Testing — Frontend:**
- Jest `^29.7.0` with two isolated projects (node + jsdom) — `frontend/jest.config.js`
- jest-environment-jsdom `^29.7.0`
- @testing-library/react `^14.3.1`
- @testing-library/user-event `^14.6.1`
- @testing-library/jest-dom `^6.9.1`
- babel-jest `^29.7.0` with `next/babel` preset

**Testing — Backend:**
- Rust built-in `#[test]` / `#[cfg(test)]` — no external test runner
- Migration tests: `backend/src/migrations_tests/` (inline module) and `backend/tests/migration_phase2_test.rs` (integration)
- Tests operate on models, handlers, config, DB seed, and migration correctness

**Build/Dev:**
- Docker multi-stage builds: `backend/Dockerfile` (rust:1.88-slim-bookworm → debian:bookworm-slim), `frontend/Dockerfile` (node:20-alpine deps/builder/runtime)
- `docker-compose.yml` (production), `docker-compose.dev.yml` (local dev overrides), `docker-compose.server.yml` (self-hosted production backend-only)
- Nginx Alpine (reverse proxy) — `nginx/nginx.conf` (full-stack), `nginx/nginx.server.conf` (backend-only)

## Key Backend Dependencies

**HTTP / Routing:**
- `axum = "0.7"` — router, extractors, multipart upload, `DefaultBodyLimit` (20 MB)
- `axum-extra = "0.9"` (features: cookie) — cookie jar for admin auth
- `tower-http = "0.5"` (features: cors, trace, fs) — CORS middleware, `TraceLayer`, `ServeDir` for `/uploads`

**Database:**
- `sqlx = "0.7"` (features: postgres, runtime-tokio-rustls, uuid, chrono) — async PostgreSQL client with compile-time query verification

**Auth / Security:**
- `jsonwebtoken = "9"` — HMAC-SHA256 JWT signing and validation
- `argon2 = "0.5"` — Argon2id password hashing for admin credentials
- `governor = "0.10"` — keyed token-bucket rate limiter; 2 report submissions/hour per IP+geohash-6 cell
- `sha2 = "0.10"` + `digest = "0.10"` — SHA-256 photo hash for exact-duplicate detection
- `base64 = "0.22"` — used in JWT `alg:none` rejection tests

**Data / Serialization:**
- `serde = "1"` (features: derive) + `serde_json = "1"` — JSON serialization
- `uuid = "1"` (features: v4, serde) — UUID primary keys
- `chrono = "0.4"` (features: serde) — timestamp handling

**Image Processing:**
- `img-parts = "0.3"` — EXIF metadata stripping before writing uploaded images to disk

**Geospatial:**
- `geohash = "0.13"` — geohash-6 cell computation for rate limiting keys

**Utilities:**
- `dotenvy = "0.15"` — `.env` file loading at startup
- `thiserror = "2"` — error type derivation
- `tracing = "0.1"` + `tracing-subscriber = "0.3"` (features: env-filter, json) — structured JSON logging to stderr
- `tokio-util = "0.7"` (features: io) + `bytes = "1"` — async I/O utilities
- `time = "0.3"` — cookie `max_age` duration (declared directly to avoid relying on re-export from axum-extra)

## Key Frontend Dependencies

**Production:**
- `next 14.2.35` — framework
- `react ^18` + `react-dom ^18` — UI runtime
- `react-leaflet ^4.2.1` + `leaflet ^1.9.4` — interactive maps (SSR-disabled via `next/dynamic`)
- `exifr ^7.1.3` — client-side EXIF GPS extraction; loaded as `require("exifr").default ?? require("exifr")` for Jest/webpack UMD interop
- `lucide-react ^0.400.0` — icon library

**Development:**
- `@testing-library/react ^14.3.1` + `@testing-library/user-event ^14.6.1` + `@testing-library/jest-dom ^6.9.1`
- `@types/leaflet ^1.9.8`, `@types/jest ^29`, `@types/node ^20`, `@types/react ^18`, `@types/react-dom ^18`
- `tailwindcss ^3.4.4`, `postcss ^8`, `autoprefixer ^10`
- `babel-jest ^29.7.0`, `eslint ^8`, `eslint-config-next 14.2.35`

## Database

**Engine:** PostgreSQL 16 (`postgis/postgis:16-3.4-alpine` Docker image)

**Extensions:**
- `postgis` — `GEOGRAPHY(POINT, 4326)` type, GIST spatial indexes, `ST_MakePoint`, `ST_SetSRID`
- `pgcrypto` — `gen_random_uuid()` for UUID primary keys

**Client:** SQLx `0.7` with compile-time query verification. Offline metadata captured via `cargo sqlx prepare`. Connection pool max 10 connections (`backend/src/main.rs`).

**Migrations:** Applied automatically at server startup via `sqlx::migrate!("./migrations")`:
- `001_init.sql` — `reports` table, enums (`issue_category`, `severity_level`, `report_status`, `location_source`), GIST indexes, triggers, PWN scaffold tables (`bus_stops`, `metro_stations`)
- `002_admin.sql` — `admin_users` table, `user_role` enum, status history attribution
- `003_super_admin.sql` — `is_super_admin BOOLEAN` column on `admin_users`
- `004_ward_boundaries.sql` — ward polygon boundary data
- `005_organizations.sql` — `organizations` self-referential hierarchy table (`gba`, `corporation`, `ward_office`)
- `006_ward_org_scoping.sql` — ward-to-organization scoping
- `007_anti_abuse.sql` — `photo_hash`, `duplicate_of_id`, `duplicate_count`, `duplicate_confidence`, `submitter_ip` columns on `reports`

## Configuration

**Backend Environment** (read at startup via `backend/src/config.rs`, loaded from `backend/.env`):
- `DATABASE_URL` — required, no default; panics if absent
- `JWT_SECRET` — required, minimum 32 chars; panics if absent or too short
- `UPLOADS_DIR` — default `./uploads`
- `PORT` — default `3001`
- `CORS_ORIGIN` — default `http://localhost:3000`
- `PUBLIC_URL` — default `http://localhost` (empty treated as absent)
- `JWT_SESSION_HOURS` — default `24`, clamped 1–168
- `COOKIE_SECURE` — default `false`; must be `true` for HTTPS production
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` — optional; seeds initial admin on first boot (idempotent no-op if table has rows)
- `POSTGRES_PASSWORD` — required (no fallback, compose fails fast)
- Template: `backend/.env.example`

**Frontend Environment** (centralized in `frontend/app/lib/config.ts` — all `process.env.*` access must go through this file):
- `NEXT_PUBLIC_API_URL` — build-time baked arg; set to `""` in Docker (relative URLs); set to Railway URL for staging
- `INTERNAL_API_URL` — runtime only, server-side; `http://backend:3001` in Docker compose

**Build:**
- `frontend/next.config.mjs` — conditional `output: "standalone"` when `NEXT_OUTPUT=standalone`, ESLint skipped during builds, permissive `remotePatterns` for images
- `frontend/tsconfig.json` — strict mode, path alias `@/*` → project root, `moduleResolution: bundler`

## Infrastructure

**Local Dev (full-stack hot-reload):**
- `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up db -d` for database
- Backend: `cargo watch -x run` via dev override; bind-mount source at `/app`
- Frontend: `npm run dev --hostname 0.0.0.0`; bind-mount source

**Self-Hosted Production (Arch Linux desktop):**
- `docker compose -f docker-compose.yml -f docker-compose.server.yml up -d db backend nginx`
- Cloudflare Tunnel (`cloudflared`) handles TLS termination; nginx listens on port 80 only
- Frontend served by Vercel; `docker-compose.server.yml` excludes frontend service
- Uses `nginx/nginx.server.conf` (backend-only routes; `/` returns 404)

**Full-stack Production (self-hosted VPS):**
- `docker compose -f docker-compose.yml up -d`
- Uses `nginx/nginx.conf` (proxies frontend + backend + uploads)

**Reverse Proxy (nginx:alpine):**
- Rate limiting: `upload` zone (5 POST/min), `admin_login` zone (5/min, burst 3), `admin_api` zone (60/min, burst 10)
- `client_max_body_size 20M` — matches Axum's `DefaultBodyLimit::max(20 * 1024 * 1024)`
- JSON structured access logs with `$request_id`; request ID propagated as `X-Request-ID` header through to backend
- Security headers on `/admin` routes: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy`, `Content-Security-Policy`
- Leaflet CSS loaded from `unpkg.com` CDN at runtime (noted as accepted risk in nginx.conf)

**Resource Limits:**
- db: 512 MB | backend: 256 MB | frontend: 256 MB | nginx: 64 MB

## Platform Requirements

**Development:**
- Docker + Docker Compose (Option A: full stack with `docker-compose.dev.yml`)
- Or: PostgreSQL with PostGIS + `pgcrypto` extensions + Rust toolchain + Node 20 (Option B: bare metal)
- After changing SQL queries: `cargo sqlx prepare --database-url "postgres://..."` to regenerate compile-time metadata

**Production / Staging:**
- Self-hosted: env vars `POSTGRES_PASSWORD`, `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE=true`; optionally `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`
- Vercel+Railway (staging): frontend on Vercel, backend on Railway Docker, PostgreSQL on Railway; cross-domain admin auth via `SameSite=None` cookie + Next.js admin API proxy route
- Named Docker volumes: `postgres_data` (database state), `uploads` (photos)

---

*Stack analysis: 2026-05-20*
