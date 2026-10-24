/**
 * Test betikleri için üretim koruması. Her *-test.mts ve smoke.mts'in İLK
 * satırı bunu içe aktarır; içe aktarmalar sırayla değerlendirildiği için
 * veritabanına dokunan modüller yüklenmeden önce çalışır.
 *
 * Testler kendi öğrencilerini, paketlerini ve oturumlarını açıp siler.
 * Yanlış .env ile (ör. üretim adresi) çalıştırılırsa gerçek veriye yazarlar.
 * Bu yüzden:
 *   - NODE_ENV=production ise çıkar,
 *   - DATABASE_URL'ün sunucusu localhost / 127.0.0.1 / ::1 değilse çıkar.
 * Bilerek başka bir sunucuda koşmak için: `-- --zorla`.
 * CI Postgres servisine localhost'tan bağlandığı için engellenmez.
 * DATABASE_URL hiç yoksa (veritabanı istemeyen testler) dokunmaz.
 */
import "dotenv/config";

const YEREL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function sunucu(adres: string): string | null {
  try {
    return new URL(adres).hostname.toLowerCase();
  } catch {
    return null;
  }
}

if (!process.argv.includes("--zorla")) {
  const neden: string[] = [];
  if (process.env.NODE_ENV === "production") neden.push("NODE_ENV=production");
  const adres = process.env.DATABASE_URL;
  if (adres) {
    const s = sunucu(adres);
    // Adresi yazdırmıyoruz: içinde parola var.
    if (!s || !YEREL.has(s)) neden.push("DATABASE_URL yerel bir sunucuyu göstermiyor");
  }
  if (neden.length) {
    console.error(`✗ Test durduruldu: ${neden.join(", ")}.`);
    console.error("  Testler veritabanına kendi kayıtlarını yazıp siler; üretimde çalışmamalı.");
    console.error("  Bilerek başka bir sunucuda koşmak için: npm run <test> -- --zorla");
    process.exit(1);
  }
}

export {};
