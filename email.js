const nodemailer = require('nodemailer');

const isConfigured = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  : null;

const FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@meetingroom.local';

// ── Helpers ──
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatTime(t) {
  return t.slice(0, 5);
}

async function send(to, subject, html) {
  if (!transporter) {
    console.log(`[Email] Not configured — skipping: "${subject}" → ${to}`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[Email] Sent: "${subject}" → ${to}`);
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
  }
}

// ── Templates ──
function confirmationHtml(b) {
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <div style="background:#2563eb;padding:24px 28px">
      <h2 style="color:#fff;margin:0;font-size:18px">Booking Dikonfirmasi</h2>
      <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px">Ruang Rapat Utama</p>
    </div>
    <div style="padding:24px 28px">
      <p style="margin:0 0 16px;color:#1e293b">Halo <strong>${b.booked_by}</strong>,</p>
      <p style="margin:0 0 20px;color:#475569">Booking ruang rapat Anda telah berhasil dikonfirmasi.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:8px 12px;background:#f8fafc;border-radius:6px 0 0 0;color:#64748b;width:36%">Kegiatan</td>
          <td style="padding:8px 12px;background:#f8fafc;border-radius:0 6px 0 0;font-weight:600;color:#1e293b">${b.title}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#64748b;border-top:1px solid #e2e8f0">Tanggal</td>
          <td style="padding:8px 12px;border-top:1px solid #e2e8f0;color:#1e293b">${formatDate(b.date)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f8fafc;color:#64748b">Waktu</td>
          <td style="padding:8px 12px;background:#f8fafc;color:#1e293b">${formatTime(b.start_time)} – ${formatTime(b.end_time)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#64748b;border-top:1px solid #e2e8f0">Dipesan Oleh</td>
          <td style="padding:8px 12px;border-top:1px solid #e2e8f0;color:#1e293b">${b.booked_by}</td>
        </tr>
        ${b.notes ? `
        <tr>
          <td style="padding:8px 12px;background:#f8fafc;color:#64748b;border-top:1px solid #e2e8f0">Catatan</td>
          <td style="padding:8px 12px;background:#f8fafc;color:#1e293b;border-top:1px solid #e2e8f0">${b.notes}</td>
        </tr>` : ''}
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#94a3b8">Anda akan mendapat reminder 30 menit sebelum jadwal dimulai.</p>
    </div>
    <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
      Meeting Room Booking System
    </div>
  </div>`;
}

function reminderHtml(b) {
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <div style="background:#f59e0b;padding:24px 28px">
      <h2 style="color:#fff;margin:0;font-size:18px">Pengingat — 30 Menit Lagi</h2>
      <p style="color:#fef3c7;margin:4px 0 0;font-size:13px">Ruang Rapat Utama</p>
    </div>
    <div style="padding:24px 28px">
      <p style="margin:0 0 16px;color:#1e293b">Halo <strong>${b.booked_by}</strong>,</p>
      <p style="margin:0 0 20px;color:#475569">Jadwal rapat Anda akan dimulai <strong>30 menit lagi</strong>. Jangan sampai terlambat!</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr>
          <td style="padding:8px 12px;background:#fffbeb;border-radius:6px 0 0 0;color:#64748b;width:36%">Kegiatan</td>
          <td style="padding:8px 12px;background:#fffbeb;border-radius:0 6px 0 0;font-weight:600;color:#1e293b">${b.title}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#64748b;border-top:1px solid #e2e8f0">Tanggal</td>
          <td style="padding:8px 12px;border-top:1px solid #e2e8f0;color:#1e293b">${formatDate(b.date)}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#fffbeb;color:#64748b">Waktu</td>
          <td style="padding:8px 12px;background:#fffbeb;color:#1e293b">${formatTime(b.start_time)} – ${formatTime(b.end_time)}</td>
        </tr>
      </table>
    </div>
    <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
      Meeting Room Booking System
    </div>
  </div>`;
}

// ── Exports ──
async function sendConfirmation(booking) {
  if (!booking.email) return;
  await send(
    booking.email,
    `Konfirmasi Booking: ${booking.title}`,
    confirmationHtml(booking)
  );
}

async function sendReminder(booking) {
  if (!booking.email) return;
  await send(
    booking.email,
    `Reminder: ${booking.title} dimulai 30 menit lagi`,
    reminderHtml(booking)
  );
}

module.exports = { sendConfirmation, sendReminder, isConfigured };
