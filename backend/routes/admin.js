const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, fn, col } = require('sequelize');
const { User, Blog, ContactMessage, StaffToken, AuditLog, ReplyTemplate } = require('../models');
const { authenticateAdmin, requireRole, resolveStaff } = require('../middleware/auth');
const { setAdminAuthCookie, clearAdminAuthCookie } = require('../utils/authCookie');
const { adminLoginLimiter, forgotLimiter, resetLimiter, writeLimiter } = require('../middleware/rateLimits');
const { normalizeRole, isValidRole } = require('../utils/roles');
const { JWT_SECRET } = require('../config/env');
const { parseId, escapeLike, asyncHandler, toBool } = require('../utils/http');
const { denetle } = require('../utils/audit');
const {
  isMailConfigured,
  sendStaffInvite,
  sendStaffPasswordReset,
  sendStaffPasswordChanged,
  SITE_ADMIN_URL,
} = require('../utils/mailer');

const router = express.Router();

const ROL_ADI = { admin: 'Yönetici', manager: 'Müdür', editor: 'Editör', viewer: 'Görüntüleyici' };
const kisiAdi = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;

const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PAROLA = 10;
const DAVET_SAAT = 72;
const SIFIRLAMA_DAKIKA = 60;

/** Boşlukları kırpar, uzunluğu sınırlar; boşsa null. */
function metin(v, enFazla) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim().slice(0, enFazla);
  return s === '' ? null : s;
}

function epostaNormalize(v) {
  const s = String(v ?? '').trim().toLowerCase().slice(0, 255);
  return EPOSTA_DESENI.test(s) ? s : null;
}

/** Parola politikası: uzunluk + bariz zayıflar. Karmaşıklık kuralı yok (NIST). */
function parolaHatasi(p) {
  if (typeof p !== 'string') return 'Parola metin olmalı.';
  if (p.length < MIN_PAROLA) return `Parola en az ${MIN_PAROLA} karakter olmalı.`;
  if (p.length > 200) return 'Parola çok uzun.';
  if (/^(.)\1+$/.test(p) || /^(0123456789|1234567890|qwertyuiop|password|parola)/i.test(p)) {
    return 'Bu parola çok tahmin edilebilir.';
  }
  return null;
}

const formatUser = (user, davetBitis = null) => ({
  id: user.id,
  username: user.username || user.email,
  email: user.email,
  first_name: user.first_name,
  last_name: user.last_name,
  phone: user.phone,
  role: user.role,
  is_active: user.is_active,
  is_admin: user.is_admin,
  /** false ise hesap davet aşamasında: parola belirlenmedi, giriş yapamaz. */
  has_password: Boolean(user.password_hash),
  /**
   * Parolasız hesapta son davet bağlantısının bitişi; geçmişte kaldıysa
   * davet süresi dolmuştur (yeniden gönderilmeli). Hiç davet yoksa null.
   */
  invite_expires_at: user.password_hash ? null : davetBitis,
  last_login: user.last_login,
  created_at: user.created_at,
});

/** Parolasız hesapların kullanılmamış son davet bağlantısı bitişleri: Map<userId, Date>. */
async function davetBitisleri(users) {
  const idler = users.filter((u) => !u.password_hash).map((u) => u.id);
  if (idler.length === 0) return new Map();
  const satirlar = await StaffToken.findAll({
    attributes: ['user_id', [fn('MAX', col('expires_at')), 'bitis']],
    where: { user_id: idler, purpose: 'invite', used_at: null },
    group: ['user_id'],
    raw: true,
  });
  return new Map(satirlar.map((s) => [s.user_id, s.bitis]));
}

const oturumKullanicisi = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username || user.email,
  first_name: user.first_name,
  last_name: user.last_name,
  role: user.role,
  is_admin: user.is_admin,
  is_active: user.is_active,
  avatar_url: user.avatar_url,
});

function jetonImzala(user) {
  return jwt.sign(
    // ims: imza anı (ms) — oturum kapatma/parola değişikliği karşılaştırması kesin olsun (middleware/auth.js).
    { id: user.id, email: user.email, is_admin: user.is_admin, role: user.role, ims: Date.now() },
    JWT_SECRET,
    { expiresIn: '6h' }
  );
}

// ─────────────────────────────────────────────────────────────
// Tek kullanımlık bağlantı jetonları (davet / sıfırlama)
// ─────────────────────────────────────────────────────────────

const ozet = (t) => crypto.createHash('sha256').update(t).digest('hex');

/** Kullanıcının aynı amaçlı açık jetonlarını kapatır, yenisini üretir. */
async function jetonAc(user, purpose, sureMs, createdBy = null) {
  await StaffToken.update(
    { used_at: new Date() },
    { where: { user_id: user.id, purpose, used_at: null } }
  );
  const token = crypto.randomBytes(32).toString('base64url');
  await StaffToken.create({
    user_id: user.id,
    token_hash: ozet(token),
    purpose,
    expires_at: new Date(Date.now() + sureMs),
    created_by: createdBy,
  });
  return token;
}

/** Jetonu çözer: geçerliyse kayıt + kullanıcı, değilse null. */
async function jetonCoz(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const kayit = await StaffToken.findOne({
    where: { token_hash: ozet(token), used_at: null, expires_at: { [Op.gt]: new Date() } },
    include: [{ model: User, as: 'user' }],
  });
  if (!kayit || !kayit.user || !kayit.user.is_active) return null;
  return kayit;
}

const davetBaglantisi = (token) => `${SITE_ADMIN_URL}/sifre-belirle/${token}`;
const sifirlamaBaglantisi = (token) => `${SITE_ADMIN_URL}/sifre-sifirla/${token}`;

