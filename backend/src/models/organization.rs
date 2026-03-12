use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

/// Raw database row — maps to the `organizations` table.
#[derive(Debug, Clone, FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub org_type: String,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// JSON response shape for organization data.
#[derive(Debug, Serialize)]
pub struct OrganizationResponse {
    pub id: Uuid,
    pub name: String,
    pub org_type: String,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Organization> for OrganizationResponse {
    fn from(o: Organization) -> Self {
        OrganizationResponse {
            id: o.id,
            name: o.name,
            org_type: o.org_type,
            parent_id: o.parent_id,
            created_at: o.created_at,
            updated_at: o.updated_at,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    /// parent_id must be Option<Uuid> to support the root-level GBA node.
    #[test]
    fn organization_parent_id_is_optional() {
        let o = Organization {
            id: Uuid::nil(),
            name: "GBA".to_string(),
            org_type: "gba".to_string(),
            parent_id: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        assert!(
            o.parent_id.is_none(),
            "Root-level organization must have parent_id = None"
        );
    }

    /// Child organization can have a parent_id set.
    #[test]
    fn organization_with_parent_id() {
        let parent_id = Uuid::new_v4();
        let o = Organization {
            id: Uuid::nil(),
            name: "South Zone".to_string(),
            org_type: "zone".to_string(),
            parent_id: Some(parent_id),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        assert_eq!(o.parent_id, Some(parent_id));
    }

    /// OrganizationResponse is created from Organization via From trait.
    #[test]
    fn organization_response_from_organization() {
        let now = Utc::now();
        let id = Uuid::nil();
        let org = Organization {
            id,
            name: "BBMP".to_string(),
            org_type: "corporation".to_string(),
            parent_id: None,
            created_at: now,
            updated_at: now,
        };
        let resp = OrganizationResponse::from(org);
        assert_eq!(resp.id, id);
        assert_eq!(resp.name, "BBMP");
        assert_eq!(resp.org_type, "corporation");
        assert!(resp.parent_id.is_none());
    }

    /// OrganizationResponse must be serializable.
    #[test]
    fn organization_response_is_serializable() {
        let now = Utc::now();
        let resp = OrganizationResponse {
            id: Uuid::nil(),
            name: "Test Org".to_string(),
            org_type: "corporation".to_string(),
            parent_id: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&resp).expect("OrganizationResponse must serialize");
        assert!(json.contains("org_type"), "JSON must contain org_type field");
        assert!(json.contains("parent_id"), "JSON must contain parent_id field");
    }
}
