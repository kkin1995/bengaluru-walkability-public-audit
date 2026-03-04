CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE issue_category AS ENUM (
  'no_footpath',
  'broken_footpath',
  'blocked_footpath',
  'unsafe_crossing',
  'poor_lighting',
  'other'
);

CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE report_status AS ENUM ('submitted', 'under_review', 'resolved');
CREATE TYPE location_source AS ENUM ('exif', 'manual_pin');

CREATE TABLE reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  image_path        TEXT NOT NULL,
  latitude          FLOAT8 NOT NULL,
  longitude         FLOAT8 NOT NULL,
  location          GEOGRAPHY(POINT, 4326) NOT NULL,
  category          issue_category NOT NULL,
  severity          severity_level NOT NULL DEFAULT 'medium',
  description       TEXT,
  submitter_name    TEXT,
  submitter_contact TEXT,
  status            report_status NOT NULL DEFAULT 'submitted',
  location_source   location_source NOT NULL
);

-- Unified function: populate geography column from lat/lng using safe ST_MakePoint
CREATE OR REPLACE FUNCTION set_location_from_lat_lng()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_report_location
BEFORE INSERT OR UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION set_location_from_lat_lng();

-- Maintain updated_at automatically
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reports_updated_at
BEFORE UPDATE ON reports
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX idx_reports_location    ON reports USING GIST(location);
CREATE INDEX idx_reports_category    ON reports(category);
CREATE INDEX idx_reports_status      ON reports(status);
CREATE INDEX idx_reports_created_at  ON reports(created_at DESC);
-- Compound index for common filter+sort queries
CREATE INDEX idx_reports_status_category_created ON reports(status, category, created_at DESC);
-- Partial index for the default "new submissions" view
CREATE INDEX idx_reports_submitted_created ON reports(created_at DESC) WHERE status = 'submitted';

-- Audit trail: track every status transition
CREATE TABLE status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  old_status  report_status,
  new_status  report_status NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note        TEXT
);

CREATE INDEX idx_status_history_report_id ON status_history(report_id);
CREATE INDEX idx_status_history_changed_at ON status_history(changed_at DESC);

-- Future PWN tables (scaffold now, populate later)
CREATE TABLE bus_stops (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  latitude  FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  location  GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE TRIGGER trg_set_bus_stop_location
BEFORE INSERT OR UPDATE ON bus_stops
FOR EACH ROW EXECUTE FUNCTION set_location_from_lat_lng();

CREATE INDEX idx_bus_stops_location ON bus_stops USING GIST(location);

CREATE TABLE metro_stations (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  line      TEXT,
  latitude  FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  location  GEOGRAPHY(POINT, 4326) NOT NULL
);

CREATE TRIGGER trg_set_metro_station_location
BEFORE INSERT OR UPDATE ON metro_stations
FOR EACH ROW EXECUTE FUNCTION set_location_from_lat_lng();

CREATE INDEX idx_metro_stations_location ON metro_stations USING GIST(location);
