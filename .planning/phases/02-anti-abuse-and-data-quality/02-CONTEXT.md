# Phase 2: Anti-Abuse and Data Quality - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the report submission pipeline against spam, bots, and duplicate flooding before GBA launch. All abuse handling is invisible to legitimate users — no CAPTCHA, no verification friction. The changes are: per-IP + per-location rate limiting, honeypot silent discard, proximity duplicate detection with FK linking (async), and server-side exact-photo hash rejection.

Citizens submitting legitimate reports see no changes to the flow. Only admins see new duplicate signals in the triage queue.

</domain>

<decisions>
## Implementation Decisions

### Rate Limiting Strategy
- Rate limit key: `(IP address + geohash-6 ~100m cell)` — not purely per-IP
- Threshold: 2 reports per cell per hour per IP (prevents same-spot spam while allowing a citizen to walk around and report multiple issues)
- Implementation: `governor` crate with a custom key type combining IP + geohash cell
- Rate limit is in ADDITION to existing Nginx rate limiting (belt-and-suspenders)
- **User-facing message when throttled:** Explicit — "You've submitted too many reports from this area recently. Try again in an hour." (transparent, not a generic error)
- HTTP status on throttle: 429 Too Many Requests

### Honeypot Field
- Field name: `website` (common bot-fill target)
- Hiding technique: CSS `position: absolute; left: -9999px` — NOT `display:none` or `visibility:hidden` (bots detect those)
- Field has `tabIndex=-1` and `autocomplete="off"` so human users never interact with it
- **Server-side behavior:** Silent HTTP 200 with fake success response — bot gets no signal it was detected. Report is discarded without storing. No logging required.

### Proximity Duplicate Detection
- Detection radius: **50m** (ST_DWithin at 50m, same category, open/unresolved reports)
- Data model: `duplicate_of_id UUID FK` on the `reports` table — second report points to the first (parent-child, not cluster table)
- Both reports are **accepted and stored** — not rejected. The second report gets `duplicate_of_id` set.
- `duplicate_count` on the original report increments each time a duplicate is linked to it
- `duplicate_confidence` set to `high` when multiple different users report same location+category (distinct IPs)
- **Timing: Asynchronous** — report saved immediately with no delay. Background Tokio task polls every 5 minutes for recently submitted reports without `duplicate_of_id` and runs the ST_DWithin check.
- Rate limiting distance (100m geohash) and duplicate detection distance (50m ST_DWithin) are intentionally different — different purposes, different granularities
- **Submitter UX:** Transparent — normal "Report submitted" success screen. No indication of potential duplicate. Dedup is an admin-side concern.

### Photo Hash Dedup
- Hash algorithm: SHA256
- Computed: **server-side** in Rust after receiving the upload (not client-side)
- `photo_hash` column stored on the `reports` table for future lookups
- If SHA256 matches an existing report's `photo_hash`: **silent HTTP 200 fake success** — identical to honeypot behavior. Report discarded, user sees normal success. No storage of duplicate image.
- Hash check runs before file write (fail fast, don't write to disk if it's a duplicate)

### Admin Triage Queue — Duplicate Display
- `duplicate_count` shown as a **badge** on each report row in the admin triage queue
- Reports with `duplicate_of_id != null` (i.e., are duplicates) show a "Duplicate" label + link to original
- Original reports with duplicates have an **expandable row** showing linked duplicate reports inline
- Admin sees the full cluster at a glance without leaving the queue
- No automatic sort by duplicate_count — admins can manually sort if desired (future enhancement)

### Claude's Discretion
- Exact geohash library choice for Rust (multiple crates available; pick stable one)
- Tokio background task polling interval (5 minutes suggested; adjust based on load)
- Exact schema column names, nullability, and defaults (within the spirit of decisions above)
- Admin UI component styling for the expandable duplicate row
- Whether `duplicate_confidence` is computed in the Tokio task or set by a separate heuristic

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants rate limiting to be location-aware so someone walking around Bengaluru can report multiple different issues from the same IP — only re-submitting at the SAME spot (within ~100m) gets throttled
- User wants both near-duplicate reports accepted (not rejected) and linked together — treats multiple reports at same location as a **signal of severity**, not spam to discard
- The async background task approach (not synchronous) chosen for duplicate linking — submitter gets instant confirmation, dedup happens in background

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/handlers/reports.rs::create_report`: insertion point for rate limit check (before DB write) and honeypot field extraction (from multipart)
- `backend/src/middleware/auth.rs`: existing middleware pattern — new rate-limit middleware can follow same `FromRequest`/`tower::Layer` pattern
- `backend/src/db/queries.rs`: existing spatial query file — ST_DWithin proximity check goes here alongside existing `get_ward_for_point`
- `backend/src/db/admin_queries.rs`: existing admin query file — duplicate-aware admin list query extension goes here
- `frontend/app/report/page.tsx`: submission form — honeypot hidden field injected here
- `frontend/app/admin/reports/page.tsx`: admin triage queue — duplicate badge + expandable row UI goes here

### Established Patterns
- Migrations: sequential SQL files (`001_init.sql` through `006_*.sql`) — Phase 2 schema changes go in `007_anti_abuse.sql`
- Multipart form handling: existing in `create_report` handler — honeypot field extracted as a regular multipart field
- `AppError` enum: all error paths return `AppError` — add `AppError::RateLimited` variant for 429
- DB model → Response struct separation: any new columns on `reports` need updating in both `Report` DB struct and `ReportResponse` serialization
- `tokio::spawn` for background tasks: existing pattern in `main.rs` for startup tasks — Tokio dedup job follows same pattern

### Integration Points
- `backend/migrations/`: `007_anti_abuse.sql` adds `photo_hash`, `duplicate_of_id`, `duplicate_count`, `duplicate_confidence` columns to `reports`
- `backend/src/main.rs`: spawn Tokio background dedup task at startup
- `backend/src/handlers/reports.rs`: add rate limit check + honeypot check + photo hash check in `create_report`
- `backend/src/db/queries.rs`: add `find_nearby_open_report(lat, lng, category, radius_m)` for dedup job
- `backend/Cargo.toml`: add `governor` crate + geohash crate
- `frontend/app/report/page.tsx`: inject hidden `website` honeypot field
- `frontend/app/admin/reports/page.tsx`: render `duplicate_count` badge + expandable duplicate rows

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-anti-abuse-and-data-quality*
*Context gathered: 2026-03-13*
