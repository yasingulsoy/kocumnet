/**
 * İstemci IP kuralı (middleware/clientIp.js): Cloudflare dışından gelen sahte
 * cf-connecting-ip yok sayılıyor mu? Sunucu ve veritabanı istemez.
 *   npm run test:ip
 */
const { istemciIpBelirle, cloudflareMi, clientIp } = require('../middleware/clientIp');

let kalan = 0;
function ok(ad, kosul) {
  console.log(kosul ? '  ✓' : '  ✗', ad);
  if (!kosul) kalan++;
}

ok('173.245.48.1 Cloudflare', cloudflareMi('173.245.48.1'));
ok('104.32.0.1 Cloudflare değil', !cloudflareMi('104.32.0.1'));
ok('2606:4700::1 Cloudflare', cloudflareMi('2606:4700::1'));
ok("Cloudflare'den gelen istek: cf-connecting-ip istemcidir", istemciIpBelirle('172.70.1.2', '203.0.113.7') === '203.0.113.7');
ok(
  'Cloudflare dışı eşten gelen SAHTE cf-connecting-ip yok sayılır',
  istemciIpBelirle('198.51.100.20', '203.0.113.7') === '198.51.100.20'
);
ok("Cloudflare'den gelir ama başlık bozuksa eşin kendisi", istemciIpBelirle('172.70.1.2', 'x, 1.2.3.4') === '172.70.1.2');
ok('IPv6 kenardan IPv6 istemci', istemciIpBelirle('2a06:98c1::5', '2001:db8::42') === '2001:db8::42');
ok('::ffff: gösterimi sadeleşir', istemciIpBelirle('::ffff:172.70.1.2', '203.0.113.7') === '203.0.113.7');
ok('eş yoksa null', istemciIpBelirle(undefined, '203.0.113.7') === null);

// Ara katmanın kendisi: sahte bir istek nesnesiyle.
function sahteIstek(ip, basliklar) {
  const b = Object.fromEntries(Object.entries(basliklar).map(([k, v]) => [k.toLowerCase(), v]));
  return { ip, get: (ad) => b[String(ad).toLowerCase()] };
}
const r1 = sahteIstek('198.51.100.20', { 'cf-connecting-ip': '203.0.113.7' });
clientIp(r1, null, () => {});
ok('ara katman: doğrudan erişimde sahte başlık işe yaramaz', r1.clientIp === '198.51.100.20');
const r2 = sahteIstek('162.158.10.1', { 'cf-connecting-ip': '203.0.113.7' });
clientIp(r2, null, () => {});
ok("ara katman: Cloudflare'den gelen istekte gerçek istemci", r2.clientIp === '203.0.113.7');

console.log(kalan ? `\n✗ ${kalan} denetim başarısız` : '\n✓ hepsi geçti');
process.exit(kalan ? 1 : 0);
