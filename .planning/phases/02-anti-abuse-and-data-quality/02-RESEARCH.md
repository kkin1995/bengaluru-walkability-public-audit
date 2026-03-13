# Phase 2: Anti-Abuse and Data Quality - Research

**Researched:** 2026-03-13
**Domain:** Rust/Axum abuse prevention — rate limiting, honeypot, proximity dedup, photo hash dedup, admin UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rate Limiting Strategy**
- Rate limit key: `(IP address + geohash-6 ~100m cell)` — not purely per-IP
- Threshold: 2 reports per cell per hour per IP
- Implementation: `governor` crate with a custom key type combining IP + geohash cell
- Rate limit is in ADDITION to existing Nginx rate limiting
- User-facing message when throttled: "You've submitted too many reports from this area recently. Try again in an hour."
- HTTP status on throttle: 429 Too Many Requests

**Honeypot Field**
- Field name: `website` (common bot-fill target)
- Hiding technique: CSS `position: absolute; left: -9999px` — NOT `display:none` or `visibility:hidden`
- Field has `tabIndex=-1` and `autocomplete="off"`
- Server-side behavior: Silent HTTP 200 with fake success response — report discarded, no logging

**Proximity Duplicate Detection**
- Detection radius: 50m (ST_DWithin at 50m, same category, open/unresolved reports)
- Data model: `duplicate_of_id UUID FK` on `reports` — second report points to the first
- Both reports accepted and stored — second report gets `duplicate_of_id` set
- `duplicate_count` on the original report increments each time a duplicate is linked
- `duplicate_confidence` set to `high` when distinct IPs submit same location+category within 50m
- Timing: Asynchronous — report saved immediately. Background Tokio task polls every 5 minutes
- Submitter UX: Transparent — normal "Report submitted" success screen

**Photo Hash Dedup**
- Hash algorithm: SHA256
- Computed: server-side in Rust after receiving the upload
- `photo_hash` column stored on the `reports` table
- If SHA256 matches existing: silent HTTP 200 fake success — report discarded, no file write
- Hash check runs before file write (fail fast)

**Admin Triage Queue — Duplicate Display**
- `duplicate_count` shown as a badge on each report row
- Reports with `duplicate_of_id != null` show a "Duplicate" label + link to original
- Original reports with duplicates have an expandable row showing linked duplicates inline
- No automatic sort by duplicate_count — manual sort only (future)

### Claude's Discretion
- Exact geohash library choice for Rust (multiple crates available)
- Tokio background task polling interval (5 minutes suggested)
- Exact schema column names, nullability, and defaults
- Admin UI component styling for the expandable duplicate row
- Whether `duplicate_confidence` is computed in the Tokio task or by a separate heuristic

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ABUSE-01 | Report submission rate-limited at app layer (max 5/hr per IP) using `governor` crate, supplementing Nginx | governor crate keyed API; geohash-6 cell key; AppError::RateLimited variant; 429 response |
| ABUSE-02 | Honeypot hidden field silently discards bot submissions without any error | CSS off-screen hiding; multipart field extraction; silent 200 response pattern |
| ABUSE-03 | Reports within 50m of open same-category report flagged as `potential_duplicate`, `duplicate_count` incremented | ST_DWithin 50m PostGIS; async Tokio background task; `duplicate_of_id` FK schema |
| ABUSE-04 | Multiple users (distinct IPs) within 50m/same category sets `duplicate_confidence = high` | Background task distinct-IP heuristic; `duplicate_confidence` column |
| ABUSE-05 | Exact duplicate photos (same SHA256) silently rejected at upload | `sha2` crate; server-side hash before file write; `photo_hash` column; silent 200 pattern |
| ABUSE-06 | `duplicate_count` visible in admin triage queue as severity indicator | Frontend badge component; list_admin_reports query extension; AdminReportRow type addition |
</phase_requirements>

---

## Summary

Phase 2 adds four independent defence layers to the public report submission pipeline: per-IP+geohash rate limiting, honeypot silent discard, asynchronous proximity duplicate detection, and server-side photo hash dedup. All abuse handling is invisible to legitimate users. Only the admin triage queue surface shows the resulting data quality signals (`duplicate_count`, `duplicate_of_id`, `duplicate_confidence`).

