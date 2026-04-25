# Architecture

**Analysis Date:** 2026-03-11
**Last updated:** 2026-04-25 — added cross-domain auth (Vercel/Railway), anti-abuse middleware, ward routing, geolocation fallback, new endpoints from PRs #2/#3

## Pattern Overview

**Overall:** Multi-tier monorepo with separate Rust API backend and Next.js frontend, connected through nginx reverse proxy.

**Key Characteristics:**
- Strict separation between public citizen-facing API and protected admin API
- Two distinct auth contexts: no-auth public submissions, JWT-cookie admin sessions
- Privacy-by-design: EXIF stripped server-side, coordinates rounded in API responses, contact details excluded from public endpoints
- DB models carry full precision/data; response structs (`*Response`) are separate and safe to serialize
- All map components use SSR-disabled dynamic imports (Leaflet requires `window`)

## Layers

**Nginx Reverse Proxy:**
- Purpose: Single entry point on port 80; rate-limits, security headers, request-ID injection, routes traffic to frontend or backend
- Location: `nginx/nginx.conf`
- Contains: Rate-limit zones (3 distinct zones: upload, admin_login, admin_api), upstream blocks, location routing rules
- Depends on: backend (port 3001), frontend (port 3000)
- Used by: All external HTTP clients

**Rust/Axum Backend:**
- Purpose: REST API, image ingestion, business validation, DB persistence
- Location: `backend/src/`
- Contains: Route handlers, models, DB query functions, JWT middleware, config loader
- Depends on: PostgreSQL/PostGIS via SQLx, local filesystem for uploads
- Used by: nginx, and directly by Next.js server components via INTERNAL_API_URL

**Next.js Frontend:**
- Purpose: Public citizen UI (home, report wizard, map) and admin dashboard
- Location: `frontend/app/`
- Contains: Page components, shared UI components, typed API client, lib utilities
- Depends on: backend via nginx proxy (client-side) or INTERNAL_API_URL (server-side SSR)
- Used by: nginx

**Anti-Abuse Middleware (Backend):**
- Purpose: Rate limiting and bot detection on the public submission path
- Location: `backend/src/handlers/reports.rs`, `backend/src/main.rs`
- Contains: `governor` crate per-IP per-geohash-6 rate limiter (2 reports/IP/geohash-6/hour); honeypot hidden field check (type=hidden); SHA256 photo hash dedup; proximity dedup async job (ST_DWithin 50m, 5-min poll)
- Depends on: AppState (rate limiter state stored in-process), PostgreSQL (dedup queries)
- Used by: `POST /api/reports` handler

**Ward & Organization Layer (Backend):**
- Purpose: Geospatial routing of reports to Bengaluru wards and organization hierarchy
- Location: `backend/src/handlers/wards.rs`, `backend/src/db/ward_queries.rs`
- Contains: `wards` table (PostGIS MULTIPOLYGON boundaries), `organizations` table (self-referential hierarchy), `ST_Within` lookup at submission time, `GET /api/wards/lookup` public endpoint
- Depends on: PostgreSQL/PostGIS
- Used by: `POST /api/reports` (auto-tag), `GET /api/wards/lookup` (frontend ward display)

**PostgreSQL/PostGIS:**
- Purpose: Persistent storage for reports, admin users, status history, ward boundaries, and geospatial scaffolding
- Location: managed by Docker volume `postgres_data`
- Contains: `reports`, `status_history`, `admin_users`, `wards`, `organizations`, `bus_stops`, `metro_stations` tables; PostGIS GEOGRAPHY/GEOMETRY columns; triggers for location population and `updated_at`
- Depends on: nothing
- Used by: Rust backend only

## Data Flow

**Public Report Submission:**

