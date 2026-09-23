const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, ContactMessage } = require('../models');
const { authenticateAdmin, requireRole, getAdminJwt } = require('../middleware/auth');
const { setAdminAuthCookie, clearAdminAuthCookie } = require('../utils/authCookie');
const { adminLoginLimiter, writeLimiter } = require('../middleware/rateLimits');
const { normalizeRole } = require('../utils/roles');
const { JWT_SECRET } = require('../config/env');
const { parseId, escapeLike, asyncHandler } = require('../utils/http');

const router = express.Router();

/** Personel işlemlerinin izi — "bu hesabı kim açtı/sildi" sorusu sorulabilsin. */
function denetimKaydi(req, eylem, ayrinti) {
  const kim = req.user ? `${req.user.email} (#${req.user.id}, ${req.user.role})` : 'bilinmiyor';
  console.log(`[denetim] ${eylem} — ${kim} — ${ayrinti}`);
}

router.post('/auth/login', adminLoginLimiter, async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Kullanıcı adı/email ve şifre gereklidir',
      });
    }

    // escapeLike olmadan "%" tek başına ilk kullanıcıyı eşliyordu: saldırgan
    // hangi hesaba denk geldiğini bilmeden parola denemesi yapabiliyordu.
    const searchTerm = escapeLike(String(usernameOrEmail).toLowerCase().trim().slice(0, 255));
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: searchTerm } },
          { username: { [Op.iLike]: searchTerm } },
        ],
      },
    });

    if (!user || !user.is_active || !user.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'Kullanıcı adı veya şifre hatalı',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Kullanıcı adı veya şifre hatalı',
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: user.is_admin, role: user.role },
      JWT_SECRET,
      { expiresIn: '6h' }
    );

    await user.update({ last_login: new Date() });

    const userData = {
      id: user.id,
      email: user.email,
      username: user.username || user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_admin: user.is_admin,
      is_active: user.is_active,
      avatar_url: user.avatar_url,
    };

    setAdminAuthCookie(res, token);
    res.json({ success: true, user: userData, message: 'Giriş başarılı' });
  } catch (error) {
    console.error('Admin login hatası:', error);
    res.status(500).json({ success: false, error: 'Giriş sırasında bir hata oluştu' });
  }
});

router.post('/auth/logout', (req, res) => {
  clearAdminAuthCookie(res);
  res.json({ success: true, message: 'Çıkış yapıldı' });
});

router.get('/auth/verify', async (req, res) => {
  try {
    const token = getAdminJwt(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token bulunamadı' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: 'Geçersiz token' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username || user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_admin: user.is_admin,
        is_active: user.is_active,
        avatar_url: user.avatar_url,
      },
    });
  } catch {
    res.status(401).json({ success: false, error: 'Geçersiz token' });
  }
});

router.use(authenticateAdmin);

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
  created_at: user.created_at,
});

router.get('/users', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const users = await User.findAll({
      order: [['created_at', 'DESC']],
      attributes: { exclude: ['password_hash'] },
    });

    res.json({ success: true, data: users.map(formatUser) });
  } catch (error) {
    console.error('Kullanıcı listesi hatası:', error);
    res.status(500).json({ success: false, error: 'Kullanıcılar yüklenirken bir hata oluştu' });
  }
});

router.get('/users/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    res.json({ success: true, data: formatUser(user) });
  } catch (error) {
    console.error('Kullanıcı getirme hatası:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı bilgileri yüklenirken bir hata oluştu' });
  }
});

const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PAROLA = 8;

router.post('/users', requireRole('admin'), writeLimiter, async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, phone, role, is_active } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'E-posta, şifre, ad ve soyad gereklidir',
      });
    }
    if (!EPOSTA_DESENI.test(String(email).trim())) {
      return res.status(400).json({ success: false, error: 'Geçerli bir e-posta adresi girin' });
    }
    if (String(password).length < MIN_PAROLA) {
      return res.status(400).json({
        success: false,
        error: `Parola en az ${MIN_PAROLA} karakter olmalı`,
      });
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: escapeLike(email) } },
          ...(username ? [{ username: { [Op.iLike]: escapeLike(username) } }] : []),
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Bu e-posta veya kullanıcı adı zaten kullanılıyor',
      });
    }

    const safeRole = normalizeRole(role);
    const user = await User.create({
      username,
      email,
      password_hash: await bcrypt.hash(password, 10),
      first_name,
      last_name,
      phone,
      role: safeRole,
      is_admin: safeRole === 'admin',
      is_active: is_active !== undefined ? is_active : true,
    });

    denetimKaydi(req, 'kullanıcı oluşturuldu', `${user.email} (#${user.id}) rol=${user.role}`);

    res.status(201).json({
      success: true,
      data: formatUser(user),
      message: 'Kullanıcı başarıyla oluşturuldu',
    });
  } catch (error) {
    console.error('Kullanıcı oluşturma hatası:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı oluşturulurken bir hata oluştu' });
  }
});

