import "./_koruma.mjs";
/**
 * Paneldeki "Hocaya sorular" cevap kuralları (admin/src/lib/checkup/hoca/cevap.ts):
 * doğrulama ve normalleştirme (her cevap türü, sınırlar, kötü girdi), durum,
 * ilerleme, süzgeç ve cevapların Markdown dökümü. Veritabanı istemez.
 *   npx tsx scripts/hoca-cevap-test.mts
 *
 * Modül panelde duruyor; statik import YOK, bilerek (deneme-panel-test.mts'teki
 * gerekçe: app ayrı derleniyor, `next build` tip denetimi scripts/'i de kapsıyor).
 * Dosya yoksa test atlanır; CI'da bu bir HATADIR.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

// ─── Modülün bu testin kullandığı yüzü (tipler.ts'in kopyası değil, yalnızca gereken kadarı) ───

type Deger =
  | { tur: "uygunMu"; karar: "uygun" | "degissin" }
  | { tur: "secenek"; secilen: string[] }
  | { tur: "sayi"; sayi: number }
  | { tur: "tablo"; hucreler: Record<string, Record<string, string>> }
  | { tur: "metin" };
type Durum = "bekliyor" | "cevaplandi" | "uygulandi";
type Suzgec = "tumu" | "bekleyen" | "cevaplanan" | "uygulanan" | "acil";
interface Soru {
  anahtar: string;
  baslik: string;
  soru: string;
  oncelik?: "acil" | "normal" | "sonra";
  cevap: Record<string, unknown> & { tur: string };
}
interface Bolum {
  anahtar: string;
  baslik: string;
  sorular: Soru[];
}
type Dogrulama =
  | { ok: true; deger: Deger | null; not: string | null; bos: boolean }
  | { ok: false; hata: string; hucre?: { satir: string; sutun: string } };
interface Kayit {
  questionKey: string;
  value: unknown;
  note: string | null;
  answeredByStaff: string | null;
  answeredAt: Date | null;
  appliedAt: Date | null;
  appliedByStaff: string | null;
  appliedNote: string | null;
}
interface Ilerleme {
  toplam: number;
  cevaplanan: number;
  uygulanan: number;
  bekleyen: number;
  acil: number;
  acilBekleyen: number;
  bolumler: { anahtar: string; no: number; toplam: number; cevaplanan: number; uygulanan: number; acilBekleyen: number }[];
}
interface Modul {
  NOT_SINIRI: number;
  HUCRE_SINIRI: number;
  metniTemizle(s: string): string;
  tarihCoz(s: string): string | null;
  sayiCoz(x: unknown): { ok: true; v: number | null } | { ok: false; hata: string };
  sayiYaz(n: number): string;
  iyelikEki(n: number): string;
  cevapDogrula(soru: Soru, girdi: unknown): Dogrulama;
  degerOku(soru: Soru, json: unknown): { deger: Deger | null; uyumsuz: boolean };
  kararliJson(x: unknown): string;
  cevapEsitMi(a: { deger: unknown; not: string | null }, b: { deger: unknown; not: string | null }): boolean;
  cevapDurumu(k: { value: unknown; note: string | null; appliedAt: Date | null } | null | undefined): Durum;
  soruListesi(b: Bolum[]): { numara: string; soru: Soru; bolumNo: number }[];
  soruBul(b: Bolum[], anahtar: string): { numara: string } | null;
  durumHaritasi(k: Kayit[]): Record<string, Durum>;
  ilerlemeHesapla(b: Bolum[], d: Record<string, Durum | undefined>): Ilerleme;
  SUZGECLER: readonly Suzgec[];
  isSuzgec(x: unknown): boolean;
  suzgecSayilari(b: Bolum[], d: Record<string, Durum | undefined>): Record<Suzgec, number>;
  cevapOzeti(soru: Soru, deger: Deger | null, s?: { kod?: boolean }): string;
  cevaplarMarkdown(b: Bolum[], k: Kayit[], s: { simdi: Date }): string;
}

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "../../admin/src/lib/checkup/hoca");
const YOL = resolve(KOK, "cevap.ts");
if (!existsSync(YOL)) {
  if (process.env.CI) {
    console.error("✗ admin/src/lib/checkup/hoca/cevap.ts bulunamadı: CI'da hoca cevap kuralları testi atlanamaz.");
    console.error("  Dosya taşındıysa ya da adı değiştiyse bu betikteki YOL'u güncelle.");
    process.exit(1);
  }
  console.log("admin/ yok (ayrı derleme ortamı): hoca cevap kuralları testi atlandı.");
  process.exit(0);
}
const m = (await import(pathToFileURL(YOL).href)) as Modul;

const ok = (d: Dogrulama) => (d.ok ? d : null);
const hataMi = (d: Dogrulama, parca?: string) => !d.ok && (parca === undefined || d.hata.includes(parca));

// ─── Örnek sorular (gerçek içerikten bağımsız) ───────────────────────

const UYGUN: Soru = { anahtar: "t.uygun", baslik: "Onay", soru: "Uygun mu?", oncelik: "acil", cevap: { tur: "uygunMu" } };
const TEK: Soru = {
  anahtar: "t.tek",
  baslik: "Tek seçim",
  soru: "Hangisi?",
  cevap: {
    tur: "secenek",
    secenekler: [
      { deger: "a", etiket: "Birinci yol", onerilen: true },
      { deger: "b", etiket: "İkinci yol" },
      { deger: "c", etiket: "Üçüncü | yol" },
    ],
  },
};
const COKLU: Soru = { ...TEK, anahtar: "t.coklu", baslik: "Çoklu seçim", cevap: { ...TEK.cevap, cokluSecim: true } };
const SAYI: Soru = {
  anahtar: "t.sayi",
  baslik: "Günlük soru",
  soru: "Günde kaç soru?",
  oncelik: "acil",
  cevap: { tur: "sayi", birim: "soru", enAz: 5, enCok: 100, simdiki: 30 },
};
const SERBEST_SAYI: Soru = { anahtar: "t.serbest", baslik: "Serbest", soru: "?", cevap: { tur: "sayi" } };
const TABLO: Soru = {
  anahtar: "t.tablo",
  baslik: "Sınav sabitleri",
  soru: "Doğru mu?",
  cevap: {
    tur: "tablo",
    sutunlar: [
      { anahtar: "soru", baslik: "Soru sayısı", tur: "sayi", birim: "soru" },
      { anahtar: "tarih", baslik: "Sınav tarihi", tur: "tarih" },
      { anahtar: "ceza", baslik: "Yanlış götürme", tur: "metin" },
    ],
    satirlar: [
      { anahtar: "TYT", baslik: "TYT", simdiki: { soru: 40, tarih: null, ceza: "4 yanlış 1 doğru" } },
      { anahtar: "LGS", baslik: "LGS", simdiki: { soru: 20, tarih: null, ceza: "3 yanlış 1 doğru" } },
    ],
  },
};
const METIN: Soru = { anahtar: "t.metin", baslik: "Biçim", soru: "Sorular hangi biçimde?", cevap: { tur: "metin", ipucu: "Word, PDF…" } };

// ─── Metin, tarih, sayı ──────────────────────────────────────────────

console.log("\nMetin, tarih, sayı:");
check("metniTemizle: CRLF, sekme, denetim karakteri, satır sonu boşluğu", m.metniTemizle("  a\r\nb\t c \u0007\r\n\n\n\nd  ") === "a\nb  c\n\nd");
check("metniTemizle: yön karakterleri (\\u202e) atılır", m.metniTemizle("ab‮cd") === "abcd");
check("tarih: 21.06.2027", m.tarihCoz("21.06.2027") === "21.06.2027");
check("tarih: 1.6.2027 → 01.06.2027", m.tarihCoz("1.6.2027") === "01.06.2027");
check("tarih: 01/06/2027 ve 1-6-2027 ve 1,6,2027", ["01/06/2027", "1-6-2027", "1,6,2027"].every((t) => m.tarihCoz(t) === "01.06.2027"));
check("tarih: 29.02.2028 (artık yıl) geçerli", m.tarihCoz("29.02.2028") === "29.02.2028");
check(
  "tarih: 29.02.2027, 31.04.2027, 32.01.2027, 00.01.2027, 15.13.2027 geçersiz",
  ["29.02.2027", "31.04.2027", "32.01.2027", "00.01.2027", "15.13.2027"].every((t) => m.tarihCoz(t) === null)
);
check("tarih: 2027-06-21, 21.06.27, metin geçersiz", ["2027-06-21", "21.06.27", "haziran"].every((t) => m.tarihCoz(t) === null));
const sayi = (x: unknown) => {
  const s = m.sayiCoz(x);
  return s.ok ? s.v : "HATA";
};
check("sayı: '40', ' 12 ', '0,25', '0.25', '-3'", sayi("40") === 40 && sayi(" 12 ") === 12 && sayi("0,25") === 0.25 && sayi("0.25") === 0.25 && sayi("-3") === -3);
check("sayı: boş ve null → null", sayi("") === null && sayi("   ") === null && sayi(null) === null);
check("sayı: '1.000' belirsiz → hata (bin mi, bir mi?)", sayi("1.000") === "HATA");
check("sayı: '1.5' geçerli, '1,2,3' hata", sayi("1.5") === 1.5 && sayi("1,2,3") === "HATA");
check("sayı: 'abc', NaN, Infinity, 1e12, nesne → hata", ["abc", NaN, Infinity, 1e12, {}].every((x) => sayi(x) === "HATA"));
check("sayıYaz: 0.25 → 0,25", m.sayiYaz(0.25) === "0,25" && m.sayiYaz(40) === "40");
check(
  "iyelik eki: 1’i 2’si 3’ü 6’sı 9’u 10’u 23’ü 40’ı 100’ü 112’si 1000’i 0’ı",
  [
    [1, "’i"],
    [2, "’si"],
    [3, "’ü"],
    [6, "’sı"],
    [9, "’u"],
    [10, "’u"],
    [23, "’ü"],
    [40, "’ı"],
    [100, "’ü"],
    [112, "’si"],
    [1000, "’i"],
    [0, "’ı"],
  ].every(([n, e]) => m.iyelikEki(n as number) === e)
);

// ─── Uygun / Değişsin ────────────────────────────────────────────────

console.log("\nUygun mu:");
{
  const a = ok(m.cevapDogrula(UYGUN, { deger: { tur: "uygunMu", karar: "uygun" } }));
  check("uygun → değer, not yok, boş değil", a !== null && a.deger?.tur === "uygunMu" && a.not === null && !a.bos);
  const b = ok(m.cevapDogrula(UYGUN, { deger: { tur: "uygunMu", karar: "degissin" }, not: "  45 dakika olsun  " }));
  check("değişsin + not (kırpılır)", b !== null && b.deger?.tur === "uygunMu" && b.deger.karar === "degissin" && b.not === "45 dakika olsun");
  check("bilinmeyen karar → hata", hataMi(m.cevapDogrula(UYGUN, { deger: { tur: "uygunMu", karar: "evet" } })));
  const c = ok(m.cevapDogrula(UYGUN, { deger: { tur: "uygunMu" }, not: "Emin değilim" }));
  check("yalnızca not → değer null, cevaplandı sayılır", c !== null && c.deger === null && c.not === "Emin değilim" && !c.bos);
  check("başka türün değeri → hata", hataMi(m.cevapDogrula(UYGUN, { deger: { tur: "sayi", sayi: 3 } }), "türüne"));
  check("değer nesne değil → hata", hataMi(m.cevapDogrula(UYGUN, { deger: "uygun" })));
}

// ─── Seçenek ─────────────────────────────────────────────────────────

console.log("\nSeçenek:");
{
  const a = ok(m.cevapDogrula(TEK, { deger: { tur: "secenek", secilen: ["b"] } }));
  check("tek seçim", a !== null && a.deger?.tur === "secenek" && a.deger.secilen.join() === "b");
  check("tek seçimde iki seçenek → hata", hataMi(m.cevapDogrula(TEK, { deger: { tur: "secenek", secilen: ["a", "b"] } }), "yalnızca bir"));
  const ikiKez = ok(m.cevapDogrula(TEK, { deger: { tur: "secenek", secilen: ["a", "a"] } }));
  check("aynı seçenek iki kez → teke iner (tek seçimde de geçer)", ikiKez?.deger?.tur === "secenek" && ikiKez.deger.secilen.join() === "a");
  const b = ok(m.cevapDogrula(COKLU, { deger: { tur: "secenek", secilen: ["c", "a", "c"] } }));
  check("çoklu seçim: tekrar atılır, sorudaki sıraya dizilir", b !== null && b.deger?.tur === "secenek" && b.deger.secilen.join() === "a,c");
  check("bilinmeyen seçenek → hata", hataMi(m.cevapDogrula(TEK, { deger: { tur: "secenek", secilen: ["z"] } })));
  check("seçilen dizi değil → hata", hataMi(m.cevapDogrula(TEK, { deger: { tur: "secenek", secilen: "a" } })));
  check("sayı öğesi → hata", hataMi(m.cevapDogrula(TEK, { deger: { tur: "secenek", secilen: [1] } })));
  check("aşırı uzun dizi → hata", hataMi(m.cevapDogrula(COKLU, { deger: { tur: "secenek", secilen: Array(50).fill("a") } })));
  const c = ok(m.cevapDogrula(TEK, { deger: { tur: "secenek", secilen: [] } }));
  check("boş seçim → hiç cevap yok", c !== null && c.deger === null && c.bos);
}

// ─── Sayı ────────────────────────────────────────────────────────────

console.log("\nSayı:");
{
  const s = (x: unknown, soru = SAYI) => m.cevapDogrula(soru, { deger: { tur: "sayi", sayi: x } });
  check("sınırlar dahil: 5 ve 100", ok(s(5))?.deger?.tur === "sayi" && ok(s(100))?.deger?.tur === "sayi");
  check("4 ve 101 → hata (aralık metni birimli)", hataMi(s(4), "5 ile 100 soru") && hataMi(s(101), "arasında"));
  const a = ok(s("45"));
  check("metin '45' → sayı 45", a !== null && a.deger?.tur === "sayi" && a.deger.sayi === 45);
  const b = ok(s("7,5"));
  check("'7,5' → 7.5", b !== null && b.deger?.tur === "sayi" && b.deger.sayi === 7.5);
  check("boş metin → değer yok", ok(s(""))?.bos === true);
  check("'abc', NaN, Infinity → hata", hataMi(s("abc")) && hataMi(s(NaN)) && hataMi(s(Infinity)));
  check("sınırsız soruda büyük sayı geçer, 1e9 geçmez", ok(s(123456, SERBEST_SAYI))?.deger?.tur === "sayi" && hataMi(s(1e9, SERBEST_SAYI)));
}

// ─── Tablo ───────────────────────────────────────────────────────────

console.log("\nTablo:");
{
  const t = (h: unknown) => m.cevapDogrula(TABLO, { deger: { tur: "tablo", hucreler: h } });
  const a = ok(t({ LGS: { tarih: " 7.6.2027 ", soru: "", ceza: "  yok   artık " }, TYT: { soru: "40", tarih: "" } }));
  check(
    "normalize: tarih GG.AA.YYYY, metin tek boşluk, boş hücre atılır, satır/sütun sırası sorudaki gibi",
    a !== null &&
      m.kararliJson(a.deger) === m.kararliJson({ tur: "tablo", hucreler: { TYT: { soru: "40" }, LGS: { tarih: "07.06.2027", ceza: "yok artık" } } }) &&
      Object.keys((a.deger as { hucreler: object }).hucreler).join() === "TYT,LGS",
    a ? JSON.stringify(a.deger) : ""
  );
  const b = ok(t({ TYT: { soru: 45, tarih: null } }));
  check("sayı sütununa sayı türü de olur; null hücre atılır", b !== null && b.deger?.tur === "tablo" && b.deger.hucreler.TYT.soru === "45");
  const c = ok(t({ TYT: { soru: "0.5" } }));
  check("sayı hücresi Türkçe yazılır: 0.5 → 0,5", c !== null && c.deger?.tur === "tablo" && c.deger.hucreler.TYT.soru === "0,5");
  const bos = ok(t({ TYT: { soru: " ", tarih: "" }, LGS: {} }));
  check("hepsi boş → değer yok", bos !== null && bos.deger === null && bos.bos);
  const kotuTarih = t({ TYT: { tarih: "31.02.2027" } });
  check(
    "geçersiz tarih → hücreli hata",
    !kotuTarih.ok && kotuTarih.hucre?.satir === "TYT" && kotuTarih.hucre?.sutun === "tarih" && kotuTarih.hata.includes("GG.AA.YYYY")
  );
  check("sayı sütununda yazı → hata", hataMi(t({ LGS: { soru: "yirmi" } }), "LGS · Soru sayısı"));
  check("tanımsız satır → hata", hataMi(t({ AYT: { soru: "40" } }), "satır"));
  check("tanımsız sütun → hata", hataMi(t({ TYT: { sure: "135" } }), "sütun"));
  check("metin sütununa sayı türü → hata", hataMi(t({ TYT: { ceza: 4 } })));
  check("çok uzun hücre → hata", hataMi(t({ TYT: { ceza: "x".repeat(m.HUCRE_SINIRI + 1) } }), String(m.HUCRE_SINIRI)));
  check("hücreler nesne değil → hata", hataMi(t(["TYT"])) && hataMi(t({ TYT: "40" })));
}

// ─── Yazı ve not ─────────────────────────────────────────────────────

console.log("\nYazı sorusu ve not:");
{
  const a = ok(m.cevapDogrula(METIN, { not: "Word dosyası\r\nve PDF" }));
  check("yazı: cevap notta, değer { tur: metin }", a !== null && a.deger?.tur === "metin" && a.not === "Word dosyası\nve PDF");
  check("yazı: boş → hiç cevap yok", ok(m.cevapDogrula(METIN, { not: "   " }))?.bos === true);
  check("yazı: başka türün değeri → hata", hataMi(m.cevapDogrula(METIN, { deger: { tur: "uygunMu", karar: "uygun" }, not: "x" })));
  const sinir = m.NOT_SINIRI;
  check(`not: ${sinir} karakter geçer`, ok(m.cevapDogrula(UYGUN, { not: "a".repeat(sinir) }))?.not?.length === sinir);
  check(`not: ${sinir + 1} karakter → hata`, hataMi(m.cevapDogrula(UYGUN, { not: "a".repeat(sinir + 1) }), String(sinir)));
  check("not: dev metin temizlenmeden reddedilir", hataMi(m.cevapDogrula(UYGUN, { not: "a".repeat(sinir * 6) })));
  check("not: yalnızca boşluk → null", ok(m.cevapDogrula(UYGUN, { deger: { tur: "uygunMu", karar: "uygun" }, not: " \n " }))?.not === null);
  check("not metin değil → hata", hataMi(m.cevapDogrula(UYGUN, { not: 5 })));
  check("hiçbir şey → boş", ok(m.cevapDogrula(UYGUN, {}))?.bos === true && ok(m.cevapDogrula(TABLO, null))?.bos === true);
  check("girdi nesne değil → hata", hataMi(m.cevapDogrula(UYGUN, "uygun")) && hataMi(m.cevapDogrula(UYGUN, [1])));
}

// ─── Kayıtlı değeri okuma, eşitlik ───────────────────────────────────

console.log("\nKayıtlı değer, eşitlik:");
{
  check("degerOku: geçerli", m.degerOku(TEK, { tur: "secenek", secilen: ["a"] }).uyumsuz === false);
  check("degerOku: null → cevap yok, uyumsuz değil", m.degerOku(TEK, null).deger === null && !m.degerOku(TEK, null).uyumsuz);
  check("degerOku: seçenek artık yok → uyumsuz", m.degerOku(TEK, { tur: "secenek", secilen: ["eski"] }).uyumsuz);
  check("degerOku: tür değişmiş → uyumsuz", m.degerOku(SAYI, { tur: "uygunMu", karar: "uygun" }).uyumsuz);
  check("degerOku: yazı sorusu", m.degerOku(METIN, { tur: "metin" }).deger?.tur === "metin" && m.degerOku(METIN, { tur: "x" }).uyumsuz);
  // PostgreSQL jsonb anahtarları yeniden dizer: karşılaştırma sıradan bağımsız olmalı.
  const yazilan = { tur: "tablo", hucreler: { TYT: { soru: "40", tarih: "01.06.2027" } } };
  const okunan = { hucreler: { TYT: { tarih: "01.06.2027", soru: "40" } }, tur: "tablo" };
  check("cevapEsitMi: anahtar sırası önemsiz", m.cevapEsitMi({ deger: yazilan, not: "x" }, { deger: okunan, not: "x" }));
  check("cevapEsitMi: not farkı", !m.cevapEsitMi({ deger: yazilan, not: "x" }, { deger: okunan, not: "y" }));
  check("cevapEsitMi: boş not = null", m.cevapEsitMi({ deger: null, not: "" }, { deger: null, not: null }));
  check("cevapEsitMi: değer farkı", !m.cevapEsitMi({ deger: { tur: "sayi", sayi: 1 }, not: null }, { deger: { tur: "sayi", sayi: 2 }, not: null }));
}

// ─── Durum, ilerleme, süzgeç ─────────────────────────────────────────

console.log("\nDurum, ilerleme, süzgeç:");
const T0 = new Date("2026-10-24T11:05:00Z"); // Türkiye: 14:05
const T1 = new Date("2026-10-25T07:30:00Z"); // Türkiye: 10:30
const kayit = (k: Partial<Kayit> & { questionKey: string }): Kayit => ({
  value: null,
  note: null,
  answeredByStaff: "ozgur@kocum.net (#3)",
  answeredAt: T0,
  appliedAt: null,
  appliedByStaff: null,
  appliedNote: null,
  ...k,
});
{
  check("durum: kayıt yok → bekliyor", m.cevapDurumu(null) === "bekliyor" && m.cevapDurumu(undefined) === "bekliyor");
  check("durum: değer de not da boş → bekliyor", m.cevapDurumu({ value: null, note: "  ", appliedAt: T1 }) === "bekliyor");
  check("durum: yalnızca not → cevaplandı", m.cevapDurumu({ value: null, note: "x", appliedAt: null }) === "cevaplandi");
  check("durum: değer → cevaplandı", m.cevapDurumu({ value: { tur: "uygunMu", karar: "uygun" }, note: null, appliedAt: null }) === "cevaplandi");
  check("durum: appliedAt → uygulandı", m.cevapDurumu({ value: { tur: "uygunMu", karar: "uygun" }, note: null, appliedAt: T1 }) === "uygulandi");
}

const BOLUMLER: Bolum[] = [
  { anahtar: "b1", baslik: "Birinci bölüm", sorular: [UYGUN, TEK, SAYI] },
  { anahtar: "b2", baslik: "İkinci bölüm", sorular: [COKLU, TABLO, METIN] },
];
const KAYITLAR: Kayit[] = [
  kayit({ questionKey: "t.uygun", value: { tur: "uygunMu", karar: "degissin" }, note: "Süre 45 dakika olsun.\nİkinci satır | çizgi" }),
  kayit({
    questionKey: "t.tek",
    value: { tur: "secenek", secilen: ["a"] },
    appliedAt: T1,
    appliedByStaff: "yasin@kocum.net (#1)",
    appliedNote: "Varsayılan yapıldı",
  }),
  kayit({ questionKey: "t.tablo", value: { hucreler: { LGS: { tarih: "07.06.2027" } }, tur: "tablo" } }),
  kayit({ questionKey: "t.metin", value: { tur: "metin" }, note: "Word ve PDF" }),
  kayit({ questionKey: "eski.soru", value: { tur: "sayi", sayi: 9 }, note: "Artık yok" }),
  kayit({ questionKey: "t.coklu", value: null, note: null }), // boş kayıt: bekliyor sayılır
];
{
  const d = m.durumHaritasi(KAYITLAR);
  check("durum haritası", d["t.uygun"] === "cevaplandi" && d["t.tek"] === "uygulandi" && d["t.coklu"] === "bekliyor");
  const i = m.ilerlemeHesapla(BOLUMLER, d);
  check(
    "ilerleme: 6 soru, 4 cevaplanan (uygulananlar dahil), 1 uygulanan, 2 bekleyen",
    i.toplam === 6 && i.cevaplanan === 4 && i.uygulanan === 1 && i.bekleyen === 2,
    JSON.stringify({ t: i.toplam, c: i.cevaplanan, u: i.uygulanan, b: i.bekleyen })
  );
  check("ilerleme: 2 acil, 1 acil bekleyen (sayı sorusu)", i.acil === 2 && i.acilBekleyen === 1);
  check(
    "ilerleme: bölüm bazında",
    i.bolumler[0].toplam === 3 && i.bolumler[0].cevaplanan === 2 && i.bolumler[0].uygulanan === 1 && i.bolumler[0].acilBekleyen === 1 &&
      i.bolumler[1].cevaplanan === 2 && i.bolumler[1].no === 2
  );
  check("ilerleme: listede olmayan anahtar sayılmaz", m.ilerlemeHesapla(BOLUMLER, { "eski.soru": "cevaplandi" }).cevaplanan === 0);
  const s = m.suzgecSayilari(BOLUMLER, d);
  check(
    "süzgeç: bekleyen + cevaplanan + uygulanan = tümü; acil = acil bekleyen",
    s.tumu === 6 && s.bekleyen + s.cevaplanan + s.uygulanan === s.tumu && s.cevaplanan === 3 && s.uygulanan === 1 && s.acil === 1,
    JSON.stringify(s)
  );
  check("isSuzgec", m.isSuzgec("acil") && !m.isSuzgec("hepsi") && !m.isSuzgec(undefined) && m.SUZGECLER.length === 5);
  const l = m.soruListesi(BOLUMLER);
  check("numara: bölüm.sıra", l[0].numara === "1.1" && l[4].numara === "2.2" && m.soruBul(BOLUMLER, "t.metin")?.numara === "2.3");
  check("soruBul: yok → null", m.soruBul(BOLUMLER, "yok.boyle") === null);
}

// ─── İnsan okur özet, Markdown ───────────────────────────────────────

console.log("\nÖzet ve Markdown dökümü:");
{
  check("özet: uygun / değişsin", m.cevapOzeti(UYGUN, { tur: "uygunMu", karar: "uygun" }).startsWith("Uygun") && m.cevapOzeti(UYGUN, { tur: "uygunMu", karar: "degissin" }) === "Değişsin");
  check("özet: seçenek etiketi (+ kod)", m.cevapOzeti(TEK, { tur: "secenek", secilen: ["a"] }) === "Birinci yol" && m.cevapOzeti(TEK, { tur: "secenek", secilen: ["b"] }, { kod: true }) === "İkinci yol (`b`)");
  check("özet: sayı birimli, şu anki değerle", m.cevapOzeti(SAYI, { tur: "sayi", sayi: 45 }) === "45 soru (şu an: 30 soru)");
  check("özet: boş → tire", m.cevapOzeti(SAYI, null) === "—");

  const md = m.cevaplarMarkdown(BOLUMLER, KAYITLAR, { simdi: T1 });
  const has = (s: string) => md.includes(s);
  check("başlık ve dışa aktarma zamanı (Türkiye saati)", has("# Hocaya sorular — cevaplar") && has("Dışa aktarma: 25.10.2026 10:30"));
  check("özet sayılar", has("- Toplam soru: 6") && has("- Cevaplanan: 4 (uygulanan 1, uygulanmayı bekleyen 3)") && has("- Cevap bekleyen: 2 (acil 1)"));
  const bekleyenler = md.split("## Uygulanmayı bekleyenler")[1]?.split("\n## ")[0] ?? "";
  check(
    "uygulanmayı bekleyenler: cevaplanıp uygulanmayanlar, uygulanan değil",
    bekleyenler.includes("1.1 `t.uygun`") && bekleyenler.includes("2.2 `t.tablo`") && bekleyenler.includes("2.3 `t.metin`") && !bekleyenler.includes("t.tek")
  );
  check("bölüm ve soru başlıkları numaralı", has("## 1. Birinci bölüm") && has("### 1.1 Onay") && has("### 2.2 Sınav sabitleri"));
  check("anahtar, durum, öncelik", has("- Anahtar: `t.uygun`") && has("- Durum: Cevaplandı") && has("- Öncelik: Acil"));
  check("insan okur cevap: değişsin", has("- Cevap: Değişsin"));
  check("not alıntı bloğunda, çok satırlı", has("Not:\n\n> Süre 45 dakika olsun.\n> İkinci satır | çizgi"));
  check("kim ve ne zaman", has("- Cevaplayan: ozgur@kocum.net (#3) · 24.10.2026 14:05"));
  check("uygulandı satırı", has("- Uygulandı: 25.10.2026 10:30 · yasin@kocum.net (#1) — Varsayılan yapıldı") && has("- Cevap: Birinci yol (`a`)"));
  check("bekleyen soru işaretli", has("### 1.3 Günlük soru\n\n- Anahtar: `t.sayi`\n- Öncelik: Acil\n- Durum: Bekliyor"));
  check("boş kayıt bekliyor sayılır", has("### 2.1 Çoklu seçim\n\n- Anahtar: `t.coklu`\n- Durum: Bekliyor"));
  check(
    "tablo: yalnızca değişen hücre, şu anki değerle",
    has("| Satır | Sütun | Hocanın değeri | Şu an |") && has("| LGS | Sınav tarihi | 07.06.2027 | — |") && !has("| TYT |")
  );
  check("yazı sorusu: cevap metni 'Cevap:' altında", has("Cevap:\n\n> Word ve PDF"));
  check("listede olmayan anahtar ayrı bölümde, ham değerle", has("## Soru listesinde olmayan cevaplar") && has("### `eski.soru`") && has('- Değer: `{"sayi":9,"tur":"sayi"}`'));
  check("üç boş satır yok, tek satır sonuyla biter", !md.includes("\n\n\n") && md.endsWith("\n") && !md.endsWith("\n\n"));

  // Tablo hücresinde | tabloyu bozmasın.
  const boru = m.cevaplarMarkdown([{ anahtar: "b", baslik: "B", sorular: [TABLO] }], [kayit({ questionKey: "t.tablo", value: { tur: "tablo", hucreler: { TYT: { ceza: "a | b" } } } })], { simdi: T1 });
  check("tablo hücresinde | kaçışlı", boru.includes("| TYT | Yanlış götürme | a \\| b | 4 yanlış 1 doğru |"));
  // Soru sonradan değişti: ham değer kaybolmaz.
  const uyumsuz = m.cevaplarMarkdown([{ anahtar: "b", baslik: "B", sorular: [TEK] }], [kayit({ questionKey: "t.tek", value: { tur: "secenek", secilen: ["eski"] } })], { simdi: T1 });
  check("uyumsuz değer dökümde ham hâliyle", uyumsuz.includes("soru sonradan değişmiş") && uyumsuz.includes('`{"secilen":["eski"],"tur":"secenek"}`'));
}

// ─── Gerçek içerik (sorular.ts) ile duman testi ──────────────────────

console.log("\nGerçek soru listesi (sorular.ts):");
{
  const icerik = (await import(pathToFileURL(resolve(KOK, "sorular.ts")).href)) as { HOCA_BOLUMLERI: Bolum[] };
  const liste = m.soruListesi(icerik.HOCA_BOLUMLERI);
  check(`${icerik.HOCA_BOLUMLERI.length} bölüm, ${liste.length} soru`, liste.length > 0);
  const anahtarlar = new Set(liste.map((s) => s.soru.anahtar));
  check("anahtarlar benzersiz", anahtarlar.size === liste.length);
  const bosHata = liste.filter((s) => !ok(m.cevapDogrula(s.soru, {}))?.bos);
  check("her soruda boş cevap 'hiç cevap yok' sayılır", bosHata.length === 0, bosHata.map((s) => s.soru.anahtar).join(", "));
  const md = m.cevaplarMarkdown(icerik.HOCA_BOLUMLERI, [], { simdi: T1 });
  check("cevapsız döküm üretilir, her soru içinde", liste.every((s) => md.includes("`" + s.soru.anahtar + "`")));
}

console.log(failed === 0 ? "\n✓ Hoca cevap kuralları testi geçti." : `\n✗ ${failed} denetim başarısız.`);
process.exit(failed === 0 ? 0 : 1);
