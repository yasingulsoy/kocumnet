const crypto = require('crypto');
const { IS_PRODUCTION } = require('../config/env');

/**
 * CSRF koruması — "çift gönderim" (double submit) deseni.
 *
 * ESKİ HÂLİ NEDEN YETERSİZDİ: jeton, JWT_SECRET ile imzalanmış sabit içerikli
 * bir JWT'ydi ve kimliği doğrulanmamış bir uçtan herkese dağıtılıyordu. Yani
 * saldırgan da bir jeton alıp isteğine koyabilirdi; koruma "özel bir başlık
 * var mı" denetiminden ibaretti. Üstelik oturum jetonlarıyla aynı anahtarı
 * paylaşıyordu.
 *
 * YENİ HÂLİ: rastgele jeton hem HttpOnly çereze yazılır hem de yanıt gövdesinde
 * döner. Tarayıcı çerezi otomatik gönderir; istemci gövdeden aldığı değeri
 * başlığa koyar. Başka bir kökendeki sayfa ne çerezi ne de gövdeyi okuyabildiği
 * için ikisini eşleştiremez.
 */

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'csrf_token';
const OMUR_MS = 12 * 60 * 60 * 1000;

/**
 * Oturum çerezi taşımayan, herkese açık uçlar. CSRF'in koruduğu şey
 * "kullanıcının oturumuyla istemeden işlem yapılması"; oturumsuz uçta
 * korunacak bir yetki yok. Bunlar hız sınırıyla korunuyor.
 */
const MUAF_YOLLAR = [/^\/api\/blogs\/slug\/[^/]+\/view$/, /^\/api\/contact$/];

function cerezSecenekleri() {
  const domain = (process.env.AUTH_COOKIE_DOMAIN || '').trim();
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: OMUR_MS,
    ...(domain ? { domain } : {}),
  };
}

const GECERLI = /^[a-f0-9]{64}$/;

/** Jetonu üretir/yeniler, çereze yazar ve değeri döndürür. */
function issueCsrfToken(req, res) {
  const mevcut = req.cookies ? req.cookies[CSRF_COOKIE] : null;
  const token =
    typeof mevcut === 'string' && GECERLI.test(mevcut)
      ? mevcut
      : crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, cerezSecenekleri());
  return token;
}

function esit(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  // Zamanlama sızıntısı olmasın diye sabit süreli karşılaştırma.
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function csrfProtection(req, res, next) {
  // CSRF yalnızca AÇIKÇA geliştirmede kapatılabilir. Üretimde CSRF_DISABLED
  // dikkate alınmaz (IS_PRODUCTION kapalı tarafa düşer).
  if (!IS_PRODUCTION && String(process.env.CSRF_DISABLED || '').trim() === '1') {
    return next();
  }

  const yol = (req.originalUrl || req.url || '').split('?')[0] || '';
  if (!yol.startsWith('/api')) return next();

  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  if (MUAF_YOLLAR.some((r) => r.test(yol))) return next();

  const cerez = req.cookies ? req.cookies[CSRF_COOKIE] : null;
  const baslik = req.get(CSRF_HEADER);

  if (!cerez || !GECERLI.test(String(cerez)) || !esit(String(cerez), String(baslik || ''))) {
    return res.status(403).json({
      success: false,
      code: 'CSRF_FAILED',
      error: 'CSRF doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.',
    });
  }

  return next();
}

module.exports = {
  CSRF_HEADER,
  CSRF_COOKIE,
  issueCsrfToken,
  csrfProtection,
};
