# Meeting Room Booking

Aplikasi web sederhana untuk booking ruang rapat satu ruangan, tanpa autentikasi.

## Fitur

- Tampilan **kalender bulanan** — info agenda & nama pemesan langsung tampil di tiap sel hari
- Tampilan **agenda/list** dengan filter rentang tanggal
- **Tambah, edit, dan hapus** booking
- **Validasi konflik** jadwal (tidak bisa booking waktu yang bertabrakan)
- **Email konfirmasi** otomatis saat booking dibuat atau diubah
- **Email reminder** 30 menit sebelum jadwal dimulai
- **Log aktivitas** — mencatat setiap perubahan (buat, ubah, hapus) beserta detail field yang berubah
- Data tersimpan di **PostgreSQL**
- Timezone **Asia/Jakarta (WIB)**

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL 16
- **Email**: Nodemailer (SMTP)
- **Scheduler**: node-cron
- **Container**: Docker + Docker Compose

## Cara Menjalankan

### Prasyarat

- Docker & Docker Compose terinstall
- User sudah masuk grup `docker` (jika belum: `sudo usermod -aG docker $USER` lalu re-login)

### 1. Konfigurasi Email (opsional)

Salin file contoh lalu isi sesuai provider SMTP Anda:

```bash
cp .env.example .env
```

Edit `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your@gmail.com
```

> Jika tidak dikonfigurasi, aplikasi tetap berjalan normal — fitur email di-skip.

### 2. Jalankan

```bash
# Tanpa email
docker compose up --build -d

# Dengan email
docker compose --env-file .env up --build -d
```

Buka browser ke **http://localhost:3000**

### Stop

```bash
docker compose down
```

### Stop + hapus data database

```bash
docker compose down -v
```

## Struktur Project

```
booking-room/
├── docker-compose.yml   # Orchestration: app + db
├── Dockerfile           # Build image Node.js (Alpine + tzdata)
├── package.json
├── server.js            # Express API server, reminder scheduler, log aktivitas
├── email.js             # Nodemailer — konfirmasi & reminder email
├── .env.example         # Contoh konfigurasi email
├── db/
│   └── init.sql         # Skema tabel PostgreSQL (bookings)
└── public/
    ├── index.html       # UI: kalender, agenda, log aktivitas
    ├── style.css
    └── app.js
```

## Skema Database

### Tabel `bookings`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | SERIAL | Primary key |
| `title` | VARCHAR(255) | Nama kegiatan |
| `booked_by` | VARCHAR(255) | Nama pemesan |
| `email` | VARCHAR(255) | Email pemesan (opsional) |
| `date` | DATE | Tanggal booking |
| `start_time` | TIME | Jam mulai |
| `end_time` | TIME | Jam selesai |
| `notes` | TEXT | Catatan (opsional) |
| `reminder_sent` | BOOLEAN | Sudah dikirim reminder? |
| `created_at` | TIMESTAMPTZ | Waktu dibuat |

### Tabel `booking_logs`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `id` | SERIAL | Primary key |
| `action` | VARCHAR(10) | `CREATE`, `UPDATE`, atau `DELETE` |
| `booking_id` | INTEGER | ID booking yang terpengaruh |
| `booking_data` | JSONB | Snapshot data booking sesudah perubahan |
| `old_data` | JSONB | Snapshot data booking sebelum perubahan (hanya `UPDATE`) |
| `performed_at` | TIMESTAMPTZ | Waktu aksi dilakukan |

> Tabel `booking_logs` dibuat otomatis saat server pertama kali dijalankan (migrasi di startup).

## API Endpoints

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/bookings` | Ambil semua booking (opsional: `?from=YYYY-MM-DD&to=YYYY-MM-DD`) |
| POST | `/api/bookings` | Buat booking baru |
| PUT | `/api/bookings/:id` | Update booking |
| DELETE | `/api/bookings/:id` | Hapus booking |
| GET | `/api/logs` | Ambil log aktivitas (opsional: `?limit=100&offset=0`) |

### Contoh payload POST/PUT

```json
{
  "title": "Rapat Bulanan",
  "booked_by": "Budi",
  "email": "budi@contoh.com",
  "date": "2026-03-10",
  "start_time": "09:00",
  "end_time": "10:30",
  "notes": "Bawa laptop masing-masing"
}
```

### Contoh response GET /api/logs

```json
[
  {
    "id": 3,
    "action": "UPDATE",
    "booking_id": 5,
    "booking_data": { "title": "Rapat Bulanan", "booked_by": "Budi", ... },
    "old_data":     { "title": "Rapat Harian",  "booked_by": "Budi", ... },
    "performed_at": "2026-03-13T09:30:00+07:00"
  }
]
```

> Field `old_data` hanya terisi untuk aksi `UPDATE`. Untuk `CREATE` dan `DELETE` nilainya `null`.

## Environment Variables

### Aplikasi

| Variable | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `3000` | Port aplikasi |
| `TZ` | `Asia/Jakarta` | Timezone container |

### Database

| Variable | Default | Keterangan |
|----------|---------|------------|
| `DB_HOST` | `db` | Host PostgreSQL |
| `DB_PORT` | `5432` | Port PostgreSQL |
| `DB_NAME` | `booking_room` | Nama database |
| `DB_USER` | `booking_user` | Username database |
| `DB_PASSWORD` | `booking_pass` | Password database |

### Email (SMTP)

| Variable | Keterangan |
|----------|------------|
| `EMAIL_HOST` | SMTP host (misal: `smtp.gmail.com`) |
| `EMAIL_PORT` | SMTP port (default: `587`) |
| `EMAIL_SECURE` | `true` untuk port 465, `false` untuk 587 |
| `EMAIL_USER` | Username/email SMTP |
| `EMAIL_PASS` | Password atau App Password |
| `EMAIL_FROM` | Alamat pengirim email |

## Docker Services

| Service | Port | Keterangan |
|---------|------|------------|
| `app` | 3000 | Node.js + Express |
| `db` | 5432 | PostgreSQL 16 |

Data PostgreSQL tersimpan di Docker volume `postgres_data` sehingga tidak hilang saat container di-restart.
