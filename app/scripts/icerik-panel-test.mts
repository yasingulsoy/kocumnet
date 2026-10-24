import "./_koruma.mjs";
/**
 * Panelin içerik akışı (pilot, 24 Ekim 2026): "yayına hazır mı" kuralı
 * (lib/question-readiness.ts), ondalık virgülün çizimi (lib/question-markup.ts
 * latexCizimi), içe aktarmanın esnek biçimleri (lib/question-import.ts) ve
 * panelin saf akış kuralları (admin/src/lib/checkup/soru-akisi.ts: durum
 * taşımama, kaynak öneki, adresten ön dolu form, inceleme kuyruğu adresi,
 * formül düğmeleri, imlece şekil ekleme). Veritabanı istemez.
 *   npx tsx scripts/icerik-panel-test.mts
 *
 * Panel modülü dinamik import ile (deneme-panel-test.mts ile aynı kalıp):
 * app ayrı derleniyor, admin'e statik import derlemeyi kırardı. Dosya yoksa
 * o bölüm atlanır; CI'da (CI tanımlıysa) bu bir HATADIR.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import katex from "katex";
import { contentToMarkup, latexCizimi, markupToContent } from "../lib/question-markup";
import { formulHatasi, sikSayisiSorunu, yayinaHazirMi, eksikOzeti, type HazirlikSorusu } from "../lib/question-readiness";
import { dosyayiCozumle, dosyayiDenetle, hataTipiCoz, type IceAktarmaBaglami, type SoruRaporu } from "../lib/question-import";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const m = (markup: string) => markupToContent(markup);

// ── yayına hazır mı ──────────────────────────────────────
console.log("\nYayına hazır mı (lib/question-readiness.ts):");

const TYT = { examScope: "TYT", examScopes: ["TYT", "KPSS_LISANS", "DGS", "ALES"] };
const LGS = { examScope: "LGS", examScopes: ["LGS"] };
const KARMA = { examScope: "TYT", examScopes: ["TYT", "LGS"] };

/** Hazır bir seviye 2 sorusu; `ek` alanları ezer. */
function soru(ek: Partial<HazirlikSorusu> = {}): HazirlikSorusu {
  return {
    stem: m("Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km?"),
    solution: m("Yol = hız · zaman = $180$ km."),
    hints: null,
    choices: [
      { content: m("$120$"), isCorrect: false, errorType: "ISLEM_HATASI" },
      { content: m("$180$"), isCorrect: true, errorType: null },
      { content: m("$200$"), isCorrect: false, errorType: "TERS_ISLEM" },
      { content: m("$240$"), isCorrect: false, errorType: "EKSIK_OKUMA" },
      { content: m("$20$"), isCorrect: false, errorType: "DIGER" },
    ],
    level: "L2_ORTA",
    kazanim: null,
    examScopes: [],
    konu: TYT,
    ...ek,
  };
}
const kodlar = (s: HazirlikSorusu) => yayinaHazirMi(s).eksikler.map((e) => e.kod).join(",");
const sikDegistir = (i: number, d: Partial<HazirlikSorusu["choices"][number]>) =>
  soru().choices.map((c, j) => (j === i ? { ...c, ...d } : c));

