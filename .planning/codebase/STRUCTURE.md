# Codebase Structure

**Analysis Date:** 2026-05-20

## Directory Layout

```
bengaluru-walkability-public-audit/
├── backend/                    # Rust/Axum REST API (port 3001)
│   ├── src/
│   │   ├── main.rs             # Entry point: router, middleware, AppState, startup
│   │   ├── config.rs           # Config struct, reads env vars at startup
│   │   ├── errors.rs           # AppError enum with IntoResponse
│   │   ├── handlers/           # Axum request handlers
│   │   │   ├── admin.rs        # All /api/admin/* handlers
│   │   │   ├── health.rs       # GET /health
│   │   │   ├── reports.rs      # POST/GET /api/reports, EXIF strip, anti-abuse
│   │   │   ├── wards.rs        # GET /api/wards/lookup
│   │   │   └── mod.rs
│   │   ├── middleware/
│   │   │   ├── auth.rs         # require_auth Tower middleware, JWT validation
│   │   │   └── mod.rs
│   │   ├── models/
│   │   │   ├── report.rs       # Report (DB row), ReportResponse, CreateReportRequest
│   │   │   ├── admin.rs        # AdminUser, AdminUserResponse, validation helpers
│   │   │   ├── ward.rs         # Ward model
│   │   │   ├── organization.rs # Organization model
│   │   │   └── mod.rs
│   │   ├── db/
│   │   │   ├── queries.rs      # Public report queries (insert, list, get, ward lookup)
│   │   │   ├── admin_queries.rs # Admin-scoped queries
│   │   │   ├── admin_seed.rs   # Seeds first admin user from env vars at startup
│   │   │   ├── dedup_job.rs    # Proximity dedup background job (5-min polling)
│   │   │   └── mod.rs
│   │   └── migrations_tests/   # Migration smoke tests (no live DB needed for logic tests)
│   │       ├── test_004_migration.rs
│   │       ├── test_005_migration.rs
│   │       └── mod.rs
│   ├── migrations/             # SQLx migrations (applied on startup via sqlx::migrate!)
│   │   ├── 001_init.sql        # reports, enums, PostGIS trigger, status_history, PWN scaffolding
│   │   ├── 002_admin.sql       # admin_users, user_role enum, status_history.changed_by
│   │   ├── 003_super_admin.sql # admin_users.is_super_admin column
│   │   ├── 004_ward_boundaries.sql # wards table with GEOGRAPHY polygons (~13MB GeoJSON import)
│   │   ├── 005_organizations.sql   # organizations table, admin_users.org_id
│   │   ├── 006_ward_org_scoping.sql # wards.org_id FK for org-scoped visibility
│   │   └── 007_anti_abuse.sql  # photo_hash, duplicate_*, submitter_ip columns on reports
│   ├── tests/                  # Integration tests (require live DB)
│   ├── uploads/                # Local dev upload storage (production: Docker volume)
│   ├── Cargo.toml              # Rust dependencies
│   ├── Cargo.lock
│   └── Dockerfile              # Multi-stage build: cargo-chef → build → runtime
│
├── frontend/                   # Next.js 14 TypeScript App Router (port 3000)
│   ├── app/
│   │   ├── layout.tsx          # Root layout: fonts, global CSS
│   │   ├── page.tsx            # Home page (landing / CTA)
│   │   ├── globals.css         # Global styles + CSS custom properties
│   │   ├── lib/
│   │   │   ├── config.ts       # ALL env-var config (API_BASE_URL, INTERNAL_API_URL, etc.)
│   │   │   ├── constants.ts    # BENGALURU_BOUNDS, BENGALURU_CENTER, category/severity lists
│   │   │   ├── translations.ts # Bilingual label helpers (en/kn)
│   │   │   ├── photo-store.ts  # In-memory store for photo captured on home → report flow
│   │   │   └── utils.ts        # Shared utility functions
│   │   ├── components/         # Shared components used across public pages
│   │   │   ├── PhotoCapture.tsx      # Camera/file picker with EXIF GPS extraction (exifr)
│   │   │   ├── LocationMap.tsx       # Leaflet map for manual GPS pin (SSR disabled)
│   │   │   ├── ReportsMap.tsx        # Public map view with all report pins (SSR disabled)
│   │   │   ├── CategoryPicker.tsx    # Category selection grid
│   │   │   ├── BilingualText.tsx     # English + Kannada dual-label display
│   │   │   ├── ReviewStrip.tsx       # Pre-submit review summary strip
│   │   │   ├── ReportCTA.tsx         # Call-to-action component
│   │   │   ├── SubmitSuccess.tsx     # Post-submission success screen
│   │   │   ├── redesign/             # Phase 02.3.1 redesigned components
│   │   │   │   ├── CategoryGrid.tsx  # Grid-based category picker
│   │   │   │   ├── SeverityGrid.tsx  # Severity selector
│   │   │   │   └── SuccessCard.tsx   # Post-submit success card
│   │   │   └── ui/                   # Primitive UI components
│   │   │       ├── Bi.tsx            # Bilingual inline text
│   │   │       ├── Btn.tsx           # Button primitive
│   │   │       ├── Icon.tsx          # Icon wrapper
│   │   │       ├── Pill.tsx          # Category/status pill badge
│   │   │       └── SectionLabel.tsx  # Section header label
│   │   ├── report/
│   │   │   └── page.tsx        # Multi-step report submission wizard (photo → category → confirm)
│   │   ├── map/
│   │   │   └── page.tsx        # Public reports map
│   │   ├── admin/              # Admin dashboard (auth-gated)
│   │   │   ├── layout.tsx      # Server component: reads admin_token cookie, verifies /auth/me, redirects
│   │   │   ├── page.tsx        # Admin dashboard home (stats + quick links)
│   │   │   ├── login/
│   │   │   │   └── page.tsx    # Admin login form (calls /api/admin/auth/login)
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx    # Reports list with filters, pagination, dedup expand
│   │   │   │   ├── [id]/page.tsx  # Single report detail + status management
│   │   │   │   └── map/page.tsx   # Admin map view of reports
│   │   │   ├── users/
│   │   │   │   └── page.tsx    # User management (list, create, deactivate, org assign)
│   │   │   ├── profile/
│   │   │   │   └── page.tsx    # Admin profile: display name, change password
│   │   │   ├── lib/
│   │   │   │   └── adminApi.ts # Typed API client for admin endpoints (uses ADMIN_API_BASE_URL="")
│   │   │   └── components/     # Admin-specific components
│   │   │       ├── AdminSidebar.tsx      # Responsive sidebar with role-aware nav
│   │   │       ├── ReportsTable.tsx      # Paginated reports table with expandable dedup rows
│   │   │       ├── StatsCards.tsx        # Dashboard stats cards
│   │   │       ├── StatusBadge.tsx       # Status pill with color
│   │   │       ├── UserManagementTable.tsx # User list with CRUD actions
│   │   │       └── CreateUserModal.tsx   # Modal for creating a new admin user
│   │   └── api/
│   │       └── admin/
│   │           └── [...path]/route.ts  # Catch-all admin proxy: forwards all /api/admin/* to backend
│   ├── __mocks__/              # Jest module mocks
│   │   └── next/font/          # next/font mock for tests
│   ├── __tests__/              # Root-level integration tests
│   ├── public/                 # Static assets
│   ├── next.config.mjs         # Next.js config (no rewrites; proxy is in route.ts)
│   ├── jest.config.ts          # Jest config with jsdom environment
│   ├── jest.setup.ts           # @testing-library/jest-dom setup
│   ├── tsconfig.json           # TypeScript config with @/* path alias → ./
│   ├── package.json
│   └── Dockerfile              # Multi-stage build with Next.js standalone output
│
├── nginx/
│   ├── nginx.conf              # Full-stack config (frontend + backend; used in Docker dev/prod)
│   └── nginx.server.conf       # Backend-only config (Phase 02.4 self-hosted; no frontend upstream)
│
├── data/                       # Source data files (GeoJSON ward boundaries, etc.)
├── design-ref/                 # UI design references
├── docs/
│   └── ac/                     # Acceptance criteria documents
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI: lint, test, build (called by deploy.yml)
│       └── deploy.yml          # CD: ci → deploy (self-hosted runner) → smoke-test
├── .planning/
│   ├── codebase/               # Codebase map documents (this directory)
│   ├── phases/                 # Per-phase implementation plans and summaries
│   └── debug/                  # Debug session logs
├── docker-compose.yml          # Production/dev full-stack compose
├── docker-compose.dev.yml      # Local dev overrides (hot reload)
├── docker-compose.server.yml   # Phase 02.4: backend-only override for self-hosted desktop
├── DEPLOYMENT.md               # Self-hosted Arch Linux + Cloudflare Tunnel runbook (Phase 02.4)
└── CLAUDE.md                   # Project instructions for Claude agents
```

