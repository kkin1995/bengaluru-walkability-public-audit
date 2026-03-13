-- Migration 007: Anti-abuse schema additions
--
-- Adds columns to support:
--   - Photo deduplication (photo_hash, duplicate_of_id, duplicate_count, duplicate_confidence)
--   - Rate limiting audit trail (submitter_ip)
--
-- All columns are nullable / have defaults so existing rows are unaffected.

ALTER TABLE reports
  ADD COLUMN photo_hash         TEXT,
  ADD COLUMN duplicate_of_id    UUID REFERENCES reports(id) ON DELETE SET NULL,
  ADD COLUMN duplicate_count    INT NOT NULL DEFAULT 0,
  ADD COLUMN duplicate_confidence TEXT CHECK (duplicate_confidence IN ('low', 'high')) DEFAULT 'low',
  ADD COLUMN submitter_ip       TEXT;

CREATE UNIQUE INDEX idx_reports_photo_hash ON reports (photo_hash) WHERE photo_hash IS NOT NULL;
CREATE INDEX idx_reports_dedup_unlinked ON reports (created_at DESC) WHERE duplicate_of_id IS NULL;
