/// Migration 004 SQL validation tests.
/// These tests validate the SQL file as a string — no live DB required.
#[cfg(test)]
mod tests {
    #[test]
    fn migration_004_has_wards_table() {
        let sql = include_str!("../../migrations/004_ward_boundaries.sql");
        assert!(
            sql.contains("CREATE TABLE wards"),
            "004 migration must CREATE TABLE wards"
        );
        assert!(
            sql.contains("GEOMETRY(MULTIPOLYGON, 4326)"),
            "wards.boundary must be GEOMETRY(MULTIPOLYGON, 4326)"
        );
        assert!(
            sql.contains("USING GIST"),
            "wards must have a GIST index on boundary"
        );
        assert!(
            sql.contains("enforce_srid_boundary"),
            "wards must have CONSTRAINT enforce_srid_boundary"
        );
        assert!(
            sql.contains("ward_id UUID REFERENCES wards(id)"),
            "reports must gain a ward_id FK referencing wards(id)"
        );
    }

    #[test]
    fn migration_004_has_369_ward_inserts() {
        let sql = include_str!("../../migrations/004_ward_boundaries.sql");
        let count = sql.matches("INSERT INTO wards").count();
        assert_eq!(
            count, 369,
            "Expected 369 ward inserts, got {count}"
        );
    }

    #[test]
    fn migration_004_uses_st_multi_cast() {
        let sql = include_str!("../../migrations/004_ward_boundaries.sql");
        assert!(
            sql.contains("ST_Multi(ST_GeomFromGeoJSON"),
            "Ward inserts must use ST_Multi(ST_GeomFromGeoJSON(...))"
        );
    }

    #[test]
    fn migration_004_has_gist_index_on_boundary() {
        let sql = include_str!("../../migrations/004_ward_boundaries.sql");
        assert!(
            sql.contains("idx_wards_boundary"),
            "GIST index idx_wards_boundary must be created"
        );
    }

    #[test]
    fn migration_004_has_reports_ward_id_index() {
        let sql = include_str!("../../migrations/004_ward_boundaries.sql");
        assert!(
            sql.contains("idx_reports_ward_id"),
            "Index idx_reports_ward_id must be created on reports(ward_id)"
        );
    }

    #[test]
    fn migration_004_has_on_delete_set_null() {
        let sql = include_str!("../../migrations/004_ward_boundaries.sql");
        assert!(
            sql.contains("ON DELETE SET NULL"),
            "ward_id FK must use ON DELETE SET NULL"
        );
    }
}
