-- Perstrive dashboard schema. Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  full_name     text,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         text PRIMARY KEY,             -- sha256 of the cookie token
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS brands (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid REFERENCES brands(id) ON DELETE SET NULL,
  name               text NOT NULL,
  city               text,
  state              text,
  meta_ad_account_id text,
  status             text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('active', 'paused', 'onboarding')),
  last_synced_at     timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- One row per location per day. Spend/impressions/clicks/leads come from Meta;
-- booked_appointments comes from your CRM and is never overwritten by the Meta sync.
CREATE TABLE IF NOT EXISTS daily_metrics (
  location_id         uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date                date NOT NULL,
  spend               numeric(12, 2) NOT NULL DEFAULT 0,
  impressions         bigint NOT NULL DEFAULT 0,
  clicks              bigint NOT NULL DEFAULT 0,
  leads               integer NOT NULL DEFAULT 0,
  booked_appointments integer NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, date)
);
CREATE INDEX IF NOT EXISTS daily_metrics_date_idx ON daily_metrics(date);

CREATE TABLE IF NOT EXISTS announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  brand_id   uuid REFERENCES brands(id) ON DELETE CASCADE,  -- null = everyone
  author     text,
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);