## Backend Module Breakdown

### `backend/src/handlers/`

| File | Routes handled |
|------|----------------|
| `reports.rs` | `POST /api/reports`, `GET /api/reports`, `GET /api/reports/:id` |
| `admin.rs` | All `/api/admin/*` routes (auth, reports, users, stats, organizations) |
| `health.rs` | `GET /health` |
| `wards.rs` | `GET /api/wards/lookup` |

### `backend/src/models/`

| File | Types |
|------|-------|
| `report.rs` | `Report` (DB row), `ReportResponse` (public API), `CreateReportRequest`, `ListReportsQuery` |
| `admin.rs` | `AdminUser` (DB row), `AdminUserResponse`, `LoginRequest`, `CreateUserRequest`, `UpdateStatusRequest`, `StatsResponse`, `JwtClaims`, `UpdateProfileRequest`, `ChangePasswordRequest`, validation helpers |
| `ward.rs` | Ward model |
| `organization.rs` | `Organization` model |

### `backend/src/db/`

| File | Purpose |
|------|---------|
| `queries.rs` | Public report queries: `insert_report`, `list_reports`, `get_report_by_id`, `count_reports`, `check_photo_hash_exists`, `get_ward_for_point` |
| `admin_queries.rs` | Admin queries: list/get/update/delete reports, user management, stats aggregation, org queries |
| `admin_seed.rs` | Seeds first super-admin user from `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` env vars at startup |
| `dedup_job.rs` | Background proximity dedup (5-min interval, `ST_DWithin` 50m, links via `duplicate_of_id`) |