router.put('/users/:id', requireRole('admin', 'manager'), writeLimiter, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    const { username, email, password, first_name, last_name, phone, role, is_active } = req.body;

    const isSelf = user.id === req.userId;

    /*
     * RÜTBE DENETİMİ: müdür, yönetici hesabına dokunamaz.
     * Eskiden yoktu — bir müdür yöneticinin PAROLASINI değiştirip (ya da
     * e-postasını alıp, ya da hesabı pasifleştirip) yönetici olarak
     * giriş yapabiliyordu. Yetki yükseltme.
     */
    if (!isSelf && user.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Yönetici hesabını yalnızca başka bir yönetici düzenleyebilir',
      });
    }
    if (isSelf && is_active === false) {
      return res.status(400).json({ success: false, error: 'Kendi hesabınızı pasifleştiremezsiniz' });
    }
    if (isSelf && user.role === 'admin' && role !== undefined && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Kendi yönetici rolünüzü düşüremezsiniz' });
    }

    if (email !== undefined && !EPOSTA_DESENI.test(String(email).trim())) {
      return res.status(400).json({ success: false, error: 'Geçerli bir e-posta adresi girin' });
    }

    if (email || username) {
      const existingUser = await User.findOne({
        where: {
          id: { [Op.ne]: user.id },
          [Op.or]: [
            ...(email ? [{ email: { [Op.iLike]: escapeLike(email) } }] : []),
            ...(username ? [{ username: { [Op.iLike]: escapeLike(username) } }] : []),
          ],
        },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Bu e-posta veya kullanıcı adı zaten kullanılıyor',
        });
      }
    }

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (phone !== undefined) updateData.phone = phone;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Rol/yetki değişimi yalnızca admin tarafından yapılabilir (manager'da alan devre dışı).
    if (role !== undefined && req.user.role === 'admin') {
      const safeRole = normalizeRole(role);
      updateData.role = safeRole;
      updateData.is_admin = safeRole === 'admin';
    }

    if (password && password.trim() !== '') {
      if (String(password).length < MIN_PAROLA) {
        return res.status(400).json({
          success: false,
          error: `Parola en az ${MIN_PAROLA} karakter olmalı`,
        });
      }
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    await user.update(updateData);

    const degisenler = Object.keys(updateData)
      .map((k) => (k === 'password_hash' ? 'parola' : k))
      .join(', ');
    denetimKaydi(req, 'kullanıcı güncellendi', `${user.email} (#${user.id}) → ${degisenler}`);

    res.json({
      success: true,
      data: formatUser(user),
      message: 'Kullanıcı başarıyla güncellendi',
    });
  } catch (error) {
    console.error('Kullanıcı güncelleme hatası:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı güncellenirken bir hata oluştu' });
  }
});

router.delete('/users/:id', requireRole('admin'), writeLimiter, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    if (user.id === req.userId) {
      return res.status(400).json({
        success: false,
        error: 'Kendi hesabınızı silemezsiniz',
      });
    }

    const kimlik = `${user.email} (#${user.id}, ${user.role})`;
    await user.destroy();
    denetimKaydi(req, 'kullanıcı silindi', kimlik);

    res.json({ success: true, message: 'Kullanıcı başarıyla silindi' });
  } catch (error) {
    console.error('Kullanıcı silme hatası:', error);
    // Yazıları olan bir kullanıcı silinmek istendiğinde yabancı anahtar
    // kısıtı hata veriyordu; kullanıcıya ne yapacağını söylüyoruz.
    if (error && error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(409).json({
        success: false,
        error:
          'Bu kullanıcının blog yazıları var. Önce yazıları başka bir yazara aktarın ya da silin.',
      });
    }
    res.status(500).json({ success: false, error: 'Kullanıcı silinirken bir hata oluştu' });
  }
});

// ─────────────────────────────────────────────────────────────
// İletişim mesajları (siteden gelen formlar)
// ─────────────────────────────────────────────────────────────

const MESAJ_DURUMLARI = new Set(['new', 'read', 'archived', 'spam']);

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
        { message: { [Op.iLike]: desen } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 25));

    const { count, rows } = await ContactMessage.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset: (pageNum - 1) * limit,
      attributes: { exclude: ['ip_hash', 'user_agent'] },
    });

    const okunmamis = await ContactMessage.count({ where: { status: 'new' } });

    res.json({
      success: true,
      data: rows,
      unread: okunmamis,
      pagination: { page: pageNum, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  })
);

router.patch(
  '/contact-messages/:id',
  requireRole('admin', 'manager'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });

    const durum = String((req.body || {}).status || '');
    if (!MESAJ_DURUMLARI.has(durum)) {
      return res.status(400).json({ success: false, error: 'Geçersiz durum' });
    }

    const mesaj = await ContactMessage.findByPk(id);
    if (!mesaj) return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });

    await mesaj.update({
      status: durum,
      handled_by: req.userId,
      handled_at: new Date(),
    });

    res.json({ success: true, data: mesaj });
  })
);

router.delete(
  '/contact-messages/:id',
  requireRole('admin'),
  writeLimiter,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });

    const mesaj = await ContactMessage.findByPk(id);
    if (!mesaj) return res.status(404).json({ success: false, error: 'Mesaj bulunamadı' });

    denetimKaydi(req, 'iletişim mesajı silindi', `#${mesaj.id} — ${mesaj.email}`);
    await mesaj.destroy();

    res.json({ success: true, message: 'Mesaj silindi' });
  })
);

module.exports = router;
