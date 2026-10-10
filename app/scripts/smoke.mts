/**
 * Çekirdek mantığın duman testi: parola, içerik şeması, parmak izi, puanlama.
 *   npx tsx scripts/smoke.ts
 */
import { hashPassword, verifyPassword } from "../lib/password";
import { deriveQuestionFields, safeParseQuestionContent } from "../lib/question-content";
import { calculateNet, scoreCheckup, type ScoredAnswer } from "../lib/scoring";
import { errorPattern, dominantError, compareProgress } from "../lib/diagnosis";
import {
  bosStratejisi,
  haftaBasi,
  haftalikPlan,
  hataTavsiyesi,
  karar,
  kontrolKarari,
  oncelikSirasi,
  tekrarTavsiyesi,
  MAX_TOPICS_PER_WEEK,
} from "../lib/coaching";
import { EXAMS, EXAM_SCOPES, SECILEBILIR_SINAVLAR } from "../lib/exams";
import {
  ayarGetir,
  kapiMesaji,
  karneBasligi,
  seviye1AnaKarar,
  telafiKarar,
  ustSeviyeKarar,
  VARSAYILAN_AYAR,
} from "../lib/levels";
import type { TopicBreakdownEntry } from "../lib/scoring";
import type { ReviewItem } from "../lib/checkup";
import type { TopicBreakdown } from "../lib/scoring";
import {
  KAPANDI_MESAJI,
  KayitKuyrugu,
  depoyuSuz,
  geriAdimGecikmesi,
  sonrakiBosIndeks,
  sunucuylaBirlestir,
  uyariEsigi,
  type KayitYaniti,
  type KuyrukOlayi,
} from "../lib/sinav-kuyrugu";
import {
  BENZER_ZORLUK_FARKI,
  TEKRAR_ARALIKLARI_GUN,
  benzerAta,
  benzerMi,
  benzeriVar,
  gunBasi,
  kapsamUygun,
  tekrarSonrasi,
  vade,
  vadeMetni,
  yanlisKarari,
  yanlisSonrasi,
  type BenzerAday,
  type BenzerSoru,
} from "../lib/review";
import { hataTipiTavsiyesi } from "../lib/coaching";
import { cn } from "../lib/cn";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

// ── parola ────────────────────────────────────────────────
console.log("\nParola:");
const hash = await hashPassword("Kocum.Net!2026");
check("doğru parola doğrulanıyor", await verifyPassword("Kocum.Net!2026", hash));
check("yanlış parola reddediliyor", !(await verifyPassword("Kocum.Net!2025", hash)));
check("bozuk özet çökmüyor", !(await verifyPassword("x", "saçma-veri")));
const hash2 = await hashPassword("Kocum.Net!2026");
check("aynı parola farklı özet üretiyor (tuz)", hash !== hash2);

// ── içerik şeması ─────────────────────────────────────────
console.log("\nSoru içeriği:");
const gecerli = {
  version: 1,
  blocks: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Bir otomobil " },
        { type: "math", latex: "60" },
        { type: "text", text: " km/sa hızla " },
        { type: "math", latex: "3" },
        { type: "text", text: " saat yol alıyor. Kaç km yol gitmiştir?" },
      ],
    },
    { type: "math_block", latex: "x = v \\cdot t" },
  ],
};
const ok1 = safeParseQuestionContent(gecerli);
check("geçerli içerik kabul ediliyor", ok1.success, ok1.success ? "" : JSON.stringify(ok1.error.issues[0]));

check(
  "alt metni olmayan görsel reddediliyor",
  !safeParseQuestionContent({
    version: 1,
    blocks: [{ type: "image", mediaId: "abc" }],
  }).success
);
check("bilinmeyen blok tipi reddediliyor", !safeParseQuestionContent({ version: 1, blocks: [{ type: "video" }] }).success);
check("boş blok dizisi reddediliyor", !safeParseQuestionContent({ version: 1, blocks: [] }).success);

// ── parmak izi ────────────────────────────────────────────
console.log("\nParmak izi (çift kayıt tespiti):");
const d1 = deriveQuestionFields(ok1.success ? ok1.data : (gecerli as never));
check("stemText LaTeX'i de içeriyor", d1.stemText.includes("60") && d1.stemText.includes("km/sa"),
  `"${d1.stemText.slice(0, 55)}…"`);

const bosluklu = structuredClone(gecerli);
bosluklu.blocks[0].content![0].text = "Bir   otomobil  ";
const d2 = deriveQuestionFields(safeParseQuestionContent(bosluklu).data!);
check("fazla boşluk aynı parmak izi veriyor", d1.fingerprint === d2.fingerprint);

const farkliSayi = structuredClone(gecerli);
farkliSayi.blocks[0].content![3].latex = "5";
const d3 = deriveQuestionFields(safeParseQuestionContent(farkliSayi).data!);
check("farklı sayı farklı parmak izi veriyor (3 saat vs 5 saat)", d1.fingerprint !== d3.fingerprint);

// ── net hesabı ────────────────────────────────────────────
console.log("\nNet:");
check("YKS 18 doğru 7 yanlış = 16,25", calculateNet(18, 7, 0.25) === 16.25, String(calculateNet(18, 7, 0.25)));
check("KPSS (ceza yok) 18 doğru 7 yanlış = 18", calculateNet(18, 7, 0) === 18);
check("LGS 10 doğru 3 yanlış = 9", calculateNet(10, 3, 1 / 3) === 9);
check("negatif net 0'a çekiliyor", calculateNet(1, 8, 0.25) === 0);

// ── puanlama / teşhis ─────────────────────────────────────
console.log("\nKonu teşhisi:");
const ans = (
  topicSlug: string,
  parentSlug: string | null,
  isCorrect: boolean | null,
  products: string[] = []
): ScoredAnswer => ({
  topicId: topicSlug,
  topicSlug,
  topicName: topicSlug,
  parentId: parentSlug,
  parentSlug,
  parentName: parentSlug,
  isCorrect,
  timeSpentMs: 60_000,
  targetTimeSeconds: 75,
  recommendedProductIds: products,
});

