const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminMiddleware } = require('../middleware/auth');

// GET all users
router.get('/users', adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, username, email, role, created_at FROM users').all();
  res.json(users);
});

// DELETE user
router.delete('/users/:id', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Пользователь удалён' });
});

// PATCH change user role
router.patch('/users/:id/role', adminMiddleware, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Неверная роль' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'Роль обновлена' });
});

// GET stats
router.get('/stats', adminMiddleware, (req, res) => {
  const totalBooks = db.prepare('SELECT COUNT(*) as cnt FROM books').get().cnt;
  const totalUsers = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  const totalBorrows = db.prepare('SELECT COUNT(*) as cnt FROM borrows').get().cnt;
  const activeBorrows = db.prepare('SELECT COUNT(*) as cnt FROM borrows WHERE return_date IS NULL').get().cnt;
  const booksWithPdf = db.prepare('SELECT COUNT(*) as cnt FROM books WHERE pdf_path IS NOT NULL').get().cnt;
  res.json({ totalBooks, totalUsers, totalBorrows, activeBorrows, booksWithPdf });
});

// GET all borrows
router.get('/borrows', adminMiddleware, (req, res) => {
  const borrows = db.prepare(`
    SELECT b.id, b.reader_name, b.borrow_date, b.return_date,
           bk.title, bk.author
    FROM borrows b
    JOIN books bk ON b.book_id = bk.id
    ORDER BY b.borrow_date DESC
    LIMIT 50
  `).all();
  res.json(borrows);
});

module.exports = router;