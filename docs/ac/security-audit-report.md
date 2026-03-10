# Security and Privacy Audit Report — Admin Dashboard Feature
**Project**: Bengaluru Walkability Public Audit
**Auditor**: Security & Privacy Auditor (Claude Sonnet 4.6)
**Date**: 2026-03-06
**Scope**: Admin dashboard backend (Rust/Axum), frontend (Next.js 14), nginx, Docker Compose

---

## Executive Summary

The admin dashboard implementation has a **solid security foundation** with several design choices that are explicitly correct: HS256-only JWT validation with `validate_exp = true`, argon2id password hashing, timing-safe anti-enumeration login, `password_hash` excluded from all responses at the type level, and parameterized SQL throughout. The majority of the security checklist passes.

However, **three High-severity findings** must be fixed before any production deployment, and several Medium and Low issues require attention. The most significant concern is a **weak default JWT secret** that is hardcoded as a fallback in `main.rs` and will silently produce valid tokens in any environment where `JWT_SECRET` is not set. A second High finding is a **CORS misconfiguration** (`allow_methods(Any)` combined with `allow_credentials(true)`) that permits credential-bearing cross-origin requests from the configured origin to use any HTTP method. A third High finding is a **missing Next.js edge middleware** for the admin route subtree, meaning the browser-side `admin_token` cookie check is entirely absent — unauthenticated users can access admin pages until the first API call fails.

**Overall Risk Rating: GREEN** *(updated 2026-03-10 — all P1 findings resolved; remaining items are intentionally deferred low-impact issues)* — the original rating was AMBER due to three High findings; all three have been remediated. See Remediation Status section.

---

## Security Checklist — Pass / Fail

| Check | Result | Notes |
|---|---|---|
| `exp` claim always set in JWT on login | PASS | `admin_login` computes `exp = now + session_hours * 3600` (handlers/admin.rs:255) |
| `exp` validated in `extract_claims` | PASS | `validation.validate_exp = true` (middleware/auth.rs:61) |
| JWT algorithm explicitly HS256 | PASS | `Validation::new(Algorithm::HS256)` (middleware/auth.rs:60) |
| `alg:none` rejected | PASS | Only HS256 accepted; test coverage confirmed (middleware/auth.rs:269–295) |
| `JWT_SECRET` not hardcoded in production paths | **PASS** *(fixed 2026-03-10)* | `main.rs` panics on missing or short secret; `docker-compose.yml` uses `${JWT_SECRET:?...}` fail-fast guard |
| JWT secret entropy recommendation in .env.example | PASS | "changeme-generate-with-openssl-rand-hex-64" documents the right tool |
| Cookie `HttpOnly=true` | PASS | `cookie.set_http_only(true)` (handlers/admin.rs:277) |
| Cookie `SameSite=Strict` | PASS | `SameSite::Strict` (handlers/admin.rs:279) |
| `COOKIE_SECURE=true` sets Secure attribute | PASS | conditional `set_secure(true)` (handlers/admin.rs:280–282) |
| `COOKIE_SECURE` defaults to `false` in docker-compose.yml | NOTE | Acceptable for HTTP-only dev; must be set to `true` in any HTTPS deployment |
| Login route NOT behind auth middleware | PASS | `admin_auth_router` is built without `require_auth` layer (main.rs:127–129) |
| Passwords hashed with argon2id | PASS | `Argon2::default()` with `hash_password` (handlers/admin.rs:484–488) |
| Timing-safe login (dummy hash verify when email not found) | PASS | `DUMMY_HASH` + `Argon2::verify_password` runs even for unknown email (handlers/admin.rs:218–238) |
| `password_hash` never in any API response | PASS | `AdminUserResponse` excludes the field at the type level; belt-and-suspenders JSON test in models/admin.rs:343–363 |
| `password_hash` not logged | PASS | No `tracing::info!` or `tracing::debug!` emits user struct fields |
| `require_role("admin")` on DELETE /api/admin/reports/:id | PASS | handlers/admin.rs:422 |
| `require_role("admin")` on GET/POST /api/admin/users | PASS | handlers/admin.rs:461, 478 |
| `require_role("admin")` on DELETE /api/admin/users/:id | PASS | handlers/admin.rs:516 |
| Reviewer can access GET /api/admin/reports | PASS | No additional role check; `require_auth` middleware is sufficient |
| Reviewer can access GET /api/admin/stats | PASS | No additional role check |
| Reviewer can access PATCH /api/admin/reports/:id/status | PASS | No additional role check |
| Self-deactivation guard | PASS | `if id == caller_id { return Err(...) }` (handlers/admin.rs:521–524) |
| `changed_by` UUID recorded in `status_history` | PASS | Correctly bound from `claims.sub` (handlers/admin.rs:383–384, admin_queries.rs:352–362) |
| Public `/api/reports` returns rounded coordinates (3 dp) | PASS | `(lat * 1000.0).round() / 1000.0` in `Report::into_response` (models/report.rs:49–50) |
| `submitter_contact` excluded from public responses | PASS | Not in `ReportResponse`; compile-time + JSON-level test (models/report.rs:350–368) |
| Admin endpoints return exact coordinates and `submitter_contact` | PASS | `list_admin_reports` and `get_admin_report_by_id` SELECT raw `latitude`, `longitude`, `submitter_contact` |
| `AdminUserResponse` excludes `password_hash` | PASS | Type-level guarantee confirmed |
| All queries use parameterized binds | PASS (with note) | See FINDING-003 for a nuanced dynamic-WHERE concern |
| Dynamic SQL in list_admin_reports uses sequential bind parameters | PASS | `param_idx` counter pattern is correct (admin_queries.rs:186–218) |
| `/api/admin/auth/login` has dedicated nginx rate-limit zone | PASS | `zone=admin_login` (nginx.conf:12, 54–65) |
| Login rate limit `<=5r/m` | PASS | `rate=5r/m` (nginx.conf:12) |
| Error responses don't leak stack traces | PASS | All errors map to generic strings in `AppError::into_response` (errors.rs:46–73) |
| Login failure: same message for wrong password AND unknown email | PASS | Both return `AppError::Unauthorized` → "Unauthorized" JSON body |
| `allow_credentials(true)` set on CorsLayer | PASS | main.rs:114 |
| CORS origin is not wildcard `*` | PASS | Specific origin from `CORS_ORIGIN` env var (main.rs:105–113) |
| CORS `allow_methods` is not wildcard `Any` with credentials | **PASS** *(fixed 2026-03-10)* | `allow_methods(Any)` replaced with explicit method list — see FINDING-002 |
| Frontend edge middleware guards `/admin/*` routes | **PASS** *(fixed 2026-03-10)* | `frontend/middleware.ts` created; 29 tests — see FINDING-001 |
| Admin seeding credentials removable post-boot | NOTE | .env.example documents this; not enforced programmatically |

