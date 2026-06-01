-- Migration 011: Analytics materialized view and resolved_at column
--
-- This migration adds:
--   1. resolved_at TIMESTAMPTZ column to reports (EXPORT-01/D-13)
--      Required by plan 04-01 CSV export (D-13 column set).
--      Set by resolve_report() in admin_queries.rs when status becomes
--      'resolved' or 'closed'.
--
-- Plan 04-02 appends the materialized view + trigger sections to this file.
-- Comment placeholder below preserves file ordering for 04-02's append operation.
-- DO NOT add DDL after the ALTER TABLE until plan 04-02 runs.

-- ── Add resolved_at column (EXPORT-01, Pitfall 8) ────────────────────────────
-- This column is absent from the existing schema; without it the export query
-- will fail with "column reports.resolved_at does not exist".
-- IF NOT EXISTS guard makes the migration idempotent for re-runs.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- public_stats_mv + trigger appended by plan 04-02

-- ── Materialized view: public_stats_mv (ANALYTICS-01, D-19) ──────────────────
-- Aggregates total reports, resolved count, and top 3 categories for the public
-- /stats page and GET /api/stats endpoint. Single-row aggregate view — reads are
-- O(1) regardless of report table size.
--
-- status IN ('resolved','closed'): both terminal statuses count as resolved per
-- the Phase 03 6-value lifecycle (D-03). See 008_workflow.sql for enum values.

CREATE MATERIALIZED VIEW IF NOT EXISTS public_stats_mv AS
SELECT
    COUNT(*) AS total_reports,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS resolved_count,
    (
        SELECT json_agg(cat_row ORDER BY cnt DESC)
        FROM (
            SELECT category::TEXT AS category, COUNT(*) AS cnt
            FROM reports
            GROUP BY category
            ORDER BY cnt DESC
            LIMIT 3
        ) cat_row
    ) AS top_categories
FROM reports
WITH DATA;

-- REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY on a single-row aggregate view.
-- Without a unique index, CONCURRENTLY refresh is rejected by Postgres.
-- The constant expression (1) gives a unique index over the single row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_stats_mv ON public_stats_mv ((1));

-- ── Refresh trigger function (D-19) ──────────────────────────────────────────
-- Fires REFRESH MATERIALIZED VIEW CONCURRENTLY so readers see consistent data
-- without blocking. CONCURRENTLY requires the unique index above.
-- ACCEPTED RISK (T-04-06): at MVP scale (<10k reports) each refresh is <50ms.

CREATE OR REPLACE FUNCTION refresh_public_stats_mv()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public_stats_mv;
    RETURN NULL;
END;
$$;

-- FOR EACH STATEMENT: batch multiple-row inserts/updates into a single refresh
-- instead of N refreshes for N rows. Safe because the view aggregates all rows.
DROP TRIGGER IF EXISTS trg_refresh_public_stats ON reports;
CREATE TRIGGER trg_refresh_public_stats
AFTER INSERT OR UPDATE ON reports
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_public_stats_mv();