The Rust ecosystem has mature, well-maintained libraries for every required primitive: `governor` 0.10.4 for keyed rate limiting, `geohash` 0.13.1 for encoding coordinates to a geohash cell key, `sha2` 0.10.8 for SHA-256 hashing, and PostGIS `ST_DWithin` (already in the project) for the 50m proximity check. None of these require custom implementations.

The schema additions are a single migration (`007_anti_abuse.sql`) adding four columns to `reports`: `photo_hash TEXT UNIQUE`, `duplicate_of_id UUID REFERENCES reports(id)`, `duplicate_count INT NOT NULL DEFAULT 0`, and `duplicate_confidence TEXT`. The async dedup Tokio task follows the existing `tokio::spawn` pattern already used in `main.rs` for startup tasks. The `Report` and `ReportResponse` structs and all queries that SELECT from `reports` need updating to carry the new columns.

**Primary recommendation:** Use `governor` keyed rate limiter with a `String` key of form `"{ip}:{geohash6}"` (no custom struct needed — String implements Hash+Eq); use `geohash` crate to encode lat/lng to 6-char geohash; use `sha2` crate for photo hash; implement dedup as a standalone `tokio::spawn` background loop.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `governor` | 0.10.4 | Keyed GCRA rate limiter; `RateLimiter::keyed(quota)` | Locked decision; most-downloaded Rust rate-limit crate; ~33M downloads/month |
| `geohash` | 0.13.1 | Encode (lat, lng) → geohash string at precision N | Most-used geohash crate; pure Rust; simple `encode(Coord { x: lng, y: lat }, 6)` API |
| `sha2` | 0.10.8 | SHA-256 hash of image bytes | RustCrypto collection; #4 crypto crate; 33M downloads/month |
| `digest` | 0.10 | Trait required by sha2 for `Digest::finalize()` pattern | Companion trait crate; required by sha2 API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dashmap` | 5 | Concurrent HashMap; `governor` uses it internally for keyed store | Already a transitive dep of `governor`; no direct dep needed |
| `nonzero_ext` or `std::num::NonZeroU32` | stdlib | Required for `governor` quota construction | `NonZeroU32::new(2).unwrap()` inline; no extra crate needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `governor` direct | `tower_governor` (0.8.0) wrapper | `tower_governor` wraps `governor` as Tower middleware; convenient for IP-only limiting but its custom key extractor requires a full `KeyExtractor` trait impl — more boilerplate than calling `lim.check_key(&key)` directly in the handler. Direct `governor` is simpler for our composite IP+geohash key. |
| `sha2` + `digest` | `sha256` crate | `sha256` crate is a thin wrapper, slightly simpler API but fewer downloads and less battle-tested. `sha2` is the canonical RustCrypto choice. |
| `geohash` 0.13.1 | `geoprox` | `geoprox` is a full geo-proximity indexing library — overkill for a single encode call. `geohash` crate is focused and minimal. |

### Installation
```bash
cargo add governor geohash sha2 digest
```

In `Cargo.toml`:
```toml
governor = "0.10"
geohash = "0.13"
sha2 = "0.10"
digest = "0.10"
```

---

## Architecture Patterns

### Recommended Project Structure for Phase 2 Changes
```
backend/
├── migrations/
│   └── 007_anti_abuse.sql          ← new: photo_hash, duplicate_of_id, duplicate_count, duplicate_confidence
├── src/
│   ├── main.rs                     ← spawn dedup background task at startup; add rate_limiter to AppState
│   ├── errors.rs                   ← add AppError::RateLimited variant
│   ├── models/
│   │   └── report.rs               ← add new columns to Report struct and ReportResponse
│   ├── handlers/
│   │   └── reports.rs              ← add honeypot check, rate limit check, photo hash check in create_report
│   ├── db/
│   │   ├── queries.rs              ← add find_nearby_open_reports(), insert_report updated for photo_hash
│   │   ├── admin_queries.rs        ← extend list_admin_reports to include duplicate_count/duplicate_of_id
│   │   └── dedup_job.rs            ← new: background Tokio task for proximity dedup
└── frontend/
    └── app/
        ├── report/
        │   └── page.tsx            ← add hidden `website` honeypot field
        └── admin/reports/
            └── page.tsx            ← add duplicate_count badge + expandable duplicate rows
