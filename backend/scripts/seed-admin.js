require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { User } = require('../models');

async function seedAdmin() {
  await sequelize.authenticate();
  await sequelize.sync();

  const email = (process.env.ADMIN_EMAIL || 'admin@kocumnet.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';

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

  console.log(`✅ Admin kullanıcı oluşturuldu: ${email}`);
  console.log(`   Şifre: ${password}`);
  await sequelize.close();
}

seedAdmin().catch((err) => {
  console.error('Seed hatası:', err.message);
  process.exit(1);
});