{
  const tam = yayinaHazirMi(soru());
  check("eksiksiz soru hazır", tam.hazir && tam.eksikler.length === 0, kodlar(soru()));
  check(
    "liste bütün maddeleri gösterir (metin hariç)",
    tam.maddeler.map((x) => x.kod).join(",") === "cozum,hata_tipi,seviye,kazanim,formul,siklar,sik_sayisi",
    tam.maddeler.map((x) => x.kod).join(",")
  );
  check("seviye 2'de kazanım maddesi ilgisiz", tam.maddeler.find((x) => x.kod === "kazanim")?.ilgisiz === true);

  check("çözüm yok", kodlar(soru({ solution: null })) === "cozum");
  check("yalnızca ayırıcıdan oluşan çözüm yok sayılır", kodlar(soru({ solution: m("---") })) === "cozum");

  const tipsiz = yayinaHazirMi(soru({ choices: sikDegistir(2, { errorType: null }) }));
  check("hata tipi eksik: harfiyle", tipsiz.eksikler[0]?.kod === "hata_tipi" && tipsiz.eksikler[0].mesaj === "C şıkkında hata tipi seçilmemiş.", tipsiz.eksikler[0]?.mesaj);
  const ikiTipsiz = yayinaHazirMi(soru({ choices: sikDegistir(0, { errorType: "" }).map((c, i) => (i === 3 ? { ...c, errorType: null } : c)) }));
  check("iki eksik hata tipi: 'A ve D şıklarında'", ikiTipsiz.eksikler[0]?.mesaj === "A ve D şıklarında hata tipi seçilmemiş.", ikiTipsiz.eksikler[0]?.mesaj);
  check("listede olmayan hata tipi eksik sayılır", kodlar(soru({ choices: sikDegistir(0, { errorType: "UYDURMA" }) })) === "hata_tipi");
  check("doğru şıkta hata tipi aranmaz", kodlar(soru({ choices: sikDegistir(1, { errorType: null }) })) === "");

  check("seviye yok", kodlar(soru({ level: null })) === "seviye");
  check("seviye 1, kazanım yok", kodlar(soru({ level: "L1_TEMEL" })) === "kazanim");
  check("seviye 1, kazanım arşivde", kodlar(soru({ level: "L1_TEMEL", kazanim: { arsivde: true } })) === "kazanim");
  check("seviye 1, kazanım var", kodlar(soru({ level: "L1_TEMEL", kazanim: { arsivde: false } })) === "");

  check("çizilemeyen formül (soru metni)", kodlar(soru({ stem: m("Şuna bak: $\\frac{1$ kaçtır?") })) === "formul");
  const ipucu = yayinaHazirMi(soru({ hints: [m("Dene: $\\sqrt{$")] }));
  check("ipucundaki formül de denetlenir", ipucu.eksikler[0]?.kod === "formul" && ipucu.eksikler[0].mesaj.includes("1. ipucunda"), ipucu.eksikler[0]?.mesaj);
  check("şıktaki formül de denetlenir", kodlar(soru({ choices: sikDegistir(4, { content: m("$x^$") }) })) === "formul");

  check("aynı değerli şık (validateChoices)", kodlar(soru({ choices: sikDegistir(2, { content: m("$180$") }) })) === "siklar");
  check("iki doğru şık", kodlar(soru({ choices: sikDegistir(0, { isCorrect: true, errorType: null }) })) === "siklar");
  check("boş şık", kodlar(soru({ choices: sikDegistir(3, { content: m("") }) })) === "siklar");

  const dort = soru().choices.slice(0, 4);
  check("LGS konusunda 5 şık", kodlar(soru({ konu: LGS })) === "sik_sayisi");
  check("LGS konusunda 4 şık hazır", kodlar(soru({ konu: LGS, choices: dort })) === "");
  check("TYT konusunda 4 şık", kodlar(soru({ choices: dort })) === "sik_sayisi");
  check("LGS+TYT konusunda iki sayı da geçer", kodlar(soru({ konu: KARMA })) === "" && kodlar(soru({ konu: KARMA, choices: dort })) === "");
  check("hedef sınav konuyu ezer (karma konu, yalnızca LGS, 5 şık)", kodlar(soru({ konu: KARMA, examScopes: ["LGS"] })) === "sik_sayisi");
  check("konu bilinmiyorsa şık sayısı ilgisiz", yayinaHazirMi(soru({ konu: null })).maddeler.find((x) => x.kod === "sik_sayisi")?.ilgisiz === true);
  check("içe aktarmayla aynı cümle", sikSayisiSorunu(["LGS"], 5) === "LGS sorusu 5 şıklı; LGS'de şıklar A–D." && sikSayisiSorunu(["TYT"], 5) === null);

  check("bozuk soru metni (Json) eksik sayılır", kodlar(soru({ stem: { version: 1, blocks: [] } })) === "metin");
  check("veritabanı Json'u olduğu gibi okunur", yayinaHazirMi(soru({ stem: JSON.parse(JSON.stringify(m("Düz metin $x$?"))) })).hazir);
  const birden = yayinaHazirMi(soru({ solution: null, level: null }));
  check("eksik özeti sade", eksikOzeti(birden.eksikler) === "Yayına alınamaz: çözüm yok, seviye yok.", eksikOzeti(birden.eksikler));
}

