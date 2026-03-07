const express = require('express');
const { Pool } = require('pg');
const path = require('path');

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

// --- Helper: check time conflict ---
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
    const { title, booked_by, date, start_time, end_time, notes } = req.body;

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
      `INSERT INTO bookings (title, booked_by, date, start_time, end_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, booked_by, date, start_time, end_time, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bookings/:id
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, booked_by, date, start_time, end_time, notes } = req.body;

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
      `UPDATE bookings SET title=$1, booked_by=$2, date=$3, start_time=$4, end_time=$5, notes=$6
       WHERE id=$7 RETURNING *`,
      [title, booked_by, date, start_time, end_time, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking tidak ditemukan' });
    }

    res.json(result.rows[0]);
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
