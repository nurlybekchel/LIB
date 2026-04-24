const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'library.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    genre TEXT,
    description TEXT,
    cover_url TEXT,
    pdf_path TEXT,
    year INTEGER,
    available INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS borrows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    reader_name TEXT NOT NULL,
    borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add pdf_path column if it doesn't exist (migration)
try {
  db.exec(`ALTER TABLE books ADD COLUMN pdf_path TEXT`);
} catch(e) { /* column already exists */ }

// Seed data if empty
const count = db.prepare('SELECT COUNT(*) as cnt FROM books').get();
if (count.cnt === 0) {
  const insert = db.prepare(`
    INSERT INTO books (title, author, genre, description, year, available)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  const books = [
    ['Мастер и Маргарита', 'Михаил Булгаков', 'Классика', 'Роман о добре и зле, о любви и свободе.', 1967],
    ['1984', 'Джордж Оруэлл', 'Антиутопия', 'Мрачное будущее тоталитарного общества.', 1949],
    ['Преступление и наказание', 'Фёдор Достоевский', 'Классика', 'Психологический роман о муках совести.', 1866],
    ['Маленький принц', 'Антуан де Сент-Экзюпери', 'Философия', 'Сказка для взрослых о смысле жизни.', 1943],
    ['Гарри Поттер и философский камень', 'Дж. К. Роулинг', 'Фэнтези', 'Начало легендарной волшебной саги.', 1997],
    ['Война и мир', 'Лев Толстой', 'Классика', 'Эпопея о судьбах людей в эпоху наполеоновских войн.', 1869],
    ['Три товарища', 'Эрих Мария Ремарк', 'Драма', 'История дружбы и любви на фоне послевоенной Германии.', 1936],
    ['Дюна', 'Фрэнк Герберт', 'Фантастика', 'Космическая эпопея о власти, религии и экологии.', 1965],
  ];
  books.forEach(b => insert.run(...b));
}

module.exports = db;