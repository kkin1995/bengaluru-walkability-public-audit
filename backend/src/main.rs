use axum::{
    routing::{delete, get, patch, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::{net::SocketAddr, sync::Arc};
use tower_http::{
    cors::CorsLayer,
    services::ServeDir,
    trace::TraceLayer,
};

mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;

use config::Config;

async fn request_id_middleware(
    request: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_owned();

    let span = tracing::info_span!("http_request", request_id = %request_id);
    let _enter = span.enter();

    let mut response = next.run(request).await;

    if let Ok(val) = axum::http::HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", val);
    }

    response
}

#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<sqlx::PgPool>,
    pub uploads_dir: String,
    pub api_base_url: String,
    /// HMAC-SHA256 key bytes for signing and verifying admin_token JWTs.
    pub jwt_secret: Arc<Vec<u8>>,
}

#[tokio::main]
async fn main() {
    // Load .env if present (silently ignore if missing)
    let _ = dotenvy::dotenv();

    // Init tracing
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "bengaluru_walkability_backend=info,tower_http=info".into()),
        )
        .init();

    let config = Config::from_env();

    // Ensure uploads directory exists
    std::fs::create_dir_all(&config.uploads_dir)
        .expect("Failed to create uploads directory");

    // Connect to PostgreSQL
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to database");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run database migrations");

    tracing::info!("Database migrations applied");

    let api_base_url = config.public_url.clone();

    let jwt_secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET environment variable must be set");

    if jwt_secret.len() < 32 {
        panic!("JWT_SECRET must be at least 32 characters");
    }

    let jwt_secret = jwt_secret.into_bytes();

    let state = AppState {
        pool: Arc::new(pool),
        uploads_dir: config.uploads_dir.clone(),
        api_base_url,
        jwt_secret: Arc::new(jwt_secret),
    };

    // CORS — allow_credentials(true) is required for the admin_token cookie to be
    // sent cross-origin from the dashboard. Note: allow_credentials(true) is
    // incompatible with allow_origin(Any), so we use the specific origin above.
    let cors = CorsLayer::new()
        .allow_origin(
            config
                .cors_origin
                .parse::<axum::http::HeaderValue>()
                .unwrap_or_else(|_| "http://localhost:3000".parse().unwrap()),
        )
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([axum::http::header::CONTENT_TYPE, axum::http::header::AUTHORIZATION])
        .allow_credentials(true);

    use handlers::admin::{
        admin_create_user, admin_deactivate_user, admin_delete_report, admin_get_report,
        admin_get_stats, admin_list_reports, admin_list_users, admin_login, admin_logout,
        admin_me, admin_update_report_status,
    };
    use middleware::auth::require_auth;

    // Wrap state in Arc so the admin middleware and handlers can share it.
    let arc_state = std::sync::Arc::new(state.clone());

    // Unprotected admin route (no JWT required).
    let admin_auth_router = Router::new()
        .route("/api/admin/auth/login", post(admin_login))
        .with_state(arc_state.clone());

    // Protected admin routes — JWT cookie required for all.
    let admin_protected_router = Router::new()
        .route("/api/admin/auth/logout", post(admin_logout))
        .route("/api/admin/auth/me", get(admin_me))
        .route("/api/admin/reports", get(admin_list_reports))
        .route("/api/admin/reports/:id", get(admin_get_report))
        .route("/api/admin/reports/:id/status", patch(admin_update_report_status))
        .route("/api/admin/reports/:id", delete(admin_delete_report))
        .route("/api/admin/stats", get(admin_get_stats))
        .route(
            "/api/admin/users",
            get(admin_list_users).post(admin_create_user),
        )
        .route("/api/admin/users/:id", delete(admin_deactivate_user))
        .layer(axum::middleware::from_fn_with_state(
            arc_state.clone(),
            require_auth,
        ))
        .with_state(arc_state.clone());

    let app = Router::new()
        // Public API routes
        .route("/health", get(handlers::health::health))
        .route("/api/reports", post(handlers::reports::create_report))
        .route("/api/reports", get(handlers::reports::list_reports))
        .route("/api/reports/:id", get(handlers::reports::get_report))
        // Admin routes (auth + protected)
        .merge(admin_auth_router)
        .merge(admin_protected_router)
        // Static file serving for uploaded images
        .nest_service("/uploads", ServeDir::new(&config.uploads_dir))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(request_id_middleware))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}
