# Admin Portal MVP Phase 2 — Acceptance Criteria Document
# Version: 1.0
# Date: 2026-03-07
# Author: prd-to-ac-converter agent
# Covers: Feature 1 (Super-Admin Protection), Feature 2 (Admin Profile Page), Feature 3 (Reports Map View)

---

## Prerequisite: Schema and Code Baseline

This document assumes the following as the confirmed baseline before Phase 2 work begins:

- `001_init.sql` is applied and stable (reports, status_history, spatial tables).
- `002_admin.sql` is applied: `admin_users` table with columns `id`, `email`, `password_hash`, `role` (user_role enum: `admin`|`reviewer`), `display_name` (TEXT nullable), `created_at`, `updated_at`, `is_active` (BOOLEAN), `last_login_at` (TIMESTAMPTZ nullable). `status_history.changed_by` FK to `admin_users(id)` exists.
- Admin auth subsystem (login, logout, `/api/admin/auth/me`, JWT middleware) is live per `admin-auth-ac.md`.
- Admin user management (GET/POST/DELETE `/api/admin/users`) is live per `admin-users-frontend-ac.md`.
- `AdminUserResponse` shape (current): `{id, email, role, display_name, is_active, created_at, last_login_at}`.
- `adminApi.ts` exports: `login`, `logout`, `getMe`, `getAdminReports`, `getAdminReport`, `updateReportStatus`, `deleteReport`, `getStats`, `getUsers`, `createUser`, `deactivateUser`.
- Sidebar nav links (current): Dashboard (`/admin`), Reports (`/admin/reports`), Users (`/admin/users`, admin-role only).

---

## New Error Codes Reserved for This Document

| Code | Domain | Sequence Range |
|------|--------|---------------|
| WB-SA-001 to WB-SA-099 | Super-Admin protection | New domain |
| WB-PR-001 to WB-PR-099 | Admin Profile page | New domain |
| WB-RM-001 to WB-RM-099 | Reports Map view | New domain |

> Note: These codes extend the existing registry in `error-codes.md`. No collision with existing WB-ADM-*, WB-ADMIN-AUTH-* ranges.

---

## Explicit Assumptions

The following assumptions are made due to missing product input. Each must be resolved by the product team before TDD test authoring begins on the affected requirements.