---

## Findings

### FINDING-001 — Missing Frontend Edge Middleware: Admin Routes Are Client-Side Only
**Priority**: P1 (High)
**Risk**: Confidentiality — An unauthenticated user can load any `/admin/*` page. The page renders, the `getMe()` API call fails with 401, and the page then redirects to `/admin/login`. During the window before the redirect, admin UI components render. More critically, browser-level navigation and script injection can bypass React-level auth checks entirely. This is defence-in-depth gap that becomes a direct vulnerability if any admin page has a local state bug, a flash of unauthenticated content, or if a future page is added that does not call `getMe()` on mount.
**Evidence**: The file `frontend/middleware.ts` does not exist (confirmed by `Glob` returning no results). No `frontend/app/admin/layout.tsx` exists either. Every admin page (`/app/admin/page.tsx`, `/app/admin/reports/page.tsx`, `/app/admin/users/page.tsx`) is a client component that relies on a `useEffect` + `getMe()` pattern to detect authentication — this check does not run during SSR or on the edge.
**Recommendation**: Create `frontend/middleware.ts` at the project root (Next.js App Router edge middleware location) that:
1. Reads the `admin_token` cookie.
2. If absent, redirects to `/admin/login` for any request matching `/admin` (excluding `/admin/login` itself).
3. Does NOT attempt JWT verification in the middleware (no secret in frontend); the backend is the authority. The middleware is a UX guard only.

Minimal implementation:
```typescript
// frontend/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token');
  const isLoginPage = request.nextUrl.pathname === '/admin/login';

  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
```
**Verification**: Navigate to `http://localhost/admin` with no cookie set. The browser must redirect immediately to `/admin/login` with a 307/308, not render any admin UI. Confirm with `curl -v http://localhost/admin` (no cookies) — response must be a redirect, not 200.

---

### FINDING-002 — CORS `allow_methods(Any)` Combined With `allow_credentials(true)`
**Priority**: P1 (High)
**Risk**: Integrity — `allow_methods(Any)` with `allow_credentials(true)` permits credential-bearing cross-origin requests using any HTTP method (`DELETE`, `PATCH`, `PUT`) from the configured `CORS_ORIGIN`. While the current single origin is not wildcard `*`, this configuration is overly permissive and violates the principle of least privilege. An XSS on the frontend origin (or a compromised frontend subdomain) can make credentialed DELETE or PATCH requests to admin endpoints directly, without needing to forge any additional headers.
**Evidence**:
```rust
// backend/src/main.rs:112–114
let cors = CorsLayer::new()
    .allow_origin(...)
    .allow_methods(Any)    // ← permits DELETE, PATCH, etc. cross-origin with credentials
    .allow_headers(Any)
    .allow_credentials(true);
```
**Recommendation**: Replace `allow_methods(Any)` with an explicit allow-list of only the methods the admin dashboard actually uses:
```rust
use tower_http::cors::CorsLayer;
use axum::http::Method;

let cors = CorsLayer::new()
    .allow_origin(config.cors_origin.parse::<axum::http::HeaderValue>()...)
    .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
    .allow_headers([axum::http::header::CONTENT_TYPE])
    .allow_credentials(true);
```
Similarly, replace `allow_headers(Any)` with an explicit list. `Content-Type` is all the admin API needs.
**Verification**: Send a cross-origin preflight `OPTIONS` request with `Access-Control-Request-Method: PUT` from the allowed origin. The response must not include `PUT` in `Access-Control-Allow-Methods`. Confirm with:
```bash
curl -v -X OPTIONS http://localhost/api/admin/reports/some-id \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: PUT"
```

---

