const crypto = require('crypto');
const net = require('net');

/**
 * Gerçek istemci IP'si — site yönetimi BFF'i için.
 *
 * kocum.net/admin bir BFF: tarayıcı backend'le hiç konuşmuyor, bütün
 * personel istekleri frontend SUNUCUSUNUN tek IP'sinden geliyor. Backend
 * IP'ye göre saydığında (giriş denemesi tavanı, oturumsuz istekler) herkes
 * aynı kovayı paylaşıyordu.
 *
 * Çözüm: frontend, isteği yapan tarayıcının IP'sini ortak sırla (HMAC)
 * imzalayıp gönderir; backend imzayı doğrularsa `req.clientIp` o IP olur.
 *
 *   x-bff-client-ip:  203.0.113.7
 *   x-bff-time:       1759622400000          (ms; ±5 dk tolerans)
 *   x-bff-signature:  hex(HMAC-SHA256(BFF_SHARED_SECRET, "<ip>|<time>"))
 *
 * Sır yoksa, kısaysa ya da imza tutmazsa başlıklar YOK SAYILIR ve
 * `req.clientIp = req.ip` (eski davranış). Sır ağda dolaşmaz; imza yalnızca
 * o IP ve o zaman için geçerli.
 */

const SIR = String(process.env.BFF_SHARED_SECRET || '').trim();
const EN_KISA = 32;
const AKTIF = SIR.length >= EN_KISA;
const TOLERANS_MS = 5 * 60 * 1000;

if (SIR && !AKTIF) {
  console.warn(
    `⚠️  BFF_SHARED_SECRET ${EN_KISA} karakterden kısa; yok sayılıyor (site yönetimi istekleri sunucu IP'siyle sayılır).`
  );
}

function imzala(ip, zaman) {
  return crypto.createHmac('sha256', SIR).update(`${ip}|${zaman}`).digest('hex');
}

function esit(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Doğrulanmış istemci IP'si ya da null. */
function bffIstemcisi(req) {
  if (!AKTIF) return null;
  const ip = String(req.get('x-bff-client-ip') || '').trim();
  const zaman = String(req.get('x-bff-time') || '').trim();
  const imza = String(req.get('x-bff-signature') || '').trim().toLowerCase();
  if (!ip || !zaman || !imza || !net.isIP(ip) || !/^\d{10,16}$/.test(zaman)) return null;
  if (Math.abs(Date.now() - Number(zaman)) > TOLERANS_MS) return null;
  return esit(imza, imzala(ip, zaman)) ? ip : null;
}

let sonUyari = 0;

function clientIp(req, _res, next) {
  const dogrulanan = bffIstemcisi(req);
  req.clientIp = dogrulanan || req.ip;
  req.viaBff = Boolean(dogrulanan);
  // İmzalı görünüp tutmayan istek: yanlış sır ya da saat farkı. Günlüğü
  // boğmasın diye dakikada bir uyarı.
  if (!dogrulanan && AKTIF && req.get('x-bff-signature') && Date.now() - sonUyari > 60_000) {
    sonUyari = Date.now();
    console.warn('• BFF imzası doğrulanamadı (sır farklı ya da sunucu saatleri kaymış); istek sunucu IP\'siyle sayıldı.');
  }
  next();
}

module.exports = { clientIp, BFF_AKTIF: AKTIF };