const sonuc = scoreCheckup(
  [
    // problemler: 4 soru, 1 doğru → kanıtlı zayıf
    ans("sayi-kesir", "problemler", false, ["problemler-soru-paketi"]),
    ans("sayi-kesir", "problemler", false, ["problemler-soru-paketi"]),
    ans("hareket", "problemler", true, ["problemler-soru-paketi"]),
    ans("hareket", "problemler", null, ["problemler-soru-paketi"]),
    // tek soruluk konu: yanlış ama teşhis edilemez
    ans("mantik", null, false, ["muhtesem-uclu"]),
    // 3 soruluk güçlü konu
    ans("uslu", null, true),
    ans("uslu", null, true),
    ans("uslu", null, true),
  ],
  0.25
);

check("doğru/yanlış/boş sayımı", sonuc.correctCount === 4 && sonuc.wrongCount === 3 && sonuc.blankCount === 1,
  `${sonuc.correctCount}D ${sonuc.wrongCount}Y ${sonuc.blankCount}B`);
check("net = 4 - 3×0.25 = 3.25", sonuc.netScore === 3.25, String(sonuc.netScore));

const mantik = sonuc.topicBreakdown.topics.find((t) => t.slug === "mantik")!;
check("TEK soruluk konuya seviye etiketi VERİLMİYOR", mantik.level === null, `level=${mantik.level}`);

const uslu = sonuc.topicBreakdown.topics.find((t) => t.slug === "uslu")!;
check("3/3 doğru konu güçlü ve güven yüksek", uslu.level === "STRONG" && uslu.confidence === "HIGH");

const problemler = sonuc.topicBreakdown.groups.find((g) => g.slug === "problemler")!;
check("üst konu toplaması çalışıyor (4 soru)", problemler.asked === 4, `asked=${problemler.asked}`);
check("boş cevap oranın paydasında kalıyor (1/4)", problemler.ratio === 0.25, `ratio=${problemler.ratio}`);
check("kanıtlı zayıf üst konu WEAK", problemler.level === "WEAK");

check(
  "ürün önerisi kanıtlı zayıf konudan geliyor",
  sonuc.recommendedProductIds.includes("problemler-soru-paketi")
);
check(
  "TEK soruluk yanlıştan ürün ÖNERİLMİYOR",
  !sonuc.recommendedProductIds.includes("muhtesem-uclu"),
  sonuc.recommendedProductIds.join(", ") || "(öneri yok)"
);

// ── hata deseni ───────────────────────────────────────────
console.log("\nHata deseni:");

const ri = (secilenErrorType: string | null, dogruMu: boolean): ReviewItem => ({
  questionId: "q",
  order: 0,
  topicName: "t",
  stem: { version: 1, blocks: [] },
  solution: null,
  targetTimeSeconds: 60,
  timeSpentMs: 1000,
  isCorrect: dogruMu,
  selectedChoiceId: "sec",
  choices: [
    { id: "sec", label: "A", content: { version: 1, blocks: [] }, isCorrect: dogruMu, errorType: secilenErrorType },
  ],
});

const desen = errorPattern([
  ri("ISLEM_HATASI", false),
  ri("ISLEM_HATASI", false),
  ri("ISLEM_HATASI", false),
  ri("EKSIK_OKUMA", false),
  ri("ISLEM_HATASI", true), // doğru cevap — sayılmamalı
  ri(null, false), // etiketsiz — sayılmamalı
]);
check("yalnızca etiketli YANLIŞLAR sayılıyor", desen.reduce((s2, d) => s2 + d.count, 0) === 4,
  desen.map((d) => d.type + ":" + d.count).join(", "));
check("en sık hata başta", desen[0].type === "ISLEM_HATASI" && desen[0].count === 3);
check("etiket Türkçeleşiyor", desen[0].label === "İşlem hatası");

const baskin = dominantError(desen);
check("baskın hata bulundu (3/4 = %75)", baskin?.type === "ISLEM_HATASI");
check(
  "AZ veriden desen çıkarılmıyor (2 yanlış)",
  dominantError(errorPattern([ri("ISLEM_HATASI", false), ri("EKSIK_OKUMA", false)])) === null
);
check(
  "baskın olmayan dağılımda desen yok",
  dominantError([
    { type: "A", label: "A", count: 2, share: 0.33 },
    { type: "B", label: "B", count: 2, share: 0.33 },
    { type: "C", label: "C", count: 2, share: 0.34 },
  ]) === null
);

// ── ilerleme ──────────────────────────────────────────────
console.log("\nİlerleme:");

const bd = (entries: [string, number, "STRONG" | "MEDIUM" | "WEAK" | null][]): TopicBreakdown => ({
  topics: entries.map(([id, ratio, level]) => ({
    topicId: id, slug: id, name: id, asked: 4, correct: 2, wrong: 2, blank: 0,
    ratio, avgTimeMs: 0, level, confidence: level ? "HIGH" : null, slow: false,
  })),
  groups: [],
});

const ilerleme = compareProgress(
  bd([["a", 0.75, "STRONG"], ["b", 0.25, "WEAK"], ["c", 0.5, "MEDIUM"], ["d", 0.5, null]]),
  bd([["a", 0.25, "WEAK"], ["b", 0.75, "STRONG"], ["c", 0.45, "MEDIUM"], ["d", 0.1, "WEAK"]]),
  1.5
);
check("gelişen konu yakalandı", ilerleme.gelisen.length === 1 && ilerleme.gelisen[0].topicId === "a",
  ilerleme.gelisen.map((g) => g.topicId).join(","));
check("gerileyen konu yakalandı", ilerleme.gerileyen.length === 1 && ilerleme.gerileyen[0].topicId === "b");
check("küçük oynama ilerleme sayılmıyor (%5)", !ilerleme.gelisen.some((g) => g.topicId === "c"));
check("ÖLÇÜLEMEMİŞ konu karşılaştırılmıyor", !ilerleme.gelisen.concat(ilerleme.gerileyen).some((g) => g.topicId === "d"));
check("net farkı taşınıyor", ilerleme.netDelta === 1.5);

// ── sınav tanımları ───────────────────────────────────────
console.log("");
console.log("Sınavlar:");
for (const s of EXAM_SCOPES) {
  const e = EXAMS[s];
  check(
    `${s} tanımı tutarlı`,
    e.scope === s &&
      e.mathQuestionCount > 0 &&
      e.grades.length > 0 &&
      e.defaultTargetNet >= 0 &&
      e.defaultTargetNet <= e.mathQuestionCount &&
      e.penaltyRatio >= 0 &&
      e.penaltyRatio <= 1,
    `${e.mathQuestionCount} soru, hedef ${e.defaultTargetNet}, ceza ${e.penaltyRatio}`
  );
}
check("seçilebilir sınavların hepsi tanımlı", SECILEBILIR_SINAVLAR.every((s) => Boolean(EXAMS[s])));