// ── ondalık virgül ───────────────────────────────────────
console.log("\nOndalık virgül (çizimde, kaynakta değil):");
{
  check("3,5 → 3{,}5", latexCizimi("3,5") === "3{,}5");
  check("boşluklu 3, 5 dokunulmaz", latexCizimi("3, 5") === "3, 5" && latexCizimi("A(3, 5)") === "A(3, 5)");
  check("binlik ayraç da bitişir", latexCizimi("1,234,567") === "1{,}234{,}567");
  check("zaten {,} yazılmışsa ikinci kez sarılmaz", latexCizimi("3{,}5") === "3{,}5");
  check("kesir içinde de", latexCizimi("\\frac{1,5}{2}") === "\\frac{1{,}5}{2}");

  const html = (latex: string) => katex.renderToString(latexCizimi(latex), { output: "html", throwOnError: false, strict: "ignore" });
  const gorunen = (h: string) => h.replace(/<[^>]+>/g, "");
  check("KaTeX'te 3,5 bitişik (boşluk yok)", !html("3,5").includes("mspace") && gorunen(html("3,5")) === "3,5", gorunen(html("3,5")));
  check("KaTeX'te 3, 5 boşluklu kalır", html("3, 5").includes("mspace"));
  check("dönüşümsüz çizim boşluk koyuyordu (testin anlamı)", katex.renderToString("3,5", { output: "html" }).includes("mspace"));
  check("dönüştürülmüş formül çiziliyor", formulHatasi("2,5 \\cdot 4 = 10", false) === null);

  const icerik = markupToContent("Fiyat $3,5$ TL, nokta $A(3, 5)$.");
  const latexler = JSON.stringify(icerik).match(/"latex":"[^"]*"/g)?.join(" ");
  check("saklanan kaynak değişmez", latexler === '"latex":"3,5" "latex":"A(3, 5)"', latexler);
  const geri = contentToMarkup(icerik);
  check("gidiş-dönüş sabit", geri === "Fiyat $3,5$ TL, nokta $A(3, 5)$." && contentToMarkup(markupToContent(geri)) === geri, geri);
}

// ── içe aktarmanın esnek biçimleri ───────────────────────
console.log("\nİçe aktarma biçimleri (lib/question-import.ts):");

const KONULAR = new Map([
  ["temel-kavramlar", { id: "t-temel", ...TYT }],
  ["bolunebilme", { id: "t-bolme", examScope: "TYT", examScopes: ["TYT", "DGS", "ALES"] }],
  ["yuzde-kar-zarar", { id: "t-yuzde", examScope: "TYT", examScopes: ["TYT", "KPSS_LISANS", "DGS"] }],
  ["lgs-ucgenler", { id: "t-lgs", ...LGS }],
]);
const baglam = (ek: Partial<IceAktarmaBaglami> = {}): IceAktarmaBaglami => ({
  konular: KONULAR,
  mevcutIdler: new Set(),
  mevcutParmakIzleri: new Map(),
  kazanimlar: new Map(),
  gorselVar: () => false,
  ...ek,
});
const denetle = (metin: string, b = baglam()) => dosyayiDenetle(dosyayiCozumle(metin), b).sorular;
const uyariVar = (r: SoruRaporu, parca: string) => r.uyarilar.some((u) => u.includes(parca));
const hataVar = (r: SoruRaporu, parca: string) => r.hatalar.some((u) => u.includes(parca));

/** Tek soru; alan satırları ve şıklar verilen biçimde. */
const dosya = (alanlar: string[], siklar: string[], cozum = "* **Çözüm Açıklaması:**\nYol $180$ km.") =>
  ["### Soru 01", ...alanlar, "* **Soru Metni:**", "Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km?", "* **Seçenekler:**", ...siklar, cozum].join("\n") + "\n";
