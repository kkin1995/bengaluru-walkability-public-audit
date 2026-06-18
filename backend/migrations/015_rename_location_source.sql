-- Migration: 015_rename_location_source.sql
--
-- Purpose: Add canonical location_source enum values.
-- FIX-13 (UAT-01-08): The original enum values 'exif' and 'manual_pin' are misleading.
-- New canonical values:
--   GPS_API       — coordinates supplied by browser Geolocation API (was: manual_pin)
--   EXIF_GPS      — coordinates extracted from photo EXIF data (was: exif)
--   MANUAL_ADJUST — coordinates manually adjusted by the user on the map
--
-- SPLIT MIGRATION: SQLx 0.7 wraps every migration in a transaction and has no
-- noTransaction pragma. PostgreSQL prohibits using a newly added enum value in
-- the same transaction that added it (error 55P04). The data migration (UPDATE
-- statements) therefore lives in 016_rename_location_source_data.sql, which
-- runs after this migration commits and the new values are fully available.
--
-- Idempotency: IF NOT EXISTS guards make re-running this migration safe.

ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'GPS_API';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'MANUAL_ADJUST';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'EXIF_GPS';