/** Davet (parola yoksa) ya da sıfırlama bağlantısı gönderir. */
async function davetYaDaSifirlamaGonder(user, req) {
  if (!user.password_hash) {
    const token = await jetonAc(user, 'invite', DAVET_SAAT * 3_600_000, req.userId);
    const davetEden = req.user ? [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') : null;
    return { tur: 'invite', ...(await sendStaffInvite({ user, link: davetBaglantisi(token), davetEden, saat: DAVET_SAAT })) };
  }
  const token = await jetonAc(user, 'reset', SIFIRLAMA_DAKIKA * 60_000, req.userId);
  return { tur: 'reset', ...(await sendStaffPasswordReset({ user, link: sifirlamaBaglantisi(token), dakika: SIFIRLAMA_DAKIKA })) };
}

// ─────────────────────────────────────────────────────────────
// Kimlik
// ─────────────────────────────────────────────────────────────

router.post(
  '/auth/login',
  adminLoginLimiter,
  asyncHandler(async (req, res) => {
    const { usernameOrEmail, password } = req.body || {};

    if (!usernameOrEmail || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, error: 'E-posta ve parola gerekli' });
    }

    // escapeLike olmadan "%" tek başına ilk kullanıcıyı eşliyordu.
    const aranan = escapeLike(String(usernameOrEmail).toLowerCase().trim().slice(0, 255));
    const user = await User.findOne({
      where: { [Op.or]: [{ email: { [Op.iLike]: aranan } }, { username: { [Op.iLike]: aranan } }] },
    });

    // Hangisinin yanlış olduğunu SÖYLEMİYORUZ (hesap var mı sorusu cevaplanmasın).
    // Kullanıcı yoksa da bir karşılaştırma yapıyoruz: yanıt süresi ele vermesin.
    const hash = user && user.is_active && user.password_hash ? user.password_hash : SAHTE_HASH;
    const dogru = await bcrypt.compare(password, hash);

    if (!user || !user.is_active || !user.password_hash || !dogru) {
      return res.status(401).json({ success: false, error: 'E-posta veya parola hatalı' });
    }

    await user.update({ last_login: new Date() });
    setAdminAuthCookie(res, jetonImzala(user));
    await denetle(req, 'auth.login', { aktor: user, hedefTur: 'user', hedefId: user.id, ozet: 'Giriş yaptı' });
    res.json({ success: true, user: oturumKullanicisi(user), message: 'Giriş başarılı' });
  })
);

/** bcrypt özeti; var olmayan hesaba karşı denemede gerçek özetle aynı maliyet. */
const SAHTE_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

router.post('/auth/logout', (req, res) => {
  clearAdminAuthCookie(res);
  res.json({ success: true, message: 'Çıkış yapıldı' });
});

router.get(
  '/auth/verify',
  asyncHandler(async (req, res) => {
    const user = await resolveStaff(req);
    if (!user) return res.status(401).json({ success: false, error: 'Oturum yok ya da geçersiz' });
    // Panel, davet formunu buna göre çizer: SMTP yoksa geçici parola alanı açılır.
    res.json({ success: true, user: oturumKullanicisi(user), features: { mail: isMailConfigured() } });
  })
);

/**
 * Parolamı unuttum. Her zaman aynı yanıt: hesabın var olup olmadığı dışarıya
 * sızmaz. SMTP yoksa dürüst 503 — "e-posta gönderildi" deyip göndermemek,
 * kullanıcıyı hesabının dışında bırakan en kötü hata.
 */
router.post(
  '/auth/forgot',
  forgotLimiter,
  asyncHandler(async (req, res) => {
    const eposta = epostaNormalize((req.body || {}).email);
    if (!eposta) return res.status(400).json({ success: false, error: 'Geçerli bir e-posta yaz.' });

    if (!isMailConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'MAIL_NOT_CONFIGURED',
        error: 'E-posta gönderimi şu an kapalı. Parolan için bir yöneticiye yaz.',
      });
    }

    const user = await User.findOne({ where: { email: eposta } });
    if (user && user.is_active) {
      // Parolası hiç olmayan (davetli) hesap için sıfırlama değil davet.
      const sonuc = await davetYaDaSifirlamaGonder(user, req);
      await denetle(req, 'auth.forgot', {
        aktor: null,
        hedefTur: 'user',
        hedefId: user.id,
        ozet: `${user.email} için ${sonuc.tur === 'invite' ? 'davet' : 'parola sıfırlama'} bağlantısı istendi${sonuc.sent ? '' : ' (posta GÖNDERİLEMEDİ)'}`,
      });
    }

    res.json({
      success: true,
      message: 'Bu adrese kayıtlı bir hesap varsa bağlantı gönderildi. Gelen kutunu ve spam klasörünü kontrol et.',
    });
  })
);

/** Bağlantı geçerli mi? Sayfa, formu göstermeden önce sorar. */
router.get(
  '/auth/token/:token',
  asyncHandler(async (req, res) => {
    const kayit = await jetonCoz(req.params.token);
    if (!kayit) {
      return res.status(410).json({ success: false, code: 'TOKEN_INVALID', error: 'Bağlantı geçersiz ya da süresi dolmuş.' });
    }
    res.json({
      success: true,
      purpose: kayit.purpose,
      email: kayit.user.email,
      name: [kayit.user.first_name, kayit.user.last_name].filter(Boolean).join(' '),
    });
  })
);

/** Davet ya da sıfırlama bağlantısıyla parola belirleme. */
router.post(
  '/auth/reset',
  resetLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body || {};
    const kayit = await jetonCoz(token);
    if (!kayit) {
      return res.status(410).json({ success: false, code: 'TOKEN_INVALID', error: 'Bağlantı geçersiz ya da süresi dolmuş.' });
    }
    const hata = parolaHatasi(password);
    if (hata) return res.status(400).json({ success: false, error: hata });

    const user = kayit.user;
    const ilkParola = !user.password_hash;
    await user.update({ password_hash: await bcrypt.hash(password, 10), password_changed_at: new Date() });
    await kayit.update({ used_at: new Date() });

    await denetle(req, ilkParola ? 'auth.invite_accept' : 'auth.password_reset', {
      aktor: user,
      hedefTur: 'user',
      hedefId: user.id,
      ozet: ilkParola ? 'Daveti kabul etti, parolasını belirledi' : 'Parolasını sıfırlama bağlantısıyla değiştirdi',
    });
    if (!ilkParola) sendStaffPasswordChanged({ user }).catch(() => {});

    res.json({ success: true, message: ilkParola ? 'Parolan belirlendi, giriş yapabilirsin.' : 'Parolan değiştirildi, giriş yapabilirsin.' });
  })
);

