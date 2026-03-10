# Bengaluru Walkability Audit — Product Plan
> Living document. Updated 2026-03-10.
> Covers: completed work, open ACs, next-session backlog, open assumptions.

---

## 1. Completed Work

### 1.1 Backend (Rust / Axum)
- [x] `POST /api/reports` — multipart upload handler (photo + fields)
- [x] `GET /api/reports` — list with pagination, category + status filters, hard cap 200
- [x] `GET /api/reports/:id` — single report fetch
- [x] `GET /health` — health check endpoint
- [x] `GET /uploads/:filename` — static image serving via tower-http ServeDir
- [x] PostGIS schema (`001_init.sql`) — reports table with GEOGRAPHY column, GIST index
- [x] `location` column auto-populated via BEFORE INSERT trigger (`ST_SetSRID(ST_MakePoint(...))`)
- [x] `updated_at` trigger on reports
- [x] `status_history` table for audit trail
- [x] Compound indexes: `(status, category, created_at DESC)` and partial `WHERE status='submitted'`
- [x] EXIF GPS stripped server-side via `img-parts` before writing to disk
- [x] Public coordinates rounded to 3 decimal places (~111m) in response serializer
- [x] Bengaluru bounding box validation server-side (lat 12.7342–13.1739, lng 77.3791–77.8731)
- [x] SQLx compile-time queries replaced with runtime API for testability
- [x] Server-side `?limit=` cap at 200; `limit ≤ 0` falls back to default 20 (P2-4)
- [x] Request ID middleware: reads `X-Request-ID` from nginx, injects into tracing span, echoes in response header (P2-1)
- [x] `RUST_LOG: info` in `docker-compose.yml` backend service (P2-2)
- [x] `tracing-subscriber` JSON formatter (`fmt().json()`) in `main.rs` (P2-3)
- [x] Body limit raised to 20 MB (`DefaultBodyLimit::max`) to prevent 502 on iPhone uploads
- [x] Admin subsystem: `002_admin.sql` — `admin_users` table (`user_role` enum, Argon2id hash, `is_active`) + `status_history` audit trail
- [x] JWT auth middleware (`backend/src/middleware/auth.rs`) — pure-function `extract_claims` + `require_role` security boundary
- [x] 11 admin handlers: login, logout, me, list/get/update/delete reports, stats, list/create/deactivate users
- [x] Admin router at `/api/admin/*` — unprotected auth sub-router + JWT-gated protected sub-router
- [x] Idempotent admin user seeding on startup: reads `ADMIN_SEED_EMAIL` + `ADMIN_SEED_PASSWORD` from env, skips if table non-empty, hashes with Argon2id and inserts (`backend/src/db/admin_seed.rs`)
- [x] Admin Portal Phase 2 (`003_super_admin.sql`): `is_super_admin BOOLEAN NOT NULL DEFAULT FALSE` on `admin_users`; seed bootstrap account sets `is_super_admin = TRUE`
- [x] `is_super_admin` field in `AdminUser`/`AdminUserResponse`; `guard_super_admin_deactivation` pure helper returns `403 Forbidden` (not 404)
- [x] `validate_display_name`, `validate_new_password` pure validators
- [x] `admin_update_profile` handler (PATCH `/api/admin/auth/profile`) and `admin_change_password` handler (POST `/api/admin/auth/change-password`) with Argon2id verify+hash
- [x] `get_admin_user_by_id`, `update_admin_profile`, `update_admin_password` DB helpers
- [x] 7 migration SQL tests covering `003_super_admin.sql`
- [x] Security Hardening — all P1 findings resolved; FINDING-001 edge middleware (`frontend/middleware.ts`); FINDING-003 panic on missing/short JWT secret + docker-compose `${JWT_SECRET:?...}` fail-fast; FINDING-002 `allow_methods(Any)` replaced with explicit method list; FINDING-004 login success logs UUID not email; FINDING-005 `warn!` on failed login attempts; FINDING-006 `admin_me` fetches by UUID; FINDING-007 `jwt_session_hours` in `AppState`, clamped 1–168h; FINDING-008 `admin_api` nginx zone 60r/m on `/api/admin/`; FINDING-009 startup `warn!` if `ADMIN_SEED_PASSWORD` still set; FINDING-011 `Max-Age` on `admin_token` cookie; FINDING-013 canonicalize + prefix check before `remove_file`; FINDING-014 `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy`, CSP on `/admin` nginx location; FINDING-016 `performed_by` UUID in deactivation log; PHASE2-003 super-admin deactivation returns `403 Forbidden`
- [x] 177 backend unit tests passing (models, handlers, middleware, config, seeding, migration SQL)

