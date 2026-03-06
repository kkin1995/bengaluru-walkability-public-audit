# Admin Auth — Acceptance Criteria
# Walkability Bengaluru Admin Dashboard
# Document version: 1.0
# Date: 2026-03-06
# Author: prd-to-ac-converter agent
# Status: DRAFT — pending product team assumption confirmations

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Upfront Assumptions](#2-upfront-assumptions)
3. [Requirements and Acceptance Criteria](#3-requirements-and-acceptance-criteria)
   - R1 — POST /api/admin/auth/login
   - R2 — POST /api/admin/auth/logout
   - R3 — GET /api/admin/auth/me
   - R4 — JWT Middleware
   - R5 — Role Gating
   - R6 — Admin Seeding
   - R7 — CORS for Cookie Auth
   - R8 — Cookie Security Attributes
4. [AC Matrix](#4-ac-matrix)
5. [Edge Case Matrix](#5-edge-case-matrix)
6. [Error Codes and User-Facing Messages](#6-error-codes-and-user-facing-messages)
7. [Data Retention and Privacy Requirements](#7-data-retention-and-privacy-requirements)
8. [Location Handling Rules](#8-location-handling-rules)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [API Behavioral Expectations](#10-api-behavioral-expectations)
11. [Handoff Checklist](#11-handoff-checklist)

---

## 1. Feature Overview

The Admin Auth subsystem protects the Walkability Bengaluru operator dashboard (`/admin`) from unauthorized access. Operators authenticate via a login form that submits credentials to `POST /api/admin/auth/login`; the backend verifies the password with argon2id against the `admin_users` table and, on success, sets an `admin_token` HttpOnly cookie containing a signed JWT. All subsequent admin API calls pass through a JWT middleware that extracts the cookie, verifies the signature and expiry, and injects the decoded claims into the request context. A two-role model (`admin`, `reviewer`) gates destructive operations. A startup seeding mechanism ensures at least one `admin` user exists when the system is first deployed. The system must resist timing-based user enumeration attacks by performing the full argon2id verification path regardless of whether the submitted email exists in the database.

---

## 2. Upfront Assumptions

All items labeled `[ASSUMPTION-AUTH-n]` below are unresolved. The product team must choose one option for each before implementation begins. Items marked **BLOCKING** must be resolved before any test can be authored for that requirement.

| ID | Question | Option A | Option B | Option C | Status |
|----|----------|----------|----------|----------|--------|
| ASSUMPTION-AUTH-1 | What HTTP status code does the login endpoint return when rate-limited by nginx (after 5 req/min)? | 429 Too Many Requests with `Retry-After` header | 503 Service Unavailable | 429 with no `Retry-After` | OPEN — BLOCKING for AUTH-05 |
| ASSUMPTION-AUTH-2 | What is the exact user-facing error message for invalid credentials (wrong email or wrong password)? Both cases must return the same message to prevent enumeration. | "Invalid email or password." | "Login failed. Please check your credentials." | Externalized copy key `COPY.admin.auth.invalidCredentials` | OPEN — BLOCKING for AUTH-03, AUTH-04 |
| ASSUMPTION-AUTH-3 | What is the exact user-facing error message when the account exists but `is_active = false`? | Same as invalid credentials (no disclosure) | "Your account has been deactivated. Contact an administrator." | Externalized copy key `COPY.admin.auth.accountDeactivated` | OPEN — BLOCKING for AUTH-06. Note: Option A prevents status enumeration; Options B/C disclose account existence. Choose deliberately. |
| ASSUMPTION-AUTH-4 | Is there a maximum password length enforced at login to prevent DoS via argon2 with extremely large inputs? | Yes: reject passwords > 1024 bytes at the validation layer before hashing | Yes: reject passwords > 72 bytes (bcrypt historical limit, applies to argon2 intentionally) | No explicit cap | OPEN — BLOCKING for AUTH-02 |
| ASSUMPTION-AUTH-5 | What is the admin dashboard frontend route? | `/admin` (catch-all; client-side route guard) | `/admin/login` for the login page; `/admin/*` for protected pages | Both `/admin` and `/admin/login` exist as distinct pages | OPEN — affects AUTH-13 (redirect behavior) |
| ASSUMPTION-AUTH-6 | After successful login, where does the frontend redirect? | `/admin` (dashboard root) | `/admin/reports` (first meaningful page) | The page the user originally attempted to reach (redirect-after-login pattern) | OPEN — BLOCKING for AUTH-01 (success path) |
| ASSUMPTION-AUTH-7 | After successful logout, where does the frontend redirect? | `/admin/login` | `/` (public homepage) | No redirect; stay on current page with session-expired state | OPEN — BLOCKING for AUTH-08 |
| ASSUMPTION-AUTH-8 | What is the `JWT_SESSION_HOURS` value used in tests and staging when not explicitly set? | Default 24 hours (as stated in PRD) | No default; startup must fail if unset | Default 8 hours (shift-length) | OPEN — Option A assumed below; labeled at each AC. |
| ASSUMPTION-AUTH-9 | Does the `/api/admin/auth/logout` endpoint require a valid (unexpired) JWT, or does it clear the cookie unconditionally? | Requires valid JWT; returns 401 if cookie missing or expired | Clears cookie unconditionally (even if cookie is missing or expired); always returns 200 | Clears cookie unconditionally but returns 401 if cookie was absent | OPEN — PRD says "requires valid JWT cookie"; Option A assumed below. |
| ASSUMPTION-AUTH-10 | What is the admin login page route that the JWT middleware redirects unauthenticated browser requests to? | `/admin/login` | `/admin` (which itself renders login if unauthenticated) | No redirect from middleware; 401 JSON only | OPEN — affects AUTH-16 (middleware behavior for browser vs API requests). Note: middleware is on the API layer; frontend handles redirect based on 401. Option C assumed below. |
| ASSUMPTION-AUTH-11 | Is `display_name` in `admin_users` required or optional at creation? | Optional (nullable) | Required (non-null, min 1 char) | Optional but defaulted to email prefix | OPEN — schema says nullable; Option A assumed below. |
| ASSUMPTION-AUTH-12 | What happens during admin seeding if `ADMIN_SEED_EMAIL` is set but `ADMIN_SEED_PASSWORD` is missing (or vice versa)? | Log a warning and skip seeding (same as both absent) | Panic/exit with a clear error message | Log an error and proceed without creating the seed user | OPEN — BLOCKING for AUTH-23. |
| ASSUMPTION-AUTH-13 | What is the minimum `ADMIN_SEED_PASSWORD` length enforced at seeding time? | 12 characters | 8 characters | No minimum enforced | OPEN — BLOCKING for AUTH-22. |
| ASSUMPTION-AUTH-14 | What response body shape does `GET /api/admin/auth/me` return for the `AdminUserResponse`? | `{id, email, role, display_name, created_at, last_login_at}` | `{id, email, role, display_name}` | `{id, email, role}` | OPEN — BLOCKING for AUTH-09, AUTH-10. Option A assumed below (all non-sensitive fields). |
| ASSUMPTION-AUTH-15 | Does the JWT middleware update `last_login_at` on every authenticated request, or only on login? | Only on successful login (POST /api/admin/auth/login success) | On every authenticated request (too expensive) | On login + explicit `GET /api/admin/auth/me` call | OPEN — Option A assumed below. |
| ASSUMPTION-AUTH-16 | What argon2id parameters are used for hashing? | argon2id with m=19456, t=2, p=1 (OWASP 2023 minimum) | argon2id with m=65536, t=3, p=4 (higher security) | Configurable via env vars `ARGON2_MEM_KIB`, `ARGON2_ITERS`, `ARGON2_PARALLELISM` | OPEN — affects AUTH-02, AUTH-04, and timing behavior. Flag for security review. |
| ASSUMPTION-AUTH-17 | When the seed admin user is created, is the seed password stored in logs at any level? | Never logged at any level (only "seed user created" confirmation) | Logged at DEBUG level only | Not logged | OPEN — Option A (never logged) assumed; this is a security requirement, not a preference. |

---

## 3. Requirements and Acceptance Criteria

### R1 — Login Endpoint: Input Validation

**R1** The system must reject malformed login requests before performing any database lookup or cryptographic operation.

**R1.1** The system must reject login requests whose `Content-Type` is not `application/json`.

**R1.2** The system must reject login requests with a missing or empty `email` field.

**R1.3** The system must reject login requests with a missing or empty `password` field.

**R1.4** The system must reject login requests where `email` does not conform to RFC 5322 basic email syntax (local@domain with at least one dot in domain).

**R1.5** `[ASSUMPTION-AUTH-4]` The system must reject login requests where `password` exceeds the maximum byte length configured for pre-hash validation.

---

#### AC-AUTH-01 — Login request body: missing fields

**Requirement:** R1.2, R1.3

**Given** the admin login endpoint is reachable,
**When** a POST request is sent to `/api/admin/auth/login` with a JSON body that omits the `email` field OR omits the `password` field OR includes either field as an empty string (`""`),
**Then:**
- The response status code is `400 Bad Request`.
- The response `Content-Type` is `application/json`.
- The response body contains the field `error` with value `"WB-ADMIN-AUTH-001"`.
- The response body contains the field `message` with value matching copy placeholder `COPY.admin.auth.missingCredentials`.
- No database query is executed.
- No argon2id operation is executed.
- The `Set-Cookie` header is absent from the response.

**Test Type:** Unit (input validation layer), Integration (HTTP response shape)
**Priority:** P0

---

#### AC-AUTH-02 — Login request body: invalid email format

**Requirement:** R1.4

**Given** the admin login endpoint is reachable,
**When** a POST request is sent with a `password` value that is non-empty and a valid byte length, but `email` is a string that does not contain exactly one `@` character followed by a domain segment containing at least one `.` (e.g., `"notanemail"`, `"@nodomain"`, `"user@"`, `"user@nodot"`),
**Then:**
- The response status code is `400 Bad Request`.
- The response body contains `error` = `"WB-ADMIN-AUTH-001"`.
- No database query is executed.
- No argon2id operation is executed.
- The `Set-Cookie` header is absent.

**Test Type:** Unit
**Priority:** P1

---

#### AC-AUTH-02b — Login request body: password exceeds maximum byte length

**Requirement:** R1.5
**[ASSUMPTION-AUTH-4]** Assumes Option A: reject passwords > 1024 bytes.

**Given** the admin login endpoint is reachable,
**When** a POST request is sent with a valid `email` and a `password` whose UTF-8 byte length is 1025 or greater,
**Then:**
- The response status code is `400 Bad Request`.
- The response body contains `error` = `"WB-ADMIN-AUTH-002"`.
- The response body contains `message` matching copy placeholder `COPY.admin.auth.passwordTooLong`.
- No database query is executed.
- No argon2id operation is executed.
- The `Set-Cookie` header is absent.

**Test Type:** Unit
**Priority:** P1

---

#### AC-AUTH-02c — Login request: wrong Content-Type

**Requirement:** R1.1

**Given** the admin login endpoint is reachable,
**When** a POST request is sent with `Content-Type: application/x-www-form-urlencoded` or `Content-Type: multipart/form-data` or no `Content-Type` header,
**Then:**
- The response status code is `415 Unsupported Media Type` OR `400 Bad Request` (either is acceptable; the exact code must be consistent across all such requests and must be documented in the error code table).
- The `Set-Cookie` header is absent.

**[ASSUMPTION-AUTH-2b]** Product team must confirm which 4xx code to use for wrong Content-Type. This AC uses 415 as the default but either is acceptable if documented.

**Test Type:** Unit, Integration
**Priority:** P2

---

### R2 — Login Endpoint: Authentication Logic

**R2** The system must authenticate the operator by verifying submitted credentials against the `admin_users` table using timing-safe comparison.

**R2.1** When the submitted email matches a row in `admin_users` and the submitted password matches `password_hash` via argon2id verification, and `is_active = true`, the login must succeed.

**R2.2** When the submitted email does not match any row in `admin_users`, the system must perform a dummy argon2id verification against a fixed dummy hash (to equalize response time) and then return the same error response as a wrong-password case.

**R2.3** When the submitted email matches a row but the submitted password does not match `password_hash`, the system must return an error response indistinguishable from the no-email-found case.

**R2.4** When the submitted email matches a row and the password matches but `is_active = false`, the system must return an error response.

**R2.5** On successful authentication, the system must update `last_login_at` for the matched `admin_users` row to the current UTC timestamp. `[ASSUMPTION-AUTH-15]`

---

#### AC-AUTH-03 — Login success: valid credentials, active account

**Requirement:** R2.1, R2.5

**Given** an `admin_users` row exists with `email = "ops@example.com"`, `is_active = true`, and a known `password_hash`,
**When** a POST request is sent to `/api/admin/auth/login` with `{"email": "ops@example.com", "password": "<plaintext that matches hash>"}`,
**Then:**
- The response status code is `200 OK`.
- The response `Content-Type` is `application/json`.
- The response body contains `{"ok": true}`. (No JWT value or user data in the response body.)
- The response `Set-Cookie` header sets a cookie named `admin_token` with all of the following attributes present: `HttpOnly`, `SameSite=Strict`, and `Path=/`.
- The `admin_token` cookie value is a valid JWT with three dot-separated base64url segments.
- The JWT payload (decoded without verification for test inspection) contains fields: `sub` (string, UUID format), `email` (string, equals `"ops@example.com"`), `role` (string, equals the role stored in the DB row), `exp` (integer, Unix timestamp in the future).
- `[ASSUMPTION-AUTH-8]` The JWT `exp` field is within ±5 seconds of `now + (JWT_SESSION_HOURS * 3600)`. When `JWT_SESSION_HOURS` is unset, `exp` equals `now + 86400` seconds (24 hours).
- The `admin_users` row `last_login_at` is updated to a UTC timestamp within 2 seconds of the response time.
- The response does NOT contain a `password_hash` field at any nesting level.

**Test Type:** Integration (requires DB), E2E
**Priority:** P0

---

#### AC-AUTH-04 — Login failure: wrong password (email exists)

**Requirement:** R2.3

**Given** an `admin_users` row exists with `email = "ops@example.com"` and `is_active = true`,
**When** a POST request is sent with `{"email": "ops@example.com", "password": "definitelyWrong!"}`,
**Then:**
- The response status code is `401 Unauthorized`.
- The response body contains `error` = `"WB-ADMIN-AUTH-003"`.
- The response body contains `message` matching copy placeholder `COPY.admin.auth.invalidCredentials`. `[ASSUMPTION-AUTH-2]`
- The `Set-Cookie` header is absent.
- The `last_login_at` column for the row is NOT updated.

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-05 — Login failure: email not found (anti-enumeration)

**Requirement:** R2.2

**Given** no row exists in `admin_users` with `email = "ghost@example.com"`,
**When** a POST request is sent with `{"email": "ghost@example.com", "password": "AnyPassword1!"}`,
**Then:**
- The response status code is `401 Unauthorized`.
- The response body `error` field equals `"WB-ADMIN-AUTH-003"`.
- The response body `message` field is byte-for-byte identical to the message returned by AC-AUTH-04 (same copy key `COPY.admin.auth.invalidCredentials`).
- The `Set-Cookie` header is absent.
- The response time is not measurably faster than the response time for AC-AUTH-04 under the same load conditions. Specifically: median response time for this case must not be more than 100 ms less than median response time for AC-AUTH-04 when measured over 20 consecutive requests under no-load conditions on the same hardware.

**Test Type:** Integration, Security (timing)
**Priority:** P0

---

#### AC-AUTH-06 — Login failure: account deactivated

**Requirement:** R2.4
**[ASSUMPTION-AUTH-3]** Both Option A and Option B are documented. Product team must choose.

**Given** an `admin_users` row exists with `email = "inactive@example.com"`, `is_active = false`, and a password hash matching a known plaintext,
**When** a POST request is sent with the correct email and matching plaintext password,
**Then (if ASSUMPTION-AUTH-3 Option A — no disclosure):**
- Response status is `401 Unauthorized`.
- Response body `error` = `"WB-ADMIN-AUTH-003"`.
- Response body `message` = copy key `COPY.admin.auth.invalidCredentials` (same as wrong-password message).
- The `Set-Cookie` header is absent.

**Then (if ASSUMPTION-AUTH-3 Option B — explicit disclosure):**
- Response status is `403 Forbidden`.
- Response body `error` = `"WB-ADMIN-AUTH-004"`.
- Response body `message` = copy key `COPY.admin.auth.accountDeactivated`.
- The `Set-Cookie` header is absent.

**Note to QA:** Do not write a test for this AC until ASSUMPTION-AUTH-3 is resolved. The exact error code and copy key differ by option.

**Test Type:** Integration
**Priority:** P0

---

### R3 — Login Endpoint: Rate Limiting

**R3** The nginx layer must enforce a rate limit of 5 requests per minute per source IP address on the login endpoint. The backend must surface a machine-readable response when this limit is exceeded.

---

#### AC-AUTH-07 — Rate limit: sixth request within 60 seconds is rejected

**Requirement:** R3
**[ASSUMPTION-AUTH-1]** Assumes Option A: 429 with `Retry-After` header.

**Given** the nginx rate limit zone is configured for 5 requests per minute on `POST /api/admin/auth/login`,
**When** a single IP address sends 5 POST requests to `/api/admin/auth/login` within a 60-second window (any combination of valid and invalid credentials) and then sends a 6th request within the same 60-second window,
**Then:**
- The 6th response status code is `429 Too Many Requests`.
- The response includes a `Retry-After` header whose value is an integer number of seconds (1 to 60 inclusive) indicating when the client may retry.
- The response body contains `error` = `"WB-ADMIN-AUTH-005"`.
- The response body contains `message` matching copy placeholder `COPY.admin.auth.rateLimitExceeded`.
- The `Set-Cookie` header is absent.
- The first 5 requests are processed normally (success or failure per their credentials).

**Test Type:** Integration (nginx + backend), E2E
**Priority:** P0

---

#### AC-AUTH-07b — Rate limit: resets after 60 seconds

**Requirement:** R3

**Given** an IP address has been rate-limited (received a 429 on its 6th request),
**When** 61 seconds elapse from the start of the 60-second window and a new request is sent,
**Then:**
- The response status code is NOT `429`.
- The request is processed normally (success or failure based on credentials).

**Test Type:** Integration
**Priority:** P1

---

### R4 — Logout Endpoint

**R4** The system must invalidate the operator session by clearing the `admin_token` cookie.

**R4.1** `[ASSUMPTION-AUTH-9 — Option A]` The logout endpoint requires a valid, unexpired JWT cookie. Requests with a missing, malformed, or expired cookie return 401.

**R4.2** On successful logout, the `admin_token` cookie is cleared by setting `Max-Age=0` and `Expires` to a date in the past.

---

#### AC-AUTH-08 — Logout success: valid session

**Requirement:** R4.2

**Given** an operator has a valid, unexpired `admin_token` cookie,
**When** a POST request is sent to `/api/admin/auth/logout` with that cookie,
**Then:**
- The response status code is `200 OK`.
- The response `Set-Cookie` header includes `admin_token=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/`.
- The response body is `{"ok": true}`.
- A subsequent authenticated request using the same cookie value returns `401 Unauthorized` (the cookie value is no longer accepted). Note: because the auth system is stateless JWT, this AC tests that the browser-side cookie is cleared; the backend does not maintain a server-side revocation list unless R4.3 is added. If server-side revocation is required, it must be specced as a separate requirement. `[ASSUMPTION-AUTH-18]` — see below.
- `[ASSUMPTION-AUTH-7]` After the frontend receives the 200 response, the browser navigates to the route confirmed by the product team.

**Test Type:** Integration, E2E
**Priority:** P0

**[ASSUMPTION-AUTH-18]** Does the auth system maintain a server-side JWT revocation list (e.g., a denylist in Redis or the DB)?
- Option A: No revocation list. The cookie is cleared client-side; a stolen token remains valid until `exp`. This is the current PRD scope.
- Option B: Yes, add a `revoked_tokens` table keyed by JWT `jti` claim; middleware checks it on every request.
- Option C: Short-lived tokens (e.g., 15-minute expiry) with refresh tokens, making revocation less critical.

This is a security posture decision. Option A assumed below. If Option B or C is chosen, a separate spec is required.

---

#### AC-AUTH-09 — Logout failure: no cookie present

**Requirement:** R4.1

**Given** a request is sent to `/api/admin/auth/logout` with no `admin_token` cookie,
**When** the request is processed,
**Then:**
- The response status code is `401 Unauthorized`.
- The response body contains `error` = `"WB-ADMIN-AUTH-006"`.
- The response body contains `message` matching copy placeholder `COPY.admin.auth.notAuthenticated`.
- No `Set-Cookie` header is present in the response.

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-10 — Logout failure: expired JWT in cookie

**Requirement:** R4.1

**Given** an `admin_token` cookie is present whose JWT `exp` claim is a Unix timestamp in the past (i.e., the token has expired),
**When** a POST request is sent to `/api/admin/auth/logout`,
**Then:**
- The response status code is `401 Unauthorized`.
- The response body contains `error` = `"WB-ADMIN-AUTH-006"`.
- No `Set-Cookie` header with `admin_token` is present.

**Test Type:** Integration
**Priority:** P0

---

### R5 — /me Endpoint

**R5** The system must return the authenticated operator's profile from the `admin_users` table, excluding any password-related fields.

---

#### AC-AUTH-11 — /me success: valid session

**Requirement:** R5
**[ASSUMPTION-AUTH-14]** Assumes Option A response shape.

**Given** an operator has a valid, unexpired `admin_token` cookie,
**When** a GET request is sent to `/api/admin/auth/me`,
**Then:**
- The response status code is `200 OK`.
- The response `Content-Type` is `application/json`.
- The response body is a JSON object containing exactly the following top-level fields: `id` (string, UUID format), `email` (string), `role` (string, one of `"admin"` or `"reviewer"`), `display_name` (string or JSON `null`), `created_at` (string, ISO 8601 UTC), `last_login_at` (string, ISO 8601 UTC or JSON `null`).
- The response body does NOT contain a `password_hash` field at any nesting level.
- The response body does NOT contain a `password` field at any nesting level.
- The `id`, `email`, and `role` values match the corresponding columns in the `admin_users` row for the authenticated user.

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-12 — /me failure: no cookie

**Requirement:** R5

**Given** a GET request is sent to `/api/admin/auth/me` with no `admin_token` cookie,
**When** the request is processed by the JWT middleware,
**Then:**
- The response status code is `401 Unauthorized`.
- The response body contains `error` = `"WB-ADMIN-AUTH-006"`.
- The response body contains `message` matching copy placeholder `COPY.admin.auth.notAuthenticated`.

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-13 — /me failure: expired JWT

**Requirement:** R5

**Given** an `admin_token` cookie is present whose JWT `exp` is a Unix timestamp strictly less than the current UTC Unix timestamp,
**When** a GET request is sent to `/api/admin/auth/me`,
**Then:**
- The response status code is `401 Unauthorized`.
- The response body contains `error` = `"WB-ADMIN-AUTH-007"`.
- The response body contains `message` matching copy placeholder `COPY.admin.auth.sessionExpired`.

**Test Type:** Integration
**Priority:** P0

---

### R6 — JWT Middleware

**R6** The system must apply JWT validation to every `/api/admin/*` route except `/api/admin/auth/login`.

**R6.1** The middleware extracts the `admin_token` cookie value. If the cookie is absent, the middleware returns 401 before the handler runs.

**R6.2** The middleware verifies the JWT signature using the `JWT_SECRET` environment variable value. If the signature is invalid, the middleware returns 401 before the handler runs.

**R6.3** The middleware checks the `exp` claim. If `exp` is less than or equal to the current UTC Unix timestamp, the middleware returns 401 before the handler runs.

**R6.4** On successful validation, the middleware injects the decoded `JwtClaims` struct into the request extensions so downstream handlers can access `sub`, `email`, and `role` without re-parsing the JWT.

**R6.5** The middleware does NOT apply to `POST /api/admin/auth/login`.

**R6.6** The middleware applies to `POST /api/admin/auth/logout` and `GET /api/admin/auth/me`.

---

#### AC-AUTH-14 — Middleware: missing cookie on protected route

**Requirement:** R6.1

**Given** any protected `/api/admin/*` route (e.g., `GET /api/admin/reports`),
**When** a request is sent with no `admin_token` cookie,
**Then:**
- The response status code is `401 Unauthorized`.
- The handler function for that route is not invoked.
- The response body contains `error` = `"WB-ADMIN-AUTH-006"`.

**Test Type:** Unit (middleware in isolation), Integration
**Priority:** P0

---

#### AC-AUTH-15 — Middleware: tampered JWT signature

**Requirement:** R6.2

**Given** a valid JWT is produced by the login endpoint, and then a single character in the signature segment (third dot-separated part) is replaced with a different character,
**When** this tampered value is sent as the `admin_token` cookie on any protected route,
**Then:**
- The response status code is `401 Unauthorized`.
- The response body contains `error` = `"WB-ADMIN-AUTH-008"`.
- The response body contains `message` matching copy placeholder `COPY.admin.auth.invalidToken`.
- The handler for the target route is not invoked.

**Test Type:** Unit, Integration
**Priority:** P0

---

#### AC-AUTH-16 — Middleware: expired JWT

**Requirement:** R6.3

**Given** a JWT is constructed with `exp` = `(current UTC Unix timestamp - 1)` (one second in the past), signed with the correct `JWT_SECRET`,
**When** this value is sent as the `admin_token` cookie on any protected route,
**Then:**
- The response status code is `401 Unauthorized`.
- The response body contains `error` = `"WB-ADMIN-AUTH-007"`.
- The handler for the target route is not invoked.

**Test Type:** Unit, Integration
**Priority:** P0

---

#### AC-AUTH-17 — Middleware: login route is excluded

**Requirement:** R6.5

**Given** no `admin_token` cookie is present,
**When** a POST request is sent to `/api/admin/auth/login` with a valid JSON body,
**Then:**
- The middleware does NOT return 401.
- The login handler runs and returns its normal response (200 or 401 based on credentials).

**Test Type:** Unit, Integration
**Priority:** P0

---

#### AC-AUTH-18 — Middleware: JwtClaims injected into extensions

**Requirement:** R6.4

**Given** a valid, unexpired `admin_token` cookie is present,
**When** a request reaches any protected handler,
**Then:**
- The handler can extract `JwtClaims` from request extensions without returning an error.
- The `sub` field of the extracted claims equals the `id` (UUID) of the authenticated `admin_users` row.
- The `role` field of the extracted claims equals the `role` column of that row as a string.

**Test Type:** Unit (middleware + mock handler), Integration
**Priority:** P0

---

### R7 — Role Gating

**R7** The system must enforce role-based access control via a pure function applied after JWT validation.

**R7.1** `require_role(claims, required_role)` returns `Ok(())` when `claims.role` equals `required_role` or when `required_role` is `reviewer` and `claims.role` is `admin` (admin is a superset of reviewer permissions).

**R7.2** `require_role(claims, required_role)` returns `Err(AppError::Forbidden)` when `claims.role` is `reviewer` and `required_role` is `admin`.

**R7.3** The `admin` role has access to all `/api/admin/*` endpoints.

**R7.4** The `reviewer` role has access to: list reports, get single report, update report status. The `reviewer` role does NOT have access to: delete report, list admin users, create admin user, delete admin user.

---

#### AC-AUTH-19 — Role gate: admin accessing admin-only endpoint

**Requirement:** R7.1, R7.3

**Given** an operator with `role = "admin"` has a valid session,
**When** they request any endpoint restricted to the `admin` role (e.g., `DELETE /api/admin/reports/:id`),
**Then:**
- The response status code is NOT `403`.
- The handler logic runs normally.

**Test Type:** Unit (`require_role` pure function), Integration
**Priority:** P0

---

#### AC-AUTH-20 — Role gate: reviewer blocked from admin-only endpoint

**Requirement:** R7.2, R7.4

**Given** an operator with `role = "reviewer"` has a valid session,
**When** they request an endpoint restricted to the `admin` role (e.g., `DELETE /api/admin/reports/:id` or `GET /api/admin/users`),
**Then:**
- The response status code is `403 Forbidden`.
- The response body contains `error` = `"WB-ADMIN-AUTH-009"`.
- The response body contains `message` matching copy placeholder `COPY.admin.auth.insufficientRole`.
- The handler's core logic (the destructive or privileged operation) is not executed.

**Test Type:** Unit, Integration
**Priority:** P0

---

#### AC-AUTH-21 — Role gate: reviewer accessing reviewer-permitted endpoint

**Requirement:** R7.1, R7.4

**Given** an operator with `role = "reviewer"` has a valid session,
**When** they request an endpoint permitted to reviewers (e.g., `GET /api/admin/reports` or `PATCH /api/admin/reports/:id/status`),
**Then:**
- The response status code is NOT `403`.
- The handler logic runs normally.

**Test Type:** Unit, Integration
**Priority:** P0

---

#### AC-AUTH-22 — Role gate: require_role is a pure function

**Requirement:** R7

**Given** the `require_role` function,
**When** called with any combination of (`admin`, `admin`), (`admin`, `reviewer`), (`reviewer`, `reviewer`), (`reviewer`, `admin`),
**Then:**
- (`admin`, `admin`) → `Ok(())`
- (`admin`, `reviewer`) → `Ok(())` (admin satisfies reviewer requirement)
- (`reviewer`, `reviewer`) → `Ok(())`
- (`reviewer`, `admin`) → `Err` variant that maps to HTTP 403

The function produces the same output for the same inputs on every invocation. It takes no external input (no DB call, no clock read, no network call).

**Test Type:** Unit
**Priority:** P0

---

### R8 — Admin Seeding

**R8** The system must create an initial admin user on startup when the `admin_users` table is empty and seed environment variables are provided.

**R8.1** Seeding runs after all migrations have completed successfully.

**R8.2** Seeding is idempotent: if the table has one or more rows, seeding performs no write operations.

**R8.3** The seed user's password is hashed with argon2id before storage. The plaintext password is never written to any log, file, or database column.

**R8.4** `[ASSUMPTION-AUTH-13]` The seed password is rejected at startup if it is shorter than the minimum length (e.g., 12 characters). The startup process logs an error and exits with a non-zero exit code.

**R8.5** If `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` are both unset and the table is empty, the system logs a warning-level message and continues startup without creating a seed user. The warning message must contain the text `"admin_users table is empty"` and `"ADMIN_SEED_EMAIL"`.

**R8.6** `[ASSUMPTION-AUTH-12]` If exactly one of `ADMIN_SEED_EMAIL` or `ADMIN_SEED_PASSWORD` is set but the other is unset, behavior must be confirmed per ASSUMPTION-AUTH-12.

**R8.7** `[ASSUMPTION-AUTH-17]` The seed user's plaintext password is never emitted at any log level.

---

#### AC-AUTH-23 — Seeding: table empty, both vars set, valid password

**Requirement:** R8.1, R8.2, R8.3

**Given** the `admin_users` table has zero rows AND `ADMIN_SEED_EMAIL = "seed@example.com"` AND `ADMIN_SEED_PASSWORD = "SecurePass123!"` (12+ chars),
**When** the backend starts up,
**Then:**
- Exactly one row is inserted into `admin_users` with `email = "seed@example.com"` and `role = "admin"`.
- The inserted row's `password_hash` column value is a valid argon2id hash string (begins with `$argon2id$`).
- The inserted row's `is_active` column is `true`.
- The plaintext value `"SecurePass123!"` does not appear in any log output at any log level.
- The application reaches the "listening" state (startup completes successfully).

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-24 — Seeding: table has existing rows (idempotency)

**Requirement:** R8.2

**Given** the `admin_users` table already has one or more rows AND `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` are set,
**When** the backend starts up,
**Then:**
- No new rows are inserted into `admin_users`.
- The row count in `admin_users` is the same before and after startup.
- No warning or error is logged about seeding.

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-25 — Seeding: both vars unset, table empty — warning logged

**Requirement:** R8.5

**Given** the `admin_users` table has zero rows AND `ADMIN_SEED_EMAIL` is unset (not present in environment) AND `ADMIN_SEED_PASSWORD` is unset,
**When** the backend starts up,
**Then:**
- No rows are inserted into `admin_users`.
- The application log contains a warning-level entry whose message contains the substring `"admin_users table is empty"` and the substring `"ADMIN_SEED_EMAIL"`.
- The application reaches the "listening" state (startup does not abort).

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-26 — Seeding: seed password below minimum length

**Requirement:** R8.4
**[ASSUMPTION-AUTH-13]** Assumes Option A: 12-character minimum.

**Given** the `admin_users` table has zero rows AND `ADMIN_SEED_EMAIL` is set AND `ADMIN_SEED_PASSWORD` is set to a value with fewer than 12 characters (e.g., `"short"`),
**When** the backend starts up,
**Then:**
- No rows are inserted into `admin_users`.
- The application logs an error-level entry containing the substring `"ADMIN_SEED_PASSWORD"` and `"minimum length"`.
- The process exits with a non-zero exit code before reaching the "listening" state.

**Test Type:** Integration
**Priority:** P0

---

### R9 — CORS for Cookie Auth

**R9** The CORS configuration must permit the frontend origin to send and receive cookies.

---

#### AC-AUTH-27 — CORS: preflight for admin login includes allow-credentials

**Requirement:** R9

**Given** `CORS_ORIGIN = "http://localhost:3000"`,
**When** an OPTIONS preflight request is sent to `/api/admin/auth/login` with `Origin: http://localhost:3000` and `Access-Control-Request-Method: POST`,
**Then:**
- The response includes `Access-Control-Allow-Origin: http://localhost:3000` (exact match, not wildcard `*`).
- The response includes `Access-Control-Allow-Credentials: true`.
- The response does NOT include `Access-Control-Allow-Origin: *`.

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-28 — CORS: origin mismatch rejected

**Requirement:** R9

**Given** `CORS_ORIGIN = "http://localhost:3000"`,
**When** a request is sent from `Origin: http://attacker.example.com`,
**Then:**
- The response does NOT include `Access-Control-Allow-Origin: http://attacker.example.com`.
- The response does NOT include `Access-Control-Allow-Credentials: true` for this origin.

**Test Type:** Integration, Security
**Priority:** P0

---

### R10 — Cookie Security Attributes

**R10** The `admin_token` cookie must carry security attributes that prevent JavaScript access and cross-site request forgery.

---

#### AC-AUTH-29 — Cookie attributes: non-secure environment

**Requirement:** R10

**Given** `COOKIE_SECURE = "false"` (or the variable is unset),
**When** a successful login response is observed,
**Then:**
- The `Set-Cookie` header for `admin_token` includes `HttpOnly`.
- The `Set-Cookie` header includes `SameSite=Strict`.
- The `Set-Cookie` header includes `Path=/`.
- The `Set-Cookie` header does NOT include the `Secure` attribute.

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-30 — Cookie attributes: secure environment

**Requirement:** R10

**Given** `COOKIE_SECURE = "true"`,
**When** a successful login response is observed,
**Then:**
- The `Set-Cookie` header for `admin_token` includes `HttpOnly`.
- The `Set-Cookie` header includes `SameSite=Strict`.
- The `Set-Cookie` header includes `Path=/`.
- The `Set-Cookie` header includes `Secure`.

**Test Type:** Integration
**Priority:** P0

---

#### AC-AUTH-31 — Cookie not readable by JavaScript

**Requirement:** R10

**Given** the `admin_token` cookie has been set by a successful login,
**When** JavaScript running on the admin page evaluates `document.cookie`,
**Then:**
- The string `"admin_token"` does not appear in the result of `document.cookie`.

**Note:** This is an E2E assertion run in a real browser context (e.g., Playwright `page.evaluate(() => document.cookie)`).

**Test Type:** E2E
**Priority:** P0

---

## 4. AC Matrix

| Req ID | AC ID | Scenario Summary | Test Type | Priority | Notes |
|--------|-------|------------------|-----------|----------|-------|
| R1.2, R1.3 | AC-AUTH-01 | Login: missing or empty email/password | Unit, Integration | P0 | |
| R1.4 | AC-AUTH-02 | Login: invalid email format | Unit | P1 | |
| R1.5 | AC-AUTH-02b | Login: password exceeds max byte length | Unit | P1 | ASSUMPTION-AUTH-4 |
| R1.1 | AC-AUTH-02c | Login: wrong Content-Type | Unit, Integration | P2 | ASSUMPTION-AUTH-2b |
| R2.1, R2.5 | AC-AUTH-03 | Login success: valid credentials, active | Integration, E2E | P0 | |
| R2.3 | AC-AUTH-04 | Login failure: wrong password | Integration | P0 | |
| R2.2 | AC-AUTH-05 | Login failure: email not found (anti-enum) | Integration, Security | P0 | Timing assertion required |
| R2.4 | AC-AUTH-06 | Login failure: account deactivated | Integration | P0 | ASSUMPTION-AUTH-3 BLOCKING |
| R3 | AC-AUTH-07 | Rate limit: 6th request rejected within 60s | Integration, E2E | P0 | ASSUMPTION-AUTH-1 |
| R3 | AC-AUTH-07b | Rate limit: resets after 60s | Integration | P1 | |
| R4.2 | AC-AUTH-08 | Logout success: valid session | Integration, E2E | P0 | ASSUMPTION-AUTH-7, AUTH-18 |
| R4.1 | AC-AUTH-09 | Logout failure: no cookie | Integration | P0 | |
| R4.1 | AC-AUTH-10 | Logout failure: expired JWT | Integration | P0 | |
| R5 | AC-AUTH-11 | /me success: valid session, no password_hash | Integration | P0 | ASSUMPTION-AUTH-14 |
| R5 | AC-AUTH-12 | /me failure: no cookie | Integration | P0 | |
| R5 | AC-AUTH-13 | /me failure: expired JWT | Integration | P0 | |
| R6.1 | AC-AUTH-14 | Middleware: missing cookie on protected route | Unit, Integration | P0 | |
| R6.2 | AC-AUTH-15 | Middleware: tampered JWT signature | Unit, Integration | P0 | |
| R6.3 | AC-AUTH-16 | Middleware: expired JWT | Unit, Integration | P0 | |
| R6.5 | AC-AUTH-17 | Middleware: login route excluded | Unit, Integration | P0 | |
| R6.4 | AC-AUTH-18 | Middleware: JwtClaims injected | Unit, Integration | P0 | |
| R7.1, R7.3 | AC-AUTH-19 | Role gate: admin on admin-only endpoint | Unit, Integration | P0 | |
| R7.2, R7.4 | AC-AUTH-20 | Role gate: reviewer blocked from admin-only | Unit, Integration | P0 | |
| R7.1, R7.4 | AC-AUTH-21 | Role gate: reviewer on reviewer endpoint | Unit, Integration | P0 | |
| R7 | AC-AUTH-22 | require_role pure function: all 4 input combos | Unit | P0 | |
| R8.1–R8.3 | AC-AUTH-23 | Seeding: empty table, valid vars | Integration | P0 | |
| R8.2 | AC-AUTH-24 | Seeding: table has rows (idempotent) | Integration | P0 | |
| R8.5 | AC-AUTH-25 | Seeding: both vars unset, table empty | Integration | P0 | |
| R8.4 | AC-AUTH-26 | Seeding: password below minimum length | Integration | P0 | ASSUMPTION-AUTH-13 |
| R9 | AC-AUTH-27 | CORS: preflight includes allow-credentials | Integration | P0 | |
| R9 | AC-AUTH-28 | CORS: origin mismatch rejected | Integration, Security | P0 | |
| R10 | AC-AUTH-29 | Cookie: non-secure environment attributes | Integration | P0 | |
| R10 | AC-AUTH-30 | Cookie: secure environment attributes | Integration | P0 | |
| R10 | AC-AUTH-31 | Cookie: not readable by JavaScript | E2E | P0 | Playwright browser context |

---

## 5. Edge Case Matrix

For each edge case: **Trigger Condition → Expected System Behavior → User-Facing Message (copy placeholder) → Test Type**

| # | Edge Case | Trigger Condition | Expected System Behavior | User-Facing Message | Test Type |
|---|-----------|-------------------|--------------------------|---------------------|-----------|
| EC-01 | SQL injection in email field | `email = "' OR 1=1--"` or similar payloads sent to login endpoint | Parameterized query via SQLx prevents injection; no SQL executed beyond the parameterized lookup; response is 401 (email not found path) | `COPY.admin.auth.invalidCredentials` | Integration, Security |
| EC-02 | SQL injection in password field | `password = "'; DROP TABLE admin_users;--"` | argon2id verification receives the literal string; no SQL injection possible (password never interpolated into SQL); response is 401 | `COPY.admin.auth.invalidCredentials` | Integration, Security |
| EC-03 | JWT with `alg: none` attack | Attacker crafts a JWT with header `{"alg":"none"}` and no signature | Middleware rejects the token; response is 401; the `alg: none` variant must not be accepted by the JWT library | `COPY.admin.auth.invalidToken` | Unit, Security |
| EC-04 | JWT signed with wrong algorithm | Attacker uses HS512 or RS256 instead of the expected HS256 (or whatever algorithm is configured) | Middleware rejects the token; response is 401 | `COPY.admin.auth.invalidToken` | Unit, Security |
| EC-05 | JWT `exp` exactly equal to current time | `exp` = current UTC Unix timestamp (not past, not future; exactly equal) | Middleware treats this as expired; response is 401. The check is `exp <= now`, not `exp < now`. | `COPY.admin.auth.sessionExpired` | Unit |
| EC-06 | JWT `sub` references a deleted or non-existent user | Valid, unexpired JWT but the `admin_users` row has been deleted since the token was issued | [ASSUMPTION-AUTH-19] Three options: (A) Middleware accepts the token as valid (stateless; no DB lookup in middleware) — downstream handlers may return 404 if they look up the user. (B) Middleware performs a DB lookup to confirm user exists; returns 401 if not found. (C) Middleware accepts; `/me` returns 404. Product team must choose. Option A assumed below. | N/A (depends on option) | Integration |
| EC-07 | Login with Unicode in email | `email = "用户@example.com"` or RTL characters | Parameterized query executes; no DB row found; timing-safe dummy argon2 runs; response is 401 | `COPY.admin.auth.invalidCredentials` | Integration |
| EC-08 | Login with Unicode password | Password contains emoji, Arabic, Devanagari, or null bytes | If byte length is within the max limit (ASSUMPTION-AUTH-4), argon2 receives the UTF-8 bytes. Null byte (`\x00`) must be rejected with 400. | `COPY.admin.auth.invalidCredentials` (wrong password) or `WB-ADMIN-AUTH-002` (null byte / over limit) | Unit, Integration |
| EC-09 | Concurrent login requests with same credentials | Same credentials sent in parallel from multiple tabs/clients | Both may succeed; multiple valid JWTs may coexist. No race condition on `last_login_at` update (last writer wins is acceptable). Both responses return 200 with their own cookies. | None | Integration |
| EC-10 | Admin token cookie present but empty string | Cookie header `admin_token=` (empty value) | Middleware treats empty value as absent; returns 401 | `COPY.admin.auth.notAuthenticated` | Unit |
| EC-11 | JWT with future `iat` (issued-at) | JWT has `iat` = current time + 3600 (issued one hour in the future) | [ASSUMPTION-AUTH-20] Option A: reject (clock skew attack indicator). Option B: accept if `exp` is valid. Requires product decision. Assumed: accept if `exp` is valid. | `COPY.admin.auth.invalidToken` (if rejected) | Unit |
| EC-12 | `JWT_SECRET` env var is empty string or absent | Backend starts with no `JWT_SECRET` set | Application must fail startup with a non-zero exit code and an error log containing `"JWT_SECRET"`. It must not start in an insecure state where all tokens are accepted or all tokens fail silently. | N/A (startup failure) | Integration |
| EC-13 | Login request body is valid JSON but wrong type (e.g., `email` is an integer) | `{"email": 12345, "password": "abc"}` | Response is 400; body contains `WB-ADMIN-AUTH-001`; no DB call | `COPY.admin.auth.missingCredentials` | Unit |
| EC-14 | Login request body is empty JSON object `{}` | `{}` with `Content-Type: application/json` | Response is 400; no DB call; same as missing fields | `COPY.admin.auth.missingCredentials` | Unit |
| EC-15 | Logout called when cookie is syntactically present but not a valid JWT (e.g., `admin_token=garbage`) | POST /api/admin/auth/logout with `admin_token=not.a.jwt` | Response is 401; no cookie cleared (no `Set-Cookie` with Max-Age=0) | `COPY.admin.auth.invalidToken` | Integration |
| EC-16 | `COOKIE_SECURE=true` on an HTTP (non-TLS) connection | Browser receives a `Secure` cookie over plain HTTP | Browser silently discards the cookie; the operator cannot log in. This is an infrastructure misconfiguration, not a bug. The AC must document this as a known constraint: `COOKIE_SECURE=true` requires TLS termination at nginx or load balancer. | N/A (infrastructure config issue; document in runbook) | E2E (staging only) |
| EC-17 | Admin seeding with email already in table but different casing | `ADMIN_SEED_EMAIL = "Seed@EXAMPLE.COM"` but row exists with `email = "seed@example.com"` | [ASSUMPTION-AUTH-21] The DB `UNIQUE` constraint on `email` may or may not be case-insensitive depending on the collation. Behavior must be confirmed. Option A: treat as existing (case-insensitive unique index). Option B: treat as new (case-sensitive); insert succeeds. DB schema must define collation explicitly. | N/A (startup behavior) | Integration |
| EC-18 | `reviewer` requests `GET /api/admin/auth/me` | Reviewer has valid session; calls /me | Returns 200 with correct profile; `role` field = `"reviewer"`. /me is not admin-only. | None | Integration |
| EC-19 | Request with two `admin_token` cookies (duplicate headers) | Cookie header contains `admin_token=val1; admin_token=val2` | [ASSUMPTION-AUTH-22] Option A: use the first value. Option B: use the last value. Option C: return 400 (ambiguous). Axum/tower-cookies behavior must be documented. | If 400: `COPY.admin.auth.invalidToken` | Unit |

---

## 6. Error Codes and User-Facing Messages

New domain reserved: `WB-ADMIN-AUTH-001` to `WB-ADMIN-AUTH-099` for Admin Auth subsystem.

| Error Code | Trigger Condition | Internal Log Message (template) | User-Facing Message (Copy Placeholder) | Recovery Action Offered to User |
|------------|-------------------|---------------------------------|----------------------------------------|---------------------------------|
| WB-ADMIN-AUTH-001 | Missing/empty email, missing/empty password, wrong field type, empty JSON body | `auth.login.validation_failed: {reason}` | `COPY.admin.auth.missingCredentials` | Form highlights the missing field; no redirect |
| WB-ADMIN-AUTH-002 | Password exceeds maximum byte length | `auth.login.password_too_long: {byte_length} bytes` | `COPY.admin.auth.passwordTooLong` | Prompt to shorten password |
| WB-ADMIN-AUTH-003 | Wrong password OR email not found (unified anti-enumeration) | `auth.login.invalid_credentials: email={email_hash}` (hash, not plaintext) | `COPY.admin.auth.invalidCredentials` | Link to contact admin for account help |
| WB-ADMIN-AUTH-004 | Account is deactivated (only if ASSUMPTION-AUTH-3 Option B chosen) | `auth.login.account_deactivated: user_id={id}` | `COPY.admin.auth.accountDeactivated` | "Contact an administrator" link |
| WB-ADMIN-AUTH-005 | Rate limit exceeded (nginx 429) | `auth.login.rate_limited: ip={ip}` | `COPY.admin.auth.rateLimitExceeded` | "Try again in {N} seconds" (from `Retry-After` header) |
| WB-ADMIN-AUTH-006 | Cookie absent or empty on authenticated route | `auth.middleware.no_cookie: path={path}` | `COPY.admin.auth.notAuthenticated` | Redirect to login page |
| WB-ADMIN-AUTH-007 | JWT `exp` claim is in the past | `auth.middleware.token_expired: sub={sub}, exp={exp}` | `COPY.admin.auth.sessionExpired` | Redirect to login page; "Your session has expired" |
| WB-ADMIN-AUTH-008 | JWT signature verification failed OR `alg:none` OR wrong algorithm | `auth.middleware.invalid_signature: path={path}` | `COPY.admin.auth.invalidToken` | Redirect to login page |
| WB-ADMIN-AUTH-009 | Caller's role is insufficient for the requested endpoint | `auth.role_gate.forbidden: required={required}, actual={actual}, path={path}` | `COPY.admin.auth.insufficientRole` | None (inform of role limitation; no self-service upgrade) |
| WB-ADMIN-AUTH-010 | `JWT_SECRET` absent or empty at startup | `startup.fatal: JWT_SECRET not set` | N/A — startup failure, no HTTP response | Operator must set env var and restart |
| WB-ADMIN-AUTH-011 | Seed password below minimum length at startup | `startup.fatal: ADMIN_SEED_PASSWORD below minimum length of {n} chars` | N/A — startup failure | Operator must update env var and restart |

**Internal log notes:**
- `email_hash` in WB-ADMIN-AUTH-003 internal log: the email must be logged as a one-way hash (e.g., SHA-256 hex of the lowercase email). The plaintext email must never appear in logs.
- All internal log messages must include a `request_id` field sourced from the `X-Request-ID` header (per existing nginx observability setup).

---

## 7. Data Retention and Privacy Requirements

### 7.1 Data Elements Collected by Admin Auth

| Data Element | Source | PII under DPDP Act 2023? | Public Display Boundary | Internal Use Only | Retention Period | Deletion Trigger |
|---|---|---|---|---|---|---|
| `admin_users.email` | Set at account creation or seeding | Yes — directly identifies the operator | Never displayed publicly | Used for login lookup, internal audit logs (hashed) | Duration of employment + 90 days | Manual deletion by admin or account deactivation + 90 days |
| `admin_users.password_hash` | Derived from plaintext at creation | No (hash, not PII itself) | Never displayed or returned via API | Stored in DB only; never in logs or API responses | Same as account row | Row deletion |
| `admin_users.role` | Set at creation | No | Never displayed publicly | Used in JWT claims; visible to the authenticated user in `/me` response | Same as account row | Row deletion |
| `admin_users.display_name` | Optional, set at creation | Conditional — if real name used, then Yes | Never displayed publicly on citizen-facing map | Visible to the authenticated user in `/me` response | Same as account row | Row deletion |
| `admin_users.last_login_at` | Set on successful login | No | Never displayed publicly | Internal audit only | Same as account row | Row deletion |
| JWT payload (`sub`, `email`, `role`, `exp`) | Derived from DB at login | `email` field = Yes | Transmitted in cookie; not in response body | Cookie; not stored server-side (stateless) | Expires per `exp` claim; cookie cleared on logout | Logout (cookie cleared); token expiry |
| Source IP address at login | nginx access log | Yes under DPDP Act 2023 | Never displayed publicly | Rate limiting; security audit logs | `[ASSUMPTION-AUTH-23]` — See options below | Log rotation |
| nginx access logs (request metadata) | nginx | Partial (IP is PII) | Never displayed publicly | Security audit, debugging | `[ASSUMPTION-AUTH-23]` | Log rotation |

**[ASSUMPTION-AUTH-23]** What is the retention period for nginx access logs containing source IP addresses?
- Option A: 30 days rolling, then automatic deletion.
- Option B: 90 days rolling.
- Option C: 7 days rolling.

### 7.2 Password Handling Rules

- Plaintext passwords must never appear in: database columns, log files at any level (DEBUG, INFO, WARN, ERROR), HTTP response bodies, HTTP response headers, error messages, or tracing spans.
- The only acceptable operations on a plaintext password are: (a) argon2id hashing for storage, (b) argon2id verification against a stored hash. Both operations must complete in memory with no intermediate persistence.
- If a future feature requires password reset, the reset token (not the new password) must be the only value transmitted and logged. This is out of scope for the current spec but documented here as a constraint on future design.

### 7.3 PII Compliance Note

Under the Digital Personal Data Protection Act 2023 (India), `email` and `display_name` (if a real name) are personal data. The admin dashboard is an internal tool; however, if operators are employees or contractors, their data is still subject to DPDP obligations. The product team must confirm that:
1. A lawful basis for processing (legitimate interest or contractual necessity) is documented before go-live.
2. Operators are informed of what data is stored and how long.

This is flagged here; it is not blocked by this AC document.

---

## 8. Location Handling Rules

The Admin Auth subsystem does not collect, process, or display geographic location data. This section is included for completeness per the standard deliverable template.

**Not applicable to this feature.** The admin auth system operates on `email`, `password`, `role`, and session tokens only.

---

## 9. Non-Functional Requirements

### 9.1 Performance

| Requirement | Threshold | Notes |
|---|---|---|
| Login response time (valid credentials, no rate limit) | p95 ≤ 500 ms on the server side under no-load conditions | argon2id hashing is intentionally slow; this threshold accounts for OWASP-recommended parameters |
| Login response time (email not found) | p95 ≤ 500 ms and ≥ p95 of the valid-credentials path minus 100 ms | Timing-safe requirement; see AC-AUTH-05 |
| /me response time | p95 ≤ 100 ms (single DB row lookup + JWT verification, no hashing) | |
| JWT middleware overhead per request | ≤ 5 ms added to any request | In-memory signature verification only |
| Logout response time | p95 ≤ 100 ms | Cookie clear + 200; no DB write required unless ASSUMPTION-AUTH-18 Option B is chosen |

`[ASSUMPTION-AUTH-24]` Are these performance thresholds acceptable, or does the product team have different SLOs for the admin dashboard (which is lower-traffic than the public API)?
- Option A: Thresholds above are accepted as-is.
- Option B: More lenient — p95 ≤ 1000 ms for login (admin dashboard is not latency-sensitive).
- Option C: Stricter — define via load testing on target hardware before go-live.

### 9.2 Availability

- The admin auth endpoints must be available whenever the main backend is available.
- There is no separate SLA for the admin dashboard vs. the public API. `[ASSUMPTION-AUTH-25]` — confirm if a separate SLA is needed.
- Degraded mode: if the database is unreachable, login returns 503. The JWT middleware continues to function for unexpired tokens (stateless validation). Operators already logged in can continue browsing cached/read-only views if the frontend implements local state. This is a frontend behavior spec item, not a middleware spec item.

### 9.3 Security

- argon2id parameters must meet OWASP 2023 minimum recommendations. `[ASSUMPTION-AUTH-16]`
- `JWT_SECRET` must be a cryptographically random value of at least 32 bytes. The system must reject startup if `JWT_SECRET` is shorter than 32 bytes. `[ASSUMPTION-AUTH-26]` — confirm minimum length.
  - Option A: Minimum 32 bytes.
  - Option B: Minimum 64 bytes.
  - Option C: No programmatic enforcement; documented as operational requirement.
- The `SameSite=Strict` attribute prevents the cookie from being sent on cross-site requests, including CSRF attacks.
- No admin auth secret (JWT_SECRET, ADMIN_SEED_PASSWORD) may appear in: source code, Docker image layers, CI build logs, or version-controlled files (including `.env` files committed to the repository).

### 9.4 Accessibility

- The admin login form is an internal tool. WCAG 2.1 AA compliance is the target for the login page UI.
- Login error messages must be announced to screen readers (e.g., injected into an ARIA live region with `role="alert"`).
- The login form must be keyboard-navigable: Tab moves from email field → password field → submit button in order. Enter on the password field submits the form.

### 9.5 Localization

- The admin dashboard is an internal English-only tool for the current scope.
- All user-facing messages use copy placeholders (listed in Section 6) to allow future localization without code changes.
- `[ASSUMPTION-AUTH-27]` Should the admin dashboard support Kannada or other languages in a future version?
  - Option A: English-only permanently (internal tool).
  - Option B: English + Kannada (consistent with citizen-facing app).
  - Option C: Defer decision; ensure copy is externalized now (already required by this spec).

---

## 10. API Behavioral Expectations

### POST /api/admin/auth/login

**Accepted input:**
- Content-Type: `application/json`
- Body: `{"email": string, "password": string}`
- `email`: non-empty string, RFC 5322 basic syntax, max 254 characters (RFC 5321 limit)
- `password`: non-empty string, max `[ASSUMPTION-AUTH-4]` bytes in UTF-8 encoding

**Success response:**
- Status: `200 OK`
- Content-Type: `application/json`
- Body: `{"ok": true}`
- Set-Cookie: `admin_token=<jwt>; HttpOnly; SameSite=Strict; Path=/[; Secure]`
- No JWT value in the response body

**Failure responses:**
- `400` — validation failure (missing fields, wrong type, oversized password)
- `401` — invalid credentials or deactivated account
- `415` — wrong Content-Type (see AC-AUTH-02c)
- `429` — rate limited by nginx

**Idempotency:** NOT idempotent. Each successful call generates a new JWT with a new `exp`. Multiple calls with valid credentials produce multiple valid cookies; each is independently valid until its own expiry.

**Timeout:** No server-side request timeout specific to this endpoint beyond the nginx proxy timeout of 30 seconds (per existing nginx config).

**Rate limiting (client-visible behavior):** After the 5th request within 60 seconds from a given IP, all subsequent requests within that window receive 429 with `Retry-After`. The client must wait the duration specified in `Retry-After` before retrying.

---

### POST /api/admin/auth/logout

**Accepted input:**
- Cookie: `admin_token=<valid jwt>` (required per ASSUMPTION-AUTH-9 Option A)
- Body: empty

**Success response:**
- Status: `200 OK`
- Body: `{"ok": true}`
- Set-Cookie: `admin_token=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/`

**Failure responses:**
- `401` — cookie absent, expired, or invalid

**Idempotency:** NOT idempotent under ASSUMPTION-AUTH-9 Option A (second call with an expired/cleared cookie returns 401). Under Option B, idempotent (always 200).

---

### GET /api/admin/auth/me

**Accepted input:**
- Cookie: `admin_token=<valid jwt>` (required)
- No query parameters, no request body

**Success response (ASSUMPTION-AUTH-14 Option A):**
```
{
  "id": "<uuid>",
  "email": "<string>",
  "role": "admin" | "reviewer",
  "display_name": "<string>" | null,
  "created_at": "<ISO 8601 UTC>",
  "last_login_at": "<ISO 8601 UTC>" | null
}
```

**Fields guaranteed absent:** `password_hash`, `password`, any field not listed above.

**Failure responses:**
- `401` — cookie absent, expired, or invalid

**Idempotency:** Idempotent. Multiple identical calls return the same response (assuming no concurrent DB updates).

---

## 11. Handoff Checklist

```
Handoff Checklist:
[x] Each requirement (R1…R10) has at least one success AC and one failure AC
[x] Each AC is mapped to at least one test type in the AC matrix
[x] Edge cases addressed:
    [x] SQL injection (email and password fields) — EC-01, EC-02
    [x] JWT alg:none and wrong-algorithm attacks — EC-03, EC-04
    [x] JWT exp boundary (exactly equal to now) — EC-05
    [x] Deleted user with valid JWT — EC-06
    [x] Unicode in email and password — EC-07, EC-08
    [x] Concurrent logins — EC-09
    [x] Empty cookie value — EC-10
    [x] JWT future iat — EC-11
    [x] Missing JWT_SECRET at startup — EC-12
    [x] Wrong JSON field types — EC-13, EC-14
    [x] Syntactically invalid JWT in cookie — EC-15
    [x] COOKIE_SECURE=true over plain HTTP — EC-16
    [x] Email case sensitivity at seeding — EC-17
    [x] Reviewer calling /me — EC-18
    [x] Duplicate cookie headers — EC-19
[x] Error codes defined for all failure paths (WB-ADMIN-AUTH-001 to 011)
[x] User-facing messages defined via copy placeholders for all failure paths
[x] Privacy/public-display boundaries specified for each data element (Section 7)
[x] Location handling rules: N/A for this feature; documented as such
[x] All assumptions labeled [ASSUMPTION-AUTH-n] with 2-3 decision options

OPEN ASSUMPTIONS REQUIRING PRODUCT TEAM DECISION (blocking items first):
BLOCKING (cannot write tests until resolved):
  [ ] ASSUMPTION-AUTH-1  — Rate limit HTTP status code
  [ ] ASSUMPTION-AUTH-2  — Exact copy for invalid credentials message
  [ ] ASSUMPTION-AUTH-3  — Deactivated account response (security posture choice)
  [ ] ASSUMPTION-AUTH-4  — Max password byte length
  [ ] ASSUMPTION-AUTH-6  — Post-login redirect destination
  [ ] ASSUMPTION-AUTH-7  — Post-logout redirect destination
  [ ] ASSUMPTION-AUTH-12 — Partial seed env var behavior
  [ ] ASSUMPTION-AUTH-13 — Seed password minimum length

NON-BLOCKING (default assumed in AC; confirm to finalize):
  [ ] ASSUMPTION-AUTH-5  — Frontend admin route structure
  [ ] ASSUMPTION-AUTH-8  — JWT_SESSION_HOURS default (24h assumed)
  [ ] ASSUMPTION-AUTH-9  — Logout requires valid JWT vs unconditional (Option A assumed)
  [ ] ASSUMPTION-AUTH-10 — Middleware 401 response type (JSON only assumed)
  [ ] ASSUMPTION-AUTH-11 — display_name required vs optional (optional assumed)
  [ ] ASSUMPTION-AUTH-14 — AdminUserResponse shape (Option A assumed)
  [ ] ASSUMPTION-AUTH-15 — last_login_at update timing (login only assumed)
  [ ] ASSUMPTION-AUTH-16 — argon2id parameters (security review required)
  [ ] ASSUMPTION-AUTH-17 — Seed password log suppression (never assumed; verify)
  [ ] ASSUMPTION-AUTH-18 — JWT revocation list (none assumed; security posture choice)
  [ ] ASSUMPTION-AUTH-19 — Middleware behavior for deleted user with valid JWT
  [ ] ASSUMPTION-AUTH-20 — Future iat claim handling
  [ ] ASSUMPTION-AUTH-21 — Email case sensitivity in seeding
  [ ] ASSUMPTION-AUTH-22 — Duplicate admin_token cookie headers
  [ ] ASSUMPTION-AUTH-23 — nginx log retention period (DPDP compliance)
  [ ] ASSUMPTION-AUTH-24 — Performance SLOs for admin dashboard
  [ ] ASSUMPTION-AUTH-25 — Separate availability SLA for admin dashboard
  [ ] ASSUMPTION-AUTH-26 — Minimum JWT_SECRET byte length
  [ ] ASSUMPTION-AUTH-27 — Admin dashboard localization roadmap

[x] No implementation details present in any AC (no ORM, no framework, no schema names beyond what was given in the PRD)
[x] No hand-wavy language present in any AC (no "gracefully", "appropriately", "as needed", "properly", "correctly")
```

---

*End of document. Version 1.0 — 2026-03-06.*
*Next review: when blocking assumptions are resolved by product team.*
*Owner: prd-to-ac-converter agent.*
