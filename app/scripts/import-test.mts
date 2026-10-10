/**
 * Soru içe aktarma modülü (lib/question-import.ts): çözümleme + denetim.
 * Veritabanı istemez; havuz bağlamı burada elle kuruluyor.
 *   npm run test:import
 *
 * Örnek dosya (scripts/fixtures/ornek-import.md) komut satırı betiğinin ve
 * panelin "Toplu içe aktar" ekranının ortak test verisi: üçüncü soru BİLEREK
 * hatalı, ilk ikisi geçerli olmalı.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  anilanGorseller,
  dosyayiCozumle,
  dosyayiDenetle,
  gorselleriYerlestir,
  kazanimAdiSec,
  seviye1Sayilari,
  tekSoruluKazanimlar,
  type IceAktarmaBaglami,
  type IceAktarmaKazanimi,
  type SoruRaporu,
} from "../lib/question-import";
import { deriveQuestionFields, type QuestionContent } from "../lib/question-content";
import { markupToContent } from "../lib/question-markup";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORNEK = readFileSync(join(KOK, "scripts/fixtures/ornek-import.md"), "utf8");

/** Seed'deki konulardan birkaçı, sınavlarıyla. */
const KONULAR = new Map([
  ["temel-kavramlar", { id: "t-temel", examScope: "TYT", examScopes: ["TYT", "KPSS_LISANS", "DGS", "ALES"] }],
  ["bolunebilme", { id: "t-bolme", examScope: "TYT", examScopes: ["TYT", "DGS", "ALES"] }],
  ["lgs-ucgenler", { id: "t-lgs", examScope: "LGS", examScopes: ["LGS"] }],
]);

function baglam(ek: Partial<IceAktarmaBaglami> = {}): IceAktarmaBaglami {
  return {
    konular: KONULAR,
    mevcutIdler: new Set(),
    mevcutParmakIzleri: new Map(),
    kazanimlar: new Map<string, IceAktarmaKazanimi>(),
    gorselVar: () => false,
    ...ek,
  };
}

const denetle = (metin: string, b = baglam()) => dosyayiDenetle(dosyayiCozumle(metin), b);

/** Tek soruluk dosya üretir; alanlar sırayla yazılır, `null` olan alan hiç yazılmaz. */
function soru(alanlar: Record<string, string | null>, secenekler?: string[]): string {
  const varsayilan: Record<string, string | null> = {
    ID: "T-01",
    "Konu Kodu": "temel-kavramlar",
    Zorluk: "2",
    "İdeal Süre": "60",
    "Soru Metni": "Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km yol gitmiştir?",
    ...alanlar,
  };
  const satirlar = ["### Soru 01"];
  for (const [k, v] of Object.entries(varsayilan)) {
    if (v === null || k === "Çözüm Açıklaması") continue;
    satirlar.push(`* **${k}:**` + (v.includes("\n") ? "\n" + v : " " + v));
  }
  satirlar.push("* **Seçenekler:**");
  for (const s of secenekler ?? [
    "[ ] A) 120 (ISLEM_HATASI: 60·2)",
    "[x] B) 180",
    "[ ] C) 200 (TERS_ISLEM: toplama)",
    "[ ] D) 240 (EKSIK_OKUMA: 4 saat)",
    "[ ] E) 20 (TERS_ISLEM: bölme)",
  ]) {
    satirlar.push("  * " + s);
  }
  const cozum = "Çözüm Açıklaması" in alanlar ? alanlar["Çözüm Açıklaması"] : "Yol = hız · zaman = $180$ km.";
  if (cozum !== null) satirlar.push("* **Çözüm Açıklaması:**", cozum);
  return satirlar.join("\n") + "\n";
}

const ilk = (r: SoruRaporu) => r.hatalar[0] ?? "";
const hataVar = (r: SoruRaporu, parca: string) => r.hatalar.some((h) => h.includes(parca));
const uyariVar = (r: SoruRaporu, parca: string) => r.uyarilar.some((h) => h.includes(parca));

