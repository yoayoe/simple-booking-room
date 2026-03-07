const express = require('express');
const pg = require('pg');
const { Pool } = pg;
const cron = require('node-cron');
const path = require('path');
const { sendConfirmation, sendReminder, isConfigured } = require('./email');

// Return DATE columns as plain "YYYY-MM-DD" strings, not Date objects
// Without this, pg serializes dates to UTC ISO strings which causes off-by-one
// day errors for UTC+ timezones (e.g. Jakarta UTC+7)
pg.types.setTypeParser(1082, val => val);

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'booking_room',
  user: process.env.DB_USER || 'booking_user',
  password: process.env.DB_PASSWORD || 'booking_pass',
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── DB Migration on startup ──
async function migrate() {
  await pool.query(`
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email VARCHAR(255);
  `);
  await pool.query(`
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
  `);
  console.log('[DB] Migration complete');
}

// ── Reminder Scheduler (runs every minute) ──
function startReminderScheduler() {
  if (!isConfigured) {
    console.log('[Reminder] Email not configured — scheduler disabled');
    return;
  }
  cron.schedule('* * * * *', async () => {
    try {
      // Find bookings starting in 29–31 minutes with email and reminder not sent yet
      const result = await pool.query(`
        SELECT * FROM bookings
        WHERE email IS NOT NULL
          AND reminder_sent = FALSE
          AND (date + start_time) BETWEEN
            (NOW() AT TIME ZONE 'Asia/Jakarta' + INTERVAL '29 minutes') AND
            (NOW() AT TIME ZONE 'Asia/Jakarta' + INTERVAL '31 minutes')
      `);
      for (const booking of result.rows) {
        await sendReminder(booking);
        await pool.query(
          'UPDATE bookings SET reminder_sent = TRUE WHERE id = $1',
          [booking.id]
        );
      }
    } catch (err) {
      console.error('[Reminder] Scheduler error:', err.message);
    }
  });
  console.log('[Reminder] Scheduler started (every minute, 30min before meeting)');
}

// ── Helper: check time conflict ──
async function hasConflict(date, startTime, endTime, excludeId = null) {
  const query = `
    SELECT id FROM bookings
    WHERE date = $1
      AND ($2::time, $3::time) OVERLAPS (start_time, end_time)
      ${excludeId ? 'AND id != $4' : ''}
  `;
  const params = excludeId
    ? [date, startTime, endTime, excludeId]
    : [date, startTime, endTime];
  const result = await pool.query(query, params);
  return result.rows.length > 0;
}

// GET /api/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/api/bookings', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = `SELECT * FROM bookings`;
    const params = [];

    if (from && to) {
      query += ` WHERE date BETWEEN $1 AND $2`;
      params.push(from, to);
    } else if (from) {
      query += ` WHERE date >= $1`;
      params.push(from);
    } else if (to) {
      query += ` WHERE date <= $1`;
      params.push(to);
    }

    query += ` ORDER BY date ASC, start_time ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bookings
app.post('/api/bookings', async (req, res) => {
  try {
    const { title, booked_by, email, date, start_time, end_time, notes } = req.body;

    if (!title || !booked_by || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Field wajib tidak boleh kosong' });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: 'Jam selesai harus lebih besar dari jam mulai' });
    }

    const conflict = await hasConflict(date, start_time, end_time);
    if (conflict) {
      return res.status(409).json({ error: 'Waktu bertabrakan dengan booking yang sudah ada' });
    }

    const result = await pool.query(
      `INSERT INTO bookings (title, booked_by, email, date, start_time, end_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, booked_by, email || null, date, start_time, end_time, notes || null]
    );

    const booking = result.rows[0];
    res.status(201).json(booking);

    // Send confirmation email (non-blocking)
    sendConfirmation(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bookings/:id
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, booked_by, email, date, start_time, end_time, notes } = req.body;

    if (!title || !booked_by || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Field wajib tidak boleh kosong' });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: 'Jam selesai harus lebih besar dari jam mulai' });
    }

    const conflict = await hasConflict(date, start_time, end_time, id);
    if (conflict) {
      return res.status(409).json({ error: 'Waktu bertabrakan dengan booking yang sudah ada' });
    }

    const result = await pool.query(
      `UPDATE bookings
       SET title=$1, booked_by=$2, email=$3, date=$4, start_time=$5, end_time=$6, notes=$7, reminder_sent=FALSE
       WHERE id=$8 RETURNING *`,
      [title, booked_by, email || null, date, start_time, end_time, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking tidak ditemukan' });
    }

    const booking = result.rows[0];
    res.json(booking);

    // Send confirmation email for update (non-blocking)
    sendConfirmation(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bookings/:id
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM bookings WHERE id=$1 RETURNING id', [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking tidak ditemukan' });
    }
    res.json({ message: 'Booking dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Start ──
migrate().then(() => {
  startReminderScheduler();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
