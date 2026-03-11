# Codebase Structure

**Analysis Date:** 2026-03-11

## Directory Layout

```
bengaluru-walkability-public-audit/
├── backend/                    # Rust/Axum REST API (port 3001)
│   ├── migrations/             # SQLx migration files (run at startup)
│   │   ├── 001_init.sql        # Core schema: reports, PostGIS types, triggers
│   │   ├── 002_admin.sql       # admin_users table + audit trail
│   │   └── 003_super_admin.sql # is_super_admin column
│   ├── src/
│   │   ├── main.rs             # Entry point: router, AppState, startup
│   │   ├── config.rs           # Config::from_env() — env var loading
│   │   ├── errors.rs           # AppError enum + IntoResponse impl
│   │   ├── handlers/
│   │   │   ├── mod.rs          # Handler module exports
│   │   │   ├── health.rs       # GET /health
│   │   │   ├── reports.rs      # Public report CRUD (POST/GET /api/reports)
│   │   │   └── admin.rs        # All 14 admin handlers (/api/admin/*)
│   │   ├── db/
│   │   │   ├── mod.rs          # DB module exports
│   │   │   ├── queries.rs      # Public report queries (insert, list, get)
│   │   │   ├── admin_queries.rs # Admin report + user queries
│   │   │   └── admin_seed.rs   # Super-admin user seeding at startup
│   │   ├── middleware/
│   │   │   ├── mod.rs          # Middleware module exports
│   │   │   └── auth.rs         # JWT: extract_claims(), require_role(), require_auth
│   │   └── models/
│   │       ├── mod.rs          # Model module exports
│   │       ├── report.rs       # Report, ReportResponse, CreateReportRequest
│   │       └── admin.rs        # AdminUser, AdminUserResponse, validation helpers
│   ├── tests/                  # Integration test files (backend)
│   ├── uploads/                # Uploaded images (local filesystem, gitignored)
│   └── Cargo.toml
├── frontend/                   # Next.js 14 App Router (port 3000)
│   ├── app/
│   │   ├── layout.tsx          # Root HTML layout
│   │   ├── page.tsx            # Homepage: hero + CTAs
│   │   ├── globals.css         # Tailwind base styles
│   │   ├── components/         # Shared public UI components
│   │   │   ├── BilingualText.tsx     # Bilingual EN/KN text renderer
│   │   │   ├── CategoryPicker.tsx    # Issue category selection grid
│   │   │   ├── LocationMap.tsx       # Leaflet map for pin-drop (report wizard)
│   │   │   ├── PhotoCapture.tsx      # Photo upload + EXIF extraction
│   │   │   ├── ReportsMap.tsx        # Public map with all reports
│   │   │   ├── ReviewStrip.tsx       # Review strip (wizard step summary)
│   │   │   └── SubmitSuccess.tsx     # Post-submission success screen
│   │   ├── lib/                # Shared frontend utilities and config
│   │   │   ├── config.ts       # MANDATORY: all env-var config (API_BASE_URL, INTERNAL_API_URL)
│   │   │   ├── constants.ts    # BENGALURU_BOUNDS, BENGALURU_CENTER
│   │   │   ├── translations.ts # English/Kannada string pairs + getCategoryLabel()
│   │   │   └── utils.ts        # Misc utility functions
│   │   ├── report/
│   │   │   └── page.tsx        # 4-step report submission wizard
│   │   ├── map/
│   │   │   └── page.tsx        # Public reports map page
│   │   └── admin/              # Admin dashboard route group
│   │       ├── layout.tsx      # Server Component: JWT cookie check + sidebar nav
│   │       ├── page.tsx        # Admin dashboard home (stats overview)
│   │       ├── login/
│   │       │   └── page.tsx    # Admin login form
│   │       ├── reports/
│   │       │   ├── page.tsx    # Admin reports table with filters
│   │       │   └── map/
│   │       │       └── page.tsx # Admin reports map with status-colored pins
│   │       ├── users/
│   │       │   └── page.tsx    # User management (admin-only)
│   │       ├── profile/
│   │       │   └── page.tsx    # Admin profile + password change
│   │       ├── components/     # Admin-only UI components
│   │       │   ├── ReportsTable.tsx      # Sortable/filterable report rows
│   │       │   ├── StatsCards.tsx        # Dashboard stats cards
│   │       │   ├── StatusBadge.tsx       # Status pill component
│   │       │   ├── UserManagementTable.tsx # User list + deactivate
│   │       │   └── CreateUserModal.tsx   # New user creation modal
│   │       └── lib/
│   │           └── adminApi.ts # Typed HTTP client for all admin API calls
│   ├── __mocks__/              # Jest manual mocks
│   │   ├── leaflet.js          # Leaflet mock
│   │   ├── nextDynamic.js      # next/dynamic mock
│   │   ├── reactLeaflet.js     # react-leaflet mock
│   │   └── styleMock.js        # CSS module mock
│   ├── public/                 # Static assets
│   ├── jest.config.js          # Jest config (two environments: jsdom + node)
│   ├── jest.setup.ts           # Jest setup (RTL + custom matchers)
│   ├── next.config.ts          # Next.js config (output: standalone)
│   └── tsconfig.json
├── nginx/
│   └── nginx.conf              # Reverse proxy: routing, rate limits, security headers
├── docker-compose.yml          # Production stack (4 services: db, backend, frontend, nginx)
├── docker-compose.dev.yml      # Dev overrides (bind-mount source, no nginx)
├── .github/
│   └── workflows/
│       ├── ci.yml              # CI: frontend-checks, backend-checks, docker-build (parallel)
│       └── deploy.yml          # Deploy: reuses ci.yml then SSH-deploy
├── docs/
│   └── ac/                     # Acceptance criteria documents
└── CLAUDE.md                   # Project setup instructions
```

