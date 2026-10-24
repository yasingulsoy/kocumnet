/**
 * Üç sözlük (lib/i18n/locales/{tr,en,ar}.json) aynı anahtarlara mı sahip?
 *   npm run i18n:check
 * Dictionary tipi tr.json'dan türüyor; en ve ar'daki eksik anahtarı tsc
 * yakalamaz (getDictionary tür dönüşümü yapıyor), sayfada boş metin olarak
 * çıkar. Dizilerde uzunluk da karşılaştırılır (adım listeleri, SSS).
 * tr'de dolu olup en/ar'da boş kalan metin de hatadır; tersine izin var
 * (yalnızca çeviride gereken not, ör. home.checkupLangNote: tr'de boş).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const kok = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "i18n", "locales");
const oku = (dil) => JSON.parse(readFileSync(join(kok, `${dil}.json`), "utf8"));

/** "a.b[2].c" biçiminde yaprak yolları ve türleri. */
function yollar(deger, onek = "", cikti = new Map()) {
  if (Array.isArray(deger)) {
    cikti.set(`${onek}[]`, `dizi(${deger.length})`);
    deger.forEach((v, i) => yollar(v, `${onek}[${i}]`, cikti));
  } else if (deger && typeof deger === "object") {
    for (const [k, v] of Object.entries(deger)) yollar(v, onek ? `${onek}.${k}` : k, cikti);
  } else {
    cikti.set(onek, typeof deger === "string" && !deger.trim() ? "boş" : typeof deger);
  }
  return cikti;
}

/** Tür karşılaştırması: tr'de boş metin, çeviride dolu olabilir. */
const uyar = (trTur, dilTur) => trTur === dilTur || (trTur === "boş" && dilTur === "string");

const tr = yollar(oku("tr"));
let hata = 0;
for (const dil of ["en", "ar"]) {
  const d = yollar(oku(dil));
  for (const [y, t] of tr) {
    if (!d.has(y)) {
      console.log(`  ✗ ${dil}: eksik ${y}`);
      hata++;
    } else if (!uyar(t, d.get(y))) {
      console.log(`  ✗ ${dil}: ${y} türü farklı (tr ${t}, ${dil} ${d.get(y)})`);
      hata++;
    }
  }
  for (const y of d.keys()) {
    if (!tr.has(y)) {
      console.log(`  ✗ ${dil}: fazla ${y} (tr'de yok)`);
      hata++;
    }
  }
}
console.log(hata ? `\n✗ ${hata} uyuşmazlık` : `✓ tr, en, ar aynı anahtarlara sahip (${tr.size} yol)`);
process.exit(hata ? 1 : 0);
