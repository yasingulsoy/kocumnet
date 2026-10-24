/**
 * İletişim mesajları: saklama süresi (anonimleştirme) ve otomatik yanıt.
 *
 *   NODE_ENV=development SMTP_URL=log://console npm run test:contact
 *
 * Veritabanına kendi satırlarını yazar ve siler; sunucu istemez. Yalnızca
 * geliştirmede ve adında "test" geçen bir veritabanında çalışır
 * (DB_NAME=kocumnet_site_test npm run db:ensure).
 */
require('../config/env');
const { IS_PRODUCTION } = require('../config/env');

if (IS_PRODUCTION) {
  console.error('✗ Bu test yalnızca NODE_ENV=development ile çalışır (veritabanına yazar).');
  process.exit(1);
}
// Anonimleştirme bütün tabloya uygulanır: geliştirme veritabanındaki eski
// mesajlar da boşalırdı. Adında "test" geçmeyen veritabanında durur.
if (!/test/i.test(String(process.env.DB_NAME || '')) && !process.argv.includes('--zorla')) {
  console.error('✗ DB_NAME adında "test" geçmiyor. Geçici bir veritabanında koşun, ör:');
  console.error('  DB_NAME=kocumnet_site_test npm run db:ensure && DB_NAME=kocumnet_site_test npm run test:contact');
  console.error('  (bilerek başka veritabanında: npm run test:contact -- --zorla)');
  process.exit(1);
}

const { sequelize, testConnection, syncDatabase, closeConnection } = require('../config/database');
const { ContactMessage } = require('../models');
const { iletisimMesajlariniAnonimlestir, otoYanitGitsinMi, ANONIM_MESAJ } = require('../utils/contactMessages');
const { sendContactAutoReply } = require('../utils/mailer');

let kalan = 0;
function ok(ad, kosul, ayrinti = '') {
  console.log(kosul ? '  ✓' : '  ✗', ad, !kosul && ayrinti ? '→ ' + ayrinti : '');
  if (!kosul) kalan++;
}

const GUN = 24 * 60 * 60 * 1000;
const etiket = Date.now().toString(36);
const olusturulan = [];

async function mesaj(durum, gunOnce, ek = {}) {
  const m = await ContactMessage.create({
    name: `Deneme ${etiket}`,
    email: `saklama-${etiket}-${olusturulan.length}@kocum.local`,
    phone: '05000000000',
    subject: 'Konu',
    message: `Gizli mesaj ${etiket}`,
    note: 'Telefonla arandı',
    ip_hash: 'a'.repeat(32),
    user_agent: 'deneme',
    status: durum,
    ...ek,
  });
  olusturulan.push(m.id);
  // created_at'i Sequelize create'te ezer; geçmişe elle çekiyoruz.
  await sequelize.query('UPDATE contact_messages SET created_at = :t WHERE id = :id', {
    replacements: { t: new Date(Date.now() - gunOnce * GUN), id: m.id },
  });
  return m.id;
}

