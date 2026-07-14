const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { JWT_SECRET } = require('../config/env');
const { ADMIN_JWT_COOKIE } = require('../utils/authCookie');

function getAdminJwt(req) {
  const fromCookie = req.cookies?.[ADMIN_JWT_COOKIE];
  if (fromCookie && String(fromCookie).trim()) return String(fromCookie).trim();
  return null;
}

// Panele erişebilen aktif personel (admin/manager/editor/viewer — hepsi giriş yapabilir).
// Yetki farkı requireRole ile ayrı ayrı uygulanır.
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = getAdminJwt(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token bulunamadı' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: 'Geçersiz token veya hesap pasif' });
    }

    req.user = user;
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Geçersiz token' });
  }
};

// Belirli rolleri şart koşan koruma. admin her zaman geçer.
// Kullanım: router.post('/x', authenticateAdmin, requireRole('admin', 'manager'), handler)
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Kimlik doğrulanmadı' });
  }
  if (req.user.role === 'admin' || roles.includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok' });
};

// Giriş zorunlu değil; oturum açık aktif personel varsa req.isStaff işaretler.
// Blog taslaklarının panelde görünürlüğü buna bağlı.
const optionalAdmin = async (req, res, next) => {
  try {
    const token = getAdminJwt(req);
    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (user && user.is_active) {
      req.isStaff = true;
      req.isAdmin = !!user.is_admin;
      req.user = user;
      req.userId = user.id;
      req.userRole = user.role;
    }
  } catch {
    // ignore
  }
  next();
};

module.exports = {
  authenticateAdmin,
  requireRole,
  optionalAdmin,
  getAdminJwt,
};
