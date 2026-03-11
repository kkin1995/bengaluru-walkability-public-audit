# Coding Conventions

**Analysis Date:** 2026-03-11

## Languages and Style Tools

**Frontend (TypeScript/React):**
- TypeScript 5, strict mode enabled (`"strict": true` in `frontend/tsconfig.json`)
- ESLint via `eslint-config-next` (run with `npm run lint`; no `.eslintrc` file — config lives in `package.json` implicitly via next)
- No Prettier config detected; formatting is enforced by the team but not by a config file

**Backend (Rust):**
- Cargo's built-in `rustfmt` (default formatting)
- `cargo clippy` for lints
- No custom `.clippy.toml` detected

---

## Naming Patterns

**Files:**
- React components: PascalCase (`PhotoCapture.tsx`, `ReportsMap.tsx`, `StatusBadge.tsx`)
- Next.js route files: lowercase (`page.tsx`, `layout.tsx`, `middleware.ts`)
- Utility/lib files: camelCase (`adminApi.ts`, `config.ts`, `constants.ts`)
- Test files: co-located in `__tests__/` subdirectory, named `{ComponentName}.test.tsx` or `{feature}.test.ts`
- Phase-scoped tests: `{Component}.phase2.test.tsx` for phase-specific test suites
- Rust modules: snake_case (`admin_queries.rs`, `admin_seed.rs`, `auth.rs`)

**Functions:**
- TypeScript: camelCase functions (`apiFetch`, `fetchReports`, `handleFile`, `makeRequest`)
- React components: PascalCase (`PhotoCapture`, `UserManagementTable`)
- Rust: snake_case (`extract_claims`, `require_role`, `create_report`)
- Test helpers: descriptive names that read as sentences (`completeStep0WithGps`, `advanceFromStep1`, `navigateToStep3`)

**Variables:**
- TypeScript: camelCase (`currentUserId`, `isSuperAdmin`, `fetchReports`)
- Rust: snake_case (`cookie_val`, `required_role`, `exp_offset_secs`)
- Constants: SCREAMING_SNAKE_CASE (`MAX_BYTES`, `SECRET`, `WRONG_SECRET`, `BENGALURU_CENTER`)

**Types/Interfaces:**
- TypeScript: PascalCase (`AdminUser`, `CreateUserPayload`, `AdminReportFilters`)
- Rust structs: PascalCase (`JwtClaims`, `AppError`, `CreateReportRequest`, `ReportResponse`)
- Rust enums: PascalCase with descriptive variants (`AppError::Unauthorized`, `AppError::Forbidden`)

---

## Import Organization

**TypeScript order (observed pattern):**
1. React and framework imports (`import React from "react"`, `import { ... } from "next/..."`)
2. Third-party library imports (`import { ... } from "@testing-library/react"`)
3. Internal absolute imports using `@/` alias (`import { API_BASE_URL } from "@/app/lib/config"`)
4. Relative imports (`import PhotoCapture from "../PhotoCapture"`)

**Path Aliases:**
- `@/*` maps to `frontend/` root (defined in `frontend/tsconfig.json`)
- Example: `import { API_BASE_URL } from "@/app/lib/config"` resolves to `frontend/app/lib/config.ts`

---

## Environment Configuration

**Mandatory rule:** All `process.env.*` references must live exclusively in `frontend/app/lib/config.ts`. Never inline `process.env.*` in individual component or page files.

**Pattern in `frontend/app/lib/config.ts`:**
```typescript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://localhost:3001";
```

**Static geo constants** live in `frontend/app/lib/constants.ts` (not config.ts):
```typescript
export const BENGALURU_BOUNDS = { latMin: 12.7342, latMax: 13.1739, ... };
export const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 };
```

---

## React Component Patterns

**Client components:** Always add `"use client"` directive at top of file when using hooks, event handlers, or browser APIs.

**Dynamic imports for SSR-incompatible modules:**
```typescript
// Leaflet requires window — always use dynamic import with ssr: false
const LocationMap = dynamic(() => import("../components/LocationMap"), { ssr: false });
```

**Leaflet icon fix (required in every map component):**
```typescript
const L = require("leaflet");
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: "...", iconUrl: "...", shadowUrl: "..." });
```

