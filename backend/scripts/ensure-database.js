require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function ensureDatabase() {
  const dbName = process.env.DB_NAME || 'kocumnet';
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✅ Veritabanı oluşturuldu: ${dbName}`);
  } else {
    console.log(`ℹ️ Veritabanı zaten mevcut: ${dbName}`);
  }

  await client.end();
}

ensureDatabase().catch((err) => {
  console.error('Veritabanı oluşturma hatası:', err.message);
  process.exit(1);
});
