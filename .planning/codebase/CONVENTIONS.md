# Coding Conventions

**Analysis Date:** 2026-05-20

## Rust Code Style

### Naming Patterns

**Functions:** `snake_case` for all function names.
- Handlers: `admin_list_reports`, `admin_create_user`, `create_report`, `list_reports`
- Pure helpers: `build_rate_limit_key`, `extract_client_ip`, `is_honeypot_triggered`, `strip_exif`
- DB query functions: `get_ward_for_point`, `insert_report`, `check_photo_hash_exists`

**Types/Structs/Enums:** `PascalCase`
- `AppState`, `AppError`, `Report`, `ReportResponse`, `CreateReportRequest`, `ListReportsQuery`

**Constants:** `SCREAMING_SNAKE_CASE`
- `LAT_MIN`, `LAT_MAX`, `LNG_MIN`, `LNG_MAX`

**Module files:** `snake_case.rs` — `reports.rs`, `admin.rs`, `admin_queries.rs`, `admin_seed.rs`, `dedup_job.rs`

### Error Handling

Use `thiserror` for all backend error types. The single `AppError` enum in `backend/src/errors.rs` covers all error cases:

```rust
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Not found")]
    NotFound,
    #[error("Bad request: {0}")]
    BadRequest(String),
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Forbidden")]
    Forbidden,
    #[error("Conflict: {0}")]
    Conflict(String),
    #[error("Rate limited: {0}")]
    RateLimited(String),
    // ...
}
```

`AppError` implements `IntoResponse` and returns `Json(json!({ "error": message }))` — all error responses use this single `error` key. Never expose internal error details or stack traces to clients.

Handlers return `Result<Json<T>, AppError>`. Never use `unwrap()` in handlers — use `?` for propagation or `.unwrap_or_else(|e| { ... })` for non-fatal failures:

```rust
// Non-fatal pattern (ward lookup failure must not block report submission)
let ward_id = queries::get_ward_for_point(&state.pool, req.latitude, req.longitude)
    .await
    .unwrap_or_else(|e| {
        tracing::warn!(lat = req.latitude, lng = req.longitude, error = %e,
            "Ward lookup failed; report will be stored without ward assignment");
        None
    });
```

### Logging

Use `tracing` macros, NOT `println!`. Structured key=value format in macro arguments:

```rust
tracing::warn!(honeypot_value_len = text.len(), "ABUSE-02: honeypot triggered");
tracing::warn!(photo_hash = %photo_hash, "ABUSE-03: duplicate photo hash");
tracing::error!("Database error: {e}");
tracing::info!("Database migrations applied");
```

Log level policy: `error` for DB/IO failures, `warn` for anti-abuse triggers and non-fatal failures, `info` for startup lifecycle events. Never log PII fields (submitter_name, submitter_contact, submitter_ip).

### Comments

- Inline comment headers use `//` with ASCII banner separators: `// ── Section Name ──────────`
- Three-section structure in complex handler files: `§ 1 — Public types`, `§ 2 — Pure helpers`, `§ 3 — Async handlers`
- Requirement tags referenced in comments: `// ABUSE-01`, `// ABUSE-02`, `// AC2.2`, `// WARD-02`, `// FINDING-007`
- Doc comments on public items use `///` with description on first line
- `#[allow(dead_code)]` with inline comment explaining WHY the field is suppressed (see `backend/src/models/report.rs`)

### Module Organization (backend)

```
backend/src/
├── main.rs              — AppState, routing, startup
├── config.rs            — Config::from_env()
├── errors.rs            — AppError enum + IntoResponse impl
├── handlers/
│   ├── mod.rs
│   ├── reports.rs       — public report handlers + inline unit tests
│   ├── admin.rs         — admin handlers, pure validation helpers + inline tests
│   ├── health.rs
│   └── wards.rs
├── models/
│   ├── report.rs        — Report (DB row), ReportResponse (JSON), CreateReportRequest
│   ├── admin.rs         — AdminUser, login/request types
│   ├── ward.rs
│   └── organization.rs
├── db/
│   ├── queries.rs       — public report DB queries
│   ├── admin_queries.rs — admin DB queries
│   ├── admin_seed.rs
│   └── dedup_job.rs     — background dedup loop
├── middleware/
│   └── auth.rs          — JWT validation, require_auth, JwtClaims
└── migrations_tests/    — SQL static-analysis tests (no live DB)
    ├── mod.rs
    ├── test_004_migration.rs
    └── test_005_migration.rs
```

