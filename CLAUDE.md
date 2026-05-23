# Bengaluru Walkability Public Audit

A civic-tech web app where citizens photograph and geolocate subpar pedestrian infrastructure in Bengaluru. Photos are submitted with GPS coordinates (auto-extracted from EXIF or manually pinned on a map), stored in PostgreSQL/PostGIS.

## Monorepo Structure

```
bengaluru-walkability-public-audit/
├── backend/          ← Rust (Axum) REST API, port 3001
├── frontend/         ← Next.js 14 (TypeScript, App Router), port 3000
├── nginx/
│   └── nginx.conf    ← Reverse proxy config
├── docker-compose.yml          ← Production
├── docker-compose.dev.yml      ← Local dev overrides
└── CLAUDE.md
```

## Running Locally

### Option A: Full stack with Docker Compose
```bash
cp backend/.env.example backend/.env   # fill in secrets
docker compose up --build
# Visit http://localhost
```

### Option B: Dev mode (hot reload)
```bash
# Terminal 1: database only
docker compose up db

# Terminal 2: Rust API
cd backend
cp .env.example .env            # edit DATABASE_URL etc.
cargo run

# Terminal 3: Next.js
cd frontend
npm install
npm run dev
# Visit http://localhost:3000
```

## Backend (Rust / Axum)

```bash
cd backend
cargo run                   # Start dev server on :3001
cargo test                  # Run tests
cargo check                 # Type-check without compiling
cargo clippy                # Lints

# After changing SQL queries, regenerate compile-time metadata:
cargo sqlx prepare --database-url "postgres://..."
```

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/reports | Submit a report (multipart/form-data) |
| GET | /api/reports | List reports (?page=&limit=&category=&status=) |
| GET | /api/reports/:id | Get single report |
| GET | /health | Health check |
| GET | /uploads/:filename | Serve uploaded images |
| POST | /api/admin/auth/login | Admin login (sets HttpOnly cookie) |
| POST | /api/admin/auth/logout | Admin logout |
| GET | /api/admin/auth/me | Current admin user |
| PATCH | /api/admin/auth/profile | Update display name |
| POST | /api/admin/auth/change-password | Change password (Argon2id) |
| GET/PATCH/DELETE | /api/admin/reports/* | Admin report management |
| GET | /api/admin/stats | Aggregate counts |
| GET/POST/DELETE | /api/admin/users/* | Admin user management |

### Environment Variables (backend/.env)
```
DATABASE_URL=postgres://walkability:secret@localhost:5432/walkability
UPLOADS_DIR=./uploads
PORT=3001
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=<min-32-chars>
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=<min-12-chars>
COOKIE_SECURE=false   # set true in production (HTTPS)
```

## Frontend (Next.js 14)

```bash
cd frontend
npm install
npm run dev       # Dev server on :3000
npm run build     # Production build
npm run lint      # ESLint
```

### Environment Variables (frontend/.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001   # local dev only; "" in Docker (relative URLs)
INTERNAL_API_URL=http://localhost:3001      # server-side; http://backend:3001 in Docker
```

**Config rule:** All env-var-based config must live in `frontend/app/lib/config.ts`. Never inline `process.env.*` directly in component files.

## Database

Schema applied automatically on startup via `sqlx::migrate!`. PostGIS extensions required: `postgis`, `pgcrypto`.

| Migration | Contents |
|-----------|----------|
| `001_init.sql` | `reports`, enums, indexes, triggers |
| `002_admin.sql` | `admin_users`, `status_history`, `user_role` enum |
| `003_super_admin.sql` | `is_super_admin BOOLEAN` column on `admin_users` |

The `reports.location` column (GEOGRAPHY type) is auto-populated from lat/lng via a trigger — never set it directly.

## Key Architectural Decisions

- **Rust + Axum**: Type-safe, fast, low memory footprint for a self-hosted server
- **PostGIS**: Native geospatial queries for future PWN (Priority Walking Network) analysis
- **EXIF GPS client-side**: `exifr` runs in browser — raw GPS data never sent to server, privacy-respecting
- **react-leaflet SSR caveat**: Leaflet uses `window` — all map components must be `dynamic(() => import(...), { ssr: false })`
- **Image storage**: Local filesystem behind `ServeDir` (tower-http). Abstraction-ready for S3 swap.
- **EXIF stripping server-side**: `img-parts` removes GPS metadata before writing to disk (belt-and-suspenders privacy)
- **SQLx compile-time checks**: Queries are verified against live DB at compile time; run `cargo sqlx prepare` to capture metadata for offline builds

## Git Safety Rules

These rules apply to every audit, UAT, QA, or bug-fix session in this project — regardless of which skill or command is used.

### Branch protection

Never commit code edits directly to `main`, `master`, `release-*`, or `phase-*` branches during audit/UAT/fix work.

Use a dedicated branch instead:
- `fix/<phase-or-area>-<short-description>` — for audit/UAT/bug fixes
- `hotfix/<short-description>` — for urgent production issues only

Only bypass this rule if the user explicitly says: **"Commit to this branch."**

### Required git preflight before any edit in a fix/audit/UAT session

Before editing any file, run and print all four commands:
```bash
git rev-parse --show-toplevel   # repo root
git branch --show-current       # current branch
git status --short              # uncommitted changes
git log --oneline -5            # recent context
```

Print a preflight summary:
- Repo root
- Current branch
- Whether the current branch is allowed for this work (not main/master/release-*/phase-*)
- Any uncommitted changes
- Base commit hash and message

If the current branch is forbidden: stop, propose `git checkout -b fix/<area>-<description>`, and wait for the user to confirm before editing.

### Classification required before any fix

During any audit, UAT, or QA fix session, classify ALL findings into these categories before touching any code:

| Category | Meaning | Action |
|---|---|---|
| `confirmed-bug` | Reproducible, specific file/line, testable | Safe to auto-fix |
| `pending-uat` | Not yet verified on staging/prod | **Do not fix** — verify first |
| `manual-only` | Requires design decision or user input | **Do not fix** without explicit direction |
| `config/env` | Requires environment or config change | Confirm with user |
| `not-a-bug` | Works as intended | Skip |

**Pending UAT is not a confirmed bug.** Never fix a `pending-uat` item in an automated fix session.

### Pre-commit checklist

Before every commit, show:
1. Current branch name
2. Staged files (`git diff --cached --name-only`)
3. Change summary (`git diff --cached --stat`)
4. Proposed commit message
5. Test results — exact command, exit code, pass/fail count

Never claim "tests passed" if test output was truncated or if the test runner reported "No tests found".
