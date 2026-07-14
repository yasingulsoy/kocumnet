const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User } = require('../models');
const { authenticateAdmin, requireRole, getAdminJwt } = require('../middleware/auth');
const { setAdminAuthCookie, clearAdminAuthCookie } = require('../utils/authCookie');
const { adminLoginLimiter } = require('../middleware/authRateLimit');
const { normalizeRole } = require('../utils/roles');
const { JWT_SECRET } = require('../config/env');

const router = express.Router();

router.post('/auth/login', adminLoginLimiter, async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Kullanıcı adı/email ve şifre gereklidir',
      });
    }

    const searchTerm = usernameOrEmail.toLowerCase().trim();
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
    const user = await User.findByPk(req.params.id, {
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

router.post('/users', requireRole('admin'), async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, phone, role, is_active } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'E-posta, şifre, ad ve soyad gereklidir',
      });
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: email } },
          ...(username ? [{ username: { [Op.iLike]: username } }] : []),
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

    res.json({
      success: true,
      data: formatUser(user),
      message: 'Kullanıcı başarıyla oluşturuldu',
    });
  } catch (error) {
    console.error('Kullanıcı oluşturma hatası:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı oluşturulurken bir hata oluştu' });
  }
});

router.put('/users/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    const { username, email, password, first_name, last_name, phone, role, is_active } = req.body;

    const isSelf = user.id === req.userId;
    if (isSelf && is_active === false) {
      return res.status(400).json({ success: false, error: 'Kendi hesabınızı pasifleştiremezsiniz' });
    }
    if (isSelf && user.role === 'admin' && role !== undefined && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Kendi yönetici rolünüzü düşüremezsiniz' });
    }

    if (email || username) {
      const existingUser = await User.findOne({
        where: {
          id: { [Op.ne]: user.id },
          [Op.or]: [
            ...(email ? [{ email: { [Op.iLike]: email } }] : []),
            ...(username ? [{ username: { [Op.iLike]: username } }] : []),
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
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    await user.update(updateData);
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

router.delete('/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    if (user.id === req.userId) {
      return res.status(400).json({
        success: false,
        error: 'Kendi hesabınızı silemezsiniz',
      });
    }

    await user.destroy();
    res.json({ success: true, message: 'Kullanıcı başarıyla silindi' });
  } catch (error) {
    console.error('Kullanıcı silme hatası:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı silinirken bir hata oluştu' });
  }
});

module.exports = router;
