-- Migration: 003_super_admin.sql
-- Adds is_super_admin column to admin_users table.
--
-- AC-SA-BE-1-S1: The column must be BOOLEAN NOT NULL DEFAULT FALSE.
-- All pre-existing rows receive is_super_admin = FALSE automatically via DEFAULT.
-- This migration is safe to apply to a DB with zero or more existing rows.

ALTER TABLE admin_users
    ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