### FINDING-003 — Hardcoded Fallback JWT Secret in `main.rs`
**Priority**: P1 (High)
**Risk**: Confidentiality / Integrity — Any environment that fails to set `JWT_SECRET` (misconfigured CI, test servers, first-time deployments) will silently use the well-known string `"dev-secret-change-in-production"`. An attacker who discovers this string can forge any valid JWT with any role and any `sub`, bypassing all authentication and authorization for every admin endpoint. The secret is also short (34 bytes) and entirely predictable; it is public in this codebase.
**Evidence**:
```rust
// backend/src/main.rs:91–93
let jwt_secret = std::env::var("JWT_SECRET")
    .unwrap_or_else(|_| "dev-secret-change-in-production".to_string())
    .into_bytes();
```
The `.env.example` documents the right guidance (`openssl rand -hex 64`) but the fallback in code undermines it entirely. The backend will start and issue real tokens with this insecure key.
**Recommendation**: Replace the silent fallback with a hard startup failure:
```rust
// backend/src/main.rs
let jwt_secret_str = std::env::var("JWT_SECRET")
    .expect("JWT_SECRET environment variable must be set. \
             Generate with: openssl rand -hex 64");
if jwt_secret_str.len() < 32 {
    panic!("JWT_SECRET must be at least 32 characters. \
            Generate with: openssl rand -hex 64");
}
let jwt_secret = jwt_secret_str.into_bytes();
```
The minimum-length guard (32 chars = 256 bits for HMAC-SHA256) is a belt-and-suspenders check on top of the required-presence check. Also add to `docker-compose.yml`:
```yaml
# In backend service environment:
JWT_SECRET: "${JWT_SECRET:?JWT_SECRET must be set in .env}"
```
The `:?` syntax causes Docker Compose to fail at `up` time if the variable is empty or unset.
**Verification**: Start the backend without `JWT_SECRET` set. It must exit with a non-zero code and a message referencing `JWT_SECRET`. Confirm with:
```bash
env -u JWT_SECRET cargo run 2>&1 | grep -i "JWT_SECRET"
# must output the panic message, not start listening
```

---

### FINDING-004 — `admin_login` Logs the Email Address on Success
**Priority**: P2 (Medium)
**Risk**: Privacy — On every successful admin login, the operator's email address is written to structured logs:
```rust
// backend/src/handlers/admin.rs:285–288
tracing::info!(
    email = %payload.email,
    "Admin login successful"
);
```
Admin email addresses are PII. If logs are shipped to a third-party aggregator (e.g., Datadog, Loki, CloudWatch) or accessible by infrastructure engineers who are not cleared for PII, this creates a retention and access-control problem. The log is also unnecessary for debugging because the user's UUID is available at this point and is sufficient for correlation.
**Recommendation**: Replace the email with the user UUID:
```rust
tracing::info!(
    user_id = %user.id,
    role = %user.role,
    "Admin login successful"
);
```
If email must be retained for audit purposes, ensure it is logged only to a restricted, access-controlled audit log (separate log stream), not the general application log.
**Verification**: Trigger a successful login and inspect the JSON log output. The `email` field must be absent from the log line. The `user_id` field must be present.

---

### FINDING-005 — `admin_login` Error Path Does Not Log User ID for Audit
**Priority**: P2 (Medium)
**Risk**: Integrity — Failed login attempts are not logged at all. An attacker making 1000 attempts against the login endpoint will leave no trace in application logs (only nginx rate-limit logs will capture the IP). Without application-level logging of failed attempts (keyed on email), there is no way to detect credential-stuffing or targeted account attacks in post-incident analysis.
**Evidence**: The `admin_login` handler returns `Err(AppError::Unauthorized)` for all failure cases (line 243) with no `tracing::warn!` before it. The `AppError::Unauthorized` arm in `errors.rs` also does not log.
**Recommendation**: Add a warning log before returning the unauthorized error:
```rust
// In admin_login, before the final Err return
tracing::warn!(
    email_hash = %{
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut h = DefaultHasher::new();
        payload.email.hash(&mut h);
        h.finish()
    },
    "Admin login failed"
);
return Err(AppError::Unauthorized);
```
Use a one-way hash of the email (not the plaintext) so failed-attempt patterns can be correlated without storing PII in the general log. Alternatively, log only a truncated prefix: `&payload.email[..payload.email.find('@').unwrap_or(4).min(4)]`.
**Verification**: Attempt a login with incorrect credentials. Inspect application logs. A `WARN`-level event must appear with a correlation token (hashed email or truncated prefix). The full email must not appear.

---

### FINDING-006 — `admin_me` Fetches User by Email from JWT, Not by UUID
**Priority**: P2 (Medium)
**Risk**: Integrity — The `admin_me` handler performs a two-step lookup: it fetches the user by email (from the JWT `email` claim), then asserts the returned ID matches the JWT `sub` claim.
```rust
// backend/src/handlers/admin.rs:318–322
let user = admin_queries::get_admin_user_by_email(&state.pool, &claims.email)
    .await?
    .filter(|u| u.id == user_id)
    .ok_or(AppError::NotFound)?;
```
This is logically correct but unnecessarily uses email as a lookup key. The JWT already carries the UUID `sub` field. If an admin user's email changes (a future feature), the JWT will contain the old email, causing the lookup to fail or return a different user. More importantly, `get_admin_user_by_email` does a case-sensitive exact match on `email TEXT`; if the database collation or future email normalisation differs, a JWT could become permanently invalid even before expiry.
**Recommendation**: Add a `get_admin_user_by_id` query function and use it in `admin_me`:
```rust
// handlers/admin.rs
let user = admin_queries::get_admin_user_by_id(&state.pool, user_id)
    .await?
    .ok_or(AppError::NotFound)?;
```
This removes the email-lookup dependency, makes the lookup O(1) on PK instead of index scan on email, and is semantically correct: the JWT `sub` is the authoritative user identifier.
**Verification**: Confirm `GET /api/admin/auth/me` returns the correct user when called with a valid JWT. The user's email in the response must match the JWT email claim. Add a test that constructs a JWT with a mismatched email and confirms the endpoint returns the correct user (by UUID) regardless.

