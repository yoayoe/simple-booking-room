CREATE TABLE IF NOT EXISTS bookings (
  id             SERIAL PRIMARY KEY,
  title          VARCHAR(255) NOT NULL,
  booked_by      VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  date           DATE         NOT NULL,
  start_time     TIME         NOT NULL,
  end_time       TIME         NOT NULL,
  notes          TEXT,
  reminder_sent  BOOLEAN      DEFAULT FALSE,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date);
