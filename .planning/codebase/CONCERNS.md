# Codebase Concerns

**Analysis Date:** 2026-05-20

---

## Security Concerns

### COOKIE_SECURE Conditional Application — MEDIUM

- **Issue:** `cookie.set_secure(true)` is only called when `COOKIE_SECURE=true` (`backend/src/handlers/admin.rs:311-324`). The cookie is always set with `SameSite=None`, but `SameSite=None` requires `Secure=true` per RFC 6265bis — without `Secure`, the browser silently drops the cookie in strict contexts.
- **Files:** `backend/src/handlers/admin.rs:311-325`, `docker-compose.dev.yml:19`
- **Impact:** If `COOKIE_SECURE` is accidentally left as `false` in a production deployment, the `admin_token` cookie will not be sent on cross-domain requests (Vercel frontend → Cloudflare tunnel backend), breaking admin login silently.
- **Current state:** `docker-compose.yml` correctly defaults `COOKIE_SECURE: "${COOKIE_SECURE:-true}"`. The risk is operator error on manual deployments or `.env` file copy from `.env.example` which defaults to `false`.
- **Fix approach:** Warn loudly at startup when `COOKIE_SECURE=false` and `CORS_ORIGIN` is not localhost. Consider unconditionally setting `Secure=true` in the production compose only.

### Logout Cookie Missing SameSite=None — MEDIUM

- **Issue:** The logout handler (`backend/src/handlers/admin.rs:342-352`) builds a removal cookie via `Cookie::build(("admin_token", "")).path("/").http_only(true)` but does NOT set `SameSite=None` or `Secure`. The removal cookie must match the attributes of the session cookie; browsers may not clear the session cookie cross-domain if attributes differ.
- **Files:** `backend/src/handlers/admin.rs:344-351`
- **Impact:** Admin logout may fail silently on the production cross-domain setup (Vercel + Cloudflare tunnel), leaving a valid session cookie in the browser.
- **Fix approach:** Apply identical `SameSite::None` + conditional `Secure` to the removal cookie using the same `cookie_secure` env read already present in the login handler.

### No MIME-Type Validation on File Uploads — MEDIUM

- **Issue:** The photo upload handler (`backend/src/handlers/reports.rs:89-98`) accepts any bytes under the `"photo"` multipart field without checking MIME type or file magic bytes. The EXIF stripper (`strip_exif`) calls `Jpeg::from_bytes` and falls back to raw bytes on parse error — a non-JPEG (SVG, HTML, PDF) is stored verbatim on disk as a `.jpg` extension.
- **Files:** `backend/src/handlers/reports.rs:89-99, 249-256, 316-326`
- **Impact:** A client submitting an SVG with a script tag achieves stored XSS via the `/uploads/` path, since browsers may execute SVG as JavaScript. `ServeDir` serves files without an enforced `Content-Type: image/jpeg` override.
- **Fix approach:** Check for JPEG magic bytes (`FF D8`) before accepting the file. Return `400 Bad Request` for non-JPEG uploads. Alternatively use the `image` crate's format detection. Add `add_header Content-Type image/jpeg` in the nginx `/uploads/` location block as a defense-in-depth measure.

### No Text Input Sanitization — LOW

- **Issue:** Free-text fields (`description`, `submitter_name`, `submitter_contact`) are stored and returned verbatim with no HTML escaping or sanitization server-side.
- **Files:** `backend/src/handlers/reports.rs:131-153`, `backend/src/db/queries.rs:82-129`
- **Impact:** Low direct risk because React's default escaping protects the current admin dashboard. However, if future features render description text as raw HTML (e.g., resolution notes in a government report export), XSS is possible.
- **Fix approach:** Document the reliance on React's default escaping. Add server-side strip of HTML tags for `description` using a crate like `ammonia` as a hardening measure before public launch.

### CORS Single-Origin — ACCEPTABLE / WATCH

