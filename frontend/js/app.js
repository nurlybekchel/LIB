const API = '/api/books';
const AUTH_API = '/api/auth';
const ADMIN_API = '/api/admin';

let currentUser = null;
// Храним историю открытых книг в localStorage
function getReadHistory() {
  try { return JSON.parse(localStorage.getItem('readHistory') || '[]'); } catch { return []; }
}
function addToHistory(book) {
  let history = getReadHistory();
  history = history.filter(b => b.id !== book.id);
  history.unshift({ id: book.id, title: book.title, author: book.author, readAt: new Date().toISOString() });
  if (history.length > 20) history = history.slice(0, 20);
  localStorage.setItem('readHistory', JSON.stringify(history));
}

function getToken() { return localStorage.getItem('token'); }
function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ─── NAVIGATION ───────────────────────────────────────
const ALL_VIEWS = ['home', 'catalog', 'login', 'register', 'profile'];

function switchView(view) {
  ALL_VIEWS.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== view);
  });
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.view === view);
  });
  if (view === 'catalog') { loadBooks(); loadGenres(); }
  if (view === 'home') loadHeroBooks();
  if (view === 'profile') loadProfile();
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    switchView(link.dataset.view);
  });
});

document.querySelector('.header__logo').addEventListener('click', () => switchView('home'));

// ─── AUTH UI ──────────────────────────────────────────
function updateAuthUI() {
  const authBtns = document.getElementById('header-auth');
  const userBlock = document.getElementById('header-user');
  const adminLink = document.getElementById('admin-link');

  if (currentUser) {
    authBtns.classList.add('hidden');
    userBlock.classList.remove('hidden');
    const letter = (currentUser.username || '?')[0].toUpperCase();
    document.getElementById('user-greeting').innerHTML = `
      <span style="
        display:inline-flex;align-items:center;justify-content:center;
        width:32px;height:32px;border-radius:50%;
        background:linear-gradient(135deg,var(--accent),#e07b39);
        color:#fff;font-weight:700;font-size:0.9rem;
        font-family:'Playfair Display',serif;margin-right:7px;
        vertical-align:middle;flex-shrink:0;
      ">${letter}</span><span style="vertical-align:middle">${currentUser.username}</span>
    `;
    if (currentUser.role === 'admin') {
      adminLink.classList.remove('hidden');
    } else {
      adminLink.classList.add('hidden');
    }
  } else {
    authBtns.classList.remove('hidden');
    userBlock.classList.add('hidden');
  }
}

async function checkAuth() {
  const token = getToken();
  if (!token) return;
  try {
    const res = await fetch(`${AUTH_API}/me`, { headers: authHeaders() });
    if (res.ok) {
      currentUser = await res.json();
      updateAuthUI();
    } else {
      localStorage.removeItem('token');
    }
  } catch {}
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  updateAuthUI();
  switchView('home');
}

