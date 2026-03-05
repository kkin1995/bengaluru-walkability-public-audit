# Bengaluru Walkability Audit — Product Plan
> Living document. Updated 2026-03-05.
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
- [x] 39 backend unit tests passing (models + handlers + limit-cap edge cases)

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
- [x] 159 frontend tests across 9 suites (Jest + React Testing Library)

### 1.3 Infrastructure
- [x] `docker-compose.yml` — full stack (nginx + frontend + backend + db)
- [x] `docker-compose.dev.yml` — dev overrides (hot reload)
- [x] nginx reverse proxy: `/api/` → backend:3001, `/uploads/` → backend:3001, `/` → frontend:3000
- [x] PostGIS extensions auto-applied on backend startup via `sqlx::migrate!`
- [x] `NEXT_PUBLIC_API_URL=http://localhost` — nginx proxy, not internal Docker hostname (P3-3)
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

#### P2-1: Add request ID propagation
**Files:** `nginx/nginx.conf`, backend trace config
**Fix:** Generate `$request_id` in nginx, forward as `X-Request-ID` header to backend, include in nginx access log format, log in backend trace spans.

#### P2-2: Set RUST_LOG=info in production
**File:** `docker-compose.yml`
**Fix:** Add `RUST_LOG: info` environment variable to the backend service. Currently defaults to DEBUG → verbose log bloat.

#### P2-3: Structured JSON logging
**Files:** `nginx/nginx.conf`, backend `main.rs`
**Fix:** Switch nginx to JSON access log format. Add `tracing-subscriber` JSON formatter to backend.

#### ~~P2-4: Server-side cap on `?limit=` parameter~~ ✅ DONE 2026-03-05
Cap raised to 200; `limit ≤ 0` now falls back to default 20. 13 new unit tests added.

#### P2-5: Add a metrics endpoint
**Files:** backend `main.rs`, `nginx/nginx.conf`
**Fix:** Add `/metrics` (Prometheus format) with counters for request count, error rate, report submission rate, and latency histograms. Expose via a separate internal port (not proxied through nginx publicly).

### P3 — Production Readiness

#### P3-1: Backup strategy for uploads volume
**Fix:** Document and automate: nightly `pg_dump` for postgres_data; nightly `rsync`/`tar` for uploads volume to an offsite location. Add a `backup/` script and cron job.

#### P3-2: CI/CD pipeline
**Fix:** Add `.github/workflows/ci.yml` running: frontend lint → frontend test → backend clippy → backend test → docker build (no push). Add a separate `deploy.yml` for staging.

#### P3-3: Fix NEXT_PUBLIC_API_URL in production (CRITICAL)
**File:** `docker-compose.yml`
**Problem:** `NEXT_PUBLIC_API_URL=http://backend:3001` is a Docker-internal hostname inlined into the JS bundle at build time. Browsers cannot resolve `backend`. All API calls silently fail.
**Fix:** Set `NEXT_PUBLIC_API_URL=http://localhost` (or the production domain). The frontend should call nginx (port 80), which proxies `/api/` to the backend — not call the backend directly.

#### P3-4: nginx proxy timeouts and rate limiting
**File:** `nginx/nginx.conf`
**Fix:** Add `proxy_read_timeout 30s; proxy_connect_timeout 5s; proxy_send_timeout 30s;`. Add `limit_req_zone` + `limit_req` on `POST /api/reports` to prevent upload flooding.

#### P3-5: Fix /uploads/ forwarding headers
**File:** `nginx/nginx.conf`
**Fix:** Add `proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` to the `/uploads/` location block (matches the `/api/` block).

#### P3-6: Add nginx healthcheck
**File:** `docker-compose.yml`
**Fix:** Add `healthcheck: test: ["CMD", "curl", "-f", "http://localhost/health"]` to the nginx service.

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

- **Report moderation UI** — admin dashboard to move reports through `submitted → under_review → resolved`
- **upvote / verify** — `report_verifications` table (schema stub exists: `UNIQUE(report_id, device_fingerprint_hash)`)
- **Heatmap layer** — ST_SnapToGrid SQL query already written in schema-decisions.md; needs API endpoint + frontend toggle
- **PWN transit density** — reports near bus stops / metro stations (PostGIS query ready in schema-decisions.md)
- **ML batch ranking / priority scoring** — nightly job, explainability breakdown (ml-batch-ranking-agent in scope)
- **Category sub-types** — trigger thresholds defined: broken_footpath at 200/mo, blocked at 150/mo, other at 20% of total
- **Kannada / Hindi localisation** — requires copy externalisation (§2.8) first
- **Video submissions** — not in any PRD; do not spec until explicitly requested
- **User authentication** — explicitly out of scope (anonymous submissions by design)
