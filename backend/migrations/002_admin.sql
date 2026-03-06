-- 002_admin.sql: Admin user management and audit trail

CREATE TYPE user_role AS ENUM ('admin', 'reviewer');

CREATE TABLE admin_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'reviewer',
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ
);

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX idx_admin_users_email  ON admin_users(email);
CREATE INDEX idx_admin_users_active ON admin_users(email) WHERE is_active = TRUE;

-- Add actor attribution to existing audit trail
ALTER TABLE status_history
  ADD COLUMN changed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;

CREATE INDEX idx_status_history_changed_by ON status_history(changed_by);