```

### Pattern 1: Keyed Rate Limiter in AppState
**What:** A single `Arc<governor::RateLimiter<String, ...>>` stored in AppState, checked in the handler with a composite key.
**When to use:** Any time you need per-key rate limiting without Tower middleware.

```rust
// Source: https://docs.rs/governor/latest/governor/struct.RateLimiter.html
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;
use std::sync::Arc;

// In AppState:
pub rate_limiter: Arc<governor::DefaultKeyedRateLimiter<String>>,

// In main.rs initialization:
let quota = Quota::per_hour(NonZeroU32::new(2).unwrap());
let rate_limiter = Arc::new(RateLimiter::keyed(quota));

// In create_report handler:
let cell_key = format!("{}:{}", client_ip, geohash6);
if rate_limiter.check_key(&cell_key).is_err() {
    return Err(AppError::RateLimited(
        "You've submitted too many reports from this area recently. Try again in an hour.".into()
    ));
}
```

### Pattern 2: Geohash Encode for Rate Limit Key
**What:** Convert (lat, lng) to a 6-character geohash (~1.2km × 0.6km cells at precision 6; actual ~100m resolution uses precision 7, but CONTEXT.md locks precision 6 for ~100m cell key).

**Note on geohash precision:** Precision 6 gives ~1.2km × 0.6km cells. Precision 7 gives ~152m × 152m. CONTEXT.md says "~100m cell" with geohash-6 — the user intends geohash-6 as the rate limit granularity (not exact 100m). Use precision 6 as locked.

```rust
// Source: https://docs.rs/geohash/latest/geohash/
use geohash::{encode, Coord};

fn lat_lng_to_geohash6(lat: f64, lng: f64) -> String {
    // geohash::Coord uses { x: longitude, y: latitude }
    encode(Coord { x: lng, y: lat }, 6usize)
        .unwrap_or_else(|_| "000000".to_string())
}
```

### Pattern 3: Server-Side SHA256 Before File Write
**What:** Hash raw image bytes after reading from multipart, before EXIF strip and disk write.

```rust
// Source: https://docs.rs/sha2/latest/sha2/
use sha2::{Sha256, Digest};

fn compute_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}
```

Check pattern in `create_report`:
1. Compute hash from `req.image_bytes`
2. Query `SELECT id FROM reports WHERE photo_hash = $1` — if row exists, return fake 200
3. Continue to EXIF strip + write + INSERT with `photo_hash` set

### Pattern 4: Async Dedup Background Task
**What:** A looping Tokio task that polls for recently submitted reports without `duplicate_of_id`, then runs ST_DWithin check.

```rust
// Source: existing main.rs tokio::spawn pattern in this codebase
// Spawned in main() after AppState construction:
tokio::spawn(db::dedup_job::run_dedup_loop(Arc::clone(&pool)));

// In dedup_job.rs:
pub async fn run_dedup_loop(pool: Arc<sqlx::PgPool>) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(300)); // 5 min
    loop {
        interval.tick().await;
        if let Err(e) = run_dedup_pass(&pool).await {
            tracing::error!("Dedup pass failed: {e}");
        }
    }
}
```

The dedup pass query finds reports submitted in the last 10 minutes without `duplicate_of_id`, then for each runs the ST_DWithin check:

```sql
-- find_nearby_open_reports: finds the earliest open report within 50m of same category
-- that is NOT itself a duplicate (duplicate_of_id IS NULL = it is an original)
SELECT id
FROM reports
WHERE id != $1
  AND category = $2::issue_category
  AND status != 'resolved'
  AND duplicate_of_id IS NULL
  AND ST_DWithin(
      ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
      location,
      50.0
  )
