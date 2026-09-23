/** Rotalarda tekrarlayan küçük yardımcılar. */

/**
 * URL'den gelen kimliği sayıya çevirir. Geçersizse null.
 * Eskiden ham değer findByPk'ye gidiyordu: "/api/blogs/abc" Postgres'te
 * 22P02 hatası veriyor ve kullanıcıya 500 dönüyordu (doğrusu 404).
 */
function parseId(value) {
  const s = String(value ?? '').trim();
  if (!/^\d{1,10}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * LIKE/ILIKE desenlerinde kullanıcı girdisini kaçırır.
 * Kaçırılmazsa "%" tek başına her kaydı eşliyor: arama kutusuna % yazan
 * herkes tüm listeyi çekiyor, giriş ekranında ise rastgele bir kullanıcı
 * bulunuyordu.
 */
function escapeLike(value) {
  return String(value ?? '').replace(/[\\%_]/g, (m) => '\\' + m);
}

/** Express 4'te async rota hatalarını merkezî hata yakalayıcıya taşır. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** İstemciden gelen "true"/true/1 gibi değerleri boolean'a çevirir. */
function toBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

module.exports = { parseId, escapeLike, asyncHandler, toBool };
