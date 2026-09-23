const rateLimit = require('express-rate-limit');
const { IS_PRODUCTION } = require('../config/env');

/**
 * Hız sınırları. Eskiden yalnızca giriş uçunda vardı; jeton dağıtan uç,
 * oturumsuz görüntülenme sayacı (her istekte DB yazıyor) ve yükleme uçları
 * sınırsızdı.
 *
 * Geliştirmede sınırlar bilinçli olarak yüksek: yerelde çalışırken kendimizi
 * kilitlemeyelim.
 */
function limiter({ windowMs, limit, devLimit, code, error }) {
  return rateLimit({
    windowMs,
    limit: IS_PRODUCTION ? limit : (devLimit ?? limit * 20),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code, error },
  });
}

/** Panel girişi — parola deneme saldırısına karşı. */
const adminLoginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  devLimit: 200,
  code: 'ADMIN_LOGIN_RATE_LIMIT',
  error: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
});

/** Tüm API için geniş bir tavan (kötüye kullanım / tarama). */
const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 900,
  code: 'RATE_LIMIT',
  error: 'Çok fazla istek. Lütfen biraz sonra tekrar deneyin.',
});

/** Yazma işlemleri (oluşturma/güncelleme/silme/yükleme). */
const writeLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  code: 'WRITE_RATE_LIMIT',
  error: 'Çok fazla işlem. Lütfen biraz sonra tekrar deneyin.',
});

/** Görüntülenme sayacı: oturumsuz ve her çağrıda veritabanına yazıyor. */
const viewLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 30,
  code: 'VIEW_RATE_LIMIT',
  error: 'Çok fazla istek.',
});

/** İletişim formu: spam ve e-posta bombardımanına karşı. */
const contactLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  devLimit: 50,
  code: 'CONTACT_RATE_LIMIT',
  error: 'Kısa sürede çok fazla mesaj gönderildi. Lütfen bir süre sonra tekrar deneyin.',
});

module.exports = {
  adminLoginLimiter,
  apiLimiter,
  writeLimiter,
  viewLimiter,
  contactLimiter,
};