/** Kendi parolasını değiştirme — her rol. Açık oturumlar düşer, bu oturum yenilenir. */
router.put(
  '/auth/password',
  authenticateAdmin,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || !current_password) {
      return res.status(400).json({ success: false, error: 'Mevcut parolanı yaz.' });
    }
    const hata = parolaHatasi(new_password);
    if (hata) return res.status(400).json({ success: false, error: hata });

    const user = req.user;
    const dogru = user.password_hash && (await bcrypt.compare(current_password, user.password_hash));
    if (!dogru) return res.status(400).json({ success: false, error: 'Mevcut parola hatalı.' });
    if (await bcrypt.compare(new_password, user.password_hash)) {
      return res.status(400).json({ success: false, error: 'Yeni parola eskisiyle aynı olamaz.' });
    }

    await user.update({ password_hash: await bcrypt.hash(new_password, 10), password_changed_at: new Date() });
    // Bu cihaz açık kalsın: değişiklikten SONRA imzalanan yeni çerez.
    setAdminAuthCookie(res, jetonImzala(user));
    await denetle(req, 'auth.password_change', { hedefTur: 'user', hedefId: user.id, ozet: 'Parolasını değiştirdi' });
    sendStaffPasswordChanged({ user }).catch(() => {});

    res.json({ success: true, message: 'Parolan değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.' });
  })
);

/**
 * Bütün cihazlardaki oturumları kapat (bu cihaz hariç) — her rol, kendi
 * hesabı için. Parola değişmez. İki panelin de oturumları düşer.
 */
router.post(
  '/auth/logout-all',
  authenticateAdmin,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const user = req.user;
    await user.update({ sessions_revoked_at: new Date() });
    // Bu cihaz açık kalsın: kapatmadan SONRA imzalanan yeni çerez.
    setAdminAuthCookie(res, jetonImzala(user));
    await denetle(req, 'auth.logout_all', { hedefTur: 'user', hedefId: user.id, ozet: 'Diğer bütün cihazlardaki oturumlarını kapattı' });
    res.json({ success: true, message: 'Diğer cihazlardaki oturumlar kapatıldı. Bu cihaz açık kaldı.' });
  })
);

// Buradan sonrası oturum ister.
router.use(authenticateAdmin);

// ─────────────────────────────────────────────────────────────
// Personel hesapları
// ─────────────────────────────────────────────────────────────

router.get(
  '/users',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    // password_hash OKUNUR ama formatUser dışarı vermez: has_password bundan türüyor.
    // (Eskiden exclude ediliyordu ve herkes "davet bekliyor" görünüyordu.)
    const users = await User.findAll({ order: [['created_at', 'DESC']] });
    const davetler = await davetBitisleri(users);
    res.json({ success: true, data: users.map((u) => formatUser(u, davetler.get(u.id) || null)) });
  })
);

router.get(
  '/users/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const user = id ? await User.findByPk(id) : null;
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    const davetler = await davetBitisleri([user]);
    res.json({ success: true, data: formatUser(user, davetler.get(user.id) || null) });
  })
);

/**
 * Yeni personel. İki yol:
 *  · parola VERİLMEZSE (önerilen): hesap parolasız açılır, kişiye parola
 *    belirleme bağlantısı e-postayla gider (72 saat). Parola e-postayla ya da
 *    mesajla dolaşmaz.
 *  · parola verilirse: eskisi gibi doğrudan açılır (SMTP yokken).
 */
router.post(
  '/users',
  requireRole('admin'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const email = epostaNormalize(b.email);
    const first_name = metin(b.first_name, 100);
    const last_name = metin(b.last_name, 100);
    const username = metin(b.username, 50);
    const phone = metin(b.phone, 20);
    const parolaVar = typeof b.password === 'string' && b.password !== '';

    if (!email) return res.status(400).json({ success: false, error: 'Geçerli bir e-posta gerekli.' });
    if (!first_name || !last_name) return res.status(400).json({ success: false, error: 'Ad ve soyad gerekli.' });
    if (parolaVar) {
      const hata = parolaHatasi(b.password);
      if (hata) return res.status(400).json({ success: false, error: hata });
    } else if (!isMailConfigured()) {
      return res.status(400).json({
        success: false,
        code: 'MAIL_NOT_CONFIGURED',
        error: 'E-posta gönderimi kapalı; davet gönderilemez. Geçici bir parola belirle.',
      });
    }
    if (b.role !== undefined && !isValidRole(b.role)) {
      return res.status(400).json({ success: false, error: 'Geçersiz rol.' });
    }

    const mevcut = await User.findOne({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: escapeLike(email) } },
          ...(username ? [{ username: { [Op.iLike]: escapeLike(username) } }] : []),
        ],
      },
    });
    if (mevcut) return res.status(400).json({ success: false, error: 'Bu e-posta veya kullanıcı adı zaten kullanılıyor.' });

    const role = normalizeRole(b.role);
    const user = await User.create({
      username,
      email,
      password_hash: parolaVar ? await bcrypt.hash(b.password, 10) : null,
      first_name,
      last_name,
      phone,
      role,
      is_admin: role === 'admin',
      is_active: b.is_active === undefined ? true : toBool(b.is_active),
    });

    let davet = null;
    if (!parolaVar) davet = await davetYaDaSifirlamaGonder(user, req);

    await denetle(req, 'user.create', {
      hedefTur: 'user',
      hedefId: user.id,
      ozet: `${kisiAdi(user)} <${user.email}> hesabını açtı (${ROL_ADI[user.role] || user.role})${
        davet ? (davet.sent ? ', davet gönderildi' : ', davet postası GÖNDERİLEMEDİ') : ', geçici parolayla'
      }`,
    });

    res.status(201).json({
      success: true,
      data: formatUser(user, davet ? new Date(Date.now() + DAVET_SAAT * 3_600_000) : null),
      invited: Boolean(davet),
      invite_sent: davet ? davet.sent : null,
      message: davet
        ? davet.sent
          ? 'Hesap açıldı, davet e-postası gönderildi.'
          : 'Hesap açıldı ama davet e-postası GÖNDERİLEMEDİ. Daveti yeniden gönder.'
        : 'Kullanıcı oluşturuldu.',
    });
  })
);

