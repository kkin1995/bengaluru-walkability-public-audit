<!-- refreshed: 2026-05-20 -->
# Architecture

**Analysis Date:** 2026-05-20

## System Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│                     Public Internet                                 │
│   Cloudflare Tunnel (production) OR direct HTTP (dev)              │
└───────────────────────────┬────────────────────────────────────────┘
                            │ HTTPS (prod) / HTTP:80 (dev)
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                   nginx:alpine  (port 80)                          │
│   nginx/nginx.conf (full stack)                                    │
│   nginx/nginx.server.conf (backend-only, Phase 02.4)              │
│                                                                    │
│   Routing rules:                                                   │
│     = /api/admin/auth/login → backend (rate: 5r/min, burst 3)     │
│     /api/admin/            → backend (rate: 60r/min, burst 10)    │
│     /api/                  → backend (rate: 5r/min uploads)       │
│     /uploads/              → backend ServeDir (30d cache)          │
│     /health                → backend                               │
│     /admin*                → frontend (+ security headers)        │
│     /                      → frontend (catch-all)                 │
└────────┬─────────────────────────┬─────────────────────────────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐    ┌──────────────────────────┐
│  Rust/Axum      │    │   Next.js 14 (App Router) │
│  Backend :3001  │    │   Frontend :3000           │
│  backend/src/   │    │   frontend/app/            │
└────────┬────────┘    └──────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│   PostgreSQL 16 + PostGIS 3.4 (port 5432)       │
│   image: postgis/postgis:16-3.4-alpine          │
│   Named volume: postgres_data                    │
└─────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| nginx | Reverse proxy, rate limiting, TLS termination point, security headers | `nginx/nginx.conf`, `nginx/nginx.server.conf` |
| Rust/Axum backend | REST API, image processing, auth, background jobs | `backend/src/main.rs`, `backend/src/handlers/` |
| Next.js frontend | Citizen-facing UI, admin dashboard, admin proxy route | `frontend/app/` |
| PostgreSQL + PostGIS | Persistent storage, geospatial queries, geography column | `backend/migrations/` |
| Admin proxy route | Forwards `/api/admin/*` from Next.js to Rust, preserving cookies | `frontend/app/api/admin/[...path]/route.ts` |
| Dedup background job | Proximity deduplication polling every 5 min | `backend/src/db/dedup_job.rs` |
| Cloudflare Tunnel | Public HTTPS ingress for self-hosted desktop (Phase 02.4) | `docker-compose.server.yml`, `DEPLOYMENT.md` |

## Request Flow: Public Report Submission

1. Browser submits multipart/form-data POST to `/api/reports`
2. nginx rate-limits (5 req/min zone=upload, POST-only) and proxies to `backend:3001`, injecting `X-Real-IP`
3. `create_report` handler (`backend/src/handlers/reports.rs`) processes multipart fields:
   a. Checks honeypot `website` field (ABUSE-02) — returns fake 200 if triggered
   b. Computes SHA256 of raw bytes, checks `photo_hash` uniqueness (ABUSE-03)
   c. Validates Bengaluru bounding box (lat 12.7342–13.1739, lng 77.3791–77.8731)
   d. Checks per-IP+geohash-6 rate limiter (ABUSE-01, 2 reports/hour)
   e. Looks up ward via PostGIS `ST_Within` (`backend/src/db/queries.rs`)
   f. Strips EXIF from JPEG bytes using `img-parts` (privacy, belt-and-suspenders)
   g. Writes EXIF-stripped file to `uploads/` volume as UUID.jpg
   h. Inserts row into `reports` table; PostGIS trigger auto-populates `location` column
4. Backend returns `ReportResponse` JSON (lat/lng rounded to 3dp, no PII fields)

## Request Flow: Admin Dashboard

1. Admin browser navigates to `/admin/*` (served by Next.js via nginx)
2. `AdminLayout` server component (`frontend/app/admin/layout.tsx`) reads `admin_token` cookie, calls `INTERNAL_API_URL/api/admin/auth/me` server-side to verify session; redirects to `/admin/login` on failure
3. Client-side admin pages call relative `/api/admin/*` URLs
4. Next.js API proxy route (`frontend/app/api/admin/[...path]/route.ts`) receives call, forwards to `INTERNAL_API_URL/api/admin/...` (Docker internal: `http://backend:3001`; Vercel/production: Cloudflare tunnel URL), forwarding the `admin_token` cookie and propagating `Set-Cookie` on response
5. Rust admin handlers (`backend/src/handlers/admin.rs`) are behind `require_auth` middleware, which validates the `admin_token` JWT cookie