### API Response Shapes

**Success (single resource):** Returns the resource struct directly as JSON.
```json
{ "id": "uuid", "created_at": "...", "image_url": "...", ... }
```

**Success (paginated list):** Fixed envelope shape:
```json
{
  "page": 1,
  "limit": 20,
  "count": 5,
  "total": 100,
  "items": [...]
}
```
`total` is omitted if the count query fails (non-fatal degradation pattern).

**Error:** Always `{ "error": "Human-readable message" }` with appropriate HTTP status code. Never includes stack traces or internal details.

**Optional fields:** Use `#[serde(skip_serializing_if = "Option::is_none")]` on `Option<T>` fields that are absent from the public API but present in admin views (e.g. `ward_name` on `ReportResponse`).

### SQL / Migration Patterns

- Migration files in `backend/migrations/`, numbered sequentially: `001_init.sql` through `007_anti_abuse.sql`
- Applied automatically via `sqlx::migrate!("./migrations")` on startup in `backend/src/main.rs`
- Incremental only — migrations must use `ALTER TABLE`, never `DROP TABLE` or `DROP COLUMN`
- All new boolean columns require `NOT NULL DEFAULT FALSE`
- PostGIS coordinate order in `ST_MakePoint` is `(longitude, latitude)` — X,Y order. Parameters are always documented with inline comments: `-- $1 = latitude (Y)`, `-- $2 = longitude (X)`
- SQL queries in Rust use raw string literals `r#"..."#` for multiline SQL
- SQLx compile-time query checks: run `cargo sqlx prepare --database-url "..."` after changing any SQL query

---

## TypeScript / React Conventions

### Naming Patterns

**Components:** `PascalCase.tsx`
- Feature components: `PhotoCapture.tsx`, `LocationMap.tsx`, `ReportsMap.tsx`, `CategoryPicker.tsx`
- UI primitives in `frontend/app/components/ui/`: short names — `Btn.tsx`, `Bi.tsx`, `Icon.tsx`, `Pill.tsx`, `SectionLabel.tsx`
- Redesign variants in `frontend/app/components/redesign/`: `CategoryGrid.tsx`, `SeverityGrid.tsx`, `SuccessCard.tsx`
- Admin components in `frontend/app/admin/components/`: `ReportsTable.tsx`, `StatsCards.tsx`, `UserManagementTable.tsx`

**Functions:** `camelCase` (`haversineDistance`, `compressImage`, `handleFile`, `tryBrowserGeolocation`)
**Types/Interfaces:** `PascalCase` (`FormState`, `BtnProps`, `GpsCoords`, `AdminReport`, `Step`)
**Constants:** `SCREAMING_SNAKE_CASE` for module-level constants (`MAX_BYTES`, `INITIAL_FORM`)
**Exported domain constants:** `SCREAMING_SNAKE_CASE` in `frontend/app/lib/constants.ts` (`BENGALURU_BOUNDS`, `BENGALURU_CENTER`)

### Component Patterns

All client components declare `"use client"` as the very first line of the file (before imports). Server components have no directive.

Page components use default export:
```typescript
export default function ReportPage() { ... }
```

UI library components use named exports:
```typescript
export function Btn({ variant = "primary", size = "md", ...rest }: BtnProps) { ... }
```

Props interfaces use the `Props` suffix: `BtnProps`, `BiProps`, `PhotoCaptureProps`.

Inline state for page-level components is preferred over context. Functional updaters for state derived from previous state:
```typescript
setForm((f) => ({ ...f, lat: newLat, lng: newLng, locationSource: "manual_pin" }));
```

### App Router Conventions