- **Issue:** `CORS_ORIGIN` is correctly locked to a single origin (no wildcard). The `allow_credentials(true)` + specific origin combination is correct per the CORS spec.
- **Files:** `backend/src/main.rs:145-160`, `backend/src/config.rs:23`
- **Current state:** No issue. Watch: if a second frontend origin is ever needed (e.g. a staging preview URL), the single-origin CORS layer will break it without a config change.

### Input Validation: Category/Severity Not Validated at Handler Level — LOW

- **Issue:** `category` and `severity` values from the multipart form are passed directly to PostgreSQL as `$4::issue_category` and `$5::severity_level` enum casts (`backend/src/db/queries.rs:94`). An invalid enum value produces a PostgreSQL error that maps to HTTP 500 rather than HTTP 400.
- **Files:** `backend/src/handlers/reports.rs:118-129`, `backend/src/db/queries.rs:88-95`
- **Impact:** A client submitting `category=hack_attempt` receives a generic 500. Not a security risk but bad DX and masks abuse attempts.
- **Fix approach:** Validate `category` and `severity` against the known enum values in the handler before the DB query, mirroring the existing `validate_status()` pattern in `backend/src/handlers/admin.rs:121-126`.

### `admin_get_stats` Not Org-Scoped — LOW

- **Issue:** `admin_get_stats` (`backend/src/handlers/admin.rs:575-580`) returns unfiltered global report counts. Org-scoped reviewers see total counts across all wards, not just their assigned org.
- **Files:** `backend/src/handlers/admin.rs:575-580`, `backend/src/db/admin_queries.rs:571-633`
- **Impact:** Information exposure: org-scoped admins can infer activity outside their jurisdiction from the stats endpoint.
- **Fix approach:** Thread `org_id` from the JWT claims through `admin_get_stats` and add org-scoping CTE to the four count queries.

---

## Performance Concerns

### Per-Request Admin User DB Lookup in `admin_list_reports` — MEDIUM

- **Issue:** Every `GET /api/admin/reports` request fetches the full `AdminUser` row from `admin_users` to resolve `org_id` (`backend/src/handlers/admin.rs:407-415`). The JWT does not carry `org_id` by design (to reflect org assignment changes without reissuing tokens). This adds one extra DB round-trip per admin report list page load.
- **Files:** `backend/src/handlers/admin.rs:407-415`, `backend/src/db/admin_queries.rs:713-726`
- **Impact:** At low load (single admin) this is negligible. At higher concurrent admin usage, this doubles DB query load for the most common admin action.
- **Fix approach:** Accept the tradeoff (documented at `backend/src/handlers/admin.rs:407-410`) as a deliberate design. Revisit if DB query latency becomes measurable at the application level.

### `admin_update_report_status` Double DB Fetch — LOW

- **Issue:** The status update handler updates the row, then immediately fetches it again via `get_admin_report_by_id` (`backend/src/handlers/admin.rs:480-495`). Two DB round-trips where one `UPDATE ... RETURNING` would suffice.
- **Files:** `backend/src/handlers/admin.rs:480-505`
- **Fix approach:** Change `update_report_status` to use `UPDATE ... RETURNING` and return the updated row directly.

### `admin_get_stats` Four Sequential Queries — LOW

- **Issue:** `get_report_stats` executes four separate `SELECT COUNT(*)` queries sequentially: total, by status, by category, by severity (`backend/src/db/admin_queries.rs:572-633`).
- **Files:** `backend/src/db/admin_queries.rs:571-633`
- **Fix approach:** Run the four queries concurrently via `tokio::join!`, or consolidate into a single query using conditional aggregation (`COUNT(*) FILTER (WHERE status = 'submitted') AS submitted`).

### Image Serving: No CDN, No Resize Pipeline — MEDIUM

