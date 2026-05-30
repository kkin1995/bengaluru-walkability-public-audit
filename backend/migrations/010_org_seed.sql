-- 010_org_seed.sql
--
-- Per D-12 (locked decision): placeholder GBA org structure based on publicly available
-- GBA 2025 reorganization announcements.
-- All rows here are PLACEHOLDER — update with ground-truth structure once GBA finalizes
-- corporation/ward-office boundaries.
-- Without this seed, OrgAssignPanel (Plan 03-03) renders empty dropdowns and
-- WFLOW-03 is functionally undeliverable.
--
-- Structure seeded (6 rows):
--   1 GBA root row (org_type='gba', parent_id=NULL)
--   5 corporation rows (org_type='corporation', parent_id=GBA.id):
--     - Bengaluru Central Corporation
--     - Bengaluru North Corporation
--     - Bengaluru East Corporation
--     - Bengaluru South Corporation
--     - Bengaluru West Corporation
--
-- Ward-office rows are OUT OF SCOPE for this migration (D-11):
--   GBA has not finalized ward office boundaries as of 2026-05-25.
--   OrgAssignPanel falls back to corporation-level assignment when no ward office exists.
--
-- Idempotency: the DO block guards against re-seeding on a non-fresh DB.
-- sqlx::migrate! also prevents re-application via its migration tracker, providing
-- belt-and-suspenders protection (T-03-01-07).
--
-- pgcrypto (gen_random_uuid): confirmed installed in migration 001_init.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE org_type = 'gba') THEN
    WITH gba AS (
      INSERT INTO organizations (id, name, org_type, parent_id)
      VALUES (gen_random_uuid(), 'GBA', 'gba', NULL)
      RETURNING id
    )
    INSERT INTO organizations (id, name, org_type, parent_id)
    SELECT gen_random_uuid(), c.name, 'corporation', gba.id
    FROM gba, (VALUES
      ('Bengaluru Central Corporation'),
      ('Bengaluru North Corporation'),
      ('Bengaluru East Corporation'),
      ('Bengaluru South Corporation'),
      ('Bengaluru West Corporation')
    ) AS c(name);
  END IF;
END $$;