const ALANLAR = ["* **ID:** T-01", "* **Konu Kodu:** temel-kavramlar", "* **Zorluk:** 2", "* **Seviye:** 2", "* **İdeal Süre:** 60"];
const SIKLAR = [
  "  * [ ] A) 120 (ISLEM_HATASI: 60·2)",
  "  * [x] B) 180",
  "  * [ ] C) 200 (TERS_ISLEM: toplama)",
  "  * [ ] D) 240 (EKSIK_OKUMA: 4 saat)",
  "  * [ ] E) 20 (DIGER)",
];
{
  const temel = denetle(dosya(ALANLAR, SIKLAR))[0];
  check("standart biçim geçer ve yayına hazır", temel.hatalar.length === 0 && temel.hazir?.yayinEksikleri.length === 0, temel.hatalar.join(" | "));

  const tire = denetle(dosya(ALANLAR.map((a) => a.replace(/^\* /, "- ")), SIKLAR.map((s) => s.replace("  * ", "- "))))[0];
  check("`- ` ile başlayan alan ve şık satırları", tire.hatalar.length === 0 && tire.hazir?.difficulty === 2 && tire.hazir.drafts.length === 5, tire.hatalar.join(" | "));
  check("`- [x] B) 18` doğru şık", tire.hazir?.drafts.findIndex((d) => d.isCorrect) === 1);

  const disari = denetle(dosya(ALANLAR.map((a) => a.replace(/:\*\*/, "**:")), SIKLAR))[0];
  check("iki nokta kalının dışında: `**Zorluk**: 2`", disari.hatalar.length === 0 && disari.hazir?.targetTimeSeconds === 60, disari.hatalar.join(" | "));

  const isaretsiz = denetle(dosya(ALANLAR.map((a) => a.replace(/^\* /, "")), SIKLAR))[0];
  check("işaretsiz `**Zorluk:** 2` (tanınan alan)", isaretsiz.hatalar.length === 0 && isaretsiz.hazir?.level === "L2_ORTA", isaretsiz.hatalar.join(" | "));

  const turkce = denetle(
    dosya(ALANLAR, [
      "  * [ ] A) 120 (İşlem hatası: 60·2)",
      "  * [x] B) 180",
      "  * [ ] C) 200 (ters işlem)",
      "  * [ ] D) 240 (EKSİK OKUMA: 4 saat)",
      "  * [ ] E) 20 (Diğer)",
    ])
  )[0];
  check(
    "Türkçe hata tipi adları kodlara çevrilir",
    JSON.stringify(turkce.hazir?.errorTypes) === JSON.stringify(["ISLEM_HATASI", null, "TERS_ISLEM", "EKSIK_OKUMA", "DIGER"]),
    JSON.stringify(turkce.hazir?.errorTypes)
  );
  check("açıklama şık metnine karışmaz", turkce.hazir?.drafts[0].content.blocks.length === 1 && JSON.stringify(turkce.hazir?.drafts[0].content).includes('"120"'));

  check("hataTipiCoz: ad, kod, harf farkı", hataTipiCoz("Formül karıştırma") === "FORMUL_KARISTIRMA" && hataTipiCoz("isaret_hatasi") === "ISARET_HATASI" && hataTipiCoz(" YAKLAŞIK DEĞER ") === "YAKLASIK_DEGER");
  check("hataTipiCoz: kod biçimi ama listede yok → olduğu gibi", hataTipiCoz("UYDURMA_KOD") === "UYDURMA_KOD");
  check("hataTipiCoz: metin parantezi değil", hataTipiCoz("cm") === null && hataTipiCoz("kısa kenar") === null);

  const birim = denetle(dosya(ALANLAR, [...SIKLAR.slice(0, 4), "  * [ ] E) 20 (cm)"]))[0];
  check("`(cm)` şık metninde kalır, kod eksik uyarısı", birim.hatalar.length === 0 && JSON.stringify(birim.hazir?.drafts[4].content).includes("(cm)") && uyariVar(birim, "E şıkkında hata kodu yok"), birim.uyarilar.join(" | "));
  check("kodu eksik soru yayına hazır değil (taslak girer)", birim.hazir?.yayinEksikleri.map((e) => e.kod).join() === "hata_tipi");

  const uydurma = denetle(dosya(ALANLAR, [...SIKLAR.slice(0, 4), "  * [ ] E) 20 (UYDURMA_KOD)"]))[0];
  check("listede olmayan kod yine reddedilir", hataVar(uydurma, "listede yok: UYDURMA_KOD"), uydurma.hatalar.join(" | "));

  const benzer = denetle(dosya([...ALANLAR, "Kaynak: 2023 TYT / 12"], SIKLAR))[0];
  check("alana benzeyen satır: satır numaralı uyarı", uyariVar(benzer, "Satır 7 alan gibi görünüyor") && uyariVar(benzer, '"* **Kaynak:** değer"'), benzer.uyarilar.join(" | "));
  check("yok sayılan satır kaynağa yazılmaz", benzer.hazir?.sourceRef === "T-01", benzer.hazir?.sourceRef);

  const kalinIcerik = denetle(
    dosya(ALANLAR, SIKLAR, "* **Çözüm Açıklaması:**\n- **Dikkat:** hız ile süre çarpılır.\n\nYol $180$ km.")
  )[0];
  check("`- **Bilinmeyen:**` alan sayılmaz, metinde kalır", kalinIcerik.hatalar.length === 0 && JSON.stringify(kalinIcerik.hazir?.solution).includes("Dikkat"), kalinIcerik.hatalar.join(" | "));
  check("…ve satır numarasıyla uyarılır", uyariVar(kalinIcerik, "alan gibi görünüyor") && uyariVar(kalinIcerik, "metnin parçası sayıldı"), kalinIcerik.uyarilar.join(" | "));

  const okunamayan = denetle(dosya(ALANLAR, [...SIKLAR.slice(0, 4), "  * E. 20 (DIGER)"]))[0];
  check("şık biçimine uymayan satır sessizce düşmez", uyariVar(okunamayan, "şık olarak okunamadı") && okunamayan.hazir?.drafts.length === 4, okunamayan.uyarilar.join(" | "));

  const onculler = denetle(
    ["### Soru 01", ...ALANLAR, "* **Soru Metni:**", "Hangileri doğrudur?", "", "- $x$ tek sayıdır", "- $y$ çift sayıdır", "* **Seçenekler:**", ...SIKLAR, "* **Çözüm Açıklaması:**", "Yok değil."].join("\n")
  )[0];
  check("öncül listesi (`- `) alan sanılmaz, uyarı yok", onculler.hatalar.length === 0 && onculler.hazir?.stem.blocks.some((b) => b.type === "list") === true && !uyariVar(onculler, "alan gibi"), onculler.uyarilar.join(" | "));

  // İndirilen örnek dosya (panel "Örnek dosya"): şekliyle birlikte üç soru da geçerli ve yayına hazır.
  const ornek = readFileSync(join(KOK, "scripts/fixtures/ornek-gorselli.md"), "utf8");
  const ornekSonuc = dosyayiDenetle(dosyayiCozumle(ornek), baglam({ gorselVar: (d) => d === "ornek-sekil.png", formulHatasi }));
  check("örnek dosya: 3 soru, hepsi geçerli", ornekSonuc.hazir.length === 3, ornekSonuc.sorular.map((s) => s.hatalar.join(" ")).join(" | "));
  check("örnek dosya: hepsi yayına hazır", ornekSonuc.hazir.every((h) => h.yayinEksikleri.length === 0), JSON.stringify(ornekSonuc.hazir.map((h) => h.yayinEksikleri)));
  check("örnek dosya: uyarı yok", ornekSonuc.sorular.every((s) => s.uyarilar.length === 0), ornekSonuc.sorular.flatMap((s) => s.uyarilar).join(" | "));
  check("örnek dosya: biri şekilli", ornekSonuc.hazir.filter((h) => h.gorseller.length === 1).length === 1);
  check("örnek şekil dosyası depoda", existsSync(join(KOK, "scripts/fixtures/gorseller/ornek-sekil.png")));
}