ORDER BY created_at ASC
LIMIT 1
```

### Pattern 5: Honeypot Field — Frontend + Backend

Frontend (hidden via CSS, never focusable):
```tsx
{/* Honeypot — hidden from humans via CSS positioning, not display:none */}
<input
  type="text"
  name="website"
  tabIndex={-1}
  autoComplete="off"
  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
  aria-hidden="true"
/>
```

Backend (in `create_report` multipart loop, add to match arm):
```rust
"website" => {
    let text = field.text().await.unwrap_or_default();
    if !text.is_empty() {
        // Bot detected — silently fake success without storing anything
        return Ok(Json(fake_success_response()));
    }
}
```

`fake_success_response()` returns a plausible-looking `ReportResponse` with a nil UUID — bots see HTTP 200 with normal JSON.

### Pattern 6: Client IP Extraction in Axum
**What:** The app sits behind nginx which forwards the real IP via `X-Real-IP` header.

```rust
// Extract client IP from X-Real-IP (nginx) or fall back to peer addr
fn extract_client_ip(headers: &axum::http::HeaderMap, peer_addr: Option<std::net::SocketAddr>) -> String {
    headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            peer_addr
                .map(|a| a.ip().to_string())
                .unwrap_or_else(|| "unknown".to_string())
        })
}
```

In the handler, use `axum::extract::ConnectInfo<SocketAddr>` (already available via `axum::serve`) and `headers: axum::http::HeaderMap` as additional extractor parameters.

### Anti-Patterns to Avoid

- **Synchronous ST_DWithin in the submission handler:** The dedup check requires a DB round-trip with a geospatial index scan. Doing this synchronously adds 10-50ms latency to every report submission. The async background task approach avoids this entirely.
- **display:none or visibility:hidden for honeypot:** Sophisticated bots detect these CSS properties and skip filling the field. CSS off-screen positioning (`position:absolute; left:-9999px`) is the correct hiding technique.
- **Storing rate limiter state in PostgreSQL:** The governor in-memory keyed store is appropriate for this scale. PostgreSQL-backed rate limiting adds unnecessary DB load and latency. The data is ephemeral — restarts reset counters, which is acceptable.
- **Checking photo hash after EXIF strip:** Hash must be computed from the raw original bytes BEFORE stripping. Two uploads of the same photo produce the same hash only if hashed before any transformation.
- **Setting `duplicate_of_id` at insertion time:** The dedup job is async. The handler must NOT block to run ST_DWithin — it inserts the report normally and lets the background task set `duplicate_of_id` later.
- **Forgetting to update `Report` FromRow struct:** Adding columns to the migration without updating the Rust struct causes runtime SQLx deserialization errors (not compile-time, since we use `query_as` with runtime SQL strings).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting with token bucket/leaky bucket | Custom HashMap<String, Vec<Instant>> | `governor` crate `RateLimiter::keyed()` | GCRA algorithm handles burst + steady rate correctly; thread-safe via DashMap; memory-bounded via automatic key eviction |
| SHA-256 hashing | Custom SHA-256 | `sha2` + `digest` crates | Cryptographic implementation has many subtle correctness and security requirements |
| Geohash encoding | Custom geohash algorithm | `geohash` crate | Geohash has precise base-32 encoding rules; off-by-one in cell boundaries causes correctness issues |
| Proximity check | Haversine formula in Rust | PostGIS `ST_DWithin` on the existing `location GEOGRAPHY` column | PostGIS uses the existing GIST index on `location`; handles spherical Earth geometry correctly; already in the project |

**Key insight:** Every primitive needed for this phase (rate limiting, geohashing, SHA-256, geospatial proximity) has a battle-tested Rust library or existing PostGIS capability. Custom implementations would add thousands of lines and subtle edge-case bugs.

---

## Common Pitfalls

### Pitfall 1: AppState RateLimiter Type is Verbose
**What goes wrong:** `governor::DefaultKeyedRateLimiter<String>` is an alias for a complex generic type. Storing it in `AppState` (which derives `Clone`) requires the rate limiter to be wrapped in `Arc`. The Arc itself is cloned (cheap), not the limiter.
**Why it happens:** governor's `RateLimiter` doesn't implement `Clone` — it's stateful.
**How to avoid:** `pub rate_limiter: Arc<governor::DefaultKeyedRateLimiter<String>>` in AppState; wrap with `Arc::new(RateLimiter::keyed(quota))` in main.
**Warning signs:** Compiler error "the trait `Clone` is not implemented for `RateLimiter<...>`"

### Pitfall 2: Geohash Coordinate Order (X=longitude, Y=latitude)
**What goes wrong:** `geohash::Coord { x, y }` uses geography convention: x = longitude, y = latitude. Swapping lat/lng produces a geohash in the wrong location (rate limit key misses, cells shifted).
**Why it happens:** The codebase already has a ST_MakePoint coordinate-order test as a known regression risk. Same issue applies to geohash.
**How to avoid:** `Coord { x: lng, y: lat }` — always x=longitude. Mirror the existing `get_ward_for_point` convention.
**Warning signs:** Rate limiting triggering for different locations; or never triggering at the same spot.

### Pitfall 3: `governor` Quota Construction Requires NonZero
**What goes wrong:** `Quota::per_hour(0)` panics. Must use `NonZeroU32`.
**Why it happens:** API design enforces non-zero rate at type level.
**How to avoid:** `Quota::per_hour(NonZeroU32::new(2).unwrap())` — the unwrap is safe for a compile-time constant.

### Pitfall 4: Fake Success Response Must Look Real
**What goes wrong:** If the fake success response for honeypot/photo-hash returns `{}` or an obviously different shape, a bot or retry logic can detect the discard.
**Why it happens:** Bots sometimes diff successful vs failed responses.
**How to avoid:** Return a `ReportResponse`-shaped JSON with a nil UUID and realistic field values. The response must be structurally identical to a real success.

### Pitfall 5: `duplicate_of_id` Self-Reference Guard
**What goes wrong:** If the dedup job runs on report A and A is compared against itself (or against another report that is itself a duplicate), it can create circular references.
**Why it happens:** The ST_DWithin query returns all nearby reports including A itself if not filtered.
**How to avoid:** The proximity query must include `WHERE id != $1 AND duplicate_of_id IS NULL` — only match original (non-duplicate) reports, exclude self.

### Pitfall 6: `duplicate_count` Must Be Incremented Atomically
**What goes wrong:** Two concurrent dedup job runs (or a restart mid-run) could both try to increment `duplicate_count` on the same parent, causing a double increment.
**Why it happens:** Read-then-write pattern is not atomic.
**How to avoid:** Use `UPDATE reports SET duplicate_count = duplicate_count + 1 WHERE id = $1` in a single SQL statement — PostgreSQL serializes this atomically. Also set `duplicate_of_id` and `duplicate_count` in the same transaction.

### Pitfall 7: Report + Report DB Struct Must Include New Columns
**What goes wrong:** `sqlx::query_as::<_, Report>(sql)` with a SELECT that returns `duplicate_count` but the `Report` struct lacks the field causes a runtime error ("column not found" or missing binding).
**Why it happens:** SQLx with runtime queries doesn't check struct fields at compile time.
**How to avoid:** Update `Report` struct in `models/report.rs` to add all four new columns before writing any query that SELECTs them. Also update `insert_report` RETURNING clause.

### Pitfall 8: Photo Hash Check Must Use Original Bytes
**What goes wrong:** Computing SHA-256 after EXIF stripping means a photo with stripped EXIF and the same photo without stripping hash differently — the dedup check never fires.
**Why it happens:** EXIF stripping modifies the byte stream.
**How to avoid:** Compute `sha2::Sha256::digest(&req.image_bytes)` on the raw bytes BEFORE calling `strip_exif()`.

---

## Code Examples

Verified patterns from official sources:

### governor Keyed Rate Limiter
```rust
// Source: https://docs.rs/governor/latest/governor/struct.RateLimiter.html
use governor::{Quota, RateLimiter, state::keyed::DefaultKeyedStateStore, clock::DefaultClock};
use std::num::NonZeroU32;

