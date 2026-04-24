const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { adminMiddleware, authMiddleware } = require('../middleware/auth');

// Setup PDF upload storage
const uploadsDir = path.join(__dirname, '../../frontend/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Только PDF файлы'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// GET all books (with optional search)
router.get('/', (req, res) => {
  const { search, genre } = req.query;
  let query = 'SELECT * FROM books WHERE 1=1';
  const params = [];
  if (search) {
    query += ' AND (title LIKE ? OR author LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (genre) {
    query += ' AND genre = ?';
    params.push(genre);
  }
  query += ' ORDER BY created_at DESC';
  const books = db.prepare(query).all(...params);
  res.json(books);
});

// GET single book
router.get('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Книга не найдена' });
  res.json(book);
});

// POST add book (admin only) with optional PDF
router.post('/', adminMiddleware, upload.single('pdf'), (req, res) => {
  const { title, author, genre, description, year, cover_url } = req.body;
  if (!title || !author) return res.status(400).json({ error: 'Название и автор обязательны' });
  const pdf_path = req.file ? `/uploads/${req.file.filename}` : null;
  const result = db.prepare(`
    INSERT INTO books (title, author, genre, description, year, cover_url, pdf_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, author, genre, description, year || null, cover_url || null, pdf_path);
  res.json({ id: result.lastInsertRowid, message: 'Книга добавлена' });
});

// POST upload PDF to existing book (admin only)
router.post('/:id/pdf', adminMiddleware, upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF файл не загружен' });
  const pdf_path = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE books SET pdf_path = ? WHERE id = ?').run(pdf_path, req.params.id);
  res.json({ message: 'PDF загружен', pdf_path });
});

// PUT edit book (admin only)
router.put('/:id', adminMiddleware, upload.single('pdf'), (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Книга не найдена' });

  const { title, author, genre, description, year, cover_url } = req.body;
  if (!title || !author) return res.status(400).json({ error: 'Название и автор обязательны' });

  let pdf_path = book.pdf_path;
  if (req.file) {
    // Delete old PDF if exists
    if (book.pdf_path) {
      const oldPath = path.join(__dirname, '../../frontend', book.pdf_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    pdf_path = `/uploads/${req.file.filename}`;
  }

  db.prepare(`
    UPDATE books SET title=?, author=?, genre=?, description=?, year=?, cover_url=?, pdf_path=?
    WHERE id=?
  `).run(title, author, genre || null, description || null, year || null, cover_url || null, pdf_path, req.params.id);

  res.json({ message: 'Книга обновлена' });
});

// DELETE book (admin only)
router.delete('/:id', adminMiddleware, (req, res) => {
  const book = db.prepare('SELECT pdf_path FROM books WHERE id = ?').get(req.params.id);
  if (book?.pdf_path) {
    const fullPath = path.join(__dirname, '../../frontend', book.pdf_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ message: 'Книга удалена' });
});

// POST borrow book (auth required)
router.post('/:id/borrow', authMiddleware, (req, res) => {
  const reader_name = req.user.username;
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Книга не найдена' });
  if (!book.available) return res.status(400).json({ error: 'Книга уже выдана' });
  db.prepare('INSERT INTO borrows (book_id, reader_name) VALUES (?, ?)').run(req.params.id, reader_name);
  db.prepare('UPDATE books SET available = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Книга выдана' });
});

// POST return book (auth required)
router.post('/:id/return', authMiddleware, (req, res) => {
  db.prepare(`UPDATE borrows SET return_date = CURRENT_TIMESTAMP WHERE book_id = ? AND return_date IS NULL`).run(req.params.id);
  db.prepare('UPDATE books SET available = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Книга возвращена' });
});

// GET genres list
router.get('/meta/genres', (req, res) => {
  const genres = db.prepare('SELECT DISTINCT genre FROM books WHERE genre IS NOT NULL').all();
  res.json(genres.map(g => g.genre));
});

module.exports = router;