### 1.2 Frontend (Next.js 14)
- [x] Landing page (`/`) — headline, CTAs, How It Works section
- [x] 4-step report wizard (`/report`):
  - Step 1: Photo — Take Photo / Upload from Gallery, file type + size validation
  - Step 2: Location — EXIF extraction (client-side, exifr), fallback manual pin on Leaflet map
  - Step 3: Category — 6-card grid picker (No Footpath, Damaged, Blocked, Unsafe Crossing, Poor Lighting, Other)
  - Step 4: Details — Severity toggle, description, name, contact, Submit
- [x] Image compression via Canvas API if file > 10MB
- [x] EXIF extracted from original file before compression
- [x] Client-side bounding box validation (step 2 Next button gating)
- [x] All map components SSR-disabled (`dynamic(() => import(...), { ssr: false })`)
- [x] All Reports map (`/map`) — color-coded markers, legend, popup with photo + details
- [x] Submit success screen with "View on Map" / "Share This App" / "Report Another Issue"
- [x] Shared constants: `BENGALURU_BOUNDS`, `BENGALURU_CENTER` in `app/lib/constants.ts`
- [x] `viewport`/`themeColor` extracted into separate `export const viewport: Viewport` (F1 — removes Next.js 14 deprecation warnings)
- [x] EXIF vs manual pin conflict warning: amber banner when pin >500m from EXIF position; dismissible; resets on return (§2.3 — ASSUMPTION-6 resolved at 500m)
- [x] `haversineDistance` utility in `app/lib/utils.ts`
- [x] Admin dashboard frontend (`/admin` route group): edge middleware auth redirect, server-side auth layout, dashboard overview, reports table with status update, users management page
- [x] Typed API client (`frontend/app/admin/lib/adminApi.ts`) for all 11 admin endpoints
- [x] Admin login page (`/admin/login`): HttpOnly cookie auth, rate-limit countdown (60 s), actionable per-status error messages (network / 5xx with status code / 400 / other 4xx / 401 / 429)
- [x] Admin login bug fix: infinite redirect loop on successful login resolved
- [x] `/admin/profile` page: display-name edit + 3-field password change (current, new, confirm); getMe on mount
- [x] `/admin/reports/map` page: Leaflet SSR-disabled, status-coloured pins, popups with report detail, client-side category and status filters
- [x] `UserManagementTable` super-admin badge (`data-testid="super-admin-badge"`)
- [x] Sidebar links for Profile and Reports Map (all roles)
- [x] `adminApi.ts` extended with `is_super_admin`, `updateProfile()`, `changePassword()`
- [x] Frontend edge middleware (`frontend/middleware.ts`): unauthenticated `/admin/*` requests redirected to `/admin/login`; 29 tests
- [x] 566 frontend tests across all suites (Jest + React Testing Library)

### 1.3 Infrastructure
- [x] `docker-compose.yml` — full stack (nginx + frontend + backend + db)
- [x] `docker-compose.dev.yml` — dev overrides (hot reload)
- [x] nginx reverse proxy: `/api/` → backend:3001, `/uploads/` → backend:3001, `/` → frontend:3000
- [x] PostGIS extensions auto-applied on backend startup via `sqlx::migrate!`
- [x] `NEXT_PUBLIC_API_URL=http://localhost` baked into Next.js Docker build via `ARG`/`ENV` in `frontend/Dockerfile` and `build.args` in `docker-compose.yml` — fixes silent API failures where browser bundle fell back to `http://localhost:3001` (P3-3)
- [x] `POSTGRES_PASSWORD` fallback removed — missing password is a hard startup failure (P0-1)
- [x] `deploy.resources.limits` on all containers: db 512m, backend 256m, frontend 256m, nginx 64m (P0-2)
- [x] `client_body_buffer_size 10m` + `client_body_temp_path` in nginx.conf (P1-1)
- [x] Healthchecks on backend (`/health`) and frontend (`/`); nginx `depends_on: service_healthy` (P1-2)
- [x] Restart policies: `always` for db, `unless-stopped` for backend/frontend/nginx (P1-3)
- [x] Non-root `appuser` in backend Dockerfile runtime stage; `curl` installed for healthcheck (P1-4)

