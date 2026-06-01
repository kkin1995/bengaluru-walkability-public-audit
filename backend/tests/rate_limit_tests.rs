// backend/tests/rate_limit_tests.rs
//
// Behavioral tests for the public GeoJSON endpoint rate limiter (EXPORT-03).
//
// These tests do NOT require a live database or HTTP server. They exercise
// governor::DefaultKeyedRateLimiter directly using the same quota configuration
// that main.rs applies to AppState.geojson_rate_limiter.
//
// Requirements covered:
//   EXPORT-03   — public /api/reports.geojson allows 2 req/min per IP; the 3rd
//                 request within the same minute must be rejected with a rate-limit
//                 error (maps to AppError::RateLimited → HTTP 429)
//   T-04-02-02  — governor keyed limiter returns Err on burst exceeding quota
//
// Test type: Unit (pure governor API, no DB or runtime required). Priority: P0.
//
// ── Implementation agent instructions ─────────────────────────────────────────
// Do NOT modify these tests. The tests are the behavioural contract.
// If a test appears incorrect, document the concern and request a review.
// ─────────────────────────────────────────────────────────────────────────────

use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Third request within same minute is rejected
// ─────────────────────────────────────────────────────────────────────────────

/// EXPORT-03 — The public GeoJSON rate limiter must allow the first 2 requests
/// from a given IP key within a minute window, and reject the 3rd request with
/// an Err(NotUntil<_>).
///
/// This mirrors AppState.geojson_rate_limiter initialised in main.rs as:
///   governor::Quota::per_minute(NonZeroU32::new(2).unwrap())
///   governor::RateLimiter::keyed(geojson_quota)
///
/// The handler in stats.rs calls:
///   state.geojson_rate_limiter.check_key(&client_ip).is_err()
/// and returns AppError::RateLimited on Err, which axum maps to HTTP 429.
#[test]
fn geojson_rate_limiter_rejects_third_request_in_burst() {
    // Arrange — same quota as main.rs line 139:
    //   governor::Quota::per_minute(std::num::NonZeroU32::new(2).unwrap())
    let quota = Quota::per_minute(NonZeroU32::new(2).unwrap());
    let limiter = RateLimiter::keyed(quota);

    let ip = "192.0.2.1".to_string(); // TEST-NET-1; never a real address

    // Act + Assert — first two requests must be allowed
    let result1 = limiter.check_key(&ip);
    assert!(
        result1.is_ok(),
        "Request 1 from {} must be allowed by a fresh 2 req/min limiter; got: {:?}",
        ip,
        result1
    );

    let result2 = limiter.check_key(&ip);
    assert!(
        result2.is_ok(),
        "Request 2 from {} must be allowed within the 2 req/min quota; got: {:?}",
        ip,
        result2
    );

    // Act + Assert — third request must be rejected (burst exhausted)
    let result3 = limiter.check_key(&ip);
    assert!(
        result3.is_err(),
        "Request 3 from {} must be REJECTED (rate limit exceeded); \
         the handler maps this to HTTP 429. got: Ok(()) — rate limiter is not enforcing the quota",
        ip
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Different IPs have independent quota buckets
// ─────────────────────────────────────────────────────────────────────────────

/// EXPORT-03 — The rate limiter must track quota independently per IP key.
/// Exhausting the limit for IP-A must not affect the quota available to IP-B.
#[test]
fn geojson_rate_limiter_per_ip_isolation() {
    let quota = Quota::per_minute(NonZeroU32::new(2).unwrap());
    let limiter = RateLimiter::keyed(quota);

    let ip_a = "192.0.2.10".to_string();
    let ip_b = "192.0.2.20".to_string();

    // Exhaust ip_a's quota
    let _ = limiter.check_key(&ip_a);
    let _ = limiter.check_key(&ip_a);
    let rejected = limiter.check_key(&ip_a);
    assert!(
        rejected.is_err(),
        "ip_a must be rate-limited after 2 requests; got Ok(())"
    );

    // ip_b must still have a full quota unaffected by ip_a's exhaustion
    let ip_b_result1 = limiter.check_key(&ip_b);
    assert!(
        ip_b_result1.is_ok(),
        "ip_b request 1 must be allowed — quota is per-IP, not global; got: {:?}",
        ip_b_result1
    );

    let ip_b_result2 = limiter.check_key(&ip_b);
    assert!(
        ip_b_result2.is_ok(),
        "ip_b request 2 must be allowed — 2 req/min quota not yet exhausted; got: {:?}",
        ip_b_result2
    );
}