async function main() {
  await testConnection();
  await syncDatabase();

  console.log('\nSaklama süresi (varsayılan 730 gün, spam 90):');
  const eskiYanit = await mesaj('answered', 800);
  const eskiArsiv = await mesaj('archived', 731);
  const yeniArsiv = await mesaj('archived', 100);
  const eskiYeni = await mesaj('new', 800);
  const eskiOkundu = await mesaj('read', 800);
  const eskiSpam = await mesaj('spam', 91);
  const yeniSpam = await mesaj('spam', 30);

  delete process.env.CONTACT_RETENTION_DAYS;
  const s1 = await iletisimMesajlariniAnonimlestir();
  const getir = (id) => ContactMessage.findByPk(id, { raw: true });

  const a = await getir(eskiYanit);
  ok(
    '800 günlük yanıtlanmış mesaj anonimleşti',
    a.email === '' && a.name === 'Anonim' && a.message === ANONIM_MESAJ && a.phone === null && a.subject === null,
    JSON.stringify(a)
  );
  ok('ekip notu, IP özeti ve tarayıcı bilgisi de silindi', a.note === null && a.ip_hash === null && a.user_agent === null);
  ok('kimlik, durum ve tarih kaldı', a.id === eskiYanit && a.status === 'answered' && a.created_at instanceof Date);
  ok('731 günlük arşivlenmiş mesaj anonimleşti', (await getir(eskiArsiv)).email === '');
  ok('100 günlük arşivlenmiş mesaj duruyor', (await getir(yeniArsiv)).email !== '');
  ok('800 günlük BEKLEYEN (yeni) mesaja dokunulmadı', (await getir(eskiYeni)).message.includes(etiket));
  ok('800 günlük BEKLEYEN (okundu) mesaja dokunulmadı', (await getir(eskiOkundu)).message.includes(etiket));
  ok('91 günlük spam anonimleşti', (await getir(eskiSpam)).email === '');
  ok('30 günlük spam duruyor', (await getir(yeniSpam)).email !== '');
  ok('sayılar raporlanıyor', s1.kapali >= 2 && s1.spam >= 1, JSON.stringify(s1));

  const s2 = await iletisimMesajlariniAnonimlestir();
  ok('ikinci çalıştırma aynı satırları yeniden seçmiyor', s2.kapali === 0 && s2.spam === 0, JSON.stringify(s2));

  process.env.CONTACT_RETENTION_DAYS = '60';
  const s3 = await iletisimMesajlariniAnonimlestir();
  ok('CONTACT_RETENTION_DAYS=60: 100 günlük arşiv de anonimleşti', (await getir(yeniArsiv)).email === '' && s3.gun === 60);
  ok('spam süresi saklamadan uzun olamaz (60)', s3.spamGun === 60);
  process.env.CONTACT_RETENTION_DAYS = '7';
  const s4 = await iletisimMesajlariniAnonimlestir();
  ok('30 günden kısa değer reddedilip 730 kullanılıyor', s4.gun === 730);
  delete process.env.CONTACT_RETENTION_DAYS;

  console.log('\nOtomatik yanıt (aynı adrese 24 saatte bir):');
  const adres = `oto-${etiket}@kocum.local`;
  const m1 = await ContactMessage.create({ name: 'A', email: adres, message: 'birinci mesaj' });
  olusturulan.push(m1.id);
  ok('adrese ilk mesaj: yanıt gider', await otoYanitGitsinMi(m1));
  const m2 = await ContactMessage.create({ name: 'A', email: adres, message: 'ikinci mesaj' });
  olusturulan.push(m2.id);
  ok('24 saat içinde ikinci mesaj: yanıt GİTMEZ', !(await otoYanitGitsinMi(m2)));
  await sequelize.query('UPDATE contact_messages SET created_at = :t WHERE id = :id', {
    replacements: { t: new Date(Date.now() - 25 * GUN / 24), id: m1.id },
  });
  ok('önceki mesaj 25 saat önceyse yanıt yine gider', await otoYanitGitsinMi(m2));

  // Postanın içeriği: kullanıcının yazdığı hiçbir şey yok. Çağıran ad ve
  // mesajı verse bile (eski imza) posta onları taşımamalı.
  const yazilan = [];
  const asil = console.log;
  console.log = (...p) => yazilan.push(p.join(' '));
  let sonuc;
  try {
    sonuc = await sendContactAutoReply({ email: adres, locale: 'tr', name: `AD-${etiket}`, message: `MESAJ-${etiket}` });
  } finally {
    console.log = asil;
  }
  const posta = yazilan.join('\n');
  if (sonuc && sonuc.reason === 'logged') {
    ok('otomatik yanıt sabit metin', posta.includes('Mesajınız bize ulaştı, en kısa sürede dönüş yapacağız.'));
    ok('otomatik yanıtta ad ve mesaj YOK', !posta.includes(`AD-${etiket}`) && !posta.includes(`MESAJ-${etiket}`));
  } else {
    console.log('  · SMTP_URL=log://console değil: posta içeriği denetimi atlandı.');
  }
}

main()
  .catch((e) => {
    console.error('Test çöktü:', e);
    kalan++;
  })
  .finally(async () => {
    if (olusturulan.length) await ContactMessage.destroy({ where: { id: olusturulan } }).catch(() => {});
    await closeConnection().catch(() => {});
    console.log(kalan ? `\n✗ ${kalan} denetim başarısız` : '\n✓ hepsi geçti');
    process.exit(kalan ? 1 : 0);
  });
