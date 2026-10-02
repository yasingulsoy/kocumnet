require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { User } = require('../models');

async function seedAdmin() {
  await sequelize.authenticate();
  await sequelize.sync();

  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');

  /*
   * Varsayılan değer YOK. Eskiden ADMIN_PASSWORD boşsa "Admin123!" ile hesap
   * açılıyor ve parola ekrana yazılıyordu — depoda geçen bir parolayla
   * üretimde yönetici hesabı.
   */
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error('ADMIN_EMAIL tanımlı değil ya da geçersiz.');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD en az 12 karakter olmalı (ortam değişkeni olarak ver, dosyaya yazma).');
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    console.log(`ℹ️ Admin kullanıcı zaten mevcut: ${email}`);
    await sequelize.close();
    return;
  }

  await User.create({
    email,
    username: 'admin',
    password_hash: await bcrypt.hash(password, 10),
    first_name: 'Admin',
    last_name: 'Kocumnet',
    role: 'admin',
    is_admin: true,
    is_active: true,
  });

  console.log(`✅ Yönetici hesabı oluşturuldu: ${email}`);
  console.log('   İlk girişten sonra parolayı panelden değiştir ve ADMIN_PASSWORD değişkenini sil.');
  await sequelize.close();
}

seedAdmin().catch((err) => {
  console.error('Seed hatası:', err.message);
  process.exit(1);
});
