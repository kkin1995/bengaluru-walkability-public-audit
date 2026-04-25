<!-- generated-by: gsd-doc-writer -->
# Testing

This project maintains two separate test suites — a Rust unit test suite in the backend and a Jest/React Testing Library suite in the frontend — that together enforce correctness from HTTP-handler validation logic through to rendered UI components.

---

## Backend Tests (Rust)

### Framework and Setup

The backend uses Rust's built-in `#[cfg(test)]` modules. No external test framework is required. Because all tests exercise pure, synchronous business logic rather than live SQL queries, **no database connection is needed** to run the suite. SQL queries use `sqlx::query_as` at runtime (not compile-time macros), so `cargo test` works in isolation.

### Running Backend Tests

```bash
cd backend
cargo test
```

Run a specific test by name:

```bash
cargo test test_bengaluru_bounds_valid_center
```

Run all tests in a specific module:

```bash
cargo test handlers::reports::tests
```

Type-check the project without compiling a test binary:

```bash
cargo check
```

Lint with Clippy:

```bash
cargo clippy
```

### Test Architecture

Tests live inside `#[cfg(test)] mod tests { ... }` blocks at the bottom of each source file they cover. The suite targets pure, synchronous functions only; async Axum handlers that require a live HTTP routing stack and database are not tested here.

| File | Focus | Approx. tests |
|---|---|---|
| `src/handlers/reports.rs` | Bengaluru bounding-box validation, limit clamping (0–200), default field values, honeypot detection, rate-limit key format, geohash coordinate order | 35 |
| `src/models/admin.rs` | `AdminUser` → `AdminUserResponse` serialization, password-hash exclusion, `is_super_admin` mapping, login/change-password request deserialization, password/email/role/display-name validation, JWT claims round-trip, `StatsResponse` serialization, status-update validation, super-admin guard | 61 |
| `src/middleware/auth.rs` | JWT extraction (none/empty/malformed/wrong-secret/expired/alg-none/valid), role requirement checks | 12 |
| `src/db/admin_queries.rs` | Admin query data-mapping helpers | 15 |
| `src/db/queries.rs` | Ward-lookup query helpers | 5 |
| `src/config.rs` | `PUBLIC_URL` env-var defaulting logic | 4 |
| `src/migrations_tests/test_004_migration.rs` | Migration 004 SQL content: `wards` table DDL, 369 ward inserts, `ST_Multi` cast, GIST index | 4+ |
| `src/migrations_tests/test_005_migration.rs` | Migration 005 SQL content | 4+ |

Key design decisions visible in the backend tests:

- **Pure-function isolation.** Every tested function has no I/O. Handler tests call helpers (`is_in_bengaluru`, `effective_limit`, `build_rate_limit_key`) extracted from the async handler bodies.
- **Red-phase stubs.** Some files (e.g., `handlers/admin.rs`) contain `todo!()` bodies that make tests fail by design until the implementation is filled in. The comment in each file states the contract — do not edit test assertions independently.
- **Migration SQL tests.** `migrations_tests/` reads migration SQL files with `include_str!()` and asserts on their content (table names, constraint names, insert counts). This catches SQL typos without a live PostGIS instance.

### Coverage

No automated coverage threshold is configured for the backend. Coverage is enforced through code review: every pure helper function added to a handler or model must have a corresponding `#[test]` in the same file.

---

## Frontend Tests (Jest + React Testing Library)

### Framework and Setup

| Tool | Version | Purpose |
|---|---|---|
| `jest` | `^29.7.0` | Test runner and assertion library |
| `jest-environment-jsdom` | `^29.7.0` | Browser DOM simulation |
| `@testing-library/react` | `^14.3.1` | Component rendering utilities |
| `@testing-library/jest-dom` | `^6.9.1` | DOM-specific matchers |
| `@testing-library/user-event` | `^14.6.1` | Realistic user interaction simulation |
| `babel-jest` | `^29.7.0` | TypeScript/JSX transpilation via `next/babel` |

### Running Frontend Tests

```bash
cd frontend
npm test               # run full suite (pass with no tests)
npm run test:watch     # interactive watch mode
npm run test:coverage  # collect coverage report
```

Run a single test file:

```bash
cd frontend
npx jest app/components/__tests__/PhotoCapture.test.tsx
```

Run tests whose name matches a pattern:

```bash
cd frontend
npx jest --testNamePattern "honeypot"
```

### Test Environments (Two Isolated Projects)

`jest.config.js` splits the suite into two projects to handle the conflicting DOM requirements of Next.js middleware and regular component tests:

| Project | Environment | `setupFilesAfterEnv` | Matches |
|---|---|---|---|
| `middleware` | `node` | `jest.setup.node.ts` | `__tests__/middleware.test.ts` only |
| `jsdom` | `jsdom` | `jest.setup.ts` | All other `*.test.ts` / `*.test.tsx` files |