- All Leaflet/map components must use `next/dynamic` with `ssr: false` — Leaflet uses `window`:
  ```typescript
  const LocationMap = dynamic(() => import("../components/LocationMap"), {
    ssr: false,
    loading: () => <div>Loading map…</div>,
  });
  ```
- `eslint-disable-next-line @next/next/no-img-element` with comment required when using raw `<img>` (justified for object URL preview images only)
- `// eslint-disable-next-line react-hooks/exhaustive-deps` with comment explaining the intentional omission required when ignoring deps in `useEffect`

### Import Organization

**Order (observed in `frontend/app/report/page.tsx`):**
1. React hooks and Next.js built-ins (`react`, `next/link`, `next/navigation`, `next/dynamic`)
2. Internal lib imports via `@/app/lib/...`
3. Internal component imports via `@/app/components/...`

**Path alias:** `@/` resolves to the `frontend/` directory root. Always use `@/app/lib/config` not relative paths like `../../lib/config`.

**Dynamic imports:** Use `next/dynamic` only for SSR-incompatible components (Leaflet maps).

**exifr quirk:** Must use `require()` (not `import`) because exifr@7 ships UMD:
```typescript
const exifrModule = require("exifr");
const exifr = (exifrModule.default ?? exifrModule) as { gps: (f: File) => Promise<...> };
```
This pattern appears in `frontend/app/report/page.tsx` and `frontend/app/components/PhotoCapture.tsx`.

### Environment Variable Conventions

All environment-variable-based config must live in `frontend/app/lib/config.ts`. Never inline `process.env.*` directly in component or page files.

Current exports from `frontend/app/lib/config.ts`:
- `API_BASE_URL` — client-side, public reports/map API (`NEXT_PUBLIC_API_URL ?? ""`)
- `ADMIN_API_BASE_URL` — hardcoded `""` (relative URLs via Next.js rewrites)
- `INTERNAL_API_URL` — server-side only (`INTERNAL_API_URL ?? "http://localhost:3001"`)

### adminApi Contracts

`frontend/app/admin/lib/adminApi.ts` imports from `config.ts`. Every fetch call must include `credentials: "include"` for HttpOnly cookie auth. Non-2xx responses must reject the returned Promise with an error containing the HTTP status code.

### ESLint Configuration

`frontend/.eslintrc.json`:
```json
{
  "extends": "next/core-web-vitals",
  "ignorePatterns": ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx"],
  "rules": {
    "@typescript-eslint/no-var-requires": "off"
  }
}
```

- Test files are excluded from linting
- `no-var-requires` is disabled to allow the `require("exifr")` UMD compat pattern
- `next/core-web-vitals` rules are otherwise enforced

### Styling Approach

Two coexisting styles (do not mix in the same component):

**Tailwind CSS** — legacy components only: `PhotoCapture.tsx`, `BilingualText.tsx`. Use Tailwind if modifying these files.

**CSS custom properties via inline `style` objects** — all new work: `report/page.tsx`, all `ui/` primitives, `redesign/` directory. Token names:
- Colors: `var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--ink)`, `var(--ink-2)`, `var(--muted)`, `var(--accent)`, `var(--accent-ink)`, `var(--border)`, `var(--border-strong)`, `var(--danger)`
- Radii: `var(--r-sm)`, `var(--r-md)`, `var(--r-lg)`, `var(--r-xl)`, `var(--r-full)`
- Shadows: `var(--shadow-md)`
- Fonts: `var(--font-sans)`, `var(--font-mono)`

New components added to `app/components/redesign/` or `app/components/ui/` must use the CSS custom property approach, not Tailwind.

### Comment Style (TypeScript)

- File-level JSDoc block describing purpose and contracts (see `frontend/app/admin/lib/adminApi.ts`)
- Requirement tags in inline comments: `// R-API-1`, `// AC-API-1-S1`, `// ABUSE-02`, `// BUG-2`, `// BUG-3`, `// BUG-4`
- Inline section headers: `// ─── Section Name ─────────────────────────────────`
- `eslint-disable` comments always include the rule name and a justification comment on the preceding line

---

*Convention analysis: 2026-05-20*