// ── panelin saf akış kuralları ───────────────────────────
console.log("\nPanel akışı (admin/src/lib/checkup/soru-akisi.ts):");

interface Akis {
  yenisininDurumu(d: string): "DRAFT" | "REVIEW";
  kaynakOneki(k: string): string;
  yeniSoruVarsayilanlari(
    sp: Record<string, string | undefined>,
    b: { konular: ReadonlySet<string>; kazanimKonusu: ReadonlyMap<string, string> }
  ): { topicId: string; level: string; objectiveId: string; difficulty: number; targetTimeSeconds: number; status: string; examScopes: string[]; sourceRef: string };
  kuyrukSorgusu(raw: string): string;
  kuyrukAdresi(sorgu: string, ek?: Record<string, string>): string;
  kendiSorusuMu(damga: string | null, id: number): boolean;
  matematikIcinde(metin: string, konum: number): boolean;
  FORMUL_PARCALARI: readonly { ad: string; once: string; sonra: string }[];
  formulEkle(metin: string, bas: number, son: number, p: { ad: string; once: string; sonra: string }): { metin: string; imlec: number };
  blokEkle(metin: string, konum: number | null, parca: string): { metin: string; imlec: number };
  yayinOzeti(alinan: number, a: { toplam: number; nedenler: { kod: string; etiket: string; sayi: number; suzgec: string | null }[]; sorular: [] } | null): string;
}

