<!-- generated-by: gsd-doc-writer -->
# Getting Started

This guide takes you from zero to a running local instance of the Bengaluru Walkability Public Audit stack. Two paths are available: a fully containerised Docker Compose setup (recommended) and a manual dev mode with hot-reload for active backend or frontend development.

---

## Prerequisites

### Option A: Docker Compose (recommended)

| Tool | Minimum version | Notes |
|------|----------------|-------|
| [Docker](https://docs.docker.com/get-docker/) | 24.0 | Includes Docker Compose v2 as a plugin |
| Docker Compose | v2 (plugin) | Invoked as `docker compose` (no hyphen) |

No other runtimes are required — the database, backend, and frontend all run inside containers.

### Option B: Manual dev mode

| Tool | Minimum version | Notes |
|------|----------------|-------|
| [Docker](https://docs.docker.com/get-docker/) | 24.0 | Used to run the database container only |
| [Rust](https://rustup.rs/) | 1.78 | Install via `rustup` |
| [cargo-watch](https://github.com/watchexec/cargo-watch) | any | `cargo install cargo-watch` — enables hot-reload for the backend |
| [Node.js](https://nodejs.org/) | 20 | LTS release; Next.js 14 requires Node >= 18 |
| npm | 10 | Bundled with Node.js 20 |

---

## Installation Steps

### 1. Clone the repository

```bash
git clone <repo-url>
cd bengaluru-walkability-public-audit
```

### 2. Create the backend environment file

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and replace every `CHANGEME_*` / `changeme-*` placeholder with real values. Pay attention to the fields that have **no fallback** and will cause a hard startup failure if left empty:

| Variable | What to set |
|----------|-------------|
| `POSTGRES_PASSWORD` | Any strong password — must be consistent across `DATABASE_URL` and the Docker volume |
| `DATABASE_URL` | Update the password segment to match `POSTGRES_PASSWORD` |
| `JWT_SECRET` | At least 32 characters — generate with `openssl rand -hex 64` |
| `ADMIN_SEED_EMAIL` | Email address for the first admin account |
| `ADMIN_SEED_PASSWORD` | Password for the first admin account (minimum 12 characters) |

For a full description of every variable see [docs/CONFIGURATION.md](CONFIGURATION.md).

---

## Option A: First Run with Docker Compose (recommended)

This starts all four services — database, backend API, Next.js frontend, and nginx reverse proxy — in the correct dependency order.

```bash
docker compose up --build
```

What happens on first boot:

1. PostgreSQL (with PostGIS) initialises and passes its health check.
2. The Rust/Axum binary starts, runs `sqlx::migrate!` to apply all migrations, and seeds the first admin user from `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`.
3. Next.js starts and passes its health check.
4. nginx starts and begins accepting traffic on port 80.

Once all services are healthy, open `http://localhost` in a browser.

| URL | What you see |
|-----|-------------|
| `http://localhost` | Citizen-facing landing page |
| `http://localhost/report` | 4-step report submission wizard |
| `http://localhost/map` | Public map of all reports |
| `http://localhost/admin/login` | Admin dashboard login |

To stop all services:

```bash
docker compose down
```

To stop and delete persistent data (the PostgreSQL volume and uploaded images):

```bash
docker compose down -v
```

---

## Option B: Manual Dev Mode (hot-reload)

Use three separate terminal sessions.

### Terminal 1 — Database only

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up db -d
```

PostgreSQL is now available at `localhost:5432` with the credentials from `backend/.env`.

### Terminal 2 — Rust backend (hot-reload)

```bash
cd backend
cargo run
```

The API starts on `http://localhost:3001`. On the very first run, migrations are applied automatically. To get hot-reload on file changes, install `cargo-watch` and use:

```bash
cargo watch -x run
```

### Terminal 3 — Next.js frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend is now available at `http://localhost:3000`. The dev compose override sets `NEXT_PUBLIC_API_URL=http://localhost:3001` so the browser talks directly to the Rust API without going through nginx.

---

## Common Setup Issues

### `POSTGRES_PASSWORD` not set — compose exits immediately

`docker-compose.yml` uses `${POSTGRES_PASSWORD}` with no fallback and no `:?` hard-fail guard. If the variable is missing from `backend/.env` (or the file was not copied), Docker Compose will substitute an empty string, which will cause PostgreSQL to reject connections.

**Fix:** Ensure `backend/.env` exists and `POSTGRES_PASSWORD` is set to a non-empty value.

### `JWT_SECRET must be set` error at compose start

The compose file enforces `${JWT_SECRET:?JWT_SECRET must be set...}`. A missing or empty `JWT_SECRET` in `backend/.env` causes an immediate exit.

**Fix:** Set `JWT_SECRET` to a string of at least 32 characters (e.g. `openssl rand -hex 64`).

### Frontend `.env.local` not found in manual dev mode

The frontend reads `NEXT_PUBLIC_API_URL` and `INTERNAL_API_URL` from the environment. In manual dev mode these are set by the `docker-compose.dev.yml` override when the frontend runs inside Docker. When running `npm run dev` directly on your machine without Docker, create the file manually:

```bash
# frontend/.env.local — manual dev only; do not commit
NEXT_PUBLIC_API_URL=http://localhost:3001
INTERNAL_API_URL=http://localhost:3001
```

### Port 80 already in use

nginx binds to port 80. If another process (e.g. Apache, another nginx) is already on port 80, `docker compose up` will fail with `address already in use`.

**Fix:** Stop the conflicting process, or change the host port in `docker-compose.yml` (`"80:80"` → e.g. `"8080:80"`) and access the app at `http://localhost:8080`.

### Cargo compile times on first build

The Rust backend performs a full compile from source on the first `cargo build`. This is expected and can take 2–5 minutes on a typical laptop. Subsequent builds are incremental. In Docker Compose, `cargo_cache` and `target_cache` named volumes (defined in `docker-compose.dev.yml`) persist the build cache across container restarts.

---

## Next Steps

- **Development workflow, build commands, and code style:** see [docs/DEVELOPMENT.md](DEVELOPMENT.md)
- **Running the test suite:** see [docs/TESTING.md](TESTING.md)
- **Full environment variable reference:** see [docs/CONFIGURATION.md](CONFIGURATION.md)
- **System architecture and component diagram:** see [docs/ARCHITECTURE.md](ARCHITECTURE.md)

---

## Frontend Environment File

`frontend/.env.local.example` is committed to the repository as the canonical template for frontend environment variables. When running `npm run dev` outside of Docker (Option B, Terminal 3), copy it before starting the dev server:

```bash
cp frontend/.env.local.example frontend/.env.local
```

Then open `frontend/.env.local` and add the server-side variable that is not included in the example file:

```bash
# Add this line — required for Next.js server components calling the API
INTERNAL_API_URL=http://localhost:3001
```

`frontend/.env.local` is listed in `.gitignore` and must never be committed.

---

## Staging and Production

This guide covers local development only. For staging and production deployment — including Docker image builds, Railway/Vercel configuration, environment variable secrets management, database migrations on a live instance, and rollback procedures — see [docs/DEPLOYMENT.md](DEPLOYMENT.md).
