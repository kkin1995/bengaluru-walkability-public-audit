# Testing Patterns

**Analysis Date:** 2026-03-11

## Test Frameworks

### Frontend
**Runner:** Jest 29.7.0
**Config:** `frontend/jest.config.js`
**Assertion Library:** `@testing-library/jest-dom` 6.9.1
**Component rendering:** `@testing-library/react` 14.3.1
**User interaction:** `@testing-library/user-event` 14.6.1
**Transformer:** `babel-jest` 29.7.0 with `next/babel` preset

**Run Commands:**
```bash
cd frontend && npm test              # Run all tests (passWithNoTests)
cd frontend && npm run test:watch    # Watch mode
cd frontend && npm run test:coverage # Coverage report
```

### Backend
**Runner:** Cargo's built-in test harness
**No external test framework** — standard `#[test]` attribute

**Run Commands:**
```bash
cd backend && cargo test             # Run all tests (no live DB required)
```

---

## Test Counts

- **Frontend:** ~566 tests passing
- **Backend:** 177 tests passing (170 unit + 7 migration SQL tests)
- **No integration tests requiring a live database** — all tests are hermetic

---

## Frontend Test Organization

**Two isolated Jest projects** (split in `frontend/jest.config.js`):

**Project 1 — `middleware`:**
- Environment: `node` (for Next.js edge runtime globals)
- Matches: `frontend/__tests__/middleware.test.ts` only
- Setup: `frontend/jest.setup.node.ts` (minimal — no jsdom APIs)

**Project 2 — `jsdom`:**
- Environment: `jsdom`
- Matches: all `__tests__/**/*.(ts|tsx)` and `**/*.test.*` except middleware
- Setup: `frontend/jest.setup.ts` (full browser API stubs)

**Test file location pattern:**
- Co-located with source in `__tests__/` subdirectory at the same level
- Examples:
  - `frontend/app/components/__tests__/PhotoCapture.test.tsx` tests `frontend/app/components/PhotoCapture.tsx`
  - `frontend/app/admin/lib/__tests__/adminApi.phase2.test.ts` tests `frontend/app/admin/lib/adminApi.ts`
  - `frontend/__tests__/middleware.test.ts` tests `frontend/middleware.ts`

**Naming:**
- `{ComponentName}.test.tsx` — standard test file
- `{ComponentName}.phase2.test.tsx` — phase-specific additions (e.g., `UserManagementTable.phase2.test.tsx`)

---

## Test Structure Patterns

**Suite organization — tests grouped by requirement/acceptance criteria:**
```typescript
// File header: lists requirements covered + mocking strategy
/**
 * Tests for frontend/app/report/page.tsx — 4-step wizard
 *
 * Requirements covered:
 *   R1 / AC1.2 — Photo chosen → auto-advance to step 1 (Location)
 *
 * Mocking strategy:
 *   - PhotoCapture is mocked so we can call onPhoto programmatically.
 */

// describe blocks labeled with requirement code
describe("R1 / AC1.2 — Photo selection auto-advances to Location step", () => {
  it("advances to Step 2 (Location) immediately after a photo with GPS is chosen", async () => {
    render(<ReportPage />);
    await completeStep0WithGps();
    expect(screen.getByText(/step 2 of 4: location/i)).toBeInTheDocument();
  });
});
```

**Rust test organization:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Constants used across tests
    const SECRET: &[u8] = b"test-secret-for-unit-tests-only";

    // Test builder helper
    fn make_test_jwt(role: &str, exp_offset_secs: i64, secret: &[u8]) -> String { ... }

    // Tests labeled with requirement codes in doc comments
    /// R6.1 — A missing cookie (None) must be rejected immediately.
    #[test]
    fn test_extract_claims_none_cookie() { ... }
}
```

---

## Setup and Teardown

**Global frontend setup (`frontend/jest.setup.ts`):**
- Installs `@testing-library/jest-dom` matchers
- Stubs browser APIs not present in jsdom: `fetch`, `URL.createObjectURL`, `URL.revokeObjectURL`, `navigator.share`, `navigator.clipboard`, `window.alert`
- Stubs `HTMLCanvasElement.prototype.getContext` and `.toBlob` (used by `compressImage`)
- Patches `HTMLImageElement.prototype.src` setter to fire `onload` synchronously (enables `compressImage` Promise to resolve in tests)
- Extends `expect` with `toBeNull` and `toBeUndefined` overrides that silently accept an optional documentation message string as second argument
- Registers `afterEach(() => jest.clearAllMocks())` globally — clears call history between tests without clearing implementations

**Per-test setup pattern:**
```typescript
// Tests that need a fresh fetch mock replace global.fetch in beforeEach
beforeEach(() => {
  global.fetch = jest.fn();
});
// jest.clearAllMocks() in afterEach (registered globally) handles cleanup
```

---

## Mocking

**Module-level mocks** (declared before imports, hoisted by Jest):
```typescript
// Mock entire module
jest.mock("../lib/adminApi", () => ({
  getStats: jest.fn(),
  login: jest.fn(),
  // ... all 11+ exports
}));