### `backend/src/middleware/`

| File | Purpose |
|------|---------|
| `auth.rs` | `require_auth` Axum middleware (JWT cookie validation), `extract_claims()` pure function, `require_role()` pure function, all unit-tested |

## Frontend App Router Structure

### Pages

| Route | File | Type |
|-------|------|------|
| `/` | `app/page.tsx` | Client |
| `/report` | `app/report/page.tsx` | Client (multi-step wizard) |
| `/map` | `app/map/page.tsx` | Client |
| `/admin` | `app/admin/page.tsx` | Server (auth-gated via layout) |
| `/admin/login` | `app/admin/login/page.tsx` | Client |
| `/admin/reports` | `app/admin/reports/page.tsx` | Client |
| `/admin/reports/[id]` | `app/admin/reports/[id]/page.tsx` | Client |
| `/admin/reports/map` | `app/admin/reports/map/page.tsx` | Client |
| `/admin/users` | `app/admin/users/page.tsx` | Client |
| `/admin/profile` | `app/admin/profile/page.tsx` | Client |
| `/api/admin/[...path]` | `app/api/admin/[...path]/route.ts` | API Route (proxy) |

### Auth Guard

`frontend/app/admin/layout.tsx` is a **Server Component** that:
1. Skips auth for `/admin/login` path
2. Reads `admin_token` cookie via `next/headers`
3. Fetches `INTERNAL_API_URL/api/admin/auth/me` to verify session
4. Redirects to `/admin/login` on missing cookie or non-OK response
5. Passes `role` to `AdminSidebar` for role-based nav rendering

### Admin API Client

`frontend/app/admin/lib/adminApi.ts` — All API calls use `credentials: "include"` and `ADMIN_API_BASE_URL` (always `""` = relative URLs). Non-2xx responses throw `Error("HTTP {status}")`.

### Key Library Files

| File | Purpose |
|------|---------|
| `app/lib/config.ts` | Single source of truth for all env-var config |
| `app/lib/constants.ts` | `BENGALURU_BOUNDS`, `BENGALURU_CENTER`, category/severity label arrays |
| `app/lib/translations.ts` | `getCategoryLabel()` and bilingual helpers |
| `app/lib/photo-store.ts` | In-memory photo handoff between home page capture and report wizard |
| `app/lib/utils.ts` | Generic utilities |

## Migration Files Summary

| File | What it creates/modifies |
|------|--------------------------|
| `001_init.sql` | Extensions (postgis, pgcrypto); enums (issue_category, severity_level, report_status, location_source); `reports` table with PostGIS trigger; `status_history`; PWN scaffold tables (bus_stops, metro_stations) |
| `002_admin.sql` | `user_role` enum; `admin_users` table; adds `changed_by` FK to `status_history` |
| `003_super_admin.sql` | Adds `is_super_admin BOOLEAN NOT NULL DEFAULT FALSE` to `admin_users` |
| `004_ward_boundaries.sql` | `wards` table with GEOGRAPHY polygon column (~13MB GeoJSON ward boundary data) |
| `005_organizations.sql` | `organizations` table (self-referential adjacency list); adds `org_id` FK to `admin_users` |
| `006_ward_org_scoping.sql` | Adds `org_id` FK to `wards` for org-scoped report visibility |
| `007_anti_abuse.sql` | Adds `photo_hash`, `duplicate_of_id`, `duplicate_count`, `duplicate_confidence`, `submitter_ip` to `reports` |

## Configuration Files