- **Issue:** Uploaded images are served directly from the Rust backend via `tower_http::ServeDir` (`backend/src/main.rs:214`), proxied through nginx over the Cloudflare tunnel. A 5 MB iPhone JPEG is served raw on every request. The nginx `/uploads/` location sets `expires 30d` and `Cache-Control: public` but there is no resize/compression step.
- **Files:** `backend/src/main.rs:214`, `nginx/nginx.conf:129-136`
- **Impact:** The map page loads all report images at full resolution. At 100+ reports averaging 3 MB, the map page requests 300 MB+ in images. Mobile users on 4G will experience unacceptable load times.
- **Fix approach:** Add a thumbnail generation step at upload time (save `{uuid}_thumb.jpg` at 400px width using the `image` crate). Serve thumbnails on map/list endpoints, full image on detail view. Long-term: swap `ServeDir` for Cloudflare R2 with automatic image resizing.

### Dedup Job: No Batch Size Limit — LOW

- **Issue:** `run_dedup_pass` fetches ALL unlinked reports created in the last 15 minutes without a `LIMIT` clause (`backend/src/db/dedup_job.rs:62-68`).
- **Files:** `backend/src/db/dedup_job.rs:62-68`
- **Impact:** After a spam burst that bypasses rate limiting (distributed IPs), a single dedup pass could process hundreds of reports, holding DB connections for several seconds.
- **Fix approach:** Add `LIMIT 100` to the candidate fetch query and log a warning when the limit is hit.

---

## Reliability Concerns

### No Graceful Shutdown — MEDIUM

- **Issue:** `axum::serve(listener, app).await.expect("Server error")` at `backend/src/main.rs:230-232` has no graceful shutdown handler. There is no `with_graceful_shutdown()` for SIGTERM or SIGINT signals.
- **Files:** `backend/src/main.rs:230-232`
- **Impact:** On `docker compose stop` (which sends SIGTERM), the Rust process is killed immediately. In-flight requests — including photo disk writes at `tokio::fs::write` (`backend/src/handlers/reports.rs:256`) — may be abandoned mid-write, producing corrupted or zero-byte image files.
- **Fix approach:** Add `.with_graceful_shutdown(shutdown_signal())` where `shutdown_signal()` awaits `tokio::signal::ctrl_c()` and `unix::signal(SIGTERM)`.

### `expect()` Calls in Startup Path — LOW

- **Issue:** Multiple `expect()` calls in `backend/src/main.rs` produce panics with unstructured backtraces on startup failure.
  - `main.rs:83`: `expect("Failed to create uploads directory")`
  - `main.rs:90`: `expect("Failed to connect to database")`
  - `main.rs:96`: `expect("Failed to run database migrations")`
  - `main.rs:228`: `expect("Failed to bind")`
- **Files:** `backend/src/main.rs:83, 90, 96, 228`
- **Impact:** These are intentional fail-fast behaviors — acceptable for startup. However, they produce no structured log entry before the panic, making Docker log aggregation harder.
- **Fix approach:** Add `tracing::error!("...")` immediately before each `expect()` for the DB connect and bind cases where the error message is non-obvious.

### Database Connection Pool Hardcoded — LOW

- **Issue:** `PgPoolOptions::new().max_connections(10)` at `backend/src/main.rs:87` is a hardcoded constant. Tuning requires a code change and rebuild.
- **Files:** `backend/src/main.rs:86-88`
- **Fix approach:** Read from a `DB_MAX_CONNECTIONS` env var (default 10).

### Dedup Job Errors Not Alertable — LOW

- **Issue:** Repeated dedup failures are logged at `ERROR` level but there is no escalation after consecutive failures (`backend/src/db/dedup_job.rs:52-54`).
- **Files:** `backend/src/db/dedup_job.rs:49-57`
- **Fix approach:** Add a consecutive-failure counter; after 3 consecutive failures, emit an enhanced ERROR log with context to aid incident diagnosis.

---

## Technical Debt

### TODO Comments Above Implemented Functions — HIGH

Multiple production source files retain `TODO: implement` comment headers above functions that are already implemented, left over from the TDD stub workflow. These are misleading to any executor reading the file.

- `backend/src/models/admin.rs:88, 195, 257, 279, 306, 370, 409, 438, 456`
- `backend/src/handlers/admin.rs:115, 145`
- **Files:** `backend/src/models/admin.rs`, `backend/src/handlers/admin.rs`
- **Fix approach:** Audit all `TODO: implement` markers. Where the implementation is present and `cargo test` passes, remove the comment header. The tests are the authoritative contract, not the TODO comments.

