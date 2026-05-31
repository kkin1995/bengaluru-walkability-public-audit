-- Migration 013: Add OR DELETE to the materialized view refresh trigger
--
-- Migration 011 created trg_refresh_public_stats as AFTER INSERT OR UPDATE ON reports.
-- DELETE events were not included, so deleting a report never refreshed public_stats_mv.
-- The total_reports count in the public stats endpoint remained stale (over-counted) until
-- the next INSERT or UPDATE triggered a refresh.
--
-- This migration drops and recreates the trigger to include DELETE so that all three
-- DML operations keep the materialized view consistent.

DROP TRIGGER IF EXISTS trg_refresh_public_stats ON reports;
CREATE TRIGGER trg_refresh_public_stats
AFTER INSERT OR UPDATE OR DELETE ON reports
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_public_stats_mv();