// ── koçluk: öncelik sırası ────────────────────────────────
console.log("");
console.log("Koçluk — öncelik:");

const konu = (
  id: string,
  ratio: number,
  level: "STRONG" | "MEDIUM" | "WEAK" | null,
  asked = 4
): TopicBreakdownEntry => ({
  topicId: id,
  slug: id,
  name: id,
  asked,
  correct: Math.round(asked * ratio),
  wrong: asked - Math.round(asked * ratio),
  blank: 0,
  ratio,
  avgTimeMs: 0,
  level,
  confidence: level ? "HIGH" : null,
  slow: false,
});

const sirali = oncelikSirasi(
  [
    konu("guclu", 0.9, "STRONG"),
    konu("orta", 0.5, "MEDIUM"),
    konu("zayif-az-soru", 0.1, "WEAK", 2),
    konu("zayif-1", 0.2, "WEAK"),
    konu("zayif-2", 0.4, "WEAK"),
    konu("zayif-3", 0.45, "WEAK"),
  ],
  new Map()
);
check("yalnızca WEAK konular alınıyor", sirali.every((k) => k.name.startsWith("zayif")));
check("3'ten az soru sorulan konu elenir (kanıt kuralı)",
  !sirali.some((k) => k.topicId === "zayif-az-soru"));
check(`haftada en fazla ${MAX_TOPICS_PER_WEEK} konu`, sirali.length === MAX_TOPICS_PER_WEEK);
check("en düşük oran başa geliyor", sirali[0]?.topicId === "zayif-1");

const esitOran = oncelikSirasi(
  [konu("az-gelen", 0.3, "WEAK"), konu("cok-gelen", 0.3, "WEAK")],
  new Map([
    ["az-gelen", 1],
    ["cok-gelen", 5],
  ])
);
check("eşit oranda sınav ağırlığı öne geçiriyor", esitOran[0]?.topicId === "cok-gelen");
check("kayıp soru hesaplanıyor", esitOran[0]?.kayip === 3.5, String(esitOran[0]?.kayip));

// ── koçluk: karar cümlesi ─────────────────────────────────
console.log("");
console.log("Koçluk — karar:");
const sayiVar = (m: string) => /\d/.test(m);

const yuksek = karar(0.8, [], [konu("Köklü Sayılar", 1, "STRONG")], 0, 20);
const orta = karar(0.55, sirali, [], 2, 20);
const dusuk = karar(0.2, sirali, [], 9, 20);
check("yüksek bant sayı içeriyor", sayiVar(yuksek.baslik) && yuksek.ton === "ok");
check("orta bant sayı içeriyor", sayiVar(orta.baslik) && orta.ton === "warn");
check("düşük bant sayı içeriyor", sayiVar(dusuk.baslik) && dusuk.ton === "bad");
check("düşük bantta tek konu söyleniyor", dusuk.metin.includes("zayif-1"));
check("çok boşta boş uyarısı var", dusuk.metin.includes("9 soruyu boş"));
check("üç bant da farklı", new Set([yuksek.metin, orta.metin, dusuk.metin]).size === 3);

// ── koçluk: kontrol testi kararı ──────────────────────────
console.log("");
console.log("Koçluk — kontrol testi:");
const kGecti = kontrolKarari({ name: "Bölünebilme", correct: 5, asked: 5, level: "STRONG" }, 0.33);
check("kontrol kararı sayı içeriyor", /\d\/\d/.test(kGecti.baslik), kGecti.baslik);
check(
  "geçilen kontrol 'ok' ve önceki ölçümü söylüyor",
  kGecti.ton === "ok" && kGecti.metin.includes("%33") && kGecti.metin.includes("+67"),
  kGecti.metin
);
const kKaldi = kontrolKarari({ name: "Bölünebilme", correct: 1, asked: 5, level: "WEAK" }, null);
check(
  "kalınan kontrol 'bad', paket dili yok",
  kKaldi.ton === "bad" && !/paket/i.test(kKaldi.baslik + kKaldi.metin),
  kKaldi.metin
);

// ── koçluk: boş stratejisi ────────────────────────────────
console.log("");
console.log("Koçluk — boş:");
check("az boşta tavsiye verilmiyor", bosStratejisi(2, 20, 0.25, "TYT") === null);
check("cezasız sınavda 'boş bırakma' deniyor",
  (bosStratejisi(8, 20, 0, "KPSS") ?? "").includes("hiçbir faydası yok"));
check("cezalı sınavda kaç yanlış bir doğru götürüyor yazıyor",
  (bosStratejisi(8, 20, 0.25, "TYT") ?? "").includes("4 yanlış"));
check("hiç boş yoksa tavsiye yok", bosStratejisi(0, 20, 0.25, "TYT") === null);

// ── koçluk: tekrar ve hata deseni ─────────────────────────
console.log("");
console.log("Koçluk — tekrar:");
check("havuz daraldıysa uyarılıyor", tekrarTavsiyesi(3, "Problemler").includes("sınırlı"));
check("havuz genişse 10 gün deniyor", tekrarTavsiyesi(0, "Problemler").includes("10 gün"));
check("bilinen hata tipine reçete var",
  (hataTavsiyesi({ type: "ISLEM_HATASI", label: "İşlem hatası", count: 5 })?.metin ?? "").length > 20);
check("DIGER için uydurma tavsiye yok",
  hataTavsiyesi({ type: "DIGER", label: "Diğer", count: 5 }) === null);
check("hata yoksa kart yok", hataTavsiyesi(null) === null);

// ── koçluk: haftalık plan ─────────────────────────────────
console.log("");
console.log("Koçluk — plan:");
const plan = haftalikPlan(sirali, new Map([["zayif-1", ["urun-a"]]]));
check("konu başına dört iş", plan.length === sirali.length * 4);
check("her konuda kontrol testi var",
  sirali.every((k) => plan.some((i) => i.topicId === k.topicId && i.kind === "RETEST")));
check("kontrol testi ürün önermiyor",
  plan.filter((i) => i.kind === "RETEST").every((i) => !i.productId));
check("ürün eşleşen işe taşınıyor",
  plan.some((i) => i.topicId === "zayif-1" && i.productId === "urun-a"));
check("boş öncelikte plan boş", haftalikPlan([], new Map()).length === 0);

