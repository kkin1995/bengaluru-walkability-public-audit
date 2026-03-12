/// Migration 005 SQL validation tests.
/// These tests validate the SQL file as a string — no live DB required.
#[cfg(test)]
mod tests {
    #[test]
    fn migration_005_has_organizations_table() {
        let sql = include_str!("../../migrations/005_organizations.sql");
        assert!(
            sql.contains("CREATE TABLE organizations"),
            "005 migration must CREATE TABLE organizations"
        );
        assert!(
            sql.contains("parent_id   UUID    REFERENCES organizations(id)"),
            "organizations must have a nullable parent_id FK (self-referential)"
        );
        assert!(
            sql.contains("org_type    TEXT    NOT NULL"),
            "organizations must have org_type TEXT NOT NULL"
        );
        assert!(
            sql.contains("idx_organizations_parent_id"),
            "Index idx_organizations_parent_id must be created"
        );
        assert!(
            sql.contains("touch_updated_at"),
            "organizations must have touch_updated_at trigger"
        );
    }

    #[test]
    fn migration_005_adds_org_id_to_admin_users() {
        let sql = include_str!("../../migrations/005_organizations.sql");
        assert!(
            sql.contains("ADD COLUMN org_id UUID REFERENCES organizations(id)"),
            "admin_users must gain org_id FK referencing organizations(id)"
        );
        assert!(
            sql.contains("idx_admin_users_org_id"),
            "Index idx_admin_users_org_id must be created"
        );
    }

    #[test]
    fn migration_005_has_on_delete_restrict_for_parent() {
        let sql = include_str!("../../migrations/005_organizations.sql");
        assert!(
            sql.contains("ON DELETE RESTRICT"),
            "parent_id FK must use ON DELETE RESTRICT (cannot delete parent with children)"
        );
    }

    #[test]
    fn migration_005_trigger_fires_before_update() {
        let sql = include_str!("../../migrations/005_organizations.sql");
        assert!(
            sql.contains("BEFORE UPDATE ON organizations"),
            "touch_updated_at trigger must fire BEFORE UPDATE ON organizations"
        );
    }

    #[test]
    fn migration_005_org_id_on_delete_set_null() {
        let sql = include_str!("../../migrations/005_organizations.sql");
        // admin_users.org_id: admin can be deactivated without removing org
        // The FK should be nullable with ON DELETE SET NULL
        assert!(
            sql.contains("ON DELETE SET NULL"),
            "org_id FK must use ON DELETE SET NULL"
        );
    }
}
