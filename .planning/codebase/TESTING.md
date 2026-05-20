# Testing Patterns

**Analysis Date:** 2026-05-20

## Test Frameworks

### Backend (Rust)

**Runner:** Rust's built-in `cargo test`
**Assertion:** Standard `assert!`, `assert_eq!` with custom failure messages

```bash
cd backend
cargo test               # Run all tests (unit + static SQL tests)
cargo clippy -- -D warnings  # Lint (run before committing)
```

### Frontend (TypeScript)

**Runner:** Jest 29 with `jest-environment-jsdom`
**Assertion Library:** `@testing-library/jest-dom` (extended matchers)
**Component Testing:** `@testing-library/react` + `@testing-library/user-event`
**Config:** `frontend/jest.config.js`

```bash
cd frontend
npm test                 # Run all tests (passWithNoTests)
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

---

## Test File Organization

### Backend

**Inline module tests** (`#[cfg(test)] mod tests { ... }`) embedded at the bottom of handler and model source files:
- `backend/src/handlers/reports.rs` — bbox validation, rate-limit logic, honeypot detection, effective_limit()
- `backend/src/handlers/admin.rs` — validate_status, validate_create_user_request, require_role
- `backend/src/models/report.rs` — lat/lng rounding, image_url construction, privacy field exclusion

**Separate test files** for migration SQL static analysis:
- `backend/tests/migration_phase2_test.rs` — validates `003_super_admin.sql` structure
- `backend/src/migrations_tests/test_004_migration.rs` — validates `004_ward_boundaries.sql`
- `backend/src/migrations_tests/test_005_migration.rs` — validates `005_organizations.sql`

### Frontend

All test files live in `__tests__/` subdirectories co-located with the code they test:

```
frontend/
├── __tests__/
│   └── middleware.test.ts           — Next.js edge middleware (runs in node env)
├── app/
│   ├── __tests__/
│   │   ├── home-page.test.tsx
│   │   ├── report-page.test.tsx
│   │   ├── layout.test.ts
│   │   └── utils.test.ts
│   ├── lib/__tests__/
│   │   └── constants.test.ts
│   ├── components/__tests__/
│   │   ├── PhotoCapture.test.tsx
│   │   ├── BilingualText.test.tsx
│   │   ├── CategoryPicker.test.tsx
│   │   ├── LocationMap.warning.test.tsx
│   │   ├── ReportsMap.test.tsx
│   │   ├── ReviewStrip.test.tsx
│   │   └── SubmitSuccess.test.tsx
│   ├── components/ui/__tests__/
│   │   ├── Btn.test.tsx
│   │   ├── Bi.test.tsx
│   │   ├── Icon.test.tsx
│   │   ├── Pill.test.tsx
│   │   └── SectionLabel.test.tsx
│   ├── components/redesign/__tests__/
│   │   ├── CategoryGrid.test.tsx
│   │   ├── SeverityGrid.test.tsx
│   │   └── SuccessCard.test.tsx
│   ├── report/__tests__/
│   │   └── page.honeypot.test.tsx
│   └── admin/
│       ├── __tests__/
│       │   ├── adminApi.test.ts
│       │   ├── dashboard.test.tsx
│       │   ├── layout.phase2.test.tsx
│       │   ├── reports-page.test.tsx
│       │   ├── reports-page-ward.test.tsx
│       │   └── users-page.test.tsx
│       ├── lib/__tests__/
│       │   ├── adminApi.phase2.test.ts
│       │   └── adminApi.relative-url.test.ts
│       ├── components/__tests__/
│       │   ├── ReportsTable.test.tsx
│       │   ├── ReportsTable.subtable.test.tsx
│       │   ├── StatusBadge.test.tsx
│       │   ├── StatsCards.test.tsx
│       │   ├── UserManagementTable.test.tsx
│       │   └── UserManagementTable.phase2.test.tsx
│       ├── reports/__tests__/
│       │   └── page.dedup.test.tsx
│       ├── reports/map/__tests__/
│       │   └── page.test.tsx
│       ├── reports/[id]/__tests__/
│       │   └── page.test.tsx
│       ├── login/__tests__/
│       │   └── login-page.test.tsx
│       └── profile/__tests__/
│           └── page.test.tsx
```

Naming convention: `ComponentName.test.tsx` for component tests, `featureName.phase2.test.ts` for phase-specific additions.

---

## Backend Test Approach

### Pure Function Unit Tests

The backend testing philosophy is to extract all testable logic into **pure, synchronous functions** that have no I/O dependencies, then test those functions in `#[cfg(test)]` modules:

```rust
// Pure helper — extracted from handler for testability
fn is_honeypot_triggered(website_field: &str) -> bool {
    !website_field.is_empty()
}

fn build_rate_limit_key(ip: &str, lat: f64, lng: f64) -> String { ... }

fn effective_limit(raw: i64) -> i64 {
    if raw <= 0 { 20 } else { raw.clamp(1, 200) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bengaluru_bounds_valid_center() {
        assert!(is_in_bengaluru(12.9716, 77.5946), "Center must pass");
    }
}
```

**No test database.** No live HTTP routing. All backend tests run offline via `cargo test`.

### What Backend Tests Cover

- `backend/src/handlers/reports.rs` (inline tests):
  - Bengaluru bounding box validation (all four edges, corners, out-of-range values)
  - Default value population (`severity = "medium"`, `location_source = "manual_pin"`)
  - `effective_limit()` boundary conditions (0, negatives, 1, 100, 199, 200, 201, `i64::MAX`)
  - Ward lookup failure non-fatal (`unwrap_or_else → None`)
  - Honeypot detection (`is_honeypot_triggered`)
  - Rate-limit key format and geohash coordinate order regression guard
  - `AppError::RateLimited` → HTTP 429 mapping

- `backend/src/models/report.rs` (inline tests):
  - `into_response()` lat/lng rounding to 3 decimal places (AC5.2)
  - `image_url` construction from `api_base` + `/uploads/` + `image_path`
  - `0.0.0.0` never appearing in `image_url` (regression guard PD-R2)
  - Privacy: `submitter_contact` and `submitter_name` absent from `ReportResponse` JSON

- `backend/tests/migration_phase2_test.rs` and `backend/src/migrations_tests/`:
  - SQL file static analysis via `include_str!()` — checks that required DDL tokens appear
  - No live database required
  - Validates: column names, types, constraints (`NOT NULL DEFAULT FALSE`), `ALTER TABLE` vs `CREATE TABLE`, `ON DELETE SET NULL`, PostGIS geometry type and SRID, GIST index presence

### What Backend Tests Do NOT Cover

- Async handler logic (all handlers with DB calls are not covered by current unit tests)
- Integration tests against a real PostgreSQL + PostGIS instance
- Admin handler auth flows end-to-end
- File upload and EXIF stripping in production conditions
- Background dedup job (`backend/src/db/dedup_job.rs`) — no tests
- Ward lookup handler (`backend/src/handlers/wards.rs`) — no tests

---

## Frontend Test Approach

### Jest Configuration

Two isolated test projects in `frontend/jest.config.js`:

**Project 1: `middleware`** — runs in `node` environment (not jsdom)
- Only `frontend/__tests__/middleware.test.ts`
- Setup: `frontend/jest.setup.node.ts` (minimal — no DOM APIs)
- Needed because `next/server` requires Web Fetch API globals not available in jsdom

**Project 2: `jsdom`** — runs in `jest-environment-jsdom`
- All other `**/__tests__/**/*.(ts|tsx)` files
- Setup: `frontend/jest.setup.ts`
- Coverage enforced: branches 70%, functions 75%, lines 75%, statements 75%

### Test Setup (`frontend/jest.setup.ts`)

Global stubs established for all jsdom tests:
- `global.fetch = jest.fn()` — stub for network calls
- `URL.createObjectURL = jest.fn(() => "blob:mock-url")` — for photo preview
- `URL.revokeObjectURL = jest.fn()`
- `navigator.share = undefined` — jsdom lacks this
- `navigator.clipboard.writeText = jest.fn()`
- `window.alert = jest.fn()`
- `HTMLCanvasElement.prototype.getContext = jest.fn(...)` — canvas stub
- `HTMLCanvasElement.prototype.toBlob = jest.fn(callback => callback(new Blob(...)))` — default 1-byte blob (under limit)
- `HTMLImageElement.prototype.src` — patched to fire `onload` synchronously
- Custom `toBeNull` and `toBeUndefined` matchers that accept an optional message string
- `afterEach(() => jest.clearAllMocks())` — clears call history between tests

### Mocking Strategy

**Module mocks declared at top of test file** via `jest.mock()` before the module-under-test import:

```typescript
// exifr — UMD module mock
jest.mock("exifr", () => ({
  default: { gps: jest.fn(), parse: jest.fn() },
}));

// adminApi — full mock, individual functions overridden per test
jest.mock("../lib/adminApi", () => ({
  getStats: jest.fn(),
  getAdminReports: jest.fn(),
  // ... all 11 exports
}));

// next/navigation — App Router hooks
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/admin/reports",
  useSearchParams: () => new URLSearchParams(),
}));

// react-leaflet, leaflet, next/dynamic — in jest.config.js moduleNameMapper
// "^react-leaflet$": "<rootDir>/__mocks__/reactLeaflet.js"
// "^next/dynamic$": "<rootDir>/__mocks__/nextDynamic.js"
```

