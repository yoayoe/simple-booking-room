# Meeting Room Booking

Aplikasi web sederhana untuk booking ruang rapat satu ruangan, tanpa autentikasi.

## Fitur

- Tampilan **kalender bulanan** dengan indikator hari yang sudah ada booking
- Tampilan **agenda/list** dengan filter rentang tanggal
- **Tambah, edit, dan hapus** booking
- **Validasi konflik** jadwal (tidak bisa booking waktu yang bertabrakan)
- Data tersimpan di **PostgreSQL**

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL 16
- **Container**: Docker + Docker Compose

## Cara Menjalankan

### Prasyarat

- Docker & Docker Compose terinstall
- User sudah masuk grup `docker` (jika belum: `sudo usermod -aG docker $USER` lalu re-login)

### Jalankan

```bash
docker compose up --build
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
├── Dockerfile           # Build image Node.js
├── package.json
├── server.js            # Express API server
├── db/
│   └── init.sql         # Skema tabel PostgreSQL
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## API Endpoints

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/api/bookings` | Ambil semua booking (opsional: `?from=YYYY-MM-DD&to=YYYY-MM-DD`) |
| POST | `/api/bookings` | Buat booking baru |
| PUT | `/api/bookings/:id` | Update booking |
| DELETE | `/api/bookings/:id` | Hapus booking |

### Contoh payload POST/PUT

```json
{
  "title": "Rapat Bulanan",
  "booked_by": "Budi",
  "date": "2026-03-10",
  "start_time": "09:00",
  "end_time": "10:30",
  "notes": "Bawa laptop masing-masing"
}
```

## Environment Variables

| Variable | Default | Keterangan |
|----------|---------|------------|
| `DB_HOST` | `db` | Host PostgreSQL |
| `DB_PORT` | `5432` | Port PostgreSQL |
| `DB_NAME` | `booking_room` | Nama database |
| `DB_USER` | `booking_user` | Username database |
| `DB_PASSWORD` | `booking_pass` | Password database |
| `PORT` | `3000` | Port aplikasi |