## Auth Architecture

**Token type:** HS256 JWT stored as HttpOnly cookie named `admin_token`

**Claims:** `{ sub: UUID, email: string, role: "admin"|"reviewer", exp: unix_timestamp }`

**Login flow:**
1. POST `/api/admin/auth/login` with `{email, password}` JSON body
2. Handler fetches `admin_users` row by email, verifies Argon2id hash
3. Issues JWT signed with `JWT_SECRET` (env var, min 32 chars), expiry = `JWT_SESSION_HOURS` (default 24, clamp 1–168)
4. Sets `admin_token` cookie with `HttpOnly=true`, `SameSite=Strict`, `Secure=true` (production), `Path=/`

**Middleware:** `require_auth` (`backend/src/middleware/auth.rs`) — Tower middleware that:
- Reads `admin_token` cookie from request
- Calls `extract_claims()` pure function: validates HS256 signature, rejects `alg:none`, rejects expired tokens
- Injects `JwtClaims` into request extensions for downstream handlers
- All protected admin routes sit behind this layer via `.layer(axum::middleware::from_fn_with_state(arc_state.clone(), require_auth))` in `main.rs`

**Role gating:** `require_role()` pure function — `admin` is a superset of `reviewer`. Role checked inside handlers where needed.

**Super-admin:** Single `is_super_admin BOOLEAN` column on `admin_users`. Set only by `backend/src/db/admin_seed.rs` (env-seeded first user). Cannot be set via API (`api_create_can_set_super_admin()` always returns false). Super-admin cannot be deactivated (`guard_super_admin_deactivation()` enforced before any DB mutation).

**Password storage:** Argon2id via `argon2` crate. Never returned in any API response (compile-time guarantee: `AdminUserResponse` struct has no `password_hash` field).

## Image Handling Pipeline

```
Browser
  │
  ├── User selects photo (frontend/app/components/PhotoCapture.tsx)
  │
  ├── Client-side EXIF extraction: `exifr` library reads GPS from EXIF in-browser
  │     → lat/lng pre-populated in form (privacy: raw GPS never sent as separate field)
  │
  ├── User submits multipart/form-data with: photo bytes, lat, lng, category, severity, etc.
  │
  └── backend/src/handlers/reports.rs (create_report)
        │
        ├── SHA256 hash computed on RAW bytes BEFORE stripping (for duplicate detection)
        │
        ├── strip_exif(): img-parts removes EXIF APP1 segment from JPEG bytes
        │     Falls back to original bytes if JPEG parsing fails
        │
        ├── EXIF-stripped bytes written to backend/uploads/<UUID>.jpg
        │
        └── image_url constructed as: {PUBLIC_URL}/uploads/<UUID>.jpg
```

Client-side EXIF extraction means GPS coordinates are user-confirmable/overridable before submission. Server-side EXIF stripping (`img_parts::jpeg::Jpeg::set_exif(None)`) is a belt-and-suspenders privacy control ensuring GPS never persists on disk.

## PostGIS Geography Column and Location Trigger

Migration `backend/migrations/001_init.sql` defines:

```sql
location GEOGRAPHY(POINT, 4326) NOT NULL
```

This column is **never set directly by application code**. A `BEFORE INSERT OR UPDATE` trigger auto-populates it:

```sql
CREATE TRIGGER trg_set_report_location
BEFORE INSERT OR UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION set_location_from_lat_lng();
-- set_location_from_lat_lng: ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography
```

The application only stores `latitude` and `longitude` as `FLOAT8` columns. The `GEOGRAPHY` column is maintained by the DB and used exclusively for geospatial queries (`ST_DWithin` for proximity dedup, `ST_Within` for ward lookup).

Spatial index: `idx_reports_location ON reports USING GIST(location)` — enables fast proximity queries.

## Data Models

