-- Migration: 015_rename_location_source.sql
--
-- Purpose: Add canonical location_source enum values and migrate existing rows.
-- FIX-13 (UAT-01-08): The original enum values 'exif' and 'manual_pin' are misleading.
-- New canonical values:
--   GPS_API       — coordinates supplied by browser Geolocation API (was: manual_pin)
--   EXIF_GPS      — coordinates extracted from photo EXIF data (was: exif)
--   MANUAL_ADJUST — coordinates manually adjusted by the user on the map
--
-- PostgreSQL does NOT support ALTER TYPE ... DROP VALUE.
-- The old values 'exif' and 'manual_pin' remain in the enum type definition but
-- are never emitted by backend code after this migration. All stored rows are
-- converted to the new canonical values.
--
-- Non-transactional: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- block in PostgreSQL < 12. SQLx migrations run in a transaction by default;
-- the pragma below disables the transaction wrapper for this migration.
--
-- Idempotency: IF NOT EXISTS guards the ADD VALUE statements so re-running
-- this migration (e.g. on a fresh DB that already has the values) is safe.

-- sqlx:noTransaction
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'GPS_API';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'MANUAL_ADJUST';
ALTER TYPE location_source ADD VALUE IF NOT EXISTS 'EXIF_GPS';

-- Migrate existing data to canonical values.
-- 'manual_pin' rows become 'GPS_API' (browser Geolocation API was the source)
-- 'exif' rows become 'EXIF_GPS' (EXIF GPS tag was the source)
UPDATE reports SET location_source = 'GPS_API' WHERE location_source::TEXT = 'manual_pin';
UPDATE reports SET location_source = 'EXIF_GPS' WHERE location_source::TEXT = 'exif';