// ── örnek dosya ───────────────────────────────────────────
console.log("\nÖrnek dosya (fixtures/ornek-import.md):");
{
  const ham = dosyayiCozumle(ORNEK);
  check("3 soru bulundu", ham.length === 3, String(ham.length));
  const { sorular, hazir } = dosyayiDenetle(ham, baglam());
  check("başlık satırları 7, 35, 56", sorular.map((s) => s.satir).join(",") === "7,35,56", sorular.map((s) => s.satir).join(","));
  check("yalnızca 3. soru reddedildi", sorular.map((s) => (s.hazir ? "✓" : "✗")).join("") === "✓✓✗");
  check("2 soru yazılmaya hazır", hazir.length === 2);

  const [q1, q2, q3] = sorular;
  // Komut satırı raporu bu satırı yazar; eski betikle aynı olmalı.
  check("3. sorunun ilk hatası betiğin rapor satırı", ilk(q3) === 'Konu kodu listede yok: "olmayan-konu".', ilk(q3));
  const beklenen = [
    'Konu kodu listede yok: "olmayan-konu".',
    'Zorluk 1-5 arası olmalı (şu an "7").',
    'İdeal Süre 10-600 arası tam sayı olmalı (şu an "hızlı").',
    "Seviye 2 ve 3 sorusuna Kazanım Kodu yazılmaz.",
    "Birden fazla doğru şık işaretli: A, B.",
    "C şıkkında hata kodu yok (satır 69).",
    "E şıkkındaki hata kodu listede yok: UYDURMA_KOD.",
  ];
  check(
    "3. sorunun BÜTÜN hataları, sırasıyla",
    JSON.stringify(q3.hatalar) === JSON.stringify(beklenen),
    q3.hatalar.join(" | ")
  );
  check("3. sorunun etiketi ID", q3.id === "ORNEK-HATALI-03" && q3.baslik === "Soru 03");

  const h1 = q1.hazir!;
  check("1. soru konusu ve seviyesi", h1.topicId === "t-temel" && h1.level === "L1_TEMEL");
  check("1. soru kazanımı ve adı", h1.kazanimKodu === "ORNEK-TK-A" && Boolean(h1.kazanimAdi?.startsWith("Pozitif tam sayı")));
  check("1. soru kaynak: \"ID · kaynak\"", h1.sourceRef === "ORNEK-TK-01 · özgün", h1.sourceRef);
  check("1. soru zorluk 2, süre 60", h1.difficulty === 2 && h1.targetTimeSeconds === 60);
  check("1. soru 5 şık, doğru B", h1.drafts.length === 5 && h1.drafts.findIndex((d) => d.isCorrect) === 1);
  check(
    "1. soru hata kodları şık sırasıyla, doğruda boş",
    JSON.stringify(h1.errorTypes) === JSON.stringify(["EKSIK_OKUMA", null, "ISLEM_HATASI", "KAVRAM_YANILGISI", "EKSIK_OKUMA"]),
    JSON.stringify(h1.errorTypes)
  );
  check("1. soru blok formül ayrı blok", h1.stem.blocks.some((b) => b.type === "math_block"));
  check("1. soru çözümü var", h1.solution !== null);
  check("1. soru hedef sınavsız (konunun her sınavı)", h1.examScopes.length === 0);
  check("1. soru uyarısız", q1.uyarilar.length === 0, q1.uyarilar.join(" | "));

  const h2 = q2.hazir!;
  check("2. soru hedef sınav DGS, ALES", h2.examScopes.join(",") === "DGS,ALES");
  check("2. soru kazanım adını dosyadaki 1. sorudan alıyor", h2.kazanimAdi === null && q2.hatalar.length === 0);
  check("2. soru 4 şıklı: LGS dışı sınav uyarısı", uyariVar(q2, "4 şıklı"), q2.uyarilar.join(" | "));
  check("kazanım adı dosyadaki ilk tanımdan", kazanimAdiSec(hazir, "ORNEK-TK-A") === h1.kazanimAdi);

  const l1 = seviye1Sayilari(hazir);
  check("seviye 1 sayacı: ORNEK-TK-A × 2", l1.get("ORNEK-TK-A") === 2);
  check("iki sorulu kazanım tek-soru uyarısı vermez", tekSoruluKazanimlar(l1, new Map()).length === 0);
  check("tek sorulu kazanım uyarı verir", tekSoruluKazanimlar(new Map([["K", 1]]), new Map()).join() === "K");
  check("havuzdaki soru tek-soru uyarısını kapatır", tekSoruluKazanimlar(new Map([["K", 1]]), new Map([["K", 1]])).length === 0);
}