type KeyedLimiter = RateLimiter<String, DefaultKeyedStateStore<String>, DefaultClock>;

// Construction:
let quota = Quota::per_hour(NonZeroU32::new(2).unwrap());
let limiter: KeyedLimiter = RateLimiter::keyed(quota);

// Usage:
let key = format!("{}:{}", ip, geohash6);
match limiter.check_key(&key) {
    Ok(_) => { /* proceed */ }
    Err(_) => { /* rate limited */ }
}
```

### geohash Encode
```rust
// Source: https://docs.rs/geohash/latest/geohash/
use geohash::{encode, Coord};

let cell = encode(Coord { x: lng, y: lat }, 6usize)
    .expect("valid Bengaluru coordinates always encode");
// Returns 6-char string e.g. "tdr1u3"
```

### SHA-256 Hash
```rust
// Source: https://docs.rs/sha2/latest/sha2/
use sha2::{Sha256, Digest};

let hash = format!("{:x}", Sha256::digest(&req.image_bytes));
// Returns 64-char lowercase hex string
```

### ST_DWithin Proximity Query (PostGIS)
```sql
-- Source: PostGIS docs; existing codebase uses ST_Within already
-- $1 = report_id to exclude (self)
-- $2 = category text
-- $3 = latitude, $4 = longitude
-- $5 = radius in metres (50.0)
SELECT id FROM reports
WHERE id != $1
  AND category = $2::issue_category
  AND status != 'resolved'
  AND duplicate_of_id IS NULL
  AND ST_DWithin(
      ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
      location,
      50.0
  )
