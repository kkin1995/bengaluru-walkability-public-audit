// backend/src/handlers/stats.rs
//
// Public (unauthenticated) stats and open-data GeoJSON handlers.
//
// Endpoints:
//   GET /api/stats           — aggregate stats from public_stats_mv (ANALYTICS-01)
//   GET /api/reports.geojson — streaming PII-free GeoJSON (EXPORT-03)
//
// Security:
//   - /api/reports.geojson is rate-limited per-IP via AppState.geojson_rate_limiter
//     (2 req/min, governor keyed limiter) — defense-in-depth alongside nginx zone.
//   - Only D-17 whitelist columns are included; no PII is ever emitted.
//   - Coordinates are rounded to 3 decimal places (~111 m) to obscure exact locations.

use axum::{
    body::Body,
    extract::{ConnectInfo, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
    Json,
};
use bytes::Bytes;
use futures::StreamExt;
use serde::Serialize;
use std::{net::SocketAddr, sync::Arc};
use tokio_stream::wrappers::ReceiverStream;

use crate::{db::queries, errors::AppError, AppState};

#[derive(Serialize)]
pub struct PublicStatsResponse {
    pub total_reports: i64,
    pub resolved_count: i64,
    pub top_categories: serde_json::Value,
}

/// GET /api/stats — reads from public_stats_mv; no auth required.
pub async fn public_get_stats(
    State(state): State<AppState>,
) -> Result<Json<PublicStatsResponse>, AppError> {
    let row = queries::get_public_stats(&state.pool).await?;
    Ok(Json(PublicStatsResponse {
        total_reports: row.total_reports,
        resolved_count: row.resolved_count,
        top_categories: row.top_categories.unwrap_or(serde_json::json!([])),
    }))
}

/// GET /api/reports.geojson — streaming PII-free FeatureCollection; no auth required.
///
/// Rate limited: 2 req/min per IP (governor keyed limiter on AppState).
/// Coordinates rounded to 3 decimal places (~111 m) by queries::round3().
pub async fn public_get_geojson(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    // IP extraction: X-Real-IP (nginx) > TCP peer address
    let client_ip = headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| peer.ip().to_string());

    // Governor per-IP rate check — 2 req/min
    if state.geojson_rate_limiter.check_key(&client_ip).is_err() {
        return Err(AppError::RateLimited(
            "Public GeoJSON rate limit exceeded (2 req/min per IP)".to_string(),
        ));
    }

    let pool = Arc::clone(&state.pool);
    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Bytes, std::io::Error>>(32);

    tokio::spawn(async move {
        if tx
            .send(Ok(Bytes::from_static(
                b"{\"type\":\"FeatureCollection\",\"features\":[\n",
            )))
            .await
            .is_err()
        {
            return;
        }

        let mut rows = sqlx::query(queries::PUBLIC_GEOJSON_SQL).fetch(&*pool);
        let mut first = true;

        while let Some(row_result) = rows.next().await {
            match row_result {
                Ok(row) => {
                    use sqlx::Row;
                    let id: uuid::Uuid = row.get("id");
                    let category: String = row.get("category");
                    let severity: String = row.get("severity");
                    let status: String = row.get("status");
                    let ward_name: Option<String> = row.get("ward_name");
                    let corporation: Option<String> = row.get("corporation");
                    let created_at: chrono::DateTime<chrono::Utc> = row.get("created_at");
                    let description: Option<String> = row.get("description");
                    let resolution_photo_path: Option<String> = row.get("resolution_photo_path");
                    let resolution_notes: Option<String> = row.get("resolution_notes");
                    let resolved_at: Option<chrono::DateTime<chrono::Utc>> =
                        row.get("resolved_at");
                    let latitude: f64 = row.get("latitude");
                    let longitude: f64 = row.get("longitude");

                    // [longitude, latitude] — RFC 7946 coordinate order
                    // Rounded to 3dp (~111 m) for privacy (D-17)
                    let feature = serde_json::json!({
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [queries::round3(longitude), queries::round3(latitude)]
                        },
                        "properties": {
                            "id": id,
                            "category": category,
                            "severity": severity,
                            "status": status,
                            "ward_name": ward_name,
                            "corporation": corporation,
                            "created_at": created_at,
                            "description": description,
                            "resolution_photo_path": resolution_photo_path,
                            "resolution_notes": resolution_notes,
                            "resolved_at": resolved_at,
                        }
                    });

                    let mut chunk = if first {
                        first = false;
                        feature.to_string()
                    } else {
                        format!(",{}", feature)
                    };
                    chunk.push('\n');

                    if tx.send(Ok(Bytes::from(chunk))).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    let _ = tx
                        .send(Err(std::io::Error::other(e.to_string())))
                        .await;
                    break;
                }
            }
        }

        let _ = tx.send(Ok(Bytes::from_static(b"]}"))).await;
    });

    let stream = ReceiverStream::new(rx);
    let body = Body::from_stream(stream);

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/geo+json")
        .body(body)
        .map_err(|e| AppError::Internal(e.to_string()))
}
