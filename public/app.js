// ── State ──
let currentView = 'calendar';
let currentYear, currentMonth;
let allBookings = [];
let selectedDate = null;
let deleteTargetId = null;

// ── Init ──
(function () {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth(); // 0-based
  loadBookings().then(() => {
    renderCalendar();
    setDefaultFilterDates();
  });
})();

// ── API ──
async function loadBookings(from, to) {
  try {
    let url = '/api/bookings';
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if ([...params].length) url += '?' + params.toString();
    const res = await fetch(url);
    allBookings = await res.json();
  } catch {
    allBookings = [];
  }
}

async function createBooking(data) {
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res;
}

async function updateBooking(id, data) {
  const res = await fetch(`/api/bookings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res;
}

async function deleteBooking(id) {
  const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
  return res;
}

// ── View Switch ──
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.getElementById('btn-calendar').classList.toggle('active', view === 'calendar');
  document.getElementById('btn-list').classList.toggle('active', view === 'list');

  if (view === 'list') {
    loadBookings().then(renderList);
  }
}

// ── Calendar ──
function changeMonth(delta) {
  currentMonth += delta;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  if (currentMonth < 0)  { currentMonth = 11; currentYear--; }
  loadBookings().then(renderCalendar);
}

function renderCalendar() {
  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'];
  document.getElementById('calendar-title').textContent =
    `${monthNames[currentMonth]} ${currentYear}`;

  const grid = document.getElementById('calendar-grid');
  // Remove old day cells (keep 7 day-label headers)
  const oldCells = grid.querySelectorAll('.day-cell');
  oldCells.forEach(c => c.remove());

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = toDateStr(today);

  // Map bookings by date
  const bookingsByDate = {};
  allBookings.forEach(b => {
    const d = b.date.slice(0, 10);
    if (!bookingsByDate[d]) bookingsByDate[d] = [];
    bookingsByDate[d].push(b);
  });

  // Empty leading cells
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'day-cell empty';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`;
    const bookings = bookingsByDate[dateStr] || [];
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;

    const cell = document.createElement('div');
    cell.className = 'day-cell' +
      (isToday ? ' today' : '') +
      (isSelected ? ' selected' : '') +
      (bookings.length ? ' has-booking' : '');

    const numEl = document.createElement('div');
    numEl.className = 'day-num';
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (bookings.length) {
      const sorted = [...bookings].sort((a, b) => a.start_time.localeCompare(b.start_time));
      const visible = sorted.slice(0, 2);
      visible.forEach(b => {
        const pill = document.createElement('div');
        pill.className = 'booking-pill';
        pill.innerHTML =
          `<span class="pill-time">${formatTime(b.start_time)}</span>` +
          `<span class="pill-title">${escHtml(b.title)}</span>`;
        cell.appendChild(pill);
      });
      if (sorted.length > 2) {
        const more = document.createElement('div');
        more.className = 'booking-more';
        more.textContent = `+${sorted.length - 2} lagi`;
        cell.appendChild(more);
      }
    }

    cell.onclick = () => selectDay(dateStr, bookings);
    grid.appendChild(cell);
  }
}

function selectDay(dateStr, bookings) {
  selectedDate = dateStr;
  renderCalendar();
  showDayDetail(dateStr, bookings);
}

function showDayDetail(dateStr, bookings) {
  const detail = document.getElementById('day-detail');
  const title = document.getElementById('day-detail-title');
  const container = document.getElementById('day-detail-bookings');

  const date = new Date(dateStr + 'T00:00:00');
  title.textContent = date.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  container.innerHTML = '';
  if (!bookings.length) {
    container.innerHTML = '<div class="no-booking">Belum ada booking untuk hari ini</div>';
  } else {
    bookings.sort((a, b) => a.start_time.localeCompare(b.start_time));
    bookings.forEach(b => container.appendChild(createBookingCard(b)));
  }

  detail.classList.remove('hidden');
}

function closeDayDetail() {
  selectedDate = null;
  document.getElementById('day-detail').classList.add('hidden');
  renderCalendar();
}

// ── List ──
function setDefaultFilterDates() {
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  document.getElementById('filter-from').value = toDateStr(now);
  document.getElementById('filter-to').value = toDateStr(in30);
}

function resetFilter() {
  setDefaultFilterDates();
  renderList();
}

