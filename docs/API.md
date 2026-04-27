<!-- generated-by: gsd-doc-writer -->
# API Reference

The Bengaluru Walkability Public Audit backend is a Rust/Axum REST API running on port 3001. In production and Docker Compose deployments nginx sits in front and applies rate limiting before proxying requests to the backend. All responses use `Content-Type: application/json`.

## Authentication

Admin endpoints are protected by an HttpOnly cookie named `admin_token`. The cookie holds a signed HS256 JWT issued by `POST /api/admin/auth/login`. Credentials are not passed in headers — the browser sends the cookie automatically on every same-origin request.

**JWT payload shape:**

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com",
  "role": "admin",
  "exp": 1777000000
}
```

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | UUID string | `admin_users.id` of the authenticated operator |
| `email` | string | Email address at time of login |
| `role` | string | `"admin"` or `"reviewer"` |
| `exp` | integer | Unix timestamp when the token expires |

The default session duration is 24 hours. This is configurable via the `JWT_SESSION_HOURS` environment variable (clamped to 1–168 hours). The cookie is set `HttpOnly`, `Path=/`, `SameSite=None`, and `Secure` when `COOKIE_SECURE=true`.

**Roles:**

| Role | Capabilities |
|------|-------------|
| `admin` | Full access — all endpoints including user management and report deletion |
| `reviewer` | Read-only admin access — list/view reports, view stats; cannot delete reports or manage users |

Public endpoints (report submission, report listing, ward lookup, health check) require no authentication.

## Endpoints Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Service health check |
| POST | `/api/reports` | None | Submit a new walkability report (multipart) |
| GET | `/api/reports` | None | List reports (paginated, filterable) |
| GET | `/api/reports/:id` | None | Get a single report by UUID |
| GET | `/api/wards/lookup` | None | Look up the BBMP ward for a coordinate |
| POST | `/api/admin/auth/login` | None | Admin login — sets `admin_token` cookie |
| POST | `/api/admin/auth/logout` | Cookie | Clear the `admin_token` cookie |
| GET | `/api/admin/auth/me` | Cookie | Get the authenticated admin's profile |
| PATCH | `/api/admin/auth/profile` | Cookie | Update authenticated admin's display name |
| POST | `/api/admin/auth/change-password` | Cookie | Change authenticated admin's password |
| GET | `/api/admin/reports` | Cookie | List all reports with full PII (paginated) |
| GET | `/api/admin/reports/:id` | Cookie | Get single report with full PII |
| PATCH | `/api/admin/reports/:id/status` | Cookie | Update report status |
| DELETE | `/api/admin/reports/:id` | Cookie (admin only) | Hard-delete a report and its image file |
| GET | `/api/admin/stats` | Cookie | Aggregate counts by status, category, severity |
| GET | `/api/admin/users` | Cookie (admin only) | List all admin users |
| POST | `/api/admin/users` | Cookie (admin only) | Create a new admin user |
| DELETE | `/api/admin/users/:id` | Cookie (admin only) | Soft-deactivate an admin user |
| PATCH | `/api/admin/users/:id/org` | Cookie (admin only) | Assign or clear an organization for a user |
| GET | `/api/admin/organizations` | Cookie | List all organizations |
| GET | `/uploads/:filename` | None | Serve an uploaded image file |

---

## Public Endpoints

### `GET /health`

Returns service status. Used by Docker health checks.

**Response `200 OK`:**

```json
{ "status": "ok" }
```

---

### `POST /api/reports`

Submit a new walkability report. The request body must be `multipart/form-data`. Maximum body size is 20 MB (enforced by both nginx and the Axum layer).

**Multipart fields:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `photo` | Yes | file | JPEG image of the infrastructure issue. EXIF metadata is stripped server-side before storage. |
| `lat` or `latitude` | Yes | float string | Latitude of the issue location. |
| `lng` or `longitude` | Yes | float string | Longitude of the issue location. |
| `category` | Yes | string | Issue category — see valid values below. |
| `severity` | No | string | `"low"`, `"medium"`, or `"high"`. Defaults to `"medium"` when absent. |
| `description` | No | string | Free-text description of the issue. |
| `name` or `submitter_name` | No | string | Submitter's name (stored server-side, not returned in public responses). |
| `contact` or `submitter_contact` | No | string | Submitter contact (stored server-side, not returned in public responses). |
| `location_source` | No | string | `"gps_exif"` or `"manual_pin"`. Defaults to `"manual_pin"` when absent. |
| `website` | — | string | Honeypot field — must be left empty. A non-empty value silently triggers a fake success response without saving anything. |

**Valid `category` values:**

The category is a free-string stored in the database. The frontend sends one of the following (enforced at the UI layer, not by the API): `no_footpath`, `broken_footpath`, `blocked_footpath`, `unsafe_crossing`, `poor_lighting`, `other`.

**Coordinate validation:**

Coordinates must fall within the Bengaluru bounding box:
- Latitude: `12.7342` to `13.1739`
- Longitude: `77.3791` to `77.8731`

Coordinates outside this box return `400 Bad Request` with `"Please drop the pin within Bengaluru"`.

**Anti-abuse behavior:**

- **Honeypot (ABUSE-02):** If the `website` field is non-empty, the API returns a fake `200 OK` shaped like a real response (with a nil UUID `00000000-0000-0000-0000-000000000000`). No data is saved.
- **Duplicate photo (ABUSE-03):** If the SHA-256 hash of the submitted image matches a previously stored photo, the API returns the same fake `200 OK` without saving.
- **Rate limiting (ABUSE-01):** The backend enforces 2 submissions per hour per IP address and geohash-6 cell (~1.2 km × 0.6 km). Exceeding this returns `429`. nginx additionally limits all `POST /api/*` traffic to 5 requests per minute per IP with a burst of 2.

**Response `200 OK`:**

```json
{
  "id": "a1b2c3d4-0000-4000-8000-000000000001",
  "created_at": "2026-04-25T10:30:00Z",
  "image_url": "https://example.com/uploads/a1b2c3d4-....jpg",
  "latitude": 12.972,
  "longitude": 77.595,
  "category": "no_footpath",
  "severity": "medium",
  "description": "No footpath along this stretch",
  "status": "submitted",
  "location_source": "gps_exif"
}
```

Latitude and longitude in the response are rounded to 3 decimal places. Submitter name, contact, and IP are intentionally excluded from the public response.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Missing required field (`photo` or `category`), invalid coordinate, coordinate outside Bengaluru bbox |
| 429 | Rate limit exceeded (backend per-IP+geohash quota or nginx zone) |
| 500 | Internal server or database error |

---

### `GET /api/reports`

List submitted reports in reverse-chronological order (newest first), with pagination and optional filtering.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-based). |
| `limit` | integer | `20` | Results per page. Values ≤ 0 fall back to 20; clamped to max 200. |
| `category` | string | — | Filter by exact category string. |
| `status` | string | — | Filter by exact status string (`submitted`, `under_review`, `resolved`). |

**Response `200 OK`:**

```json
{
  "page": 1,
  "limit": 20,
  "count": 3,
  "total": 42,
  "items": [
    {
      "id": "a1b2c3d4-0000-4000-8000-000000000001",
      "created_at": "2026-04-25T10:30:00Z",
      "image_url": "https://example.com/uploads/a1b2c3d4-....jpg",
      "latitude": 12.972,
      "longitude": 77.595,
      "category": "no_footpath",
      "severity": "medium",
      "description": null,
      "status": "submitted",
      "location_source": "manual_pin"
    }
  ]
}
```

`total` may be absent if the count query fails; `count` always reflects the number of items in the current page. The `ward_name` field is omitted from public listing responses (present only in admin responses).

---

### `GET /api/reports/:id`

Get a single report by its UUID.

**Response `200 OK`:** Same shape as a single item from `GET /api/reports`.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | Report not found |

---

### `GET /api/wards/lookup`

Look up the BBMP ward that contains a given coordinate. Public endpoint — no authentication required.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `lat` | float | Latitude of the point to look up. |
| `lng` | float | Longitude of the point to look up. |

**Response `200 OK`:**

```json
{
  "ward_number": 84,
  "ward_name": "Shivajinagar"
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | Coordinate does not fall within any known ward polygon |
| 500 | PostGIS query failure |

---

## Admin Auth Endpoints

### `POST /api/admin/auth/login`

Authenticate an admin operator. Credentials are verified with Argon2id. On success, sets the `admin_token` HttpOnly cookie.

Anti-enumeration: a constant-time dummy Argon2 verification is run even when the email is not found, so response timing does not reveal whether an account exists.

**Request body (`application/json`):**

```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123!"
}
```

Both fields are required. Missing either returns `400`.

**Response `200 OK`:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com",
  "role": "admin",
  "display_name": "Ops Lead",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z",
  "last_login_at": "2026-04-25T10:00:00Z",
  "is_super_admin": false
}
```

The response sets `Set-Cookie: admin_token=<jwt>; HttpOnly; Path=/; SameSite=None` (plus `Secure` when `COOKIE_SECURE=true`). The cookie `Max-Age` matches the configured session duration (default 24 hours).

**Rate limiting:** nginx applies the `admin_login` zone — 5 requests per minute per IP with a burst of 3.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Missing `email` or `password` field |
| 401 | Invalid credentials or inactive account |

---

### `POST /api/admin/auth/logout`

Clear the `admin_token` cookie. Sets `Max-Age=0` so the browser immediately discards the cookie. Returns `200 OK` with no body.

---

### `GET /api/admin/auth/me`

Return the profile of the currently authenticated admin. Fetches the user row by the UUID in the JWT `sub` claim.

**Response `200 OK`:** Same shape as the login response body.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 401 | Missing, expired, or invalid `admin_token` cookie |
| 404 | JWT sub UUID no longer exists in the database |

---

### `PATCH /api/admin/auth/profile`

Update the authenticated admin's `display_name`.

**Request body (`application/json`):**

```json
{
  "display_name": "New Name"
}
```

| Rule | Description |
|------|-------------|
| Field absent | No-op — display name is unchanged. |
| `null` | Clears the display name. |
| Non-null string | Must be 2–80 characters, not whitespace-only. |

**Response `200 OK`:** Updated `AdminUserResponse` object (same shape as login response).

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `display_name` is whitespace-only, fewer than 2 characters, or more than 80 characters |
| 401 | Missing or invalid cookie |

---

### `POST /api/admin/auth/change-password`

Change the authenticated admin's password. Verifies the current password against the stored Argon2id hash before updating.

**Request body (`application/json`):**

```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword456!"
}
```

Both fields are required. Validation order:
1. `new_password` must be at least 12 Unicode characters.
2. `new_password` must differ from `current_password`.
3. `current_password` is verified against the stored Argon2id hash.

**Response `200 OK`:** Empty body.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `new_password` is fewer than 12 characters or identical to `current_password` |
| 401 | `current_password` does not match the stored hash, or cookie is invalid |

---

## Admin Report Endpoints

All endpoints in this section require a valid `admin_token` cookie.

**Rate limiting:** nginx applies the `admin_api` zone to all `/api/admin/*` routes — 60 requests per minute per IP with a burst of 10. The login endpoint uses the stricter `admin_login` zone instead.

### `GET /api/admin/reports`

Paginated list of all reports with full PII (submitter name, contact, IP). Accessible by both `admin` and `reviewer` roles. Org-scoped admins see only reports in wards belonging to their assigned organization's subtree.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (1-based, default 1). |
| `limit` | integer | Results per page (default 20, max 200). |
| `category` | string | Filter by category. |
| `status` | string | Filter by status. |
| `severity` | string | Filter by severity. |
| `date_from` | ISO 8601 datetime | Filter reports created on or after this date. |
| `date_to` | ISO 8601 datetime | Filter reports created on or before this date. |
| `duplicate_of_id` | UUID | When present, returns only reports whose `duplicate_of_id` matches this UUID (bypasses pagination — returns all linked duplicates). |

**Response `200 OK`:**

```json
{
  "data": [ /* array of admin report objects */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_count": 150,
    "total_pages": 8
  }
}
```

Admin report objects include full PII fields not present in public responses: `submitter_name`, `submitter_contact`, `submitter_ip`, `ward_name`, `photo_hash`, `duplicate_of_id`, `duplicate_count`, `duplicate_confidence`.

---

### `GET /api/admin/reports/:id`

Get a single report by UUID with full PII. Accessible by both roles.

**Response `200 OK`:** Admin report object (same shape as items in the admin list).

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | Report not found |

---

### `PATCH /api/admin/reports/:id/status`

Update a report's status and optionally record a note. Accessible by both roles.

**Request body (`application/json`):**

```json
{
  "status": "under_review",
  "note": "Assigned to field team"
}
```

Valid `status` values (case-sensitive, lowercase): `submitted`, `under_review`, `resolved`.

The `note` field is optional. Status changes are recorded in `status_history` with the calling admin's UUID as `changed_by`.

**Response `200 OK`:** Updated admin report object.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `status` is not one of the three permitted values |
| 404 | Report not found |

---

### `DELETE /api/admin/reports/:id`

Hard-delete a report row and its corresponding image file from disk. Requires the `admin` role — `reviewer` receives `403 Forbidden`.

Image deletion uses path canonicalization to prevent path-traversal attacks: only files whose resolved path lies within the configured uploads directory are removed.

**Response `204 No Content`**

**Error responses:**

| Status | Condition |
|--------|-----------|
| 403 | Caller has `reviewer` role |
| 404 | Report not found |

---

### `GET /api/admin/stats`

Aggregate counts for the dashboard overview. Accessible by both roles.

**Response `200 OK`:**

```json
{
  "total_reports": 150,
  "by_status": {
    "submitted": 80,
    "under_review": 45,
    "resolved": 25
  },
  "by_category": {
    "no_footpath": 60,
    "broken_footpath": 30,
    "blocked_footpath": 20,
    "unsafe_crossing": 10,
    "poor_lighting": 10,
    "other": 5
  },
  "by_severity": {
    "low": 40,
    "medium": 70,
    "high": 40
  }
}
```

All enum keys are always present even when the count is `0`.

---

## Admin User Management Endpoints

All endpoints in this section require the `admin` role. A `reviewer` receives `403 Forbidden`.

### `GET /api/admin/users`

List all admin users.

**Response `200 OK`:** JSON array of `AdminUserResponse` objects.

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@example.com",
    "role": "admin",
    "display_name": "Ops Lead",
    "is_active": true,
    "created_at": "2026-01-01T00:00:00Z",
    "last_login_at": "2026-04-25T10:00:00Z",
    "is_super_admin": false
  }
]
```

