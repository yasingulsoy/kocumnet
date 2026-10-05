const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { IS_PRODUCTION, JWT_SECRET } = require('../config/env');
const { ADMIN_JWT_COOKIE } = require('../utils/authCookie');

/**
 * Hız sınırları.
 *
 * ANAHTAR NEDEN YALNIZCA IP DEĞİL: site yönetimi (kocum.net/admin) bir BFF —
 * tarayıcı backend'le hiç konuşmuyor, bütün personel istekleri frontend
 * SUNUCUSUNUN tek IP'sinden geliyor (check-up panelinin sunucu tarafı
 * doğrulaması da öyle). IP'ye göre saymak bütün ekibin tek kovayı paylaşması
 * demekti:
 *  · giriş: 15 yanlış deneme (kimden gelirse gelsin) HERKESİ 15 dakika
 *    dışarıda bırakıyordu — dışarıdan bir saldırgan için 15 istek yeterliydi;
 *  · yazma: tüm ekibe 15 dakikada 120 işlem;
 *  · genel: her yönetim sayfası backend'e 2-6 istek atıyor; birkaç kişi
 *    aynı anda çalışınca tavan doluyor, panel "sunucuya ulaşılamadı" diyordu.
 *
 * Şimdi: oturumu olan personel KENDİ hesabıyla sayılır (jeton imzası
 * doğrulanır, sahtesi üretilemez); giriş denemeleri "IP + hesap" çiftiyle ve
 * yalnızca BAŞARISIZ olanlar; IP tek başına yalnızca oturumsuz isteklerde ve
 * geniş bir tavan olarak kullanılır.
 *
 * IP = `req.clientIp` (middleware/clientIp.js): BFF_SHARED_SECRET tanımlıysa
 * site yönetiminden gelen isteklerde frontend'in imzaladığı GERÇEK tarayıcı
 * IP'si; değilse req.ip.
 *
 * Geliştirmede sınırlar bilinçli olarak yüksek: yerelde kendimizi kilitlemeyelim.
 */

/** IPv6 adreslerini /56 ağına indirger (kütüphanenin önerdiği yol). */
function ipAnahtari(req) {
  return 'ip:' + ipKeyGenerator(String(req.clientIp || req.ip || ''));
}

/** Kişisel bilgi bellekte düz durmasın: e-posta/jeton yerine kısa özet. */
function ozet(v) {
  return crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 16);
}

/**
 * Oturumu olan personelin anahtarı; yoksa null. authenticateAdmin'den sonra
 * req.userId hazırdır; önce çalışan genel sınırda çerezdeki jetonun imzası
 * doğrulanır (veritabanına gidilmez — sayım için imza yeterli).
 */
function personelAnahtari(req) {
  if (req.userId) return 'personel:' + req.userId;
  const token = req.cookies ? req.cookies[ADMIN_JWT_COOKIE] : null;
  if (!token || typeof token !== 'string') return null;
  try {
    const d = jwt.verify(token, JWT_SECRET);
    return d && d.id ? 'personel:' + d.id : null;
  } catch {
    return null;
  }
}

/** Giriş formundaki hesap adı (e-posta ya da kullanıcı adı), normalize. */
function hesapAnahtari(v) {
  return ozet(String(v ?? '').trim().toLowerCase().slice(0, 255));
}

function limiter({ windowMs, limit, devLimit, code, error, keyGenerator, skipSuccessfulRequests }) {
  return rateLimit({
    windowMs,
    limit: IS_PRODUCTION ? limit : (devLimit ?? limit * 20),
    standardHeaders: true,
    legacyHeaders: false,
    // Varsayılan anahtar da doğrulanmış istemci IP'si (BFF arkasında gerçek tarayıcı).
    keyGenerator: keyGenerator || ipAnahtari,
    ...(skipSuccessfulRequests ? { skipSuccessfulRequests: true } : {}),
    message: { success: false, code, error },
  });
}

const GIRIS_HATASI = 'Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin.';

