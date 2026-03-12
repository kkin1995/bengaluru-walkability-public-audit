use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

/// Raw database row — maps to the `wards` table.
#[derive(Debug, Clone, FromRow)]
pub struct Ward {
    pub id: Uuid,
    pub ward_number: i32,
    pub ward_name: String,
    pub corporation: String,
    pub created_at: DateTime<Utc>,
}

/// JSON response shape for ward data.
#[derive(Debug, Serialize)]
pub struct WardResponse {
    pub id: Uuid,
    pub ward_number: i32,
    pub ward_name: String,
    pub corporation: String,
    pub created_at: DateTime<Utc>,
}

impl From<Ward> for WardResponse {
    fn from(w: Ward) -> Self {
        WardResponse {
            id: w.id,
            ward_number: w.ward_number,
            ward_name: w.ward_name,
            corporation: w.corporation,
            created_at: w.created_at,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    /// Compile-time contract: Ward struct must have all required fields.
    /// If any field is missing or has a wrong type, this function will not compile.
    #[test]
    fn ward_struct_fields_compile() {
        let _: fn(Uuid, i32, String, String, DateTime<Utc>) -> Ward =
            |id, wn, wname, corp, ca| Ward {
                id,
                ward_number: wn,
                ward_name: wname,
                corporation: corp,
                created_at: ca,
            };
    }

    /// WardResponse is created from Ward via From trait.
    #[test]
    fn ward_response_from_ward() {
        let now = Utc::now();
        let id = Uuid::nil();
        let ward = Ward {
            id,
            ward_number: 42,
            ward_name: "Shivajinagar".to_string(),
            corporation: "BBMP".to_string(),
            created_at: now,
        };
        let response = WardResponse::from(ward);
        assert_eq!(response.id, id);
        assert_eq!(response.ward_number, 42);
        assert_eq!(response.ward_name, "Shivajinagar");
        assert_eq!(response.corporation, "BBMP");
    }

    /// WardResponse must be serializable (derive check via serde_json round-trip).
    #[test]
    fn ward_response_is_serializable() {
        let now = Utc::now();
        let resp = WardResponse {
            id: Uuid::nil(),
            ward_number: 1,
            ward_name: "Test Ward".to_string(),
            corporation: "BBMP".to_string(),
            created_at: now,
        };
        let json = serde_json::to_string(&resp).expect("WardResponse must serialize to JSON");
        assert!(json.contains("ward_name"), "JSON must contain ward_name field");
        assert!(json.contains("corporation"), "JSON must contain corporation field");
    }
}
