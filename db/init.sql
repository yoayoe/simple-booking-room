CREATE TABLE IF NOT EXISTS bookings (
  id        SERIAL PRIMARY KEY,
  title     VARCHAR(255) NOT NULL,
  booked_by VARCHAR(255) NOT NULL,
  date      DATE         NOT NULL,
  start_time TIME        NOT NULL,
  end_time   TIME        NOT NULL,
  notes     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date);