1. Citizen opens `/report` in browser; Next.js renders the redesigned 2-step report flow (Category → Confirm → Success)
2. `PhotoCapture.tsx` extracts GPS from EXIF client-side using `exifr` (privacy: raw GPS bytes never sent to server); if EXIF GPS unavailable, browser geolocation API is tried as a fallback; if that also fails, user places a manual Leaflet pin
3. After location is confirmed, `GET /api/wards/lookup?lat=&lng=` fetches and displays the ward name in the UI (informational)
4. On submit, browser sends multipart `POST /api/reports` to nginx; honeypot field must be empty
5. Nginx applies `upload` rate limit zone (5r/m POST-only) and proxies to `backend:3001`
6. `handlers/reports.rs::create_report` checks `governor` per-IP per-geohash-6 rate limit; checks honeypot field; checks SHA256 photo hash for exact duplicate
7. Handler validates Bengaluru bbox, strips EXIF via `img-parts`, writes JPEG to `backend/uploads/<uuid>.jpg`
8. `db/queries.rs::insert_report` inserts row; PostGIS trigger `trg_set_report_location` populates `GEOGRAPHY` column from lat/lng; async dedup job later runs `ST_DWithin 50m` proximity check
9. Handler calls `Report::into_response()` which rounds lat/lng to 3dp and excludes `submitter_contact` and `submitter_name`
10. JSON response returned; `SuccessCard` component renders confirmation

**Public Map View:**

1. Browser loads `/map`; Next.js renders page shell (SSR-safe)
2. `ReportsMap` component loaded client-side only via `nextDynamic(..., { ssr: false })`
3. Component fetches `GET /api/reports` (paginated, filterable by category/status)
4. Leaflet renders `CircleMarker` per report with category-colored pins

**Admin Authentication:**

1. Admin POSTs credentials to `/api/admin/auth/login` via `/admin/login` page
2. Nginx routes through `admin_login` zone (5r/m, burst=3); request reaches backend
3. Handler validates credentials with Argon2id, issues JWT as `HttpOnly; SameSite=None; Secure` cookie named `admin_token` (SameSite=None enables cross-domain use in Vercel+Railway staging)
4. Subsequent protected requests pass through `middleware::auth::require_auth` which calls `extract_claims()` to decode cookie
5. Next.js `admin/layout.tsx` (Server Component) also validates the cookie via server-to-server fetch to `INTERNAL_API_URL/api/admin/auth/me`
6. In cross-domain deployments (Vercel frontend + Railway backend), Next.js `rewrites()` in `next.config.mjs` proxy `/api/admin/*` to `INTERNAL_API_URL` so the admin cookie is set on the Vercel domain and included in all subsequent admin requests

**Admin Report Management:**

1. Admin dashboard page calls typed functions from `frontend/app/admin/lib/adminApi.ts`
2. All fetches include `credentials: 'include'` to send `admin_token` cookie
3. Backend protected routes verify JWT; role gating via `require_role()` helper
4. Status updates write to `status_history` audit table via DB trigger

**State Management:**
- Frontend state: React `useState` within page components; no global state store
- No Redux or Context API for data; each page fetches independently
- URL search params used for filter state in admin reports page (`useSearchParams`)
- `useRef` pattern used for router references in callbacks to avoid stale closure / infinite re-render

## Key Abstractions

**AppState (Backend):**
- Purpose: Shared application state injected into every Axum handler via `State` extractor
- Examples: `backend/src/main.rs` (definition), all handler files (consumption)
- Pattern: `Arc<PgPool>`, `jwt_secret: Arc<Vec<u8>>`, `uploads_dir: String`, `api_base_url: String`, `jwt_session_hours: u64`

**AppError:**
- Purpose: Unified error type that implements `IntoResponse` — converts domain errors to typed HTTP responses
- Examples: `backend/src/errors.rs`
- Pattern: `thiserror::Error` enum; variants map to HTTP status codes; internal details logged via tracing, not leaked to client

**DB Row / Response separation:**
- Purpose: DB structs (`Report`, `AdminUser`) hold all columns including sensitive ones; `*Response` structs are the safe public shape
- Examples: `backend/src/models/report.rs` (`Report` vs `ReportResponse`), `backend/src/models/admin.rs` (`AdminUser` vs `AdminUserResponse`)
- Pattern: `fn into_response(self, ...) -> *Response` consumes the DB struct, applies transformations (rounding, field exclusion), and produces the serializable output

**Config (Backend):**
- Purpose: Reads all environment variables once at startup; panics on missing required vars
- Examples: `backend/src/config.rs`
- Pattern: `Config::from_env()` builds the struct; `PUBLIC_URL` defaults to `"http://localhost"` when absent/empty

**Config (Frontend):**
- Purpose: Single source of truth for all env-var-based runtime configuration — MANDATORY pattern per project rules
- Examples: `frontend/app/lib/config.ts`
- Pattern: `API_BASE_URL = NEXT_PUBLIC_API_URL ?? ""` for client-side (relative URLs); `INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://localhost:3001"` for server-side SSR