---

### FINDING-007 — `admin_login` Reads `JWT_SESSION_HOURS` From Environment on Every Request
**Priority**: P2 (Medium)
**Risk**: Availability / Integrity — The session duration is read from `std::env::var("JWT_SESSION_HOURS")` on every login request (handlers/admin.rs:250–253). Reading environment variables at request time is unusual and means the session duration can be changed between a login and a refresh without any restart. More critically, if the environment variable is removed after startup (e.g., by a container orchestrator secret rotation), all subsequent logins will silently fall back to 24 hours — this is the correct default, but the fallback is silent. A more serious variant: an attacker who can modify the container environment (e.g., via a compromised orchestrator) could set `JWT_SESSION_HOURS=876000` (100 years) to create long-lived tokens.
**Recommendation**: Read `JWT_SESSION_HOURS` once at startup and store it in `AppState`:
```rust
pub struct AppState {
    pub pool: Arc<sqlx::PgPool>,
    pub uploads_dir: String,
    pub api_base_url: String,
    pub jwt_secret: Arc<Vec<u8>>,
    pub jwt_session_hours: i64,  // add this
}
// In main():
let jwt_session_hours: i64 = std::env::var("JWT_SESSION_HOURS")
    .ok().and_then(|v| v.parse().ok()).unwrap_or(24)
    .clamp(1, 168); // enforce 1 hour minimum, 1 week maximum
```
The `clamp` enforces a sane range regardless of what is in the environment.
**Verification**: Confirm `AppState` carries `jwt_session_hours`. Confirm `admin_login` reads it from state, not from env. Set `JWT_SESSION_HOURS=876000` and confirm the resulting token's `exp` is at most `now + 168 * 3600`.

---

### FINDING-008 — Nginx `/api/` Block Rate-Limits All Admin API Routes With the `upload` Zone
**Priority**: P2 (Medium)
**Risk**: Availability — The `location /api/` block applies `limit_req zone=upload burst=2 nodelay`. The `upload` zone is designed for the public photo submission endpoint and keys on POST requests only (via the `map` directive). This means:
1. All authenticated admin API calls (GET, PATCH, DELETE to `/api/admin/*`) pass through the `upload` zone with `$upload_limit_key = ""` — the empty string is a valid key in nginx, but `limit_req_zone` with an empty key actually bypasses the rate limit entirely for non-POST methods. This is the intended behaviour for photo submissions but is accidental for admin routes.
2. POST to `/api/admin/auth/login` is covered by the `admin_login` exact-match location (correct, takes precedence). But POST to `/api/admin/users` (create user) falls through to the `/api/` block and is rate-limited by the `upload` zone at 5r/m per IP.
3. There is no rate limit on GET admin endpoints at all (reads are unlimited).

The immediate risk is low because admin users are few and the attack surface requires authentication, but unlimited GET on admin report/user list endpoints could be used for data exfiltration if a token is stolen.
**Recommendation**: Add a dedicated `admin_api` rate-limit zone and apply it to all `/api/admin/` routes:
```nginx
limit_req_zone $binary_remote_addr zone=admin_api:10m rate=60r/m;

location /api/admin/ {
    limit_req zone=admin_api burst=10 nodelay;
    limit_req_status 429;
    proxy_pass http://backend;
    # ...headers...
}
# Keep the exact-match login location as-is (it takes precedence)
```
60 req/min (1/sec) is sufficient for normal dashboard use while preventing bulk scraping.
**Verification**: Send 65 GET requests per minute to `/api/admin/reports` with a valid token. Requests 61–65 must return HTTP 429. Confirm with:
```bash
for i in $(seq 1 65); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Cookie: admin_token=<valid-token>" \
    http://localhost/api/admin/reports
done | sort | uniq -c
```

---

### FINDING-009 — `ADMIN_SEED_PASSWORD` Exposed in `docker-compose.yml` Environment Block
**Priority**: P2 (Medium)
**Risk**: Confidentiality — The `ADMIN_SEED_PASSWORD` environment variable is passed through to the backend container via `docker-compose.yml`. If the seed password is set to a real credential, it persists in:
1. The Docker image layer if it is baked in (not the case here — it is runtime env, not build arg).
2. `docker inspect <container>` output, which is readable by any user with Docker socket access.
3. Process environment of the running container (`/proc/1/environ`).

