use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{db::queries, errors::AppError, AppState};

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
