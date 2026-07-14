require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

// users tablosuna `role` kolonunu ekler ve mevcut admin'leri role='admin' yapar.
// Idempotent — tekrar tekrar güvenle çalıştırılabilir.
async function migrate() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'kocumnet',
  });

  await client.connect();

  await client.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'viewer'`
  );

  const admins = await client.query(
    `UPDATE users SET role = 'admin' WHERE is_admin = true AND role <> 'admin'`
  );

  // is_admin ile role tutarlılığını garanti et (admin olmayanlar viewer'a kalır)
  await client.query(
    `UPDATE users SET is_admin = (role = 'admin')`
  );

  console.log(`✅ role kolonu hazır. ${admins.rowCount} kullanıcı role='admin' olarak güncellendi.`);
  await client.end();
}

migrate().catch((err) => {
  console.error('Migration hatası:', err.message);
  process.exit(1);
});