### Bounding Box Constants Duplicated in Handler and Test Module — LOW

- **Issue:** Bengaluru bounding box constants are defined twice: in the production handler (`backend/src/handlers/reports.rs:210-213`) and again in the test module (`backend/src/handlers/reports.rs:344-347`).
- **Files:** `backend/src/handlers/reports.rs:210-213, 344-347`
- **Impact:** A change to one set of constants without updating the other causes tests to pass while production uses stale values.
- **Fix approach:** Extract to module-level `const` declarations and reference them from both the handler and the test.

### `PUBLIC_URL` Hardcoded in `docker-compose.yml` — LOW

- **Issue:** `docker-compose.yml:35` hardcodes `PUBLIC_URL: http://localhost` rather than reading from an env var. Image URLs in API responses always use `http://localhost/uploads/...` unless an `.env` override exists.
- **Files:** `docker-compose.yml:35`
- **Fix approach:** Change to `PUBLIC_URL: "${PUBLIC_URL:-http://localhost}"`.

### Logout Comment References Decommissioned Railway — LOW

- **Issue:** Comment at `backend/src/handlers/admin.rs:318` references "Vercel+Railway staging." Railway was decommissioned in Phase 02.4.
- **Files:** `backend/src/handlers/admin.rs:318`
- **Fix approach:** Update comment to reference Cloudflare tunnel architecture.

### Dynamic SQL Parameter Index Tracking Is Manual — LOW

- **Issue:** `build_report_where_clause` in `backend/src/db/admin_queries.rs:193-231` increments a `param_idx` counter manually. Misaligning bind order with generated `$N` indices produces silent wrong-data bugs (not SQL injection — values are still parameterized, but could bind to the wrong parameter).
- **Files:** `backend/src/db/admin_queries.rs:193-295`
- **Fix approach:** Add a unit test that verifies the bind count matches the number of `$N` tokens in generated SQL strings for all filter combinations.

### Large Files: `admin_queries.rs` and `models/admin.rs` — LOW

- **Files:** `backend/src/db/admin_queries.rs` (1269 lines), `backend/src/models/admin.rs` (1775 lines)
- **Issue:** Inline test modules account for most of the file length. Navigation and merge conflicts are harder than necessary.
- **Fix approach:** Extract test modules into separate test files under a `backend/tests/` integration test directory, keeping unit tests co-located but limited to the directly testable pure functions.

---

## Operational Concerns

### No Database Backup Strategy — HIGH

- **Issue:** No automated backup exists for the `postgres_data` Docker volume or the `uploads` Docker volume. This is flagged in `docs/product-plan.md:193-194` as unaddressed item `P3-1`.
- **Files:** `docker-compose.yml` (no backup service), `docs/product-plan.md:193-194`
- **Impact:** A disk crash, corrupted volume, or accidental `docker volume rm` destroys all submitted civic-data permanently and irreversibly. This project is a public-data archive.
- **Fix approach:** Add a `backup/` directory with a cron-triggered script running `pg_dump` and `rsync`ing both volumes to Cloudflare R2 or Backblaze B2. Target: daily backups, 30-day retention. Document in `DEPLOYMENT.md`.

### No Monitoring or Alerting — MEDIUM

- **Issue:** The application emits structured JSON logs to stderr but has no Prometheus metrics, no uptime check, and no alerting. `docs/product-plan.md:187-189` item `P2-5` (metrics endpoint) is unimplemented.
- **Files:** `docs/product-plan.md:187-189`, `backend/src/main.rs`
- **Impact:** A crashed backend, full disk (from uploads), or database outage is invisible until a user reports a broken experience.
- **Fix approach:** Add a Prometheus `/metrics` endpoint (using `metrics-exporter-prometheus` crate) on an internal port. Connect to Uptime Robot or Grafana Cloud free tier.

### Self-Hosted Single-Point-of-Failure — HIGH

