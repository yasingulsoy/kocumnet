const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

const CSRF_HEADER = 'x-csrf-token';
const CSRF_CLAIM = 'csrf';

function createCsrfToken() {
  return jwt.sign({ t: CSRF_CLAIM }, JWT_SECRET, { expiresIn: '12h' });
}

function verifyCsrfToken(token) {
  if (!token || typeof token !== 'string') return false;
  try {
    const decoded = jwt.verify(String(token).trim(), JWT_SECRET);
    return decoded && decoded.t === CSRF_CLAIM;
  } catch {
    return false;
  }
}

function csrfProtection(req, res, next) {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProd && String(process.env.CSRF_DISABLED || '').trim() === '1') {
    return next();
  }

  const path = (req.originalUrl || req.url || '').split('?')[0] || '';
  if (!path.startsWith('/api')) return next();

  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const headerVal = req.get(CSRF_HEADER);
  if (!verifyCsrfToken(headerVal)) {
    return res.status(403).json({
      success: false,
      code: 'CSRF_FAILED',
      error: 'CSRF doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.',
    });
  }

  return next();
}

module.exports = {
  CSRF_HEADER,
  createCsrfToken,
  verifyCsrfToken,
  csrfProtection,
};