## Directory Purposes

**`backend/src/handlers/`:**
- Purpose: Axum route handler functions — one file per domain
- Contains: Async functions receiving `State<AppState>` and extractors; parse request, validate, call `db/`, return `Result<Json<_>, AppError>`
- Key files: `handlers/reports.rs` (public CRUD + EXIF strip), `handlers/admin.rs` (14 admin handlers)

**`backend/src/db/`:**
- Purpose: Raw SQLx query functions — no business logic, just DB access
- Contains: Functions taking `&PgPool` + parameters, returning `Result<_, AppError>`
- Key files: `db/queries.rs` (public report SQL), `db/admin_queries.rs` (admin SQL), `db/admin_seed.rs` (startup seeding)

**`backend/src/models/`:**
- Purpose: Rust structs representing DB rows and API response shapes
- Contains: `FromRow` DB structs, plain response structs, request parsing structs, validation pure functions
- Key files: `models/report.rs` (Report + ReportResponse), `models/admin.rs` (AdminUser + AdminUserResponse + validators)

**`backend/src/middleware/`:**
- Purpose: Axum middleware layers
- Contains: JWT extraction and role-gating (pure functions + async middleware)
- Key files: `middleware/auth.rs`

**`backend/migrations/`:**
- Purpose: Versioned SQL migration files applied automatically by `sqlx::migrate!()` on startup
- Contains: DDL for all tables, enums, triggers, indexes
- Key files: `001_init.sql` (core schema + PostGIS), `002_admin.sql` (admin_users), `003_super_admin.sql` (is_super_admin column)

**`frontend/app/components/`:**
- Purpose: Shared client-side UI components used across public pages
- Contains: React components; Leaflet map components are always client-only (use `"use client"` directive or loaded via `dynamic(..., { ssr: false })`)
- Key files: `PhotoCapture.tsx`, `LocationMap.tsx`, `ReportsMap.tsx`

**`frontend/app/lib/`:**
- Purpose: Non-component utilities, configuration, and shared data
- Contains: Config exports, geographic constants, translation strings, utility functions
- Key files: `config.ts` (MANDATORY single source of truth for env vars), `constants.ts` (bbox + center), `translations.ts`

**`frontend/app/admin/`:**
- Purpose: Entire admin dashboard — route group with shared server-side auth layout
- Contains: Pages, admin-specific components, typed API client
- Key files: `admin/layout.tsx` (auth guard), `admin/lib/adminApi.ts` (typed API client)

**`frontend/__mocks__/`:**
- Purpose: Jest manual mocks for browser-only libraries
- Contains: Mocks for Leaflet, react-leaflet, next/dynamic, CSS modules
- Generated: No — manually maintained
- Committed: Yes

## Key File Locations

**Entry Points:**
- `backend/src/main.rs`: Rust server startup, router construction, AppState initialization
- `frontend/app/page.tsx`: Next.js homepage
- `frontend/app/layout.tsx`: Root HTML document layout

**Configuration:**
- `frontend/app/lib/config.ts`: MANDATORY — all frontend env-var config (never inline `process.env.*` elsewhere)
- `frontend/app/lib/constants.ts`: Static geographic constants (bbox, center)
- `backend/src/config.rs`: Backend env-var loading via `Config::from_env()`
- `docker-compose.yml`: Production environment variable values for all services
- `nginx/nginx.conf`: Reverse proxy routing, rate limits, security headers

**Core Business Logic:**
- `backend/src/handlers/reports.rs`: Public report ingestion (EXIF strip, bbox validation, file save, DB insert)
- `backend/src/handlers/admin.rs`: All 14 admin API handlers
- `backend/src/middleware/auth.rs`: JWT validation (`extract_claims`, `require_role`, `require_auth`)
- `backend/src/models/report.rs`: `Report::into_response()` — coordinate rounding, field exclusion
- `frontend/app/report/page.tsx`: 4-step citizen report wizard

