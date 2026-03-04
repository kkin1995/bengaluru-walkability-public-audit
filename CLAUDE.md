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
cp backend/.env.example .env   # fill in secrets
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

### Environment Variables (backend/.env)
```
DATABASE_URL=postgres://walkability:secret@localhost:5432/walkability
UPLOADS_DIR=./uploads
PORT=3001
CORS_ORIGIN=http://localhost:3000
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
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Database

Schema is in `backend/migrations/001_init.sql`. Applied automatically on backend startup via SQLx migrate.

PostGIS extensions required: `postgis`, `pgcrypto`.

The `reports.location` column (GEOGRAPHY type) is auto-populated from lat/lng via a trigger — you never set it directly.

## Key Architectural Decisions

- **Rust + Axum**: Type-safe, fast, low memory footprint for a self-hosted server
- **PostGIS**: Native geospatial queries for future PWN (Priority Walking Network) analysis
- **EXIF GPS client-side**: `exifr` runs in browser — raw GPS data never sent to server, privacy-respecting
- **react-leaflet SSR caveat**: Leaflet uses `window` — all map components must be `dynamic(() => import(...), { ssr: false })`
- **Image storage**: Local filesystem behind `ServeDir` (tower-http). Abstraction-ready for S3 swap.
- **EXIF stripping server-side**: `img-parts` removes GPS metadata before writing to disk (belt-and-suspenders privacy)
- **SQLx compile-time checks**: Queries are verified against live DB at compile time; run `cargo sqlx prepare` to capture metadata for offline builds