**JWT Middleware:**
- Purpose: Stateless bearer auth for all `/api/admin/*` protected routes
- Examples: `backend/src/middleware/auth.rs`
- Pattern: Pure functions `extract_claims()` and `require_role()` separate from Axum extractor `require_auth`; HS256 only, algorithm substitution prevented

**adminApi.ts:**
- Purpose: Typed HTTP client for the admin dashboard; all functions include `credentials: 'include'`
- Examples: `frontend/app/admin/lib/adminApi.ts`
- Pattern: Named exports per endpoint; non-2xx responses reject with status code; imports `API_BASE_URL` from config; `ADMIN_API_BASE_URL` is hardcoded to `""` (always relative) so admin cookies stay on Vercel domain in cross-domain deployments

**UI Design System (Frontend):**
- Purpose: CSS variable tokens + reusable UI primitives for the citizen-facing redesign
- Location: `frontend/app/globals.css` (CSS variables), `frontend/app/components/ui/` (primitives)
- Contains: `--color-*`, `--font-*`, `--radius-*` tokens; `Bi` (bilingual text), `Icon` (Bootstrap Icons), `Btn` (button), `Pill` (status/category badge), `SectionLabel` (section heading) components; Google Fonts via `next/font`
- Pattern: `data-*` attributes (`data-tone`, `data-variant`, `data-size`, `data-component`) on primitive elements — CSS variables drive visual variants; data attributes are the testable substitutes in jsdom tests

## Entry Points

**Backend (Rust):**
- Location: `backend/src/main.rs`
- Triggers: `cargo run` or Docker `CMD`
- Responsibilities: Load `.env`, init tracing (JSON), connect PostgreSQL pool, run SQLx migrations, seed admin user, build router, start TCP listener on `$PORT` (default 3001)

**Frontend (Next.js):**
- Location: `frontend/app/layout.tsx` (root layout), `frontend/app/page.tsx` (home)
- Triggers: `npm run dev` or Docker standalone build
- Responsibilities: Render homepage with report and map CTAs; App Router handles all routing

**Admin Layout (Server Component):**
- Location: `frontend/app/admin/layout.tsx`
- Triggers: Any navigation to `/admin/*`
- Responsibilities: Read `admin_token` cookie, call `INTERNAL_API_URL/api/admin/auth/me` server-side, redirect to `/admin/login` if invalid, inject sidebar nav with role-gated links

**Public Report Wizard:**
- Location: `frontend/app/report/page.tsx`
- Triggers: User clicks "Report an Issue" CTA
- Responsibilities: 4-step wizard (Photo → Location → Category → Details); client-side Bengaluru bbox validation; multipart submission to `/api/reports`

**Public Map:**
- Location: `frontend/app/map/page.tsx`
- Triggers: User clicks "View All Reports" CTA
- Responsibilities: Renders Leaflet map with all public reports; `ReportsMap` component is SSR-disabled

## Error Handling

**Strategy:** Return structured JSON errors from backend; frontend surfaces user-friendly messages inline

**Patterns:**
- Backend: `AppError` enum implements `IntoResponse`; every handler returns `Result<_, AppError>`; database errors produce 500 (detail logged, not sent to client); 400 bad request messages are sent verbatim to client (user-facing)
- Frontend public: `try/catch` around fetch calls; inline `error` state rendered in UI; retry button in `ReportsMap`
- Frontend admin: `adminApi.ts` rejects on non-2xx; individual pages catch and display error messages; rate-limit 429 triggers countdown timer in login page

## Cross-Cutting Concerns

**Logging:** `tracing` crate with `fmt().json()` output; `request_id_middleware` in `main.rs` reads `X-Request-ID` from nginx, injects into tracing span, echoes in response header; log level controlled by `RUST_LOG` env var

**Validation:** Two-layer: client-side bbox check in `frontend/app/report/page.tsx::isInBengaluru()`; authoritative server-side bbox check in `backend/src/handlers/reports.rs::create_report()`; Argon2id for password hashing in admin auth

**Authentication:** Public API routes have no auth; admin routes protected by `require_auth` Axum middleware; admin layout double-checks via server-side `/api/admin/auth/me` call; edge middleware (`frontend/middleware.ts`) provides additional redirect guard

---

*Architecture analysis: 2026-03-11 | Last updated: 2026-04-25*