`password_hash` is never present in any response. `last_login_at` is `null` when the user has never logged in.

---

### `POST /api/admin/users`

Create a new admin user. Returns `201 Created` with the new user object.

**Request body (`application/json`):**

```json
{
  "email": "reviewer@example.com",
  "password": "SecurePassword123!",
  "role": "reviewer",
  "display_name": "Field Reviewer"
}
```

**Validation (in order):**

1. `email` must be non-empty and contain `@`.
2. `password` must be at least 12 Unicode characters.
3. `role` must be exactly `"admin"` or `"reviewer"` (case-sensitive).
4. `display_name` is optional.

The password is hashed with Argon2id before storage. API-created users always have `is_super_admin: false`; this flag can only be set via the database seed.

**Response `201 Created`:** `AdminUserResponse` object.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Invalid email, password fewer than 12 characters, or invalid role |
| 409 | Email address already exists |

---

### `DELETE /api/admin/users/:id`

Soft-deactivate an admin user (`is_active` set to `false`). The calling admin cannot deactivate their own account. Super-admin accounts (`is_super_admin: true`) cannot be deactivated via the API.

**Response `204 No Content`**

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | Caller is attempting to deactivate their own account |
| 403 | Target user is a super-admin |
| 404 | User not found |

---

### `PATCH /api/admin/users/:id/org`

