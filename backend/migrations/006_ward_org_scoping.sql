-- Migration: 006_ward_org_scoping.sql
-- Adds org_id to wards so ward_office organizations can claim their wards.
-- Column is nullable; populated out-of-band after GBA org structure is confirmed.
-- When NULL (all wards initially), org-scoped admins see zero reports — correct
-- behavior per STATE.md blocker note: "GBA org structure unconfirmed".

ALTER TABLE wards
  ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_wards_org_id ON wards(org_id);