// Hafta sınırı: pazar 23:30 (TR) hâlâ o haftaya ait olmalı.
const pazar = haftaBasi(new Date("2026-03-15T20:30:00.000Z")); // TR 23:30 pazar
const pazartesi = haftaBasi(new Date("2026-03-16T05:00:00.000Z")); // TR 08:00 pazartesi
check("pazar gecesi hafta değişmiyor", pazar.toISOString().startsWith("2026-03-09"),
  pazar.toISOString());
check("pazartesi yeni hafta", pazartesi.toISOString().startsWith("2026-03-16"),
  pazartesi.toISOString());

// -----------------------------------------------------------
// Seviyeli check-up: kapi mantigi
// -----------------------------------------------------------
console.log("");
console.log("Seviyeli check-up - Seviye 1 kapisi:");

const ay = VARSAYILAN_AYAR;
const eksikler = (n: number) => Array.from({ length: n }, (_, i) => "kz-" + i);

// Sema: 30-50 dogru (>= %60) -> dogrudan Seviye 2
const k60 = seviye1AnaKarar(30, 50, eksikler(20), ay);
check("30/50 (%60) dogrudan Seviye 2", k60.tur === "SONRAKI_SEVIYE" && k60.seviye === 2);

// Sema: 29 ve alti -> telafi turu
const k29 = seviye1AnaKarar(29, 50, eksikler(21), ay);
check("29/50 telafi turu aciyor", k29.tur === "TELAFI");
check("telafi yalnizca eksik kazanimlardan",
  k29.tur === "TELAFI" && k29.soruSayisi === 21, String(k29.tur === "TELAFI" ? k29.soruSayisi : "-"));
check("telafi suresi soru sayisina gore",
  k29.tur === "TELAFI" && k29.dakika === 21);

// Matematiksel kisa devre: telafiyi tam yapsa bile baraji asamayacak ogrenci
const k10 = seviye1AnaKarar(10, 50, eksikler(40), ay);
check("10/50 hala telafi hakki var (50/90 = %55.6)", k10.tur === "TELAFI");
const k9 = seviye1AnaKarar(9, 50, eksikler(41), ay);
check("9/50 telafiye SOKULMUYOR (50/91 = %54.9 < %55)", k9.tur === "DUR");
check("kisa devre sebebi BARAJ", k9.tur === "DUR" && k9.sebep === "BARAJ");

// Hic eksik yoksa (hepsi dogru ama oran dusuk olamaz) -> savunma
check("eksik kazanim yoksa telafi acilmaz", seviye1AnaKarar(20, 50, [], ay).tur === "DUR");

console.log("");
console.log("Seviyeli check-up - telafi sonrasi:");

// Birlesik oran: (ana dogru + telafi dogru) / (ana toplam + telafi toplam)
const t60 = telafiKarar(25, 50, 20, 25, ay);
check("25/50 + 20/25 = 45/75 (%60) -> Seviye 2", t60.tur === "SONRAKI_SEVIYE");
const t46 = telafiKarar(25, 50, 10, 25, ay);
check("25/50 + 10/25 = 35/75 (%46.7) -> DUR", t46.tur === "DUR");
check("telafi sonrasi durus sebebi ayri",
  t46.tur === "DUR" && t46.sebep === "TELAFI_SONRASI");
// Tam sinir: 41.25 -> 42 dogru gerekiyor
check("sinirda 42/75 (%56) geciyor", telafiKarar(25, 50, 17, 25, ay).tur === "SONRAKI_SEVIYE");
check("sinirda 41/75 (%54.7) geciyor DEGIL", telafiKarar(25, 50, 16, 25, ay).tur === "DUR");

console.log("");
console.log("Seviyeli check-up - Seviye 2 ve 3:");

check("15/25 (%60) -> Seviye 3", ustSeviyeKarar(2, 15, 25, ay).tur === "SONRAKI_SEVIYE");
const s14 = ustSeviyeKarar(2, 14, 25, ay);
check("14/25 (%56) -> DUR", s14.tur === "DUR" && s14.seviye === 2);
check("Seviye 3'te baraj yok, her sonuc BITTI",
  ustSeviyeKarar(3, 5, 25, ay).tur === "BITTI" && ustSeviyeKarar(3, 25, 25, ay).tur === "BITTI");

console.log("");
console.log("Seviyeli check-up - ayarlar ve metin:");

check("varsayilan 50 + 25 + 25 soru",
  ay.seviye1.soruSayisi === 50 && ay.seviye2.soruSayisi === 25 && ay.seviye3.soruSayisi === 25);
check("Seviye 2 suresi semadaki 30-35 araliginda",
  ay.seviye2.dakika >= 30 && ay.seviye2.dakika <= 35, ay.seviye2.dakika + " dk");
check("LGS ayri ayarlanmis (daha kisa)",
  ayarGetir("LGS").seviye1.soruSayisi < ayarGetir("TYT").seviye1.soruSayisi);
check("LGS telafi esigi varsayilanla ayni",
  ayarGetir("LGS").telafiSonrasiOran === ay.telafiSonrasiOran);

const mesaj = kapiMesaji(k60, 0.6);
check("kapi mesaji sayi iceriyor", /\d/.test(mesaj.baslik), mesaj.baslik);
check("durus mesaji 'bad' tonunda", kapiMesaji(k9, 0.18).ton === "bad");
check("telafi mesaji 'warn' tonunda", kapiMesaji(k29, 0.58).ton === "warn");
check("karne adlari semadaki gibi",
  karneBasligi(1, "STOPPED") === "Seviye 1 Eksik Analiz Karnesi" &&
  karneBasligi(2, "STOPPED") === "Seviye 2 Teşhis Karnesi" &&
  karneBasligi(3, "COMPLETED") === "Nihai Check-up Raporu");
check("akis surerken 'kaldin' baslig i cikmiyor",
  karneBasligi(1, "IN_PROGRESS") === "Şu ana kadarki durumun");

// ── sınav kuyruğu ─────────────────────────────────────────
/*
 * Sınav ekranının cevap kaydı kuyruğu (lib/sinav-kuyrugu.ts). Her senaryo
 * gerçek bir kusurdan: son soruyu işaretleyip hemen "Bitir" (yoldaki tur),
 * 00:00'da sonsuz deneme (kalıcı hata kodları), geri tuşunda eski işaretin
 * yeni işareti ezmesi (eşitleme), bozuk cihaz kaydı.
 */
