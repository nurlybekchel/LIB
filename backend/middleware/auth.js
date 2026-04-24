const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'library_secret_key_2024';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Недействительный токен' });
  }
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Только для администратора' });
    next();
  });
}

module.exports = { authMiddleware, adminMiddleware };