use axum::{
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::{net::SocketAddr, sync::Arc};
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod db;
mod errors;
mod handlers;
mod models;

use config::Config;

#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<sqlx::PgPool>,
    pub uploads_dir: String,
    pub api_base_url: String,
}

#[tokio::main]
async fn main() {
    // Load .env if present (silently ignore if missing)
    let _ = dotenvy::dotenv();

    // Init tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "bengaluru_walkability_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
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

    let state = AppState {
        pool: Arc::new(pool),
        uploads_dir: config.uploads_dir.clone(),
        api_base_url,
    };

    // CORS
    let cors = CorsLayer::new()
        .allow_origin(
            config
                .cors_origin
                .parse::<axum::http::HeaderValue>()
                .unwrap_or_else(|_| "http://localhost:3000".parse().unwrap()),
        )
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // API routes
        .route("/health", get(handlers::health::health))
        .route("/api/reports", post(handlers::reports::create_report))
        .route("/api/reports", get(handlers::reports::list_reports))
        .route("/api/reports/:id", get(handlers::reports::get_report))
        // Static file serving for uploaded images
        .nest_service("/uploads", ServeDir::new(&config.uploads_dir))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
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