ORDER BY created_at ASC
LIMIT 1
```

### Update Duplicate Link (Atomic)
```sql
-- Sets duplicate_of_id and increments parent duplicate_count in one transaction
UPDATE reports SET duplicate_of_id = $2 WHERE id = $1;
UPDATE reports SET
  duplicate_count = duplicate_count + 1,
  duplicate_confidence = CASE
    WHEN (SELECT COUNT(DISTINCT submitter_ip) FROM reports WHERE duplicate_of_id = $2) >= 2
    THEN 'high'
    ELSE duplicate_confidence
  END
WHERE id = $2;
```

**Note:** The `submitter_ip` approach above assumes IP is stored. Alternatively, the confidence heuristic can count distinct `duplicate_of_id` links — any second distinct report linking to the same parent means multiple users found the issue. CONTEXT.md says "distinct IPs" so a `submitter_ip` column is needed OR the Tokio task can accept that confidence stays `low` until a manual re-check. Recommended: store `submitter_ip TEXT` on `reports` (only visible to admin, not in `ReportResponse`). This is a schema decision left to Claude's discretion.

---

## Schema Changes (Migration 007_anti_abuse.sql)

```sql
-- Migration 007: Anti-abuse and data quality columns
ALTER TABLE reports
  ADD COLUMN photo_hash         TEXT,
  ADD COLUMN duplicate_of_id    UUID REFERENCES reports(id) ON DELETE SET NULL,
  ADD COLUMN duplicate_count    INT NOT NULL DEFAULT 0,
  ADD COLUMN duplicate_confidence TEXT CHECK (duplicate_confidence IN ('low', 'high')) DEFAULT 'low';

-- Unique constraint on photo_hash — prevents duplicate hashes at DB level
-- (application-level check is primary; DB constraint is belt-and-suspenders)
CREATE UNIQUE INDEX idx_reports_photo_hash ON reports (photo_hash) WHERE photo_hash IS NOT NULL;

-- Index for dedup job: find unlinked recent reports quickly
CREATE INDEX idx_reports_dedup_unlinked ON reports (created_at DESC) WHERE duplicate_of_id IS NULL;