### 1.4 UX / Copy
- [x] Taxonomy finalised: 6 categories with emoji, display labels, card descriptions, map legend labels
- [x] Severity hints: "How serious is it?" + per-level descriptions
- [x] EXIF/no-EXIF copy variants (amber badge, no-GPS banner)
- [x] Error code registry: WB-PHOTO-001–006, WB-LOC-001–007, WB-SUB-001–003, WB-MAP-001–003, WB-SHARE-001
- [x] Classification rules for edge cases (drain, dark subway, encroachment, etc.)

---

## 2. Open ACs — Specced but Not Yet Implemented

These were defined in the AC spec (2026-03-03) but are unresolved pending product decisions or deferred.

### 2.1 Duplicate Submission Detection (WB-SUB-002)
**Blocked by:** ASSUMPTION-4 (duplicate window: 60 min / 24h / moderation only)
**AC:** When a submission is detected as a duplicate (same device + 50m + same category within X minutes), show a confirmation dialog before allowing submission. Backend must return HTTP 409 with a payload identifying the suspected duplicate report.
**Status:** Architecture ready (PostGIS radius query exists); client flow not built; policy unresolved.

### 2.2 Rate Limiting (WB-SUB-003)
**Blocked by:** ASSUMPTION-7 (10/hr or 5/hr or none for MVP)
**AC:** Backend returns HTTP 429 with `Retry-After` header when rate limit exceeded. Frontend shows user-facing error (WB-SUB-003) with countdown or retry guidance.
**Status:** Not implemented in backend or frontend.

### ~~2.3 EXIF vs Manual Pin Conflict Warning~~ ✅ DONE 2026-03-05
ASSUMPTION-6 resolved: **500m threshold** (>500m triggers warning).
`haversineDistance` utility added to `app/lib/utils.ts`. Amber warning banner rendered in `LocationMap.tsx`; dismissible; dismissed state resets when pin returns within 500m. 19 component tests + 12 utility tests passing.

### 2.4 Coordinate Precision Validation (WB-LOC-006)
**Blocked by:** ASSUMPTION-20 (minimum 4 decimal places vs no floor)
**AC:** If the GPS coordinate (EXIF or manual) has fewer than N decimal places, reject with WB-LOC-006 and prompt the user to zoom in and re-pin.
**Status:** Not implemented.

### 2.5 Offline Submission Queueing
**Blocked by:** ASSUMPTION-13 (IndexedDB queue vs fail immediately vs skip for MVP)
**AC:** If the network is unavailable at submit time, store the report in IndexedDB and retry automatically when connectivity is restored. Show a "Queued — will send when online" banner.
**Status:** Explicitly deferred. Requires its own spec if in scope.

### 2.6 Map Report Popup — Photo Thumbnail
**Blocked by:** ASSUMPTION-12 (thumbnail resolution: 400px client-side / server-generated / full original)
**AC:** Each report popup on `/map` shows a photo thumbnail. Image should not load the full original (performance). Thumbnail sizing strategy TBD.
**Status:** Popup exists but thumbnail resolution strategy not finalised or optimised.

### 2.7 Share This App (WB-SHARE-001)
**Blocked by:** ASSUMPTION-11 (share URL: current page / fixed config / report permalink)
**AC:** "Share This App" button on success screen uses Web Share API if available, falls back to clipboard copy. On clipboard failure (WB-SHARE-001), display the URL as selectable text.
**Status:** Button label exists in UX spec; implementation status unclear — verify in code.

### 2.8 Language / Localisation
**Blocked by:** ASSUMPTION-14 (English only vs English + Kannada vs trilingual)
**AC:** All user-facing copy must be externalized to a copy file (not hardcoded) to enable future localisation even if only English ships at launch.
**Status:** Copy is currently hardcoded in component files. Externalisation not done.