Child components are frequently mocked to expose `data-testid` attributes for assertions, avoiding deep render tree coupling.

**Per-test fetch mock:**
```typescript
beforeEach(() => {
  global.fetch = jest.fn();
});

// In test:
(global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({ ... }));
```

### Test Structure Pattern

```typescript
/**
 * Tests for [ComponentName]
 *
 * Requirements covered:
 *   R-X / AC-X-S1 — Description
 *
 * Mocking strategy:
 *   - ...
 */

describe("R-X / AC-X-S1 — Short description of what is tested", () => {
  beforeEach(() => {
    // Set up mock return values
  });

  it("specific behaviour — AC reference", async () => {
    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText(/.../).toBeInTheDocument();
    });
  });
});
```

### Test Data / Fixtures

No shared fixture files. Test data is constructed inline using helper functions within each test file:

```typescript
// Backend: fixture builder function
function make_report(latitude: f64, longitude: f64) -> Report {
    Report { id: Uuid::nil(), created_at: Utc::now(), ... }
}

// Frontend: inline helper
function makeFile(name: string, sizeBytes: number): File {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: sizeBytes, writable: false });
  return file;
}

// Frontend: response helpers
function mockOkResponse(body: unknown, status = 200): Response { ... }
function mockErrorResponse(status: number, body: unknown): Response { ... }
```

`File.size` is read-only — spoof it with `Object.defineProperty` (see `PhotoCapture.test.tsx`).

`HTMLCanvasElement.prototype.toBlob` is overridden per describe block when testing compression failure paths, then restored in `afterEach`.

### What Frontend Tests Cover

**Components:**
- `PhotoCapture.tsx` — camera/gallery input rendering, EXIF GPS extraction, compression, preview, X clear button
- `BilingualText.tsx`, `Bi.tsx` — bilingual rendering
- `CategoryPicker.tsx`, `CategoryGrid.tsx`, `SeverityGrid.tsx` — selection interaction
- `ReportsMap.tsx` — map rendering (Leaflet mocked)
- `SubmitSuccess.tsx`, `SuccessCard.tsx` — success state rendering
- `ReviewStrip.tsx` — review strip display
- `LocationMap.tsx` — warning behavior (`.warning.test.tsx`)

**UI primitives:** `Btn.tsx`, `Icon.tsx`, `Pill.tsx`, `SectionLabel.tsx`, `Bi.tsx`

**Admin components:** `ReportsTable.tsx` (including subtable), `StatsCards.tsx`, `StatusBadge.tsx`, `UserManagementTable.tsx`

**Pages:**
- `app/page.tsx` (home), `app/report/page.tsx` (report flow including honeypot)
- `app/admin/page.tsx` (dashboard), `app/admin/reports/page.tsx`, `app/admin/users/page.tsx`
- `app/admin/reports/[id]/page.tsx`, `app/admin/reports/map/page.tsx`
- `app/admin/login/page.tsx`, `app/admin/profile/page.tsx`

**API client:** `adminApi.ts` — full contract coverage (credentials, HTTP methods, URL patterns, error rejection, success resolution)

**Utilities:** `utils.ts` (haversineDistance — all boundary conditions), `lib/constants.ts`

**Middleware:** Next.js edge middleware auth redirect logic

### What Frontend Tests Do NOT Cover

- `app/map/page.tsx` — no tests
- `app/lib/photo-store.ts` — no tests
- `app/lib/translations.ts` — no tests
- `app/admin/layout.tsx` server-side auth guard — not unit tested (integration concern)
- Real fetch network calls — all mocked
- Leaflet/react-leaflet rendering — fully mocked via `__mocks__/reactLeaflet.js`
- E2E / browser testing — no Playwright or Cypress present

---

## CI/CD Pipeline

**Config:** `.github/workflows/ci.yml` — triggers on every push to any branch and on pull requests.

**Three parallel jobs:**

### `frontend-checks`
```yaml
- npm ci
- npm run lint              # next lint (ESLint)
- npm test -- --passWithNoTests --watchAll=false
- npm audit --audit-level=critical
```

### `backend-checks`
```yaml
- cargo clippy -- -D warnings   # zero warnings policy
- cargo test                     # all unit + migration static tests
- cargo audit                    # dependency vulnerability scan
```

### `docker-build`
```yaml
- docker compose build           # verifies all three images build cleanly
# POSTGRES_PASSWORD and JWT_SECRET set to dummy values for build-only verification
```

**Deploy workflow:** `.github/workflows/deploy.yml` — calls CI as a workflow dependency before deploying.

**No integration tests in CI.** All backend tests run without a database. PostGIS/integration coverage is a gap.

---

*Testing analysis: 2026-05-20*