console.log("");
console.log("Sınav kuyruğu:");
{
  type Adim = KayitYaniti | "at" | Promise<KayitYaniti>;
  const bekle = () => new Promise<void>((r) => setTimeout(r, 0));
  const kur = (adimlar: Adim[]) => {
    const olaylar: KuyrukOlayi[] = [];
    const cagrilar: string[] = [];
    const zamanlar: { fn: () => void; ms: number }[] = [];
    let iptal = 0;
    const k = new KayitKuyrugu({
      kaydet: async (qid, kayit) => {
        cagrilar.push(`${qid}:${kayit.choiceId}`);
        const adim = adimlar.shift() ?? { ok: true };
        if (adim === "at") throw new Error("ağ yok");
        return adim;
      },
      bildir: (o) => {
        olaylar.push(o);
      },
      zamanla: (fn, ms) => zamanlar.push({ fn, ms }),
      iptalEt: () => {
        iptal += 1;
      },
      simdi: () => 1234,
    });
    const tur = (t: KuyrukOlayi["tur"]) => olaylar.filter((o) => o.tur === t);
    return { k, olaylar, cagrilar, zamanlar, tur, iptal: () => iptal };
  };
  const ertelenmis = () => {
    let coz: (y: KayitYaniti) => void = () => {};
    const soz = new Promise<KayitYaniti>((r) => (coz = r));
    return { soz, coz };
  };
  const kayit = (choiceId: string | null) => ({ choiceId, timeSpentMs: 5 });

  {
    const t = kur([{ ok: true }, { ok: true }]);
    t.k.ekle("q1", kayit("a"));
    t.k.ekle("q2", kayit("b"));
    const s = await t.k.bosalt();
    const durumlar = t.tur("durum").map((o) => (o.tur === "durum" ? o.durum : "")).join(",");
    check("sırayla yazar ve boşalır", s === "tamam" && t.k.boyut === 0 && t.cagrilar.join(" ") === "q1:a q2:b", t.cagrilar.join(" "));
    check("durum saving → saved", durumlar === "saving,saved", durumlar);
    check("kayıt anı bildirilir (eşitleme ezmesin diye)", t.tur("kaydedildi").length === 2);
  }

  {
    const d = ertelenmis();
    const t = kur([d.soz, { ok: true }]);
    t.k.ekle("q1", kayit("a"));
    const p1 = t.k.bosalt();
    const p2 = t.k.bosalt();
    t.k.ekle("q2", kayit("b"));
    d.coz({ ok: true });
    const s = await p2;
    check("yoldaki tur beklenir: ikinci çağrı AYNI sözü alır", p1 === p2);
    check("tur sürerken eklenen kayıt da yazılır (Bitir yarışı)", s === "tamam" && t.k.boyut === 0 && t.cagrilar.length === 2, t.cagrilar.join(" "));
  }

  {
    const d = ertelenmis();
    const t = kur([d.soz, { ok: true }]);
    t.k.ekle("q1", kayit("a"));
    const p = t.k.bosalt();
    t.k.ekle("q1", kayit("b"));
    d.coz({ ok: true });
    await p;
    check("yoldayken değişen işaretin YENİSİ de gönderilir", t.cagrilar.join(" ") === "q1:a q1:b" && t.k.boyut === 0, t.cagrilar.join(" "));
  }

  {
    const t = kur(["at", "at", { ok: true }]);
    t.k.ekle("q1", kayit("a"));
    const s1 = await t.k.bosalt();
    check("ağ hatası geçici sayılır, kayıt kuyrukta kalır", s1 === "gecici" && t.k.boyut === 1);
    check("ilk tekrar 1 sn sonra", t.zamanlar[0]?.ms === 1000, String(t.zamanlar[0]?.ms));
    t.zamanlar[0].fn();
    await bekle();
    check("ikinci tekrar 2 sn sonra (geri adım)", t.zamanlar[1]?.ms === 2000, String(t.zamanlar[1]?.ms));
    const ardisik = t.tur("ardisikHata").map((o) => (o.tur === "ardisikHata" ? o.sayi : -1));
    check("ardışık hata sayılır", ardisik.join(",") === "1,2", ardisik.join(","));
    t.zamanlar[1].fn();
    await bekle();
    const sonArdisik = t.tur("ardisikHata").at(-1);
    check(
      "bağlantı gelince yazılır, sayaç sıfırlanır",
      t.k.boyut === 0 && sonArdisik?.tur === "ardisikHata" && sonArdisik.sayi === 0
    );
  }

  {
    const t = kur(["at", "at"]);
    t.k.ekle("q1", kayit("a"));
    await t.k.bosalt();
    t.k.sifirlaDeneme();
    await t.k.bosalt();
    check("yeni işaret / bağlantı beklemeyi baştan başlatır", t.zamanlar[1]?.ms === 1000, String(t.zamanlar[1]?.ms));
    check("elle deneme bekleyen zamanlayıcıyı iptal eder", t.iptal() === 1, String(t.iptal()));
  }

  {
    const t = kur([{ ok: false, kod: "OTURUM", error: "x" }]);
    t.k.ekle("q1", kayit("a"));
    const s = await t.k.bosalt();
    check(
      "oturum düşünce tekrar denenmez, kayıt korunur",
      s === "oturum" && t.k.boyut === 1 && t.zamanlar.length === 0 && t.tur("oturumYok").length === 1
    );
  }

  {
    const t = kur([{ ok: false, kod: "SURE_DOLDU", error: "Süre doldu." }]);
    t.k.ekle("q1", kayit("a"));
    t.k.ekle("q2", kayit("b"));
    const s = await t.k.bosalt();
    const kayip = t.tur("kayip").at(-1);
    check("süre dolunca kuyruk bırakılır, bitirme engellenmez", s === "tamam" && t.k.boyut === 0 && t.cagrilar.length === 1);
    check(
      "kaybolan işaretler sayılır ve süre bildirilir",
      kayip?.tur === "kayip" && kayip.toplam === 2 && t.tur("sureDoldu").length === 1
    );
  }

  {
    const t = kur([{ ok: false, kod: "KAPANDI", error: "Bu test kapandı." }]);
    t.k.ekle("q1", kayit("a"));
    await t.k.bosalt();
    const hatalar = t.tur("hata").map((o) => (o.tur === "hata" ? o.mesaj : ""));
    check("test başka yerde bittiyse eşitleme istenir", t.tur("kapandi").length === 1 && t.k.boyut === 0);
    check("kapandı mesajı tur sonunda silinmez", hatalar.length === 1 && hatalar[0] === KAPANDI_MESAJI, hatalar.join(" | "));
  }

  {
    const t = kur([{ ok: false, kod: "GECERSIZ", error: "Geçersiz şık." }, { ok: true }, { ok: true }]);
    t.k.ekle("q1", kayit("zzz"));
    t.k.ekle("q2", kayit("b"));
    const s = await t.k.bosalt();
    const hatalar1 = t.tur("hata").map((o) => (o.tur === "hata" ? o.mesaj : ""));
    check("geçersiz kayıt yalnız kendisi düşer", s === "tamam" && t.k.boyut === 0 && t.cagrilar.join(" ") === "q1:zzz q2:b");
    check("aynı turda hata mesajı silinmez", hatalar1.join("|") === "Geçersiz şık.", hatalar1.join("|"));
    t.k.ekle("q3", kayit("c"));
    await t.k.bosalt();
    const son = t.tur("hata").at(-1);
    check("sonraki temiz tur hatayı temizler", son?.tur === "hata" && son.mesaj === null);
  }

  check(
    "geri adım 1-2-4 sn, en çok 30 sn",
    geriAdimGecikmesi(0) === 1000 && geriAdimGecikmesi(2) === 4000 && geriAdimGecikmesi(10) === 30_000
  );

  const birlesik = sunucuylaBirlestir(
    { q1: "a", q2: null, q3: "c", q4: "d" },
    { q1: "x", q2: "y", q3: "z", q4: "w", yabanci: "v" },
    (q) => q === "q1",
    { q3: 200, q4: 50 },
    100
  );
  check("eşitleme: bekleyen soru yerel kalır", birlesik.q1 === "a");
  check("eşitleme: istek yoldayken değişen soru yerel kalır", birlesik.q3 === "c");
  check("eşitleme: diğerleri sunucudan gelir", birlesik.q2 === "y" && birlesik.q4 === "w");
  check("eşitleme: ekranda olmayan soru eklenmez", !("yabanci" in birlesik));

  const sorular = [
    { id: "q1", choices: [{ id: "a" }, { id: "b" }] },
    { id: "q2", choices: [{ id: "c" }] },
  ];
  const suzulmus = depoyuSuz(
    {
      sonra: ["q1", "baska-test", 7],
      kuyruk: [
        ["q1", { choiceId: "b", timeSpentMs: 10 }],
        ["q2", { choiceId: null, timeSpentMs: 0 }],
        ["baska-test", { choiceId: "a", timeSpentMs: 1 }],
        ["q2", { choiceId: "yok", timeSpentMs: 1 }],
        ["q1", { choiceId: "a" }],
        null,
        "bozuk",
      ],
    },
    sorular
  );
  check("depo: başka testin işaretleri atılır", suzulmus.sonra.size === 1 && suzulmus.sonra.has("q1"));
  check(
    "depo: geçerli kayıtlar ve boş işaret kalır, bozuk/yabancı atılır",
    JSON.stringify(suzulmus.kuyruk) ===
      JSON.stringify([
        ["q1", { choiceId: "b", timeSpentMs: 10 }],
        ["q2", { choiceId: null, timeSpentMs: 0 }],
      ]),
    JSON.stringify(suzulmus.kuyruk)
  );

  check(
    "sıradaki boş: ileri, sonra başa sarar, tek boş kendisiyse yok",
    sonrakiBosIndeks([1, 4, 7], 4) === 7 &&
      sonrakiBosIndeks([1, 4, 7], 7) === 1 &&
      sonrakiBosIndeks([3], 3) === null &&
      sonrakiBosIndeks([], 0) === null
  );
  check(
    "son dakikalar eşiği 5 ve 1 dakika",
    uyariEsigi(6 * 60_000) === null &&
      uyariEsigi(5 * 60_000) === 5 &&
      uyariEsigi(61_000) === 5 &&
      uyariEsigi(60_000) === 1 &&
      uyariEsigi(0) === 1
  );
}

