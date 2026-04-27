<!-- generated-by: gsd-doc-writer -->
# Contributing to Bengaluru Walkability Public Audit

Thank you for your interest in contributing. This is a civic-tech project — every improvement helps make Bengaluru's pedestrian infrastructure more visible and accountable. Please read this guide before opening a pull request.

---

## Development setup

See [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md) for prerequisites and first-run instructions, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the system is structured.

The short version:

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd bengaluru-walkability-public-audit

# 2. Start the database
docker compose -f docker-compose.yml -f docker-compose.dev.yml up db -d

# 3. Backend (Rust)
cd backend && cp .env.example .env && cargo run

# 4. Frontend (Next.js)
cd frontend && npm install && npm run dev
```

---

## Coding standards

The CI pipeline enforces both linters on every push and pull request. Your branch must pass both checks before it can be merged.

### Backend (Rust)

```bash
cd backend
cargo clippy -- -D warnings   # must produce zero warnings
cargo test                    # all unit tests must pass
```

Clippy is configured with `-D warnings`, meaning any warning is treated as a build error. Fix all warnings before pushing — do not use `#[allow(...)]` to suppress them without a documented reason in a code comment.

### Frontend (Next.js / TypeScript)

```bash
cd frontend
npm run lint    # Next.js ESLint (extends next/core-web-vitals)
npm test        # Jest + React Testing Library
```

ESLint config: `frontend/.eslintrc.json` (extends `next/core-web-vitals`). Test files are excluded from linting.

**Config rule:** All environment-variable-based configuration must live in `frontend/app/lib/config.ts`. Never read `process.env.*` directly in component files.

---

## TDD contribution workflow

This project enforces a strict red-green-refactor cycle. Every new feature or bug fix must follow these steps in order:

```
1. Acceptance criteria  →  Write or update failing tests that encode
                           the expected behaviour (the "red" phase).
2. Implementation       →  Write production code until all tests pass
                           (the "green" phase).
3. Refactor             →  Clean up without breaking tests.
```

**Test files are the immutable contract.** If a test fails, fix the implementation — never modify a test file to make it pass. A pull request that changes a test to remove or weaken an assertion will not be accepted.

### Where tests live

| Layer | Location | Command |
|-------|----------|---------|
| Rust unit tests | `backend/src/**` (inline `#[cfg(test)]` modules) | `cd backend && cargo test` |
| Frontend component tests | `frontend/**/__tests__/*.test.tsx` / `*.test.ts` | `cd frontend && npm test` |
| Frontend coverage | — | `cd frontend && npm run test:coverage` |

New test files follow the existing naming convention: `*.test.ts` or `*.test.tsx` inside a `__tests__/` directory adjacent to the module under test.

---

## Branch conventions

- Branch off `main` for every piece of work.
- Use short, descriptive branch names prefixed by type:
  - `feat/ward-boundary-filter`
  - `fix/exif-extraction-fallback`
  - `chore/update-dependencies`
  - `docs/contributing-guide`
- **Never commit directly to `main`.** The `main` branch is the deployed branch; changes reach it only through a merged pull request that has passed CI.

---

## PR process

1. **Open a draft PR early** if you want feedback before the work is complete.
2. **Ensure CI passes** — the `CI` workflow runs `cargo clippy`, `cargo test`, `npm run lint`, and `npm test` on every push. Merging is blocked while CI is red.
3. **Include tests** — every behaviour change must have corresponding test coverage. PRs that add untested production code will be asked to add tests before review.
4. **Keep PRs focused** — one logical change per PR. Combine unrelated fixes into separate PRs.
5. **Write a clear description** — explain what changed, why, and any decisions made along the way. If the PR closes an issue, include `Closes #<issue-number>` in the body.
6. **Respond to review comments** — address all comments or explain why a suggestion was not adopted. Resolve conversations before requesting a re-review.

---

## Reporting issues

There are no issue templates configured yet. When opening a GitHub Issue, please include:

**For bugs:**
- Steps to reproduce (be specific — include browser, OS, and device type if relevant)
- Expected behaviour
- Actual behaviour
- Relevant logs or screenshots

**For feature requests:**
- The problem or gap you are trying to solve
- Your proposed solution or approach
- Any relevant examples from other civic-tech projects

Search existing issues before opening a new one to avoid duplicates.

---

## License

By contributing to this project you agree that your contributions will be licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**, the same license that covers the rest of the codebase. See [LICENSE.md](LICENSE.md) for the full text.

The AGPL-3.0 requires that anyone who deploys a modified version of this software over a network must also make the modified source code available to users of that service. If you are unsure whether your contribution is compatible with this requirement, open an issue to discuss it first.

---

## Security audits

CI runs dependency vulnerability scans on every push and pull request. Both audits must pass before a branch can be merged.

### Backend

```bash
cd backend
cargo audit   # scans Cargo.lock against the RustSec advisory database
```

### Frontend

```bash
cd frontend
npm audit --audit-level=critical
```

The frontend audit threshold is set to `critical` rather than `high`. Several `high`-severity advisories affect the Next.js 14 release line and have no available fix within that line; the project is intentionally pinned to the latest 14.x patch. The audit still catches any newly introduced critical-severity issues. If you add a new dependency that introduces a `critical` advisory, you must resolve it before the PR can be merged.

---

## SQLx query cache

The backend uses SQLx compile-time query verification (`query!` / `query_as!` macros). These macros check your SQL against the live database schema at compile time, and they also generate an offline cache so that CI can verify queries without a running database.

**If you add or modify any SQL query**, you must regenerate the cache before pushing:

```bash
cd backend
# DATABASE_URL must point to your running local database
cargo sqlx prepare --database-url "postgres://walkability:secret@localhost:5432/walkability"
```

This writes updated metadata to `backend/.sqlx/`. Commit that directory alongside your query changes. If the cache is stale, the CI `cargo test` step will fail during offline verification.

---

## Database migrations

Schema changes are applied via SQLx migrations located in `backend/migrations/`. Migrations run automatically on backend startup via `sqlx::migrate!`.

### Adding a migration

1. Create a new file in `backend/migrations/` following the sequential naming convention:

   ```
   NNN_short_description.sql
   ```

   Example: `008_add_photo_metadata.sql`

2. Write forward-only SQL. There are no down migrations — if you need to revert, add a new migration that undoes the change.

3. PostGIS extensions (`postgis`, `pgcrypto`) are already enabled by `001_init.sql`. Do not re-create them.

4. The `reports.location` column (GEOGRAPHY type) is auto-populated from lat/lng via a database trigger. Do not write to it directly in migration SQL.

5. After writing the migration, regenerate the SQLx query cache if your migration affects any table referenced by a compile-time query (see [SQLx query cache](#sqlx-query-cache) above).

6. Verify the migration applies cleanly by restarting the backend against a fresh database:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up db -d
   cd backend && cargo run
   ```
