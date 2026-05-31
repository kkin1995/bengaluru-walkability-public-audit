// backend/src/lib.rs
//
// Library target for integration tests.
//
// Exposes the same module tree as main.rs so that tests in backend/tests/
// can import helpers like:
//   bengaluru_walkability_backend::db::admin_queries::export_csv_sql_fragment
//   bengaluru_walkability_backend::db::admin_queries::format_csv_date
//   bengaluru_walkability_backend::db::admin_queries::csv_escape
//
// Production binary: src/main.rs (declares its own module tree independently)
// Test consumers:    backend/tests/export_tests.rs

pub mod config;
pub mod db;
pub mod errors;
pub mod handlers;
pub mod middleware;
pub mod migrations_tests;
pub mod models;

// AppState is declared here for handlers that reference it via crate::AppState.
// The binary (main.rs) declares its own AppState; the library version exists
// solely to satisfy compile-time references from the shared module files.
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<sqlx::PgPool>,
    pub uploads_dir: String,
    pub api_base_url: String,
    pub jwt_secret: Arc<Vec<u8>>,
    pub jwt_session_hours: u64,
    pub rate_limiter: Arc<governor::DefaultKeyedRateLimiter<String>>,
    /// Per-IP rate limiter for public GeoJSON endpoint — 2 req/min (EXPORT-03/D-18).
    pub geojson_rate_limiter: Arc<governor::DefaultKeyedRateLimiter<String>>,
}