/** Daveti yeniden gönder (parola yoksa) ya da sıfırlama bağlantısı yolla. */
router.post(
  '/users/:id/invite',
  requireRole('admin'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const user = id ? await User.findByPk(id) : null;
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    if (!user.is_active) return res.status(400).json({ success: false, error: 'Pasif hesaba bağlantı gönderilmez.' });
    if (!isMailConfigured()) {
      return res.status(503).json({ success: false, code: 'MAIL_NOT_CONFIGURED', error: 'E-posta gönderimi kapalı.' });
    }

    const sonuc = await davetYaDaSifirlamaGonder(user, req);
    await denetle(req, sonuc.tur === 'invite' ? 'user.invite' : 'user.reset_link', {
      hedefTur: 'user',
      hedefId: user.id,
      ozet: `${kisiAdi(user)} için ${sonuc.tur === 'invite' ? 'daveti yeniden gönderdi' : 'parola sıfırlama bağlantısı gönderdi'}${
        sonuc.sent ? '' : ' (posta GÖNDERİLEMEDİ)'
      }`,
    });

    if (!sonuc.sent) {
      return res
        .status(502)
        .json({ success: false, code: 'MAIL_SEND_FAILED', error: 'E-posta gönderilemedi. SMTP ayarlarını kontrol et.' });
    }
    res.json({
      success: true,
      type: sonuc.tur,
      message: sonuc.tur === 'invite' ? 'Davet e-postası gönderildi.' : 'Parola sıfırlama bağlantısı gönderildi.',
    });
  })
);

/** Yönetici, başka bir personelin bütün oturumlarını kapatır (kayıp cihaz, işten ayrılma). */
router.post(
  '/users/:id/revoke-sessions',
  requireRole('admin'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const user = id ? await User.findByPk(id) : null;
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    if (user.id === req.userId) {
      return res.status(400).json({ success: false, error: 'Kendi oturumların için Hesabım sayfasını kullan.' });
    }
    await user.update({ sessions_revoked_at: new Date() });
    await denetle(req, 'user.revoke_sessions', { hedefTur: 'user', hedefId: user.id, ozet: `${kisiAdi(user)}: bütün oturumlarını kapattı` });
    res.json({ success: true, message: `${kisiAdi(user)} bütün cihazlardan çıkarıldı.` });
  })
);

router.put(
  '/users/:id',
  requireRole('admin', 'manager'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const user = id ? await User.findByPk(id) : null;
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });

    const b = req.body || {};
    const isSelf = user.id === req.userId;
    const yonetici = req.user.role === 'admin';

    /*
     * RÜTBE DENETİMİ: müdür, yönetici hesabına dokunamaz. Müdür başka bir
     * hesabın e-postasını ya da parolasını da değiştiremez (eskiden
     * değiştirebiliyordu: bir müdür diğer müdürün parolasını alıp onun
     * adına işlem yapabilirdi). Kendi parolası /auth/password'den.
     */
    if (!isSelf && user.role === 'admin' && !yonetici) {
      return res.status(403).json({ success: false, error: 'Yönetici hesabını yalnızca başka bir yönetici düzenleyebilir' });
    }
    if (!yonetici && (b.password !== undefined || b.email !== undefined || b.role !== undefined)) {
      return res.status(403).json({ success: false, error: 'E-posta, parola ve rolü yalnızca yönetici değiştirebilir' });
    }
    if (isSelf && b.is_active === false) {
      return res.status(400).json({ success: false, error: 'Kendi hesabınızı pasifleştiremezsiniz' });
    }
    if (isSelf && user.role === 'admin' && b.role !== undefined && b.role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Kendi yönetici rolünüzü düşüremezsiniz' });
    }

    const updateData = {};
    if (b.email !== undefined) {
      const email = epostaNormalize(b.email);
      if (!email) return res.status(400).json({ success: false, error: 'Geçerli bir e-posta adresi girin' });
      updateData.email = email;
    }
    if (b.username !== undefined) updateData.username = metin(b.username, 50);
    if (b.first_name !== undefined) updateData.first_name = metin(b.first_name, 100);
    if (b.last_name !== undefined) updateData.last_name = metin(b.last_name, 100);
    if (b.phone !== undefined) updateData.phone = metin(b.phone, 20);
    if (b.is_active !== undefined) updateData.is_active = toBool(b.is_active);

    if (b.role !== undefined && yonetici) {
      if (!isValidRole(b.role)) return res.status(400).json({ success: false, error: 'Geçersiz rol.' });
      updateData.role = b.role;
      updateData.is_admin = b.role === 'admin';
    }

    if (typeof b.password === 'string' && b.password.trim() !== '') {
      const hata = parolaHatasi(b.password);
      if (hata) return res.status(400).json({ success: false, error: hata });
      updateData.password_hash = await bcrypt.hash(b.password, 10);
      updateData.password_changed_at = new Date();
    }

    if (updateData.email || updateData.username) {
      const mevcut = await User.findOne({
        where: {
          id: { [Op.ne]: user.id },
          [Op.or]: [
            ...(updateData.email ? [{ email: { [Op.iLike]: escapeLike(updateData.email) } }] : []),
            ...(updateData.username ? [{ username: { [Op.iLike]: escapeLike(updateData.username) } }] : []),
          ],
        },
      });
      if (mevcut) return res.status(400).json({ success: false, error: 'Bu e-posta veya kullanıcı adı zaten kullanılıyor' });
    }

    // Denetim için gerçekten DEĞİŞEN alanlar (form her kayıtta hepsini yollar).
    const ALAN_ADI = {
      email: 'e-posta',
      username: 'kullanıcı adı',
      first_name: 'ad',
      last_name: 'soyad',
      phone: 'telefon',
      password_hash: 'parola',
    };
    const eskiRol = user.role;
    const eskiAktif = user.is_active;
    const degisenler = Object.keys(updateData).filter(
      (k) => k === 'password_hash' || (ALAN_ADI[k] && (user[k] ?? null) !== (updateData[k] ?? null))
    );

    await user.update(updateData);

    const parcalar = [];
    if (updateData.role !== undefined && updateData.role !== eskiRol) {
      parcalar.push(`rol ${ROL_ADI[eskiRol] || eskiRol} → ${ROL_ADI[updateData.role] || updateData.role}`);
    }
    if (updateData.is_active !== undefined && updateData.is_active !== eskiAktif) {
      parcalar.push(updateData.is_active ? 'hesabı yeniden etkinleştirdi' : 'hesabı pasife aldı');
    }
    if (degisenler.length) parcalar.push(degisenler.map((k) => ALAN_ADI[k]).join(', ') + ' güncellendi');
    if (parcalar.length) {
      const eylem =
        updateData.role !== undefined && updateData.role !== eskiRol
          ? 'user.role'
          : updateData.is_active !== undefined && updateData.is_active !== eskiAktif
            ? updateData.is_active
              ? 'user.activate'
              : 'user.deactivate'
            : 'user.update';
      await denetle(req, eylem, { hedefTur: 'user', hedefId: user.id, ozet: `${kisiAdi(user)}: ${parcalar.join('; ')}` });
    }

    res.json({ success: true, data: formatUser(user), message: 'Kullanıcı güncellendi' });
  })
);