// ─── LOGIN ────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');

  const res = await fetch(`${AUTH_API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) {
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    updateAuthUI();
    switchView('home');
  } else {
    msg.textContent = data.error;
    msg.className = 'form-msg error';
  }
}

// ─── REGISTER ─────────────────────────────────────────
async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const msg = document.getElementById('reg-msg');

  const res = await fetch(`${AUTH_API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await res.json();
  if (res.ok) {
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    updateAuthUI();
    switchView('home');
  } else {
    msg.textContent = data.error;
    msg.className = 'form-msg error';
  }
}

// ─── PROFILE ──────────────────────────────────────────
function loadProfile() {
  if (!currentUser) { switchView('login'); return; }

  // Аватар — первая буква имени
  const letter = (currentUser.username || '?')[0].toUpperCase();
  document.getElementById('profile-avatar-letter').textContent = letter;
  document.getElementById('profile-name').textContent = currentUser.username;
  document.getElementById('profile-username').textContent = currentUser.username;
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-role-text').textContent = currentUser.role === 'admin' ? 'Администратор' : 'Читатель';
  document.getElementById('profile-role').textContent = currentUser.role === 'admin' ? '⭐ Администратор' : '📖 Читатель';

  // Дата регистрации — безопасный парсинг
  let dateStr = '—';
  if (currentUser.created_at) {
    const raw = currentUser.created_at.replace(' ', 'T');
    const d = new Date(raw);
    if (!isNaN(d)) {
      dateStr = d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
  document.getElementById('profile-date').textContent = dateStr;

  // С какого числа
  document.getElementById('profile-since').textContent = dateStr !== '—' ? `В библиотеке с ${dateStr}` : '';

  // Показать/скрыть кнопку админки
  const adminBtn = document.getElementById('profile-admin-btn');
  if (currentUser.role === 'admin') adminBtn.classList.remove('hidden');
  else adminBtn.classList.add('hidden');

  // История чтения
  const history = getReadHistory();
  const histEl = document.getElementById('profile-history');

  // Статистика
  document.getElementById('profile-stats').innerHTML = `
    <div class="profile-stat-card">
      <div class="profile-stat-card__value">${history.length}</div>
      <div class="profile-stat-card__label">Прочитано книг</div>
    </div>
    <div class="profile-stat-card">
      <div class="profile-stat-card__value">${history.length > 0 ? new Date(history[0].readAt).toLocaleDateString('ru-RU', {day:'numeric', month:'short'}) : '—'}</div>
      <div class="profile-stat-card__label">Последнее чтение</div>
    </div>
    <div class="profile-stat-card">
      <div class="profile-stat-card__value">${currentUser.role === 'admin' ? '⭐' : '📖'}</div>
      <div class="profile-stat-card__label">${currentUser.role === 'admin' ? 'Админ' : 'Читатель'}</div>
    </div>
  `;

  if (!history.length) {
    histEl.innerHTML = `
      <div style="text-align:center;padding:24px 0;color:var(--text-muted)">
        <div style="font-size:2rem;margin-bottom:8px">📭</div>
        <div>Вы ещё не открывали книги</div>
        <button class="btn btn--outline btn--sm" style="margin-top:12px" onclick="switchView('catalog')">Перейти в каталог</button>
      </div>
    `;
  } else {
    histEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${history.map((b, i) => `
          <div class="profile-history-item">
            <div class="profile-history-item__num">${i + 1}</div>
            <div class="profile-history-item__info">
              <div class="profile-history-item__title">${b.title}</div>
              <div class="profile-history-item__author">${b.author}</div>
            </div>
            <div class="profile-history-item__date">${new Date(b.readAt).toLocaleDateString('ru-RU', {day:'numeric', month:'short'})}</div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn--outline btn--sm" style="margin-top:14px;width:100%" onclick="clearHistory()">🗑 Очистить историю</button>
    `;
  }
}

function clearHistory() {
  if (!confirm('Очистить историю чтения?')) return;
  localStorage.removeItem('readHistory');
  loadProfile();
}

// ─── HERO BOOKS ───────────────────────────────────────
async function loadHeroBooks() {
  const res = await fetch(API);
  const books = await res.json();
  const container = document.getElementById('hero-books');
  container.innerHTML = books.slice(0, 6).map(b => `
    <div class="hero-book-card" onclick="switchView('catalog')">
      <div class="hero-book-cover">
        ${b.cover_url ? `<img src="${b.cover_url}" alt="${b.title}" onerror="this.parentNode.innerHTML='📖'">` : '📖'}
      </div>
      <div class="hero-book-title">${b.title}</div>
      <div class="hero-book-author">${b.author}</div>
    </div>
  `).join('');
}

// ─── CATALOG ──────────────────────────────────────────
async function loadBooks(search = '', genre = '') {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (genre) params.set('genre', genre);
  const res = await fetch(`${API}?${params}`);
  const books = await res.json();
  renderBooks(books);
}

async function loadGenres() {
  try {
    const res = await fetch(`${API}/meta/genres`);
    const genres = await res.json();
    const sel = document.getElementById('genre-filter');
    sel.innerHTML = '<option value="">Все жанры</option>';
    genres.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g; opt.textContent = g;
      sel.appendChild(opt);
    });
  } catch {}
}

function renderBooks(books) {
  const grid = document.getElementById('books-grid');
  if (!books.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>Книги не найдены</p></div>`;
    return;
  }
  grid.innerHTML = books.map(b => `
    <div class="book-card" onclick="openModal(${b.id})">
      <div class="book-card__cover">
        ${b.cover_url ? `<img src="${b.cover_url}" alt="${b.title}" onerror="this.parentNode.innerHTML='📖'">` : '📖'}
        ${b.pdf_path ? `<span class="book-card__pdf-badge">PDF</span>` : ''}
      </div>
      <div class="book-card__body">
        <div class="book-card__title">${b.title}</div>
        <div class="book-card__author">${b.author}</div>
        ${b.genre ? `<span class="book-card__genre">${b.genre}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function searchBooks() {
  const search = document.getElementById('search-input').value;
  const genre = document.getElementById('genre-filter').value;
  loadBooks(search, genre);
}

function filterByGenre() { searchBooks(); }

document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchBooks();
});

// ─── MODAL ────────────────────────────────────────────
async function openModal(id) {
  const res = await fetch(`${API}/${id}`);
  const b = await res.json();
  const isAdmin = currentUser?.role === 'admin';

  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal__cover">
      ${b.cover_url ? `<img src="${b.cover_url}" alt="${b.title}" onerror="this.parentNode.innerHTML='📖'">` : '📖'}
    </div>
    ${b.genre ? `<span class="modal__genre">${b.genre}</span>` : ''}
    <h2 class="modal__title">${b.title}</h2>
    <p class="modal__author">${b.author}${b.year ? ` · ${b.year}` : ''}</p>
    ${b.description ? `<p class="modal__desc">${b.description}</p>` : ''}
    <div class="modal__actions">
      ${b.pdf_path ? `
        <button class="btn btn--primary btn--sm" onclick="openPdfReader('${b.pdf_path}', '${b.title.replace(/'/g, "\\'")}', ${b.id}, '${b.title.replace(/'/g, "\\'")}', '${b.author.replace(/'/g, "\\'")}')">
          📖 Читать онлайн
        </button>
      ` : `<p style="color:var(--text-muted);font-size:0.9rem">PDF ещё не загружен</p>`}
      ${!currentUser ? `
        <p class="modal__login-hint">
          <a href="#" onclick="closeModal();switchView('login')">Войдите</a>, чтобы отслеживать историю чтения
        </p>
      ` : ''}
    </div>
  `;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ─── PDF READER ───────────────────────────────────────
function openPdfReader(pdfPath, title, bookId, bookTitle, bookAuthor) {
  document.getElementById('pdf-reader-title').textContent = title;
  document.getElementById('pdf-iframe').src = pdfPath;
  document.getElementById('pdf-overlay').classList.remove('hidden');
  closeModal();
  // Записываем в историю
  if (bookId) {
    addToHistory({ id: bookId, title: bookTitle || title, author: bookAuthor || '' });
  }
}

function closePdfReader() {
  document.getElementById('pdf-overlay').classList.add('hidden');
  document.getElementById('pdf-iframe').src = '';
}

// ─── INIT ─────────────────────────────────────────────
checkAuth().then(() => {
  loadHeroBooks();
  loadGenres();
});