-- Optional: submitter_ip for duplicate_confidence heuristic (admin-only, not in public response)
ALTER TABLE reports ADD COLUMN submitter_ip TEXT;
```

**Columns:**
- `photo_hash TEXT` — nullable (reports before Phase 2 have no hash); UNIQUE for new inserts
- `duplicate_of_id UUID` — FK to reports.id; NULL = original; non-null = duplicate pointing at parent
- `duplicate_count INT DEFAULT 0` — number of duplicates pointing at this report
- `duplicate_confidence TEXT` — `'low'` or `'high'` (or NULL for pre-phase-2 reports)
- `submitter_ip TEXT` — raw IP from `X-Real-IP` at submission time; stored on `reports` for admin use

---

## State Machine: create_report Handler Logic

```
multipart parsed
    │
    ▼
honeypot "website" field non-empty?
    YES → return fake_success_200() — discard, no log
    NO  ↓
    │
    ▼
compute sha256 of image_bytes
    │
    ▼
photo_hash exists in DB?
    YES → return fake_success_200() — discard, no file write
    NO  ↓
    │
    ▼
compute geohash6 from (lat, lng)
rate_limiter.check_key("{ip}:{geohash6}")
    Err → return 429 AppError::RateLimited with message
    Ok  ↓
    │
    ▼
[existing] validate Bengaluru bbox
    │
    ▼
[existing] ward lookup (non-fatal)
    │
    ▼
[existing] strip EXIF
    │
    ▼
[existing] write file to disk
    │
    ▼
insert_report with photo_hash, submitter_ip (new columns)
    │
    ▼
return 200 ReportResponse
(background dedup job will check proximity asynchronously)
```

---

## Admin Triage Queue Extension

The `list_admin_reports` query in `admin_queries.rs` needs to SELECT the new columns:
```sql
reports.duplicate_count,
reports.duplicate_of_id,
reports.duplicate_confidence
```

The JSON result map in `list_admin_reports` needs entries for these columns.

Frontend `admin/reports/page.tsx` additions:
1. `duplicate_count` badge on each row — show as a colored pill when `> 0`
2. "Duplicate" label + link to original when `duplicate_of_id != null`
3. Expandable row on originals showing linked duplicate reports (requires a secondary fetch or pre-loaded in the response — simplest approach: admin can click the link to filter by `duplicate_of_id`)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Rust `cargo test` (unit tests, no DB) + Jest 29 (frontend) |
| Config file | Backend: none (inline `#[cfg(test)]`); Frontend: `frontend/jest.config.js` |
| Quick run command | `cd backend && cargo test 2>/dev/null \| tail -5` |
| Full suite command | `cd backend && cargo test && cd ../frontend && npm test -- --passWithNoTests` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ABUSE-01 | Rate limit key = `{ip}:{geohash6}`, triggers 429 after threshold | unit | `cargo test rate_limit` | ❌ Wave 0 |
| ABUSE-01 | geohash6 encode uses x=lng, y=lat (coordinate order) | unit | `cargo test geohash_coordinate_order` | ❌ Wave 0 |
| ABUSE-02 | Non-empty `website` field returns fake 200 (honeypot) | unit | `cargo test honeypot` | ❌ Wave 0 |
| ABUSE-02 | Frontend form renders `website` input with correct CSS hiding | unit | `npm test -- report/page` | ❌ Wave 0 |
| ABUSE-03 | ST_DWithin proximity SQL uses 50m radius and same category filter | unit (SQL string) | `cargo test proximity_query` | ❌ Wave 0 |
| ABUSE-03 | `duplicate_of_id` set and `duplicate_count` incremented atomically | unit (SQL string) | `cargo test dedup_update_sql` | ❌ Wave 0 |
| ABUSE-04 | `duplicate_confidence` set to `high` when distinct IPs exceed threshold | unit | `cargo test duplicate_confidence` | ❌ Wave 0 |
| ABUSE-05 | SHA-256 hash computed from raw bytes (before EXIF strip) | unit | `cargo test photo_hash_before_exif` | ❌ Wave 0 |
| ABUSE-05 | Matching photo_hash returns fake 200 | unit | `cargo test photo_hash_dedup` | ❌ Wave 0 |
| ABUSE-06 | `list_admin_reports` SQL selects `duplicate_count` and `duplicate_of_id` | unit (SQL string) | `cargo test admin_reports_includes_dedup_cols` | ❌ Wave 0 |
| ABUSE-06 | Admin reports page renders `duplicate_count` badge when > 0 | unit | `npm test -- admin/reports/page` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && cargo test 2>/dev/null | tail -5`
- **Per wave merge:** `cd backend && cargo test && cd ../frontend && npm test -- --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/handlers/reports_abuse_tests.rs` (or inline in reports.rs `#[cfg(test)]`) — honeypot, rate limit key, photo hash, coordinate order tests
- [ ] `backend/src/db/dedup_job_tests.rs` — proximity SQL string tests, dedup update SQL tests
- [ ] `backend/src/db/admin_queries_abuse_tests.rs` — admin_reports dedup column selection tests
- [ ] `frontend/app/report/__tests__/page.honeypot.test.tsx` — frontend honeypot field render test
- [ ] `frontend/app/admin/reports/__tests__/page.dedup.test.tsx` — admin badge render test

