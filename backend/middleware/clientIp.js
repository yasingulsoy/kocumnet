const crypto = require('crypto');
const net = require('net');

/**
 * Gerçek istemci IP'si: `req.clientIp`. İki kaynak, bu sırayla:
 *
 * 1) Site yönetimi BFF'i. kocum.net/admin bir BFF: tarayıcı backend'le hiç
 *    konuşmuyor, bütün personel istekleri frontend SUNUCUSUNUN tek IP'sinden
 *    geliyor. Frontend, isteği yapan tarayıcının IP'sini ortak sırla (HMAC)
 *    imzalayıp gönderir; backend imzayı doğrularsa `req.clientIp` o IP olur.
 *
 *      x-bff-client-ip:  203.0.113.7
 *      x-bff-time:       1759622400000          (ms; ±5 dk tolerans)
 *      x-bff-signature:  hex(HMAC-SHA256(BFF_SHARED_SECRET, "<ip>|<time>"))
 *
 *    Sır yoksa, kısaysa ya da imza tutmazsa başlıklar YOK SAYILIR. Sır ağda
 *    dolaşmaz; imza yalnızca o IP ve o zaman için geçerli.
 *
 * 2) Doğrudan gelen istekler (iletişim formu, blog): tarayıcı → Cloudflare →
 *    Traefik (Dokploy) → backend. Traefik varsayılan olarak Cloudflare'e
 *    güvenmez: gelen X-Forwarded-For'u siler, yerine kendi gördüğü eşi
 *    (Cloudflare'in kenar sunucusu) yazar. `trust proxy 1` ile `req.ip` bu eş.
 *    Eskiden `req.clientIp = req.ip` idi: bütün ziyaretçiler birkaç kenar
 *    sunucusunun kovasını paylaşıyordu (iletişim formu saatte 5 → herkes için 5).
 *
 *    Kural (app/lib/istemci-ip.ts ve frontend/lib/admin/client-ip-kurali.ts
 *    ile aynı; biri değişirse üçü birlikte değişir):
 *      eş Cloudflare aralığındaysa ve cf-connecting-ip geçerli bir IP ise
 *      istemci odur; değilse istemci eşin kendisidir.
 *    Aralık denetimi şart: kaynak sunucuya Cloudflare atlanarak doğrudan da
 *    erişilebiliyor; o zaman cf-connecting-ip'i isteyen yazardı. Traefik'te
 *    forwardedHeaders.trustedIPs AYARLANMAMALI (bkz. frontend/DEPLOY.md).
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

// Kaynak: https://www.cloudflare.com/ips-v4 ve /ips-v6 — 22 Ekim 2026'da alındı.
// Çalışma anında indirilmiyor: liste nadiren değişir, indirme hatası sınırı
// sessizce kapatmasın. Cloudflare yeni aralık eklerse oradan gelen istekler
// eşin (kenar sunucusunun) IP'siyle sayılır; güncellerken tarihi de değiştirin.
const CLOUDFLARE_V4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];
const CLOUDFLARE_V6 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const cloudflare = new net.BlockList();
for (const aralik of CLOUDFLARE_V4) {
  const [ag, onek] = aralik.split('/');
  cloudflare.addSubnet(ag, Number(onek), 'ipv4');
}
for (const aralik of CLOUDFLARE_V6) {
  const [ag, onek] = aralik.split('/');
  cloudflare.addSubnet(ag, Number(onek), 'ipv6');
}

/** Boşlukları atar, IPv4'ün IPv6 gösterimini (::ffff:1.2.3.4) sadeleştirir; geçersizse null. */
function temizle(deger) {
  const ip = String(deger == null ? '' : deger)
    .trim()
    .replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
  return ip.length <= 45 && net.isIP(ip) ? ip : null;
}

function cloudflareMi(ip) {
  const tur = net.isIP(ip);
  return tur === 4 ? cloudflare.check(ip, 'ipv4') : tur === 6 ? cloudflare.check(ip, 'ipv6') : false;
}

/**
 * Saf kural. `es`: vekilin yazdığı eş adresi (req.ip), `cfBaslik`:
 * cf-connecting-ip. Eş yoksa ya da geçersizse null.
 */
function istemciIpBelirle(es, cfBaslik) {
  const esIp = temizle(es);
  if (!esIp) return null;
  if (cloudflareMi(esIp)) return temizle(cfBaslik) || esIp;
  return esIp;
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
  req.clientIp = dogrulanan || istemciIpBelirle(req.ip, req.get('cf-connecting-ip')) || req.ip;
  req.viaBff = Boolean(dogrulanan);
  // İmzalı görünüp tutmayan istek: yanlış sır ya da saat farkı. Günlüğü
  // boğmasın diye dakikada bir uyarı.
  if (!dogrulanan && AKTIF && req.get('x-bff-signature') && Date.now() - sonUyari > 60_000) {
    sonUyari = Date.now();
    console.warn('• BFF imzası doğrulanamadı (sır farklı ya da sunucu saatleri kaymış); istek sunucu IP\'siyle sayıldı.');
  }
  next();
}

module.exports = { clientIp, BFF_AKTIF: AKTIF, istemciIpBelirle, cloudflareMi };