router.delete(
  '/users/:id',
  requireRole('admin'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const user = id ? await User.findByPk(id) : null;
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    if (user.id === req.userId) return res.status(400).json({ success: false, error: 'Kendi hesabınızı silemezsiniz' });

    const kimlik = `${kisiAdi(user)} <${user.email}> (${ROL_ADI[user.role] || user.role})`;
    try {
      await user.destroy();
    } catch (error) {
      if (error && error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(409).json({
          success: false,
          error: 'Bu kullanıcının blog yazıları var. Önce yazıları başka bir yazara aktarın ya da silin.',
        });
      }
      throw error;
    }
    await denetle(req, 'user.delete', { hedefTur: 'user', hedefId: id, ozet: `${kimlik} hesabını sildi` });
    res.json({ success: true, message: 'Kullanıcı silindi' });
  })
);

// ─────────────────────────────────────────────────────────────
// İletişim mesajları (siteden gelen formlar)
// ─────────────────────────────────────────────────────────────

/**
 * Durumlar: new (okunmadı) · read (okundu) · answered (yanıtlandı) ·
 * archived (arşiv) · spam. "Bekleyen" = new + read: henüz yanıtlanmamış ya
 * da kapatılmamış mesajlar — panelin varsayılan görünümü.
 */
const MESAJ_DURUMLARI = new Set(['new', 'read', 'answered', 'archived', 'spam']);
const BEKLEYEN = ['new', 'read'];
const DURUM_ADI = { new: 'Okunmadı', read: 'Okundu', answered: 'Yanıtlandı', archived: 'Arşiv', spam: 'Spam' };
const NOT_EN_FAZLA = 2000;
const TOPLU_EN_FAZLA = 100;

/** Yanıtlarda IP özeti ve tarayıcı bilgisi dışarı çıkmaz (KVKK: gereği kadar). */
const MESAJ_GIZLI = ['ip_hash', 'user_agent'];
const KISI_ALANLARI = ['id', 'first_name', 'last_name'];
const MESAJ_ILISKILERI = [
  { model: User, as: 'handler', attributes: KISI_ALANLARI, required: false },
  { model: User, as: 'answerer', attributes: KISI_ALANLARI, required: false },
];

const mesajDTO = (m) => {
  const j = m.toJSON();
  for (const k of MESAJ_GIZLI) delete j[k];
  return j;
};

/** "new,read" → ['new','read']; geçersizler atılır. */
function durumListesi(v) {
  return [...new Set(String(v ?? '').split(','))].map((s) => s.trim()).filter((s) => MESAJ_DURUMLARI.has(s));
}

/** Durum başına mesaj sayısı: { new: 3, read: 5, answered: 0, … } — sekmelerdeki sayılar. */
async function mesajSayilari() {
  const satirlar = await ContactMessage.findAll({
    attributes: ['status', [fn('COUNT', col('id')), 'n']],
    group: ['status'],
    raw: true,
  });
  const sayilar = Object.fromEntries([...MESAJ_DURUMLARI].map((d) => [d, 0]));
  for (const s of satirlar) if (s.status in sayilar) sayilar[s.status] = Number(s.n) || 0;
  return sayilar;
}

/** Durum değişikliğinin yazılacak alanları: kim baktı, yanıtlandıysa kim yanıtladı. */
function durumGuncellemesi(durum, req) {
  const simdi = new Date();
  return {
    status: durum,
    handled_by: req.userId,
    handled_at: simdi,
    ...(durum === 'answered' ? { answered_by: req.userId, answered_at: simdi } : {}),
  };
}