// ── havuzla çakışma ──────────────────────────────────────
console.log("\nHavuzla çakışma:");
{
  const b1 = baglam({ mevcutIdler: new Set(["ORNEK-TK-01"]) });
  const r1 = denetle(ORNEK, b1).sorular;
  check("ID daha önce içe aktarılmış", ilk(r1[0]) === "Bu ID daha önce içe aktarılmış.", ilk(r1[0]));
  // Reddedilen soru kazanımı "tanımlamış" sayılmaz: 2. soru adı kendisi yazmalıydı.
  check("reddedilen soru sonrakine kazanım tanımlamaz", hataVar(r1[1], "ilk kullanımda Kazanım Adı"), r1[1].hatalar.join(" | "));

  const ham = dosyayiCozumle(ORNEK);
  const ilkSoru = dosyayiDenetle(ham, baglam()).hazir[0];
  const b2 = baglam({ mevcutParmakIzleri: new Map([[ilkSoru.fingerprint, "q-havuzda"]]) });
  const r2 = dosyayiDenetle(ham, b2).sorular[0];
  check("aynı metin havuzda var", ilk(r2) === "Bu soru metni havuzda zaten var (farklı ID ile).", ilk(r2));
  check("havuzdaki sorunun kimliği raporda", r2.cift?.havuzdakiSoruId === "q-havuzda");

  const b3 = baglam({ kazanimlar: new Map([["ORNEK-TK-A", { id: "o1", topicId: "t-bolme", name: "Başka" }]]) });
  const r3 = denetle(ORNEK, b3).sorular[0];
  check("kazanım başka konuya ait", hataVar(r3, 'Kazanım "ORNEK-TK-A" başka bir konuya ait.'), r3.hatalar.join(" | "));

  const b4 = baglam({ kazanimlar: new Map([["ORNEK-TK-A", { id: "o1", topicId: "t-temel", name: "Kayıtlı ad" }]]) });
  const r4 = denetle(ORNEK, b4).sorular[0];
  check("kayıtlı kazanım: ad yazılmışsa uyarı, ret yok", r4.hatalar.length === 0 && uyariVar(r4, "zaten kayıtlı"), r4.uyarilar.join(" | "));
}

// ── dosya içi çift kayıt ─────────────────────────────────
console.log("\nDosya içi çift kayıt:");
{
  const a = soru({});
  const b = soru({ "Soru Metni": "Başka bir soru $x$ kaçtır?" });
  const r = denetle(a + "\n---\n\n" + b).sorular;
  check("aynı ID ikinci kez", ilk(r[1]) === "Aynı ID dosyada iki kez geçiyor.", ilk(r[1]));
  check("ilk geçtiği satır raporda", r[1].cift?.dosyadaSatir === r[0].satir);

  const c = soru({ ID: "T-02" });
  const r2 = denetle(a + "\n---\n\n" + c).sorular;
  check("aynı metin ikinci kez (farklı ID)", ilk(r2[1]) === "Aynı soru metni dosyada iki kez geçiyor.", ilk(r2[1]));
  check("boşluk ve büyük/küçük harf farkı çifti gizlemez", (() => {
    const d = soru({ ID: "T-03", "Soru Metni": "BİR otomobil  $60$ km/sa hızla $3$ saat yol alıyor. Kaç km yol gitmiştir?" });
    return ilk(denetle(a + "\n" + d).sorular[1]) === "Aynı soru metni dosyada iki kez geçiyor.";
  })());
}