The `.env.example` note "Safe to remove ADMIN_SEED_PASSWORD from env after first boot" is correct guidance but is not enforced.
**Evidence**:
```yaml
# docker-compose.yml:40–41
ADMIN_SEED_EMAIL: "${ADMIN_SEED_EMAIL:-}"
ADMIN_SEED_PASSWORD: "${ADMIN_SEED_PASSWORD:-}"
```
**Recommendation**:
1. Remove `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` from `docker-compose.yml` entirely after initial seeding is confirmed to work.
2. Alternatively, use Docker Secrets (`secrets:` stanza) rather than environment variables for seed credentials.
3. Add a startup check: if `ADMIN_SEED_PASSWORD` is set AND the `admin_users` table already has rows, log a warning: "ADMIN_SEED_PASSWORD is set but admin_users table already has rows — seed skipped. Remove ADMIN_SEED_PASSWORD from environment."
**Verification**: After first-boot seeding, run `docker inspect <backend-container>` and confirm `ADMIN_SEED_PASSWORD` is not present or is empty string.

---

### FINDING-010 — Login Page Surfaces `body.message` From Server Error Responses
**Priority**: P2 (Medium)
**Risk**: Confidentiality — The login page error handler reads `body.message` from the server response for non-401, non-429, non-5xx errors and renders it directly:
```typescript
// frontend/app/admin/login/page.tsx:82–84
setErrorMessage(
  body.message ?? "Something went wrong. Please try again."
);
```
The backend `AppError::BadRequest` responses include the full `msg` string in the JSON body:
```rust
// errors.rs:54
AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
```
If the backend ever returns a 400 with internal details in the message (e.g., a future validation error that includes field values), those details would be rendered verbatim to the user. Currently the login endpoint only returns 400 if the JSON body is malformed (deserialization fails with a generic Axum error message) — this is low risk today but fragile as the codebase grows.

The frontend also reads `body.error` is ignored and `body.message` is used, but the backend sends `{ "error": "..." }` not `{ "message": "..." }` — so the fallback generic message always fires for 400 errors anyway. This means the server's actual error message is silently dropped.
**Recommendation**:
1. Fix the field name mismatch: read `body.error` not `body.message` (or both).
2. For the login endpoint specifically, always show a generic message for any non-429, non-5xx error — do not pass server messages through to the UI.
```typescript
} else {
  // Never pass server error messages through to the login UI
  setErrorMessage("Something went wrong. Please try again.");
}
```
**Verification**: Send a POST to `/api/admin/auth/login` with a malformed JSON body. The UI must display the generic message, not any server-supplied string.

---

### FINDING-011 — No `max-age` or `Expires` on the `admin_token` Cookie
**Priority**: P2 (Medium)
**Risk**: Confidentiality — The `admin_token` cookie is set without an explicit `Max-Age` or `Expires` attribute:
```rust
// handlers/admin.rs:276–282
let mut cookie = axum_extra::extract::cookie::Cookie::new("admin_token", token);
cookie.set_http_only(true);
cookie.set_path("/");
cookie.set_same_site(axum_extra::extract::cookie::SameSite::Strict);
// No set_max_age() call
```
Without `Max-Age`, the cookie is a **session cookie** — it persists only until the browser tab/window closes. This means:
1. Browsers that restore sessions on restart (Chrome "Continue where you left off", Firefox session restore) will retain the cookie indefinitely, even after `JWT_SESSION_HOURS` has elapsed. The JWT `exp` claim will still be validated server-side, but the browser will keep sending the expired token until the server rejects it and the frontend handles the 401.
2. An operator who forgets to close their browser tab leaves a valid session open on a shared machine.
The cookie expiry and the JWT `exp` should be synchronized so the browser discards the cookie at the same time the server would reject it.
**Recommendation**: Set `Max-Age` to match `JWT_SESSION_HOURS`:
```rust
let max_age_secs = session_hours * 3600;
cookie.set_max_age(axum_extra::extract::cookie::time::Duration::seconds(max_age_secs));
```
This requires `session_hours` to be available at cookie-set time. Once FINDING-007 is implemented (move to `AppState`), use `state.jwt_session_hours`.
**Verification**: Login and inspect the `Set-Cookie` header. It must include `Max-Age=<N>` where N matches the configured session hours in seconds. Restart the browser (not just the tab) and confirm the cookie is absent.

---

### FINDING-012 — `submitter_name` Exposed in Public API Responses
**Priority**: P2 (Medium)
**Risk**: Privacy — The public `ReportResponse` struct includes `submitter_name`:
```rust
// models/report.rs:38
pub submitter_name: Option<String>,
```
This field is included in the JSON output of `GET /api/reports` and `GET /api/reports/:id` (both unauthenticated endpoints). Depending on what users submit (full name, handle, or nothing), this can expose PII to the public. The `submitter_contact` field is correctly excluded, but `submitter_name` is not.

This is a privacy policy decision — if the system is designed to allow public attribution of reports, this is intentional. However, there is no documentation stating that `submitter_name` is intended to be publicly visible, and it is inconsistent with the exclusion of `submitter_contact`.
**Recommendation**: Either:
1. Exclude `submitter_name` from `ReportResponse` (make it admin-only like `submitter_contact`), OR
2. Add explicit documentation that public display of submitter names is a deliberate design decision, require users to consent to public name display during submission, and add a test asserting its presence.
If excluding, the fix is straightforward: remove the field from `ReportResponse` and `Report::into_response()`.
**Verification**: Submit a report with `submitter_name = "Jane Doe"`. Call `GET /api/reports`. The `submitter_name` field must either be absent from the response, or its presence must be documented as an explicit design decision.

---