### `reports` table (migrations 001, 007)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `created_at` / `updated_at` | TIMESTAMPTZ | `updated_at` maintained by trigger |
| `image_path` | TEXT | Filename only (UUID.jpg); URL built at runtime from `PUBLIC_URL` |
| `latitude`, `longitude` | FLOAT8 | Raw coordinates stored at full precision; rounded to 3dp in API response |
| `location` | GEOGRAPHY(POINT, 4326) | Auto-set by trigger; never written by app |
| `category` | `issue_category` enum | no_footpath, broken_footpath, blocked_footpath, unsafe_crossing, poor_lighting, other |
| `severity` | `severity_level` enum | low, medium, high |
| `status` | `report_status` enum | submitted, under_review, resolved |
| `location_source` | `location_source` enum | exif, manual_pin |
| `ward_id` | UUID FK → wards | Nullable; set at creation via PostGIS lookup |
| `photo_hash` | TEXT | SHA256 hex; unique index (WHERE NOT NULL) for exact duplicate detection |
| `duplicate_of_id` | UUID FK self | Points to original report; NULL = original |
| `duplicate_count` | INT | Count of reports linked to this one |
| `duplicate_confidence` | TEXT | 'low' or 'high' (high when ≥2 distinct IPs) |
| `submitter_ip` | TEXT | Admin-only; never in public API response |
| `submitter_name`, `submitter_contact` | TEXT | Nullable; excluded from `ReportResponse` (privacy) |

Rust struct: `backend/src/models/report.rs` — `Report` (DB row), `ReportResponse` (API shape), `CreateReportRequest` (multipart form parse target).

### `admin_users` table (migrations 002, 003, 005)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `email` | TEXT UNIQUE | |
| `password_hash` | TEXT | Argon2id; NEVER in any API response |
| `role` | `user_role` enum | admin, reviewer |
| `is_active` | BOOLEAN | Soft-delete; super-admin cannot be deactivated |
| `is_super_admin` | BOOLEAN NOT NULL DEFAULT FALSE | Set only by seed; immutable via API |
| `org_id` | UUID FK → organizations | Nullable; scopes report visibility to org's ward subtree |
| `last_login_at` | TIMESTAMPTZ | Updated on each successful login |

Rust struct: `backend/src/models/admin.rs` — `AdminUser` (DB row), `AdminUserResponse` (API shape, omits `password_hash`).

### `status_history` table (migration 001, amended by 002)

Audit trail for every status transition on a report. Columns: `id`, `report_id`, `old_status`, `new_status`, `changed_at`, `note`, `changed_by` (FK → `admin_users`).

### `organizations` table (migration 005)

Self-referential adjacency list: GBA → corporation → ward_office. Used to scope admin visibility. `org_type` enum: `'gba'`, `'corporation'`, `'ward_office'`.

### `wards` table (migration 004)

Ward boundary polygons (GeoJSON source in `data/`). `org_id` FK → organizations added in migration 006 for org-scoped report access.

## Anti-Abuse Architecture

Four independent layers operating in `create_report` and as a background job:

1. **ABUSE-01 — Rate limiter** (`governor` crate): Per-IP+geohash-6 key, 2 submissions/hour. Applied after bounding box validation. Key format: `"{ip}:{geohash6}"`. `governor::DefaultKeyedRateLimiter<String>` shared via `Arc` in `AppState`.

2. **ABUSE-02 — Honeypot**: Hidden `website` form field. If non-empty, handler returns a fake `ReportResponse` (nil UUID) without any DB write or visible error signal.

3. **ABUSE-03 — Photo hash deduplication**: SHA256 of raw photo bytes computed before EXIF strip. If `photo_hash` already exists in DB → fake success. Unique index `idx_reports_photo_hash` (WHERE photo_hash IS NOT NULL) enforces uniqueness.

4. **ABUSE-04 — Proximity dedup job** (`backend/src/db/dedup_job.rs`): Tokio background task spawned at startup, polling every 5 minutes. Uses `ST_DWithin(..., 50.0)` to find unlinked reports within 50m of same-category open reports; links via `duplicate_of_id`. Sets `duplicate_confidence` to 'high' when ≥2 distinct submitter IPs.

## Phase 02.4: Self-Hosted Infrastructure (Arch Linux + Cloudflare Tunnel)

Phase 02.4 decommissioned Railway in favor of a self-hosted desktop deployment:

- **`docker-compose.server.yml`** — Compose override: removes frontend as blocking nginx dependency (`required: false`), mounts `nginx/nginx.server.conf`, parks frontend behind `frontend-only` profile.

- **`nginx/nginx.server.conf`** — Backend-only nginx config. No `upstream frontend`. All non-API/non-upload routes return 404. Identical rate-limiting zones to `nginx.conf`.

- **Cloudflare Tunnel**: `cloudflared` systemd service routes public HTTPS to `localhost:80`. Full setup in `DEPLOYMENT.md`.

- **`.github/workflows/deploy.yml`**: 3-job pipeline: `ci` (GitHub-hosted) → `deploy` (self-hosted runner `walkability-prod` on Arch Linux desktop) → `smoke-test` (verifies `vars.BACKEND_URL/health` and `vars.BACKEND_URL/api/reports`).