/**
 * Panel girişi — parola deneme saldırısına karşı İKİ katman:
 *  1. aynı IP + aynı hesap: 15 dakikada 10 BAŞARISIZ deneme (başarılı giriş sayılmaz);
 *  2. aynı IP, bütün hesaplar: 15 dakikada 100 başarısız deneme (hesap tarama).
 * Birincisi kişiye özel olduğu için başkasının yanlış parolası seni kilitlemez.
 */
const adminLoginLimiter = [
  limiter({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    devLimit: 1000,
    code: 'ADMIN_LOGIN_RATE_LIMIT',
    error: GIRIS_HATASI,
    skipSuccessfulRequests: true,
  }),
  limiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    devLimit: 200,
    code: 'ADMIN_LOGIN_RATE_LIMIT',
    error: GIRIS_HATASI,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => ipAnahtari(req) + '|' + hesapAnahtari((req.body || {}).usernameOrEmail),
  }),
];

/**
 * "Parolamı unuttum" — e-posta bombardımanına karşı adres başına saatte 5,
 * IP başına saatte 50 istek (yanıt her zaman aynı olduğu için hepsi sayılır).
 */
const forgotLimiter = [
  limiter({
    windowMs: 60 * 60 * 1000,
    limit: 50,
    devLimit: 500,
    code: 'FORGOT_RATE_LIMIT',
    error: 'Çok fazla istek. Lütfen bir saat sonra tekrar deneyin.',
  }),
  limiter({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    devLimit: 50,
    code: 'FORGOT_RATE_LIMIT',
    error: 'Bu adres için çok fazla bağlantı istendi. Gelen kutunu ve spam klasörünü kontrol et; bir saat sonra tekrar deneyebilirsin.',
    keyGenerator: (req) => ipAnahtari(req) + '|' + hesapAnahtari((req.body || {}).email),
  }),
];

/** Davet/sıfırlama bağlantısıyla parola belirleme: bağlantı başına sayılır. */
const resetLimiter = [
  limiter({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    devLimit: 1000,
    code: 'RESET_RATE_LIMIT',
    error: GIRIS_HATASI,
    skipSuccessfulRequests: true,
  }),
  limiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    devLimit: 200,
    code: 'RESET_RATE_LIMIT',
    error: GIRIS_HATASI,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => ipAnahtari(req) + '|' + ozet((req.body || {}).token || ''),
  }),
];

/** Tüm API için geniş bir tavan: personel kendi hesabıyla, misafir IP'siyle sayılır. */
const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 900,
  code: 'RATE_LIMIT',
  error: 'Çok fazla istek. Lütfen biraz sonra tekrar deneyin.',
  keyGenerator: (req) => personelAnahtari(req) || ipAnahtari(req),
});

/**
 * Yazma işlemleri (oluşturma/güncelleme/silme/yükleme) — kişi başına.
 * Hep authenticateAdmin'den sonra çalışır; anahtar personelin kendisi.
 */
const writeLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  code: 'WRITE_RATE_LIMIT',
  error: 'Çok fazla işlem. Lütfen biraz sonra tekrar deneyin.',
  keyGenerator: (req) => personelAnahtari(req) || ipAnahtari(req),
});

/** Görüntülenme sayacı: oturumsuz ve her çağrıda veritabanına yazıyor (tarayıcıdan, gerçek IP). */
const viewLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 30,
  code: 'VIEW_RATE_LIMIT',
  error: 'Çok fazla istek.',
});

/** İletişim formu: spam ve e-posta bombardımanına karşı (tarayıcıdan, gerçek IP). */
const contactLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  devLimit: 50,
  code: 'CONTACT_RATE_LIMIT',
  error: 'Kısa sürede çok fazla mesaj gönderildi. Lütfen bir süre sonra tekrar deneyin.',
});

module.exports = {
  adminLoginLimiter,
  forgotLimiter,
  resetLimiter,
  apiLimiter,
  writeLimiter,
  viewLimiter,
  contactLimiter,
};
