-- Migration: 014_link_wards_to_organisations.sql
--
-- Purpose: Links each ward row to its matching corporation organization via ILIKE
-- on the corporation text column. Populates wards.org_id for all 369 ward rows so
-- that CORP_ANALYTICS_SQL (ANALYTICS-03) and the org-scoped admin visibility CTE
-- (WARD-03) can JOIN on wards.org_id = organizations.id and return data.
--
-- Idempotency: Re-running this migration leaves rows unchanged. The WHERE
-- wards.org_id IS NULL clause skips any ward already assigned — a ward already
-- linked will match the same org and produce the same value, but the IS NULL guard
-- prevents redundant writes.
--
-- Safety: wards.corporation contains only 5 trusted migration-seeded values
-- (Central / North / East / South / West from 010_org_seed.sql). These values are
-- never user input — they originate from the KML seed migration (009_wards_seed).
-- The ILIKE pattern '%' || wards.corporation || '%' matches the corporation name
-- fragment against the organizations.name column, using the same strategy as the
-- runtime get_org_for_ward function in backend/src/db/queries.rs.

UPDATE wards
SET org_id = o.id
FROM organizations o
WHERE o.org_type = 'corporation'
  AND o.name ILIKE '%' || wards.corporation || '%'
  AND wards.org_id IS NULL;