- **Vercel frontend** calls backend via the Cloudflare tunnel URL set in `NEXT_PUBLIC_API_URL` and `INTERNAL_API_URL` Vercel env vars. These must match `vars.BACKEND_URL` and `vars.CORS_ORIGIN` in GitHub Actions exactly.

## Architectural Constraints

- **Threading:** Tokio async runtime. No worker threads beyond Tokio's thread pool. Rate limiter (`Arc<governor::DefaultKeyedRateLimiter<String>>`) is `Clone + Send + Sync`.
- **Global state:** `AppState` struct cloned per-request by Axum. No mutable global state. Defined in `backend/src/main.rs`.
- **CORS:** `allow_credentials(true)` is incompatible with wildcard origin; only the exact `CORS_ORIGIN` value is accepted. Mismatch causes silent admin login failure (no cookie set).
- **SSR caveat:** Leaflet uses `window` — all map components must use `dynamic(() => import(...), { ssr: false })`. See `frontend/app/report/page.tsx` (LocationMap import) and `frontend/app/components/ReportsMap.tsx`.
- **Cookie domain:** In production, `admin_token` cookie is set on the backend domain (Cloudflare tunnel URL). The Next.js admin proxy route (`frontend/app/api/admin/[...path]/route.ts`) explicitly forwards `Set-Cookie` headers. Using Next.js `rewrites()` instead silently drops cookies.
- **Coordinate order:** `geohash::encode` takes `Coord { x: longitude, y: latitude }` (NOT lat, lng). Unit tests in `backend/src/handlers/reports.rs` guard this regression.
- **SQLx compile-time checks:** Queries verified against live DB at compile time. Run `cargo sqlx prepare --database-url "..."` after any SQL changes to regenerate `.sqlx/` metadata for offline builds.
- **Body limit:** nginx `client_max_body_size 20M` and Axum `DefaultBodyLimit::max(20 * 1024 * 1024)` must stay in sync to handle 3–5 MB iPhone JPEGs.

## Anti-Patterns

### Direct `process.env.*` in component files

**What happens:** Component reads `process.env.NEXT_PUBLIC_API_URL` directly outside `config.ts`.
**Why it's wrong:** Creates scattered, untestable env coupling; baked-at-build-time values become invisible.
**Do this instead:** All env-var config must go through `frontend/app/lib/config.ts` exports (`API_BASE_URL`, `ADMIN_API_BASE_URL`, `INTERNAL_API_URL`).

### Setting `location` column directly

**What happens:** Application code tries to INSERT/UPDATE `reports.location`.
**Why it's wrong:** The `trg_set_report_location` trigger overwrites it from `latitude`/`longitude` anyway.
**Do this instead:** Only set `latitude` and `longitude`. The trigger handles `location` automatically.

### Using Next.js `rewrites()` for admin API proxy

**What happens:** Admin API calls routed via Next.js `rewrites()` in `next.config.mjs`.
**Why it's wrong:** Next.js silently drops `Set-Cookie` response headers in rewrites, breaking admin login.
**Do this instead:** Use the catch-all API route handler at `frontend/app/api/admin/[...path]/route.ts`.

## Error Handling

**Strategy:** Typed `AppError` enum (`backend/src/errors.rs`) with `IntoResponse` implementation:

| Variant | HTTP Status |
|---------|-------------|
| `Unauthorized` | 401 |
| `Forbidden` | 403 |
| `NotFound` | 404 |
| `BadRequest(String)` | 400 |
| `RateLimited(String)` | 429 |
| `Internal` | 500 |

Ward lookup failure is non-fatal: `unwrap_or_else` returns `None` and logs a warning; report submission continues without ward assignment.

## Cross-Cutting Concerns

**Logging:** `tracing` + `tracing_subscriber` with JSON format written to stderr. Structured fields include `request_id`. nginx adds `X-Request-ID` header forwarded to backend for log correlation. Level controlled by `RUST_LOG` env var.

**Request tracing:** `request_id_middleware` in `backend/src/main.rs` propagates `X-Request-ID` through the Axum stack and echoes it in the response.

**Validation:** Pure helper functions in `backend/src/models/admin.rs` (`validate_password_length`, `validate_email_format`, `validate_role`, `validate_display_name`, `validate_new_password`) — no I/O, fully unit-tested.

**Privacy:** Submitter name, contact, and IP never appear in public `ReportResponse`. Lat/lng rounded to 3 decimal places (~111m precision) in `Report::into_response()`. EXIF stripped server-side before disk write.

---

*Architecture analysis: 2026-05-20*