Assign or clear an organization for a user. Setting `org_id` to `null` clears the assignment, giving the user an unscoped (all-reports) view.

**Request body (`application/json`):**

```json
{ "org_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }
```

or to clear:

```json
{ "org_id": null }
```

**Response `204 No Content`**

---

### `GET /api/admin/organizations`

List all organizations. Accessible by both `admin` and `reviewer` roles.

**Response `200 OK`:**

```json
[
  {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "name": "BBMP",
    "org_type": "corporation",
    "parent_id": null,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
]
```

`parent_id` is `null` for root-level organizations. `org_type` values (e.g., `"gba"`, `"corporation"`, `"zone"`) are determined by the data model and migration seed.

---

## Error Response Format

All errors use a consistent JSON envelope:

```json
{ "error": "Human-readable error message" }
```

| HTTP Status | `AppError` Variant | When |
|-------------|-------------------|------|
| 400 | `BadRequest(msg)` | Validation failure; `msg` is returned verbatim |
| 401 | `Unauthorized` | Missing, expired, malformed, or wrong-secret JWT cookie |
| 403 | `Forbidden` | Authenticated but insufficient role |
| 404 | `NotFound` | Resource does not exist |
| 409 | `Conflict(msg)` | Duplicate resource (e.g., duplicate email) |
| 429 | `RateLimited(msg)` | Backend per-IP+geohash quota exceeded; `msg` is returned verbatim |
| 500 | `Database`, `Internal`, `Io` | Server-side failure; internal details are logged, not returned |