### 2.9 Accessibility Audit
**Blocked by:** ASSUMPTION-25 (WCAG 2.1 AA full / A / best-effort)
**AC:** All interactive elements must have ARIA labels, keyboard navigation, and sufficient colour contrast. Map component must have a non-map fallback for screen readers.
**Status:** Not formally audited.

---

## 3. Next Session Backlog — Operational Fixes

From the 2026-03-04 docker run log review. Prioritised.

> **2026-03-10 update**: Edge middleware for `/admin` route protection ✅ DONE. Admin Portal Phase 2 (super-admin, profile page, reports map) ✅ DONE. All 16 security audit findings addressed ✅ DONE (FINDING-010, -012, -015, and PHASE2-001 intentionally deferred by design).

### P0 — Fix Before Any Real Traffic

#### ~~P0-1: Remove hardcoded password fallback~~ ✅ DONE 2026-03-05
`:-secret` default removed. `.env.example` updated to `CHANGEME_STRONG_PASSWORD`.
**Note:** `POSTGRES_PASSWORD` must be set in a root `.env` file before running `docker compose up`.

#### ~~P0-2: Add resource limits to all containers~~ ✅ DONE 2026-03-05
`deploy.resources.limits` added to all services.

### P1 — High Impact

#### ~~P1-1: nginx upload buffering~~ ✅ DONE 2026-03-05
`client_body_buffer_size 10m` + `client_body_temp_path /tmp/nginx_upload_temp` added.

#### ~~P1-2: Add healthchecks and gate depends_on properly~~ ✅ DONE 2026-03-05
Healthchecks on backend + frontend; nginx `depends_on: condition: service_healthy`; `curl` installed in backend runtime image.

#### ~~P1-3: Add restart policies~~ ✅ DONE 2026-03-05
`restart: always` on db; `restart: unless-stopped` on backend/frontend/nginx.

#### ~~P1-4: Add non-root user to backend Dockerfile~~ ✅ DONE 2026-03-05
`appuser` created in runtime stage; `/app/uploads` chowned before `USER` switch.

### P2 — Observability

#### ~~P2-1: Add request ID propagation~~ ✅ DONE 2026-03-07
nginx generates `$request_id`, forwards as `X-Request-ID`; backend middleware reads it, injects into tracing span, echoes in response header.

#### ~~P2-2: Set RUST_LOG=info in production~~ ✅ DONE 2026-03-07
`RUST_LOG: info` added to backend service in `docker-compose.yml`.

#### ~~P2-3: Structured JSON logging~~ ✅ DONE 2026-03-07
nginx switched to JSON access log format. Backend `main.rs` uses `tracing_subscriber::fmt().json()`.

#### ~~P2-4: Server-side cap on `?limit=` parameter~~ ✅ DONE 2026-03-05
Cap raised to 200; `limit ≤ 0` now falls back to default 20. 13 new unit tests added.

#### P2-5: Add a metrics endpoint
**Files:** backend `main.rs`, `nginx/nginx.conf`
**Fix:** Add `/metrics` (Prometheus format) with counters for request count, error rate, report submission rate, and latency histograms. Expose via a separate internal port (not proxied through nginx publicly).

### P3 — Production Readiness

#### P3-1: Backup strategy for uploads volume
**Fix:** Document and automate: nightly `pg_dump` for postgres_data; nightly `rsync`/`tar` for uploads volume to an offsite location. Add a `backup/` script and cron job.

#### ~~P3-2: CI/CD pipeline~~ ✅ DONE 2026-03-07
`.github/workflows/ci.yml` — 3 parallel jobs (frontend-checks, backend-checks, docker-build) with `workflow_call` trigger. `.github/workflows/deploy.yml` — reuses ci.yml then SSH-deploy placeholder. CI is green.

#### ~~P3-3: Fix NEXT_PUBLIC_API_URL in production~~ ✅ DONE 2026-03-07
`frontend/Dockerfile` now declares `ARG NEXT_PUBLIC_API_URL` + `ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL` before `RUN npm run build`. `docker-compose.yml` passes it via `build.args`. Browser bundle now uses `http://localhost` (nginx proxy) in production.