const YOL = resolve(KOK, "../admin/src/lib/checkup/soru-akisi.ts");
if (!existsSync(YOL)) {
  if (process.env.CI) {
    console.error("✗ admin/src/lib/checkup/soru-akisi.ts bulunamadı: CI'da panel akışı testi atlanamaz.");
    process.exit(1);
  }
  console.log("  admin/ yok (ayrı derleme ortamı): panel akışı atlandı.");
} else {
  const a = (await import(pathToFileURL(YOL).href)) as Akis;

  check(
    "durum taşınmaz: yayında → incelemede, taslak/arşiv → taslak",
    a.yenisininDurumu("PUBLISHED") === "REVIEW" && a.yenisininDurumu("REVIEW") === "REVIEW" && a.yenisininDurumu("DRAFT") === "DRAFT" && a.yenisininDurumu("ARCHIVED") === "DRAFT"
  );
  check("kaynak öneki: \"2023 TYT / 12\" → \"2023 TYT / \"", a.kaynakOneki("2023 TYT / 12") === "2023 TYT / ");
  check("kaynak öneki: numarasız kaynak aynen", a.kaynakOneki("özgün") === "özgün" && a.kaynakOneki("Limit s.45") === "Limit s." && a.kaynakOneki("") === "");

  const bilinen = { konular: new Set(["k1", "k2"]), kazanimKonusu: new Map([["o1", "k1"], ["o2", "k2"]]) };
  const v1 = a.yeniSoruVarsayilanlari({ konuId: "k1", kazanimId: "o1", seviye: "L1_TEMEL", hedef: "LGS,YKS,LGS" }, bilinen);
  check(
    "adresten ön dolu (kaydedildi olmadan): konu, kazanım, seviye, sınav",
    v1.topicId === "k1" && v1.objectiveId === "o1" && v1.level === "L1_TEMEL" && v1.examScopes.join() === "LGS" && v1.status === "DRAFT",
    JSON.stringify(v1)
  );
  check("başka konunun kazanımı düşer", a.yeniSoruVarsayilanlari({ konuId: "k1", kazanimId: "o2" }, bilinen).objectiveId === "");
  check("yalnızca kazanım verilirse konu ondan", a.yeniSoruVarsayilanlari({ kazanimId: "o2" }, bilinen).topicId === "k2");
  check("adresten yayında açılmaz", a.yeniSoruVarsayilanlari({ durum: "PUBLISHED" }, bilinen).status === "REVIEW");
  const bozuk = a.yeniSoruVarsayilanlari({ konuId: "yok", seviye: "L9", zorluk: "9", sure: "abc" }, bilinen);
  check("geçersiz değerler varsayılana döner", bozuk.topicId === "" && bozuk.level === "" && bozuk.difficulty === 3 && bozuk.targetTimeSeconds === 75);
  check("kaynak öneki adresten", a.yeniSoruVarsayilanlari({ kaynak: "2023 TYT / " }, bilinen).sourceRef === "2023 TYT / ");

  check("kuyruk sorgusu yalnızca süzgeçleri taşır", a.kuyrukSorgusu("sinav=TYT&x=1&yazan=12&geri=/evil") === "sinav=TYT&yazan=12");
  check("kuyruk adresi", a.kuyrukAdresi("konu=bolunebilme", { sonra: "abc" }) === "/checkup/sorular/incele?konu=bolunebilme&sonra=abc");
  check("kendi sorusu: damga kimliğiyle", a.kendiSorusuMu("hoca@x.com (#12)", 12) && !a.kendiSorusuMu("hoca@x.com (#112)", 12) && !a.kendiSorusuMu(null, 12));

  const P = (ad: string) => a.FORMUL_PARCALARI.find((p) => p.ad === ad)!;
  check("matematik içi: $ sayılır, \\$ sayılmaz", a.matematikIcinde("a $x", 4) && !a.matematikIcinde("a $x$ b", 7) && !a.matematikIcinde("\\$5 ", 4));
  check("matematik içi: paragraf sınırı", !a.matematikIcinde("$x\n\nb", 6));
  check("matematik içi: $$ blok", a.matematikIcinde("$$x + ", 6));
  const k1 = a.formulEkle("Sonuç  olur", 6, 6, P("kesir"));
  check("dışarıda: $…$ ile sarılır, imleç payda değil pay kutusunda", k1.metin === "Sonuç $\\frac{}{}$ olur" && k1.imlec === 13, JSON.stringify(k1));
  const k2 = a.formulEkle("$x + $", 5, 5, P("kok"));
  check("içeride: olduğu gibi girer", k2.metin === "$x + \\sqrt{}$" && k2.imlec === 11, JSON.stringify(k2));
  const k3 = a.formulEkle("$a$", 1, 2, P("kesir"));
  check("seçim sarılır, imleç paydaya", k3.metin === "$\\frac{a}{}$" && k3.imlec === 10, JSON.stringify(k3));
  const k4 = a.formulEkle("$x$", 2, 2, P("derece"));
  check("derece: ^{\\circ}", k4.metin === "$x^{\\circ}$");

  const b1 = a.blokEkle("Birinci cümle. İkinci cümle.", 8, "![şekil](m1)");
  check("satır ortasında: satır sonuna, boş satırla", b1.metin === "Birinci cümle. İkinci cümle.\n\n![şekil](m1)\n", JSON.stringify(b1.metin));
  const b2 = a.blokEkle("Üst paragraf.\n\nAlt paragraf.", 14, "![ş](m1)");
  check("paragraflar arasında: araya", b2.metin === "Üst paragraf.\n\n![ş](m1)\n\nAlt paragraf.", JSON.stringify(b2.metin));
  check("imleç şeklin sonunda", b2.metin.slice(0, b2.imlec).endsWith("![ş](m1)"));
  const b3 = a.blokEkle("Metin", null, "![ş](m1)");
  check("alana girilmediyse sona (eski davranış)", b3.metin === "Metin\n\n![ş](m1)\n");
  check("boş metne", a.blokEkle("", 0, "![ş](m1)").metin === "![ş](m1)\n");

  const ozet = a.yayinOzeti(12, {
    toplam: 3,
    nedenler: [
      { kod: "cozum", etiket: "çözüm yok", sayi: 2, suzgec: "cozumsuz" },
      { kod: "hata_tipi", etiket: "hata tipi eksik", sayi: 1, suzgec: "hatatipsiz" },
    ],
    sorular: [],
  });
  check("toplu yayın özeti", ozet === "12 soru yayına alındı, 3 soru atlandı: çözüm yok (2), hata tipi eksik (1).", ozet);
}

console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
process.exitCode = failed === 0 ? 0 : 1;
