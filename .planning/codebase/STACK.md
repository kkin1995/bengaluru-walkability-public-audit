# Technology Stack

**Analysis Date:** 2026-03-11

## Languages

**Primary:**
- Rust (edition 2021) - Backend API (`backend/src/`)
- TypeScript 5.x - Frontend app (`frontend/app/`)

**Secondary:**
- SQL (PostgreSQL dialect) - Database migrations (`backend/migrations/`)
- JavaScript (ES modules) - Jest config and mocks (`frontend/jest.config.js`, `frontend/__mocks__/`)

## Runtime

**Backend:**
- Tokio 1.x (async Rust runtime, `full` feature set)
- Binary compiled with Rust 1.88 (stable) — pinned in `backend/Dockerfile`

**Frontend:**
- Node.js 20 (Alpine) — pinned in `frontend/Dockerfile`

**Package Manager:**
- Frontend: npm (lockfile: `frontend/package-lock.json`, present)
- Backend: Cargo (lockfile: `backend/Cargo.lock`, present)

## Frameworks

**Core — Backend:**
- Axum 0.7 (HTTP framework, `multipart` feature for photo uploads) — `backend/src/main.rs`
- axum-extra 0.9 (cookie jar extraction for JWT auth) — `backend/src/middleware/auth.rs`

**Core — Frontend:**
- Next.js 14.2.5 (App Router, `output: "standalone"`) — `frontend/next.config.mjs`
- React 18 — `frontend/package.json`
- react-leaflet 4.2.1 + leaflet 1.9.4 (interactive maps) — all map components use `dynamic(() => import(...), { ssr: false })`

**Styling:**
- Tailwind CSS 3.4.4 — `frontend/tailwind.config.ts`
- PostCSS + Autoprefixer — `frontend/postcss.config.js`

**UI Utilities:**
- lucide-react 0.400.0 (icon library) — `frontend/package.json`

**Testing — Frontend:**
- Jest 29.7.0 with two isolated projects (node + jsdom) — `frontend/jest.config.js`
- jest-environment-jsdom 29.7.0
- @testing-library/react 14.3.1
- @testing-library/user-event 14.6.1
- @testing-library/jest-dom 6.9.1
- babel-jest 29.7.0 with `next/babel` preset

**Testing — Backend:**
- Rust built-in `#[test]` / `#[cfg(test)]` — no external test runner
- Runtime sqlx queries (no compile-time macros) so tests run without a live database

**Build/Dev:**
- Docker multi-stage builds: `backend/Dockerfile` (Rust 1.88 slim → debian bookworm-slim), `frontend/Dockerfile` (node:20-alpine → node:20-alpine standalone)
- docker-compose.yml (production), `docker-compose.dev.yml` (local dev overrides)
- Nginx Alpine (reverse proxy) — `nginx/nginx.conf`

## Key Dependencies

**Backend — Critical:**
- `sqlx 0.7` (`postgres`, `runtime-tokio-rustls`, `uuid`, `chrono`) — compile-time query checking + async PostgreSQL client — `backend/Cargo.toml`
- `tower-http 0.5` (`cors`, `trace`, `fs`) — CORS, request tracing, static file serving (`ServeDir`) — `backend/Cargo.toml`
- `jsonwebtoken 9` — HS256 JWT signing and validation for admin auth — `backend/src/middleware/auth.rs`
- `argon2 0.5` — Argon2id password hashing for admin credentials — `backend/Cargo.toml`
- `img-parts 0.3` — EXIF stripping before writing uploaded images to disk — `backend/Cargo.toml`

**Backend — Infrastructure:**
- `serde 1` + `serde_json 1` — serialization — `backend/Cargo.toml`
- `uuid 1` (`v4`, `serde`) — report and admin user IDs — `backend/Cargo.toml`
- `chrono 0.4` (`serde`) — timestamps — `backend/Cargo.toml`
- `tracing 0.1` + `tracing-subscriber 0.3` (`env-filter`, `json`) — structured JSON logging — `backend/src/main.rs`
- `dotenvy 0.15` — `.env` file loading — `backend/src/main.rs`
- `thiserror 2` — error type derivation — `backend/Cargo.toml`
- `axum-extra 0.9` + `time 0.3` — cookie handling for JWT session — `backend/Cargo.toml`
- `base64 0.22` — used in JWT security tests (`alg:none` rejection) — `backend/Cargo.toml`
- `tokio-util 0.7` + `bytes 1` — IO utilities — `backend/Cargo.toml`

**Frontend — Critical:**
- `exifr 7.1.3` — client-side EXIF GPS extraction; loaded via `require("exifr").default` for Jest mock interop — `frontend/app/components/PhotoCapture.tsx`

**Frontend — Infrastructure:**
- `@types/leaflet 1.9.8`, `@types/node 20`, `@types/react 18` — TypeScript typings

## Configuration

**Backend Environment (read at startup via `backend/src/config.rs`):**
- `DATABASE_URL` — required, no default
- `JWT_SECRET` — required, minimum 32 chars, panics if absent or short
- `UPLOADS_DIR` — default `./uploads`
- `PORT` — default `3001`
- `CORS_ORIGIN` — default `http://localhost:3000`
- `PUBLIC_URL` — default `http://localhost`
- `JWT_SESSION_HOURS` — default `24`, clamped 1–168
- `COOKIE_SECURE` — default `false`; set `true` for HTTPS production
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` — optional, seeds initial admin on first startup

**Frontend Environment:**
- Centralized in `frontend/app/lib/config.ts` (single source of truth — mandatory)
- `NEXT_PUBLIC_API_URL` — build-time arg, set to `""` in Docker (relative URLs)
- `INTERNAL_API_URL` — runtime only, set to `http://backend:3001` in docker-compose for server-side fetches
- Static constants (map bounds, center coords) in `frontend/app/lib/constants.ts`

**Build:**
- `frontend/next.config.mjs` — `output: "standalone"`, ESLint skipped during build, permissive `remotePatterns`
- `frontend/tsconfig.json` — standard Next.js TS config
- `frontend/tailwind.config.ts` — scoped to `app/**`, custom `brand` color palette

## Platform Requirements

**Development:**
- Docker + Docker Compose (Option A: full stack)
- Or: PostgreSQL with PostGIS extensions (`postgis`, `pgcrypto`) + Rust toolchain + Node 20 (Option B)
- After SQL schema changes: `cargo sqlx prepare --database-url "postgres://..."` to regenerate offline metadata

**Production:**
- Docker Compose with env vars: `POSTGRES_PASSWORD`, `JWT_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE=true`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`
- Single server deployment behind nginx on port 80
- Named Docker volumes: `postgres_data` (database), `uploads` (photos)
- Resource limits: db 512 MB, backend 256 MB, frontend 256 MB, nginx 64 MB

---

*Stack analysis: 2026-03-11*