// Mock with default export (React component)
jest.mock("../components/PhotoCapture", () => {
  const MockPhotoCapture = ({ onPhoto }: { onPhoto: ... }) => (
    <div data-testid="photo-capture">
      <button onClick={() => onPhoto(new File(["img"], "photo.jpg"), { latitude: 12.9716, longitude: 77.5946 })}>
        Simulate Photo With GPS
      </button>
    </div>
  );
  MockPhotoCapture.displayName = "MockPhotoCapture";
  return MockPhotoCapture;
});
```

**exifr mock (must use require pattern in source for Jest interop):**
```typescript
// In test file:
jest.mock("exifr", () => ({
  default: { gps: jest.fn() },
}));

// In source (PhotoCapture.tsx), load via require not import:
const exifrModule = require("exifr");
const exifr = (exifrModule.default ?? exifrModule) as { gps: ... };
```

**fetch mock:**
```typescript
// Spy on global.fetch (preferred — preserves the mock installed in jest.setup.ts)
const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({
  ok: true,
  json: async () => ({ id: "new-report-id" }),
} as Response);

// For in-flight (never-resolving) fetch:
jest.spyOn(global, "fetch").mockReturnValueOnce(new Promise(() => {}));

// For network failure:
jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));
```

**Global mock files (`frontend/__mocks__/`):**
- `frontend/__mocks__/reactLeaflet.js` — replaces react-leaflet components with `data-testid` stubs
- `frontend/__mocks__/leaflet.js` — stubs leaflet (required by `ReportsMap` via `require()`)
- `frontend/__mocks__/nextDynamic.js` — makes `next/dynamic` render imported modules synchronously via class component with `componentDidMount`
- `frontend/__mocks__/styleMock.js` — returns `{}` for CSS imports

**What to mock:**
- All browser APIs not present in jsdom (`fetch`, canvas, clipboard, etc.) — globally in `jest.setup.ts`
- All child components in page-level tests — to control props and callbacks programmatically via `data-testid` buttons
- `next/link`, `next/navigation` — mock to plain `<a>` tags or jest.fn() routers
- `exifr` — always mock to control GPS output per test
- Leaflet / react-leaflet — always mock via `__mocks__/` (requires real DOM canvas)

**What NOT to mock:**
- The module under test itself
- Pure utility functions (test them directly)
- `adminApi.ts` internal `apiFetch` helper (test it indirectly via `global.fetch` spy)

---

## Fixtures and Factories

**TypeScript test factories (inline in test files):**
```typescript
// Minimal Response-like object for fetch mocks
function mockOkResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function mockErrorResponse(status: number, body: unknown = { error: "err" }): Response {
  return { ok: false, status, json: async () => body } as unknown as Response;
}

// File factory with controlled size
function makeFile(name: string, sizeBytes: number): File {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: sizeBytes, writable: false });
  return file;
}
```

**Rust test builders:**
```rust
// Fixture function returning minimal valid struct
fn make_report(latitude: f64, longitude: f64) -> Report {
    Report {
        id: Uuid::nil(),
        created_at: Utc::now(),
        image_path: "test.jpg".to_string(),
        latitude, longitude,
        category: "no_footpath".to_string(),
        // ... other fields with non-significant defaults
    }
}

// JWT builder with role and expiry offset
fn make_test_jwt(role: &str, exp_offset_secs: i64, secret: &[u8]) -> String {
    let now = jsonwebtoken::get_current_timestamp() as i64;
    let exp = (now + exp_offset_secs) as usize;
    // ... encode and return
}

// Claims builder
fn claims_with_role(role: &str) -> JwtClaims {
    JwtClaims { sub: "22222222-...".to_string(), role: role.to_string(), exp: 9999999999, ... }
}
```

**Location:** Factories are defined inline in each test file — no shared fixtures directory.

---

## Coverage

**Requirements (jsdom project only):**
- Branches: 70%
- Functions: 75%
- Lines: 75%
- Statements: 75%

**Coverage config in `frontend/jest.config.js`:**
```javascript
collectCoverageFrom: [
  "app/**/*.{ts,tsx}",
  "!app/**/*.d.ts",
  "!app/globals.css",
  "!app/layout.tsx",
],
```

**View Coverage:**
```bash
cd frontend && npm run test:coverage
```

---

## Test Types

**Unit Tests (backend):**
- Pure function tests with no DB, no async I/O
- Use `#[cfg(test)] mod tests { ... }` inside source files
- Files with tests: `backend/src/middleware/auth.rs`, `backend/src/models/report.rs`, `backend/src/models/admin.rs`, `backend/src/handlers/admin.rs`, `backend/src/handlers/reports.rs`, `backend/src/db/admin_queries.rs`, `backend/src/db/admin_seed.rs`, `backend/src/config.rs`