// ── alıştırma: benzer soru ────────────────────────────────
console.log("");
console.log("Alıştırma — benzer soru:");
{
  const kaynak: BenzerSoru = { questionId: "k", topicId: "t1", objectiveId: null, level: null, difficulty: 3 };
  const aday = (o: Partial<BenzerAday> & { questionId: string }): BenzerAday => ({
    topicId: "t1",
    objectiveId: null,
    level: null,
    difficulty: 3,
    sonGosterim: null,
    ...o,
  });
  check("aynı soru asla benzer değil", !benzerMi(kaynak, aday({ questionId: "k" })));
  check("kazanımsız kaynakta aynı konu yeter", benzerMi(kaynak, aday({ questionId: "a" })));
  check("başka konu benzer değil", !benzerMi(kaynak, aday({ questionId: "a", topicId: "t2" })));
  check(
    `zorluk farkı en fazla ${BENZER_ZORLUK_FARKI}`,
    benzerMi(kaynak, aday({ questionId: "a", difficulty: 2 })) &&
      benzerMi(kaynak, aday({ questionId: "b", difficulty: 4 })) &&
      !benzerMi(kaynak, aday({ questionId: "c", difficulty: 5 })) &&
      !benzerMi(kaynak, aday({ questionId: "d", difficulty: 1 }))
  );
  check(
    "seviye aynı olmalı (seviyesiz yalnızca seviyesizle)",
    !benzerMi(kaynak, aday({ questionId: "a", level: "L1_TEMEL" })) &&
      !benzerMi({ ...kaynak, level: "L2_ORTA" }, aday({ questionId: "b" }))
  );
  const kazanimli: BenzerSoru = { ...kaynak, objectiveId: "o1", level: "L1_TEMEL", difficulty: 2 };
  check(
    "kazanımı olan kaynakta AYNI KAZANIM şart (aynı konu yetmez)",
    benzerMi(kazanimli, aday({ questionId: "a", objectiveId: "o1", level: "L1_TEMEL", difficulty: 1 })) &&
      !benzerMi(kazanimli, aday({ questionId: "b", objectiveId: "o2", level: "L1_TEMEL", difficulty: 2 })) &&
      !benzerMi(kazanimli, aday({ questionId: "c", objectiveId: null, level: "L1_TEMEL", difficulty: 2 }))
  );
  check(
    "sınav etiketi: kaynağın sınavında sorulamayan aday elenir",
    kapsamUygun({ ...kaynak, examScope: "TYT" }, aday({ questionId: "a", kapsamlar: ["TYT", "KPSS_LISANS"] })) &&
      !kapsamUygun({ ...kaynak, examScope: "LGS" }, aday({ questionId: "a", kapsamlar: ["TYT"] }))
  );

  // Seçim: önce görülmemiş, hepsi görülmüşse en eski gösterilen.
  const eski = new Date("2026-09-01T00:00:00Z");
  const yeni = new Date("2026-10-01T00:00:00Z");
  const havuz = [
    aday({ questionId: "gorulmus-yeni", sonGosterim: yeni }),
    aday({ questionId: "taze" }),
    aday({ questionId: "gorulmus-eski", sonGosterim: eski }),
  ];
  check("görülmemiş soru öne geçiyor", benzerAta([kaynak], havuz, () => 0).get("k")?.questionId === "taze");
  check(
    "hepsi görülmüşse en eski gösterilen",
    benzerAta([kaynak], havuz.filter((a) => a.questionId !== "taze"), () => 0).get("k")?.questionId === "gorulmus-eski"
  );

  // İki kaynak aynı havuzdan: aynı soru iki kez verilmez; kaynaklar aday olamaz.
  const k2: BenzerSoru = { ...kaynak, questionId: "k2" };
  const atama = benzerAta([kaynak, k2], [aday({ questionId: "k2" }), aday({ questionId: "x" })], () => 0);
  check(
    "kaynak soru başka kaynağa benzer olarak verilmez; aynı aday iki kez verilmez",
    atama.get("k")?.questionId === "x" && !atama.has("k2")
  );
  check("benzeri yoksa atama yok (çağıran söyler)", benzerAta([kaynak], [], () => 0).size === 0);
  check(
    "benzeriVar seçimle aynı kuralı kullanıyor",
    benzeriVar(kaynak, havuz) && !benzeriVar(kaynak, [aday({ questionId: "k" })]) &&
      !benzeriVar({ ...kaynak, examScope: "LGS" }, [aday({ questionId: "a", kapsamlar: ["TYT"] })])
  );
  check(
    "tek yanlışın hata tipi reçetesi var; DIGER için yok",
    typeof hataTipiTavsiyesi("ISLEM_HATASI") === "string" && hataTipiTavsiyesi("DIGER") === null &&
      hataTipiTavsiyesi(null) === null
  );
}

