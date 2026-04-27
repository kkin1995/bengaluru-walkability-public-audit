<!-- generated-by: gsd-doc-writer -->
# Development Guide

This guide covers the local development workflow, code conventions, and the patterns used to extend the backend and frontend of the Bengaluru Walkability Public Audit project.

---

## Local Setup

### Prerequisites

- Docker and Docker Compose (for the database)
- Rust (stable toolchain) — install via [rustup](https://rustup.rs/)
- Node.js 20 (see CI: `.github/workflows/ci.yml` pins Node 20)
- `cargo-watch` for hot-reload on the backend (optional but recommended)

```bash
cargo install cargo-watch
```

### Option A: Hot-reload dev stack (recommended)

Run the database in Docker and the two application servers natively for fast rebuild cycles.

```bash
# Step 1 — start only the database
docker compose -f docker-compose.yml -f docker-compose.dev.yml up db -d

# Step 2 — backend with hot reload (new terminal)
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
cargo watch -x run

# Step 3 — frontend (new terminal)
cd frontend
npm install
npm run dev
# App available at http://localhost:3000
```

The backend dev compose override (`docker-compose.dev.yml`) runs `cargo watch -x run` inside a container with `./backend` volume-mounted and a persistent `cargo_cache` volume, so rebuilds reuse the registry cache.

### Option B: Full Docker Compose stack

```bash
cp backend/.env.example backend/.env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Frontend is served at `http://localhost:3000`, the Rust API at `http://localhost:3001`. nginx runs as a reverse proxy in this mode.

---

## Build Commands

### Backend (Rust)

| Command | Description |
|---------|-------------|
| `cargo run` | Start the API server on `:3001` |
| `cargo watch -x run` | Start with hot reload on file change |
| `cargo build` | Compile without running |
| `cargo build --release` | Optimised production build |
| `cargo test` | Run all unit and static tests |
| `cargo clippy -- -D warnings` | Lint (CI enforces zero warnings) |
| `cargo check` | Type-check without producing a binary |
| `cargo audit` | Check dependencies for known CVEs |
| `cargo sqlx prepare --database-url "postgres://..."` | Regenerate SQLx offline query cache |

### Frontend (Next.js)

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on `:3000` with hot reload |
| `npm run build` | Production build |
| `npm run start` | Start production build locally |
| `npm run lint` | ESLint (next/core-web-vitals ruleset) |
| `npm test` | Jest test suite (single run) |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with coverage report |

---

## Adding a New API Route (Rust / Axum)

The backend follows a layered pattern: `main.rs` (router) → `handlers/` (Axum fns) → `db/queries.rs` (SQLx) → `models/` (types).

### 1. Add the model type

Define request/response structs in `backend/src/models/`. Use `#[derive(Debug, Deserialize)]` for inputs and `#[derive(Debug, Serialize)]` for outputs. Database rows use `#[derive(FromRow)]`.

```rust
// backend/src/models/report.rs (example pattern)
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Report { /* fields */ }

#[derive(Debug, serde::Serialize)]
pub struct ReportResponse { /* public-facing fields only */ }
```

Never include private fields (submitter contact, IP) in the response struct — privacy is enforced at compile time by simply omitting those fields from `ReportResponse`.

### 2. Write the query in `db/queries.rs`

Use `sqlx::query_as::<_, TargetType>(SQL)` with positional `$1`, `$2`, ... placeholders. SQLx validates the SQL against a live database at compile time.

```rust
pub async fn get_my_thing(pool: &PgPool, id: Uuid) -> Result<MyModel, AppError> {
    let row = sqlx::query_as::<_, MyModel>(
        "SELECT id, name FROM my_table WHERE id = $1"
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(row)
}
```

The `?` operator converts `sqlx::Error` to `AppError::Database` automatically via the `#[from]` impl in `errors.rs`.

### 3. Write the handler in `handlers/`

Handlers are `async fn` receiving Axum extractors and returning `Result<Json<T>, AppError>`. Extract `AppState` with `State(state): State<AppState>`.

```rust
// backend/src/handlers/reports.rs (pattern)
pub async fn get_my_thing(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<MyResponse>, AppError> {
    let item = queries::get_my_thing(&state.pool, id).await?;
    Ok(Json(item.into_response()))
}
```

Extract pure logic from handlers into standalone functions (no `async`, no `State`) so they can be unit tested without a database. See the `is_honeypot_triggered` and `build_rate_limit_key` helpers in `handlers/reports.rs` as the reference pattern.

### 4. Register the route in `main.rs`

Add `use handlers::mymodule::my_handler;` and wire it into the correct `Router`:

```rust
// Public route — add to the main `app` Router
.route("/api/my-resource", get(my_handler))

// Protected admin route — add to `admin_protected_router`
.route("/api/admin/my-resource", get(my_admin_handler))
```

Protected admin routes automatically receive JWT validation via the `require_auth` middleware layer applied to `admin_protected_router`.

### 5. Update `handlers/mod.rs`

Add `pub mod my_handler_module;` to `backend/src/handlers/mod.rs`.

### Error handling

Return `AppError` variants — they map to HTTP status codes automatically:

| Variant | HTTP |
|---------|------|
| `AppError::NotFound` | 404 |
| `AppError::BadRequest(msg)` | 400 |
| `AppError::Unauthorized` | 401 |
| `AppError::Forbidden` | 403 |
| `AppError::Conflict(msg)` | 409 |
| `AppError::RateLimited(msg)` | 429 |
| `AppError::Database(_)` | 500 |
| `AppError::Io(_)` | 500 |

---

## SQLx Query Workflow

SQLx verifies SQL queries against a live database at compile time. This means:

1. A running PostgreSQL instance with migrations applied is required to compile after changing any `sqlx::query*` call.
2. Before running in CI (which has no database), run `cargo sqlx prepare` to capture query metadata into `.sqlx/`:

```bash
cd backend
cargo sqlx prepare --database-url "postgres://walkability:secret@localhost:5432/walkability"
```

This writes `.sqlx/query-*.json` files that allow offline compilation. Commit these files alongside query changes.

### Adding a new migration

Place a new file in `backend/migrations/` following the numbered naming convention:

```
008_my_feature.sql
```

Migrations run automatically on server startup via `sqlx::migrate!("./migrations")`. They are applied in filename order and are irreversible — always add new `ALTER TABLE` statements rather than modifying existing migrations.

After adding a migration:
1. Start the database and apply: `cargo run` (migrations apply on boot).
2. Re-run `cargo sqlx prepare` to capture any new query metadata.

---

## Adding Frontend Pages and Components

### Pages (App Router)

Create a new directory under `frontend/app/` with a `page.tsx`:

```
frontend/app/my-page/page.tsx
```

Use `"use client"` at the top for interactive pages that need browser APIs. Omit it for server components that can fetch data on the server (like `app/page.tsx`).

### Environment-aware API calls

All API base URLs must come from `frontend/app/lib/config.ts` — never inline `process.env.*` in component files:

```typescript
// frontend/app/lib/config.ts — the only place for env-var config
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://localhost:3001";
```

Use `API_BASE_URL` for client-side public API calls and `INTERNAL_API_URL` for server-side fetches in server components.

### Map components and SSR

Leaflet requires the browser `window` object. Any component that imports from `react-leaflet` or `leaflet` must be loaded with `next/dynamic` and `ssr: false`:

```typescript
const LocationMap = dynamic(() => import("../components/LocationMap"), {
  ssr: false,
  loading: () => <div>Loading map…</div>,
});
```

Never import Leaflet components directly at the top of a server component or page module.

### UI components

Reusable UI primitives live in `frontend/app/components/ui/`. Check this directory before building a new component — `Icon`, `Pill`, `SectionLabel`, `Bi`, and `Btn` are already available. Feature-specific components go directly in `frontend/app/components/`.

---

## TDD Cycle (Red → Green → Refactor)

The project enforces a strict red-green-refactor cycle. Tests are authored before implementation and serve as the behavioural contract.

### Rules

- **Never modify test assertions.** Tests define the contract. If a test appears wrong, raise it for review — do not change the assertion.
- **Extract pure functions.** Handler logic that can be expressed without I/O (validation predicates, key builders, response formatters) must be extracted as standalone functions so they are testable without a database or HTTP stack.
- **Tests must compile in red phase.** The codebase must compile (with `todo!()` stubs or failing assertions) before implementation begins.

### Backend TDD pattern

```rust
// 1. Write the pure helper (in the handler file, outside the handler fn)
fn is_valid_category(cat: &str) -> bool {
    todo!() // red phase: compiles, panics at runtime
}

// 2. Write tests in #[cfg(test)] mod tests at the bottom of the same file
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_category_no_footpath() {
        assert!(is_valid_category("no_footpath"));
    }

    #[test]
    fn test_invalid_category_returns_false() {
        assert!(!is_valid_category("garbage"));
    }
}

// 3. Implement: replace todo!() with real logic until cargo test passes
// 4. Refactor with clippy green
```

Run tests during development:

```bash
cd backend
cargo test                          # all tests
cargo test -- --test-thread=1      # serialised output (easier to read failures)
cargo test test_valid_category      # run a specific test by name substring
```

### Frontend TDD pattern

Frontend tests use Jest + React Testing Library and live in `__tests__/` directories alongside the code they test. Test files are named `*.test.ts` or `*.test.tsx`.

```typescript
// frontend/app/__tests__/utils.test.ts (example)
import { haversineDistance } from "../lib/utils";

describe("haversineDistance", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineDistance(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0);
  });
});
```

Mock browser-only or Next.js-only modules using Jest's `moduleNameMapper` in `jest.config.js` — mocks for `react-leaflet`, `leaflet`, `next/dynamic`, and `next/font/google` are already configured.

Run tests during development:

```bash
cd frontend
npm test                  # single run, pass if no tests
npm run test:watch        # watch mode for TDD loop
npm run test:coverage     # coverage report (thresholds: 70% branches, 75% lines/fns)
```

---

## Code Style

### Rust

- Linter: `cargo clippy -- -D warnings` (CI enforces zero warnings)
- No separate formatter config — use `cargo fmt` (standard `rustfmt` defaults)
- Tracing: use `tracing::info!`, `tracing::warn!`, `tracing::error!` with structured key-value fields (not string interpolation)
- Structured log output: JSON to stderr (configured in `main.rs`)

### TypeScript / Next.js

- Linter: ESLint with `next/core-web-vitals` ruleset (`frontend/.eslintrc.json`)
- Test files are excluded from ESLint (`ignorePatterns` in `.eslintrc.json`)
- No Prettier config is present — rely on ESLint autofix for consistent style
- Run the linter: `npm run lint` from `frontend/`

### General conventions

- **Config in one place:** backend config in `backend/src/config.rs` (`Config::from_env()`); frontend config in `frontend/app/lib/config.ts`. No inline `process.env.*` or `std::env::var` outside these files.
- **Privacy by omission:** private fields (submitter name, contact, IP) are intentionally absent from public response structs — the compiler enforces this.
- **Non-fatal ward lookups:** PostGIS ward lookup failures must never block report submission — use `unwrap_or_else` to default to `None`.
- **Migration comments:** add a comment at the top of every migration explaining the requirement it satisfies (see existing migrations for the pattern).

---

## Branch Conventions

The project's branching policy:

- Commit feature work to a feature branch (e.g. `feat/my-feature`, `fix/bug-description`).
- `main` is considered deployed — merge to `main` only when deploying.
- CI (`ci.yml`) runs on all branches and PRs.

---

## PR Process

1. Ensure `cargo clippy -- -D warnings` and `cargo test` pass locally.
2. Ensure `npm run lint` and `npm test` pass locally.
3. Open a PR against `main`. CI runs frontend lint + test, backend clippy + test, and a Docker build check.
4. All three CI jobs must be green before merging.
5. CI also runs `npm audit --audit-level=critical` and `cargo audit` — address any new critical CVEs before merging.