router.get(
  '/contact-messages',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { status, search, page, limit: limitParam } = req.query;
    const where = {};

    // Tek durum ("new") ya da virgüllü liste ("new,read" = bekleyenler).
    const durumlar = durumListesi(status);
    if (durumlar.length === 1) where.status = durumlar[0];
    else if (durumlar.length > 1) where.status = { [Op.in]: durumlar };

    if (search) {
      const desen = `%${escapeLike(String(search).slice(0, 100))}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: desen } },
        { email: { [Op.iLike]: desen } },
        { subject: { [Op.iLike]: desen } },
        { message: { [Op.iLike]: desen } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 25));

    const [{ count, rows }, sayilar] = await Promise.all([
      ContactMessage.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset: (pageNum - 1) * limit,
        attributes: { exclude: MESAJ_GIZLI },
        include: MESAJ_ILISKILERI,
        distinct: true,
      }),
      mesajSayilari(),
    ]);

    res.json({
      success: true,
      data: rows,
      unread: sayilar.new,
      counts: sayilar,
      pagination: { page: pageNum, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  })
);

/**
 * Toplu durum değişikliği: { ids: [1,2,3], status: 'archived' }.
 * Spam dalgası ya da toplu arşivleme için tek tek açmak gerekmesin.
 */
router.patch(
  '/contact-messages',
  requireRole('admin', 'manager'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const durum = String(b.status || '');
    if (!MESAJ_DURUMLARI.has(durum)) return res.status(400).json({ success: false, error: 'Geçersiz durum' });
    const idler = Array.isArray(b.ids) ? [...new Set(b.ids.map(parseId).filter(Boolean))] : [];
    if (idler.length === 0) return res.status(400).json({ success: false, error: 'Mesaj seçilmedi' });
    if (idler.length > TOPLU_EN_FAZLA) {
      return res.status(400).json({ success: false, error: `Tek seferde en fazla ${TOPLU_EN_FAZLA} mesaj değiştirilebilir` });
    }

    const [guncellenen] = await ContactMessage.update(durumGuncellemesi(durum, req), {
      where: { id: { [Op.in]: idler } },
    });

    if (guncellenen > 0 && durum !== 'read') {
      const liste = idler.slice(0, 10).map((i) => `#${i}`).join(', ') + (idler.length > 10 ? ', …' : '');
      await denetle(req, 'message.bulk', {
        hedefTur: 'message',
        ozet: `${guncellenen} mesajı “${DURUM_ADI[durum]}” yaptı (${liste})`,
      });
    }
    res.json({ success: true, updated: guncellenen, message: `${guncellenen} mesaj güncellendi` });
  })
);

router.get(
  '/contact-messages/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const mesaj = id
      ? await ContactMessage.findByPk(id, { attributes: { exclude: MESAJ_GIZLI }, include: MESAJ_ILISKILERI })
      : null;
    if (!mesaj) return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });

    const bekleyenBaska = { id: { [Op.ne]: mesaj.id }, status: { [Op.in]: BEKLEYEN } };
    const sira = [['created_at', 'DESC'], ['id', 'DESC']];
    const [oncekiler, sonraki] = await Promise.all([
      // Aynı adresten gelen diğer mesajlar: yanıtlarken bağlam (aynı veli ikinci kez yazmış olabilir).
      ContactMessage.findAll({
        where: { email: mesaj.email, id: { [Op.ne]: mesaj.id } },
        attributes: ['id', 'subject', 'status', 'created_at'],
        order: sira,
        limit: 5,
      }),
      // Sıradaki bekleyen mesaj (liste sırasıyla, yeniden eskiye; sonda başa döner):
      // "yanıtla, sonrakine geç" akışı.
      ContactMessage.findOne({
        where: { ...bekleyenBaska, created_at: { [Op.lte]: mesaj.created_at } },
        attributes: ['id', 'name'],
        order: sira,
      }).then((m) => m || ContactMessage.findOne({ where: bekleyenBaska, attributes: ['id', 'name'], order: sira })),
    ]);

    res.json({
      success: true,
      data: mesaj,
      related: oncekiler,
      next_waiting: sonraki ? { id: sonraki.id, name: sonraki.name } : null,
    });
  })
);

/** Tek mesaj: durum ve/veya ekip içi not. */
router.patch(
  '/contact-messages/:id',
  requireRole('admin', 'manager'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const b = req.body || {};
    const durumVar = b.status !== undefined;
    const notVar = b.note !== undefined;
    if (!durumVar && !notVar) return res.status(400).json({ success: false, error: 'Değişiklik yok' });

    const durum = durumVar ? String(b.status || '') : null;
    if (durumVar && !MESAJ_DURUMLARI.has(durum)) return res.status(400).json({ success: false, error: 'Geçersiz durum' });
    if (notVar && b.note !== null && typeof b.note !== 'string') {
      return res.status(400).json({ success: false, error: 'Not metin olmalı' });
    }
    const not = notVar ? String(b.note ?? '').trim().slice(0, NOT_EN_FAZLA) || null : undefined;

    const mesaj = id ? await ContactMessage.findByPk(id) : null;
    if (!mesaj) return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });

    const eskiDurum = mesaj.status;
    const eskiNot = mesaj.note;
    await mesaj.update({
      ...(durumVar ? durumGuncellemesi(durum, req) : {}),
      ...(notVar ? { note: not } : {}),
    });

    // Gönderenin adı denetime yazılmaz (bkz. silme): kimlik numarası yeterli, panel bağlantı verir.
    const kimden = `Mesaj #${mesaj.id}`;
    // "Okundu" denetime yazılmaz: mesajı açmak zaten okundu yapıyor, kayıt gürültüye boğulurdu.
    if (durumVar && durum !== eskiDurum && durum !== 'read') {
      await denetle(req, 'message.status', { hedefTur: 'message', hedefId: mesaj.id, ozet: `${kimden} → ${DURUM_ADI[durum]}` });
    }
    if (notVar && (not ?? null) !== (eskiNot ?? null)) {
      await denetle(req, 'message.note', {
        hedefTur: 'message',
        hedefId: mesaj.id,
        ozet: not ? `${kimden}: ekip notunu güncelledi` : `${kimden}: ekip notunu sildi`,
      });
    }

    res.json({ success: true, data: mesajDTO(mesaj) });
  })
);

