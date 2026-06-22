use axum::{
    extract::{Query, State},
    http::header,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{db::{admin_queries, queries}, errors::AppError, AppState};

#[derive(Deserialize)]
pub struct WardLookupQuery {
    pub lat: f64,
    pub lng: f64,
}

/// Public response for a successful ward lookup.
/// Only exposes ward_number and ward_name — no internal UUID or corporation.
#[derive(Serialize)]
pub struct WardLookupResponse {
    pub ward_number: i32,
    pub ward_name: String,
}

/// GET /api/wards/lookup?lat={lat}&lng={lng}
///
/// Public, no-auth endpoint. Returns the BBMP ward that contains the given
/// coordinate, or 404 when the point falls outside all ward polygons.
/// Errors from PostGIS degrade to 500 — the client must handle gracefully.
pub async fn ward_lookup(
    State(state): State<AppState>,
    Query(params): Query<WardLookupQuery>,
) -> Result<Json<WardLookupResponse>, AppError> {
    let result = queries::get_ward_label_for_point(&state.pool, params.lat, params.lng).await?;
    match result {
        Some((ward_number, ward_name)) => Ok(Json(WardLookupResponse {
            ward_number,
            ward_name,
        })),
        None => Err(AppError::NotFound),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 07-02: Public ward boundary GeoJSON endpoint (TRIAGE-04, D-14/D-22/D-23)
// Security: T-07-04 — public payload contains only ward_name/ward_number + geometry
//           T-07-SC — no new crates; axum header utilities already in tree
// ─────────────────────────────────────────────────────────────────────────────

/// GET /api/wards/boundaries
///
/// Public, unauthenticated endpoint. Returns all 369 ward polygons as a GeoJSON
/// FeatureCollection. Each Feature's properties includes ward_name and ward_number
/// only — no report counts, no PII, no admin-specific data (T-07-04, ASVS V4).
///
/// Response carries Cache-Control: public, max-age=86400 (24h, D-22).
/// No rate limit applied — 24h nginx + Cloudflare edge caching means origin
/// hit rate is negligible (D-23).
///
/// This handler uses the same get_ward_boundaries DB function as the admin
/// choropleth, but strips unresolved_count from the public-facing properties.
pub async fn public_get_ward_boundaries(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, AppError> {
    let rows = admin_queries::get_ward_boundaries(&state.pool).await?;

    // Assemble a GeoJSON FeatureCollection.
    // Public payload: ward_name + ward_number + geometry ONLY (T-07-04).
    // No unresolved_count, no internal UUIDs exposed.
    let features: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let geometry: serde_json::Value = row
                .boundary_geojson
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(serde_json::Value::Null);

            serde_json::json!({
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "ward_name": row.ward_name,
                    "ward_number": row.ward_number,
                }
            })
        })
        .collect();

    let body = serde_json::json!({
        "type": "FeatureCollection",
        "features": features,
    });

    // Cache-Control: public, max-age=86400 (24h) per D-22.
    // Cloudflare respects Cache-Control: public and caches at the edge.
    Ok((
        [(header::CACHE_CONTROL, "public, max-age=86400")],
        Json(body),
    ))
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests — no database required
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    /// WardLookupResponse must serialize to JSON with the expected field names.
    #[test]
    fn ward_lookup_response_serializes() {
        let resp = WardLookupResponse {
            ward_number: 84,
            ward_name: "Shivajinagar".to_string(),
        };
        let json = serde_json::to_string(&resp).expect("must serialize");
        assert!(
            json.contains("ward_number"),
            "JSON must contain ward_number"
        );
        assert!(json.contains("ward_name"), "JSON must contain ward_name");
        assert!(
            json.contains("84"),
            "JSON must contain the ward number value"
        );
        assert!(
            json.contains("Shivajinagar"),
            "JSON must contain the ward name value"
        );
    }

    /// WardLookupQuery must parse lat/lng from query string parameters.
    #[test]
    fn ward_lookup_query_fields() {
        // Compile-time check: struct has lat and lng as f64
        let q = WardLookupQuery {
            lat: 12.9716,
            lng: 77.5946,
        };
        assert!((q.lat - 12.9716).abs() < 1e-6);
        assert!((q.lng - 77.5946).abs() < 1e-6);
    }
}