// ── şıklar ───────────────────────────────────────────────
console.log("\nŞıklar:");
{
  const ayni = denetle(
    soru({}, ["[ ] A) 120 (ISLEM_HATASI: x)", "[x] B) 180", "[ ] C) 180 (TERS_ISLEM: y)", "[ ] D) 240 (EKSIK_OKUMA: z)", "[ ] E) 20 (DIGER)"])
  ).sorular[0];
  check("aynı değerli şık reddedilir (validateChoices)", hataVar(ayni, "aynı değere sahip"), ayni.hatalar.join(" | "));

  const celiski = denetle(soru({ "Doğru Şık": "C" })).sorular[0];
  check("[x] ile Doğru Şık çelişkisi", ilk(celiski) === '[x] B şıkkında ama "Doğru Şık" satırı C diyor — çelişki.', ilk(celiski));

  const az = denetle(soru({}, ["[x] A) 1", "[ ] B) 2 (DIGER)", "[ ] C) 3 (DIGER)"])).sorular[0];
  check("en az 4 şık", ilk(az) === "En az 4 şık gerekli (şu an 3).", ilk(az));

  const harf = denetle(
    soru({}, ["[ ] A) 1 (DIGER)", "[x] C) 2", "[ ] B) 3 (DIGER)", "[ ] D) 4 (DIGER)", "[ ] E) 5 (DIGER)"])
  ).sorular[0];
  check("şık harfleri sırayla", hataVar(harf, "Şık harfleri A, B, C"), harf.hatalar.join(" | "));

  const bos = denetle(
    soru({}, ["[ ] A) 120 (ISLEM_HATASI: x)", "[x] B) 180", "[ ] C) (TERS_ISLEM: y)", "[ ] D) 240 (EKSIK_OKUMA: z)", "[ ] E) 20 (DIGER)"])
  ).sorular[0];
  check("boş şık reddedilir", hataVar(bos, "C şıkkının metni boş."), bos.hatalar.join(" | "));

  const kodlu = denetle(
    soru({}, ["[ ] A) 120 (ISLEM_HATASI: x)", "[x] B) 180 (DIGER: not)", "[ ] C) 200 (TERS_ISLEM: y)", "[ ] D) 240 (EKSIK_OKUMA: z)", "[ ] E) 20 (DIGER)"])
  ).sorular[0];
  check("doğru şıktaki hata kodu uyarı, ret değil", kodlu.hatalar.length === 0 && uyariVar(kodlu, "Doğru şıkta (B)"));
}

// ── alanlar ──────────────────────────────────────────────
console.log("\nAlanlar:");
{
  const seviye = denetle(soru({ Seviye: "1 (Temel)", "Kazanım Kodu": "K-1", "Kazanım Adı": "Ad" })).sorular[0];
  check("parantezli seviye reddedilir", ilk(seviye).startsWith("Seviye 1, 2 veya 3 olmalı"), ilk(seviye));

  const proto = denetle(soru({ Seviye: "toString" })).sorular[0];
  check('"toString" seviye sayılmaz', ilk(proto).startsWith("Seviye 1, 2 veya 3 olmalı"), ilk(proto));

  const l1 = denetle(soru({ Seviye: "1" })).sorular[0];
  check("seviye 1'de kazanım kodu zorunlu", ilk(l1) === "Seviye 1 sorusunda Kazanım Kodu zorunlu.", ilk(l1));

  const yeniKazanim = denetle(soru({ Seviye: "1", "Kazanım Kodu": "k-yeni" })).sorular[0];
  check("yeni kazanımda ad zorunlu (kod büyük harfe)", ilk(yeniKazanim) === 'Kazanım "K-YENI" sistemde yok; ilk kullanımda Kazanım Adı yazılmalı.', ilk(yeniKazanim));

  const ortak = denetle(soru({ "Hedef Sınav": "ORTAK" })).sorular[0];
  check("Hedef Sınav: ORTAK yok", ilk(ortak).startsWith('Hedef Sınav: "ORTAK" diye bir değer yok'), ilk(ortak));
  const bilinmeyen = denetle(soru({ "Hedef Sınav": "YKS" })).sorular[0];
  check("tanınmayan sınav kodu", ilk(bilinmeyen) === 'Hedef Sınav kodu tanınmıyor: "YKS".', ilk(bilinmeyen));
  const disarida = denetle(soru({ "Hedef Sınav": "LGS" })).sorular[0];
  check("konunun sınavı olmayan hedef sınav reddedilir", hataVar(disarida, "LGS bu konunun sınavlarından değil"), disarida.hatalar.join(" | "));
  const tekrar = denetle(soru({ "Hedef Sınav": "dgs, DGS, ales" })).sorular[0];
  check("hedef sınav tekilleşir, küçük harf kabul", tekrar.hazir?.examScopes.join(",") === "DGS,ALES", tekrar.hatalar.join(" | "));

  const eksik = denetle(soru({ Zorluk: null, "İdeal Süre": null, "Konu Kodu": null })).sorular[0];
  check(
    "eksik alanlar okunur bir dille",
    JSON.stringify(eksik.hatalar.slice(0, 3)) ===
      JSON.stringify(["Konu Kodu yazılmamış.", "Zorluk yazılmamış (1-5 arası bir sayı).", "İdeal Süre yazılmamış (10-600 arası saniye)."]),
    eksik.hatalar.join(" | ")
  );

  const uyarili = denetle(soru({ "Çift": "MAT-01", "Hedef Sınavlar": "TYT", "Çözüm Açıklaması": null })).sorular[0];
  check("bilinmeyen alan uyarısı (satırıyla)", uyariVar(uyarili, 'Tanınmayan alan: "Hedef Sınavlar"'), uyarili.uyarilar.join(" | "));
  check("v2 alanı Çift için açıklama", uyariVar(uyarili, '"Çift" alanı v3\'te kalktı'));
  check("çözümsüz soru uyarı alır ama geçer", uyarili.hatalar.length === 0 && uyariVar(uyarili, "Çözüm Açıklaması boş"));

  const ikiKez = denetle(soru({ Zorluk: "2" }).replace("* **Zorluk:** 2", "* **Zorluk:** 9\n* **Zorluk:** 2")).sorular[0];
  check("iki kez yazılan alan: sonuncusu, uyarıyla", ikiKez.hatalar.length === 0 && uyariVar(ikiKez, "2 kez yazılmış"), ikiKez.uyarilar.join(" | "));

  const lgs = denetle(soru({ "Konu Kodu": "lgs-ucgenler" })).sorular[0];
  check("LGS konusunda 5 şık uyarısı", lgs.hatalar.length === 0 && uyariVar(lgs, "LGS sorusu 5 şıklı"), lgs.uyarilar.join(" | "));
}