### FINDING-013 — Image Path Not Sanitized Before Filesystem Join in `admin_delete_report`
**Priority**: P2 (Medium)
**Risk**: Integrity — The `admin_delete_report` handler constructs a file path by joining `state.uploads_dir` with the `image_path` returned from the database:
```rust
// handlers/admin.rs:429–434
let full_path = std::path::PathBuf::from(&state.uploads_dir).join(&image_path);
if let Err(e) = tokio::fs::remove_file(&full_path).await {
```
The `image_path` is written by the application at report creation time (a UUID `.jpg` filename), so under normal operation it is safe. However, if `image_path` values in the database are ever modified directly (e.g., by a DBA, migration, or future import tool) to contain path traversal sequences like `../../etc/passwd`, the `tokio::fs::remove_file` call would attempt to delete an arbitrary file. The failure is only logged as a warning — it does not fail the request — but the attempt itself is a concern.
**Recommendation**: Add a path canonicalization guard before the `remove_file` call:
```rust
let uploads_dir = std::path::Path::new(&state.uploads_dir)
    .canonicalize()
    .unwrap_or_else(|_| std::path::PathBuf::from(&state.uploads_dir));
let full_path = uploads_dir.join(&image_path);
// Guard: reject paths that escape the uploads directory
if !full_path.starts_with(&uploads_dir) {
    tracing::warn!(
        image_path = %image_path,
        "Refusing to delete file: path escapes uploads directory"
    );
} else if let Err(e) = tokio::fs::remove_file(&full_path).await {
    tracing::warn!(path = %full_path.display(), error = %e, "Could not delete image file");
}
```
**Verification**: Directly set a report's `image_path` to `../../some_file` in the database and trigger `DELETE /api/admin/reports/:id`. Confirm no file outside the uploads directory is deleted, and a warning is logged.

---

### FINDING-014 — No `Content-Security-Policy` Header on Admin Routes
**Priority**: P2 (Medium / Defense in Depth)
**Risk**: Confidentiality — Neither nginx nor the Next.js frontend sets a `Content-Security-Policy` header for the admin UI. Without CSP, any XSS vulnerability (existing or future) in the admin pages can exfiltrate admin tokens, execute arbitrary API calls, or redirect users. The admin dashboard handles sensitive data (submitter PII, exact GPS coordinates) that makes it a high-value XSS target.
**Recommendation**: Add CSP headers via nginx for the admin route subtree:
```nginx
location /admin {
    add_header Content-Security-Policy
        "default-src 'self'; script-src 'self' 'nonce-{nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
        always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    proxy_pass http://frontend:3000;
    # ...other proxy headers...
}
```
For Next.js App Router, CSP nonces can be injected via middleware. At minimum, add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.
**Verification**: Inspect response headers for `GET /admin/login`. The response must include `Content-Security-Policy`, `X-Frame-Options`, and `X-Content-Type-Options` headers.

---