The `middleware` project runs under `node` because `next/server` requires the native Node.js 18+ Web Fetch API globals (`Request`, `Response`, `Headers`) that jsdom does not provide. All other tests use `jsdom` for browser API simulation.

### Global Test Setup (`jest.setup.ts`)

`jest.setup.ts` installs the following stubs globally for the `jsdom` project:

- **`global.fetch`** — stubbed as `jest.fn()` so tests can `jest.spyOn(global, 'fetch')`.
- **`URL.createObjectURL` / `revokeObjectURL`** — stubbed; `PhotoCapture` uses these to build photo preview `src` values.
- **`navigator.share`** / **`navigator.clipboard`** — stubbed; jsdom does not implement these Web APIs.
- **`window.alert`** — stubbed as `jest.fn()`.
- **`HTMLCanvasElement.getContext`** — returns a minimal `{ drawImage }` stub for compression tests.
- **`HTMLCanvasElement.toBlob`** — default stub returns a 1-byte blob under the 10 MB limit; individual tests override `prototype.toBlob` for compression-failure paths.
- **`HTMLImageElement.src` setter** — fires `onload` synchronously so `compressImage`'s Promise resolves inside `act()`.
- **Custom matchers** — `toBeNull` and `toBeUndefined` are extended to accept an optional documentation message string without throwing.
- **`jest.clearAllMocks()`** — called in `afterEach` to reset call counts without clearing implementations set in `beforeEach`.

`jest.setup.node.ts` installs only the custom matcher extensions for the `middleware` project (which has no canvas or window globals).

### Mock Modules (`__mocks__/`)

| Mock file | Replaces | Reason |
|---|---|---|
| `__mocks__/reactLeaflet.js` | `react-leaflet` | Leaflet requires real browser canvas/DOM; stubs `MapContainer`, `TileLayer`, `CircleMarker`, `Popup`, `Marker`, and `useMap` with predictable `data-testid` elements |
| `__mocks__/leaflet.js` | `leaflet` | Prevents Leaflet from attempting real DOM operations when required directly in `ReportsMap` |
| `__mocks__/nextDynamic.js` | `next/dynamic` | Renders dynamically-imported components synchronously so map components are testable without SSR |
| `__mocks__/styleMock.js` | `*.css`, `*.scss` | Returns `{}` — CSS modules are irrelevant to unit tests |
| `__mocks__/next/font/google.js` | `next/font/google` | Font loading is build-time only; returns objects with `.variable`, `.className`, and `.style` matching the real API shape |

### Test File Conventions

- Test files live in `__tests__/` subdirectories adjacent to the code they test, or at the top-level `frontend/__tests__/` for integration-style tests.
- File names follow the pattern `{ComponentName}.test.tsx` for components and `{module}.test.ts` for pure TypeScript modules.
- Specialised sub-suites append a descriptor: `ReportsTable.subtable.test.tsx`, `adminApi.phase2.test.ts`, `page.honeypot.test.tsx`.

### Test Suite Map

**Pages and layout**

| File | Coverage |
|---|---|
| `app/__tests__/home-page.test.tsx` | Home page render |
| `app/__tests__/report-page.test.tsx` | Two-step report submission flow |
| `app/__tests__/layout.test.ts` | Root layout metadata |
| `app/__tests__/utils.test.ts` | Utility helpers |
| `app/report/__tests__/page.honeypot.test.tsx` | ABUSE-02: honeypot field is `type=hidden`, not autofilled by browsers |
| `__tests__/middleware.test.ts` | Edge middleware: unauthenticated `/admin/*` → 307 redirect; authenticated → passthrough; non-admin routes unaffected |

**Components**

| File | Coverage |
|---|---|
| `app/components/__tests__/PhotoCapture.test.tsx` | Camera trigger, EXIF GPS extraction, >10 MB compression, preview clear |
| `app/components/__tests__/CategoryPicker.test.tsx` | Category selection |
| `app/components/__tests__/ReportsMap.test.tsx` | Map renders markers |
| `app/components/__tests__/LocationMap.warning.test.tsx` | Out-of-bounds location warning |
| `app/components/__tests__/ReviewStrip.test.tsx` | Pre-submission review strip |
| `app/components/__tests__/SubmitSuccess.test.tsx` | Post-submission confirmation |
| `app/components/__tests__/BilingualText.test.tsx` | English/Kannada bilingual rendering |
| `app/components/redesign/__tests__/CategoryGrid.test.tsx` | Redesigned category grid |
| `app/components/redesign/__tests__/SeverityGrid.test.tsx` | Redesigned severity grid |
| `app/components/redesign/__tests__/SuccessCard.test.tsx` | Redesigned success card |
| `app/components/ui/__tests__/Bi.test.tsx` | `<Bi>` bilingual primitive |
| `app/components/ui/__tests__/Btn.test.tsx` | `<Btn>` button primitive |
| `app/components/ui/__tests__/Icon.test.tsx` | `<Icon>` primitive |
| `app/components/ui/__tests__/Pill.test.tsx` | `<Pill>` primitive |
| `app/components/ui/__tests__/SectionLabel.test.tsx` | `<SectionLabel>` primitive |