// ── görseller ────────────────────────────────────────────
console.log("\nGörseller:");
{
  const var_ = (d: string) => ["sekil-01.png", "sekil.gif"].includes(d);
  const b = baglam({ gorselVar: var_ });
  const metin = (g: string) => soru({ "Soru Metni": `Şekle göre $x$ kaçtır?\n\n${g}` });

  const yok = denetle(metin("![Üçgen](yok.png)"), b).sorular[0];
  check("bulunamayan görsel", ilk(yok) === "Görsel dosyası bulunamadı: gorseller/yok.png", ilk(yok));
  const altsiz = denetle(metin("![](sekil-01.png)"), b).sorular[0];
  check("alt metni boş görsel", ilk(altsiz) === 'Görsel "sekil-01.png" için alternatif metin boş.', ilk(altsiz));
  const gif = denetle(metin("![Üçgen](sekil.gif)"), b).sorular[0];
  check("GIF kabul edilmez", ilk(gif) === "Görsel PNG/JPG/WebP olmalı: sekil.gif", ilk(gif));
  const iyi = denetle(metin("![Üçgen ABC](sekil-01.png)"), b).sorular[0];
  check("geçerli görsel listeleniyor", iyi.hazir?.gorseller.length === 1 && iyi.hazir.gorseller[0].alt === "Üçgen ABC");
  check("görselli soru metni blok görsel içeriyor", Boolean(iyi.hazir?.stem.blocks.some((x) => x.type === "image" && x.mediaId === "sekil-01.png")));

  const sorunlu = denetle(metin("![Üçgen ABC](sekil-01.png)"), baglam({ gorselVar: var_, gorselSorunu: () => "dosya bozuk" })).sorular[0];
  check("görsel sorunu (panel: bozuk dosya) reddeder", ilk(sorunlu) === "Görsel kullanılamıyor (sekil-01.png): dosya bozuk", ilk(sorunlu));

  const sikta = denetle(
    soru({}, ["[ ] A) ![a](sekil-01.png) (DIGER)", "[x] B) 180", "[ ] C) 200 (DIGER)", "[ ] D) 240 (DIGER)", "[ ] E) 20 (DIGER)"]),
    b
  ).sorular[0];
  check("şıkta görsel reddedilir (kimliğe çevrilmiyordu)", hataVar(sikta, "A şıkkında görsel var (sekil-01.png)"), sikta.hatalar.join(" | "));

  const anilan = anilanGorseller(
    dosyayiCozumle(metin("![a](sekil-01.png) ve ![b](iki.png)") + soru({ ID: "T-09", "Çözüm Açıklaması": "![c](uc.png) ![a](sekil-01.png)" }))
  );
  check("anılan görseller tekil, sırayla (çözüm dahil)", anilan.join(",") === "sekil-01.png,iki.png,uc.png", anilan.join(","));

  const alan = denetle(soru({ "Görsel": "sekil-01.png" }), b).sorular[0];
  check("Görsel alanı metinde anılmıyorsa uyarı", uyariVar(alan, "Soru Metni'nde ![…](sekil-01.png) yok"), alan.uyarilar.join(" | "));

  // Yerleştirme yalnızca görsel düğümlerine dokunur.
  const icerik = markupToContent("Dosya adı sekil-01.png metinde de geçiyor.\n\n![sekil-01.png çizimi](sekil-01.png)\n\nSatır içi ![ikon](sekil-01.png) burada.");
  const yeni = gorselleriYerlestir(icerik, new Map([["sekil-01.png", "cm-medya-1"]]));
  const json = JSON.stringify(yeni);
  check("görsel kimliği yerleşti (blok + satır içi)", (json.match(/"mediaId":"cm-medya-1"/g) ?? []).length === 2, json);
  check("metindeki dosya adı ve alt metin değişmedi", json.includes("Dosya adı sekil-01.png metinde") && json.includes("sekil-01.png çizimi"));
  check("parmak izi yerleştirmeden etkilenmez", deriveQuestionFields(icerik).fingerprint === deriveQuestionFields(yeni).fingerprint);
}

