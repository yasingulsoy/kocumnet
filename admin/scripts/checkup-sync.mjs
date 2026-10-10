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
  // Sınav sabitleri ve seviye ayarları: panelin hazırlık sayaçları (seviye 1'de
  // kaç kazanım, seviye 2-3'te kaç soru) öğrenci uygulamasıyla aynı sayıyı
  // kullansın. Eskiden panelde elle tutulan bir ayna vardı; hoca sayıları
  // değiştirince sessizce eskide kalırdı. levels.ts yalnızca ./exams'ten tip
  // alıyor, exams.ts hiçbir şey içe aktarmıyor.
  "exams.ts",
  "levels.ts",
  // "Bu kazanım/soru şu sınavda sorulabilir mi" kuralı. Panelin hazırlık
  // sayaçları öğrencinin karşılaşacağı havuzla birebir aynı saysın diye.
  // Yalnızca Prisma'nın üretilmiş TİPLERİNİ alıyor (aşağıdaki TIP_YOLLARI).
  "exam-scope.ts",
  // Koçluk kuralları: haftanın başı (pazartesi, Türkiye saati) ve hafta
  // etiketi. Panel koç notunu "bu haftanın" planına yazıyor; hafta sınırı
  // öğrencinin gördüğüyle aynı olmalı. Yalnızca ./scoring'den tip alıyor.
  "coaching.ts",
  // Soru dosyası içe aktarma: SORU-SABLONU çözümleme ve denetimi. Komut
  // satırı betiği (app/scripts/import-questions.mts) ile panelin "Toplu içe
  // aktar" ekranı aynı kuralla reddetsin. Yukarıdaki modüllerden içe aktarıyor.
  "question-import.ts",
];

/**
 * "@/..." importları kopyada başka yeri gösterir, bu yüzden yasak. Tek
 * istisna Prisma'nın ÜRETİLMİŞ TİPLERİ: panelin client'ı aynı şemadan
 * üretiliyor, yalnızca yolu farklı. Yalnızca `import type` kabul edilir —
 * paylaşılan modül çalışma anında veritabanı client'ına bağlanmasın.
 */
const TIP_YOLLARI = {
  "@/lib/generated/prisma/client": "../generated/client",
};

function tipYollariniCevir(metin) {
  let cikti = metin;
  for (const [uygulama, panel] of Object.entries(TIP_YOLLARI)) {
    const kalip = new RegExp(
      "(import type [^;]*?from\\s+[\"'])" + uygulama.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "([\"'])",
      "g"
    );
    cikti = cikti.replace(kalip, "$1" + panel + "$2");
  }
  return cikti;
}

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
      const cevrilmis = tipYollariniCevir(metin);
      // Kopya başka bir dizinde duruyor; "@/lib/..." orada başka yeri gösterir.
      if (/from\s+["']@\//.test(cevrilmis)) {
        throw new Error(
          `app/lib/${ad} "@/..." ile import ediyor. Paylaşılan modüller yalnızca ` +
            `göreli ("./x") ya da paket importu kullanabilir (istisna: Prisma ` +
            `tiplerinin "import type"ı, bkz. TIP_YOLLARI).`
        );
      }
      return (
        "// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.\n" +
        `// Kaynak: kocumnet/app/lib/${ad} · eşitlemek için: npm run checkup:sync\n\n` +
        cevrilmis
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