**Database:**
- `backend/migrations/001_init.sql`: Core schema, PostGIS types, triggers, indexes
- `backend/migrations/002_admin.sql`: Admin users schema
- `backend/src/db/queries.rs`: Public report SQL
- `backend/src/db/admin_queries.rs`: Admin SQL

**Testing:**
- `frontend/jest.config.js`: Jest config (split environments)
- `frontend/jest.setup.ts`: RTL + custom matchers setup
- `frontend/__mocks__/`: Manual mocks for Leaflet and next/dynamic
- `backend/tests/`: Backend integration tests
- Test files: co-located in `__tests__/` subdirectories next to source files

## Naming Conventions

**Files (Backend):**
- Rust modules: `snake_case.rs` (e.g., `admin_queries.rs`, `admin_seed.rs`)
- Handler files grouped by domain: `reports.rs`, `admin.rs`, `health.rs`

**Files (Frontend):**
- React components: `PascalCase.tsx` (e.g., `PhotoCapture.tsx`, `ReportsTable.tsx`)
- Utilities and config: `camelCase.ts` (e.g., `adminApi.ts`, `config.ts`, `constants.ts`)
- Next.js pages: `page.tsx` (App Router convention)
- Next.js layouts: `layout.tsx`
- Test directories: `__tests__/` co-located with source
- Mock files: `camelCase.js` in `frontend/__mocks__/`

**Directories:**
- Backend modules: `snake_case/` (e.g., `handlers/`, `db/`, `models/`, `middleware/`)
- Frontend routes: `kebab-case/` following Next.js App Router conventions (e.g., `admin/`, `reports/`, `map/`)
- Admin sub-routes: nested under `frontend/app/admin/` (e.g., `login/`, `reports/map/`, `profile/`)

## Where to Add New Code

**New Public API Endpoint:**
- Handler function: `backend/src/handlers/reports.rs` or new file in `backend/src/handlers/`
- DB query: `backend/src/db/queries.rs`
- Route registration: `backend/src/main.rs` in the public `Router::new()` block
- Response model: `backend/src/models/report.rs` if new response shape needed

**New Admin API Endpoint:**
- Handler function: `backend/src/handlers/admin.rs`
- DB query: `backend/src/db/admin_queries.rs`
- Route registration: `backend/src/main.rs` in `admin_protected_router` block (or `admin_auth_router` if unauthenticated)
- Frontend call: add named export to `frontend/app/admin/lib/adminApi.ts`

**New Frontend Page (Public):**
- Implementation: new directory under `frontend/app/` with `page.tsx`
- Tests: `frontend/app/<route>/__tests__/page.test.tsx`

**New Frontend Admin Page:**
- Implementation: new directory under `frontend/app/admin/` with `page.tsx`
- Tests: `frontend/app/admin/<route>/__tests__/page.test.tsx`
- Any new API calls: add to `frontend/app/admin/lib/adminApi.ts`

**New Shared UI Component:**
- Public component: `frontend/app/components/<ComponentName>.tsx`
- Admin-only component: `frontend/app/admin/components/<ComponentName>.tsx`
- Tests: co-located in `__tests__/` subdirectory

**New Environment Variable:**
- Frontend client-side: add export to `frontend/app/lib/config.ts` (never inline in component files)
- Frontend server-side: add export to `frontend/app/lib/config.ts` using `process.env.*`
- Backend: add field to `Config` struct in `backend/src/config.rs` and read in `Config::from_env()`
- Docker: add to `docker-compose.yml` under the appropriate service `environment:` block

**New Database Table:**
- Add migration: `backend/migrations/00N_description.sql` (next sequential number)
- Add model struct: `backend/src/models/` (new file or extend existing)
- Add query functions: `backend/src/db/` (appropriate file)
- Run `cargo sqlx prepare --database-url "..."` to update offline metadata after schema changes

**New Geographic Constant (bbox, center):**
- Add to `frontend/app/lib/constants.ts` only — never hard-code in component files

## Special Directories

**`backend/uploads/`:**
- Purpose: Local filesystem storage for uploaded images served via tower-http `ServeDir`
- Generated: Yes — created at startup by `std::fs::create_dir_all`
- Committed: No (gitignored)

**`frontend/.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No (gitignored)

**`frontend/__mocks__/`:**
- Purpose: Jest manual mocks for browser-only dependencies (Leaflet, next/dynamic)
- Generated: No — manually maintained
- Committed: Yes

**`.claude/`:**
- Purpose: Claude agent memory files and skill definitions for specialized agents
- Generated: Partially (agent memory is written by agents)
- Committed: Yes (skills and agent definitions), agent memory files may vary

**`.planning/`:**
- Purpose: GSD planning documents — codebase analysis and implementation phase plans
- Generated: By GSD planning commands
- Committed: Yes

**`docs/ac/`:**
- Purpose: Acceptance criteria documents used as the source of truth for TDD test authoring
- Generated: No — written by `prd-to-ac-converter` agent
- Committed: Yes

---

*Structure analysis: 2026-03-11*