---

## Open Questions

1. **`submitter_ip` storage**
   - What we know: `duplicate_confidence = 'high'` requires detecting distinct IPs for the same location+category cluster. CONTEXT.md says "distinct IPs" as the criterion.
   - What's unclear: Whether storing raw IP on the `reports` table is acceptable from a privacy standpoint. The existing codebase strips GPS from EXIF for privacy; raw IP is equivalent PII.
   - Recommendation: Store in `submitter_ip TEXT` column (admin-only, never in `ReportResponse`). The dedup job already runs server-side and is not user-visible. Acceptable privacy tradeoff given it's an anti-abuse mechanism and not exposed publicly.

2. **Dedup job "look-back window"**
   - What we know: The job polls every 5 minutes for reports without `duplicate_of_id`.
   - What's unclear: Should it scan ALL unlinked reports or only reports submitted in the last N minutes? A full scan is correct but expensive as the dataset grows.
   - Recommendation: Scan reports created in the last 15 minutes (3× the polling interval), using the `idx_reports_dedup_unlinked` index. Reports older than 15 minutes that were not matched in the first few passes can be considered definitively un-matched. Document this as the implemented window.

3. **`duplicate_confidence` field type**
   - What we know: CONTEXT.md says TEXT with values `'low'` or `'high'`. A Postgres ENUM would give compile-time safety.
   - What's unclear: Whether adding a new ENUM type (`duplicate_confidence_level`) is worth the migration complexity.
   - Recommendation: Use TEXT with a CHECK constraint for now (consistent with `org_type` pattern already in this codebase — see `005_organizations.sql`). No new ENUM needed.

---

## Sources

### Primary (HIGH confidence)
- `https://docs.rs/governor/latest/governor/struct.RateLimiter.html` — keyed rate limiter API, quota construction
- `https://docs.rs/geohash/latest/geohash/` — encode API, Coord struct (version 0.13.1)
- `https://docs.rs/sha2/latest/sha2/` — SHA-256 Digest API (version 0.10.8)
- Existing codebase — `backend/src/db/queries.rs` (`get_ward_for_point`), ST_DWithin PostGIS spatial query patterns already in use
- `backend/migrations/001_init.sql` — existing schema, GEOGRAPHY column with GIST index already present

### Secondary (MEDIUM confidence)
- `https://docs.rs/tower_governor/latest/tower_governor/` — tower-governor 0.8.0 custom key extractor pattern (compared and rejected in favour of direct governor usage)
- WebSearch cross-referenced with docs.rs: geohash 0.13.1 as the canonical geohash crate

### Tertiary (LOW confidence)
- None — all key claims verified against official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all library versions verified against docs.rs
- Architecture: HIGH — follows existing codebase patterns (AppState, tokio::spawn, runtime SQLx queries)
- Pitfalls: HIGH — derived from direct code inspection of existing codebase + official docs
- Schema: HIGH — consistent with existing migration pattern and PostGIS column types

**Research date:** 2026-03-13
**Valid until:** 2026-06-13 (stable libraries; governor/geohash/sha2 are not fast-moving)