**useRef pattern for router in callbacks** (prevents infinite re-render loop):
```typescript
const routerRef = useRef(router);
routerRef.current = router;
const handleNav = useCallback(() => { routerRef.current.push("/..."); }, []);
```

**exifr require pattern** (handles both webpack and Jest environments):
```typescript
const exifrModule = require("exifr");
const exifr = (exifrModule.default ?? exifrModule) as { gps: (f: File) => Promise<...> };
```

---

## Error Handling

**Frontend — API calls:**
```typescript
// All admin API calls go through the shared apiFetch helper in adminApi.ts
// It throws `new Error("HTTP ${res.status}")` on non-2xx responses
async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...options, credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}
```

**Frontend — User-facing error strings:**
- Always use human-readable messages, not raw Error messages
- Pattern: `setError("Couldn't load reports — tap to retry.")` (not error.message)
- Network failures get a specific connection error: `"Couldn't submit — check your connection and try again."`

**Frontend — try/catch async:**
- Use `async/await` with `try/catch` rather than `.then()/.catch()` chaining (Jest compatibility)
- `catch` blocks for EXIF extraction use empty catch since GPS is optional: `catch { /* GPS will be null */ }`

**Backend — AppError enum:**
```rust
// All handler errors return AppError variants from backend/src/errors.rs
pub enum AppError {
    Database(#[from] sqlx::Error),
    NotFound,
    BadRequest(String),
    Internal(String),
    Io(#[from] std::io::Error),
    Unauthorized,
    Forbidden,
    Conflict(String),
}
// IntoResponse impl maps each variant to the correct HTTP status + JSON body
```

**Backend — error propagation:**
```rust
// Use ? operator with .map_err() to convert field parse errors
req.latitude = text.parse()
    .map_err(|_| AppError::BadRequest("Invalid latitude".into()))?;
```

---

## Logging

**Backend:** `tracing` crate with JSON output (`tracing-subscriber` with `.json()` formatter).
- Only errors are logged in `AppError::into_response()`: `tracing::error!("Database error: {e}")`
- Request IDs injected via `X-Request-ID` header from nginx, propagated into tracing spans

**Frontend:** No structured logging. Browser `console.*` is not used in source files (no observed pattern).

---

## Comments

**When to comment:**
- Module-level `//!` doc comments for Rust modules explaining security contracts
- Function-level `///` doc comments for Rust public functions with input/output tables (see `backend/src/middleware/auth.rs`)
- Test file header JSDoc blocks listing requirements covered and mocking strategy
- Inline `//` comments for non-obvious decisions (SSR caveats, EXIF quirks, exifr interop)

**Rust doc table pattern (used for security-sensitive functions):**
```rust
/// # Contract
///
/// | Input                    | Output                        |
/// |--------------------------|-------------------------------|
/// | `None`                   | `Err(AppError::Unauthorized)` |
/// | Valid JWT, future exp    | `Ok(JwtClaims { … })`         |
```

**Test file header pattern (TypeScript):**
```typescript
/**
 * Tests for frontend/app/report/page.tsx — 4-step wizard
 *
 * Requirements covered:
 *   R1 / AC1.2 — Photo chosen → auto-advance to step 1
 *
 * Mocking strategy:
 *   - PhotoCapture is mocked so we can call onPhoto programmatically.
 */
```

---

## TypeScript Strictness

- `strict: true` is enabled — no implicit `any`, no implicit `undefined`
- `esModuleInterop: true` — enables default import of CommonJS modules
- Cast pattern for `as unknown as T` is used when crossing type boundaries (e.g., `undefined as unknown as T` for 204 responses)
- `Record<string, unknown>` used instead of `any` for dynamic object shapes
- Optional properties use `?:` not `| undefined` in interfaces

---

## Module Design

**Exports:**
- TypeScript: named exports for functions/types, default export for React components
- Rust: `pub` functions/structs only where needed; pure helper functions documented as unit-testable

**Barrel Files:** Not used. Imports reference specific module paths directly.

**API client module:** All admin API calls centralized in `frontend/app/admin/lib/adminApi.ts` with a shared `apiFetch<T>` helper. No fetch calls scattered across components.

---

*Convention analysis: 2026-03-11*
