const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, ContactMessage, StaffToken } = require('../models');
const { authenticateAdmin, requireRole, resolveStaff } = require('../middleware/auth');
const { setAdminAuthCookie, clearAdminAuthCookie } = require('../utils/authCookie');
const { adminLoginLimiter, writeLimiter } = require('../middleware/rateLimits');
const { normalizeRole, isValidRole } = require('../utils/roles');
const { JWT_SECRET } = require('../config/env');
const { parseId, escapeLike, asyncHandler } = require('../utils/http');
const {
  isMailConfigured,
  sendStaffInvite,
  sendStaffPasswordReset,
  sendStaffPasswordChanged,
  SITE_ADMIN_URL,
} = require('../utils/mailer');

const router = express.Router();

/** Personel işlemlerinin izi — "bu hesabı kim açtı/sildi" sorusu sorulabilsin. */
function denetimKaydi(req, eylem, ayrinti) {
  const kim = req.user ? `${req.user.email} (#${req.user.id}, ${req.user.role})` : 'bilinmiyor';
  console.log(`[denetim] ${eylem} — ${kim} — ${ayrinti}`);
}

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

const formatUser = (user) => ({
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
  last_login: user.last_login,
  created_at: user.created_at,
});

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
    { id: user.id, email: user.email, is_admin: user.is_admin, role: user.role },
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
  adminLoginLimiter,
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
      await davetYaDaSifirlamaGonder(user, req);
      denetimKaydi(req, 'parola sıfırlama istendi', `${user.email} (#${user.id})`);
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
  adminLoginLimiter,
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

    denetimKaydi(req, ilkParola ? 'davet tamamlandı' : 'parola sıfırlandı', `${user.email} (#${user.id})`);
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
    denetimKaydi(req, 'parola değiştirildi', `${user.email} (#${user.id})`);
    sendStaffPasswordChanged({ user }).catch(() => {});

    res.json({ success: true, message: 'Parolan değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.' });
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
    res.json({ success: true, data: users.map(formatUser) });
  })
);

router.get(
  '/users/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const user = id ? await User.findByPk(id) : null;
    if (!user) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    res.json({ success: true, data: formatUser(user) });
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
      is_active: b.is_active === undefined ? true : Boolean(b.is_active),
    });

    let davet = null;
    if (!parolaVar) davet = await davetYaDaSifirlamaGonder(user, req);

    denetimKaydi(req, 'kullanıcı oluşturuldu', `${user.email} (#${user.id}) rol=${user.role}${davet ? ' davet=' + (davet.sent ? 'gönderildi' : 'GÖNDERİLEMEDİ') : ''}`);

    res.status(201).json({
      success: true,
      data: formatUser(user),
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
    denetimKaydi(req, sonuc.tur === 'invite' ? 'davet yeniden gönderildi' : 'sıfırlama bağlantısı gönderildi', `${user.email} (#${user.id})`);

    if (!sonuc.sent) return res.status(502).json({ success: false, error: 'E-posta gönderilemedi. SMTP ayarlarını kontrol et.' });
    res.json({
      success: true,
      type: sonuc.tur,
      message: sonuc.tur === 'invite' ? 'Davet e-postası gönderildi.' : 'Parola sıfırlama bağlantısı gönderildi.',
    });
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
    if (b.is_active !== undefined) updateData.is_active = Boolean(b.is_active);

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

    await user.update(updateData);

    const degisenler = Object.keys(updateData)
      .filter((k) => k !== 'password_changed_at')
      .map((k) => (k === 'password_hash' ? 'parola' : k))
      .join(', ');
    denetimKaydi(req, 'kullanıcı güncellendi', `${user.email} (#${user.id}) → ${degisenler || '(değişiklik yok)'}`);

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

    const kimlik = `${user.email} (#${user.id}, ${user.role})`;
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
    denetimKaydi(req, 'kullanıcı silindi', kimlik);
    res.json({ success: true, message: 'Kullanıcı silindi' });
  })
);

// ─────────────────────────────────────────────────────────────
// İletişim mesajları (siteden gelen formlar)
// ─────────────────────────────────────────────────────────────

const MESAJ_DURUMLARI = new Set(['new', 'read', 'archived', 'spam']);
/** Yanıtlarda IP özeti ve tarayıcı bilgisi dışarı çıkmaz (KVKK: gereği kadar). */
const MESAJ_GIZLI = ['ip_hash', 'user_agent'];

const mesajDTO = (m) => {
  const j = m.toJSON();
  for (const k of MESAJ_GIZLI) delete j[k];
  return j;
};

router.get(
  '/contact-messages',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const { status, search, page, limit: limitParam } = req.query;
    const where = {};

    if (status && MESAJ_DURUMLARI.has(String(status))) where.status = String(status);
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

    const [{ count, rows }, okunmamis] = await Promise.all([
      ContactMessage.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset: (pageNum - 1) * limit,
        attributes: { exclude: MESAJ_GIZLI },
        include: [{ model: User, as: 'handler', attributes: ['id', 'first_name', 'last_name'], required: false }],
      }),
      ContactMessage.count({ where: { status: 'new' } }),
    ]);

    res.json({
      success: true,
      data: rows,
      unread: okunmamis,
      pagination: { page: pageNum, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  })
);

router.get(
  '/contact-messages/:id',
  requireRole('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const mesaj = id
      ? await ContactMessage.findByPk(id, {
          attributes: { exclude: MESAJ_GIZLI },
          include: [{ model: User, as: 'handler', attributes: ['id', 'first_name', 'last_name'], required: false }],
        })
      : null;
    if (!mesaj) return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });
    res.json({ success: true, data: mesaj });
  })
);

router.patch(
  '/contact-messages/:id',
  requireRole('admin', 'manager'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const durum = String((req.body || {}).status || '');
    if (!MESAJ_DURUMLARI.has(durum)) return res.status(400).json({ success: false, error: 'Geçersiz durum' });

    const mesaj = id ? await ContactMessage.findByPk(id) : null;
    if (!mesaj) return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });

    await mesaj.update({ status: durum, handled_by: req.userId, handled_at: new Date() });
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

    denetimKaydi(req, 'iletişim mesajı silindi', `#${mesaj.id} — ${mesaj.email}`);
    await mesaj.destroy();
    res.json({ success: true, message: 'Mesaj silindi' });
  })
);

module.exports = router;
