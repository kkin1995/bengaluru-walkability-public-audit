-- Migration: 016_rename_location_source_data.sql
--
-- Purpose: Migrate existing location_source rows to canonical enum values.
-- Runs after 015_rename_location_source.sql, which committed GPS_API/EXIF_GPS/MANUAL_ADJUST.
--
-- 'manual_pin' rows → 'GPS_API'  (browser Geolocation API was the actual source)
-- 'exif' rows       → 'EXIF_GPS' (EXIF GPS tag was the actual source)
--
-- Both predicates are idempotent: already-migrated rows match no rows and are safe to re-run.

UPDATE reports SET location_source = 'GPS_API'  WHERE location_source::TEXT = 'manual_pin';
UPDATE reports SET location_source = 'EXIF_GPS' WHERE location_source::TEXT = 'exif';
