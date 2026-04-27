<!-- generated-by: gsd-doc-writer -->
# bengaluru-walkability-backend

Rust/Axum REST API for the Bengaluru Walkability Public Audit. Accepts photo and GPS report submissions from citizens, stores them in PostgreSQL/PostGIS, and exposes an admin interface for moderators to triage and update report status.

Part of the [bengaluru-walkability-public-audit](../README.md) monorepo.

---

## Quick Start

```bash
cd backend
cp .env.example .env        # fill in secrets (see Environment Variables below)
cargo run                   # starts server on :3001
```

PostgreSQL with the PostGIS extension must be reachable at `DATABASE_URL` before the server starts. Migrations run automatically on startup.

---

## Available Commands

| Command | Description |
|---------|-------------|
| `cargo run` | Start the dev server on the configured port (default `3001`) |
| `cargo test` | Run all unit and integration tests |
| `cargo check` | Type-check without producing a binary |
| `cargo clippy` | Run the Rust linter |
| `cargo sqlx prepare --database-url "postgres://..."` | Regenerate compile-time SQLx query metadata after changing SQL queries |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (PostGIS extensions required) |
| `JWT_SECRET` | Yes | — | HMAC-SHA256 signing key for admin JWTs; minimum 32 characters |
| `ADMIN_SEED_EMAIL` | Yes (first boot) | — | Email for the initial admin user seeded on startup |
| `ADMIN_SEED_PASSWORD` | Yes (first boot) | — | Password for the initial admin user; no-op if admin_users already has rows |
| `POSTGRES_PASSWORD` | Yes (Docker) | — | Must match the value used when the Docker volume was first created |
| `UPLOADS_DIR` | No | `./uploads` | Filesystem path where uploaded images are stored |
| `PORT` | No | `3001` | TCP port the server listens on |
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed CORS origin; must match the frontend URL exactly |
| `PUBLIC_URL` | No | `http://localhost` | Base URL used to construct image URLs in API responses |
| `JWT_SESSION_HOURS` | No | `24` | Admin JWT session duration in hours (clamped to 1–168) |
| `COOKIE_SECURE` | No | `false` | Set to `true` in production (requires HTTPS) |

---

## API Routes

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/reports` | Submit a report (`multipart/form-data`; max 20 MB) |
| `GET` | `/api/reports` | List reports (`?page=&limit=&category=&status=`) |
| `GET` | `/api/reports/:id` | Get a single report |
| `GET` | `/api/wards/lookup` | Look up the ward for a given lat/lng |
| `GET` | `/uploads/:filename` | Serve uploaded images |

### Admin Auth (unauthenticated)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/auth/login` | Log in; sets HttpOnly `admin_token` cookie |

### Admin (JWT cookie required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/auth/logout` | Clear the session cookie |
| `GET` | `/api/admin/auth/me` | Current admin user details |
| `PATCH` | `/api/admin/auth/profile` | Update display name |
| `POST` | `/api/admin/auth/change-password` | Change password (Argon2id) |
| `GET` | `/api/admin/reports` | List reports with admin filters |
| `GET` | `/api/admin/reports/:id` | Get single report (admin view) |
| `PATCH` | `/api/admin/reports/:id/status` | Update report status |
| `DELETE` | `/api/admin/reports/:id` | Delete a report |
| `GET` | `/api/admin/stats` | Aggregate counts |
| `GET` | `/api/admin/users` | List admin users |
| `POST` | `/api/admin/users` | Create an admin user |
| `DELETE` | `/api/admin/users/:id` | Deactivate an admin user |
| `PATCH` | `/api/admin/users/:id/org` | Assign user to an organization |
| `GET` | `/api/admin/organizations` | List GBA organizations |

---

## Database Migrations

Migrations run automatically at startup via `sqlx::migrate!`. Files are in `migrations/`.

| File | Contents |
|------|----------|
| `001_init.sql` | `reports` table, `issue_category` enum, PostGIS indexes, triggers |
| `002_admin.sql` | `admin_users`, `status_history`, `user_role` enum |
| `003_super_admin.sql` | `is_super_admin BOOLEAN` column on `admin_users` |
| `004_ward_boundaries.sql` | 369 GBA ward boundaries (GBA Corporations Delimitation 2025) |
| `005_organizations.sql` | `organizations` table (self-referential adjacency list) |
| `006_ward_org_scoping.sql` | `org_id` FK on `wards` for org-scoped admin access |
| `007_anti_abuse.sql` | `photo_hash`, `duplicate_of_id`, `submitter_ip` for deduplication and rate limiting |

> The `reports.location` column (GEOGRAPHY type) is populated automatically from lat/lng via a trigger — do not set it directly.

---

## Project Structure

```
src/
├── main.rs            — Entry point: router, middleware, app state, server startup
├── config.rs          — Config struct loaded from environment variables
├── errors.rs          — Shared error types
├── models/            — SQLx row types and serde structs
├── handlers/
│   ├── admin.rs       — All /api/admin/* handler functions
│   ├── health.rs      — GET /health
│   ├── reports.rs     — Public report CRUD handlers
│   └── wards.rs       — GET /api/wards/lookup
├── db/
│   ├── queries.rs     — Public-facing SQL queries
│   ├── admin_queries.rs — Admin SQL queries
│   ├── admin_seed.rs  — Idempotent admin user seeding on startup
│   └── dedup_job.rs   — Background proximity deduplication task (5-minute poll)
├── middleware/
│   └── auth.rs        — JWT cookie validation middleware
└── migrations_tests/  — Tests verifying migration correctness
```

---

## Deployment

The backend is deployed via Docker using the `Dockerfile` in this directory. Railway config is in `railway.toml` — the health check path is `/health` with a 300-second timeout.

For full stack deployment see the root [`docker-compose.yml`](../docker-compose.yml).
