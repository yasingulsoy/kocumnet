/**
 * Eksik indeksleri ve yabancı anahtar davranışlarını kurar.
 *
 *   npm run db:indexes
 *
 * Neden ayrı betik: şema `sequelize.sync()` ile yönetiliyor ve `alter`
 * varsayılan olarak KAPALI (açık olsaydı her açılışta tabloları yeniden
 * yazardı — üretimde riskli). Yeni indeks eklemenin güvenli yolu bu:
 * her komut "varsa dokunma" biçiminde, defalarca çalıştırılabilir.
 */
require('../config/env');
const { sequelize } = require('../config/database');

const KOMUTLAR = [
  // Blog listesi her sayfa açılışında is_published + locale süzüyor ve
  // created_at'e göre sıralıyordu; indekssiz tam tarama + sıralama yapıyordu.
  {
    ad: 'blogs(is_published, created_at)',
    sql: 'CREATE INDEX IF NOT EXISTS blogs_published_created_idx ON blogs (is_published, created_at DESC)',
  },
  {
    ad: 'blogs(locale, is_published, created_at)',
    sql: 'CREATE INDEX IF NOT EXISTS blogs_locale_published_created_idx ON blogs (locale, is_published, created_at DESC)',
  },
  {
    ad: 'blogs(author_id)',
    sql: 'CREATE INDEX IF NOT EXISTS blogs_author_idx ON blogs (author_id)',
  },
  {
    ad: 'contact_messages(status, created_at)',
    sql: 'CREATE INDEX IF NOT EXISTS contact_messages_status_created_idx ON contact_messages (status, created_at DESC)',
  },
  // Yazısı olan kullanıcı silinince yabancı anahtar hatası dönüyordu.
  // Doğru davranış: yazı kalsın, yazarı boşalsın.
  {
    ad: 'blogs.author_id → ON DELETE SET NULL',
    sql: `DO $$
      DECLARE kisit text;
      BEGIN
        SELECT conname INTO kisit
        FROM pg_constraint
        WHERE conrelid = 'blogs'::regclass AND contype = 'f'
          AND pg_get_constraintdef(oid) LIKE '%author_id%';
        IF kisit IS NOT NULL AND (
          SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = kisit
        ) NOT LIKE '%ON DELETE SET NULL%' THEN
          EXECUTE format('ALTER TABLE blogs DROP CONSTRAINT %I', kisit);
          ALTER TABLE blogs
            ADD CONSTRAINT blogs_author_id_fkey
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;`,
  },
];

(async () => {
  await sequelize.authenticate();
  for (const { ad, sql } of KOMUTLAR) {
    process.stdout.write(`· ${ad} … `);
    await sequelize.query(sql);
    console.log('tamam');
  }
  await sequelize.close();
  console.log('\nTüm indeksler yerinde.');
})().catch((e) => {
  console.error('\nHata:', e.message);
  process.exit(1);
});