**Migration SQL tests (backend):**
- Static analysis only — parse SQL file text for required DDL tokens
- Located in `backend/tests/migration_phase2_test.rs`
- Use `include_str!("../migrations/003_super_admin.sql")` to read SQL at compile time
- No live DB required

**Component tests (frontend):**
- Render component with RTL, assert on DOM output
- Mock all child components and network calls
- Located in `frontend/app/components/__tests__/`

**Page-level integration tests (frontend):**
- Render full page components, drive multi-step flows via `userEvent`
- Mock leaf components to expose callbacks via `data-testid` buttons
- Use `act()` around any async state changes, `waitFor()` for async assertions
- Located in `frontend/app/__tests__/` and `frontend/app/admin/__tests__/`

**API client tests (frontend):**
- Test contract (HTTP method, URL, headers, body, error/success behavior) via `global.fetch` spy
- No component rendering
- Located in `frontend/app/admin/__tests__/adminApi.test.ts` and `frontend/app/admin/lib/__tests__/adminApi.phase2.test.ts`

**Edge middleware tests (frontend):**
- Pure function tests — `middleware(req)` in, `Response` out
- Use real `NextRequest` objects (no mocking needed)
- Run in `node` environment (not jsdom) for Web Fetch API globals
- Located in `frontend/__tests__/middleware.test.ts`

**E2E Tests:** Not used.

---

## Common Patterns

**Async component testing:**
```typescript
// Wrap user interactions in act()
await act(async () => {
  await userEvent.click(screen.getByRole("button", { name: /submit/i }));
});

// Use waitFor() for async state changes after interactions
await waitFor(() => {
  expect(screen.getByTestId("submit-success")).toBeInTheDocument();
});
```

**Multi-step wizard navigation helpers:**
```typescript
// Define step-advance helpers and compose them
async function completeStep0WithGps() {
  await act(async () => { await userEvent.click(screen.getByTestId("mock-photo-with-gps")); });
}
async function navigateToStep3() {
  await completeStep0WithGps();
  await advanceFromStep1();
  await completeStep2();
}
```

**Error path testing:**
```typescript
// Network failure
jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));
// ... render and interact ...
await waitFor(() => {
  expect(screen.getByText("Couldn't submit — check your connection and try again.")).toBeInTheDocument();
});

// Server error (non-2xx)
jest.spyOn(global, "fetch").mockResolvedValueOnce({
  ok: false, status: 400,
  json: async () => ({ error: "Please drop the pin within Bengaluru" }),
} as Response);
```

**Rust assertion pattern (with failure message):**
```rust
assert!(
    matches!(result, Err(AppError::Unauthorized)),
    "Expected Err(AppError::Unauthorized) when cookie_val is None, got: {:?}",
    result
);
assert_eq!(
    response.latitude, 12.972,
    "12.97165 must round up to 12.972, got {}",
    response.latitude
);
```

**Inspecting FormData payload in fetch mock:**
```typescript
const [url, options] = fetchMock.mock.calls[0];
const body = (options as RequestInit).body as FormData;
expect(body.get("location_source")).toBe("exif");
expect(body.get("photo")).toBeInstanceOf(File);
```

**Component mock with exposed callback via data-testid button:**
```typescript
jest.mock("../components/LocationMap", () => {
  const MockLocationMap = ({ onChange }: { onChange: (lat: number, lng: number) => void }) => (
    <div data-testid="location-map">
      <button data-testid="mock-pin-inside" onClick={() => onChange(12.9716, 77.5946)}>
        Pin Inside Bengaluru
      </button>
    </div>
  );
  MockLocationMap.displayName = "MockLocationMap";
  return MockLocationMap;
});
```

---

## TDD Workflow (Project Convention)

All new features follow strict TDD order (enforced by project workflow):
1. PRD with acceptance criteria written first
2. Failing tests written against the ACs before any implementation
3. Implementation written to make tests pass — test files are never modified during implementation

Test files are the behavioral contract. The comment `// Do NOT modify these tests` appears explicitly in test headers for critical suites (`middleware.test.ts`, `migration_phase2_test.rs`).

---

*Testing analysis: 2026-03-11*