router.delete(
  '/contact-messages/:id',
  requireRole('admin'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const mesaj = id ? await ContactMessage.findByPk(id) : null;
    if (!mesaj) return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });

    await mesaj.destroy();
    // Gönderenin adı/e-postası denetime YAZILMAZ: silme çoğu zaman KVKK
    // talebiyle yapılır; izde kişisel veri bırakmak talebi boşa çıkarır.
    await denetle(req, 'message.delete', { hedefTur: 'message', hedefId: id, ozet: `Mesaj #${id} kalıcı olarak silindi` });
    res.json({ success: true, message: 'Mesaj silindi' });
  })
);

// ─────────────────────────────────────────────────────────────
// Hazır yanıt şablonları (models/ReplyTemplate.js)
// ─────────────────────────────────────────────────────────────

const SABLON_DILLERI = new Set(['tr', 'en', 'ar']);
const SABLON_BASLIK_EN_FAZLA = 80;
const SABLON_GOVDE_EN_FAZLA = 3000;
const SABLON_EN_FAZLA = 100;

/**
 * Başlangıç örnekleri — yalnızca tablo boşken, düğmeyle eklenir. Fiyat,
 * paket gibi netleşmemiş konulara değinmeyen genel metinler; ekip
 * istediği gibi değiştirir.
 */
const ORNEK_SABLONLAR = [
  {
    locale: 'tr',
    title: 'Teşekkür, sizi arayacağız',
    body: 'Merhaba {ad},\n\nKoçum.Net\'e yazdığınız için teşekkür ederiz. Mesajınızı aldık; ekibimizden biri en kısa sürede sizi telefonla arayacak. Uygun olduğunuz saatleri bu e-postaya yanıt olarak yazarsanız ona göre planlarız.\n\nİyi çalışmalar,\n{imza}\nKoçum.Net',
  },
  {
    locale: 'tr',
    title: 'Ek bilgi rica',
    body: 'Merhaba {ad},\n\nMesajınız için teşekkürler. Sizi doğru yönlendirebilmemiz için birkaç bilgiye ihtiyacımız var:\n\n- Öğrencinin sınıfı ve hazırlandığı sınav\n- Size ulaşabileceğimiz telefon numarası ve uygun saatler\n\nBu bilgileri yanıt olarak gönderirseniz kısa sürede dönüş yapacağız.\n\n{imza}\nKoçum.Net',
  },
  {
    locale: 'en',
    title: 'Thanks, we will call you',
    body: 'Hello {ad},\n\nThank you for contacting Koçum.Net. We have received your message and a member of our team will call you shortly. If you reply with the times that suit you, we will plan accordingly.\n\nBest regards,\n{imza}\nKoçum.Net',
  },
  {
    locale: 'ar',
    title: 'شكراً، سنتصل بك',
    body: 'مرحباً {ad}،\n\nشكراً لتواصلك مع Koçum.Net. لقد تلقّينا رسالتك وسيتصل بك أحد أعضاء فريقنا قريباً. إذا أرسلت لنا في ردّك الأوقات المناسبة لك، سنخطّط وفقاً لذلك.\n\nمع أطيب التحيات،\n{imza}\nKoçum.Net',
  },
];

/** Şablon gövdesini doğrular; hata metni ya da temiz değerler. */
function sablonGirdisi(b) {
  const title = metin(b.title, SABLON_BASLIK_EN_FAZLA);
  const locale = String(b.locale || '').trim().toLowerCase();
  // Gövde düz metin; satır sonları korunur, yalnızca uçlar kırpılır.
  const body = typeof b.body === 'string' ? b.body.replace(/\r\n/g, '\n').trim() : '';
  if (!title) return { hata: 'Şablona bir ad ver.' };
  if (!SABLON_DILLERI.has(locale)) return { hata: 'Dil tr, en ya da ar olmalı.' };
  if (!body) return { hata: 'Şablon metni boş olamaz.' };
  if (body.length > SABLON_GOVDE_EN_FAZLA) return { hata: `Şablon metni en fazla ${SABLON_GOVDE_EN_FAZLA} karakter olabilir.` };
  const sira = Number.isInteger(Number(b.sort_order)) ? Math.max(0, Math.min(999, Number(b.sort_order))) : 0;
  return { deger: { title, locale, body, sort_order: sira } };
}

router.get(
  '/reply-templates',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const dil = String(req.query.locale || '').trim().toLowerCase();
    const rows = await ReplyTemplate.findAll({
      where: SABLON_DILLERI.has(dil) ? { locale: dil } : {},
      order: [['locale', 'ASC'], ['sort_order', 'ASC'], ['title', 'ASC']],
      limit: SABLON_EN_FAZLA,
    });
    res.json({ success: true, data: rows });
  })
);

router.post(
  '/reply-templates',
  requireRole('admin', 'manager'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { hata, deger } = sablonGirdisi(req.body || {});
    if (hata) return res.status(400).json({ success: false, error: hata });
    if ((await ReplyTemplate.count()) >= SABLON_EN_FAZLA) {
      return res.status(400).json({ success: false, error: `En fazla ${SABLON_EN_FAZLA} şablon tutulabilir.` });
    }
    const sablon = await ReplyTemplate.create({ ...deger, created_by: req.userId, updated_by: req.userId });
    await denetle(req, 'message.template_create', {
      hedefTur: 'message',
      ozet: `Hazır yanıt şablonu ekledi: “${sablon.title}” (${sablon.locale.toUpperCase()})`,
    });
    res.status(201).json({ success: true, data: sablon, message: 'Şablon eklendi.' });
  })
);

