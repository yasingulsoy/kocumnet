import "./_koruma.mjs";
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
import sharp from "sharp";
import {
  GERI_ALMADA_SILINEBILIR,
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
import { IPUCU_SINIRI, KAYNAK_SINIRI, KAZANIM_ADI_SINIRI } from "../lib/content-limits";
import { GORSEL_EN_FAZLA_GENISLIK, webpYap } from "../lib/media-image";
import { deriveQuestionFields, extractText, type QuestionContent } from "../lib/question-content";
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
  check("başlık satırları 7, 45, 66", sorular.map((s) => s.satir).join(",") === "7,45,66", sorular.map((s) => s.satir).join(","));
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
    "C şıkkında hata kodu yok (satır 79).",
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
  check("1. soru çözümü 3 adım (--- ayırıcı)", h1.adimSayisi === 3 && h1.solution?.blocks.filter((b) => b.type === "step_break").length === 2, String(h1.adimSayisi));
  check("1. soru 2 ipucu, sırasıyla", h1.hints?.length === 2 && extractText(h1.hints[0]).includes("büyük olması"), JSON.stringify(h1.hints?.map(extractText)));
  check("1. soru videosu canonicalUrl (t= korunur)", h1.videoUrl === "https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=75", String(h1.videoUrl));
  check("1. soru hedef sınavsız (konunun her sınavı)", h1.examScopes.length === 0);
  check("1. soru uyarısız", q1.uyarilar.length === 0, q1.uyarilar.join(" | "));

  const h2 = q2.hazir!;
  check("2. soru hedef sınav DGS, ALES", h2.examScopes.join(",") === "DGS,ALES");
  check("2. soru kazanım adını dosyadaki 1. sorudan alıyor", h2.kazanimAdi === null && q2.hatalar.length === 0);
  check("2. soru 4 şıklı: LGS dışı sınav uyarısı", uyariVar(q2, "4 şıklı"), q2.uyarilar.join(" | "));
  check("2. soru ipucusuz, videosuz, tek adım", h2.hints === null && h2.videoUrl === null && h2.adimSayisi === 1);
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

// ── ipucu, video ve adım ayırıcı (Ekim 2026) ─────────────
console.log("\nİpucu, video ve adım ayırıcı:");
{
  /** Seçeneklerden hemen önce ek alan satırları (ipucu, video) ekler. Fonksiyonla: dizgede "$$" tek "$" olurdu. */
  const ekle = (metin: string, satirlar: string[]) =>
    metin.replace("* **Seçenekler:**", () => [...satirlar, "* **Seçenekler:**"].join("\n"));

  const uc = denetle(ekle(soru({}), ["* **İpucu:** bir", "* **İpucu 2:** iki", "* **İpucu:** üç"])).sorular[0];
  check("3 ipucu geçer (numaralı yazım da)", uc.hatalar.length === 0 && uc.hazir?.hints?.length === 3, uc.hatalar.join(" | "));
  check("İpucu alanı tanınmayan alan / tekrar uyarısı vermez", !uyariVar(uc, "Tanınmayan") && !uyariVar(uc, "kez yazılmış"), uc.uyarilar.join(" | "));

  const dort = denetle(ekle(soru({}), ["* **İpucu:** 1", "* **İpucu:** 2", "* **İpucu:** 3", "* **İpucu:** 4"])).sorular[0];
  check("4. ipucu reddedilir (satırıyla)", hataVar(dort, "En fazla 3 ipucu yazılabilir (şu an 4; fazlası satır"), dort.hatalar.join(" | "));

  const cokSatir = denetle(ekle(soru({}), ["* **İpucu:**", "Yolu düşün:", "", "$$x = v \\cdot t$$"])).sorular[0];
  const ip = cokSatir.hazir?.hints?.[0];
  check("çok satırlı ipucu tek ipucu (blok formül dahil)", cokSatir.hazir?.hints?.length === 1 && ip?.blocks.some((b) => b.type === "math_block") === true, cokSatir.hatalar.join(" | "));

  const bos = denetle(ekle(soru({}), ["* **İpucu:**", "* **İpucu:** dolu"])).sorular[0];
  check("boş ipucu uyarıyla atlanır", bos.hatalar.length === 0 && bos.hazir?.hints?.length === 1 && uyariVar(bos, "Boş İpucu alanı"), bos.uyarilar.join(" | "));

  const ayiricili = denetle(ekle(soru({}), ["* **İpucu:** önce bunu dene", "---", "sonra şunu"])).sorular[0];
  check("ipucunda --- reddedilir", hataVar(ayiricili, "1. ipucu (satır") && hataVar(ayiricili, "adım ayırıcı (---) olamaz"), ayiricili.hatalar.join(" | "));

  const gorselli = denetle(ekle(soru({}), ["* **İpucu:** ![şekil](sekil-01.png)"]), baglam({ gorselVar: () => true })).sorular[0];
  check("ipucunda görsel reddedilir", hataVar(gorselli, "görsel yalnızca Soru Metni'nde"), gorselli.hatalar.join(" | "));
  check("ipucundaki görsel anılanlarda (kullanılmayan uyarısı çıkmaz)", anilanGorseller(dosyayiCozumle(ekle(soru({}), ["* **İpucu:** ![a](ip.png)"]))).includes("ip.png"));

  const yt = denetle(ekle(soru({}), ["* **Video:** https://www.youtube.com/shorts/aqz-KE-bpKQ"])).sorular[0];
  check("YouTube shorts → watch adresi", yt.hazir?.videoUrl === "https://www.youtube.com/watch?v=aqz-KE-bpKQ", String(yt.hazir?.videoUrl));
  const vimeo = denetle(ekle(soru({}), ["* **Video:**", "https://player.vimeo.com/video/123456"])).sorular[0];
  check("Vimeo (sonraki satırda) → vimeo.com/id", vimeo.hazir?.videoUrl === "https://vimeo.com/123456", String(vimeo.hazir?.videoUrl));
  const kotu = denetle(ekle(soru({}), ["* **Video:** https://example.com/video.mp4"])).sorular[0];
  check("başka site reddedilir, anlaşılır mesaj", ilk(kotu).startsWith('Video bağlantısı tanınmadı: "https://example.com/video.mp4"') && ilk(kotu).includes("YouTube"), ilk(kotu));
  const kisaId = denetle(ekle(soru({}), ["* **Video:** https://youtu.be/kisa"])).sorular[0];
  check("bozuk YouTube kimliği reddedilir", hataVar(kisaId, "Video bağlantısı tanınmadı"), kisaId.hatalar.join(" | "));

  const adimli = denetle(soru({ "Çözüm Açıklaması": "Önce hızı bul.\n\n---\n\nSonra süreyle çarp: $180$." })).sorular[0];
  check("çözümde --- iki adım", adimli.hazir?.adimSayisi === 2, adimli.hatalar.join(" | "));
  const sonunda = denetle(soru({ "Çözüm Açıklaması": "Tek adım.\n\n---\n\n" })).sorular[0];
  check("sondaki --- (dosya sonu) ayırıcı değil", sonunda.hazir?.adimSayisi === 1 && !sonunda.hazir.solution?.blocks.some((b) => b.type === "step_break"));
  const ikiSoru = denetle(soru({ "Çözüm Açıklaması": "Birinci." }) + "\n---\n\n" + soru({ ID: "T-02", "Soru Metni": "İkinci soru $x$?" })).sorular;
  check("soru arasındaki --- soruyu kapatır", ikiSoru.length === 2 && ikiSoru[0].hazir?.adimSayisi === 1 && ikiSoru[1].hatalar.length === 0, ikiSoru.map((r) => r.hatalar.join(",")).join(" | "));
  const alanOnce = denetle(soru({ "Çözüm Açıklaması": "Birinci.\n\n---\n* **Kaynak:** özgün" })).sorular[0];
  check("--- ardından alan gelirse alanı kapatır, alan okunur", alanOnce.hazir?.adimSayisi === 1 && alanOnce.hazir.sourceRef === "T-01 · özgün", String(alanOnce.hazir?.sourceRef));

  const govde = denetle(soru({ "Soru Metni": "Birinci kısım $x$.\n\n---\n\nİkinci kısım kaçtır?" })).sorular[0];
  check("soru metninde --- reddedilir (eskiden sonrası düşüyordu)", hataVar(govde, "Soru Metni'nde adım ayırıcı (---) var"), govde.hatalar.join(" | "));
  const sik = denetle(soru({}, ["[ ] A) 120 (ISLEM_HATASI: x)", "[x] B) 180", "[ ] C) --- (TERS_ISLEM: y)", "[ ] D) 240 (EKSIK_OKUMA: z)", "[ ] E) 20 (DIGER)"])).sorular[0];
  check("şıkta --- reddedilir (validateChoices)", hataVar(sik, "C şıkkında adım ayırıcı (---) olamaz"), sik.hatalar.join(" | "));

  const formul = denetle(ekle(soru({}), ["* **İpucu:** $\\frac{1$ dene"]), baglam({ formulHatasi: (l) => (l.includes("\\frac{1") ? "eksik" : null) })).sorular[0];
  check("ipucundaki formül de denetlenir", uyariVar(formul, "1. ipucundaki formül çizilemiyor"), formul.uyarilar.join(" | "));
}

// ── uzunluk sınırları (soru formuyla ortak: lib/content-limits.ts) ──
console.log("\nUzunluk sınırları (form ile aynı):");
{
  const ekle = (metin: string, satirlar: string[]) =>
    metin.replace("* **Seçenekler:**", () => [...satirlar, "* **Seçenekler:**"].join("\n"));

  // Form 600'ü aşan ipucunu kaydetmiyor: içe aktarma da satırıyla reddetmeli.
  const uzunIpucu = "a".repeat(IPUCU_SINIRI + 1);
  const dosya = ekle(soru({}), ["* **İpucu:** kısa", "* **İpucu:** " + uzunIpucu]);
  const satir = dosya.split("\n").findIndex((s) => s.includes(uzunIpucu)) + 1;
  const ipucu = denetle(dosya).sorular[0];
  check(
    `${IPUCU_SINIRI + 1} karakterlik ipucu satırıyla reddedilir`,
    !ipucu.hazir && hataVar(ipucu, `2. ipucu (satır ${satir}) çok uzun: en fazla ${IPUCU_SINIRI} karakter (şu an ${IPUCU_SINIRI + 1})`),
    ipucu.hatalar.join(" | ")
  );
  const sinirda = denetle(ekle(soru({}), ["* **İpucu:** " + "a".repeat(IPUCU_SINIRI)])).sorular[0];
  check("tam sınırdaki ipucu geçer", sinirda.hatalar.length === 0 && sinirda.hazir?.hints?.length === 1, sinirda.hatalar.join(" | "));

  // Saklanan değer "ID · kaynak": formdaki Kaynak kutusu bunu 200 ile sınırlıyor.
  const sigan = KAYNAK_SINIRI - "T-01 · ".length;
  const tam = denetle(soru({ Kaynak: "k".repeat(sigan) })).sorular[0];
  check(`"ID · kaynak" tam ${KAYNAK_SINIRI} karakter geçer`, tam.hatalar.length === 0 && tam.hazir?.sourceRef.length === KAYNAK_SINIRI, tam.hatalar.join(" | "));
  const kaynakDosya = soru({ Kaynak: "k".repeat(sigan + 1) });
  const kaynakSatir = kaynakDosya.split("\n").findIndex((s) => s.startsWith("* **Kaynak:**")) + 1;
  const uzunKaynak = denetle(kaynakDosya).sorular[0];
  check(
    "ID ile birlikte sınırı aşan kaynak satırıyla reddedilir",
    !uzunKaynak.hazir && hataVar(uzunKaynak, `Kaynak (satır ${kaynakSatir}) çok uzun: "ID · kaynak" en fazla ${KAYNAK_SINIRI} karakter olarak saklanır (şu an ${KAYNAK_SINIRI + 1})`),
    uzunKaynak.hatalar.join(" | ")
  );

  const uzunAd = denetle(soru({ Seviye: "1", "Kazanım Kodu": "K-UZUN", "Kazanım Adı": "x".repeat(KAZANIM_ADI_SINIRI.max + 1) })).sorular[0];
  check("yeni kazanımın adı formdaki sınırı aşamaz", hataVar(uzunAd, "Kazanım Adı (satır") && hataVar(uzunAd, `en fazla ${KAZANIM_ADI_SINIRI.max} karakter`), uzunAd.hatalar.join(" | "));
  const kayitliAd = denetle(
    soru({ Seviye: "1", "Kazanım Kodu": "K-UZUN", "Kazanım Adı": "x".repeat(KAZANIM_ADI_SINIRI.max + 1) }),
    baglam({ kazanimlar: new Map([["K-UZUN", { id: "o1", topicId: "t-temel", name: "Kayıtlı" }]]) })
  ).sorular[0];
  check("kayıtlı kazanımda (ad yok sayılıyor) uzun ad reddetmez", kayitliAd.hatalar.length === 0, kayitliAd.hatalar.join(" | "));

  const kisa = denetle(soru({ "Soru Metni": "x=?" })).sorular[0];
  check("formun reddettiği kısa soru metni reddedilir", hataVar(kisa, "Soru Metni çok kısa"), kisa.hatalar.join(" | "));
}

// ── geri alma kuralı ─────────────────────────────────────
console.log("\nGeri alma kuralı (komut satırı ve panel ortak):");
{
  const k = GERI_ALMADA_SILINEBILIR as Record<string, unknown>;
  check(
    "sorulmuş, denemedeki ve NOTLU soru silinmez",
    JSON.stringify(k) === JSON.stringify({ items: { none: {} }, packageLinks: { none: {} }, notes: { none: {} } }),
    JSON.stringify(k)
  );
  check("sonradan düzenlenmek (updatedAt) ölçüt değil", !("updatedAt" in k));
}

// ── görsel biçimi (komut satırı ve panel ortak: lib/media-image.ts) ──
console.log("\nGörsel biçimi (lib/media-image.ts):");
{
  // Telefondan çekilmiş gibi: geniş, EXIF'li (konum ve yön), JPEG.
  const ham = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Make: "Deneme" }, IFD3: { GPSLatitudeRef: "N" } })
    .toBuffer();
  const once = await sharp(ham).metadata();
  check("deneme girdisinde EXIF ve yön (6) var", Boolean(once.exif && once.exif.length > 0) && once.orientation === 6, String(once.orientation));
  const w = await webpYap(ham);
  const sonra = w ? await sharp(Buffer.from(w.data)).metadata() : null;
  check("WebP'ye çevrildi", sonra?.format === "webp", String(sonra?.format));
  check("EXIF (konum dahil) atıldı", Boolean(sonra) && !sonra!.exif && !sonra!.xmp && !sonra!.icc, JSON.stringify({ exif: Boolean(sonra?.exif), xmp: Boolean(sonra?.xmp) }));
  // Orientation 6 = 90° döndür: 2400×1600 yatay → dikey, sonra genişlik 1200'e iner.
  check(
    `yön uygulandı ve genişlik ${GORSEL_EN_FAZLA_GENISLIK}'e indi`,
    w?.width === GORSEL_EN_FAZLA_GENISLIK && w.height === 1800,
    `${w?.width}×${w?.height}`
  );
  check("bayt sayısı veriyle aynı", w?.byteSize === w?.data.byteLength);
  check("küçük görsel büyütülmez", (await webpYap(await sharp({ create: { width: 300, height: 200, channels: 3, background: "#fff" } }).png().toBuffer()))?.width === 300);
  check("bozuk dosya null döner (soru reddedilir)", (await webpYap(Buffer.from("bu bir görsel değil"))) === null);
}

// ── şablondaki tam örnek ─────────────────────────────────
console.log("\nSORU-SABLONU.md §8 tam örneği:");
{
  // Şablonun anlattığı örnek gerçekten geçmeli: belge ile ayrıştırıcı ayrışmasın.
  const sablon = readFileSync(join(KOK, "SORU-SABLONU.md"), "utf8");
  const blok = /## 8\. Tam örnek[\s\S]*?```markdown\n([\s\S]*?)```/.exec(sablon)?.[1] ?? "";
  const r = denetle(blok).sorular;
  check("örnek bulundu, tek soru", r.length === 1, String(r.length));
  const h = r[0]?.hazir;
  check("örnek geçerli ve uyarısız", r[0]?.hatalar.length === 0 && r[0]?.uyarilar.length === 0, [...(r[0]?.hatalar ?? []), ...(r[0]?.uyarilar ?? [])].join(" | "));
  check("örnekte 2 ipucu, video, 3 adım", h?.hints?.length === 2 && Boolean(h.videoUrl) && h.adimSayisi === 3, `${h?.hints?.length} · ${h?.videoUrl} · ${h?.adimSayisi}`);
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
