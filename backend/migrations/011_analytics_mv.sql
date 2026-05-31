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