// ── formüller ────────────────────────────────────────────
console.log("\nFormül denetimi (isteğe bağlı):");
{
  const b = baglam({ formulHatasi: (latex) => (latex.includes("\\frac{") && !latex.includes("}{") ? "eksik parantez" : null) });
  const r = denetle(soru({ "Soru Metni": "Hesapla: $\\frac{1$ kaçtır?" }), b).sorular[0];
  check("çizilemeyen formül uyarı olur, ret değil", r.hatalar.length === 0 && uyariVar(r, "formül çizilemiyor: $\\frac{1$"), r.uyarilar.join(" | "));
  const r2 = denetle(soru({ "Soru Metni": "Hesapla: $\\frac{1$ kaçtır?" })).sorular[0];
  check("denetleyici verilmezse formüle bakılmaz", !uyariVar(r2, "formül"));
}

// ── dosya biçimi ─────────────────────────────────────────
console.log("\nDosya biçimi:");
{
  const crlf = ORNEK.replace(/\n/g, "\r\n");
  const lf = dosyayiCozumle(ORNEK);
  check("CRLF satır sonu LF ile aynı çözülür", JSON.stringify(dosyayiCozumle(crlf)) === JSON.stringify(lf));
  check("baştaki BOM ilk soruyu yutmaz", dosyayiCozumle("﻿" + soru({})).length === 1);
  const blok = "```markdown\n" + soru({ ID: "SABLON" }) + "```\n\n" + soru({ ID: "GERCEK" });
  const kb = dosyayiCozumle(blok);
  check("kod bloğundaki örnek atlanır", kb.length === 1 && kb[0].alanlar["id"] === "GERCEK");
  check("başlıksız dosya: soru yok", dosyayiCozumle("# Başlık\n\nMetin").length === 0);
  const turkce = dosyayiCozumle("### S\n* **İDEAL SÜRE:** 45\n* **Doğru Şık:** B\n");
  check("alan adı Türkçe büyük harfle de eşleşir", turkce[0].alanlar["ideal sure"] === "45" && turkce[0].alanlar["dogru sik"] === "B");
}

// ── saflık ───────────────────────────────────────────────
console.log("\nSaflık (panel bu dosyayı kopyalıyor):");
{
  const kaynak = readFileSync(join(KOK, "lib/question-import.ts"), "utf8");
  const importlar = [...kaynak.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
  check("yalnızca göreli import", importlar.length > 0 && importlar.every((i) => i.startsWith("./")), importlar.join(", "));
  check(
    "veritabanı, dosya sistemi ve Next yok",
    !/(node:|\bfs\b["']|@prisma|next\/|lib\/db|process\.env)/.test(kaynak.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""))
  );
  const icerik: QuestionContent = { version: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] };
  check("yerleştirme girdiyi değiştirmez", JSON.stringify(gorselleriYerlestir(icerik, new Map([["x", "y"]]))) === JSON.stringify(icerik));
}

console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
process.exitCode = failed === 0 ? 0 : 1;
