# Bengaluru Walkability Public Audit

A citizen-driven PWA for reporting and mapping pedestrian infrastructure issues across Bengaluru. Users photograph problems — missing footpaths, broken surfaces, blocked paths, unsafe crossings, poor lighting — and submit them with GPS coordinates. Reports are stored in PostGIS and visualised on a public map.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Option A: Docker Compose (recommended)](#option-a-docker-compose-recommended)
  - [Option B: Manual dev mode](#option-b-manual-dev-mode)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Frontend Pages & Components](#frontend-pages--components)
- [Testing](#testing)
- [Engineering Workflow (TDD)](#engineering-workflow-tdd)
- [Privacy & Security Decisions](#privacy--security-decisions)

---

## Features

### Citizen-facing
- **Photo submission** — camera capture or gallery upload; JPEG/PNG/HEIC/WebP accepted
- **Client-side image compression** — Canvas API reduces files above 10 MB before upload
- **EXIF GPS extraction** — `exifr` reads GPS coordinates from photo metadata client-side; raw location data never sent separately to the server
- **Interactive map pin** — when EXIF is missing the user drops a pin on a Leaflet map; constrained to the Bengaluru bounding box
- **EXIF vs pin conflict warning** — amber banner when pin is >500 m from EXIF location
- **8 issue categories** — No Footpath, Damaged Footpath, Blocked Footpath, No Curb Ramp, Unsafe Crossing, Poor Lighting, Encroachment, Other
- **Bilingual copy** — English + Kannada throughout
- **Public map** — all reports visualised as colour-coded circle markers; click for photo popup

### Admin dashboard (`/admin`)
- **JWT auth** — HttpOnly cookie, 24-hour (configurable) sessions, Argon2id password hashing
- **Reports management** — list, filter (category, status, severity, date range), view full PII, update status, delete
- **Audit trail** — `status_history` records every `submitted → under_review → resolved` transition with optional note and actor
- **User management** — create, list, deactivate admin users
- **Statistics** — aggregate counts by status, category, severity (all enum values always present even at 0)
- **Auto-seeding** — first admin user created on startup from `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` (idempotent)

### Privacy & security
- EXIF stripped server-side via `img-parts` before writing to disk
- Public API rounds coordinates to ±111 m; exact coordinates only visible to authenticated admins
- `submitter_contact` never returned in public responses
- nginx rate-limits `POST /api/admin/login` to prevent brute-force attacks

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | [Rust](https://www.rust-lang.org/) + [Axum 0.7](https://github.com/tokio-rs/axum) |
| Database | [PostgreSQL 16](https://www.postgresql.org/) + [PostGIS 3.4](https://postgis.net/) |
| ORM / queries | [SQLx 0.7](https://github.com/launchbadge/sqlx) (async, runtime query API) |
| Frontend | [Next.js 14](https://nextjs.org/) (App Router, TypeScript) |
| Styling | [Tailwind CSS v3](https://tailwindcss.com/) |
| Maps | [Leaflet 1.9](https://leafletjs.com/) + [react-leaflet 4](https://react-leaflet.js.org/) |
| EXIF | [exifr](https://github.com/MikeKovarik/exifr) (browser-side) |
| EXIF stripping | [img-parts](https://github.com/paolobertani/img-parts) (server-side) |
| Reverse proxy | [nginx](https://nginx.org/) |
| Containers | [Docker](https://www.docker.com/) + Docker Compose |
| Backend tests | Rust built-in `#[cfg(test)]` |
| Frontend tests | [Jest 29](https://jestjs.io/) + [React Testing Library](https://testing-library.com/) |

---

## Architecture

```
┌─────────────┐     80      ┌───────────┐
│   Browser   │ ──────────▶ │   nginx   │
└─────────────┘             └─────┬─────┘
                                  │ /api/, /uploads/, /health
                            ┌─────▼──────┐        ┌──────────────┐
                            │  Backend   │ ──────▶ │  PostgreSQL  │
                            │ Rust/Axum  │         │  + PostGIS   │
                            │  :3001     │         └──────────────┘
                            └────────────┘
                                  │ /
                            ┌─────▼──────┐
                            │  Frontend  │
                            │  Next.js   │
                            │  :3000     │
                            └────────────┘
```

**Request flow for a report submission:**
1. User taps "Take Photo" → device camera opens
2. Photo selected → `exifr.gps()` runs in-browser on the original file
3. If file > 10 MB → Canvas API compresses to ≤ 10 MB before upload
4. User confirms location on a Leaflet map (auto-pinned if GPS found, manual pin otherwise)
5. User selects category and fills optional details
6. `FormData` POSTed to `/api/reports` via nginx → Axum handler
7. Server validates bounding box, strips EXIF via `img-parts`, writes JPEG to `uploads/`
8. SQLx inserts row; PostGIS trigger auto-populates `GEOGRAPHY(POINT, 4326)` column
9. Response returns rounded coordinates (3 d.p. ≈ 111 m precision)

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24 and Docker Compose v2
- (Manual mode only) Rust ≥ 1.78, Node.js ≥ 20, a local PostgreSQL instance with PostGIS

### Option A: Docker Compose (recommended)

```bash
# 1. Clone the repository
git clone <repo-url>
cd bengaluru-walkability-public-audit

# 2. Copy and fill in secrets
cp backend/.env.example .env

# 3. Build and start all services (db, backend, frontend, nginx)
docker compose up --build

# Visit http://localhost
```

The first boot runs `sqlx::migrate!` automatically — the PostGIS schema is applied before the API accepts traffic.

### Option B: Manual dev mode

```bash
# Terminal 1 — Database only
docker compose up db
# PostgreSQL is now at localhost:5432

# Terminal 2 — Rust API (hot-reloads with cargo-watch)
cd backend
cp .env.example .env          # edit DATABASE_URL if needed
cargo run
# API at http://localhost:3001

# Terminal 3 — Next.js (hot-reload)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
# App at http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Min 32 chars; HMAC-SHA256 key for admin session JWTs |
| `UPLOADS_DIR` | ✅ | — | Directory where uploaded images are written |
| `PORT` | | `3001` | HTTP port the Axum server listens on |
| `CORS_ORIGIN` | | `http://localhost:3000` | Allowed CORS origin for browser clients |
| `PUBLIC_URL` | | `http://localhost` | Base URL prepended to `image_url` in API responses |
| `JWT_SESSION_HOURS` | | `24` | Admin JWT session length in hours |
| `COOKIE_SECURE` | | `false` | Set `true` in production (requires HTTPS) |
| `ADMIN_SEED_EMAIL` | | — | Email for the first admin user (seeded on first boot if `admin_users` is empty) |
| `ADMIN_SEED_PASSWORD` | | — | Password for the first admin user (min 12 chars) |
| `RUST_LOG` | | — | Log filter (e.g. `info`; production default in docker-compose) |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | | `""` (relative) | API base URL for browser requests. Set to `http://localhost:3001` for local dev; leave empty in Docker (relative URLs via nginx proxy). Inlined at build time — pass as a Docker build arg. |
| `INTERNAL_API_URL` | | `http://localhost:3001` | Server-side API URL for SSR/RSC requests. Set to `http://backend:3001` in Docker Compose. |

> **Config rule:** All env-var-based configuration is centralized in `frontend/app/lib/config.ts`. Never read `process.env.*` directly in component files.

---

## API Reference

All endpoints are under the same origin in production (nginx proxy). In dev, the API is directly at `http://localhost:3001`.

### `POST /api/reports`

Submit a new infrastructure report.

**Content-Type:** `multipart/form-data`

| Field | Required | Type | Validation |
|-------|----------|------|-----------|
| `photo` | Yes | File (JPEG/PNG/WebP/HEIC) | Stripped of EXIF before saving |
| `lat` | Yes | float | 12.7342 – 13.1739 (Bengaluru bbox) |
| `lng` | Yes | float | 77.3791 – 77.8731 (Bengaluru bbox) |
| `category` | Yes | string | `no_footpath` · `broken_footpath` · `blocked_footpath` · `unsafe_crossing` · `poor_lighting` · `other` |
| `severity` | No | string | `low` · `medium` (default) · `high` |
| `description` | No | string | Max 500 characters |
| `name` | No | string | Max 100 characters; never returned in public API |
| `contact` | No | string | Max 200 characters; never returned in public API |
| `location_source` | No | string | `exif` · `manual_pin` (default) |

**Response `200 OK`:**
```json
{
  "id": "018f1a2b-3c4d-7e5f-9a0b-1c2d3e4f5a6b",
  "created_at": "2026-03-04T09:30:00Z",
  "image_url": "http://localhost:3001/uploads/018f1a2b.jpg",
  "latitude": 12.972,
  "longitude": 77.595,
  "category": "broken_footpath",
  "severity": "medium",
  "description": "Large open pit near the bus stop",
  "submitter_name": "Anon Citizen",
  "status": "submitted",
  "location_source": "exif"
}
```

**Error responses:**
| Status | Condition |
|--------|-----------|
| `400` | Missing photo, missing category, coordinates outside Bengaluru |
| `500` | Database or filesystem error |

---

### `GET /api/reports`

List reports with optional filtering and pagination.

**Query parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `20` | Results per page (max 100) |
| `category` | — | Filter by category value |
| `status` | — | Filter by `submitted` · `under_review` · `resolved` |

**Response `200 OK`:**
```json
{
  "page": 1,
  "limit": 20,
  "count": 3,
  "items": [ /* array of ReportResponse */ ]
}
```

---

### `GET /api/reports/:id`

Get a single report by UUID.

**Response:** `200 OK` with a `ReportResponse` object, or `404 Not Found`.

---

### `GET /health`

Health check for load balancers and orchestrators.

**Response `200 OK`:**
```json
{ "status": "ok" }
```

---

### `GET /uploads/:filename`

Serve uploaded images. Nginx caches these with a 30-day `expires` header in production.

---

### Admin API (JWT required)

All `/api/admin/*` endpoints require a valid `admin_token` HttpOnly cookie (set by `/api/admin/auth/login`).

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/auth/login` | Login — sets `admin_token` cookie |
| `POST` | `/api/admin/auth/logout` | Logout — clears cookie |
| `GET` | `/api/admin/auth/me` | Current admin user info |
| `PATCH` | `/api/admin/auth/profile` | Update display name |
| `POST` | `/api/admin/auth/change-password` | Change password (Argon2id verify + hash) |
| `GET` | `/api/admin/reports` | List reports with full PII and exact coordinates |
| `GET` | `/api/admin/reports/:id` | Get single report (admin view) |
| `PATCH` | `/api/admin/reports/:id/status` | Update report status |
| `DELETE` | `/api/admin/reports/:id` | Delete report + image file |
| `GET` | `/api/admin/stats` | Aggregate counts by status, category, severity |
| `GET` | `/api/admin/users` | List admin users |
| `POST` | `/api/admin/users` | Create admin user |
| `DELETE` | `/api/admin/users/:id` | Deactivate admin user (blocked for super-admins) |

---

## Database Schema

Schema is defined in `backend/migrations/` and applied automatically on startup.
- `001_init.sql` — public reports, enums, indexes, triggers
- `002_admin.sql` — `admin_users`, `status_history`, `user_role` enum
- `003_super_admin.sql` — `is_super_admin BOOLEAN` column on `admin_users`

### Enums

```sql
issue_category  :: no_footpath | broken_footpath | blocked_footpath
                   | unsafe_crossing | poor_lighting | other
severity_level  :: low | medium | high
report_status   :: submitted | under_review | resolved
location_source :: exif | manual_pin
```

### `reports`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` PK | `gen_random_uuid()` |
| `created_at` | `TIMESTAMPTZ` | Immutable insert timestamp |
| `updated_at` | `TIMESTAMPTZ` | Auto-touched by `trg_reports_updated_at` |
| `image_path` | `TEXT` | Filename only (`{uuid}.jpg`) |
| `latitude` | `FLOAT8` | Full precision stored |
| `longitude` | `FLOAT8` | Full precision stored |
| `location` | `GEOGRAPHY(POINT,4326)` | Auto-populated by trigger from lat/lng |
| `category` | `issue_category` | NOT NULL |
| `severity` | `severity_level` | DEFAULT `medium` |
| `description` | `TEXT` | Optional, ≤ 500 chars enforced client-side |
| `submitter_name` | `TEXT` | Optional; returned in responses |
| `submitter_contact` | `TEXT` | Optional; **never** returned in responses |
| `status` | `report_status` | DEFAULT `submitted` |
| `location_source` | `location_source` | NOT NULL |

**Indexes:** GIST on `location`, B-tree on `category`, `status`, `created_at DESC`, compound `(status, category, created_at DESC)`, partial on `submitted` reports.

### `status_history`

Audit trail for every status transition.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` PK | |
| `report_id` | `UUID` FK | Cascades on delete |
| `status` | `report_status` | NOT NULL |
| `changed_at` | `TIMESTAMPTZ` | DEFAULT NOW() |
| `note` | `TEXT` | Optional admin comment |
| `changed_by` | `UUID` FK | Admin user who made the change |

### `admin_users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` PK | `gen_random_uuid()` |
| `email` | `TEXT` UNIQUE | NOT NULL |
| `password_hash` | `TEXT` | Argon2id PHC format |
| `role` | `user_role` | `admin` · `reviewer` |
| `display_name` | `TEXT` | Optional |
| `is_active` | `BOOL` | DEFAULT `true`; set `false` to deactivate without deleting |
| `is_super_admin` | `BOOL` | DEFAULT `false`; super-admins cannot be deactivated |
| `last_login_at` | `TIMESTAMPTZ` | Updated on successful login |
| `created_at` | `TIMESTAMPTZ` | Immutable |
| `updated_at` | `TIMESTAMPTZ` | Auto-touched by trigger |

### `bus_stops` / `metro_stations`

Scaffolded for future Priority Walking Network (PWN) analysis. Each has `location GEOGRAPHY(POINT,4326)` with a GIST index and the same trigger pattern.

---

## Frontend Pages & Components

### Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Landing page — hero, CTAs, how-it-works |
| `/report` | `app/report/page.tsx` | 4-step report wizard |
| `/map` | `app/map/page.tsx` | Full-screen public map with legend |
| `/admin` | `app/admin/dashboard/page.tsx` | Stats overview (JWT-protected) |
| `/admin/reports` | `app/admin/reports/page.tsx` | Report list with filters + status updates |
| `/admin/reports/map` | `app/admin/reports/map/page.tsx` | Admin map view with status-coloured pins |
| `/admin/users` | `app/admin/users/page.tsx` | Admin user management |
| `/admin/profile` | `app/admin/profile/page.tsx` | Edit display name + change password |
| `/admin/login` | `app/admin/login/page.tsx` | Admin login |

### Report Wizard Steps

| Step | Component | Advances when |
|------|-----------|---------------|
| 0 — Photo | `PhotoCapture` | File selected and compression succeeded |
| 1 — Location | `LocationMap` | Pin inside Bengaluru bounding box |
| 2 — Category | `CategoryPicker` | One category selected |
| 3 — Details | inline form | Always (all fields optional) |

### Components

| File | Purpose |
|------|---------|
| `PhotoCapture.tsx` | Camera + gallery inputs, EXIF extraction, client-side compression |
| `LocationMap.tsx` | Draggable Leaflet marker for location confirmation |
| `CategoryPicker.tsx` | 2-column grid of 6 issue categories |
| `ReportsMap.tsx` | Read-only map of all reports with popups, retry, empty state |
| `SubmitSuccess.tsx` | Post-submission screen with share and reset actions |

### Shared Constants

`app/lib/constants.ts` exports:
```ts
BENGALURU_BOUNDS = { latMin: 12.7342, latMax: 13.1739, lngMin: 77.3791, lngMax: 77.8731 }
BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 }
```

---

## Testing

### Run all tests

```bash
# Backend unit tests (no database required)
cd backend
cargo test

# Frontend component + integration tests
cd frontend
npm test

# Frontend with coverage report
npm run test:coverage
```

### Test inventory

**Backend — 177 tests** (`cargo test`, no live DB required)

| Module | Tests |
|--------|-------|
| `models/report.rs` | Coordinate rounding, image URL construction, contact field absent from JSON |
| `models/admin.rs` | Admin user response (no password hash), JWT claims, validation helpers |
| `handlers/reports.rs` | Bengaluru bbox (all corners + just-outside edges), default field population, limit capping |
| `handlers/admin.rs` | `validate_status`, `validate_create_user_request`, `require_role`, `guard_super_admin_deactivation` pure functions |
| `middleware/auth.rs` | JWT extract/verify, expired/wrong-key/alg-none rejection, role checks |
| `config.rs` | `PUBLIC_URL` resolution |
| `db/admin_seed.rs` | `should_seed` guards, Argon2id hash format + verifiability + unique salt |

**Frontend — 535+ tests across 15+ suites** (`npm test`)

| Suite | Tests |
|-------|-------|
| `lib/__tests__/constants.test.ts` | Boundary values for `BENGALURU_BOUNDS` |
| `app/__tests__/utils.test.ts` | `haversineDistance` utility |
| `components/__tests__/CategoryPicker.test.tsx` | All 8 categories, selection styling, `onChange` |
| `components/__tests__/SubmitSuccess.test.tsx` | Share API / clipboard fallback, reset callback |
| `components/__tests__/PhotoCapture.test.tsx` | Camera trigger, EXIF extraction order, compression |
| `components/__tests__/ReportsMap.test.tsx` | Fetch lifecycle, markers, popups, error + retry |
| `components/__tests__/BilingualText.test.tsx` | English + Kannada rendering, contrast class |
| `components/__tests__/ReviewStrip.test.tsx` | Photo thumb, reverse geocode, category label |
| `app/__tests__/home-page.test.tsx` | Hero copy, trust pills, CTAs |
| `app/__tests__/report-page.test.tsx` | Full wizard flow, bbox gate, submit/error/success |
| `admin/__tests__/adminApi.test.ts` | All admin API client functions |
| `admin/__tests__/dashboard.test.tsx` | Stats cards, recent reports |
| `admin/__tests__/reports-page.test.tsx` | Report list, filters, status update |
| `admin/__tests__/users-page.test.tsx` | User list, create, deactivate (super-admin badge) |
| `admin/__tests__/profile-page.test.tsx` | Display name edit, password change, validation |
| `admin/__tests__/reports-map-page.test.tsx` | Admin map with status-coloured pins, filters |
| `admin/login/__tests__/login-page.test.tsx` | Auth flow, 401/429/5xx/network error states |

### Test infrastructure

| File | Purpose |
|------|---------|
| `frontend/jest.config.js` | jsdom environment, moduleNameMapper, babel transform, coverage thresholds |
| `frontend/jest.setup.ts` | `@testing-library/jest-dom` matchers, `URL.createObjectURL` stub, `global.fetch` stub |
| `frontend/__mocks__/reactLeaflet.js` | Stub `MapContainer`, `TileLayer`, `CircleMarker`, `Popup` (Leaflet needs a real browser) |
| `frontend/__mocks__/leaflet.js` | Stub `L.Icon.Default` |
| `frontend/__mocks__/nextDynamic.js` | Resolve dynamic imports synchronously in tests |

---

## Engineering Workflow (TDD)

All features in this project follow a strict red-green-refactor cycle:

```
1. PRD   →   prd-to-ac-converter  →  Acceptance criteria + edge case matrix
2. Tests →   tdd-test-author      →  Failing test suite (immutable contract)
3. Impl  →   impl-engineer-tdd    →  Production code that makes tests pass
```

**Test files are never modified to fix failures.** If a test fails, fix the implementation.

---

## Privacy & Security Decisions

| Decision | Rationale |
|----------|-----------|
| EXIF extracted client-side | Raw GPS metadata never travels over the network |
| EXIF stripped server-side | Belt-and-suspenders: `img-parts` removes all EXIF before writing to disk |
| Coordinates rounded to 3 d.p. in API | Public responses expose ±111 m precision, not exact location |
| `submitter_contact` excluded from all responses | Contact details are for admin follow-up only; never exposed publicly |
| Bengaluru bounding box enforced client- and server-side | Prevents junk data; server-side check is the authoritative guard |
| Images served via nginx with long-lived cache headers | Reduces backend load; images are immutable after upload |

---

## Spatial Queries (Reference)

These patterns are enabled by the PostGIS schema but not yet wired to dedicated API endpoints:

```sql
-- Reports within 500 m of a point
SELECT * FROM reports
WHERE ST_DWithin(location,
  ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 500)
ORDER BY created_at DESC;

-- Reports near transit stops (Priority Walking Network analysis)
SELECT r.*, ST_Distance(r.location, b.location) AS dist_m
FROM reports r
JOIN bus_stops b ON ST_DWithin(r.location, b.location, 300)
ORDER BY dist_m;

-- 1 km heatmap grid
SELECT ST_SnappedGrid(location::geometry, 0.01, 0.01) AS cell,
       COUNT(*) AS report_count
FROM reports
WHERE status != 'resolved'
GROUP BY cell;
```

---

## License

MIT