- **Issue:** The entire backend, database, and uploaded images run on a single Arch Linux desktop machine connected via Cloudflare Tunnel. No redundancy exists.
- **Files:** `.planning/phases/02.4-.../02.4-VERIFICATION.md`
- **Impact:** A power failure, hardware failure, or `cloudflared` crash takes down the entire public-facing service.
- **Current mitigation:** `restart: always` on `db`, `restart: unless-stopped` on `backend`/`nginx`, `cloudflared` as a systemd service.
- **Fix approach:** Accepted architectural risk for early-phase civic-tech. Document explicitly in `DEPLOYMENT.md`. Add a Cloudflare uptime monitor on the tunnel health endpoint. Track VPS migration as Phase 04 item.

### No Log Aggregation or Retention Policy — MEDIUM

- **Issue:** All logs go to Docker stdout/stderr with default Docker daemon log rotation. No centralized log search. Nginx JSON logs go nowhere persistent.
- **Files:** `nginx/nginx.conf:31-44`, `backend/src/main.rs:70-77`
- **Impact:** Debugging production incidents requires physical machine access. Abuse patterns are not visible in aggregate.
- **Fix approach:** Configure Docker daemon log rotation in `/etc/docker/daemon.json` (`max-size: 100m, max-file: 3`). Consider shipping to free-tier Loki (Grafana Cloud).

### Secret Rotation Process Undocumented — MEDIUM

- **Issue:** `JWT_SECRET`, `POSTGRES_PASSWORD`, and `ADMIN_SEED_PASSWORD` are stored as GitHub Actions secrets and in an `.env` file on the desktop with no documented rotation procedure.
- **Files:** `.github/workflows/deploy.yml`, `DEPLOYMENT.md`
- **Impact:** No documented procedure for responding to a secret leak. Rotating `JWT_SECRET` invalidates all active admin sessions without warning.
- **Fix approach:** Document rotation procedure in `DEPLOYMENT.md`: (1) update GitHub Actions secret, (2) update `.env` on desktop, (3) `docker compose restart backend` to invalidate all current JWTs.

---

## Test Coverage Gaps

### No Live DB Integration Tests in CI — HIGH

- **What's not tested:** SQLx query correctness — column name mismatches, type cast errors, enum cast failures, index usage.
- **Files:** `backend/src/db/queries.rs`, `backend/src/db/admin_queries.rs`, `.github/workflows/ci.yml`
- **Why gap exists:** Runtime `sqlx::query_as::<_, T>(sql)` is used instead of compile-time macros specifically to avoid needing a DB in CI. Explicitly acknowledged in `.planning/phases/02.1-.../02.1-CONTEXT.md:134`.
- **Risk:** A SQL migration that renames a column will compile and fail only at runtime. Schema drift between migration files and query code is undetectable in CI.
- **Priority:** HIGH — this is the single highest-value testing gap.
- **Fix approach:** Add a PostgreSQL service container (`postgis/postgis:16-3.4-alpine`) to the `backend-checks` CI job in `.github/workflows/ci.yml` and run `cargo test` against it.

### No Integration Tests for Admin HTTP Handlers — MEDIUM

- **What's not tested:** Full admin HTTP flow — login, JWT cookie, protected route, DB mutation. `backend/src/handlers/admin.rs:11-42` explicitly states integration tests were never authored.
- **Files:** `backend/src/handlers/admin.rs`
- **Risk:** Authentication edge cases (expired token reaching admin endpoint, deactivated user with valid JWT) are only verified by pure unit tests on `extract_claims`.
- **Priority:** Medium — blocked by absence of a live DB in CI.

### No Frontend Unit Tests — MEDIUM

- **What's not tested:** The 4-step report submission form state machine, map filter chip wiring, admin dashboard data fetching, `ReportResponse` rendering.
- **Files:** `frontend/app/`
- **Risk:** All frontend correctness depends on manual UAT. Phase 03 validation plan (`03-VALIDATION.md`) references Jest test commands that do not yet exist.
- **Fix approach:** Add Jest + React Testing Library. Start with `frontend/app/lib/config.ts` (pure functions) and the report form state machine.

