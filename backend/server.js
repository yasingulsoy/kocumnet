const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const { FRONTEND_URL, ADMIN_URL, IS_PRODUCTION } = require('./config/env');
const { sequelize, testConnection, syncDatabase, closeConnection } = require('./config/database');
const { issueCsrfToken, csrfProtection } = require('./middleware/csrf');
const { apiLimiter } = require('./middleware/rateLimits');
const { requestLogger } = require('./middleware/requestLogger');
const { clientIp, BFF_AKTIF } = require('./middleware/clientIp');
const { eskiDenetimKayitlariniSil } = require('./utils/audit');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

// ─── CORS ────────────────────────────────────────────────────
// Üretimde açıkça tanımlanmamışsa açılmıyoruz: eski hâlde liste boşsa
// localhost:3000/3001 kimlik bilgisiyle izinli kalıyordu; üretimde
// saldırganın kendi makinesindeki bir sayfa panele istek atabiliyordu.
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (corsOrigins.length === 0) {
  if (IS_PRODUCTION) {
    throw new Error(
      'CORS_ORIGINS tanımlı değil. Üretimde izin verilen kökenler açıkça yazılmalı, ör:\n' +
        '  CORS_ORIGINS=https://kocum.net,https://www.kocum.net,https://admin.kocum.net'
    );
  }
  corsOrigins.push(FRONTEND_URL, ADMIN_URL, 'http://localhost:3000', 'http://localhost:3001');
}

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// ─── Güvenlik başlıkları ─────────────────────────────────────
app.use(
  helmet({
    // API ve /uploads farklı kökenlerden (site, panel) okunuyor.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Bu sunucu HTML sayfası üretmiyor; CSP'yi asıl gerektiren yer Next
    // uygulamaları. Burada kapatıp yanlış güven hissi vermiyoruz.
    contentSecurityPolicy: false,
    hsts: IS_PRODUCTION ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);

app.use(requestLogger);
// Gerçek istemci IP'si (site yönetimi BFF'i imzalayıp gönderir); hız
// sınırlarından ÖNCE.
app.use(clientIp);
// Çerezler hız sınırından önce: genel sınır, oturumu olan personeli IP'ye
// göre değil kendi hesabıyla sayıyor (middleware/rateLimits.js). Çerez
// ayrıştırma ucuz; gövde değil.
app.use(cookieParser());
// Hız sınırı gövde ayrıştırmadan ÖNCE: eskiden 10 MB'lık JSON, sınır
// devreye girmeden önce okunup ayrıştırılıyordu.
app.use('/api', apiLimiter);
app.use(express.json({ limit: '10mb' }));
// Eskiden varsayılan 100 kb'da kalıyordu; JSON ile arasındaki uçurum
// "aynı veri form olarak gelince neden reddediliyor" hatalarına yol açar.
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    // Tarayıcı içerik tipini kendi tahmin etmesin: yüklenen dosya ne olursa
    // olsun çalıştırılabilir bir şey gibi yorumlanmamalı.
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);

app.get('/api/health', async (_req, res) => {
  // Veritabanına gerçekten dokunuyoruz: eski sürüm Postgres kapalıyken de
  // 200 dönüyordu, yani hazırlık yoklaması (readiness) hiçbir şey ölçmüyordu.
  try {
    await sequelize.authenticate();
    res.json({ success: true, message: 'Kocumnet API çalışıyor', db: 'up' });
  } catch (e) {
    console.error('Sağlık yoklaması: veritabanına ulaşılamadı —', e.message);
    res.status(503).json({ success: false, error: 'Veritabanına ulaşılamıyor', db: 'down' });
  }
});

app.get('/api/csrf-token', (req, res) => {
  // Jeton hem HttpOnly çereze yazılır hem gövdede döner (çift gönderim).
  res.json({ csrfToken: issueCsrfToken(req, res) });
});

app.use('/api', csrfProtection);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/blogs', require('./routes/blogs'));
app.use('/api/contact', require('./routes/contact'));

app.use((_req, res) => {
  res.status(404).json({ success: false, code: 'NOT_FOUND', error: 'Endpoint bulunamadı' });
});

/**
 * Tek hata biçimi: { success: false, code, error } (5xx'te + requestId).
 * body-parser hataları eskiden kütüphanenin İngilizce metniyle dönüyordu
 * ("request entity too large", "Unexpected token … in JSON") — panel bunu
 * kullanıcıya olduğu gibi gösteriyordu.
 */
const GOVDE_HATALARI = {
  'entity.too.large': { code: 'PAYLOAD_TOO_LARGE', error: 'Gönderilen veri çok büyük (en fazla 10 MB). Görselleri küçültüp tekrar dene.' },
  'entity.parse.failed': { code: 'INVALID_JSON', error: 'İstek gövdesi geçerli JSON değil.' },
  'encoding.unsupported': { code: 'UNSUPPORTED_ENCODING', error: 'Desteklenmeyen karakter kodlaması.' },
};

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const durum = Number(err.status || err.statusCode) || 500;
  if (durum >= 500) {
    console.error(`Sunucu hatası [${req.id}]:`, req.method, req.originalUrl, '—', err);
    return res.status(durum).json({ success: false, code: 'SERVER_ERROR', error: 'Sunucu hatası', requestId: req.id });
  }
  const bilinen = GOVDE_HATALARI[err.type];
  res.status(durum).json({
    success: false,
    code: bilinen ? bilinen.code : 'BAD_REQUEST',
    // İstemciye yalnızca bizim yazdığımız mesajlar gider; beklenmeyen
    // hataların metni yığın/kütüphane ayrıntısı sızdırabilir.
    error: bilinen ? bilinen.error : err.expose ? err.message : 'Geçersiz istek',
  });
});

let server;

async function start() {
  await testConnection();
  await syncDatabase();
  // Denetim kayıtları 365 gün tutulur; eskiler açılışta ve günde bir silinir.
  await eskiDenetimKayitlariniSil();
  setInterval(eskiDenetimKayitlariniSil, 24 * 60 * 60 * 1000).unref();
  server = app.listen(PORT, () => {
    console.log(`🚀 Kocumnet API http://127.0.0.1:${PORT}  (${IS_PRODUCTION ? 'üretim' : 'geliştirme'})`);
    console.log(`   Site yönetimi istemci IP'si (BFF_SHARED_SECRET): ${BFF_AKTIF ? 'açık' : 'kapalı — sunucu IP\'siyle sayılıyor'}`);
  });
}

/**
 * Düzgün kapanış. Eskiden yalnızca SIGINT dinleniyordu; konteynerler ve PM2
 * SIGTERM gönderir, o yüzden dağıtımda süreç işlenmekte olan istekleri
 * ortasından kesiyordu.
 */
let kapaniyor = false;
async function shutdown(signal) {
  if (kapaniyor) return;
  kapaniyor = true;
  console.log(`\n${signal} alındı, kapanıyor…`);

  const zorla = setTimeout(() => {
    console.error('Kapanış 10 saniyede tamamlanmadı, süreç sonlandırılıyor.');
    process.exit(1);
  }, 10000);
  zorla.unref();

  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await closeConnection();
    console.log('Kapandı.');
    process.exit(0);
  } catch (e) {
    console.error('Kapanış hatası:', e);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Yakalanmamış promise reddi:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Yakalanmamış istisna:', err);
  shutdown('uncaughtException');
});

start().catch((err) => {
  console.error('Sunucu başlatılamadı:', err.message);
  process.exit(1);
});
