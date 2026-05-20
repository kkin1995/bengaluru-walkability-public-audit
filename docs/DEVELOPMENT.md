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

This writes `.sqlx/query-*.json` files that allow offline compilation. Commit these files alongside query changes. The `backend/.sqlx/` directory does not exist in the repository yet — it must be generated by running `cargo sqlx prepare` against a live database before CI offline builds will succeed.

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

---

## Jest Test Environments

The frontend Jest configuration (`frontend/jest.config.js`) splits the test suite into two isolated projects to handle the differing runtime requirements of Next.js middleware and regular component tests.

### Project 1: middleware (node environment)

`frontend/__tests__/middleware.test.ts` runs under the `node` test environment. This is required because `next/server` depends on Web Fetch API globals (`Request`, `Response`, `Headers`) that `jsdom` does not provide but Node.js 18+ supplies natively. A separate setup file (`jest.setup.node.ts`) is used for this project — the main `jest.setup.ts` references `window` and `HTMLCanvasElement` APIs that are absent in the node environment.

### Project 2: jsdom (all other tests)

All other test files run under the `jsdom` environment with `jest.setup.ts`. The following mocks are pre-configured via `moduleNameMapper` and are available to all jsdom tests:

| Mock target | Mock file | Reason |
|---|---|---|
| `react-leaflet` | `__mocks__/reactLeaflet.js` | Leaflet requires a real browser DOM |
| `leaflet` | `__mocks__/leaflet.js` | Required by `ReportsMap` via `require()` |
| `next/dynamic` | `__mocks__/nextDynamic.js` | Renders the wrapped component synchronously |
| `next/font/google` | `__mocks__/next/font/google.js` | Font loading is build-time only |
| `next/navigation` | `__mocks__/next/navigation.js` | App Router hooks require a mounted router context |
| CSS/SCSS imports | `__mocks__/styleMock.js` | Prevents parse errors from Tailwind imports |

When writing tests that use App Router navigation hooks (`useRouter`, `usePathname`, `useSearchParams`), import from `next/navigation` as normal — the mock provides stub implementations that satisfy the invariant checks Next.js performs at runtime.

### Adding a new mock

If a module causes test failures with "invariant" errors or missing globals, add a manual mock:

1. Create `frontend/__mocks__/<module-name>.js` (or `__mocks__/<scope>/<module>.js` for scoped packages).
2. Add a `moduleNameMapper` entry in `frontend/jest.config.js` pointing to the mock file.
3. The mock must export the same shape as the real module (at minimum the symbols used by the tests).

---

## Migration SQL Tests

Some migrations introduce significant schema logic (PostGIS spatial indexes, self-referential foreign keys, trigger functions) that should be verified without requiring a live database. The project uses a pattern of SQL string tests located in `backend/src/migrations_tests/`.

Each file in that directory corresponds to one migration and uses `include_str!` to load the raw SQL file, then asserts on its content:

```rust
// backend/src/migrations_tests/test_005_migration.rs
#[cfg(test)]
mod tests {
    #[test]
    fn migration_005_has_organizations_table() {
        let sql = include_str!("../../migrations/005_organizations.sql");
        assert!(
            sql.contains("CREATE TABLE organizations"),
            "005 migration must CREATE TABLE organizations"
        );
    }
}
```

These tests run as part of `cargo test` and require no database connection. They catch accidental edits to migration files and serve as executable documentation of the schema contract.

### When to add a migration SQL test

Add a test file in `backend/src/migrations_tests/` when a migration:

- Creates a table with non-obvious column constraints (e.g. nullable self-referential FK, GEOGRAPHY type)
- Adds a PostGIS spatial index or trigger
- Introduces a new enum variant that affects application logic
- Contains a SQL constant shared with application code (e.g. the dedup job's radius)

Register the new module in `backend/src/migrations_tests/mod.rs` and in `backend/src/main.rs` (`mod migrations_tests;` is already present).

---

## Background Jobs

The backend spawns a proximity deduplication job at startup (`backend/src/db/dedup_job.rs`). It runs in a detached Tokio task and requires no external queue or scheduler.

### Dedup job

The job fires every 5 minutes and scans reports created in the last 15 minutes that have not yet been linked as duplicates. For each candidate it queries PostGIS for an existing open report of the same category within 50 metres. If a match is found, the candidate is atomically linked to the parent (`duplicate_of_id`) and the parent's `duplicate_count` is incremented in the same transaction.

Confidence is upgraded to `'high'` when two or more distinct `submitter_ip` values have reported the same location, which reduces the likelihood of a single actor inflating the count.

The SQL constants used by the job (`FIND_NEARBY_OPEN_REPORT_SQL`, `LINK_DUPLICATE_SQL`, `INCREMENT_DUPLICATE_COUNT_SQL`) are exposed as `pub const` values so they can be unit-tested without a database — see `backend/src/db/dedup_job.rs` `#[cfg(test)]` block.

### Adding a new background job

1. Create a new file in `backend/src/db/` (e.g. `my_job.rs`) with a public `async fn run_my_job_loop(pool: Arc<PgPool>)` entry point that loops with `tokio::time::interval`.
2. Expose SQL constants as `pub const` at module level so they can be covered by unit tests without a database.
3. Register the module in `backend/src/db/mod.rs`.
4. Spawn the task in `main.rs` alongside the existing dedup spawn:

```rust
tokio::spawn(db::my_job::run_my_job_loop(pool.clone()));
```

---

## Pre-PR Checklist

Before opening a pull request, run through this checklist to avoid CI failures:

1. **Confirm branch** — verify you are not on `main` (`git branch --show-current`).
2. **Frontend tests** — `cd frontend && npm test` — fix any `next/navigation` mock issues if new App Router hooks were added.
3. **Backend audit** — `cd backend && cargo audit` — if a new RUSTSEC advisory appears for a dependency that has no fix available, add its ID to the `[advisories]` ignore list in `backend/.cargo/audit.toml` with a comment explaining the status.
4. **Environment file** — confirm `frontend/.env.local` exists and that `DATABASE_URL` (if set) has a single `postgres://` prefix.
5. **Clippy** — `cd backend && cargo clippy -- -D warnings` must exit 0.
6. **Lint** — `cd frontend && npm run lint` must exit 0.

All six checks must be green before the PR is opened. CI enforces the same checks and will block merge if any fail.

---

## Bilingual UI Conventions

All user-visible strings in the frontend must be available in both English and Kannada. The project uses a flat translation map in `frontend/app/lib/translations.ts` and the `Bi` primitive component.

### Adding a new string

Add the string to the `t` object in `frontend/app/lib/translations.ts` as a `{ en: string; kn: string }` pair:

```typescript
// frontend/app/lib/translations.ts
export const t = {
  myNewLabel: { en: "My Label", kn: "ನನ್ನ ಲೇಬಲ್" },
  // ...
};
```

For category labels, also add a mapping in `CATEGORY_LABEL_MAP` within the same file.

### Using the `Bi` component

`Bi` renders English text stacked above Kannada text using the `.bi`, `.bi-en`, and `.bi-kn` CSS classes defined in `frontend/app/globals.css`:

```typescript
import { Bi } from "@/app/components/ui/Bi";

// Renders English on top, Kannada below — both in one span
<Bi en="No path" kn="ಕಾಲ್ದಾರಿ ಇಲ್ಲ" />

// Style prop accepted for inline overrides (used in CategoryGrid)
<Bi en="No path" kn="ಕಾಲ್ದಾರಿ ಇಲ್ಲ" style={{ fontSize: 13, fontWeight: 600 }} />
```

The older `BilingualText` component (`frontend/app/components/BilingualText.tsx`) uses Tailwind class props and is still present for legacy pages. New components should use `Bi` instead.

### Conventions

- Never hardcode English-only strings in JSX that a citizen would read. Admin-only UI strings (dashboard labels, error messages) may be English-only.
- The Kannada translation (`kn` prop on `Bi`) is optional — if omitted, only the English span is rendered.
- Do not use `getCategoryLabel()` from `translations.ts` inside `CategoryGrid` or `SeverityGrid` — those components use shorter inline labels intentionally (per UI spec).

---

## Admin Dashboard API Client Pattern

The admin dashboard uses a different API base URL strategy from the public-facing report submission flow. Understanding the split prevents cookie and CORS issues when developing admin features.

### Two API base URLs

`frontend/app/lib/config.ts` exports three constants:

| Constant | Value | Used for |
|---|---|---|
| `API_BASE_URL` | `NEXT_PUBLIC_API_URL` env var (or `""`) | Client-side public endpoints (`/api/reports`, `/api/wards/lookup`) |
| `ADMIN_API_BASE_URL` | Always `""` (empty string) | Client-side admin endpoints (`/api/admin/*`) |
| `INTERNAL_API_URL` | `INTERNAL_API_URL` env var (or `http://localhost:3001`) | Server-side fetches in server components and Next.js rewrites |

`ADMIN_API_BASE_URL` is hardcoded to `""` (relative URLs) because admin requests must always flow through the Next.js rewrite proxy — never directly to the backend — so that the `admin_token` HttpOnly cookie is scoped to the Next.js domain.

### Next.js rewrite proxy for admin routes

`frontend/next.config.mjs` rewrites all `/api/admin/*` paths to the backend:

```javascript
// frontend/next.config.mjs
async rewrites() {
  const backendUrl = process.env.INTERNAL_API_URL || "http://localhost:3001";
  return [
    { source: "/api/admin/:path*", destination: `${backendUrl}/api/admin/:path*` },
  ];
},
```

This means client-side admin API calls use relative paths (e.g. `fetch("/api/admin/reports")`), which Next.js proxies server-side to the Rust backend. The `Set-Cookie: admin_token` response header is then scoped to the Next.js host, making the cookie readable by `middleware.ts` and `app/admin/layout.tsx`.

**Do not** change `ADMIN_API_BASE_URL` to point directly at `http://localhost:3001` — that would break cookie-based auth in all deployment environments.

### Admin API client (`adminApi.ts`)

All admin fetch calls are defined in `frontend/app/admin/lib/adminApi.ts`. Every function must include `credentials: "include"` so the browser sends the `admin_token` cookie:

```typescript
// frontend/app/admin/lib/adminApi.ts (pattern)
import { ADMIN_API_BASE_URL as BASE } from "@/app/lib/config";

export async function getAdminReports(): Promise<AdminReport[]> {
  const res = await fetch(`${BASE}/api/admin/reports`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### `middleware.ts` auth guard

`frontend/middleware.ts` runs on the Edge for all `/admin/*` paths. It checks for the `admin_token` cookie and redirects to `/admin/login` if absent. It also injects an `x-pathname` response header so the server-side `admin/layout.tsx` can read the current path without client-side JavaScript.

When writing tests for the middleware, note that it runs under the `node` Jest environment — see the Jest Test Environments section above.

---

## Ward Data and Seed Workflow

Migration `004_ward_boundaries.sql` populates the `wards` table with 369 BBMP ward polygons derived from the GBA Corporations Delimitation 2025 dataset. This is the largest migration (~2 MB of INSERT statements) and has specific handling requirements.

### Source data

The authoritative GeoJSON source is `data/gba_wards_2025.geojson`. The INSERT statements embedded in `004_ward_boundaries.sql` were generated from this file. Do not edit either file independently — if the ward data needs updating, regenerate the migration from the GeoJSON.

### Ward lookup endpoint

`GET /api/wards/lookup?lat={lat}&lng={lng}` returns the ward containing a given coordinate:

```json
{ "ward_number": 42, "ward_name": "Shivajinagar" }
```

The handler is `backend/src/handlers/wards.rs`. Only `ward_number` and `ward_name` are exposed — the internal UUID and corporation name are intentionally omitted from the public response (see `WardLookupResponse` vs `Ward` model).

### PostGIS coordinate order

PostGIS `ST_MakePoint` takes `(longitude, latitude)` — X,Y order, the opposite of the conventional lat/lng pair. All ward queries in `db/queries.rs` bind `lat` as `$1` and `lng` as `$2`, then call `ST_MakePoint($2, $1)`. This is documented in each query function. Do not change the bind order without updating the comment.

### Organization scoping (migrations 005 and 006)

Migrations `005_organizations.sql` and `006_ward_org_scoping.sql` add an organization hierarchy (`organizations` table) and link both `admin_users` and `wards` to it via nullable `org_id` columns. At migration time these columns are `NULL` for all rows — org data is populated out-of-band after the GBA org structure is confirmed.

When `org_id` is `NULL` on a ward, org-scoped admin users see zero reports for that ward. This is the correct behavior during the initial rollout period, not a bug.
