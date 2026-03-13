use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Not found")]
    NotFound,

    #[error("Bad request: {0}")]
    BadRequest(String),

    // Kept for future use — callers will construct this variant when
    // non-DB internal failures need a structured error response.
    #[allow(dead_code)]
    #[error("Internal error: {0}")]
    Internal(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// HTTP 401 — missing or invalid authentication credentials.
    /// Used by the JWT middleware when the `admin_token` cookie is absent,
    /// malformed, signed with the wrong secret, or expired.
    #[error("Unauthorized")]
    Unauthorized,

    /// HTTP 403 — authenticated but insufficient role.
    /// Used by `require_role` when the caller's role does not satisfy the
    /// required role for the requested endpoint.
    #[error("Forbidden")]
    Forbidden,

    /// HTTP 409 — resource already exists (e.g. duplicate email on user create).
    #[error("Conflict: {0}")]
    Conflict(String),

    /// HTTP 429 — rate limit exceeded for this IP+location cell.
    /// Used by create_report when the same IP+geohash-6 cell submits more
    /// than 2 reports per hour.
    #[error("Rate limited: {0}")]
    RateLimited(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::Database(e) => {
                tracing::error!("Database error: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
            }
            AppError::NotFound => (StatusCode::NOT_FOUND, "Not found".to_string()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {msg}");
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
            AppError::Io(e) => {
                tracing::error!("IO error: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, "IO error".to_string())
            }
            AppError::Unauthorized => {
                (StatusCode::UNAUTHORIZED, "Unauthorized".to_string())
            }
            AppError::Forbidden => {
                (StatusCode::FORBIDDEN, "Forbidden".to_string())
            }
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            AppError::RateLimited(msg) => (StatusCode::TOO_MANY_REQUESTS, msg.clone()),
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}