nginx returns its own `429` when a rate-limit zone is exceeded before the request reaches Rust; the response body in that case is nginx's default text, not the JSON envelope above.

---

## Rate Limits

Three rate-limit zones are applied by nginx. The backend also enforces its own per-IP+geohash submission quota independently.

| Zone | Applies to | Limit | Burst |
|------|-----------|-------|-------|
| `admin_login` | `POST /api/admin/auth/login` | 5 req/min per IP | 3 |
| `admin_api` | All other `/api/admin/*` routes | 60 req/min per IP | 10 |
| `upload` | `POST` to `/api/*` (GET/HEAD exempt) | 5 req/min per IP | 2 |
| Backend quota | `POST /api/reports` | 2 submissions/hour per IP + geohash-6 cell | — |

The backend rate limit key is `"{client_ip}:{geohash6}"`. The client IP is taken from the `X-Real-IP` header set by nginx, falling back to the TCP peer address. Exceeding the backend quota returns `429` with a human-readable message; exceeding nginx zones returns nginx's default `429` response.

---

## Static File Serving

**`GET /uploads/:filename`**

Uploaded images are served directly by the Rust backend via `tower-http::ServeDir`. nginx proxies these requests and adds a `Cache-Control: public, no-transform` header with a 30-day `Expires` value.

Image filenames are UUIDs with a `.jpg` extension (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg`). EXIF metadata including GPS coordinates is stripped from all images before they are written to disk.

---

## Request Tracing

Every request receives an `X-Request-ID` header. If the client sends `X-Request-ID` in the request, the same value is echoed back in the response. If absent, nginx generates one and injects it. The backend logs the request ID in its structured JSON log output (written to stderr).