/** Tablo boşken başlangıç örneklerini ekler (her dilde genel metinler). */
router.post(
  '/reply-templates/samples',
  requireRole('admin', 'manager'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    if ((await ReplyTemplate.count()) > 0) {
      return res.status(400).json({ success: false, error: 'Zaten şablon var; örnekler yalnızca boş listeye eklenir.' });
    }
    const eklenen = await ReplyTemplate.bulkCreate(
      ORNEK_SABLONLAR.map((s, i) => ({ ...s, sort_order: i, created_by: req.userId, updated_by: req.userId }))
    );
    await denetle(req, 'message.template_create', {
      hedefTur: 'message',
      ozet: `${eklenen.length} örnek hazır yanıt şablonu ekledi`,
    });
    res.status(201).json({ success: true, data: eklenen, message: `${eklenen.length} örnek şablon eklendi.` });
  })
);

router.put(
  '/reply-templates/:id',
  requireRole('admin', 'manager'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const sablon = id ? await ReplyTemplate.findByPk(id) : null;
    if (!sablon) return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    const { hata, deger } = sablonGirdisi(req.body || {});
    if (hata) return res.status(400).json({ success: false, error: hata });
    await sablon.update({ ...deger, updated_by: req.userId });
    await denetle(req, 'message.template_update', {
      hedefTur: 'message',
      ozet: `Hazır yanıt şablonunu güncelledi: “${sablon.title}” (${sablon.locale.toUpperCase()})`,
    });
    res.json({ success: true, data: sablon, message: 'Şablon kaydedildi.' });
  })
);

router.delete(
  '/reply-templates/:id',
  requireRole('admin', 'manager'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const sablon = id ? await ReplyTemplate.findByPk(id) : null;
    if (!sablon) return res.status(404).json({ success: false, error: 'Şablon bulunamadı' });
    await sablon.destroy();
    await denetle(req, 'message.template_delete', {
      hedefTur: 'message',
      ozet: `Hazır yanıt şablonunu sildi: “${sablon.title}” (${sablon.locale.toUpperCase()})`,
    });
    res.json({ success: true, message: 'Şablon silindi.' });
  })
);

// ─────────────────────────────────────────────────────────────
// Genel bakış sayıları
// ─────────────────────────────────────────────────────────────

/**
 * Genel bakış ve kenar çubuğundaki sayı için TEK çağrı. Eskiden genel bakış
 * beş ayrı liste isteği atıyordu (yalnızca toplamları okumak için 25'er
 * satır çekerek); kenar çubuğu da her sayfada bir liste daha.
 * Rol neyi görebiliyorsa onu döner: editör mesaj ve personel sayısını görmez.
 */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const yonetim = req.user.role === 'admin' || req.user.role === 'manager';

    const blogSatirlari = await Blog.findAll({
      attributes: ['is_published', [fn('COUNT', col('id')), 'n']],
      group: ['is_published'],
      raw: true,
    });
    const blogs = { published: 0, draft: 0 };
    for (const s of blogSatirlari) blogs[s.is_published ? 'published' : 'draft'] += Number(s.n) || 0;

    let messages = null;
    let staff = null;
    if (yonetim) {
      const [sayilar, enEski, kisiler] = await Promise.all([
        mesajSayilari(),
        ContactMessage.min('created_at', { where: { status: { [Op.in]: BEKLEYEN } } }),
        User.findAll({ attributes: ['id', 'is_active', 'password_hash'] }),
      ]);
      messages = {
        counts: sayilar,
        unread: sayilar.new,
        waiting: sayilar.new + sayilar.read,
        oldest_waiting_at: enEski || null,
      };

      const davetliler = kisiler.filter((u) => u.is_active && !u.password_hash);
      const bitisler = await davetBitisleri(davetliler);
      const simdi = Date.now();
      staff = {
        total: kisiler.length,
        active: kisiler.filter((u) => u.is_active && u.password_hash).length,
        invited: davetliler.length,
        invite_expired: davetliler.filter((u) => {
          const bitis = bitisler.get(u.id);
          return !bitis || new Date(bitis).getTime() < simdi;
        }).length,
      };
    }

    res.json({ success: true, data: { blogs, messages, staff } });
  })
);

// ─────────────────────────────────────────────────────────────
// Denetim kaydı (etkinlik)
// ─────────────────────────────────────────────────────────────

const DENETIM_ALANLARI = new Set(['blog', 'message', 'user', 'auth']);

/**
 * Yönetici her şeyi görür. Diğer roller yalnızca TEK BİR YAZININ geçmişini
 * (?target_type=blog&target_id=12): "bu yazıyı kim, ne zaman değiştirdi" —
 * e-posta adresleri olmadan.
 */
router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const q = req.query;
    const yonetici = req.user.role === 'admin';
    const hedefTur = typeof q.target_type === 'string' ? q.target_type : '';
    const hedefId = parseId(q.target_id);

    if (!yonetici && !(hedefTur === 'blog' && hedefId)) {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok' });
    }

    const where = {};
    if (typeof q.area === 'string' && DENETIM_ALANLARI.has(q.area)) where.action = { [Op.startsWith]: `${q.area}.` };
    if (DENETIM_ALANLARI.has(hedefTur)) where.target_type = hedefTur;
    if (hedefId) where.target_id = hedefId;
    const aktor = parseId(q.actor_id);
    if (aktor && yonetici) where.actor_id = aktor;

    const pageNum = Math.max(1, parseInt(q.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 50));

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (pageNum - 1) * limit,
      include: [{ model: User, as: 'actor', attributes: KISI_ALANLARI, required: false }],
    });

    const data = rows.map((r) => {
      const j = r.toJSON();
      if (!yonetici) delete j.actor_email;
      return j;
    });

    res.json({
      success: true,
      data,
      pagination: { page: pageNum, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  })
);

module.exports = router;