#### ~~P3-4: nginx proxy timeouts and rate limiting~~ ✅ DONE 2026-03-07
`proxy_connect_timeout 5s; proxy_send_timeout 30s; proxy_read_timeout 30s` added. `limit_req_zone` + `limit_req` on POST `/api/reports` (5 r/m). Stricter rate limit on `/api/admin/login` (login brute-force protection).

#### ~~P3-5: Fix /uploads/ forwarding headers~~ ✅ DONE 2026-03-07
`proxy_set_header X-Real-IP` and `X-Forwarded-For` added to `/uploads/` location block.

#### ~~P3-6: Add nginx healthcheck~~ ✅ DONE 2026-03-07
`healthcheck: test: ["CMD", "curl", "-f", "http://localhost/health"]` added to nginx service in `docker-compose.yml`.

### Frontend Fixes (from log warnings)

#### ~~F1: Fix Next.js metadata/viewport warnings~~ ✅ DONE 2026-03-05
`viewport` + `themeColor` moved into a separate `export const viewport: Viewport` named export.

#### ~~F2: Add favicon~~ ✅ DONE 2026-03-04
`frontend/app/favicon.ico` added. Next.js App Router auto-serves it at `/favicon.ico`.

---

## 4. Open Assumptions (All Unresolved — Product Decisions Required)

These block implementation of the Open ACs in section 2. They need a product/legal call before the next dev session can close them.

| ID | Question | Options | Blocks |
|----|----------|---------|--------|
| ASSUMPTION-1 | Max photo file size | 10MB / 15MB / 25MB | AC step 1 |
| ASSUMPTION-3 | Accepted MIME types | JPEG+PNG / +WEBP+HEIC / any image/* | AC step 1 |
| ASSUMPTION-4 | Duplicate window | 60min/50m/same-cat / 24h same coords / moderation only | §2.1 |
| ASSUMPTION-5 | Bounding box definition | BBMP ward GeoJSON / rect / 50km radius | validation |
| ~~ASSUMPTION-6~~ | ~~EXIF vs pin conflict threshold~~ | **Resolved: 500m** (2026-03-05) | ~~§2.3~~ |
| ASSUMPTION-7 | Rate limit | 10/hr / 5/hr / none for MVP | §2.2 |
| ASSUMPTION-13 | Offline queueing | IndexedDB / fail immediately / skip MVP | §2.5 |
| ASSUMPTION-14 | Languages at launch | English only / +Kannada / trilingual | §2.8 |
| ASSUMPTION-20 | Coordinate precision floor | 4 decimal places / no floor | §2.4 |
| ASSUMPTION-21 | Photo PII screening | Auto blur / moderator review / none for MVP | privacy |
| ASSUMPTION-22 | Public GPS precision | Exact / ward-level / 100m grid | **LEGAL REVIEW REQUIRED** |
| ASSUMPTION-24 | Uptime SLA | 99% / 99.5% / best-effort | infra sizing |
| ASSUMPTION-25 | Accessibility compliance | WCAG 2.1 AA / A / best-effort | §2.9 |

---

## 5. Future Features (Post-MVP, Not Yet Specced)

These were identified as valuable but explicitly out of current scope:

- ~~**Report moderation UI**~~ ✅ DONE 2026-03-07 — admin dashboard with JWT auth, 11 handlers, full frontend; see §1.2 and §1.1
- **upvote / verify** — `report_verifications` table (schema stub exists: `UNIQUE(report_id, device_fingerprint_hash)`)
- **Heatmap layer** — ST_SnapToGrid SQL query already written in schema-decisions.md; needs API endpoint + frontend toggle
- **PWN transit density** — reports near bus stops / metro stations (PostGIS query ready in schema-decisions.md)
- **ML batch ranking / priority scoring** — nightly job, explainability breakdown (ml-batch-ranking-agent in scope)
- **Category sub-types** — trigger thresholds defined: broken_footpath at 200/mo, blocked at 150/mo, other at 20% of total
- **Kannada / Hindi localisation** — requires copy externalisation (§2.8) first
- **Video submissions** — not in any PRD; do not spec until explicitly requested
- **User authentication** — explicitly out of scope (anonymous submissions by design)