// ── yanlış defteri: aralıklı tekrar ───────────────────────
console.log("");
console.log("Yanlış defteri — aralıklar:");
{
  const gun = 86_400_000;
  // 10 Ekim 2026 21:30 Türkiye = 18:30Z; gün başı 10 Ekim 00:00 TR = 9 Ekim 21:00Z.
  const aksam = new Date("2026-10-10T18:30:00Z");
  check("gün başı Türkiye saatiyle", gunBasi(aksam).toISOString() === "2026-10-09T21:00:00.000Z", gunBasi(aksam).toISOString());
  // 00:30 TR (21:30Z önceki gün) yeni günün başına yuvarlanmalı.
  const geceYarisi = new Date("2026-10-10T21:30:00Z");
  check("gece yarısından sonra yeni gün", gunBasi(geceYarisi).toISOString() === "2026-10-10T21:00:00.000Z");
  check("akşamki yanlış YARIN gelir (yarın 21:30 değil, gün başı)", vade(aksam, 1).toISOString() === "2026-10-10T21:00:00.000Z");

  const y = yanlisSonrasi(aksam);
  check(
    `yanlıştan sonra ilk aşama, ${TEKRAR_ARALIKLARI_GUN[0]} gün sonra`,
    y.stage === 0 && y.resolvedAt === null && y.dueAt.getTime() === vade(aksam, TEKRAR_ARALIKLARI_GUN[0]).getTime()
  );

  // Doğru → sonraki aralık; sonuncusu da doğruysa çıkar. Yanlış → başa.
  let durum = { stage: 0 };
  const yol: string[] = [];
  for (let i = 0; i < TEKRAR_ARALIKLARI_GUN.length; i++) {
    const s = tekrarSonrasi(durum.stage, true, aksam);
    yol.push(s.cozuldu ? "çıktı" : `${s.stage}:${Math.round((s.dueAt.getTime() - gunBasi(aksam).getTime()) / gun)}g`);
    durum = s;
  }
  check(
    `doğru, doğru, doğru → ${TEKRAR_ARALIKLARI_GUN.slice(1).map((g) => `+${g}g`).join(", ")}, defterden çıkar`,
    yol.join(" ") === `${TEKRAR_ARALIKLARI_GUN.slice(1).map((g, i) => `${i + 1}:${g}g`).join(" ")} çıktı`,
    yol.join(" ")
  );
  const geri = tekrarSonrasi(2, false, aksam);
  check("son aşamada yanlış → başa, 1 gün", geri.stage === 0 && !geri.cozuldu && geri.resolvedAt === null &&
    geri.dueAt.getTime() === vade(aksam, TEKRAR_ARALIKLARI_GUN[0]).getTime());

  // İdempotentlik: aynı ölçüm iki kez, eski ölçüm geç.
  const t0 = new Date("2026-10-01T10:00:00Z");
  const t1 = new Date("2026-10-05T10:00:00Z");
  check("madde yoksa oluştur", yanlisKarari(null, { sessionId: "s1", zaman: t0 }) === "OLUSTUR");
  check(
    "aynı ölçüm yeniden puanlanırsa dokunma",
    yanlisKarari({ lastSessionId: "s1", lastWrongAt: t0, lastReviewedAt: null }, { sessionId: "s1", zaman: t0 }) === "DOKUNMA"
  );
  check(
    "daha yeni ölçümdeki yanlış maddeyi başa alır",
    yanlisKarari({ lastSessionId: "s1", lastWrongAt: t0, lastReviewedAt: null }, { sessionId: "s2", zaman: t1 }) === "SIFIRLA"
  );
  check(
    "geç puanlanan ESKİ ölçüm sonraki tekrarın ilerlemesini silmez",
    yanlisKarari({ lastSessionId: "s2", lastWrongAt: t0, lastReviewedAt: t1 }, { sessionId: "s1", zaman: new Date("2026-10-03T10:00:00Z") }) === "DOKUNMA"
  );
  check(
    "geç puanlanan eski ölçüm daha yeni yanlışın üstüne yazmaz",
    yanlisKarari({ lastSessionId: "s2", lastWrongAt: t1, lastReviewedAt: null }, { sessionId: "s1", zaman: t0 }) === "DOKUNMA"
  );
  check(
    "vade metni",
    vadeMetni(aksam, aksam) === "bugün" && vadeMetni(vade(aksam, 1), aksam) === "yarın" &&
      vadeMetni(vade(aksam, 3), aksam) === "3 gün sonra"
  );
}

