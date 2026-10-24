import "./_koruma.mjs";
/**
 * İstemci IP kuralı (lib/istemci-ip.ts): Cloudflare dışından gelen sahte
 * cf-connecting-ip yok sayılıyor mu? Veritabanı istemez.
 *   npm run test:ip
 */
import { cloudflareMi, istemciIpBelirle } from "../lib/istemci-ip";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

console.log("\nCloudflare aralığı:");
check("173.245.48.1 Cloudflare", cloudflareMi("173.245.48.1"));
check("104.16.0.0/13'ün sonu (104.23.255.255) Cloudflare", cloudflareMi("104.23.255.255"));
check("104.32.0.1 Cloudflare değil", !cloudflareMi("104.32.0.1"));
check("2606:4700::1 Cloudflare", cloudflareMi("2606:4700::1"));
check("2001:db8::1 Cloudflare değil", !cloudflareMi("2001:db8::1"));

console.log("\nKural:");
check(
  "Cloudflare'den gelen istek: cf-connecting-ip istemcidir",
  istemciIpBelirle("172.70.1.2", "203.0.113.7") === "203.0.113.7"
);
check(
  "Cloudflare dışı eşten gelen SAHTE cf-connecting-ip yok sayılır",
  istemciIpBelirle("198.51.100.20", "203.0.113.7") === "198.51.100.20"
);
check(
  "Cloudflare'den gelir ama başlık bozuksa eşin kendisi",
  istemciIpBelirle("172.70.1.2", "bir şey; 1.2.3.4") === "172.70.1.2"
);
check("Cloudflare'den gelir, başlık yoksa eşin kendisi", istemciIpBelirle("172.70.1.2", null) === "172.70.1.2");
check(
  "IPv6 istemci Cloudflare'in IPv6 kenarından",
  istemciIpBelirle("2a06:98c1::5", "2001:db8::42") === "2001:db8::42"
);
check(
  "IPv4'ün IPv6 gösterimi sadeleşir (::ffff:172.70.1.2 Cloudflare sayılır)",
  istemciIpBelirle("::ffff:172.70.1.2", "203.0.113.7") === "203.0.113.7"
);
check("eş yoksa null (çağıran 'yerel' sayar)", istemciIpBelirle(null, "203.0.113.7") === null);
check("eş geçersizse null", istemciIpBelirle("unknown", "203.0.113.7") === null);
check("boşluklar atılır", istemciIpBelirle(" 172.70.1.2 ", " 203.0.113.7 ") === "203.0.113.7");

console.log(failed ? `\n✗ ${failed} denetim başarısız\n` : "\n✓ hepsi geçti\n");
process.exit(failed ? 1 : 0);