**Admin subsystem**

| File | Coverage |
|---|---|
| `app/admin/__tests__/adminApi.test.ts` | API client: `credentials: 'include'`, non-2xx rejection, JSON resolution, 11 named exports |
| `app/admin/lib/__tests__/adminApi.phase2.test.ts` | Phase 2 admin API additions |
| `app/admin/__tests__/dashboard.test.tsx` | Admin dashboard render |
| `app/admin/__tests__/reports-page.test.tsx` | Reports list page |
| `app/admin/__tests__/reports-page-ward.test.tsx` | Ward-filtered reports view |
| `app/admin/reports/[id]/__tests__/page.test.tsx` | Single report detail page |
| `app/admin/reports/__tests__/page.dedup.test.tsx` | Deduplication UI |
| `app/admin/reports/map/__tests__/page.test.tsx` | Admin map view |
| `app/admin/__tests__/users-page.test.tsx` | User management page |
| `app/admin/__tests__/users-page-org.test.tsx` | Organisation-scoped user management |
| `app/admin/__tests__/layout.phase2.test.tsx` | Admin layout phase 2 |
| `app/admin/login/__tests__/login-page.test.tsx` | Login page |
| `app/admin/profile/__tests__/page.test.tsx` | Profile/change-password page |
| `app/admin/components/__tests__/ReportsTable.test.tsx` | Sortable table, delete button RBAC (admin vs reviewer) |
| `app/admin/components/__tests__/ReportsTable.subtable.test.tsx` | Deduplication subtable |
| `app/admin/components/__tests__/StatsCards.test.tsx` | Stats cards render |
| `app/admin/components/__tests__/StatusBadge.test.tsx` | Status badge variants |
| `app/admin/components/__tests__/UserManagementTable.test.tsx` | User management table |
| `app/admin/components/__tests__/UserManagementTable.phase2.test.tsx` | Phase 2 user management additions |

**Library**

| File | Coverage |
|---|---|
| `app/lib/__tests__/constants.test.ts` | `BENGALURU_BOUNDS` exact lat/lng values (`latMin: 12.7342`, `latMax: 13.1739`, `lngMin: 77.3791`, `lngMax: 77.8731`) |

### Coverage Thresholds

Coverage is collected from `app/**/*.{ts,tsx}` (excluding `*.d.ts`, `globals.css`, and `layout.tsx`). The following global thresholds must pass for `npm run test:coverage` to exit zero:

| Type | Threshold |
|---|---|
| Branches | 70% |
| Functions | 75% |
| Lines | 75% |
| Statements | 75% |

### Mocking Strategy

Frontend tests mock at the module boundary rather than at the network level:

- **API calls** — `global.fetch` is stubbed globally; individual tests call `jest.spyOn(global, 'fetch').mockResolvedValueOnce(...)` to control server responses without making real HTTP requests.
- **EXIF extraction** — `exifr` is replaced with `jest.mock('exifr', ...)` returning a controlled `gps()` function so tests can assert on GPS-present and GPS-absent paths without requiring a real JPEG.
- **Map libraries** — `react-leaflet` and `leaflet` are replaced by the module-level mocks in `__mocks__/`, making map component tests stable across environments that lack canvas support.
- **Next.js internals** — `next/dynamic`, `next/link`, `next/font/google`, and `next/server` are handled by their respective mocks so page-level components can be rendered in jsdom without a Next.js build.
- **photo-store** — Inline `jest.mock('@/app/lib/photo-store', ...)` is used in page tests that exercise the pending-photo handoff between the home page camera capture and the report page.

### TDD Discipline

The project follows a red-green pattern: test files are authored before the implementation and contain `todo!()` or stub bodies that make the suite fail. Implementation agents fill in production code to make failing tests pass. Test assertions must not be modified independently — if an assertion appears wrong, it is raised for QA review. This discipline is documented in file-level comments throughout `backend/src/handlers/admin.rs` and related files.

---

## CI Integration

<!-- VERIFY: CI workflow file name and exact test commands used in the pipeline -->

No automated CI pipeline configuration was detected in the repository at the time this document was generated. Run the test suites locally before opening a pull request:

```bash
# Backend
cd backend && cargo test

# Frontend
cd frontend && npm test
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for branch and PR conventions.
