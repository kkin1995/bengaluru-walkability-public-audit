-- Migration: 005_organizations.sql
-- Creates the GBA organization hierarchy table (self-referential adjacency list)
-- and links admin users to organizations for report scoping.
-- Org table is left empty at migration time — data seeding happens out-of-band
-- after GBA org structure is confirmed (see STATE.md blocker note).

CREATE TABLE organizations (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  org_type    TEXT    NOT NULL CHECK (org_type IN ('gba', 'corporation', 'ward_office')),
  parent_id   UUID    REFERENCES organizations(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_parent_id ON organizations(parent_id);

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE admin_users
  ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_admin_users_org_id ON admin_users(org_id);
