/**
 * İstemci IP kuralı (lib/admin/client-ip-kurali.ts): Cloudflare dışından gelen
 * sahte cf-connecting-ip yok sayılıyor mu?
 *   npm run test:ip
 * TypeScript modülünü Node'un tip ayıklamasıyla yükler (Node 22.18+).
 */
import { cloudflareMi, istemciIpBelirle } from "../lib/admin/client-ip-kurali.ts";

let failed = 0;
function check(label, ok) {
  console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failed += 1;
}

check("173.245.48.1 Cloudflare", cloudflareMi("173.245.48.1"));
check("104.32.0.1 Cloudflare değil", !cloudflareMi("104.32.0.1"));
check("2606:4700::1 Cloudflare", cloudflareMi("2606:4700::1"));
check("Cloudflare'den gelen istek: cf-connecting-ip istemcidir", istemciIpBelirle("172.70.1.2", "203.0.113.7") === "203.0.113.7");
check(
  "Cloudflare dışı eşten gelen SAHTE cf-connecting-ip yok sayılır",
  istemciIpBelirle("198.51.100.20", "203.0.113.7") === "198.51.100.20"
);
check("Cloudflare'den gelir ama başlık bozuksa eşin kendisi", istemciIpBelirle("172.70.1.2", "x, 1.2.3.4") === "172.70.1.2");
check("IPv6 kenardan IPv6 istemci", istemciIpBelirle("2a06:98c1::5", "2001:db8::42") === "2001:db8::42");
check("::ffff: gösterimi sadeleşir", istemciIpBelirle("::ffff:172.70.1.2", "203.0.113.7") === "203.0.113.7");
check("eş yoksa null", istemciIpBelirle(null, "203.0.113.7") === null);

console.log(failed ? `\n✗ ${failed} denetim başarısız` : "\n✓ hepsi geçti");
process.exit(failed ? 1 : 0);