| ID | Question | Option A | Option B | Option C | Blocking? |
|----|----------|----------|----------|----------|-----------|
| ASSUMPTION-P2-SA-1 | Who can see the "Super Admin" badge in the Users table? | All authenticated admins and reviewers | Admin role only (reviewer sees user list but no badge) | Not applicable — reviewer cannot access /admin/users | YES — blocks SA-FE-2 |
| ASSUMPTION-P2-SA-2 | Can a super-admin deactivate themselves? | No — same 403 as deactivating any super-admin | Yes — self-deactivation of super-admin is permitted | No — return 400 distinct from the 403 for external deactivation attempts | YES — blocks SA-BE-3 edge cases |
| ASSUMPTION-P2-SA-3 | Is `is_super_admin` exposed in AdminUserResponse and API responses? | Yes — returned as a boolean field in all admin user responses | No — internal flag only; never returned in API | Returned only to admin role callers, not reviewers | YES — blocks SA-BE-2, SA-FE-2 |
| ASSUMPTION-P2-SA-4 | Can a second super-admin be created via POST /api/admin/users? | No — `is_super_admin` can only be set via migration/seeding; POST ignores or rejects the field | Yes — any admin can create another super-admin via API by passing `is_super_admin: true` | Reserved field: present in schema but always false for API-created users | YES — blocks SA-BE-5 |
| ASSUMPTION-P2-PR-1 | `display_name` maximum character length | 80 characters | 100 characters | 255 characters | YES — blocks PR-BE-1 validation |
| ASSUMPTION-P2-PR-2 | `display_name` minimum character length when provided | 2 characters (must not be whitespace-only) | 1 character (any non-empty string) | No minimum; empty string allowed | YES — blocks PR-BE-1 validation |
| ASSUMPTION-P2-PR-3 | New password minimum length for change-password | 12 characters (consistent with user creation rule) | 8 characters | Configurable via env var | YES — blocks PR-BE-3 |
| ASSUMPTION-P2-PR-4 | Password complexity rules beyond length | Length only (same as ASSUMPTION-ADM-3 Option A) | Length + uppercase + digit + special char | Configurable | YES — blocks PR-BE-3 (follow resolution of ASSUMPTION-ADM-3) |
| ASSUMPTION-P2-PR-5 | New password same as current password | Allowed (no same-password check) | Rejected with 400 "New password must differ from current password" | Warning shown but not blocked | NO — default: reject with 400 |
| ASSUMPTION-P2-PR-6 | Confirm-password field location | Frontend only (not sent to backend; backend receives only `current_password` + `new_password`) | Backend receives all three fields and validates match | Not included in UI | YES — blocks PR-FE-3 field count |
| ASSUMPTION-P2-PR-7 | Profile page role visibility | Role badge visible (read-only) using same role values as sidebar | Role not shown on profile page | Role shown as human-readable label only | NO — default: role badge shown, read-only |
| ASSUMPTION-P2-PR-8 | "Profile" nav link visibility | Visible to all authenticated users (admin and reviewer) | Visible to admin role only | Shown as icon without label | NO — default: visible to all authenticated users |
| ASSUMPTION-P2-RM-1 | Map pin color for `submitted` status | Gray (#6B7280) | Blue (#3B82F6) | Dark gray (#374151) | NO — default: gray (#6B7280) |
| ASSUMPTION-P2-RM-2 | Map pin color for `under_review` status | Amber (#F59E0B) | Orange (#F97316) | Yellow (#EAB308) | NO — default: amber (#F59E0B) |
| ASSUMPTION-P2-RM-3 | Map pin color for `resolved` status | Green (#22C55E) | Teal (#14B8A6) | Dark green (#16A34A) | NO — default: green (#22C55E) |
| ASSUMPTION-P2-RM-4 | Report load limit for map view | 200 most recent reports (stated in PRD) | All reports (no cap) | Configurable via UI control | NO — confirmed by PRD: 200 |
| ASSUMPTION-P2-RM-5 | Map initial zoom level | 12 (matches ASSUMPTION-16 default) | 11 (slightly wider) | 13 | NO — default: 12 |
| ASSUMPTION-P2-RM-6 | Description snippet length in popup | 100 characters, truncated with "…" | 150 characters | 80 characters | NO — default: 100 characters |
| ASSUMPTION-P2-RM-7 | Popup date format | DD MMM YYYY (matches established pattern) | ISO 8601 UTC | Relative time | NO — confirmed: DD MMM YYYY |
| ASSUMPTION-P2-RM-8 | Reports Map nav link visibility | Visible to all authenticated users (admin and reviewer) | Visible to admin role only | Sub-link under "Reports" nav item | NO — default: all authenticated users |
| ASSUMPTION-P2-RM-9 | Behavior when all 200 reports are fetched but filter yields zero visible pins | Show empty-state message on map | Show map with no pins, no message | Show error state | NO — default: show empty-state overlay on map |
| ASSUMPTION-P2-RM-10 | API pagination for map load | Single request with `?limit=200&page=1` | Multiple paginated requests aggregated client-side | Server-sent events stream | YES — blocks RM-BE-1 |

**Blocking assumptions requiring product team decision before TDD authoring:**
ASSUMPTION-P2-SA-1, P2-SA-2, P2-SA-3, P2-SA-4, P2-PR-1, P2-PR-2, P2-PR-3, P2-PR-4, P2-PR-6, P2-RM-10.

**Non-blocking assumptions (defaults stated above are assumed in all AC below; confirm to finalize):**
P2-PR-5, P2-PR-7, P2-PR-8, P2-RM-1 through P2-RM-9.

---

# FEATURE 1 — SUPER-ADMIN PROTECTION

## Feature Overview

The seeded first admin user (created via `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` env vars at startup) is permanently designated as a super-admin via an `is_super_admin` flag. This flag is set exclusively during the seed operation and cannot be set via the user-management API. Any attempt to deactivate the super-admin user via `DELETE /api/admin/users/:id` is rejected at the database query layer before any state change occurs, returning HTTP 403. The frontend reflects this protection by rendering a "Super Admin" badge on the user row and disabling the deactivate action for that user regardless of the authenticated caller's role.

---

## Requirements

### SA-BE-1 — Database Migration: Add `is_super_admin` Column

The system must add an `is_super_admin BOOLEAN NOT NULL DEFAULT FALSE` column to the `admin_users` table via migration `003_super_admin.sql`. All existing rows must have `is_super_admin = FALSE` post-migration.

**AC-SA-BE-1-S1 (Success — migration applies cleanly)**
- Given: The database has `002_admin.sql` applied and `admin_users` table exists with zero or more rows.
- When: `003_super_admin.sql` is executed.
- Then: The `admin_users` table gains a column `is_super_admin` of type `BOOLEAN`, with `NOT NULL` constraint and `DEFAULT FALSE`. All pre-existing rows have `is_super_admin = FALSE`. SQLx `cargo sqlx prepare` completes without error. The migration is recorded in `_sqlx_migrations`.

**AC-SA-BE-1-F1 (Failure — migration applied twice)**
- Given: `003_super_admin.sql` has already been applied to the database.
- When: The backend starts and `sqlx::migrate!` runs again.
- Then: The migration is a no-op (idempotent by SQLx checksum tracking). No error is returned. No duplicate column is created.

**AC-SA-BE-1-F2 (Failure — column already exists manually)**
- Given: The `is_super_admin` column was added manually outside of SQLx migration.
- When: `003_super_admin.sql` is executed.
- Then: The migration fails with a database error indicating the column already exists. The backend startup exits with a non-zero code. The error is logged at ERROR level including the migration name `003_super_admin.sql`.

> Test type: Integration (requires live DB). Priority: P0.

---

### SA-BE-2 — Seed Operation Sets `is_super_admin = TRUE`

The `admin_seed.rs` seed INSERT must set `is_super_admin = TRUE` for the seeded user. All other users created via the API must have `is_super_admin = FALSE`.

**AC-SA-BE-2-S1 (Success — seed creates super-admin row)**
- Given: `admin_users` table is empty. `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` env vars are set and valid.
- When: The backend starts and the seed function executes.
- Then: Exactly one row is inserted into `admin_users` with `is_super_admin = TRUE`. The row's `email` matches `ADMIN_SEED_EMAIL`. No other column values are altered from their defaults except `role = 'admin'`, `is_active = TRUE`, `is_super_admin = TRUE`.

**AC-SA-BE-2-S2 (Success — seed is no-op when rows exist)**
- Given: `admin_users` table already contains one or more rows (any `is_super_admin` value).
- When: The backend starts and the seed function executes.
- Then: No INSERT is performed. The existing rows are unmodified. The seed function logs an INFO-level message indicating it skipped seeding because the table is non-empty.

**AC-SA-BE-2-F1 (Failure — API-created user cannot be super-admin)**

[ASSUMPTION-P2-SA-4 assumed: Option A — `is_super_admin` field in POST body is ignored; API-created user always gets `is_super_admin = FALSE`.]

- Given: An authenticated admin calls `POST /api/admin/users` with a valid body that includes `"is_super_admin": true`.
- When: The request is processed.
- Then: The field is silently ignored. The created user has `is_super_admin = FALSE` in the database. The `AdminUserResponse` returned does not include `is_super_admin = true` for this user. HTTP 201 is returned.

> Test type: Unit (seed logic pure fn) + Integration (DB row verification). Priority: P0.

---

### SA-BE-3 — `deactivate_admin_user` Rejects Super-Admin Target

The `deactivate_admin_user` DB query function must check `is_super_admin` before setting `is_active = FALSE`. If the target user has `is_super_admin = TRUE`, the function must return `AppError::Forbidden` without modifying any row.

**AC-SA-BE-3-S1 (Success — non-super-admin deactivated)**
- Given: Target user exists in `admin_users` with `is_super_admin = FALSE` and `is_active = TRUE`. The caller has a valid admin-role JWT.
- When: `DELETE /api/admin/users/:id` is called with the target user's UUID.
- Then: The target user's `is_active` is set to `FALSE` in `admin_users`. `updated_at` is updated to `NOW()` (within 5 seconds of the request). HTTP 204 No Content is returned. No response body is present.

**AC-SA-BE-3-F1 (Failure — attempt to deactivate super-admin)**
- Given: Target user exists in `admin_users` with `is_super_admin = TRUE`. The caller has a valid admin-role JWT.
- When: `DELETE /api/admin/users/:id` is called with the super-admin's UUID.
- Then: The target user's `is_active` value remains unchanged in the database. HTTP 403 is returned. The response body is `Content-Type: application/json` and contains `{"error": "FORBIDDEN", "message": "COPY.admin.superAdmin.deactivateBlocked"}`. No partial state change has occurred.

**AC-SA-BE-3-F2 (Failure — reviewer attempts to deactivate super-admin)**
- Given: The caller has a valid reviewer-role JWT. The target user has `is_super_admin = TRUE`.
- When: `DELETE /api/admin/users/:id` is called.
- Then: HTTP 403 is returned with body `{"error": "FORBIDDEN", "message": "COPY.admin.auth.insufficientRole"}` (role check fires before super-admin check — auth layer rejects first). Target user is unmodified.

**AC-SA-BE-3-F3 (Failure — super-admin self-deactivation)**

[ASSUMPTION-P2-SA-2 assumed: Option A — super-admin cannot deactivate themselves; returns 403.]

- Given: The caller's JWT `sub` matches the UUID of the super-admin user.
- When: `DELETE /api/admin/users/:id` is called where `:id` equals the caller's own UUID and the caller is the super-admin.
- Then: HTTP 403 is returned with body `{"error": "FORBIDDEN", "message": "COPY.admin.superAdmin.deactivateBlocked"}`. No state change occurs.

> Test type: Unit (pure predicate fn checking `is_super_admin` flag) + Integration (full HTTP round-trip). Priority: P0.

---

### SA-BE-4 — `list_admin_users` Returns `is_super_admin` Field

[ASSUMPTION-P2-SA-3 assumed: Option A — `is_super_admin` is returned as a boolean field in all admin user responses.]

The `list_admin_users` query and `AdminUser` / `AdminUserResponse` structs must include `is_super_admin: bool`. The field must be present in every element of the `GET /api/admin/users` response array.

**AC-SA-BE-4-S1 (Success — list response includes `is_super_admin`)**
- Given: `admin_users` contains at least one row with `is_super_admin = TRUE` and at least one with `is_super_admin = FALSE`.
- When: `GET /api/admin/users` is called with a valid admin-role JWT.
- Then: HTTP 200 is returned. The response body is a JSON array. Each element contains the field `"is_super_admin"` as a boolean. The super-admin row has `"is_super_admin": true`. All other rows have `"is_super_admin": false`. No element omits the field.

**AC-SA-BE-4-F1 (Failure — `password_hash` must not appear)**
- Given: Any call to `GET /api/admin/users` with a valid JWT.
- When: The response body is inspected.
- Then: The string `"password_hash"` does not appear anywhere in the response JSON at any nesting level.

> Test type: Unit (AdminUserResponse serialization) + Integration (HTTP response shape). Priority: P0.

---

### SA-BE-5 — `create_admin_user` Always Persists `is_super_admin = FALSE`

`POST /api/admin/users` must always insert new users with `is_super_admin = FALSE`, regardless of any field present in the request body.

**AC-SA-BE-5-S1 (Success — new user has `is_super_admin = FALSE`)**
- Given: A valid admin-role JWT. The request body is `{"email": "new@example.com", "password": "ValidPass123!", "role": "reviewer"}`.
- When: `POST /api/admin/users` is called.
- Then: HTTP 201 is returned. The created user's row in `admin_users` has `is_super_admin = FALSE`. The `AdminUserResponse` body contains `"is_super_admin": false`.

**AC-SA-BE-5-F1 (Failure — `is_super_admin: true` in request body is ignored)**
- Given: A valid admin-role JWT. The request body is `{"email": "new@example.com", "password": "ValidPass123!", "role": "admin", "is_super_admin": true}`.
- When: `POST /api/admin/users` is called.
- Then: HTTP 201 is returned. The created user's row has `is_super_admin = FALSE` in the database. The `AdminUserResponse` contains `"is_super_admin": false`. No error is returned for the extra field.

> Test type: Unit + Integration. Priority: P1.

---

### SA-FE-1 — `AdminUser` Type Updated in `adminApi.ts`

The `AdminUser` TypeScript interface in `frontend/app/admin/lib/adminApi.ts` must add `is_super_admin: boolean` as a required field.

**AC-SA-FE-1-S1 (Success — type includes `is_super_admin`)**
- Given: The TypeScript compiler (`tsc --noEmit`) runs against the frontend codebase.
- When: Any code accesses `AdminUser.is_super_admin`.
- Then: The TypeScript compiler reports no type error for `is_super_admin` access on `AdminUser`. Accessing a non-existent property on `AdminUser` still produces a compiler error (type safety is not weakened by using `any`).

**AC-SA-FE-1-F1 (Failure — old type used without `is_super_admin`)**
- Given: `is_super_admin` is absent from the `AdminUser` interface.
- When: `UserManagementTable` references `user.is_super_admin`.
- Then: TypeScript compiler reports error `TS2339: Property 'is_super_admin' does not exist on type 'AdminUser'`. The build fails.

> Test type: Unit (TypeScript compile-time check). Priority: P0.

---

### SA-FE-2 — `UserManagementTable` Shows Crown Badge and Disables Deactivate Button

[ASSUMPTION-P2-SA-1 assumed: Option A — all authenticated users who can view the table see the badge.]
[ASSUMPTION-P2-SA-3 assumed: Option A — `is_super_admin` is returned by the API and available on `AdminUser`.]

The `UserManagementTable` component must render a "Super Admin" badge (visual crown indicator) on any row where `user.is_super_admin === true`, and the deactivate button for that row must be rendered in a disabled state.

**AC-SA-FE-2-S1 (Success — super-admin row shows badge and disabled button)**
- Given: The `users` prop contains one user with `is_super_admin: true` and one with `is_super_admin: false`.
- When: `UserManagementTable` renders.
- Then: The row for `is_super_admin: true` contains an element with `data-testid="super-admin-badge"` (or `aria-label="Super Admin"`) that is visible in the DOM. The deactivate button for that row has the HTML `disabled` attribute set. The deactivate button for the `is_super_admin: false` row does not have the `disabled` attribute.

**AC-SA-FE-2-S2 (Success — disabled deactivate button is not interactive)**
- Given: The super-admin row is rendered with the deactivate button in disabled state.
- When: A user clicks the disabled deactivate button.
- Then: No API call to `deactivateUser` is made. No confirmation dialog opens. No state change occurs.

**AC-SA-FE-2-F1 (Failure — badge absent for non-super-admin)**
- Given: The `users` prop contains a user with `is_super_admin: false`.
- When: `UserManagementTable` renders.
- Then: No element with `data-testid="super-admin-badge"` or `aria-label="Super Admin"` is present in that user's row. The deactivate button for that row is not disabled.

**AC-SA-FE-2-F2 (Failure — tooltip or accessible description on disabled button)**
- Given: The super-admin row's deactivate button is rendered as disabled.
- When: The button's accessible name and description are inspected.
- Then: The button has an accessible description (via `aria-describedby` pointing to copy `COPY.admin.superAdmin.deactivateTooltip` or `title` attribute with that copy value) explaining why it is disabled. The description text placeholder is `COPY.admin.superAdmin.deactivateTooltip`.

> Test type: Unit (React Testing Library). Priority: P0.

---

## SA Edge Case Matrix

| Edge Case | Trigger Condition | Expected System Behavior | User-Facing Message / Copy Placeholder | Test Type |
|-----------|------------------|--------------------------|----------------------------------------|-----------|
| EC-SA-1: Migration on empty DB | `003_super_admin.sql` runs against a DB with no `admin_users` rows | Column added; no rows affected; migration recorded | None | Integration |
| EC-SA-2: `DELETE` with `is_super_admin = TRUE` target | Valid admin JWT; target UUID resolves to super-admin row | 403 returned; row untouched in DB | `COPY.admin.superAdmin.deactivateBlocked` | Integration |
| EC-SA-3: GET /api/admin/users returns mixed rows | Seeded super-admin + API-created users in same list | All rows present; `is_super_admin` correctly `true`/`false` per row | None | Integration |
| EC-SA-4: Two super-admins in DB (manual DB intervention) | DB manually has two rows with `is_super_admin = TRUE` | Both rows show badge; both deactivate buttons disabled | Badge shown for each | Unit (FE) |
| EC-SA-5: `POST /api/admin/users` body contains `is_super_admin: true` | Attacker or mis-configured client sends the field | Field silently ignored; user created with `is_super_admin = FALSE` | None (normal 201 response) | Integration |
| EC-SA-6: Reviewer role calls `DELETE /api/admin/users/:id` on super-admin | Reviewer JWT + super-admin target UUID | 403 due to role check (fires before super-admin check) | `COPY.admin.auth.insufficientRole` | Integration |
| EC-SA-7: Super-admin calls `DELETE` on themselves | JWT sub = target UUID; caller is super-admin | 403 (super-admin guard fires) | `COPY.admin.superAdmin.deactivateBlocked` | Integration |

---

## SA Error Codes

| Error Code | Trigger Condition | Internal Log Message | User-Facing Message Copy Placeholder | Recovery Action |
|------------|------------------|----------------------|--------------------------------------|-----------------|
| WB-SA-001 | `DELETE /api/admin/users/:id` where target has `is_super_admin = TRUE` | `WARN: deactivate_admin_user blocked — target is_super_admin=true user_id={uuid}` | `COPY.admin.superAdmin.deactivateBlocked` | None — button is disabled in UI before API is called |
| WB-SA-002 | Migration `003_super_admin.sql` fails to apply (column exists or DB error) | `ERROR: migration 003_super_admin failed: {db_error}` | None — startup failure | Ops: check DB state, remove duplicate column if present |

---

## SA Security Considerations

- The `is_super_admin` guard in `deactivate_admin_user` must execute as the first check inside that function, before any other DB mutation, to prevent TOCTOU (time-of-check-time-of-use) scenarios where the row is modified between check and update.
- The check must be a single atomic database operation (e.g., `UPDATE ... WHERE id = $1 AND is_super_admin = FALSE RETURNING id`) rather than a two-step SELECT then UPDATE, to eliminate the TOCTOU window entirely.
- `is_super_admin` must never be writable via any API endpoint — only the seed INSERT and future manual migrations may set it to `TRUE`.
- `password_hash` must remain absent from `AdminUserResponse` in all API responses, including the new `is_super_admin`-augmented responses. This is a regression guard.

---

# FEATURE 2 — ADMIN PROFILE PAGE

## Feature Overview

Each authenticated admin user can access a profile page at `/admin/profile`. The page displays their email (read-only), role badge (read-only), and display name (editable). A separate "Change Password" section allows the user to change their own password by providing their current password, a new password, and a confirmation of the new password. The confirmation field exists only on the frontend. Two new backend endpoints support these mutations: `PATCH /api/admin/auth/profile` for display name updates and `POST /api/admin/auth/change-password` for password changes. Both endpoints are scoped to the currently authenticated user (identified by JWT `sub` claim) — an admin cannot update another admin's profile or password via these endpoints.

---

## Requirements

### PR-BE-1 — `PATCH /api/admin/auth/profile` Endpoint

Accepts `UpdateProfileRequest { display_name: Option<String> }`. Updates the `display_name` column of the row identified by JWT `sub`. Returns updated `AdminUserResponse` on success.

[ASSUMPTION-P2-PR-1 assumed: 80 character maximum for `display_name`.]
[ASSUMPTION-P2-PR-2 assumed: Minimum 2 characters when provided; whitespace-only strings are rejected.]

**AC-PR-BE-1-S1 (Success — display name updated)**
- Given: A valid JWT (any role). The request body is `{"display_name": "Ops Lead"}` (a string of 2–80 non-whitespace-only characters).
- When: `PATCH /api/admin/auth/profile` is called.
- Then: HTTP 200 is returned. The response body is `Content-Type: application/json` and contains a full `AdminUserResponse` object where `display_name` equals `"Ops Lead"`. The `admin_users` row for JWT `sub` has `display_name = 'Ops Lead'` and `updated_at` refreshed to within 5 seconds of the request time.

**AC-PR-BE-1-S2 (Success — display name cleared to null)**
- Given: A valid JWT. The request body is `{"display_name": null}`.
- When: `PATCH /api/admin/auth/profile` is called.
- Then: HTTP 200 is returned. `display_name` in the response is `null`. The `admin_users` row for JWT `sub` has `display_name = NULL`.

**AC-PR-BE-1-S3 (Success — empty body / no-op update)**
- Given: A valid JWT. The request body is `{}` (no fields present).
- When: `PATCH /api/admin/auth/profile` is called.
- Then: HTTP 200 is returned. The `AdminUserResponse` reflects the current state of the user with no changes. No DB write occurs (or an idempotent write with identical values — either is acceptable).

**AC-PR-BE-1-F1 (Failure — `display_name` exceeds 80 characters)**
- Given: A valid JWT. The request body has `display_name` set to a string of 81 characters.
- When: `PATCH /api/admin/auth/profile` is called.
- Then: HTTP 400 is returned. Response body: `{"error": "VALIDATION_ERROR", "message": "COPY.admin.profile.displayNameTooLong", "field": "display_name", "max_length": 80}`. The `admin_users` row is not modified.

**AC-PR-BE-1-F2 (Failure — `display_name` is whitespace-only)**
- Given: A valid JWT. The request body has `display_name` set to `"   "` (spaces only).
- When: `PATCH /api/admin/auth/profile` is called.
- Then: HTTP 400 is returned. Response body: `{"error": "VALIDATION_ERROR", "message": "COPY.admin.profile.displayNameBlank", "field": "display_name"}`. The `admin_users` row is not modified.

**AC-PR-BE-1-F3 (Failure — `display_name` below minimum length)**
- Given: A valid JWT. The request body has `display_name` set to `"A"` (1 character).
- When: `PATCH /api/admin/auth/profile` is called.
- Then: HTTP 400 is returned. Response body: `{"error": "VALIDATION_ERROR", "message": "COPY.admin.profile.displayNameTooShort", "field": "display_name", "min_length": 2}`. The `admin_users` row is not modified.

**AC-PR-BE-1-F4 (Failure — no JWT cookie)**
- Given: The request is made without an `admin_token` cookie.
- When: `PATCH /api/admin/auth/profile` is called.
- Then: HTTP 401 is returned with body `{"error": "UNAUTHORIZED", "message": "COPY.admin.auth.missingToken"}`. No DB access occurs.

**AC-PR-BE-1-F5 (Failure — JWT user no longer exists in DB)**
- Given: The JWT is valid and not expired. The row for JWT `sub` has been deleted from `admin_users` (external DB operation).
- When: `PATCH /api/admin/auth/profile` is called.
- Then: HTTP 404 is returned. Response body: `{"error": "NOT_FOUND", "message": "COPY.admin.profile.userNotFound"}`. No state change occurs.

> Test type: Unit (validation logic) + Integration (HTTP + DB). Priority: P0 for F4; P1 for S1-S3, F1-F3; P2 for F5.

---

### PR-BE-2 — `PATCH /api/admin/auth/profile` Does Not Modify Other Users

The endpoint must apply changes exclusively to the row identified by JWT `sub`. No path parameter for target user ID is accepted.

**AC-PR-BE-2-S1 (Success — only caller's own row is updated)**
- Given: Two admin users exist (A and B). Caller is A (JWT sub = A's UUID). Request body: `{"display_name": "Updated Name"}`.
- When: `PATCH /api/admin/auth/profile` is called.
- Then: Admin user A's `display_name` is updated. Admin user B's `display_name` is unchanged. HTTP 200 returned with A's updated `AdminUserResponse`.

> Test type: Integration. Priority: P1.

---

### PR-BE-3 — `POST /api/admin/auth/change-password` Endpoint

Accepts `ChangePasswordRequest { current_password: String, new_password: String }`. Validates current password via Argon2 verify, hashes new password with Argon2id, updates `password_hash`. Invalidates no tokens (stateless JWT — no server-side revocation per ASSUMPTION-AUTH-18).

[ASSUMPTION-P2-PR-3 assumed: 12-character minimum for new_password, consistent with user-creation rule.]
[ASSUMPTION-P2-PR-4 assumed: Length-only rule (follows ASSUMPTION-ADM-3 Option A default).]
[ASSUMPTION-P2-PR-5 assumed: Same-as-current password is rejected with 400.]

**AC-PR-BE-3-S1 (Success — password changed)**
- Given: A valid JWT. `current_password` matches the Argon2 hash stored for the JWT `sub` user. `new_password` is at least 12 characters, not whitespace-only, and differs from `current_password`.
- When: `POST /api/admin/auth/change-password` is called.
- Then: HTTP 200 is returned. Response body: `{"message": "COPY.admin.profile.passwordChanged"}`. The `admin_users` row for JWT `sub` has `password_hash` updated to a new Argon2id hash. `updated_at` is refreshed to within 5 seconds of the request time. The previous `password_hash` value is no longer valid for Argon2 verification. The new password is not logged at any log level.

**AC-PR-BE-3-F1 (Failure — wrong current password)**
- Given: A valid JWT. `current_password` does not match the stored Argon2 hash.
- When: `POST /api/admin/auth/change-password` is called.
- Then: HTTP 401 is returned. Response body: `{"error": "UNAUTHORIZED", "message": "COPY.admin.profile.wrongCurrentPassword"}`. `password_hash` is not modified in the DB.

**AC-PR-BE-3-F2 (Failure — new password too short)**
- Given: A valid JWT. `current_password` is correct. `new_password` is fewer than 12 characters.
- When: `POST /api/admin/auth/change-password` is called.
- Then: HTTP 400 is returned. Response body: `{"error": "VALIDATION_ERROR", "message": "COPY.admin.profile.newPasswordTooShort", "field": "new_password", "min_length": 12}`. `password_hash` is not modified.

**AC-PR-BE-3-F3 (Failure — new password same as current)**
- Given: A valid JWT. `current_password` is correct. `new_password` equals `current_password` (identical plaintext string).
- When: `POST /api/admin/auth/change-password` is called.
- Then: HTTP 400 is returned. Response body: `{"error": "VALIDATION_ERROR", "message": "COPY.admin.profile.newPasswordSameAsCurrent", "field": "new_password"}`. `password_hash` is not modified.

**AC-PR-BE-3-F4 (Failure — `current_password` or `new_password` field missing)**
- Given: A valid JWT. The request body omits either `current_password` or `new_password` (or both).
- When: `POST /api/admin/auth/change-password` is called.
- Then: HTTP 400 is returned. Response body: `{"error": "VALIDATION_ERROR", "message": "COPY.admin.profile.requiredFields", "missing_fields": ["<list of missing field names>"]}`. No Argon2 operation is performed.

**AC-PR-BE-3-F5 (Failure — no JWT cookie)**
- Given: The request has no `admin_token` cookie.
- When: `POST /api/admin/auth/change-password` is called.
- Then: HTTP 401 is returned. Body: `{"error": "UNAUTHORIZED", "message": "COPY.admin.auth.missingToken"}`. No DB access occurs.

**AC-PR-BE-3-F6 (Failure — timing safety: current_password check must not short-circuit on nonexistent user)**
- Given: A JWT `sub` UUID that does not correspond to any row in `admin_users`.
- When: `POST /api/admin/auth/change-password` is called with any body.
- Then: HTTP 404 is returned. Response body: `{"error": "NOT_FOUND", "message": "COPY.admin.profile.userNotFound"}`. The response time must not be measurably shorter than a request where the user exists but the password is wrong (no timing oracle — a dummy Argon2 verify must run even for nonexistent users).

> Test type: Unit (validation + Argon2 mock) + Integration (DB hash comparison). Priority: P0 for F1, F5; P1 for S1, F2-F4; P2 for F6.

---

### PR-BE-4 — New Request DTOs are Validated at Deserialization

`UpdateProfileRequest` and `ChangePasswordRequest` must be deserialized from JSON request bodies. Malformed JSON or wrong field types must return 400 before handler logic executes.

**AC-PR-BE-4-S1 (Success — valid JSON deserializes)**
- Given: A valid JWT. The request body is valid JSON with the correct field types.
- When: Either `PATCH /api/admin/auth/profile` or `POST /api/admin/auth/change-password` is called.
- Then: Deserialization succeeds and handler logic executes.

**AC-PR-BE-4-F1 (Failure — malformed JSON)**
- Given: A valid JWT. The request body is `{invalid json`.
- When: Either endpoint is called.
- Then: HTTP 400 is returned. Response body includes `{"error": "BAD_REQUEST"}`. No handler logic executes.

**AC-PR-BE-4-F2 (Failure — `display_name` field is a number)**
- Given: A valid JWT. Request body to `PATCH /api/admin/auth/profile` is `{"display_name": 42}`.
- When: The request is processed.
- Then: HTTP 400 is returned with a `{"error": "BAD_REQUEST"}` body. The `admin_users` row is not modified.

> Test type: Unit. Priority: P1.

---

### PR-BE-5 — Idempotency and Concurrency

**AC-PR-BE-5-S1 (Success — identical PATCH sent twice)**
- Given: A valid JWT. The same `PATCH /api/admin/auth/profile` body is sent twice in sequence.
- When: Both requests complete.
- Then: Both return HTTP 200. The DB row has the final value from the second request. `updated_at` reflects the second request's timestamp. No error occurs on the second call.

**AC-PR-BE-5-F1 (Failure — concurrent password changes: second wins)**
- Given: Two concurrent `POST /api/admin/auth/change-password` requests for the same user, each with the correct current password.
- When: Both requests execute.
- Then: One request returns HTTP 200 (password changed). The other returns HTTP 401 (wrong current password — the winner's hash is already stored). The database is in a consistent state with exactly one of the two new passwords stored. No partial/corrupted hash is written.

> Test type: Integration (concurrency test). Priority: P2.

---

### PR-FE-1 — New `updateProfile` and `changePassword` Functions in `adminApi.ts`

Two new exported async functions must be added to `frontend/app/admin/lib/adminApi.ts`:
- `updateProfile(data: UpdateProfilePayload): Promise<AdminUser>` — calls `PATCH /api/admin/auth/profile` with `credentials: 'include'`.
- `changePassword(data: ChangePasswordPayload): Promise<void>` — calls `POST /api/admin/auth/change-password` with `credentials: 'include'`.

New TypeScript interfaces must be added:
- `UpdateProfilePayload { display_name?: string | null }`
- `ChangePasswordPayload { current_password: string; new_password: string }`

**AC-PR-FE-1-S1 (Success — `updateProfile` sends correct request)**
- Given: The `adminApi.ts` module is imported.
- When: `updateProfile({ display_name: "New Name" })` is called.
- Then: A `fetch` call is made to `${BASE}/api/admin/auth/profile` with `method: "PATCH"`, `Content-Type: application/json`, `credentials: "include"`, and body `'{"display_name":"New Name"}'`. On a mocked 200 response returning a valid `AdminUser` JSON, the function resolves to an `AdminUser` object.

**AC-PR-FE-1-S2 (Success — `changePassword` sends correct request)**
- Given: The `adminApi.ts` module is imported.
- When: `changePassword({ current_password: "OldPass123!", new_password: "NewPass456!" })` is called.
- Then: A `fetch` call is made to `${BASE}/api/admin/auth/change-password` with `method: "POST"`, `Content-Type: application/json`, `credentials: "include"`, and body containing both `current_password` and `new_password` fields. On a mocked 200 response, the function resolves to `void` (or `undefined`).

**AC-PR-FE-1-F1 (Failure — `updateProfile` rejects on non-2xx)**
- Given: The mocked `fetch` returns HTTP 400.
- When: `updateProfile(...)` is called.
- Then: The returned Promise rejects with an error whose message includes `"HTTP 400"`.

**AC-PR-FE-1-F2 (Failure — `changePassword` rejects on 401)**
- Given: The mocked `fetch` returns HTTP 401.
- When: `changePassword(...)` is called.
- Then: The returned Promise rejects with an error whose message includes `"HTTP 401"`.

> Test type: Unit (Jest mock fetch). Priority: P1.

---

### PR-FE-2 — `/admin/profile` Page: Profile Display

New page at `frontend/app/admin/profile/page.tsx`. The page is a Client Component (contains interactive form elements). On mount it calls `getMe()` to retrieve the current user's profile.

[ASSUMPTION-P2-PR-7 assumed: Role badge shown, read-only.]
[ASSUMPTION-P2-PR-8 assumed: "Profile" nav link visible to all authenticated users.]

**AC-PR-FE-2-S1 (Success — profile data renders correctly)**
- Given: The page is rendered. `getMe()` mock resolves with `{email: "ops@example.com", role: "admin", display_name: "Ops Lead", is_active: true, ...}`.
- When: The page finishes loading.
- Then: An element displaying `"ops@example.com"` is present and has no form input (it is read-only — rendered as text or a disabled/readonly input). An element displaying the role `"admin"` as a badge is present. A text input for `display_name` is present with initial value `"Ops Lead"`. The page title (visible heading) contains copy placeholder `COPY.admin.profile.pageTitle`.

**AC-PR-FE-2-S2 (Success — null display name renders empty input)**
- Given: `getMe()` resolves with `display_name: null`.
- When: The page finishes loading.
- Then: The `display_name` text input is present with an empty value (`""`). No null/undefined text is rendered in the field.

**AC-PR-FE-2-F1 (Failure — `getMe()` returns 401 — session expired)**
- Given: `getMe()` rejects with `"HTTP 401"`.
- When: The page attempts to load profile data.
- Then: The user is redirected to `/admin/login`. No partial profile UI is rendered. The redirect occurs within 2 seconds of the error.

**AC-PR-FE-2-F2 (Failure — `getMe()` returns 5xx — server error)**
- Given: `getMe()` rejects with `"HTTP 500"`.
- When: The page attempts to load profile data.
- Then: An inline error message is rendered with copy placeholder `COPY.admin.profile.loadError`. A "Retry" button is present. Clicking "Retry" calls `getMe()` again. No partial profile data is rendered.

> Test type: Unit (React Testing Library). Priority: P1.

---

### PR-FE-3 — `/admin/profile` Page: Display Name Edit

The display name field is editable inline. A "Save" button triggers `updateProfile`. Success and error states are rendered.

**AC-PR-FE-3-S1 (Success — display name saved)**
- Given: The profile page is loaded. The `display_name` input has value `"Ops Lead"`. The user changes it to `"City Ops"`.
- When: The user clicks the "Save" button (copy: `COPY.admin.profile.saveButton`).
- Then: `updateProfile({ display_name: "City Ops" })` is called exactly once. While the request is in-flight, the "Save" button is disabled and shows copy placeholder `COPY.admin.profile.savingButton`. On success (mock returns updated `AdminUser`), the input retains value `"City Ops"`. A success toast or inline message with copy `COPY.admin.profile.saveSuccess` is shown for at least 3 seconds. The "Save" button returns to its enabled, normal-label state.

**AC-PR-FE-3-F1 (Failure — save rejected by API — 400 validation)**
- Given: The profile page is loaded. `updateProfile` mock rejects with `"HTTP 400"` and a response body containing `"COPY.admin.profile.displayNameTooLong"`.
- When: The user clicks "Save".
- Then: The "Save" button returns to enabled state. An inline error message is shown adjacent to the `display_name` field with copy `COPY.admin.profile.saveError`. The input retains the attempted value (not reverted to the original). The user can correct and retry.

**AC-PR-FE-3-F2 (Failure — save rejected — 401 session expired)**
- Given: `updateProfile` mock rejects with `"HTTP 401"`.
- When: The user clicks "Save".
- Then: The user is redirected to `/admin/login`. No success message is shown.

**AC-PR-FE-3-F3 (Failure — empty display name field submitted)**
- Given: The user clears the `display_name` input to empty string `""`.
- When: The user clicks "Save".
- Then: The form does NOT call `updateProfile`. An inline validation message is shown adjacent to the field with copy `COPY.admin.profile.displayNameTooShort`. The Save button returns to enabled state.

> Note: Per ASSUMPTION-P2-PR-2, a blank display_name string of < 2 chars is invalid. Null (clearing) is valid. The UX must distinguish between "clear to null" (valid — show a separate "Clear" action if the product desires, or treat empty string as null) and "set to 1-char string" (invalid). [ASSUMPTION-P2-PR-9: Treat empty string submission as null (clear), not as a validation error.] Default: treat empty string as `null` — send `{"display_name": null}` to backend.

**AC-PR-FE-3-F4 (Failure — no change made — Save button disabled until dirty)**
- Given: The profile page is loaded with `display_name: "Ops Lead"`. The user has not changed the input value.
- When: The form is in its initial state.
- Then: The "Save" button is disabled. No `updateProfile` call is made if the user somehow activates it. Once the user modifies the input value, the "Save" button becomes enabled.

> Test type: Unit (React Testing Library). Priority: P1.

---

### PR-FE-4 — `/admin/profile` Page: Change Password Section

[ASSUMPTION-P2-PR-6 assumed: Option A — confirm-password field is frontend-only; backend receives only `current_password` and `new_password`.]

**AC-PR-FE-4-S1 (Success — password changed successfully)**
- Given: The profile page is loaded. The "Change Password" section is visible. The user fills in: `current_password = "OldPass123!"`, `new_password = "NewPass456!"`, `confirm_password = "NewPass456!"`.
- When: The user clicks "Change Password" button (copy: `COPY.admin.profile.changePasswordButton`).
- Then: `changePassword({ current_password: "OldPass123!", new_password: "NewPass456!" })` is called exactly once (confirm_password is NOT sent to the API). While in-flight, the button is disabled and shows copy `COPY.admin.profile.changingPasswordButton`. On success, all three fields are cleared to empty string. A success message is shown with copy `COPY.admin.profile.passwordChangeSuccess`.

**AC-PR-FE-4-F1 (Failure — passwords do not match)**
- Given: The user fills `new_password = "NewPass456!"` and `confirm_password = "DifferentPass!"`.
- When: The user clicks "Change Password".
- Then: `changePassword` is NOT called. An inline validation error is shown adjacent to the `confirm_password` field with copy `COPY.admin.profile.passwordMismatch`. Both `new_password` and `confirm_password` fields retain their values.

**AC-PR-FE-4-F2 (Failure — new password too short)**
- Given: The user fills `new_password = "short"` (fewer than 12 characters) and `confirm_password = "short"`.
- When: The user clicks "Change Password".
- Then: `changePassword` is NOT called (client-side validation fires first). An inline validation error is shown adjacent to the `new_password` field with copy `COPY.admin.profile.newPasswordTooShort`.

**AC-PR-FE-4-F3 (Failure — API returns 401 wrong current password)**
- Given: All fields are valid. `changePassword` mock rejects with `"HTTP 401"`.
- When: The user clicks "Change Password".
- Then: The button returns to enabled state. An inline error is shown adjacent to the `current_password` field with copy `COPY.admin.profile.wrongCurrentPassword`. The `current_password` field is cleared. `new_password` and `confirm_password` fields are cleared.

**AC-PR-FE-4-F4 (Failure — any required field is empty)**
- Given: The user leaves any of `current_password`, `new_password`, or `confirm_password` empty.
- When: The user clicks "Change Password".
- Then: `changePassword` is NOT called. An inline validation error is shown adjacent to each empty field with copy `COPY.admin.profile.fieldRequired`. The "Change Password" button remains enabled.

**AC-PR-FE-4-F5 (Failure — password fields are masked)**
- Given: The profile page is rendered with the Change Password section visible.
- When: The DOM is inspected.
- Then: All three password fields (`current_password`, `new_password`, `confirm_password`) have `type="password"`. No plaintext password value is rendered in the DOM.

> Test type: Unit (React Testing Library). Priority: P1 for S1, F1-F4; P0 for F5.

---

### PR-FE-5 — Sidebar Nav Link: "Profile"

A "Profile" nav link must be added to the admin sidebar, visible to all authenticated users (admin and reviewer).

[ASSUMPTION-P2-PR-8 assumed: visible to all authenticated users.]

**AC-PR-FE-5-S1 (Success — nav link present for admin role)**
- Given: The admin layout is rendered with `role = "admin"`.
- When: The sidebar is inspected.
- Then: A link element with `href="/admin/profile"` is present in the sidebar nav list. Its visible label text contains copy placeholder `COPY.admin.nav.profile`.

**AC-PR-FE-5-S2 (Success — nav link present for reviewer role)**
- Given: The admin layout is rendered with `role = "reviewer"`.
- When: The sidebar is inspected.
- Then: A link element with `href="/admin/profile"` is present. Its label text contains `COPY.admin.nav.profile`. The Users nav link is absent (role-gated as before).

> Test type: Unit (React Testing Library on layout component). Priority: P1.

---

## PR Edge Case Matrix

| Edge Case | Trigger Condition | Expected System Behavior | User-Facing Message / Copy Placeholder | Test Type |
|-----------|------------------|--------------------------|----------------------------------------|-----------|
| EC-PR-1: `display_name` exactly 80 chars | PATCH body has 80-char `display_name` | Accepted; 200 returned; DB updated | None | Integration |
| EC-PR-2: `display_name` exactly 81 chars | PATCH body has 81-char `display_name` | 400 returned; DB not modified | `COPY.admin.profile.displayNameTooLong` | Integration |
| EC-PR-3: `display_name` with leading/trailing whitespace | PATCH body: `"  Ops  "` (non-empty after trimming) | [ASSUMPTION-P2-PR-10: Trim and store] — 200 accepted; stored as `"Ops"`. Flag for product decision: Option A = trim silently; Option B = reject with 400; Option C = store as-is. Default: Option C (store as-is). | None (assumed store as-is) | Integration |
| EC-PR-4: `new_password` exactly 12 chars | POST change-password with 12-char new_password | 200 returned; password changed | `COPY.admin.profile.passwordChanged` | Integration |
| EC-PR-5: `new_password` exactly 11 chars | POST change-password with 11-char new_password | 400 returned; DB not modified | `COPY.admin.profile.newPasswordTooShort` | Integration |
| EC-PR-6: Concurrent PATCH to same profile | Two simultaneous PATCH requests with different display_names | Last-write-wins; both return 200; DB has one consistent value | None | Integration |
| EC-PR-7: User deleted between `getMe()` and PATCH | Race: user row deleted externally between page load and Save click | PATCH returns 404; frontend shows error; no redirect to login (user not authenticated issue, just data issue) | `COPY.admin.profile.userNotFound` | Integration |
| EC-PR-8: `current_password` correct; `new_password` = `current_password` | Same plaintext password for old and new | 400 returned; DB not modified | `COPY.admin.profile.newPasswordSameAsCurrent` | Integration |
| EC-PR-9: Password fields visible in DOM | Any profile page load | All `<input type="password">` confirmed; no `type="text"` on password fields | None | Unit (FE) |
| EC-PR-10: Profile page without valid JWT (direct URL navigation) | Unauthenticated request to `/admin/profile` | Admin layout redirects to `/admin/login` (existing auth check in layout.tsx) | None — redirect | E2E |

---

## PR Error Codes

| Error Code | Trigger Condition | Internal Log Message | User-Facing Copy Placeholder | Recovery Action |
|------------|------------------|----------------------|------------------------------|-----------------|
| WB-PR-001 | `display_name` exceeds 80 characters | `WARN: update_profile validation failed: display_name too long user_id={uuid}` | `COPY.admin.profile.displayNameTooLong` | User shortens name |
| WB-PR-002 | `display_name` is whitespace-only | `WARN: update_profile validation failed: display_name blank user_id={uuid}` | `COPY.admin.profile.displayNameBlank` | User enters valid name |
| WB-PR-003 | `display_name` below 2-character minimum | `WARN: update_profile validation failed: display_name too short user_id={uuid}` | `COPY.admin.profile.displayNameTooShort` | User enters 2+ chars |
| WB-PR-004 | Wrong `current_password` on change-password | `WARN: change_password failed: wrong current password user_id={uuid}` (no password values logged) | `COPY.admin.profile.wrongCurrentPassword` | User re-enters correct current password |
| WB-PR-005 | `new_password` fewer than 12 chars | `WARN: change_password validation failed: new_password too short user_id={uuid}` | `COPY.admin.profile.newPasswordTooShort` | User chooses a longer password |
| WB-PR-006 | `new_password` same as `current_password` | `WARN: change_password validation failed: same password user_id={uuid}` | `COPY.admin.profile.newPasswordSameAsCurrent` | User chooses a different new password |
| WB-PR-007 | Missing required fields in `ChangePasswordRequest` | `WARN: change_password deserialization error user_id={uuid}` | `COPY.admin.profile.requiredFields` | User fills all fields |
| WB-PR-008 | `getMe()` fails on profile page load (non-401) | `ERROR: profile page getMe failed status={status}` | `COPY.admin.profile.loadError` | Retry button |
| WB-PR-009 | `updateProfile` API call fails (non-401) | `ERROR: update_profile handler db_error={msg} user_id={uuid}` | `COPY.admin.profile.saveError` | User retries save |

---

## PR Security Considerations

- `current_password` and `new_password` values must never appear in any server-side log at any log level. This is an absolute constraint, not a "best practice."
- The `admin_update_profile` handler must use JWT `sub` as the sole target user identifier. There is no URL parameter for user ID. This prevents privilege escalation (Admin A updating Admin B's profile).
- The `admin_change_password` handler must run the Argon2 verify step even when the target user does not exist in the database (dummy hash comparison), to prevent timing-based user enumeration via the profile endpoint.
- The response to `POST /api/admin/auth/change-password` must not include any representation of the old or new password hash.
- The frontend must never log password field values to the browser console.
- All three password input fields must use `type="password"` — this is a P0 requirement (AC-PR-FE-4-F5), not a styling preference.

---

# FEATURE 3 — REPORTS MAP VIEW

## Feature Overview

A new page at `/admin/reports/map` presents all reports as interactive pins on a Leaflet map, providing admins and reviewers with a spatial view of reported issues. Pins are color-coded by report status (gray = submitted, amber = under_review, green = resolved). Clicking a pin opens a popup with the report's category, severity, status, creation date (DD MMM YYYY), and a description snippet of up to 100 characters. Category and status filter controls above the map reduce the visible pin set client-side without additional API calls. The page fetches up to 200 reports in a single API call using the existing `GET /api/admin/reports` endpoint. The map is centered on `BENGALURU_CENTER` (12.9716N, 77.5946E) at zoom level 12. The Leaflet map component is loaded via `dynamic()` with `ssr: false`.

---

## Requirements

### RM-BE-1 — No New Backend Endpoints; Existing Endpoint Used

The reports map uses `GET /api/admin/reports?limit=200&page=1` with a valid admin JWT. No new backend routes are introduced by this feature. Existing `AdminReport` response shape (including full-precision `latitude` and `longitude` as FLOAT8) is used as-is.

**AC-RM-BE-1-S1 (Success — existing endpoint returns 200 reports)**
- Given: The database contains 200 or more reports. A valid JWT (admin or reviewer role) is present.
- When: `GET /api/admin/reports?limit=200&page=1` is called.
- Then: HTTP 200 is returned. The response body `data` array contains exactly 200 report objects. Each object contains `latitude` and `longitude` as floating-point numbers (not rounded). This is the existing behavior — no regression allowed.

> Test type: Regression (Integration — confirms existing endpoint is not broken). Priority: P0.

---

### RM-FE-1 — Page Structure and SSR Exclusion of Leaflet

New Client Component page at `frontend/app/admin/reports/map/page.tsx`. The Leaflet `MapContainer` must be imported via `dynamic(() => import(...), { ssr: false })`.

**AC-RM-FE-1-S1 (Success — page renders without SSR errors)**
- Given: The Next.js build runs with `npm run build`.
- When: The build completes.
- Then: No build error referencing `window is not defined` or `document is not defined` occurs for any component in the map route. The page compiles to a valid JavaScript bundle.

**AC-RM-FE-1-S2 (Success — map container is present in DOM after load)**
- Given: The page is rendered in a jsdom environment with Leaflet mocked (as per existing `__mocks__` setup). `getAdminReports` mock resolves with an empty `data` array.
- When: The page component finishes rendering.
- Then: A DOM element with `data-testid="admin-reports-map"` (or the Leaflet container element with class `leaflet-container`) is present. The page heading contains copy `COPY.admin.reportsMap.pageTitle`.

> Test type: Unit (build check) + Unit (React Testing Library with Leaflet mock). Priority: P0.

---

### RM-FE-2 — Data Fetching: Single Request for Up to 200 Reports

On mount, the page calls `getAdminReports({ limit: 200, page: 1 })` exactly once. The result is stored in local state and rendered as map pins.

[ASSUMPTION-P2-RM-10 assumed: Option A — single `?limit=200&page=1` request.]

**AC-RM-FE-2-S1 (Success — reports fetched and stored)**
- Given: `getAdminReports` mock returns a response with `data` containing 3 report objects, each with valid `latitude`, `longitude`, `status`, `category`, `severity`, `description`, `created_at`.
- When: The map page mounts.
- Then: `getAdminReports` is called exactly once with parameters including `limit: 200` and `page: 1`. All 3 reports are passed to the map rendering layer. Three pin elements are present in the rendered output (or confirmed via the mock render path).

**AC-RM-FE-2-F1 (Failure — API call fails with network error)**
- Given: `getAdminReports` mock rejects with a network error.
- When: The map page mounts.
- Then: No map pins are rendered. An inline error banner is shown with copy `COPY.admin.reportsMap.fetchError` and a "Retry" button. The "Retry" button, when clicked, calls `getAdminReports` again. The error banner has `role="alert"`.

**AC-RM-FE-2-F2 (Failure — API call returns 401)**
- Given: `getAdminReports` mock rejects with `"HTTP 401"`.
- When: The map page mounts.
- Then: The user is redirected to `/admin/login`. No error banner specific to the map is shown.

**AC-RM-FE-2-S2 (Success — loading state displayed while fetching)**
- Given: `getAdminReports` mock is pending (not yet resolved).
- When: The map page is rendered.
- Then: A loading indicator element with copy `COPY.admin.reportsMap.loading` is present in the DOM. The map container may or may not be visible during loading — either is acceptable.

> Test type: Unit (React Testing Library). Priority: P1 for S1, F1; P0 for F2; P2 for S2.

---

### RM-FE-3 — Pin Color by Status

Each report pin on the map must be colored according to report status:
- `submitted` → hex `#6B7280` (gray)
- `under_review` → hex `#F59E0B` (amber)
- `resolved` → hex `#22C55E` (green)

[ASSUMPTION-P2-RM-1, P2-RM-2, P2-RM-3 defaults applied.]

**AC-RM-FE-3-S1 (Success — correct color per status)**
- Given: The `getPinColor` utility function (or equivalent color-mapping logic extracted as a pure function) is called with each status value.
- When: `getPinColor("submitted")`, `getPinColor("under_review")`, `getPinColor("resolved")` are called.
- Then: The return values are `"#6B7280"`, `"#F59E0B"`, and `"#22C55E"` respectively (exact string match, case-sensitive).

**AC-RM-FE-3-F1 (Failure — unknown status value)**
- Given: `getPinColor` is called with an unrecognized status value such as `"archived"`.
- When: The function executes.
- Then: The function returns `"#6B7280"` (gray, same as submitted — default fallback). No exception is thrown. No `console.error` is emitted.

**AC-RM-FE-3-S2 (Success — pin Leaflet `CircleMarker` or custom icon carries the correct color)**
- Given: A report with `status: "under_review"` is in the fetched dataset.
- When: The map renders the pin for that report.
- Then: The Leaflet marker for that pin uses a fill color of `#F59E0B` (verifiable via the color prop passed to the mocked Leaflet `CircleMarker` or `divIcon` in unit tests).

> Test type: Unit (pure function). Priority: P1.

---

### RM-FE-4 — Pin Popup Content

Clicking a map pin opens a Leaflet `Popup` containing: category (human-readable label), severity, status, date (DD MMM YYYY), and description snippet (up to 100 characters, truncated with `"…"` if longer).

[ASSUMPTION-P2-RM-6 assumed: 100-character snippet.]
[ASSUMPTION-P2-RM-7 assumed: DD MMM YYYY date format.]

**AC-RM-FE-4-S1 (Success — popup renders all fields)**
- Given: A report with `{category: "broken_footpath", severity: "high", status: "submitted", created_at: "2026-01-15T10:30:00Z", description: "Large crack spanning full footpath width near bus stop"}`.
- When: The popup content for that report is rendered (unit-tested by rendering the popup component directly, or by simulating a click in the integration test).
- Then: The popup contains the text `"Broken Footpath"` (or the human-readable equivalent per `getCategoryLabel()` from `translations.ts`). The popup contains `"High"` (or the human-readable severity label). The popup contains `"Submitted"` (or the human-readable status label). The popup contains the date formatted as `"15 Jan 2026"`. The popup contains the full description text (it is 52 characters, under the 100-char limit — no truncation applied).

**AC-RM-FE-4-S2 (Success — long description is truncated)**
- Given: A report with a `description` of exactly 150 characters.
- When: The popup content is rendered.
- Then: The displayed description text is exactly 100 characters followed by `"…"` (U+2026 HORIZONTAL ELLIPSIS, a single character). The total visible description string is 101 characters (100 + ellipsis). The original 150-character string is not shown in full.

**AC-RM-FE-4-S3 (Success — null description renders placeholder)**
- Given: A report with `description: null`.
- When: The popup content is rendered.
- Then: The popup contains copy placeholder `COPY.admin.reportsMap.noDescription` (e.g., "No description provided") instead of an empty or null value. No JavaScript error occurs.

**AC-RM-FE-4-S4 (Success — description exactly 100 characters — no truncation)**
- Given: A report with a `description` of exactly 100 characters.
- When: The popup content is rendered.
- Then: The full 100-character description is shown without truncation or ellipsis.

**AC-RM-FE-4-S5 (Success — description exactly 101 characters — truncated to 100 + ellipsis)**
- Given: A report with a `description` of exactly 101 characters.
- When: The popup content is rendered.
- Then: The displayed description is the first 100 characters followed by `"…"`. Total length: 101 characters visible.

> Test type: Unit (pure truncation function + popup component). Priority: P1.

---

### RM-FE-5 — Filter Controls: Category and Status

Filter controls rendered above the map allow the user to filter the visible set of pins client-side. Filtering does not trigger a new API request — it operates on the already-fetched `data` array in local state.

**AC-RM-FE-5-S1 (Success — category filter reduces visible pins)**
- Given: The map page has fetched 5 reports: 2 with `category: "broken_footpath"` and 3 with `category: "poor_lighting"`. The category filter `<select>` (or equivalent) shows "All Categories" by default.
- When: The user selects `"broken_footpath"` from the category filter.
- Then: Only 2 pins are passed to the map rendering layer (the 3 `poor_lighting` pins are excluded). The map does not make a new API call. The status filter, if set, is applied in conjunction (AND logic, not OR).

**AC-RM-FE-5-S2 (Success — status filter reduces visible pins)**
- Given: The map page has fetched 5 reports: 2 with `status: "submitted"` and 3 with `status: "resolved"`. The status filter shows "All Statuses" by default.
- When: The user selects `"resolved"` from the status filter.
- Then: Only 3 pins are passed to the map rendering layer. No API call is made.

**AC-RM-FE-5-S3 (Success — both filters applied simultaneously — AND logic)**
- Given: 5 reports fetched: `{category: "broken_footpath", status: "submitted"}` x2, `{category: "broken_footpath", status: "resolved"}` x1, `{category: "poor_lighting", status: "submitted"}` x2.
- When: Category filter = `"broken_footpath"`, Status filter = `"submitted"`.
- Then: Exactly 2 pins are visible (both conditions must match). No API call is made.

**AC-RM-FE-5-S4 (Success — resetting filter to "All" restores all pins)**
- Given: Category filter is set to `"broken_footpath"` (2 pins visible out of 5).
- When: User resets category filter to "All Categories".
- Then: All 5 pins are visible again. No API call is made.

**AC-RM-FE-5-S5 (Success — filter yields zero results — empty state shown)**
- Given: Category filter = `"unsafe_crossing"` but no reports with that category exist in the fetched set.
- When: The filter is applied.
- Then: No pins are rendered on the map. An empty-state message with copy `COPY.admin.reportsMap.noReportsMatchFilter` is shown (overlaid on or below the map). The map itself remains visible (not replaced by the empty state). The filter controls remain interactive.

**AC-RM-FE-5-F1 (Failure — filter select options match schema exactly)**
- Given: The category filter `<select>` is rendered.
- When: The DOM is inspected.
- Then: The `<select>` contains exactly these `<option>` values: `""` (All Categories), `"no_footpath"`, `"broken_footpath"`, `"blocked_footpath"`, `"unsafe_crossing"`, `"poor_lighting"`, `"other"` — matching the `issue_category` enum from `001_init.sql`. No additional or missing values are present.

**AC-RM-FE-5-F2 (Failure — status filter select options match schema exactly)**
- Given: The status filter `<select>` is rendered.
- When: The DOM is inspected.
- Then: The `<select>` contains exactly these `<option>` values: `""` (All Statuses), `"submitted"`, `"under_review"`, `"resolved"` — matching the `report_status` enum from `001_init.sql`.

> Test type: Unit (React Testing Library). Priority: P1.

---

### RM-FE-6 — Map Initial State

**AC-RM-FE-6-S1 (Success — map centered on Bengaluru)**
- Given: The map page is rendered. `getAdminReports` resolves with any dataset.
- When: The `MapContainer` props are inspected in the unit test (via mock or prop capture).
- Then: The `center` prop passed to `MapContainer` equals `[12.9716, 77.5946]` (matching `BENGALURU_CENTER` from `frontend/app/lib/constants.ts`). The `zoom` prop equals `12`.

**AC-RM-FE-6-S2 (Success — `BENGALURU_CENTER` constant is the authoritative source)**
- Given: The map page source imports `BENGALURU_CENTER` from `frontend/app/lib/constants.ts`.
- When: The TypeScript compiler runs.
- Then: No magic coordinate literals (`12.9716`, `77.5946`) appear directly in `map/page.tsx` — they are referenced only via the imported constant. This is a code-review-level requirement, not a runtime assertion. [Test: grep for hardcoded values in source file.]

> Test type: Unit. Priority: P1.

---

### RM-FE-7 — Sidebar Nav Link: "Reports Map"

A "Reports Map" nav link must be added to the admin sidebar, visible to all authenticated users.

[ASSUMPTION-P2-RM-8 assumed: visible to all authenticated users.]

**AC-RM-FE-7-S1 (Success — nav link present for admin role)**
- Given: The admin layout is rendered with `role = "admin"`.
- When: The sidebar is inspected.
- Then: A link element with `href="/admin/reports/map"` is present in the sidebar. Its label text contains copy `COPY.admin.nav.reportsMap`.

**AC-RM-FE-7-S2 (Success — nav link present for reviewer role)**
- Given: The admin layout is rendered with `role = "reviewer"`.
- When: The sidebar is inspected.
- Then: A link element with `href="/admin/reports/map"` is present.

> Test type: Unit (React Testing Library on layout). Priority: P1.

---

### RM-FE-8 — `getAdminReports` in `adminApi.ts`: `limit: 200` Behavior

The existing `getAdminReports` function already accepts `{ limit: 200, page: 1 }` in its `AdminReportFilters` parameter. No new function is needed. This AC confirms the existing function correctly serializes the parameters.

**AC-RM-FE-8-S1 (Success — `limit=200` is included in query string)**
- Given: `getAdminReports({ limit: 200, page: 1 })` is called with a mocked `fetch`.
- When: The fetch call is captured.
- Then: The URL includes `limit=200` and `page=1` in the query string. `credentials: "include"` is set.

> Test type: Unit. Priority: P1.

---

### RM-NFR-1 — Performance

**AC-RM-NFR-1-S1 (Loading time budget)**

[ASSUMPTION-P2-RM-11: Map page with 200 reports must render all pins and be interactive within 5 seconds on a 10 Mbps connection after the API response is received. Flag for product decision if a stricter SLA is needed.]

- Given: The API response with 200 reports is received.
- When: The map renders all 200 pins.
- Then: The map is interactive (pan/zoom responsive) within 5 seconds of the API response on a 10 Mbps connection (measured via browser performance tooling in E2E test or manual audit).

> Test type: E2E (performance audit). Priority: P2.

---

## RM Edge Case Matrix

| Edge Case | Trigger Condition | Expected System Behavior | User-Facing Message / Copy Placeholder | Test Type |
|-----------|------------------|--------------------------|----------------------------------------|-----------|
| EC-RM-1: Zero reports in DB | `getAdminReports` returns `data: []` | Map renders with no pins; empty-state message shown | `COPY.admin.reportsMap.noReports` | Unit |
| EC-RM-2: Exactly 200 reports returned | `data.length === 200` | All 200 pins rendered; no pagination controls shown | None | Unit |
| EC-RM-3: Report with `null` description in popup | `description: null` in report object | Popup renders placeholder copy | `COPY.admin.reportsMap.noDescription` | Unit |
| EC-RM-4: Report with unknown `status` value (schema drift) | API returns `status: "archived"` (not in enum) | Pin rendered with gray fallback color; no exception | None | Unit (pure fn) |
| EC-RM-5: `latitude`/`longitude` outside Bengaluru bbox | Report pinned far from Bengaluru | Pin rendered at those coordinates; no validation error (admin map has no bbox restriction) | None | Unit |
| EC-RM-6: `getAdminReports` returns 401 | JWT expired mid-session | User redirected to `/admin/login` | None — redirect | Unit |
| EC-RM-7: `getAdminReports` returns 500 | Server error | Error banner with Retry shown | `COPY.admin.reportsMap.fetchError` | Unit |
| EC-RM-8: Retry after fetch failure succeeds | User clicks Retry; second fetch succeeds | Error banner dismissed; pins rendered | None | Unit |
| EC-RM-9: Filter applied to zero-match set | Category+status filter combo matches no reports | Empty-state overlay shown on map; map still visible and pannable | `COPY.admin.reportsMap.noReportsMatchFilter` | Unit |
| EC-RM-10: Description exactly 100 chars | `description.length === 100` | Full description shown, no ellipsis | None | Unit |
| EC-RM-11: Description exactly 101 chars | `description.length === 101` | First 100 chars + "…" shown | None | Unit |
| EC-RM-12: Rapid filter changes | User changes filter select multiple times quickly | Each change re-runs client-side filter; no API calls; final state is correct | None | Unit |
| EC-RM-13: SSR attempt (window undefined) | `MapContainer` rendered server-side | `dynamic(..., { ssr: false })` prevents SSR; no `window is not defined` error | None | Build test |
| EC-RM-14: Report with `latitude: 0, longitude: 0` (Null Island) | API returns a report at 0,0 (data quality issue) | Pin rendered at 0,0; no validation or filtering applied for admin map | None | Unit |

---

## RM Error Codes

| Error Code | Trigger Condition | Internal Log Message | User-Facing Copy Placeholder | Recovery Action |
|------------|------------------|----------------------|------------------------------|-----------------|
| WB-RM-001 | `getAdminReports` fetch error or network timeout on map page | `ERROR: admin map reports fetch failed status={status}` | `COPY.admin.reportsMap.fetchError` | Retry button |
| WB-RM-002 | `getAdminReports` returns 401 on map page | `WARN: admin map reports fetch unauthorized — redirecting` | None — redirect to login | Login |
| WB-RM-003 | Individual OSM tile load failure (background map tiles) | None logged by app (browser network error) | None — tile shows blank; map remains functional | None — browser retries automatically |

---

## RM Privacy Considerations

- The admin reports map displays full-precision `latitude` and `longitude` values as returned by `GET /api/admin/reports` (FLOAT8, no rounding). This is consistent with the established pattern that admin endpoints return unrounded coordinates.
- `submitter_name` and `submitter_contact` must NOT appear in the map pin popup. The popup must show only: category, severity, status, date, description snippet. Including PII fields in the popup is a P0 security violation.
- The admin map is gated behind the admin JWT auth middleware. It is not accessible to unauthenticated users.
- Report description text shown in the popup is truncated to 100 characters. However, the full description is present in the JS state. This is acceptable for an admin-only authenticated page.

---

# SUMMARY AC MATRIX

| Req ID | AC ID | Scenario Summary | Test Type | Priority | Notes |
|--------|-------|------------------|-----------|----------|-------|
| SA-BE-1 | AC-SA-BE-1-S1 | Migration applies and adds column | Integration | P0 | |
| SA-BE-1 | AC-SA-BE-1-F1 | Migration is idempotent (run twice) | Integration | P0 | |
| SA-BE-1 | AC-SA-BE-1-F2 | Column pre-exists; migration fails | Integration | P1 | |
| SA-BE-2 | AC-SA-BE-2-S1 | Seed creates super-admin row | Unit + Integration | P0 | |
| SA-BE-2 | AC-SA-BE-2-S2 | Seed skips when rows exist | Unit + Integration | P0 | |
| SA-BE-2 | AC-SA-BE-2-F1 | API-created user cannot be super-admin | Integration | P1 | Assumes P2-SA-4 Opt A |
| SA-BE-3 | AC-SA-BE-3-S1 | Non-super-admin deactivated successfully | Integration | P0 | |
| SA-BE-3 | AC-SA-BE-3-F1 | Deactivate super-admin → 403 | Unit + Integration | P0 | |
| SA-BE-3 | AC-SA-BE-3-F2 | Reviewer deactivates super-admin → 403 (role) | Integration | P0 | |
| SA-BE-3 | AC-SA-BE-3-F3 | Super-admin self-deactivation → 403 | Integration | P1 | Assumes P2-SA-2 Opt A |
| SA-BE-4 | AC-SA-BE-4-S1 | List users includes `is_super_admin` field | Unit + Integration | P0 | Assumes P2-SA-3 Opt A |
| SA-BE-4 | AC-SA-BE-4-F1 | `password_hash` absent from response | Unit | P0 | Regression guard |
| SA-BE-5 | AC-SA-BE-5-S1 | New user has `is_super_admin: false` | Integration | P1 | |
| SA-BE-5 | AC-SA-BE-5-F1 | `is_super_admin: true` in POST body ignored | Integration | P1 | |
| SA-FE-1 | AC-SA-FE-1-S1 | `AdminUser` type includes `is_super_admin` | Unit (tsc) | P0 | |
| SA-FE-1 | AC-SA-FE-1-F1 | Missing field causes compile error | Unit (tsc) | P0 | |
| SA-FE-2 | AC-SA-FE-2-S1 | Crown badge and disabled button rendered | Unit (RTL) | P0 | |
| SA-FE-2 | AC-SA-FE-2-S2 | Disabled button is not interactive | Unit (RTL) | P0 | |
| SA-FE-2 | AC-SA-FE-2-F1 | No badge for non-super-admin | Unit (RTL) | P0 | |
| SA-FE-2 | AC-SA-FE-2-F2 | Accessible description on disabled button | Unit (RTL) | P1 | |
| PR-BE-1 | AC-PR-BE-1-S1 | Display name updated; 200 returned | Integration | P1 | |
| PR-BE-1 | AC-PR-BE-1-S2 | Display name cleared to null | Integration | P1 | |
| PR-BE-1 | AC-PR-BE-1-S3 | Empty body = no-op | Integration | P2 | |
| PR-BE-1 | AC-PR-BE-1-F1 | 81-char display name → 400 | Unit + Integration | P1 | |
| PR-BE-1 | AC-PR-BE-1-F2 | Whitespace-only display name → 400 | Unit | P1 | |
| PR-BE-1 | AC-PR-BE-1-F3 | 1-char display name → 400 | Unit | P1 | |
| PR-BE-1 | AC-PR-BE-1-F4 | No JWT → 401 | Integration | P0 | |
| PR-BE-1 | AC-PR-BE-1-F5 | JWT user deleted → 404 | Integration | P2 | |
| PR-BE-2 | AC-PR-BE-2-S1 | Only caller's own row updated | Integration | P1 | |
| PR-BE-3 | AC-PR-BE-3-S1 | Password changed; hash updated | Unit + Integration | P1 | |
| PR-BE-3 | AC-PR-BE-3-F1 | Wrong current password → 401 | Unit + Integration | P0 | |
| PR-BE-3 | AC-PR-BE-3-F2 | New password < 12 chars → 400 | Unit | P1 | |
| PR-BE-3 | AC-PR-BE-3-F3 | New password = current password → 400 | Unit | P1 | |
| PR-BE-3 | AC-PR-BE-3-F4 | Missing required fields → 400 | Unit | P1 | |
| PR-BE-3 | AC-PR-BE-3-F5 | No JWT → 401 | Integration | P0 | |
| PR-BE-3 | AC-PR-BE-3-F6 | Nonexistent user — no timing oracle | Integration | P2 | Security req |
| PR-BE-4 | AC-PR-BE-4-S1 | Valid JSON deserializes | Unit | P1 | |
| PR-BE-4 | AC-PR-BE-4-F1 | Malformed JSON → 400 | Unit | P1 | |
| PR-BE-4 | AC-PR-BE-4-F2 | Wrong field type → 400 | Unit | P1 | |
| PR-BE-5 | AC-PR-BE-5-S1 | Idempotent PATCH | Integration | P2 | |
| PR-BE-5 | AC-PR-BE-5-F1 | Concurrent password changes | Integration | P2 | |
| PR-FE-1 | AC-PR-FE-1-S1 | `updateProfile` sends correct fetch | Unit | P1 | |
| PR-FE-1 | AC-PR-FE-1-S2 | `changePassword` sends correct fetch | Unit | P1 | |
| PR-FE-1 | AC-PR-FE-1-F1 | `updateProfile` rejects on 400 | Unit | P1 | |
| PR-FE-1 | AC-PR-FE-1-F2 | `changePassword` rejects on 401 | Unit | P1 | |
| PR-FE-2 | AC-PR-FE-2-S1 | Profile page renders all fields | Unit (RTL) | P1 | |
| PR-FE-2 | AC-PR-FE-2-S2 | Null display name → empty input | Unit (RTL) | P1 | |
| PR-FE-2 | AC-PR-FE-2-F1 | `getMe()` 401 → redirect to login | Unit (RTL) | P0 | |
| PR-FE-2 | AC-PR-FE-2-F2 | `getMe()` 5xx → inline error + retry | Unit (RTL) | P1 | |
| PR-FE-3 | AC-PR-FE-3-S1 | Display name saved; success toast | Unit (RTL) | P1 | |
| PR-FE-3 | AC-PR-FE-3-F1 | Save rejected 400 → inline error | Unit (RTL) | P1 | |
| PR-FE-3 | AC-PR-FE-3-F2 | Save rejected 401 → redirect | Unit (RTL) | P0 | |
| PR-FE-3 | AC-PR-FE-3-F3 | Empty display name → client validation | Unit (RTL) | P1 | |
| PR-FE-3 | AC-PR-FE-3-F4 | Save disabled until dirty | Unit (RTL) | P1 | |
| PR-FE-4 | AC-PR-FE-4-S1 | Password changed; fields cleared | Unit (RTL) | P1 | |
| PR-FE-4 | AC-PR-FE-4-F1 | Passwords mismatch → client validation | Unit (RTL) | P1 | |
| PR-FE-4 | AC-PR-FE-4-F2 | New password too short → client validation | Unit (RTL) | P1 | |
| PR-FE-4 | AC-PR-FE-4-F3 | API 401 wrong password → clear fields | Unit (RTL) | P0 | |
| PR-FE-4 | AC-PR-FE-4-F4 | Empty field → inline required error | Unit (RTL) | P1 | |
| PR-FE-4 | AC-PR-FE-4-F5 | Password fields have `type="password"` | Unit (RTL) | P0 | |
| PR-FE-5 | AC-PR-FE-5-S1 | Profile nav link for admin | Unit (RTL) | P1 | |
| PR-FE-5 | AC-PR-FE-5-S2 | Profile nav link for reviewer | Unit (RTL) | P1 | |
| RM-BE-1 | AC-RM-BE-1-S1 | Existing endpoint returns 200 reports unbroken | Integration | P0 | Regression |
| RM-FE-1 | AC-RM-FE-1-S1 | Build succeeds without SSR errors | Build | P0 | |
| RM-FE-1 | AC-RM-FE-1-S2 | Map container present after load | Unit (RTL) | P0 | |
| RM-FE-2 | AC-RM-FE-2-S1 | Reports fetched; pins rendered | Unit (RTL) | P1 | |
| RM-FE-2 | AC-RM-FE-2-F1 | Network error → error banner + retry | Unit (RTL) | P1 | |
| RM-FE-2 | AC-RM-FE-2-F2 | API 401 → redirect to login | Unit (RTL) | P0 | |
| RM-FE-2 | AC-RM-FE-2-S2 | Loading state shown while fetching | Unit (RTL) | P2 | |
| RM-FE-3 | AC-RM-FE-3-S1 | Correct color per status (pure fn) | Unit | P1 | |
| RM-FE-3 | AC-RM-FE-3-F1 | Unknown status → gray fallback | Unit | P1 | |
| RM-FE-3 | AC-RM-FE-3-S2 | Leaflet marker receives correct color | Unit | P1 | |
| RM-FE-4 | AC-RM-FE-4-S1 | Popup renders all fields correctly | Unit (RTL) | P1 | |
| RM-FE-4 | AC-RM-FE-4-S2 | 150-char description truncated to 100+"…" | Unit | P1 | |
| RM-FE-4 | AC-RM-FE-4-S3 | Null description → placeholder copy | Unit | P1 | |
| RM-FE-4 | AC-RM-FE-4-S4 | 100-char description → no truncation | Unit | P1 | |
| RM-FE-4 | AC-RM-FE-4-S5 | 101-char description → truncated | Unit | P1 | |
| RM-FE-5 | AC-RM-FE-5-S1 | Category filter reduces pins; no API call | Unit (RTL) | P1 | |
| RM-FE-5 | AC-RM-FE-5-S2 | Status filter reduces pins | Unit (RTL) | P1 | |
| RM-FE-5 | AC-RM-FE-5-S3 | Both filters applied (AND logic) | Unit (RTL) | P1 | |
| RM-FE-5 | AC-RM-FE-5-S4 | Reset to "All" restores all pins | Unit (RTL) | P1 | |
| RM-FE-5 | AC-RM-FE-5-S5 | Zero-match filter → empty state on map | Unit (RTL) | P1 | |
| RM-FE-5 | AC-RM-FE-5-F1 | Category filter options match schema | Unit (RTL) | P0 | |
| RM-FE-5 | AC-RM-FE-5-F2 | Status filter options match schema | Unit (RTL) | P0 | |
| RM-FE-6 | AC-RM-FE-6-S1 | Map centered on BENGALURU_CENTER, zoom=12 | Unit | P1 | |
| RM-FE-6 | AC-RM-FE-6-S2 | No magic literals in source | Code review | P2 | |
| RM-FE-7 | AC-RM-FE-7-S1 | Reports Map nav link for admin | Unit (RTL) | P1 | |
| RM-FE-7 | AC-RM-FE-7-S2 | Reports Map nav link for reviewer | Unit (RTL) | P1 | |
| RM-FE-8 | AC-RM-FE-8-S1 | `limit=200` in query string | Unit | P1 | |
| RM-NFR-1 | AC-RM-NFR-1-S1 | 200 pins interactive within 5 seconds | E2E | P2 | |

**Total ACs: 87**
**P0 ACs: 24 | P1 ACs: 52 | P2 ACs: 11**

---

# SECURITY / PRIVACY SUMMARY PER FEATURE

## Feature 1 — Super-Admin Protection

| Concern | Specification |
|---------|--------------|
| `is_super_admin` writability via API | Field must be silently ignored in all POST bodies; only seed INSERT may set it to TRUE |
| Atomicity of deactivation guard | Must be a single SQL statement (UPDATE ... WHERE is_super_admin = FALSE) to prevent TOCTOU |
| `password_hash` in responses | Must not appear in any `AdminUserResponse` regardless of `is_super_admin` augmentation |
| Role check ordering | Reviewer 403 (role check) fires before super-admin 403 in `DELETE /api/admin/users/:id` |

## Feature 2 — Admin Profile Page

| Concern | Specification |
|---------|--------------|
| Password logging | `current_password` and `new_password` must NEVER appear in any server log at any level |
| Timing oracle prevention | `change-password` must run dummy Argon2 verify even for nonexistent users |
| Scope isolation | `PATCH /api/admin/auth/profile` and `POST /api/admin/auth/change-password` use JWT `sub` only — no target user ID parameter |
| Password field masking | All password inputs must have `type="password"` (P0 test requirement) |
| Hash exposure | `password_hash` must not appear in any API response, including success responses from profile endpoints |
| PII in logs | Email logged only as SHA-256 hash per established admin auth pattern |

## Feature 3 — Reports Map View

| Concern | Specification |
|---------|--------------|
| PII in popup | `submitter_name` and `submitter_contact` must NOT appear in popup content |
| Auth gate | Map page is gated by admin JWT auth; unauthenticated access redirects to login |
| Coordinate precision | Admin map shows full-precision FLOAT8 coordinates (consistent with admin API pattern) — this is intentional and acceptable for admin-only view |
| Public exposure | The admin map at `/admin/reports/map` is not linked from any public page; URL path is under `/admin/*` which requires valid JWT |

---

# DATA ELEMENTS INTRODUCED BY PHASE 2

| Data Element | Feature | Public Display | Internal Use | PII Under DPDP Act 2023 | Retention |
|-------------|---------|---------------|-------------|------------------------|-----------|
| `is_super_admin` (BOOLEAN) | SA | No — internal protection flag | Admin user management | No | Permanent (structural) |
| `display_name` (TEXT nullable) | PR | No — shown only in admin dashboard | Admin profile page, sidebar | Conditional — if it contains real name | [ASSUMPTION-9 applies: 24 months or indefinite] |
| `new_password` / `current_password` (transient) | PR | Never | Never (must not be logged) | Yes — credential data | Never stored |
| Admin map pin coordinates | RM | Admin-only view | Admin dashboard | Conditional — same as report latitude/longitude | Same as parent report |

---

# HANDOFF CHECKLIST

```
[x] Each requirement (SA-BE-1..SA-FE-2, PR-BE-1..PR-FE-5, RM-BE-1..RM-FE-8)
    has at least one success AC and one failure AC

[x] Each AC is mapped to at least one test type in the AC matrix
    (87 ACs mapped: Unit, Integration, E2E, Build, Code review)

[x] All edge cases from the standard list have been addressed:
    - EXIF Missing: Not applicable to admin features (no photo submission)
    - Wrong GPS in EXIF: Not applicable
    - WhatsApp-Stripped EXIF: Not applicable
    - Spoofed Location: Not applicable (admin map reads existing stored coords)
    - Duplicate Submissions: Not applicable to admin features
    - Large Files: Not applicable
    - Slow/Interrupted Networks: EC-RM-7 (fetch failure), EC-PR-7 (race condition)
    - Batch/Rapid Submissions: EC-RM-12 (rapid filter changes — client-side only)
    - Invalid File Types: Not applicable
    - Boundary Coordinates: EC-RM-5 (pins outside Bengaluru bbox — no restriction on admin map),
      EC-RM-14 (Null Island at 0,0)

[x] Error codes defined for all failure paths:
    WB-SA-001..002, WB-PR-001..009, WB-RM-001..003

[x] Privacy/public-display boundaries specified:
    - `is_super_admin`: internal only
    - `display_name`: admin-only; PII conditional
    - Passwords: never stored as plaintext; never logged
    - Popup: submitter PII fields excluded (P0 security requirement)
    - Coordinates: full precision on admin map (consistent with existing admin API pattern)

[x] Location handling rules specified:
    - Admin map reads stored coordinates from `GET /api/admin/reports` (FLOAT8, no rounding)
    - No location validation applied to admin map pins (admin view — no bbox restriction)
    - Location data retention: same as parent report record

[x] All assumptions labeled [ASSUMPTION-P2-*] with 2–3 decision options:
    21 assumptions documented. Blocking: P2-SA-1,2,3,4; P2-PR-1,2,3,4,6; P2-RM-10.
    Non-blocking (defaults assumed): P2-PR-5,7,8; P2-RM-1..9,11.

[x] No implementation details in any AC:
    - No Rust struct definitions, no SQL query syntax, no Axum handler patterns
    - No React hooks implementation, no CSS class names, no state management patterns
    - All ACs specify observable outcomes only

[x] No hand-wavy language in any AC:
    Banned phrases verified absent: "appropriate", "reasonable", "as needed",
    "etc.", "and so on", "properly", "correctly", "handles gracefully"
```

**Items requiring product team input before TDD authoring can begin:**

1. ASSUMPTION-P2-SA-1: Who sees the super-admin badge in the Users table?
2. ASSUMPTION-P2-SA-2: Can a super-admin deactivate themselves?
3. ASSUMPTION-P2-SA-3: Is `is_super_admin` returned in API responses?
4. ASSUMPTION-P2-SA-4: Can a second super-admin be created via API?
5. ASSUMPTION-P2-PR-1: `display_name` maximum character length?
6. ASSUMPTION-P2-PR-2: `display_name` minimum character length?
7. ASSUMPTION-P2-PR-3: New password minimum length for change-password?
8. ASSUMPTION-P2-PR-4: Password complexity rules beyond length?
9. ASSUMPTION-P2-PR-6: Confirm-password field — frontend only or sent to backend?
10. ASSUMPTION-P2-RM-10: Single request or multi-page aggregation for map load?