### Dedup Job: No Integration Test for PostGIS Proximity Logic — LOW

- **What's not tested:** Actual `ST_DWithin` execution — that two reports 49m apart are linked and 51m apart are not.
- **Files:** `backend/src/db/dedup_job.rs:121-180`
- **Risk:** A future coordinate-order edit could flip lat/lng in `FIND_NEARBY_OPEN_REPORT_SQL` and the unit test (which only checks the SQL string) would still pass.
- **Priority:** Low — blocked by absence of a live DB in CI.

---

## Phase-Specific Risks

### Phase 02.4: Full E2E Flow Not Live-Verified — HIGH

- **Issue:** Phase 02.4 (self-hosted infrastructure) was scored 7/7 but 5 human-verification items are marked `UNCERTAIN — human needed`: Cloudflare tunnel health, admin login with cookies, report submission, auth guard, and GitHub Actions self-hosted runner.
- **Files:** `.planning/phases/02.4-.../02.4-VERIFICATION.md`
- **Impact:** `REQUIREMENTS.md` INFRA-01..05 entries still show `[ ]` (Pending). It is unknown whether the live production infrastructure is actually functioning.
- **Fix approach:** Execute the 5 human verification items from `02.4-VERIFICATION.md` and update `REQUIREMENTS.md` before starting Phase 03.

### Phase 03: GBA Org Structure Unconfirmed — MEDIUM

- **Issue:** `organizations` table seeded empty. `wards.org_id` is NULL for all 198 wards. Org-scoped admin users will see zero reports because the org-to-ward mapping is empty.
- **Files:** `backend/migrations/006_ward_org_scoping.sql`, `.planning/STATE.md:87, 152`
- **Impact:** The multi-organization admin model is built but non-functional until GBA corporation and ward office structure is confirmed via the Walkaluru / Arun Pai engagement.

### CSP `script-src 'unsafe-inline'` Accepted Risk — MEDIUM

- **Issue:** `nginx/nginx.conf:166` includes `'unsafe-inline'` in `script-src` for the `/admin` location. This defeats XSS protection for the admin dashboard. Explicitly accepted in the inline comment.
- **Files:** `nginx/nginx.conf:157-166`
- **Current mitigation:** No `dangerouslySetInnerHTML` in admin components currently. EXIF stripping and JSON serialization prevent most injection vectors.
- **Fix approach:** Per-request CSP nonces via Next.js middleware, propagated through nginx. Tracked as a deferred item in `.planning/phases/02.1-.../02.1-CONTEXT.md:132`.

### Leaflet CSS Loaded from External CDN — LOW

- **Issue:** `nginx/nginx.conf:166` includes `https://unpkg.com` in `style-src` and `img-src`. Leaflet CSS loads from an external CDN in the admin map view.
- **Files:** `nginx/nginx.conf:166`
- **Impact:** Admin map depends on unpkg.com availability. A CDN outage or npm supply chain compromise could break the admin map.
- **Fix approach:** Copy Leaflet assets to `frontend/public/leaflet/` and remove the unpkg.com CSP exception. Tracked in `.planning/phases/02.1-.../02.1-CONTEXT.md:133`.

### Phase 02.2 STAGING-03 Smoke Test on Decommissioned Infrastructure — LOW

- **Issue:** STAGING-03 (CI smoke test) was not tested during the Phase 02.2 field UAT session (`02.2-HUMAN-UAT.md:56-58`). `REQUIREMENTS.md:33` marks it Complete, but this was during Railway-era infrastructure that has since been decommissioned.
- **Files:** `.planning/phases/02.2-.../02.2-HUMAN-UAT.md:56-58`, `.planning/REQUIREMENTS.md:33`
- **Impact:** The smoke test in `deploy.yml` now targets `vars.BACKEND_URL` (Cloudflare tunnel). Its first live execution occurs on the next push to `main`.

---

*Concerns audit: 2026-05-20*
