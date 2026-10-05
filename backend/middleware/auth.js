const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { JWT_SECRET } = require('../config/env');
const { ADMIN_JWT_COOKIE } = require('../utils/authCookie');

function getAdminJwt(req) {
  const fromCookie = req.cookies?.[ADMIN_JWT_COOKIE];
  if (fromCookie && String(fromCookie).trim()) return String(fromCookie).trim();
  return null;
}

/**
 * Jeton, parolanın son değiştiği ya da "bütün oturumları kapat" denildiği
 * andan önce imzalanmışsa geçersiz.
 *
 * Yeni jetonlar milisaniyelik imza anını taşır (`ims`): karşılaştırma kesin.
 * Eski jetonlarda yalnızca saniyelik `iat` var; onlara 1 saniye pay tanınır
 * (parola değişip hemen yeni çerez verildiğinde iat aynı saniyeye düşebiliyor)
 * — o payın içinde kapatılmadan hemen önce açılmış oturum ayakta kalıyordu.
 */
function jetonEskimis(decoded, user) {
  const sinirlar = [user.password_changed_at, user.sessions_revoked_at]
    .filter(Boolean)
    .map((t) => new Date(t).getTime());
  if (sinirlar.length === 0) return false;
  const sinir = Math.max(...sinirlar);
  if (Number.isFinite(decoded.ims)) return decoded.ims < sinir;
  const iatMs = Number(decoded.iat || 0) * 1000;
  return iatMs + 1000 < sinir;
}

/**
 * Çerezdeki jetonu çözer ve aktif personeli döndürür; yoksa null.
 * Veritabanı hatası 401 DEĞİL — fırlatır. Eskiden her hata 401'e düşüyordu
 * ve geçici bir DB kesintisi herkesi "çıkış yapmış" gösteriyordu.
 */
async function resolveStaff(req) {
  const token = getAdminJwt(req);
  if (!token) return null;
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  const user = await User.findByPk(decoded.id);
  if (!user || !user.is_active || jetonEskimis(decoded, user)) return null;
  return user;
}

// Panele erişebilen aktif personel (admin/manager/editor/viewer — hepsi giriş yapabilir).
// Yetki farkı requireRole ile ayrı ayrı uygulanır.
const authenticateAdmin = async (req, res, next) => {
  try {
    const user = await resolveStaff(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Oturum yok ya da geçersiz' });
    }
    req.user = user;
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (e) {
    next(e);
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
    const user = await resolveStaff(req);
    if (user) {
      req.isStaff = true;
      req.isAdmin = !!user.is_admin;
      req.user = user;
      req.userId = user.id;
      req.userRole = user.role;
    }
  } catch {
    // Oturum isteğe bağlı: hata olursa misafir gibi devam.
  }
  next();
};

module.exports = {
  authenticateAdmin,
  requireRole,
  optionalAdmin,
  getAdminJwt,
  resolveStaff,
};
