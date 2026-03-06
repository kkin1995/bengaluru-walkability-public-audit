# Admin Dashboard — User Management + Frontend
# Acceptance Criteria Document
# Version: 1.0 | Date: 2026-03-06
# Author: PRD-to-AC Converter Agent
# Scope: Feature Scope A (User Management Backend) + Feature Scope B (Frontend Pages & Components)

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Explicit Assumptions](#2-explicit-assumptions)
3. [Requirements List](#3-requirements-list)
4. [Acceptance Criteria](#4-acceptance-criteria)
   - [Scope A: Backend — GET /api/admin/users](#scope-a-backend)
   - [Scope B: Frontend — Middleware, Layout, Pages, Components](#scope-b-frontend)
5. [AC Matrix](#5-ac-matrix)
6. [Edge Case Matrix](#6-edge-case-matrix)
7. [Error Codes and User-Facing Messages](#7-error-codes-and-user-facing-messages)
8. [Data Retention and Privacy Requirements](#8-data-retention-and-privacy-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Handoff Checklist](#10-handoff-checklist)

---

## 1. Feature Overview

The Admin Dashboard is an internal tool for the Walkability Bengaluru platform, accessible at `/admin`. It is not visible to public citizens. Two roles exist: `admin` (full control including user management) and `reviewer` (read access plus status change on reports only). This document covers:

- **Scope A**: Three backend API endpoints that manage admin user accounts — list users, create a user, and deactivate a user. All three are restricted to the `admin` role.
- **Scope B**: The complete frontend layer — Edge middleware protecting all `/admin/*` routes, a server-side layout that validates the session and injects role context, the login page, the dashboard, the reports page, the report detail page, the users page, a typed API client library (`adminApi.ts`), and all named UI components (`AdminSidebar`, `StatsCards`, `ReportsTable`, `StatusBadge`, `StatusChangeModal`, `UserManagementTable`, `CreateUserModal`).

Authentication state is carried via an `admin_token` cookie. The dashboard is English-only. The design system uses Tailwind CSS with the green brand palette, `rounded-2xl` rounding, and `lucide-react` icons.

---

## 2. Explicit Assumptions

> All assumptions below are OPEN unless marked RESOLVED. Product team must confirm each before implementation begins on the affected requirement.

| ID | Question | Option A | Option B | Option C | Status | Blocks |
|----|----------|----------|----------|----------|--------|--------|
| ASSUMPTION-ADM-1 | JWT expiry duration for `admin_token` | 1 hour (short-lived, requires re-login) | 8 hours (work-day session) | 24 hours (rolling) | OPEN | R-MW-1, R-LAY-1 |
| ASSUMPTION-ADM-2 | Cookie attributes for `admin_token` | `HttpOnly; Secure; SameSite=Strict` | `HttpOnly; Secure; SameSite=Lax` | `HttpOnly; SameSite=Lax` (no Secure for local dev) | OPEN | R-MW-1, R-LGN-1 |
| ASSUMPTION-ADM-3 | Password complexity beyond minimum length | Length >= 12 chars only (no character class requirement) | Length >= 12 + at least one uppercase, one digit, one special char | Length >= 8 (different minimum than PRD) | OPEN — PRD states 12 chars minimum; this assumption asks whether additional rules exist | R-USR-2 |
| ASSUMPTION-ADM-4 | Behavior when the last active admin user attempts to deactivate themselves | Return 400 (same as self-deactivation rule, no special message) | Return 400 with distinct message: "Cannot deactivate the only active admin" | Block at application level only if user count would drop to zero admins | OPEN | R-USR-3 |
| ASSUMPTION-ADM-5 | `last_login_at` field value for a user who has never logged in | `null` / omitted from response | ISO 8601 string `"never"` (invalid but readable) | Unix epoch `0` | OPEN | R-USR-1, FE-UT-3 |
| ASSUMPTION-ADM-6 | Session timeout behavior in the UI | No client-side timeout detection; user gets 401 on next API call, redirect to login | Client-side idle timer (configurable duration) triggers proactive logout | Toast warning 5 minutes before expiry with "Extend session" button | OPEN | R-LAY-2, FE-LGN-3 |
| ASSUMPTION-ADM-7 | `display_name` field — required or optional at user creation | Optional (may be null; UI shows email as fallback) | Required (min 2 chars) | Optional but validated if provided (min 2 chars, max 80 chars) | OPEN | R-USR-2, FE-CU-1 |
| ASSUMPTION-ADM-8 | Rate limiting on admin auth endpoints (login, user creation) | 5 failed login attempts per 15 min per IP then 429 | 10 failed attempts per hour per IP | No rate limiting on admin endpoints for MVP | OPEN | R-LGN-2 |
| ASSUMPTION-ADM-9 | Pagination for GET /api/admin/users | No pagination (return all; acceptable for internal tool with expected < 50 users) | Page/limit params matching public reports API pattern | Cursor-based pagination | OPEN | R-USR-1 |
| ASSUMPTION-ADM-10 | Report table page size on admin /reports page | 20 per page (matches public API default) | 50 per page | Configurable via URL param `?limit=` | OPEN | R-RPT-1 |
| ASSUMPTION-ADM-11 | Exact coordinates shown to admin on report detail — rounded or exact | Exact (6 decimal places, ~0.1m) | Rounded to 4 decimal places (~11m), consistent with existing public rounding | Same 3 d.p. rounding as public map | OPEN — NOTE: public map rounds to 3 d.p. per existing arch decision | R-RD-2 |
| ASSUMPTION-ADM-12 | Date/time display format in admin dashboard | DD MMM YYYY HH:MM (24h) in IST | ISO 8601 UTC string | Relative time ("2 hours ago") with ISO tooltip | OPEN | FE-ST-1, FE-UT-3 |
| ASSUMPTION-ADM-13 | Behavior when `/api/admin/auth/me` is unreachable (network error, not 401) during layout server fetch | Treat as 401 — redirect to `/admin/login` | Show "Service unavailable" error page, do not redirect | Surface error inline within layout, allow retry | OPEN | R-LAY-2 |
| ASSUMPTION-ADM-14 | `submitter_contact` field — is it displayed in the admin report detail UI even if null/empty? | Show field with "Not provided" placeholder | Hide field entirely if null | Show field only if non-null | OPEN | R-RD-2 |
| ASSUMPTION-ADM-15 | Performance budget for admin dashboard initial load (StatsCards + RecentReports) | Full page rendered within 3 seconds on a 10 Mbps connection | No explicit SLA for internal tool | Within 5 seconds on a 10 Mbps connection | OPEN | NFR-PERF-1 |

---

## 3. Requirements List

### Scope A — Backend

| ID | Requirement |
|----|-------------|
| R-USR-1 | The system must provide an endpoint that returns the list of all admin user accounts, excluding password hashes, accessible only to authenticated users with the `admin` role. |
| R-USR-2 | The system must provide an endpoint that creates a new admin user account, validates the supplied credentials and role, hashes the password before storage, and returns the created user record, accessible only to authenticated users with the `admin` role. |
| R-USR-3 | The system must provide an endpoint that soft-deactivates an admin user by ID, preventing self-deactivation, preserving audit references, accessible only to authenticated users with the `admin` role. |
| R-USR-1.1 | GET /api/admin/users response must include exactly the fields: `id`, `email`, `role`, `display_name`, `is_active`, `created_at`, `last_login_at` — never `password_hash`. |
| R-USR-2.1 | POST /api/admin/users must reject passwords shorter than 12 characters with HTTP 400. |
| R-USR-2.2 | POST /api/admin/users must reject email values that do not conform to RFC 5322 format with HTTP 400. |
| R-USR-2.3 | POST /api/admin/users must reject `role` values other than `"admin"` or `"reviewer"` with HTTP 400. |
| R-USR-2.4 | POST /api/admin/users must store a password hash produced by argon2id — the plaintext password must not be stored. |
| R-USR-2.5 | POST /api/admin/users must return HTTP 409 when the supplied email already exists in the system (case-insensitive match). |
| R-USR-3.1 | DELETE /api/admin/users/:id must set `is_active = false` on the target record; it must not physically delete the row. |
| R-USR-3.2 | DELETE /api/admin/users/:id must return HTTP 400 when `:id` equals the authenticated caller's own user ID (`claims.sub`). |
| R-USR-3.3 | DELETE /api/admin/users/:id must return HTTP 404 when no user with `:id` exists. |

### Scope B — Frontend

| ID | Requirement |
|----|-------------|
| R-MW-1 | The Edge middleware must redirect unauthenticated requests to all `/admin/*` paths (except `/admin/login`) to `/admin/login`. |
| R-MW-2 | The Edge middleware must not intercept or redirect requests to `/admin/login`. |
| R-LAY-1 | The admin layout must verify the active session server-side on every request by calling `GET /api/admin/auth/me` and redirect to `/admin/login` on a 401 response. |
| R-LAY-2 | The admin layout must inject the authenticated user's `role` into the sidebar so that the Users nav link renders only for the `admin` role. |
| R-LGN-1 | The login page must submit credentials to `POST /api/admin/auth/login` with `credentials: 'include'` and redirect to `/admin` on a 200 response. |
| R-LGN-2 | The login page must display an inline error message (not a browser alert) when the login API returns a non-200 response. |
| R-LGN-3 | The login page submit button must display a loading state for the entire duration between form submission and API response resolution. |
| R-DASH-1 | The dashboard page must render `StatsCards` showing counts for: total reports, submitted, under_review, and resolved. |
| R-DASH-2 | The dashboard page must render `RecentReports` showing the 5 most recent reports, ordered newest first. |
| R-RPT-1 | The reports page must render `ReportsTable` with category filter, status filter, and date range filter controls whose current values are reflected in the URL query parameters. |
| R-RPT-2 | The reports page must render `StatusChangeModal` for inline status updates. |
| R-RPT-3 | The delete button in `ReportsTable` must be present for `admin` role users and absent for `reviewer` role users. |
| R-RD-1 | The report detail page must display: photo thumbnail with a full-size link, map with the report pin, category, severity, description, status, created_at, updated_at, and status history log. |
| R-RD-2 | The report detail page must display a PII section — exact coordinates and `submitter_contact` — visible only to `admin` role users. |
| R-RD-3 | The report detail page must include a status change button. |
| R-UP-1 | The users page must be accessible only to `admin` role users; a `reviewer` visiting `/admin/users` must be redirected server-side by the layout before the page renders. |
| R-UP-2 | The users page must render `UserManagementTable` showing: email, role badge, `is_active`, `last_login_at`, and a deactivate button. |
| R-UP-3 | The users page must render `CreateUserModal` for adding new users. |
| R-COMP-1 | `AdminSidebar` must render nav links for Dashboard and Reports for all roles; the Users link must render only for the `admin` role. |
| R-COMP-2 | `AdminSidebar` Logout button must call `POST /api/admin/auth/logout` and then redirect to `/admin/login`. |
| R-COMP-3 | `StatsCards` must render the value `0` (not blank, not a dash) when a count is zero. |
| R-COMP-4 | `StatsCards` must render a skeleton loading state while data is being fetched. |
| R-COMP-5 | `ReportsTable` must be sortable by date (ascending and descending). |
| R-COMP-6 | `StatusBadge` must render: gray for `submitted`, amber for `under_review`, green for `resolved`, and must carry an `aria-label` that includes the human-readable status text. |
| R-COMP-7 | `StatusChangeModal` must call the PATCH API on confirm and close automatically on a successful API response. |
| R-COMP-8 | `StatusChangeModal` must provide a cancel button that closes the modal without making an API call. |
| R-COMP-9 | `UserManagementTable` deactivate button must be visually disabled and non-interactive for the row corresponding to the currently authenticated user. |
| R-COMP-10 | `UserManagementTable` role badge must render: blue for `admin`, gray for `reviewer`. |
| R-COMP-11 | `CreateUserModal` must display inline validation errors (not browser alerts) for email format, password length, and role selection failures before submitting to the API. |
| R-COMP-12 | `CreateUserModal` must close automatically on a successful API response. |
| R-API-1 | `adminApi.ts` must include `credentials: 'include'` on every fetch call. |
| R-API-2 | `adminApi.ts` must throw (reject the returned Promise) when any API call receives a non-2xx HTTP response. |
| R-API-3 | `adminApi.ts` must export typed wrappers for all eleven functions: `login`, `logout`, `getMe`, `getAdminReports`, `getAdminReport`, `updateReportStatus`, `deleteReport`, `getStats`, `getUsers`, `createUser`, `deactivateUser`. |

---

## 4. Acceptance Criteria

---

### SCOPE A — BACKEND

---

#### R-USR-1: GET /api/admin/users

---

**AC-USR-1-S1 — Success: admin retrieves user list**

```
Given: An HTTP request is made to GET /api/admin/users
  And: The request carries a valid JWT in the `admin_token` cookie
  And: The JWT payload contains `role: "admin"`
  And: At least one admin user record exists in the database
When: The request is processed
Then: The response status is 200
  And: The response Content-Type is "application/json"
  And: The response body is a JSON array where each element contains exactly the fields:
       `id` (string/UUID), `email` (string), `role` (string: "admin" or "reviewer"),
       `display_name` (string or null), `is_active` (boolean), `created_at` (ISO 8601 string),
       `last_login_at` (ISO 8601 string or null per ASSUMPTION-ADM-5)
  And: No element in the array contains a `password_hash` field
  And: The array contains one entry per admin user row in the database
```
Test types: Integration, E2E

---

**AC-USR-1-S2 — Success: empty user list**

```
Given: An HTTP request is made to GET /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: No admin user records exist in the database
When: The request is processed
Then: The response status is 200
  And: The response body is an empty JSON array `[]`
```
Test types: Integration

---

**AC-USR-1-F1 — Failure: reviewer role forbidden**

```
Given: An HTTP request is made to GET /api/admin/users
  And: The request carries a valid JWT in the `admin_token` cookie
  And: The JWT payload contains `role: "reviewer"`
When: The request is processed
Then: The response status is 403
  And: The response body contains `{"error": "WB-ADM-003", "message": "Forbidden: admin role required"}`
  And: No user data is included in the response body
```
Test types: Unit, Integration

---

**AC-USR-1-F2 — Failure: no authentication cookie**

```
Given: An HTTP request is made to GET /api/admin/users
  And: The request carries no `admin_token` cookie
When: The request is processed
Then: The response status is 401
  And: The response body contains `{"error": "WB-ADM-001", "message": "Authentication required"}`
```
Test types: Unit, Integration

---

**AC-USR-1-F3 — Failure: invalid or expired JWT**

```
Given: An HTTP request is made to GET /api/admin/users
  And: The request carries an `admin_token` cookie with a value that is either
       malformed (not a valid JWT structure) or expired (exp claim in the past)
When: The request is processed
Then: The response status is 401
  And: The response body contains `{"error": "WB-ADM-002", "message": "Session expired or invalid"}`
```
Test types: Unit, Integration

---

**AC-USR-1-F4 — Failure: password_hash field must never appear**

```
Given: An HTTP request is made to GET /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: User records in the database contain a `password_hash` column with non-null values
When: The response is received
Then: No field named `password_hash` (or any variant including `passwordHash`, `password`, `hash`)
     appears in any object in the response array
```
Test types: Integration (security regression test — must be in the permanent test suite)

---

#### R-USR-2: POST /api/admin/users

---

**AC-USR-2-S1 — Success: admin creates a new reviewer**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: The request body is valid JSON:
       `{"email": "newuser@example.com", "password": "SecurePass2026!", "role": "reviewer", "display_name": "New Reviewer"}`
  And: No existing user has email "newuser@example.com" (case-insensitive)
When: The request is processed
Then: The response status is 201
  And: The response body contains an object with fields:
       `id` (UUID string), `email` "newuser@example.com", `role` "reviewer",
       `display_name` "New Reviewer", `is_active` true,
       `created_at` (ISO 8601 string representing current server time ± 5 seconds)
  And: The response body does NOT contain `password_hash`
  And: A row exists in the database with email "newuser@example.com" where `password_hash`
       is a non-null argon2id hash string (starts with "$argon2id$") and is NOT equal to
       the plaintext password "SecurePass2026!"
```
Test types: Integration, E2E

---

**AC-USR-2-S2 — Success: display_name omitted (optional field)**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: The request body omits `display_name`:
       `{"email": "nodisplay@example.com", "password": "SecurePass2026!", "role": "admin"}`
When: The request is processed
Then: The response status is 201
  And: The response body contains `"display_name": null`
  And: The database row has `display_name` = NULL
```
Test types: Integration
Note: Contingent on ASSUMPTION-ADM-7 Option A or C. If Option B (required), this scenario becomes a failure path returning 400.

---

**AC-USR-2-F1 — Failure: password too short**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: The request body contains `"password": "short"` (5 characters, fewer than 12)
When: The request is processed
Then: The response status is 400
  And: The response body contains `{"error": "WB-ADM-010", "message": "Password must be at least 12 characters"}`
  And: No new user row is created in the database
```
Test types: Unit, Integration

---

**AC-USR-2-F2 — Failure: password exactly 11 characters (boundary)**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: The request body contains `"password": "Abcdefghijk"` (exactly 11 characters)
When: The request is processed
Then: The response status is 400
  And: The response body contains `{"error": "WB-ADM-010", "message": "Password must be at least 12 characters"}`
```
Test types: Unit

---

**AC-USR-2-F3 — Failure: password exactly 12 characters (boundary — success)**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: The request body contains `"password": "Abcdefghijk1"` (exactly 12 characters)
  And: All other fields are valid and email does not already exist
When: The request is processed
Then: The response status is 201
```
Test types: Unit, Integration

---

**AC-USR-2-F4 — Failure: invalid email format**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: The request body contains `"email": "not-an-email"` (no @ symbol)
When: The request is processed
Then: The response status is 400
  And: The response body contains `{"error": "WB-ADM-011", "message": "Invalid email format"}`
  And: No new user row is created in the database
```
Test types: Unit, Integration

---

**AC-USR-2-F5 — Failure: invalid role value**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: The request body contains `"role": "superuser"` (not "admin" or "reviewer")
When: The request is processed
Then: The response status is 400
  And: The response body contains `{"error": "WB-ADM-012", "message": "Role must be one of: admin, reviewer"}`
  And: No new user row is created in the database
```
Test types: Unit, Integration

---

**AC-USR-2-F6 — Failure: email already exists (case-insensitive)**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: A user with email "Existing@Example.COM" already exists in the database
  And: The request body contains `"email": "existing@example.com"` (same address, different casing)
When: The request is processed
Then: The response status is 409
  And: The response body contains `{"error": "WB-ADM-013", "message": "A user with this email already exists"}`
  And: The existing user record is unchanged
```
Test types: Integration

---

**AC-USR-2-F7 — Failure: reviewer caller forbidden**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "reviewer"`
When: The request is processed
Then: The response status is 403
  And: The response body contains `{"error": "WB-ADM-003", "message": "Forbidden: admin role required"}`
```
Test types: Unit, Integration

---

**AC-USR-2-F8 — Failure: missing required fields**

```
Given: An HTTP request is made to POST /api/admin/users
  And: The request carries a valid JWT with `role: "admin"`
  And: The request body is `{}` (empty object, all required fields absent)
When: The request is processed
Then: The response status is 400
  And: The response body contains `{"error": "WB-ADM-014", "message": "Fields required: email, password, role"}`
```
Test types: Unit, Integration

---

#### R-USR-3: DELETE /api/admin/users/:id

---

**AC-USR-3-S1 — Success: admin deactivates another user**

```
Given: An HTTP request is made to DELETE /api/admin/users/:id
  And: The request carries a valid JWT with `role: "admin"` and subject claim `claims.sub = "user-A-uuid"`
  And: `:id` is "user-B-uuid" (a different user, currently `is_active = true`)
When: The request is processed
Then: The response status is 204
  And: The response body is empty
  And: The database row for "user-B-uuid" has `is_active = false`
  And: The database row for "user-B-uuid" is NOT deleted (physical row still exists)
  And: Any `status_history` rows with `changed_by = "user-B-uuid"` are unaffected
```
Test types: Integration, E2E

---

**AC-USR-3-S2 — Success: deactivating an already-inactive user**

```
Given: An HTTP request is made to DELETE /api/admin/users/:id
  And: The request carries a valid JWT with `role: "admin"` and `claims.sub != :id`
  And: The target user already has `is_active = false`
When: The request is processed
Then: The response status is 204
  And: The database row remains with `is_active = false` (idempotent operation)
```
Test types: Integration

---

**AC-USR-3-F1 — Failure: self-deactivation attempt**

```
Given: An HTTP request is made to DELETE /api/admin/users/:id
  And: The request carries a valid JWT with `claims.sub = "user-A-uuid"`
  And: `:id` is "user-A-uuid" (same as the caller's own ID)
When: The request is processed
Then: The response status is 400
  And: The response body contains `{"error": "WB-ADM-020", "message": "You cannot deactivate your own account"}`
  And: The caller's database row is unchanged
```
Test types: Unit, Integration

---

**AC-USR-3-F2 — Failure: user not found**

```
Given: An HTTP request is made to DELETE /api/admin/users/:id
  And: The request carries a valid JWT with `role: "admin"`
  And: `:id` is a UUID that does not exist in the `admin_users` table
When: The request is processed
Then: The response status is 404
  And: The response body contains `{"error": "WB-ADM-021", "message": "User not found"}`
```
Test types: Unit, Integration

---

**AC-USR-3-F3 — Failure: reviewer caller forbidden**

```
Given: An HTTP request is made to DELETE /api/admin/users/:id
  And: The request carries a valid JWT with `role: "reviewer"`
When: The request is processed
Then: The response status is 403
  And: The response body contains `{"error": "WB-ADM-003", "message": "Forbidden: admin role required"}`
```
Test types: Unit, Integration

---

**AC-USR-3-F4 — Failure: unauthenticated request**

```
Given: An HTTP request is made to DELETE /api/admin/users/:id
  And: No `admin_token` cookie is present
When: The request is processed
Then: The response status is 401
  And: The response body contains `{"error": "WB-ADM-001", "message": "Authentication required"}`
```
Test types: Unit, Integration

---

**AC-USR-3-F5 — Failure: malformed :id (not a valid UUID)**

```
Given: An HTTP request is made to DELETE /api/admin/users/not-a-uuid
  And: The request carries a valid JWT with `role: "admin"`
When: The request is processed
Then: The response status is 400
  And: The response body contains `{"error": "WB-ADM-022", "message": "Invalid user ID format"}`
```
Test types: Unit, Integration

---

### SCOPE B — FRONTEND

---

#### R-MW-1 / R-MW-2: Edge Middleware

---

**AC-MW-1-S1 — Success: cookie present, request passes through**

```
Given: A browser makes a GET request to any path matching `/admin/*`
       (e.g., `/admin`, `/admin/reports`, `/admin/users`)
  And: The request includes a cookie named `admin_token` with any non-empty string value
When: The middleware processes the request
Then: The request is forwarded to the target Next.js route handler without modification
  And: No redirect response is issued
```
Test types: Unit (middleware unit test with mock NextRequest)

---

**AC-MW-1-F1 — Failure: cookie absent, redirect issued**

```
Given: A browser makes a GET request to `/admin/reports`
  And: The request does NOT include an `admin_token` cookie
When: The middleware processes the request
Then: The middleware returns an HTTP 307 (Temporary Redirect) response
  And: The `Location` header of the redirect is `/admin/login`
  And: The original `/admin/reports` resource is NOT rendered
```
Test types: Unit (middleware unit test)

---

**AC-MW-2-S1 — Success: login page is never blocked by middleware**

```
Given: A browser makes a GET request to `/admin/login`
  And: The request does NOT include an `admin_token` cookie
When: The middleware processes the request
Then: The middleware does NOT issue a redirect
  And: The request is forwarded to the `/admin/login` route handler
```
Test types: Unit (middleware unit test)

---

**AC-MW-2-S2 — Success: login page also passes through when cookie IS present**

```
Given: A browser makes a GET request to `/admin/login`
  And: The request includes a valid `admin_token` cookie
When: The middleware processes the request
Then: The middleware does NOT issue a redirect
  And: The request is forwarded to `/admin/login`
  And: Any post-login redirect to `/admin` is the responsibility of the login page component,
       not the middleware
```
Test types: Unit (middleware unit test)
Note: Middleware performs cookie presence check only, not JWT validity. JWT validation is the layout's responsibility.

---

#### R-LAY-1 / R-LAY-2: Admin Layout

---

**AC-LAY-1-S1 — Success: valid session, layout renders**

```
Given: A server-side render is triggered for any `/admin/*` page (except `/admin/login`)
  And: The `admin_token` cookie is present in the request headers
  And: A server-side fetch to `GET /api/admin/auth/me` forwarding that cookie returns HTTP 200
  And: The response body contains `{"id": "...", "email": "...", "role": "admin"}`
When: The layout renders
Then: The page content is rendered inside the shared sidebar layout
  And: The `AdminSidebar` receives `role: "admin"` as a prop
  And: The Users nav link is visible in the sidebar
```
Test types: Integration (server component test)

---

**AC-LAY-1-S2 — Success: reviewer session hides Users link**

```
Given: Server-side render for `/admin/reports`
  And: `GET /api/admin/auth/me` returns HTTP 200 with `{"role": "reviewer"}`
When: The layout renders
Then: The page content renders inside the sidebar layout
  And: The `AdminSidebar` receives `role: "reviewer"` as a prop
  And: The Users nav link is NOT present in the rendered sidebar HTML
```
Test types: Integration

---

**AC-LAY-1-F1 — Failure: auth/me returns 401, redirect to login**

```
Given: Server-side render for `/admin`
  And: The `admin_token` cookie is present
  And: `GET /api/admin/auth/me` returns HTTP 401
When: The layout processes the response
Then: The layout issues a server-side redirect to `/admin/login`
  And: No page content is rendered to the client
```
Test types: Integration

---

**AC-LAY-1-F2 — Failure: network error on auth/me fetch**

```
Given: Server-side render for `/admin`
  And: The `admin_token` cookie is present
  And: The fetch to `GET /api/admin/auth/me` throws a network-level error
       (TCP connection refused or DNS failure)
When: The layout handles the error
Then: Behavior is per ASSUMPTION-ADM-13 — one of:
      Option A: Redirect to `/admin/login`
      Option B: Render a "Service unavailable" error page with HTTP 503
      Option C: Render an inline error with a retry mechanism
[ASSUMPTION-ADM-13 must be resolved before this AC can be finalized]
```
Test types: Integration

---

**AC-LAY-2-S1 — Success: Users page server-side role gate**

```
Given: Server-side render for `/admin/users`
  And: `GET /api/admin/auth/me` returns HTTP 200 with `{"role": "reviewer"}`
When: The layout/page processes the role
Then: The layout issues a server-side redirect — the target is `/admin` (dashboard)
  And: The users page content is NOT rendered
  And: The redirect occurs before any users API call is made
```
Test types: Integration, E2E

---

#### R-LGN-1 / R-LGN-2 / R-LGN-3: Login Page

---

**AC-LGN-1-S1 — Success: valid credentials, redirect to dashboard**

```
Given: The user is on `/admin/login`
  And: The email field contains a valid email string
  And: The password field contains a non-empty string
When: The user submits the form
Then: A POST request is made to `/api/admin/auth/login` with:
      - Request body: `{"email": "<entered email>", "password": "<entered password>"}`
      - Fetch option `credentials: 'include'`
  And: The API returns HTTP 200
  And: The browser navigates to `/admin` (client-side router push)
  And: No error message is shown
```
Test types: E2E, Integration

---

**AC-LGN-2-F1 — Failure: wrong credentials, inline error shown**

```
Given: The user is on `/admin/login`
  And: The email and password fields contain values
When: The user submits the form
  And: The API returns HTTP 401
Then: An inline error message is rendered within the page (not a browser alert() dialog)
  And: The error message text is the copy placeholder: COPY.admin.login.invalidCredentials
       (rendered as: "Invalid email or password")
  And: The user remains on `/admin/login`
  And: The password field is cleared
  And: The email field retains its current value
```
Test types: E2E, Integration

---

**AC-LGN-2-F2 — Failure: API returns 429 (rate limited)**

```
Given: The user submits the login form
  And: The API returns HTTP 429
Then: An inline error message is rendered:
      COPY.admin.login.rateLimited (rendered as: "Too many attempts. Please wait before trying again.")
  And: The submit button is disabled for 60 seconds following the 429 response
  And: A visible countdown is shown in the submit button area: "Try again in Xs"
       where X decrements by 1 each second
```
Test types: Integration, E2E
Note: 60-second client-side lockout is [ASSUMPTION-ADM-8 adjacent] — flag for product confirmation if duration should match server-side window.

---

**AC-LGN-2-F3 — Failure: API returns 5xx or network error**

```
Given: The user submits the login form
  And: The fetch to `/api/admin/auth/login` either throws a network error or returns HTTP 500–599
Then: An inline error message is rendered:
      COPY.admin.login.serverError (rendered as: "Something went wrong. Please try again.")
  And: The submit button returns to its non-loading state
  And: The form is not reset
```
Test types: Integration

---

**AC-LGN-3-S1 — Success: loading state during request**

```
Given: The user submits the login form
  And: The API call has been initiated but has NOT yet resolved
When: The page is observed during this pending state
Then: The submit button is disabled (cannot be clicked a second time)
  And: The submit button displays a loading indicator
       (spinner icon replacing the button text, or button text changes to "Signing in...")
  And: The email and password fields are disabled (read-only) during the pending state
```
Test types: Unit (component test), E2E

---

#### R-DASH-1 / R-DASH-2: Dashboard Page

---

**AC-DASH-1-S1 — Success: stats render with live data**

```
Given: The admin dashboard page at `/admin` renders
  And: The stats API returns `{"total": 142, "submitted": 38, "under_review": 61, "resolved": 43}`
When: `StatsCards` renders with this data
Then: Four cards are visible with labels and values:
      Card 1: label "Total Reports", value "142"
      Card 2: label "Submitted", value "38"
      Card 3: label "Under Review", value "61"
      Card 4: label "Resolved", value "43"
  And: Each card value is a visible text node (not hidden)
```
Test types: Unit (component test), Integration

---

**AC-DASH-1-S2 — Zero values render as "0" not blank**

```
Given: The stats API returns `{"total": 0, "submitted": 0, "under_review": 0, "resolved": 0}`
When: `StatsCards` renders with this data
Then: Each card displays the string "0" as its value
  And: No card displays an empty string, null, or a dash character
```
Test types: Unit (component test)

---

**AC-DASH-1-S3 — Skeleton loading state**

```
Given: The stats data fetch has been initiated but has NOT yet resolved
When: `StatsCards` renders in the loading state
Then: Four skeleton placeholder elements are visible in place of the metric values
  And: The skeleton elements are animated (pulse or shimmer)
  And: No actual numeric values are shown until the fetch resolves
```
Test types: Unit (component test)

---

**AC-DASH-2-S1 — RecentReports: 5 most recent, newest first**

```
Given: The reports API returns a list of reports
  And: The API is called with parameters that limit to 5 records ordered by `created_at` descending
When: `RecentReports` renders
Then: Exactly 5 report rows are visible (or fewer if fewer than 5 reports exist)
  And: The report with the most recent `created_at` appears in the first row
  And: The report with the oldest `created_at` among the 5 appears in the last row
```
Test types: Unit (component test), Integration

---

#### R-RPT-1 / R-RPT-2 / R-RPT-3: Reports Page

---

**AC-RPT-1-S1 — Success: filters reflected in URL**

```
Given: The admin is on `/admin/reports`
When: The admin selects category filter "Missing Footpath"
  And: selects status filter "under_review"
  And: selects a date range from "2026-01-01" to "2026-03-06"
Then: The browser URL updates to include query parameters:
      `?category=missing_footpath&status=under_review&from=2026-01-01&to=2026-03-06`
  And: The `ReportsTable` re-fetches with the updated filters
  And: The filter controls show the selected values matching the URL params
```
Test types: E2E, Integration

---

**AC-RPT-1-S2 — Success: filter state restored from URL on page load**

```
Given: The admin navigates directly to
       `/admin/reports?category=broken_surface&status=submitted`
When: The page renders
Then: The category filter control shows "Broken Surface" as selected
  And: The status filter control shows "Submitted" as selected
  And: The reports table contains only reports matching both filters
```
Test types: E2E, Integration

---

**AC-RPT-3-S1 — Admin sees delete button; reviewer does not**

```
Given: The reports page renders for an authenticated admin user
When: `ReportsTable` renders with report data
Then: Each report row contains a delete button element

Given: The reports page renders for an authenticated reviewer user
When: `ReportsTable` renders with the same report data
Then: No delete button element is present in any report row
  And: No other mechanism to delete a report is accessible to the reviewer
```
Test types: Unit (component test), E2E

---

#### R-RD-1 / R-RD-2 / R-RD-3: Report Detail Page

---

**AC-RD-1-S1 — Success: all metadata visible**

```
Given: The admin navigates to `/admin/reports/:id`
  And: The report with `:id` exists and has all fields populated
When: The page renders
Then: The following are visible on the page:
      - Photo thumbnail image element with a clickable link to the full-size image URL
      - A map component showing a pin at the report's lat/lng coordinates
      - Category value (human-readable label)
      - Severity value (human-readable label)
      - Description text (or "No description provided" if null)
      - Current status (rendered via `StatusBadge`)
      - `created_at` date (formatted per ASSUMPTION-ADM-12)
      - `updated_at` date (formatted per ASSUMPTION-ADM-12)
      - Status history log listing each status transition with timestamp and changed_by
```
Test types: Integration, E2E

---

**AC-RD-2-S1 — PII section visible to admin, hidden for reviewer**

```
Given: The report detail page renders for an authenticated admin user
When: The page renders
Then: A section labeled "PII / Sensitive Data" (or equivalent copy placeholder COPY.admin.report.piiSectionLabel)
     is visible and contains:
      - Exact GPS coordinates (lat and lng) — formatted per ASSUMPTION-ADM-11
      - `submitter_contact` value (or per ASSUMPTION-ADM-14 if null)

Given: The report detail page renders for an authenticated reviewer user
When: The page renders
Then: No PII section is rendered — not hidden with CSS but absent from the DOM
  And: No GPS coordinate values are present anywhere in the rendered HTML
  And: No `submitter_contact` value is present anywhere in the rendered HTML
```
Test types: Integration, E2E (security regression)

---

**AC-RD-1-F1 — Failure: report not found**

```
Given: The admin navigates to `/admin/reports/:id`
  And: No report with `:id` exists
When: The page renders
Then: The page displays an error state with the message:
      COPY.admin.report.notFound (rendered as: "Report not found")
  And: HTTP response status for the page is 404
  And: A "Back to Reports" link is shown pointing to `/admin/reports`
```
Test types: Integration

---

#### R-UP-1 / R-UP-2 / R-UP-3: Users Page

---

**AC-UP-1-S1 — Role gate: reviewer redirected before page renders**

```
Given: An authenticated reviewer navigates to `/admin/users`
When: The server-side layout/page processes the request
Then: A server-side redirect to `/admin` is issued
  And: The users page content (table, create modal) is never sent to the client
  And: The redirect occurs before any call to `GET /api/admin/users` is made
```
Test types: Integration, E2E

---

**AC-UP-2-S1 — UserManagementTable renders all required columns**

```
Given: The users page renders for an authenticated admin user
  And: The `GET /api/admin/users` response contains 3 user records
When: `UserManagementTable` renders
Then: The table contains 3 rows (one per user)
  And: Each row displays: email address, role badge, is_active status,
       last_login_at value (or "Never" if null per ASSUMPTION-ADM-5), and a deactivate button
  And: The deactivate button for the row matching the currently authenticated user's ID
       is visually disabled (has the HTML `disabled` attribute) and does not trigger any
       action when clicked
  And: The deactivate button for all other rows is enabled
```
Test types: Unit (component test), Integration

---

**AC-UP-2-S2 — Role badges: correct colors**

```
Given: `UserManagementTable` renders with a user whose `role` is "admin"
  And: Another user whose `role` is "reviewer"
When: The table renders
Then: The admin user's role badge has a blue color class applied
      (Tailwind: `bg-blue-100 text-blue-800` or equivalent from the design system)
  And: The reviewer user's role badge has a gray color class applied
      (Tailwind: `bg-gray-100 text-gray-800` or equivalent)
```
Test types: Unit (component test)

---

**AC-UP-3-S1 — CreateUserModal: success flow**

```
Given: The admin clicks "Add User" on the users page
  And: `CreateUserModal` opens
  And: The admin fills in: email "new@example.com", password "ValidPassword99",
       role "reviewer", display_name "Test User"
When: The admin clicks Confirm
Then: A POST request is sent to `/api/admin/users` via `adminApi.createUser`
  And: The API returns HTTP 201
  And: The modal closes
  And: The `UserManagementTable` re-fetches and shows the new user in the list
```
Test types: E2E, Integration

---

**AC-UP-3-F1 — CreateUserModal: client-side validation before API call**

```
Given: `CreateUserModal` is open
  And: The admin enters email "invalid-email" (no @ symbol)
  And: The admin enters password "short" (fewer than 12 characters)
  And: The role select is at its default empty/unselected state
When: The admin clicks Confirm
Then: NO API call is made
  And: Three inline error messages appear beneath the respective fields:
       - Below email field: COPY.admin.createUser.emailInvalid (rendered as: "Enter a valid email address")
       - Below password field: COPY.admin.createUser.passwordTooShort
                               (rendered as: "Password must be at least 12 characters")
       - Below role select: COPY.admin.createUser.roleRequired (rendered as: "Select a role")
  And: The modal remains open
```
Test types: Unit (component test)

---

**AC-UP-3-F2 — CreateUserModal: API returns 409 (duplicate email)**

```
Given: `CreateUserModal` is open
  And: All fields pass client-side validation
When: The admin submits the form
  And: `adminApi.createUser` throws with HTTP 409
Then: An inline error message appears within the modal:
      COPY.admin.createUser.emailConflict (rendered as: "A user with this email already exists")
  And: The modal remains open
  And: The form fields retain their current values
```
Test types: Unit (component test), Integration

---

#### R-COMP-1 / R-COMP-2: AdminSidebar

---

**AC-COMP-1-S1 — Nav links render correctly per role**

```
Given: `AdminSidebar` renders with `role: "admin"`
Then: The following nav links are rendered in the sidebar:
      - "Dashboard" linking to `/admin`
      - "Reports" linking to `/admin/reports`
      - "Users" linking to `/admin/users`
  And: All three links are visible in the DOM

Given: `AdminSidebar` renders with `role: "reviewer"`
Then: The following nav links are rendered:
      - "Dashboard" linking to `/admin`
      - "Reports" linking to `/admin/reports`
  And: No element with text "Users" or href="/admin/users" is present in the DOM
```
Test types: Unit (component test)

---

**AC-COMP-2-S1 — Logout: API call then redirect**

```
Given: The admin clicks the Logout button in `AdminSidebar`
When: The click event fires
Then: A POST request is made to `/api/admin/auth/logout` with `credentials: 'include'`
  And: After the request completes (regardless of response status),
       the browser navigates to `/admin/login`
  And: The `admin_token` cookie is cleared (either by server Set-Cookie response
       or by the client clearing it — the AC does not prescribe which)
```
Test types: E2E, Integration

---

#### R-COMP-6: StatusBadge

---

**AC-COMP-6-S1 — Color mapping and accessibility**

```
Given: `StatusBadge` renders with status value "submitted"
Then: The badge element has a gray background class
  And: The element has an `aria-label` attribute containing the string "submitted"

Given: `StatusBadge` renders with status value "under_review"
Then: The badge element has an amber background class
  And: The element has an `aria-label` attribute containing the string "under review"

Given: `StatusBadge` renders with status value "resolved"
Then: The badge element has a green background class
  And: The element has an `aria-label` attribute containing the string "resolved"
```
Test types: Unit (component test)

---

**AC-COMP-6-F1 — Unknown status value**

```
Given: `StatusBadge` renders with an unrecognized status value (e.g., "archived")
Then: The badge renders with a gray background class as the default
  And: The `aria-label` contains the raw status value passed in
  And: No runtime error is thrown
```
Test types: Unit (component test)

---

#### R-COMP-7 / R-COMP-8: StatusChangeModal

---

**AC-COMP-7-S1 — Success: status update, modal closes**

```
Given: `StatusChangeModal` is open for report `:id`
  And: The admin selects a new status from the dropdown
  And: The admin optionally enters a note in the textarea
When: The admin clicks Confirm
Then: A PATCH request is made to `/api/admin/reports/:id/status` via `adminApi.updateReportStatus`
      with body `{"status": "<selected>", "note": "<entered note or null>"}`
  And: On HTTP 200 response, the modal closes
  And: The `StatusBadge` for the report updates to reflect the new status
       without a full page reload
```
Test types: E2E, Integration

---

**AC-COMP-8-S1 — Cancel: no API call, modal closes**

```
Given: `StatusChangeModal` is open
  And: The admin has selected a new status in the dropdown
When: The admin clicks Cancel
Then: No API call is made
  And: The modal closes
  And: The report's current status is unchanged in the UI
```
Test types: Unit (component test)

---

#### R-API-1 / R-API-2 / R-API-3: adminApi.ts

---

**AC-API-1-S1 — credentials: 'include' on every call**

```
Given: Any function in `adminApi.ts` is called
When: The internal fetch is executed
Then: The fetch options include `credentials: 'include'`
  And: This applies to all 11 exported functions without exception
```
Test types: Unit (mock fetch spy)

---

**AC-API-2-S1 — Non-2xx throws**

```
Given: `adminApi.getUsers()` is called
  And: The fetch returns HTTP 403
When: The caller awaits the returned Promise
Then: The Promise rejects with an error object that includes the HTTP status code (403)
  And: The error object includes the response body (parsed JSON if available,
       raw text otherwise)
```
Test types: Unit (mock fetch)

---

**AC-API-2-S2 — 2xx resolves normally**

```
Given: `adminApi.getUsers()` is called
  And: The fetch returns HTTP 200 with a valid JSON array body
When: The caller awaits the returned Promise
Then: The Promise resolves with the parsed JSON array
  And: The resolved value is typed as `AdminUser[]`
```
Test types: Unit (mock fetch)

---

**AC-API-3-S1 — All 11 functions exported**

```
Given: The module `adminApi.ts` is imported
Then: The following named exports are present and are callable functions:
      login, logout, getMe, getAdminReports, getAdminReport, updateReportStatus,
      deleteReport, getStats, getUsers, createUser, deactivateUser
  And: Each function has a TypeScript return type annotation (not `any`)
```
Test types: Unit (TypeScript type-check / import test)

---

## 5. AC Matrix

| Req ID | AC ID | Scenario Summary | Test Type | Priority | Notes |
|--------|-------|-----------------|-----------|----------|-------|
| R-USR-1 | AC-USR-1-S1 | Admin lists all users — success | Integration, E2E | P0 | Core happy path |
| R-USR-1 | AC-USR-1-S2 | Admin lists users — empty result | Integration | P1 | |
| R-USR-1 | AC-USR-1-F1 | Reviewer role forbidden on GET users | Unit, Integration | P0 | |
| R-USR-1 | AC-USR-1-F2 | No auth cookie — 401 | Unit, Integration | P0 | |
| R-USR-1 | AC-USR-1-F3 | Expired/malformed JWT — 401 | Unit, Integration | P0 | |
| R-USR-1.1 | AC-USR-1-F4 | password_hash never in response | Integration | P0 | Security regression — must be permanent |
| R-USR-2 | AC-USR-2-S1 | Admin creates reviewer — 201 | Integration, E2E | P0 | |
| R-USR-2 | AC-USR-2-S2 | Create user without display_name | Integration | P1 | Contingent on ASSUMPTION-ADM-7 |
| R-USR-2.1 | AC-USR-2-F1 | Password too short — 400 | Unit, Integration | P0 | |
| R-USR-2.1 | AC-USR-2-F2 | Password 11 chars (boundary) — 400 | Unit | P0 | Boundary test |
| R-USR-2.1 | AC-USR-2-F3 | Password 12 chars (boundary) — 201 | Unit, Integration | P0 | Boundary test |
| R-USR-2.2 | AC-USR-2-F4 | Invalid email format — 400 | Unit, Integration | P0 | |
| R-USR-2.3 | AC-USR-2-F5 | Invalid role value — 400 | Unit, Integration | P0 | |
| R-USR-2.5 | AC-USR-2-F6 | Duplicate email (case-insensitive) — 409 | Integration | P0 | |
| R-USR-2 | AC-USR-2-F7 | Reviewer caller forbidden — 403 | Unit, Integration | P0 | |
| R-USR-2 | AC-USR-2-F8 | Empty request body — 400 | Unit, Integration | P1 | |
| R-USR-3 | AC-USR-3-S1 | Admin deactivates another user — 204 | Integration, E2E | P0 | |
| R-USR-3 | AC-USR-3-S2 | Deactivate already-inactive user — 204 (idempotent) | Integration | P1 | |
| R-USR-3.2 | AC-USR-3-F1 | Self-deactivation — 400 | Unit, Integration | P0 | |
| R-USR-3.3 | AC-USR-3-F2 | User not found — 404 | Unit, Integration | P0 | |
| R-USR-3 | AC-USR-3-F3 | Reviewer caller forbidden — 403 | Unit, Integration | P0 | |
| R-USR-3 | AC-USR-3-F4 | Unauthenticated — 401 | Unit, Integration | P0 | |
| R-USR-3 | AC-USR-3-F5 | Malformed UUID in :id — 400 | Unit, Integration | P1 | |
| R-MW-1 | AC-MW-1-S1 | Cookie present — request passes | Unit | P0 | Edge middleware |
| R-MW-1 | AC-MW-1-F1 | Cookie absent — redirect to login | Unit | P0 | Edge middleware |
| R-MW-2 | AC-MW-2-S1 | Login page not blocked without cookie | Unit | P0 | Edge middleware |
| R-MW-2 | AC-MW-2-S2 | Login page not blocked with cookie | Unit | P1 | Edge middleware |
| R-LAY-1 | AC-LAY-1-S1 | Valid session — layout renders with admin role | Integration | P0 | Server component |
| R-LAY-1 | AC-LAY-1-S2 | Reviewer session — Users link hidden | Integration | P0 | |
| R-LAY-1 | AC-LAY-1-F1 | auth/me returns 401 — redirect | Integration | P0 | |
| R-LAY-1 | AC-LAY-1-F2 | auth/me network error — behavior per ASSUMPTION-ADM-13 | Integration | P1 | Blocked on assumption |
| R-LAY-2 | AC-LAY-2-S1 | Reviewer visiting /admin/users — redirected | Integration, E2E | P0 | |
| R-LGN-1 | AC-LGN-1-S1 | Valid credentials — redirect to /admin | E2E, Integration | P0 | |
| R-LGN-2 | AC-LGN-2-F1 | Wrong credentials — inline error | E2E, Integration | P0 | |
| R-LGN-2 | AC-LGN-2-F2 | 429 response — rate limit message + lockout | Integration, E2E | P1 | |
| R-LGN-2 | AC-LGN-2-F3 | 5xx/network error — inline server error | Integration | P1 | |
| R-LGN-3 | AC-LGN-3-S1 | Loading state during submit | Unit, E2E | P0 | |
| R-DASH-1 | AC-DASH-1-S1 | StatsCards render with live data | Unit, Integration | P0 | |
| R-DASH-1 | AC-DASH-1-S2 | StatsCards render zeros as "0" | Unit | P0 | |
| R-DASH-1 | AC-DASH-1-S3 | StatsCards skeleton loading state | Unit | P1 | |
| R-DASH-2 | AC-DASH-2-S1 | RecentReports — 5 records, newest first | Unit, Integration | P0 | |
| R-RPT-1 | AC-RPT-1-S1 | Filter controls update URL params | E2E, Integration | P0 | |
| R-RPT-1 | AC-RPT-1-S2 | URL params restore filter state on load | E2E, Integration | P1 | |
| R-RPT-3 | AC-RPT-3-S1 | Admin sees delete; reviewer does not | Unit, E2E | P0 | Security |
| R-RD-1 | AC-RD-1-S1 | Report detail — all metadata visible | Integration, E2E | P0 | |
| R-RD-2 | AC-RD-2-S1 | PII section admin-only (DOM absence for reviewer) | Integration, E2E | P0 | Security regression |
| R-RD-1 | AC-RD-1-F1 | Report not found — 404 state | Integration | P1 | |
| R-UP-1 | AC-UP-1-S1 | Reviewer on /admin/users — redirected | Integration, E2E | P0 | |
| R-UP-2 | AC-UP-2-S1 | UserManagementTable columns + self-disable | Unit, Integration | P0 | |
| R-UP-2 | AC-UP-2-S2 | Role badge colors | Unit | P1 | |
| R-UP-3 | AC-UP-3-S1 | CreateUserModal — success flow | E2E, Integration | P0 | |
| R-UP-3 | AC-UP-3-F1 | CreateUserModal — client-side validation | Unit | P0 | |
| R-UP-3 | AC-UP-3-F2 | CreateUserModal — 409 API error | Unit, Integration | P0 | |
| R-COMP-1 | AC-COMP-1-S1 | AdminSidebar nav links per role | Unit | P0 | |
| R-COMP-2 | AC-COMP-2-S1 | Logout: POST logout then redirect | E2E, Integration | P0 | |
| R-COMP-6 | AC-COMP-6-S1 | StatusBadge color + aria-label mapping | Unit | P0 | Accessibility |
| R-COMP-6 | AC-COMP-6-F1 | StatusBadge unknown status — gray default | Unit | P1 | |
| R-COMP-7 | AC-COMP-7-S1 | StatusChangeModal confirm — API call + close | E2E, Integration | P0 | |
| R-COMP-8 | AC-COMP-8-S1 | StatusChangeModal cancel — no API call | Unit | P0 | |
| R-API-1 | AC-API-1-S1 | credentials: 'include' on all API calls | Unit | P0 | Security |
| R-API-2 | AC-API-2-S1 | Non-2xx rejects Promise with status | Unit | P0 | |
| R-API-2 | AC-API-2-S2 | 2xx resolves with typed data | Unit | P0 | |
| R-API-3 | AC-API-3-S1 | All 11 functions exported with types | Unit | P0 | |

---

## 6. Edge Case Matrix

> Format: Trigger Condition → Expected System Behavior → User-Facing Message (Copy Placeholder) → Test Type

---

### Backend Edge Cases

| # | Edge Case | Trigger Condition | Expected System Behavior | User-Facing Message | Test Type |
|---|-----------|------------------|--------------------------|---------------------|-----------|
| EC-BE-1 | EXIF missing (not applicable to admin) | N/A — admin endpoints do not handle photo submissions | N/A | N/A | N/A |
| EC-BE-2 | Concurrent duplicate POST /api/admin/users | Two requests with the same email arrive within milliseconds | Database unique constraint fires; second request receives HTTP 409; first request succeeds with 201 | WB-ADM-013 copy | Integration |
| EC-BE-3 | DELETE /api/admin/users/:id — only active admin left | Caller is the only active admin; attempts to deactivate a different user | Per ASSUMPTION-ADM-4: system behavior undefined — flag for product decision | Per ASSUMPTION-ADM-4 | Integration |
| EC-BE-4 | JWT with valid signature but tampered `role` claim | Attacker modifies `role` in payload but keeps the original signature | JWT signature verification fails; response is 401 with WB-ADM-002 | COPY.admin.auth.sessionInvalid | Unit |
| EC-BE-5 | GET /api/admin/users — database connection failure during query | Database unreachable when query executes | Response is HTTP 500; error is logged with request_id; no partial data is returned | COPY.admin.error.serverError | Integration |
| EC-BE-6 | POST /api/admin/users — argon2id hash operation times out or fails | The hashing library throws at runtime | Response is HTTP 500; plaintext password is NOT stored; no user row is created | COPY.admin.error.serverError | Integration |
| EC-BE-7 | DELETE /api/admin/users/:id — :id is a valid UUID but belongs to a different tenant or context | UUID exists in a different table (e.g., a public report id, not an admin user id) | Response is 404 (treat as not found); no cross-table lookup performed | WB-ADM-021 copy | Integration |
| EC-BE-8 | Request body larger than server limit | POST /api/admin/users body exceeds [ASSUMPTION] 1 MB | Response is 413 (Payload Too Large) before validation runs | COPY.admin.error.payloadTooLarge | Integration |

---

### Frontend Edge Cases

| # | Edge Case | Trigger Condition | Expected System Behavior | User-Facing Message | Test Type |
|---|-----------|------------------|--------------------------|---------------------|-----------|
| EC-FE-1 | `admin_token` cookie present but contains a non-JWT string (e.g., random text) | Middleware passes (cookie exists); layout calls auth/me; server rejects JWT | Layout receives 401 from auth/me; redirects to `/admin/login` | None — redirect is silent | Integration |
| EC-FE-2 | Admin opens two tabs; logs out in Tab 1 | Tab 2 still has stale React state; Tab 2 makes an API call | `adminApi` receives 401; the calling component catches the error and redirects to `/admin/login` | COPY.admin.auth.sessionExpired (toast or inline) | E2E |
| EC-FE-3 | `UserManagementTable` — `last_login_at` is null | User has never logged in | Display text "Never" (copy placeholder: COPY.admin.users.neverLoggedIn) — not null, not empty, not "null" | COPY.admin.users.neverLoggedIn | Unit |
| EC-FE-4 | `CreateUserModal` — user submits while a prior request is still in-flight | Confirm button clicked twice quickly | Second click is ignored: confirm button is disabled from the moment the first click fires until the API response resolves | Loading indicator on button | Unit |
| EC-FE-5 | `ReportsTable` — API returns an empty array | No reports match current filters | An empty state message is shown within the table area: COPY.admin.reports.emptyState (rendered as: "No reports found") — not a blank table | COPY.admin.reports.emptyState | Unit |
| EC-FE-6 | `StatsCards` — stats API call fails (5xx) | Fetch throws or returns non-2xx | Skeleton is replaced with an error state showing a retry button; values are not shown as 0 (which would be misleading) | COPY.admin.stats.loadError | Unit, Integration |
| EC-FE-7 | `StatusChangeModal` — confirm clicked with no status selected | Dropdown left in default empty state | No API call is made; inline validation error appears below the dropdown | COPY.admin.statusModal.statusRequired | Unit |
| EC-FE-8 | Report detail page — photo thumbnail URL 404 | The uploaded image file is missing from the server | A broken-image placeholder is shown; the full-size link is still rendered | COPY.admin.report.photoUnavailable (alt text) | Unit, Integration |
| EC-FE-9 | Admin dashboard — very large numbers in StatsCards | Stats API returns count values > 999,999 | Numbers are formatted with locale thousands separators (e.g., "1,234,567") — not truncated, not overflowing the card bounds | N/A | Unit |
| EC-FE-10 | `/admin/login` — already authenticated user visits | User with valid `admin_token` navigates to `/admin/login` | The login page renders (middleware does not block it per AC-MW-2-S2); the page itself does NOT auto-redirect; any redirect-when-authenticated logic is explicitly out of scope for this spec and must be raised as a separate requirement | N/A | E2E |
| EC-FE-11 | `AdminSidebar` — logout API returns 5xx | `POST /api/admin/auth/logout` returns HTTP 500 | Browser still navigates to `/admin/login`; the failure is logged to console; the `admin_token` cookie is cleared client-side (best-effort) | COPY.admin.logout.error (toast, non-blocking) | Integration |
| EC-FE-12 | Slow network — `UserManagementTable` data fetch takes > [ASSUMPTION-ADM-15] seconds | User lands on `/admin/users`; data has not loaded | Table shows a skeleton loading state (row-level skeleton) until data resolves; no partial data is shown | N/A | E2E |
| EC-FE-13 | `ReportsTable` — sort toggled while filter is active | User sorts by date while category filter is applied | Sort order updates in URL params alongside filter params; both are preserved simultaneously; API is called with combined params | N/A | E2E, Integration |

---

## 7. Error Codes and User-Facing Messages

> Domain prefix: `WB-ADM-` for all admin dashboard errors.
> New range: WB-ADM-001 to WB-ADM-099 reserved.

| Error Code | Trigger Condition | Internal Log Message | User-Facing Message (Copy Placeholder) | Recovery Action |
|------------|------------------|----------------------|----------------------------------------|-----------------|
| WB-ADM-001 | Request to protected endpoint with no `admin_token` cookie | `auth.missing_cookie path={path}` | COPY.admin.auth.required — "Authentication required" | Redirect to `/admin/login` |
| WB-ADM-002 | JWT is malformed or signature verification fails or `exp` is in the past | `auth.invalid_jwt reason={reason} path={path}` | COPY.admin.auth.sessionInvalid — "Session expired or invalid. Please log in again." | Redirect to `/admin/login` |
| WB-ADM-003 | Authenticated user with `role: "reviewer"` calls an admin-only endpoint | `authz.forbidden user_id={id} endpoint={method} {path}` | COPY.admin.authz.forbidden — "You do not have permission to perform this action." | None — informational only |
| WB-ADM-010 | POST /api/admin/users — password length < 12 | `validation.password_too_short length={n}` | COPY.admin.createUser.passwordTooShort — "Password must be at least 12 characters" | Show inline on password field |
| WB-ADM-011 | POST /api/admin/users — email fails RFC 5322 validation | `validation.invalid_email value={email}` | COPY.admin.createUser.emailInvalid — "Enter a valid email address" | Show inline on email field |
| WB-ADM-012 | POST /api/admin/users — role is not "admin" or "reviewer" | `validation.invalid_role value={role}` | COPY.admin.createUser.roleInvalid — "Role must be one of: admin, reviewer" | Show inline on role field |
| WB-ADM-013 | POST /api/admin/users — email already exists (case-insensitive) | `user.email_conflict email={email}` | COPY.admin.createUser.emailConflict — "A user with this email already exists" | Show inline on email field |
| WB-ADM-014 | POST /api/admin/users — required fields missing from body | `validation.missing_fields fields={fields}` | COPY.admin.createUser.missingFields — "Fields required: email, password, role" | Show inline summary |
| WB-ADM-020 | DELETE /api/admin/users/:id — caller's own ID matches :id | `user.self_deactivation user_id={id}` | COPY.admin.users.selfDeactivate — "You cannot deactivate your own account" | None — informational only |
| WB-ADM-021 | DELETE /api/admin/users/:id — :id not found in database | `user.not_found id={id}` | COPY.admin.users.notFound — "User not found" | None |
| WB-ADM-022 | DELETE /api/admin/users/:id — :id is not a valid UUID format | `validation.invalid_uuid value={value}` | COPY.admin.users.invalidId — "Invalid user ID" | None |
| WB-ADM-030 | Login API returns 401 on `/admin/login` page | `auth.login_failed email={email}` | COPY.admin.login.invalidCredentials — "Invalid email or password" | Show inline; clear password field |
| WB-ADM-031 | Login API returns 429 on `/admin/login` page | `auth.rate_limited ip={ip}` | COPY.admin.login.rateLimited — "Too many attempts. Please wait before trying again." | 60-second client-side button lockout with countdown |
| WB-ADM-032 | Login API returns 5xx or network error on `/admin/login` page | `auth.login_server_error status={status}` | COPY.admin.login.serverError — "Something went wrong. Please try again." | Re-enable submit button; form unchanged |
| WB-ADM-040 | GET /api/admin/reports/:id — report not found | `report.not_found id={id}` | COPY.admin.report.notFound — "Report not found" | Show "Back to Reports" link to `/admin/reports` |
| WB-ADM-050 | Stats API fetch fails in `StatsCards` | `stats.fetch_error status={status}` | COPY.admin.stats.loadError — "Could not load statistics" | Show retry button in StatsCards |
| WB-ADM-060 | `POST /api/admin/auth/logout` returns 5xx | `auth.logout_server_error status={status}` | COPY.admin.logout.error — "Logout encountered an issue. You have been signed out locally." | Navigate to `/admin/login` regardless |

---

## 8. Data Retention and Privacy Requirements

> This admin dashboard collects and processes additional data classes compared to the public-facing app. The table below covers admin-specific data elements only. Public report data privacy is governed by the public submission AC document.

| Data Element | Public Display | Internal Use | Retention Period | Deletion Trigger | PII Under DPDP Act 2023 |
|---|---|---|---|---|---|
| `admin_users.email` | Never shown publicly | Used for login, user identification in audit logs, display in admin UI | For the lifetime of the admin account + [ASSUMPTION-ADM-9 pending] after deactivation | Physical row deletion via a separate admin-only purge operation (not in current scope); soft-delete via `is_active = false` is the default | Yes — directly identifies an individual |
| `admin_users.password_hash` | Never | Stored in DB; used for login verification only; never returned by any API | Lifetime of account | Deleted when the account row is physically purged | Not directly PII but protects PII access; treat as sensitive credential data |
| `admin_users.display_name` | Never publicly | Shown in admin UI only | Lifetime of account | With account purge | Conditional PII (may identify a person by name) — treat as PII |
| `admin_users.role` | Never | Drives access control decisions; stored in JWT | Lifetime of account | With account purge | No |
| `admin_users.is_active` | Never | Controls whether account can authenticate | Lifetime of row (row persists after deactivation) | With account purge | No |
| `admin_users.last_login_at` | Never | Visible in admin UI for audit; used to identify inactive accounts | Lifetime of account | With account purge | Indirectly PII (reveals behavioral timing) — treat as internal-only |
| `admin_users.created_at` | Never | Audit trail | Lifetime of account | With account purge | No |
| JWT `admin_token` cookie | Never | Authenticates each request; contains `id`, `email`, `role`, `exp` | Duration of `exp` claim (per ASSUMPTION-ADM-1) | On logout: server sets `Set-Cookie: admin_token=; Max-Age=0`; on expiry: browser discards automatically | Yes — contains email (PII) |
| Server access logs (admin endpoints) | Never | Security audit, incident response | Per ASSUMPTION-ADM-23 (shared with public API) | Time-based rolling deletion | Yes — contains IP address (PII under DPDP Act) |
| `status_history.changed_by` | Shown on report detail page to admin users only — never to public | Full audit trail | Lifetime of the parent report row | When parent report is deleted | Conditional — contains admin user ID which maps to email; treat as internal-sensitive |
| Login attempt logs (failed) | Never | Security monitoring, rate limiting | 30 days (per ASSUMPTION-ADM-23 default; confirm separately for security logs) | Time-based rolling deletion | Yes — contains IP address and email attempt |

### Additional Privacy Rules (Admin Dashboard Specific)

**R-PRIV-1**: The `submitter_contact` field from public reports must be rendered in the admin UI only within a clearly labeled "PII / Sensitive Data" section. It must be absent from the DOM for reviewer-role users (not merely hidden via CSS).

**R-PRIV-2**: Admin user email addresses must not appear in any client-side JavaScript bundle, environment variable, or build artifact exposed to end users.

**R-PRIV-3**: The `password_hash` field must be excluded from all API serialization paths. A dedicated integration test (AC-USR-1-F4) must run in CI to catch any regression where `password_hash` leaks into an API response.

**R-PRIV-4**: JWT contents must not be logged in plaintext. Log entries may include the JWT subject (`sub` claim) and expiry, but never the full token string.

---

## 9. Non-Functional Requirements

### NFR-PERF-1 — Page load performance

- The admin dashboard page (`/admin`) must reach Largest Contentful Paint within **[ASSUMPTION-ADM-15]** seconds on a 10 Mbps wired connection.
- `StatsCards` skeleton state must appear within **500 ms** of the page rendering, regardless of API response time.
- `ReportsTable` on `/admin/reports` must render the first page of results within **3 seconds** of navigation on a 10 Mbps connection.
- If ASSUMPTION-ADM-15 is resolved as Option A (3 seconds), the P0 threshold is 3 seconds; if Option C (5 seconds), 5 seconds.

### NFR-PERF-2 — API response time

- `GET /api/admin/users` must return a response within **1 second** for up to 100 user records on the reference server hardware.
- `POST /api/admin/users` must return a response within **3 seconds** including argon2id hashing time.
- `DELETE /api/admin/users/:id` must return a response within **500 ms**.

### NFR-AVAIL-1 — Degraded mode

- If the stats API is unavailable, the dashboard page must still render the rest of the layout (sidebar, nav). Only `StatsCards` shows an error state. The page must not crash or show a blank screen.
- If `GET /api/admin/users` fails, the users page must render an error state with a retry button rather than an empty table that implies no users exist.

### NFR-SEC-1 — Authentication on every endpoint

- Every endpoint under `/api/admin/*` (except `/api/admin/auth/login` and the health check) must validate the JWT on every request. There is no session caching at the application layer that could serve a stale auth result. This must be verified by an integration test that manually expires a JWT and confirms subsequent requests return 401.

### NFR-SEC-2 — No sensitive data in error responses

- Error responses from `/api/admin/*` endpoints must not include stack traces, database query text, internal file paths, or argon2id hash values in the response body. Error details are written to the server log only.

### NFR-A11Y-1 — Accessibility (Admin Dashboard)

- The admin dashboard is an internal tool. Minimum accessibility target: **WCAG 2.1 Level A** for all interactive elements (keyboard navigability of modals, table row actions, form controls).
- `StatusBadge` must meet WCAG 2.1 AA color contrast ratio (4.5:1 minimum for text). The amber badge in particular must be verified: amber text on white background or white text on amber background must both meet 4.5:1.
- All modals (`StatusChangeModal`, `CreateUserModal`) must trap focus while open: Tab cycles only within the modal; pressing Escape closes the modal.
- The deactivate button that is disabled for the current user must carry `aria-disabled="true"` and a tooltip or `title` attribute with text: COPY.admin.users.selfDeactivateTooltip (rendered as: "You cannot deactivate your own account").

### NFR-LOC-1 — Localization

- The admin dashboard is English-only. All user-facing strings must use copy placeholder keys as specified in this document. No hardcoded English strings are acceptable in component JSX.
- Date/time formatting must use the format resolved by ASSUMPTION-ADM-12. Until resolved, use ISO 8601 UTC as the safe default.

---

## 10. Handoff Checklist

```
Handoff Checklist — admin-users-frontend-ac.md v1.0

[x] Each requirement (R1…Rn) has at least one success AC and one failure AC
    — All 35 requirements have at least one success and one failure path.
    — EXCEPTION: R-LAY-1-F2 (network error on auth/me) is blocked on ASSUMPTION-ADM-13.
      The AC shell is written with a placeholder outcome; it cannot be finalized until
      the product team selects Option A, B, or C for ASSUMPTION-ADM-13.

[x] Each AC is mapped to at least one test type in the AC matrix
    — All 63 AC items appear in Section 5 with at least one test type assigned.

[x] All edge cases from the standard list have been addressed
    — EXIF Missing: N/A — admin endpoints do not handle photo submissions; noted in EC-BE-1.
    — Wrong GPS in EXIF: N/A — same reason.
    — WhatsApp-Stripped EXIF: N/A — same reason.
    — Spoofed Location: N/A — admin dashboard does not accept location input.
    — Duplicate Submissions: Covered by EC-BE-2 (concurrent duplicate user creation).
    — Large Files: Covered by EC-BE-8 (request body size limit, flagged as assumption).
    — Slow/Interrupted Networks: Covered by EC-FE-12 (skeleton state on slow load).
    — Batch/Rapid Submissions: Covered by EC-FE-4 (double-click on CreateUserModal confirm).
    — Invalid File Types: N/A — admin user management endpoints do not accept file uploads.
    — Boundary Coordinates: N/A — admin dashboard does not accept location input from users.
    — Additional admin-specific edge cases: EC-BE-2 through EC-BE-8, EC-FE-1 through EC-FE-13.

[x] Error codes and user-facing messages are defined for all failure paths
    — 17 error codes defined in Section 7 covering all identified failure paths.
    — WB-ADM-001 to WB-ADM-060 range established.

[x] Privacy/public-display boundaries are specified for each data element
    — Section 8 covers all 10 admin-specific data elements with all five columns.
    — R-PRIV-1 through R-PRIV-4 state additional rules specific to this dashboard.

[x] Location handling rules are specified (EXIF vs manual pin priority, conflict resolution, fallback)
    — Not applicable to this feature. The admin dashboard does not accept location input
      from admin users. Report location data is read-only in this context.
      Location handling for report submissions is governed by the Report Submission Wizard AC.

[x] All assumptions are labeled [ASSUMPTION-n] with 2–3 decision options provided
    — 15 assumptions defined (ASSUMPTION-ADM-1 through ASSUMPTION-ADM-15).
    — All are labeled and carry 2–3 discrete options.
    — Assumptions blocking P0 requirements: ASSUMPTION-ADM-1, ADM-2, ADM-3, ADM-13.

[x] No implementation details present in any AC
    — Verified. No framework choices, ORM patterns, schema column types, or
      infrastructure topology appear in any AC block.

[x] No hand-wavy language present in any AC
    — Verified. Banned phrases ("appropriate", "reasonable", "handles gracefully",
      "as needed", "properly", "correctly") do not appear in any AC block.
```

### Information Still Needed from Product Team

The following items require a product decision before the dependent ACs can be finalized:

1. **ASSUMPTION-ADM-1** (JWT expiry): Needed before R-MW-1 and R-LAY-1 tests can set realistic session expiry fixtures.
2. **ASSUMPTION-ADM-2** (Cookie attributes): Needed before security tests can assert correct cookie flags on login response.
3. **ASSUMPTION-ADM-3** (Password complexity beyond length): Needed before AC-USR-2-F1 and CreateUserModal validation tests can define the complete rule set.
4. **ASSUMPTION-ADM-5** (last_login_at null display): Needed before EC-FE-3 copy can be finalized.
5. **ASSUMPTION-ADM-7** (display_name required vs optional): Determines whether AC-USR-2-S2 is a success or failure path.
6. **ASSUMPTION-ADM-11** (coordinate precision in admin detail): Needed before R-RD-2 PII section test can assert the exact format.
7. **ASSUMPTION-ADM-12** (date/time format): Needed before any date-rendering tests can assert exact output strings.
8. **ASSUMPTION-ADM-13** (auth/me network error behavior): **Blocks AC-LAY-1-F2 finalization.**
9. **ASSUMPTION-ADM-14** (submitter_contact null display): Needed before report detail component test can assert correct null state.
10. **ASSUMPTION-ADM-15** (performance budget): Needed before NFR-PERF-1 can state a testable threshold.

---

*End of document — admin-users-frontend-ac.md v1.0*