// ── sınıf birleştirici ────────────────────────────────────
/*
 * tailwind-merge projenin ve kitin özel adlarını bilmezse `text-micro`'yu
 * renk sanıp yanındaki `text-white` ile birlikte siliyordu (yazı sessizce
 * büyüyordu). lib/cn.ts bu adları ona öğretiyor.
 */
console.log("");
console.log("Sınıf birleştirici (cn):");
{
  const icerir = (sonuc: string, ...siniflar: string[]) => siniflar.every((s) => sonuc.split(" ").includes(s));
  const a = cn("rounded-full px-2.5 text-micro font-semibold", "bg-ok-wash text-ok");
  check("özel boyut + renk birlikte kalıyor (text-micro + text-ok)", icerir(a, "text-micro", "text-ok"), a);
  const b = cn("text-caption text-ink-soft", "text-white");
  check("sonraki renk öncekini ezer, boyut kalır", icerir(b, "text-caption", "text-white") && !icerir(b, "text-ink-soft"), b);
  const c = cn("text-theme-xs text-gray-500", "text-title-sm");
  check("kitin boyutları birbirini ezer (theme-xs → title-sm)", icerir(c, "text-title-sm", "text-gray-500") && !icerir(c, "text-theme-xs"), c);
  const d = cn("shadow-card", "shadow-ok/20");
  check("özel gölge gölge rengiyle çakışmıyor", icerir(d, "shadow-card", "shadow-ok/20"), d);
  const e = cn("bg-brand-gradient", "bg-brand");
  check("gradyan zemin rengiyle çakışmıyor", icerir(e, "bg-brand-gradient", "bg-brand"), e);
  const f = cn("px-5", "px-3");
  check("çağıranın sınıfı varsayılanı ezer (px-5 → px-3)", f === "px-3", f);
}

// ── istemci paketi ────────────────────────────────────────
/*
 * KaTeX YALNIZCA SUNUCUDA çalışır. Bir istemci bileşeni MathContent'i (dolayısıyla
 * katex'i) import ederse ~270 KB'lık JS o sayfaya iner ve her formül telefonda
 * yeniden çizilir — derleme bunu hata saymaz, sessizce olur. Sonuç sayfasındaki
 * cevap incelemesi tam olarak böyle kaçmıştı. Burada "use client" dosyalarından
 * çıkan import zincirini (tip importları ve "use server" eylemleri hariç) gezip
 * katex'e ya da veritabanı istemcisine varan yol var mı diye bakıyoruz.
 */
console.log("");
console.log("İstemci paketi:");
{
  const KOK = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const YASAK = [
    { ad: "katex", eslesir: (s: string) => s === "katex" || s.startsWith("katex/") },
    { ad: "veritabanı istemcisi", eslesir: (s: string) => s === "@/lib/db" || s.startsWith("@prisma/") || s === "pg" },
  ];
  // Dosyanın başındaki yorumları atlayıp ilk ifadenin yönerge olup olmadığına bak.
  const yonerge = (kaynak: string, ad: "use client" | "use server") => {
    const bas = kaynak.replace(/^(?:\s+|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
    return bas.startsWith(`"${ad}"`) || bas.startsWith(`'${ad}'`);
  };

  const dosyalar: string[] = [];
  const gez = (dizin: string) => {
    for (const ad of readdirSync(dizin)) {
      if (ad === "node_modules" || ad === "generated" || ad.startsWith(".")) continue;
      const yol = join(dizin, ad);
      if (statSync(yol).isDirectory()) gez(yol);
      else if (/\.(ts|tsx)$/.test(ad) && !ad.endsWith(".d.ts")) dosyalar.push(yol);
    }
  };
  for (const d of ["app", "components", "lib"]) gez(join(KOK, d));

  const coz = (kimden: string, spec: string): string | null => {
    const taban = spec.startsWith("@/") ? join(KOK, spec.slice(2)) : resolve(dirname(kimden), spec);
    for (const ek of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      const aday = taban + ek;
      if (existsSync(aday) && statSync(aday).isFile()) return aday;
    }
    return null;
  };
  const importlar = (kaynak: string): string[] => {
    const sonuc: string[] = [];
    const desenler = [
      /^\s*(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+["']([^"']+)["']/gm,
      /^\s*import\s+["']([^"']+)["']/gm,
      /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    ];
    for (const d of desenler) for (const m of kaynak.matchAll(d)) sonuc.push(m[1]);
    return sonuc;
  };

  const istemciler = dosyalar.filter((f) => yonerge(readFileSync(f, "utf8"), "use client"));
  const ihlaller: string[] = [];
  for (const giris of istemciler) {
    const onceki = new Map<string, string | null>([[giris, null]]);
    const kuyruk = [giris];
    while (kuyruk.length > 0) {
      const dosya = kuyruk.shift()!;
      const kaynak = readFileSync(dosya, "utf8");
      // Sunucu eylemleri istemciye yalnızca referans olarak gider; içi inmez.
      if (dosya !== giris && yonerge(kaynak, "use server")) continue;
      for (const spec of importlar(kaynak)) {
        const yasak = YASAK.find((y) => y.eslesir(spec));
        if (yasak) {
          const zincir: string[] = [];
          for (let f: string | null = dosya; f; f = onceki.get(f) ?? null) zincir.unshift(relative(KOK, f));
          ihlaller.push(`${yasak.ad}: ${zincir.join(" → ")} → ${spec}`);
          continue;
        }
        if (!spec.startsWith("@/") && !spec.startsWith(".")) continue;
        const hedef = coz(dosya, spec);
        if (hedef && !onceki.has(hedef)) {
          onceki.set(hedef, dosya);
          kuyruk.push(hedef);
        }
      }
    }
  }
  check(`${istemciler.length} istemci bileşeni tarandı`, istemciler.length > 5);
  check("istemci bileşenlerinden katex'e/veritabanına giden import yok", ihlaller.length === 0, ihlaller.join(" | "));
}

console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
process.exitCode = failed === 0 ? 0 : 1;