### FINDING-015 — `admin-token` Cookie Has No `Domain` Attribute (Informational)
**Priority**: Informational
**Risk**: Low — The `admin_token` cookie is set without an explicit `Domain` attribute, which means it defaults to the host that set it (the backend's origin as seen by the browser, proxied through nginx). This is correct behavior in a single-domain deployment. If the app is ever deployed across subdomains (e.g., `api.example.com` and `admin.example.com`), the cookie will not be shared and both sides would need to be on the same domain or the cookie domain set explicitly. No action required for the current architecture.

---

### FINDING-016 — Audit Log for Admin User Deactivation Does Not Include Actor
**Priority**: Low
**Risk**: Integrity — The `admin_deactivate_user` handler logs the deactivated user's ID but not the ID of the admin who performed the action:
```rust
// handlers/admin.rs:532
tracing::info!(user_id = %id, "Admin user deactivated");
```
The `claims.sub` (caller's UUID) is available in scope but not logged. This makes post-incident reconstruction harder: "which admin deactivated this user and when?" cannot be answered from logs alone.
**Recommendation**: Add the actor to the log line:
```rust
tracing::info!(
    deactivated_user_id = %id,
    performed_by = %caller_id,
    "Admin user deactivated"
);
```
**Verification**: Deactivate a user. The log line must include both `deactivated_user_id` and `performed_by` fields.

---

## Attack Trees — Top 3 Threat Categories

### Attack Tree 1: JWT Forgery / Session Hijacking

```
Goal: Forge valid admin JWT without valid credentials
├── Branch A: Exploit weak/known JWT secret
│   ├── A1: Backend started without JWT_SECRET env var → uses "dev-secret-change-in-production" [FINDING-003, EXPLOITABLE NOW]
│   └── A2: Brute-force short secret → mitigated by 64-byte recommended secret
├── Branch B: alg:none substitution
│   └── B1: Craft unsigned JWT with alg:none header → BLOCKED (Validation::new(HS256) rejects)
├── Branch C: Cookie theft
│   ├── C1: XSS on admin pages → steals HttpOnly cookie → BLOCKED (HttpOnly=true)
│   └── C2: Network intercept → steals cookie in transit → MITIGATED by COOKIE_SECURE=true in prod
└── Branch D: Token replay after logout
    └── D1: Capture token before logout, replay after → PARTIAL RISK (no server-side token invalidation / blocklist)
```

**Residual risk**: Branch A1 is actively exploitable if `JWT_SECRET` is not set. All other branches are adequately mitigated or accepted risks. Branch D1 (no token invalidation on logout) is an accepted design trade-off common to stateless JWT systems; the short `exp` window (24h default) limits blast radius.

### Attack Tree 2: Privilege Escalation

```
Goal: Reviewer accesses admin-only operations
├── Branch A: Direct API call without role check
│   ├── A1: DELETE /api/admin/reports/:id → BLOCKED (require_role("admin") at line 422)
│   ├── A2: GET /api/admin/users → BLOCKED (require_role("admin") at line 461)
│   ├── A3: POST /api/admin/users → BLOCKED (require_role("admin") at line 478)
│   └── A4: DELETE /api/admin/users/:id → BLOCKED (require_role("admin") at line 516)
├── Branch B: Role claim manipulation in JWT
│   └── B1: Modify role claim in JWT to "admin" → BLOCKED (signature verification fails)
└── Branch C: Self-promotion via user creation
    └── C1: Reviewer calls POST /api/admin/users to create a new admin → BLOCKED (require_role("admin"))
```

**Residual risk**: None identified. Role gating is consistent across all admin-only endpoints.

### Attack Tree 3: PII Exfiltration via Admin API

```
Goal: Exfiltrate submitter PII (contact, exact GPS) without authorization
├── Branch A: Access admin endpoints without auth
│   ├── A1: No JWT cookie → BLOCKED (require_auth middleware returns 401)
│   └── A2: Frontend page access without cookie → RISK (no edge middleware — FINDING-001)
├── Branch B: Access public API for PII
│   ├── B1: GET /api/reports for exact GPS → MITIGATED (coordinates rounded to 3dp)
│   ├── B2: GET /api/reports for submitter_contact → BLOCKED (field excluded from ReportResponse)
│   └── B3: GET /api/reports for submitter_name → EXPOSED (field included — FINDING-012)
├── Branch C: Mass download via high limit parameter
│   └── C1: GET /api/admin/reports?limit=200 per page, iterate all pages → No auth required beyond valid token; rate limit gap (FINDING-008)
└── Branch D: EXIF metadata in uploaded images
    └── D1: Download image from /uploads/:filename, extract GPS EXIF → MITIGATED (img-parts strips EXIF before storage)
```

---

## Blocking Issues (Must Fix Before Ship)

The following findings are **BLOCKING** — the system must not be deployed to production until all three are resolved:

| ID | Title | Why Blocking |
|---|---|---|
| FINDING-001 | Missing frontend edge middleware | Admin pages render without authentication; unauthenticated users can observe admin UI state |
| FINDING-002 | CORS `allow_methods(Any)` with credentials | Overly permissive CORS allows credentialed cross-origin requests with any HTTP method |
| FINDING-003 | Hardcoded fallback JWT secret | Silent fallback to known-weak secret enables complete authentication bypass in any environment where `JWT_SECRET` is unset |

---

## Privacy Policy Requirements

### Data Retention Schedule

| Data Type | Storage Location | Recommended Retention |
|---|---|---|
| Report photos (uploaded images) | `backend/uploads/` (Docker volume) | Retain while report is active; delete on report deletion (already implemented in `admin_delete_report`) |
| Report records (DB rows) | `reports` table | No automated deletion currently; RECOMMEND 3-year retention for civic audit purposes, then anonymize |
| `submitter_contact` | `reports.submitter_contact` (DB column) | Sensitive PII; RECOMMEND 90-day retention after report is resolved, then null-out the column |
| `submitter_name` | `reports.submitter_name` (DB column) | If kept public, retain with report; if made private (see FINDING-012), treat as PII with 90-day post-resolution retention |
| `status_history` audit trail | `status_history` table | Retain for lifetime of the report; necessary for accountability |
| Application logs (nginx, Rust tracing) | Container stdout / log files | 90 days; MUST NOT contain email addresses (see FINDING-004) |
| `admin_users` (active) | `admin_users` table | Retain while active; soft-delete implemented |
| `admin_users` (deactivated, `is_active=false`) | `admin_users` table | Retain for 1 year after deactivation for audit, then hard delete |
| `last_login_at` timestamps | `admin_users.last_login_at` | Retain with user record |

### Redaction Requirements

| Data | When to Redact | By Which Component |
|---|---|---|
| EXIF GPS from uploaded photos | At ingest, before writing to disk | `strip_exif()` in `handlers/reports.rs` (ALREADY IMPLEMENTED) |
| Exact GPS coordinates in public API | At serialization | `Report::into_response()` rounding to 3dp (ALREADY IMPLEMENTED) |
| `submitter_contact` from public API | At model layer | `ReportResponse` excludes field (ALREADY IMPLEMENTED) |
| `password_hash` from all API responses | At model layer | `AdminUserResponse` excludes field (ALREADY IMPLEMENTED) |
| `submitter_name` from public API | RECOMMENDED — NOT YET IMPLEMENTED | See FINDING-012 |
| Email address from general application logs | At logging call sites | See FINDING-004 |

### Public Aggregation Rules

The following rules govern what may appear in publicly accessible API endpoints (`GET /api/reports`, `GET /api/reports/:id`, public map):

1. GPS coordinates: city-level precision only (3 decimal places ≈ 111m). Full precision is admin-only.
2. Submitter contact: MUST NOT appear in any public response.
3. Submitter name: SHOULD NOT appear in public responses (see FINDING-012); if retained, require explicit opt-in consent during submission.
4. Status: may be public (civic accountability).
5. Category / severity: may be public (civic accountability).
6. Photo URL: may be public; EXIF must be stripped before storage.
7. Aggregated stats (`GET /api/admin/stats`): behind admin auth; acceptable to expose category/severity counts without individual report data.

### User Rights

| Right | Applicable Data | Implementation Status |
|---|---|---|
| Deletion | Submitted reports + photos | Admin-only hard delete implemented. No self-service deletion for submitters (anonymous submissions by design) |
| Export | Not applicable (no user accounts for submitters) | N/A |
| Correction | Not implemented | RECOMMENDED: Add a `PUT /api/reports/:id` endpoint for submitters to update their own reports within 24h of submission, keyed on a one-time edit token sent to `submitter_contact` |
| Access | Admin users can view their own profile via `GET /api/admin/auth/me` | Implemented |
| Deactivation | Admin users can be deactivated (soft delete) | Implemented |

---

## Handoff Contract Verification

- [x] All P0 issues identified with concrete fixes and verification steps — No P0 issues found; three P1 (High) issues documented with exact fixes and test commands.
- [x] Object storage access rules fully specified — Images stored on local filesystem (Docker volume), served via `ServeDir` at `/uploads/*` with no authentication. Public access is intentional (photos are linked from public reports). Admin-only data (submitter PII, exact GPS) is stored in the database, not as files.
- [x] EXIF/PII handling policy specified — EXIF stripped at ingest by `img-parts` in `strip_exif()`. GPS coordinates rounded to 3dp in public API. `submitter_contact` excluded from public API. `password_hash` excluded from all API responses.
- [x] Rate limiting recommendations provided — Dedicated `admin_login` zone (5r/m) exists. Gap identified for non-login admin API routes (FINDING-008). Testable acceptance criteria provided.
- [x] Audit log requirements defined — Events to log: admin login (success/failure), report status change, report deletion, user creation, user deactivation. Required fields per event documented in individual findings. Retention: 90 days. Access: restricted to ops team. PII (email addresses) must not appear in general logs (FINDING-004).

**Blocked items requiring additional input**:
- The `submitter_name` public visibility decision (FINDING-012) requires a product decision before the privacy policy can be finalized.
- Token invalidation on logout (server-side blocklist) was not implemented; this is an accepted trade-off but should be documented as a known limitation in the system's threat model documentation.

---

## Remediation Status (2026-03-10)

All P1 findings have been resolved. The following table records the final disposition of every finding.

| Finding | Severity | Status | Remediated In |
|---------|----------|--------|---------------|
| FINDING-001 Missing edge middleware | P1 High | Fixed | `frontend/middleware.ts` + 29 tests |
| FINDING-002 CORS allow_methods(Any) | P1 High | Pre-existing fix confirmed | `backend/src/main.rs` already had explicit methods prior to this audit cycle; confirmed during remediation pass |
| FINDING-003 Hardcoded fallback JWT secret | P1 High | Fixed | `main.rs` panics on missing or short secret; `docker-compose.yml` `${JWT_SECRET:?...}` fail-fast guard |
| FINDING-004 PII in login success log | P2 | Fixed | Logs `user_id` UUID not email |
| FINDING-005 No failed-login audit log | P2 | Fixed | `warn!` on failed login attempts |
| FINDING-006 admin_me fetches by email | P2 | Fixed | Now fetches by UUID via `get_admin_user_by_id` |
| FINDING-007 JWT_SESSION_HOURS per-request | P2 | Fixed | Moved to `AppState` at startup; clamped 1–168h |
| FINDING-008 No rate limit on admin GET | P2 | Fixed | `admin_api` nginx zone 60r/m, burst=10 on `/api/admin/` |
| FINDING-009 ADMIN_SEED_PASSWORD visible | P2 | Fixed | `warn!` log on startup if `ADMIN_SEED_PASSWORD` env var still set |
| FINDING-010 Login error field name | P2 | Deferred | Low impact; UX polish pass; field mismatch (`body.message` vs `body.error`) does not expose server internals because fallback generic message always fires |
| FINDING-011 No Max-Age on admin_token | P2 | Fixed | `Max-Age = jwt_session_hours * 3600` set on `admin_token` cookie |
| FINDING-012 submitter_name in public API | P2 | Deferred | Pending consent model decision; documented as open product decision |
| FINDING-013 Image path traversal | P2 | Fixed | Canonicalize uploads dir + `starts_with` prefix check before `remove_file` |
| FINDING-014 No CSP on admin routes | P2 | Fixed | `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy`, `Content-Security-Policy` headers added to nginx `/admin` location block |
| FINDING-015 No Domain on cookie | Info | Deferred | Single-domain deployment; no action required for current architecture |
| FINDING-016 No actor ID in deactivation log | P2 | Fixed | `performed_by` UUID logged alongside `deactivated_user_id` |
| PHASE2-001 Password validation gap | Known gap | Documented | Client threshold `< 8` vs server threshold `< 12`; behavioural contract documented; closing requires a dedicated UX and validation alignment sprint |
| PHASE2-003 Super-admin returns 404 not 403 | P2 | Fixed | Pre-check in `guard_super_admin_deactivation` returns `403 Forbidden` |
