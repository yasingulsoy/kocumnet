import { BlockList, isIP } from "node:net";

/**
 * İsteği yapan tarayıcının IP'si: üç projede (site, backend, check-up) aynı kural.
 *
 * Yol: tarayıcı → Cloudflare → Traefik (Dokploy) → uygulama. Traefik varsayılan
 * olarak Cloudflare'e güvenmez: gelen X-Forwarded-For ve X-Real-Ip başlıklarını
 * siler, yerine kendi gördüğü eşi (Cloudflare'in kenar sunucusu) yazar. Eskiden
 * x-forwarded-for'un ilk öğesine bakıyorduk; o da kenar sunucusuydu, yani bütün
 * ziyaretçiler birkaç kovayı paylaşıyordu (kayıt saatte 10 → herkes için 10).
 *
 * Kural:
 *   eş = Traefik'in yazdığı x-real-ip
 *   eş Cloudflare aralığındaysa ve cf-connecting-ip geçerli bir IP ise istemci odur;
 *   değilse istemci eşin kendisidir.
 *
 * Aralık denetimi şart: kaynak sunucuya Cloudflare atlanarak doğrudan da
 * erişilebiliyor; o zaman cf-connecting-ip'i isteyen yazar ve sınırı atlatırdı.
 * Traefik'te forwardedHeaders.trustedIPs AYARLANMAMALI (bkz. DEPLOY.md):
 * ayarlanırsa x-real-ip istemcinin gönderdiği başlıktan gelir.
 *
 * Aynı kural ve liste: frontend/lib/admin/client-ip-kurali.ts,
 * backend/middleware/clientIp.js. Biri değişirse üçü birlikte değişir.
 * Saf modül (next/headers yok): scripts/istemci-ip-test.mts doğrudan sınar.
 */

// Kaynak: https://www.cloudflare.com/ips-v4 ve /ips-v6 — 22 Ekim 2026'da alındı.
// Çalışma anında indirilmiyor: liste nadiren değişir, indirme hatası sınırı
// sessizce kapatmasın. Cloudflare yeni aralık eklerse oradan gelen istekler
// eşin (kenar sunucusunun) IP'siyle sayılır; güncellerken tarihi de değiştirin.
const CLOUDFLARE_V4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];
const CLOUDFLARE_V6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

const cloudflare = new BlockList();
for (const aralik of CLOUDFLARE_V4) {
  const [ag, onek] = aralik.split("/");
  cloudflare.addSubnet(ag, Number(onek), "ipv4");
}
for (const aralik of CLOUDFLARE_V6) {
  const [ag, onek] = aralik.split("/");
  cloudflare.addSubnet(ag, Number(onek), "ipv6");
}

/** Boşlukları atar, IPv4'ün IPv6 gösterimini (::ffff:1.2.3.4) sadeleştirir; geçersizse null. */
function temizle(deger: string | null | undefined): string | null {
  const ip = String(deger ?? "").trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
  return ip.length <= 45 && isIP(ip) ? ip : null;
}

export function cloudflareMi(ip: string): boolean {
  const tur = isIP(ip);
  return tur === 4 ? cloudflare.check(ip, "ipv4") : tur === 6 ? cloudflare.check(ip, "ipv6") : false;
}

/**
 * @param es        Traefik'in yazdığı eş adresi (x-real-ip)
 * @param cfBaslik  cf-connecting-ip başlığı
 * @returns istemci IP'si; eş yoksa ya da geçersizse null (çağıran "yerel" sayar)
 */
export function istemciIpBelirle(
  es: string | null | undefined,
  cfBaslik: string | null | undefined
): string | null {
  const esIp = temizle(es);
  if (!esIp) return null;
  if (cloudflareMi(esIp)) return temizle(cfBaslik) ?? esIp;
  return esIp;
}
