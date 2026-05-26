-- no-transaction
-- Rationale: ALTER TYPE ADD VALUE cannot run inside a transaction block (Postgres 10+).
-- See 03-RESEARCH.md "Pattern 1: Migration 008 (no-transaction)" and Pitfall 1.
--
-- This migration implements the Phase 03 government triage workflow schema:
--   D-03, D-04, D-05: rename report_status enum values + add new values
--   D-08: add assigned_org_id column to reports for internal org routing
--   D-13, D-15: add resolution_photo_path, resolution_notes columns to reports
--   Pitfall 2: DROP + recreate partial index (old predicate references 'submitted')
--
-- WARNING: Do not add BEGIN/COMMIT here. sqlx::migrate! honours -- no-transaction
-- and will not wrap this file in a transaction. ALTER TYPE ADD VALUE fails inside
-- a transaction on any Postgres version.

-- ── Rename existing enum values (D-04) ───────────────────────────────────────

ALTER TYPE report_status RENAME VALUE 'submitted'    TO 'open';
ALTER TYPE report_status RENAME VALUE 'under_review' TO 'acknowledged';
-- 'resolved' is unchanged (D-04)

-- ── Add new enum values (D-03, D-04, D-05) ───────────────────────────────────
-- Order: open → acknowledged → assigned → in_progress → resolved → closed

ALTER TYPE report_status ADD VALUE 'assigned'    AFTER 'acknowledged';
ALTER TYPE report_status ADD VALUE 'in_progress' AFTER 'assigned';
ALTER TYPE report_status ADD VALUE 'closed'      AFTER 'resolved';

-- ── Partial index fix (Pitfall 2) ─────────────────────────────────────────────
-- The old index predicate references status = 'submitted' which no longer exists
-- after the rename. DROP and recreate with the new value name 'open'.

DROP INDEX IF EXISTS idx_reports_submitted_created;
CREATE INDEX idx_reports_open_created ON reports(created_at DESC) WHERE status = 'open';

-- ── New reports columns (D-08, D-13, D-15) ───────────────────────────────────

ALTER TABLE reports
  ADD COLUMN resolution_photo_path TEXT,
  ADD COLUMN resolution_notes TEXT,
  ADD COLUMN assigned_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Index for org-assignment queries (plan 03-02 handler needs this) ─────────────
CREATE INDEX idx_reports_assigned_org ON reports(assigned_org_id)
  WHERE assigned_org_id IS NOT NULL;
