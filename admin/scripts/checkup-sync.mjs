/**
 * Check-up uygulamasından (kocumnet/app) şemayı ve saf modülleri kopyalar.
 *
 *   npm run checkup:sync    → kopyalar
 *   npm run checkup:check   → fark varsa HATA verir (dev bununla başlar)
 *
 * NEDEN KOPYA: Şemanın ve migration'ların TEK sahibi check-up uygulaması.
 * Yönetim paneli aynı veritabanına yazıyor ama şemayı değiştirmez, yalnızca
 * ondan client üretir. Soru yazım biçimi (`$…$` → blok dizisi), şık kuralları
 * ve puanlama eşikleri de iki tarafta BİREBİR aynı olmalı: panelde kaydedilen
 * soru öğrenci tarafında aynı ayrıştırıcıdan geçiyor.
 *
 * Elle düzenlenen iki kopya sessizce sürüklenir — panel var olmayan bir
 * sütuna yazmaya çalışır ya da öğrencinin "zayıf" gördüğü konuyu "orta"
 * gösterir. Hata da ancak o ekran açıldığında, üretimde çıkar. Bu betik
 * sürüklenmeyi geliştirme anında yakalar.
 *
 * Deploy ortamında app/ dizini olmayabilir: o zaman --check uyarıp geçer;
 * build zaten depodaki kopyalarla yapılır.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const burasi = dirname(fileURLToPath(import.meta.url));
const ADMIN = resolve(burasi, "..");
const APP = resolve(ADMIN, "../app");

/** Yalnızca SAF modüller: veritabanı, çerez, Next API'si bilmeyenler. */
const MODULLER = [
  "question-content.ts", // blok şeması, parmak izi, şık doğrulaması
  "question-markup.ts", // `$…$` yazım biçimi ↔ blok dizisi
  "error-types.ts", // çeldirici hata tipleri
  "scoring.ts", // net, konu seviyesi eşikleri
  "insights.ts", // çok testli konu haritası (öğrenci panosuyla aynı eşik)
];

const kaynaklar = [
  {
    kaynak: resolve(APP, "prisma/schema.prisma"),
    hedef: resolve(ADMIN, "prisma/checkup.prisma"),
    donustur(metin) {
      const cikti = metin.replace(
        /output\s*=\s*"[^"]*"/,
        'output   = "../src/lib/checkup/generated"'
      );
      if (cikti === metin) {
        throw new Error("Şemada generator output satırı bulunamadı — biçim değişmiş olabilir.");
      }
      return (
        "// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.\n" +
        "// Kaynak: kocumnet/app/prisma/schema.prisma (şemanın ve migration'ların sahibi).\n" +
        "// Eşitlemek için: npm run checkup:sync\n" +
        "// Yönetim paneli bu şemadan YALNIZCA client üretir; migration çalıştırmaz.\n\n" +
        cikti
      );
    },
  },
  ...MODULLER.map((ad) => ({
    kaynak: resolve(APP, "lib", ad),
    hedef: resolve(ADMIN, "src/lib/checkup/shared", ad),
    donustur(metin) {
      // Kopya başka bir dizinde duruyor; "@/lib/..." orada başka yeri gösterir.
      if (/from\s+["']@\//.test(metin)) {
        throw new Error(
          `app/lib/${ad} "@/..." ile import ediyor. Paylaşılan modüller yalnızca ` +
            `göreli ("./x") ya da paket importu kullanabilir.`
        );
      }
      return (
        "// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.\n" +
        `// Kaynak: kocumnet/app/lib/${ad} · eşitlemek için: npm run checkup:sync\n\n` +
        metin
      );
    },
  })),
];

const oku = (yol) => readFileSync(yol, "utf8").replace(/\r\n/g, "\n");
const kontrol = process.argv.includes("--check");

if (!existsSync(APP)) {
  const mesaj = "app/ dizini yok (deploy ortamı?) — check-up kopyaları denetlenmedi.";
  if (kontrol) {
    console.warn("⚠ " + mesaj);
    process.exit(0);
  }
  console.error("✗ " + mesaj);
  process.exit(1);
}

const farkli = [];
for (const { kaynak, hedef, donustur } of kaynaklar) {
  const beklenen = donustur(oku(kaynak));
  const mevcut = existsSync(hedef) ? oku(hedef) : null;
  if (mevcut === beklenen) continue;

  if (kontrol) {
    farkli.push(relative(ADMIN, hedef));
  } else {
    mkdirSync(dirname(hedef), { recursive: true });
    writeFileSync(hedef, beklenen);
    console.log("✓ " + relative(ADMIN, hedef));
  }
}

if (kontrol && farkli.length) {
  console.error(
    "✗ Check-up kopyaları kaynaktan (app/) farklı:\n" +
      farkli.map((f) => "    " + f).join("\n") +
      "\n  Eşitlemek için: npm run checkup:sync" +
      "\n  (Şema değiştiyse önce app/'te migration oluşturulmuş olmalı.)"
  );
  process.exit(1);
}

console.log(kontrol ? "✓ check-up kopyaları eşit" : "✓ eşitleme tamam");