| File | Controls |
|------|----------|
| `docker-compose.yml` | Service definitions: db, backend, frontend, nginx; resource limits; health checks |
| `docker-compose.dev.yml` | Local dev overrides (volume mounts for hot reload) |
| `docker-compose.server.yml` | Phase 02.4 backend-only override: removes frontend nginx dependency, swaps nginx config |
| `nginx/nginx.conf` | Full-stack routing, rate limiting (3 zones), security headers for /admin |
| `nginx/nginx.server.conf` | Backend-only routing (Phase 02.4); no frontend upstream; catch-all 404 |
| `backend/Cargo.toml` | Rust dependencies (axum, sqlx, argon2, img-parts, geohash, governor, etc.) |
| `frontend/next.config.mjs` | Next.js config (standalone output, no rewrites) |
| `frontend/tsconfig.json` | TypeScript config; path alias `@/*` → `./` |
| `frontend/jest.config.ts` | Jest with jsdom environment, `@/*` path alias |
| `.github/workflows/ci.yml` | CI: cargo test, cargo clippy, npm test, npm run build |
| `.github/workflows/deploy.yml` | CD: 3-job pipeline (ci → deploy → smoke-test) |

## Test File Locations

Backend tests are co-located with source (Rust `#[cfg(test)]` modules inside each file):
- `backend/src/middleware/auth.rs` — JWT validation unit tests
- `backend/src/handlers/reports.rs` — bbox validation, anti-abuse, rate limit, honeypot tests
- `backend/src/models/report.rs` — lat/lng rounding, privacy, image URL tests
- `backend/src/models/admin.rs` — model validation, serialization, auth logic tests
- `backend/src/config.rs` — PUBLIC_URL resolution tests
- `backend/src/db/dedup_job.rs` — SQL constant tests (no live DB needed)
- `backend/tests/` — Integration tests requiring live DB
- `backend/src/migrations_tests/` — Migration smoke tests

Frontend tests are in `__tests__/` subdirectories co-located with the code they test:
- `frontend/app/__tests__/` — Home page, layout, report page, utils
- `frontend/app/report/__tests__/` — Honeypot behavior
- `frontend/app/components/__tests__/` — Component tests
- `frontend/app/components/redesign/__tests__/` — Redesigned component tests
- `frontend/app/components/ui/__tests__/` — UI primitive tests
- `frontend/app/admin/__tests__/` — Admin page and API tests
- `frontend/app/admin/components/__tests__/` — Admin component tests
- `frontend/app/admin/lib/__tests__/` — adminApi client tests
- `frontend/app/admin/login/__tests__/` — Login page tests
- `frontend/app/admin/profile/__tests__/` — Profile page tests
- `frontend/app/admin/reports/[id]/__tests__/` — Report detail tests
- `frontend/app/admin/reports/map/__tests__/` — Admin map tests
- `frontend/__tests__/` — Root-level integration tests
- `frontend/__mocks__/` — Module mocks (next/font)

## Where to Add New Code

**New public API endpoint:**
- Handler function: `backend/src/handlers/reports.rs` (or a new handler file in `backend/src/handlers/`)
- Route registration: `backend/src/main.rs` (add to the public Router)
- DB query: `backend/src/db/queries.rs`
- Model struct: `backend/src/models/report.rs`

**New admin API endpoint:**
- Handler function: `backend/src/handlers/admin.rs`
- Route registration: `backend/src/main.rs` (add to `admin_protected_router` if auth required)
- DB query: `backend/src/db/admin_queries.rs`
- Frontend API client method: `frontend/app/admin/lib/adminApi.ts`

**New admin page:**
- Page: `frontend/app/admin/<name>/page.tsx`
- Tests: `frontend/app/admin/<name>/__tests__/page.test.tsx`
- Nav link: `frontend/app/admin/components/AdminSidebar.tsx`

**New shared frontend component:**
- Reusable primitive: `frontend/app/components/ui/`
- Domain-specific: `frontend/app/components/`
- Tests: same directory under `__tests__/`

**New database migration:**
- File: `backend/migrations/<NNN>_description.sql` (sequential number)
- Applied automatically at backend startup via `sqlx::migrate!("./migrations")`
- Run `cargo sqlx prepare` after adding queries that reference new tables

**New utility:**
- Frontend: `frontend/app/lib/utils.ts`
- Backend: add to relevant `db/` or `models/` module, or create a new module in `backend/src/`

## Special Directories

**`backend/uploads/`:**
- Purpose: Local filesystem storage for EXIF-stripped uploaded images
- In Docker production: replaced by named volume `uploads` mounted at `/app/uploads`
- In self-hosted (Phase 02.4): persists on host via Docker named volume
- Generated: No (must exist or be created; `main.rs` calls `create_dir_all`)
- Committed: No (`.gitignore`)

**`backend/.sqlx/`:**
- Purpose: SQLx compile-time query metadata cache for offline builds
- Generated: Yes — via `cargo sqlx prepare --database-url "..."`
- Committed: Yes — required for CI builds without a live DB

**`frontend/.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**`.planning/`:**
- Purpose: GSD planning documents (codebase maps, phase plans, debug logs)
- Generated: By GSD agents
- Committed: Yes

---

*Structure analysis: 2026-05-20*