async function renderList() {
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;

  await loadBookings(from || undefined, to || undefined);

  const container = document.getElementById('booking-list');
  container.innerHTML = '';

  if (!allBookings.length) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <p>Tidak ada booking pada rentang tanggal ini</p>
      </div>`;
    return;
  }

  // Group by date
  const groups = {};
  allBookings.forEach(b => {
    const d = b.date.slice(0, 10);
    if (!groups[d]) groups[d] = [];
    groups[d].push(b);
  });

  Object.keys(groups).sort().forEach(dateStr => {
    const label = document.createElement('div');
    label.className = 'date-group-label';
    const date = new Date(dateStr + 'T00:00:00');
    label.textContent = date.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    container.appendChild(label);

    groups[dateStr]
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .forEach(b => container.appendChild(createBookingCard(b)));
  });
}

// ── Booking Card ──
function createBookingCard(b) {
  const card = document.createElement('div');
  card.className = 'booking-card';

  const start = formatTime(b.start_time);
  const end = formatTime(b.end_time);

  card.innerHTML = `
    <div class="booking-card-info">
      <div class="booking-card-title">${escHtml(b.title)}</div>
      <div class="booking-card-meta">
        <span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          ${start} – ${end}
        </span>
        <span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          ${escHtml(b.booked_by)}
        </span>
      </div>
      ${b.notes ? `<div class="booking-card-notes">${escHtml(b.notes)}</div>` : ''}
    </div>
    <div class="card-actions">
      <button class="btn-icon" onclick="openEditModal(${b.id})" title="Edit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn-icon delete" onclick="openConfirm(${b.id})" title="Hapus">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
        </svg>
      </button>
    </div>`;
  return card;
}

// ── Modal Form ──
function openModal(prefillDate) {
  document.getElementById('modal-title').textContent = 'Tambah Booking';
  document.getElementById('btn-submit').textContent = 'Simpan';
  document.getElementById('edit-id').value = '';
  document.getElementById('booking-form').reset();
  document.getElementById('f-date').value = prefillDate || selectedDate || toDateStr(new Date());
  hideFormError();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) closeModal();
}

function openEditModal(id) {
  const b = allBookings.find(x => x.id === id);
  if (!b) return;
  document.getElementById('modal-title').textContent = 'Edit Booking';
  document.getElementById('btn-submit').textContent = 'Simpan Perubahan';
  document.getElementById('edit-id').value = id;
  document.getElementById('f-title').value = b.title;
  document.getElementById('f-name').value = b.booked_by;
  document.getElementById('f-date').value = b.date.slice(0, 10);
  document.getElementById('f-start').value = b.start_time.slice(0, 5);
  document.getElementById('f-end').value = b.end_time.slice(0, 5);
  document.getElementById('f-notes').value = b.notes || '';
  hideFormError();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

async function submitBooking(e) {
  e.preventDefault();
  hideFormError();

  const id = document.getElementById('edit-id').value;
  const data = {
    title: document.getElementById('f-title').value.trim(),
    booked_by: document.getElementById('f-name').value.trim(),
    date: document.getElementById('f-date').value,
    start_time: document.getElementById('f-start').value,
    end_time: document.getElementById('f-end').value,
    notes: document.getElementById('f-notes').value.trim(),
  };

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;

  try {
    const res = id ? await updateBooking(id, data) : await createBooking(data);
    const body = await res.json();

    if (!res.ok) {
      showFormError(body.error || 'Terjadi kesalahan');
      return;
    }

    closeModal();
    await loadBookings();
    renderCalendar();

    // Refresh day detail if open
    if (selectedDate) {
      const dayBookings = allBookings.filter(b => b.date.slice(0, 10) === selectedDate);
      showDayDetail(selectedDate, dayBookings);
    }

    if (currentView === 'list') renderList();
  } catch {
    showFormError('Gagal terhubung ke server');
  } finally {
    btn.disabled = false;
  }
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideFormError() {
  document.getElementById('form-error').classList.add('hidden');
}

// ── Delete ──
function openConfirm(id) {
  deleteTargetId = id;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}

function closeConfirm() {
  deleteTargetId = null;
  document.getElementById('confirm-overlay').classList.add('hidden');
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  try {
    await deleteBooking(deleteTargetId);
    closeConfirm();
    await loadBookings();
    renderCalendar();
    if (selectedDate) {
      const dayBookings = allBookings.filter(b => b.date.slice(0, 10) === selectedDate);
      showDayDetail(selectedDate, dayBookings);
    }
    if (currentView === 'list') renderList();
  } catch {
    closeConfirm();
  }
}

// ── Helpers ──
function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatTime(t) {
  // t = "HH:MM:SS" or "HH:MM"
  return t.slice(0, 5);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
