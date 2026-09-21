/**
 * Çekirdek mantığın duman testi: parola, içerik şeması, parmak izi, puanlama.
 *   npx tsx scripts/smoke.ts
 */
import { hashPassword, verifyPassword } from "../lib/password";
import { deriveQuestionFields, safeParseQuestionContent } from "../lib/question-content";
import { calculateNet, scoreCheckup, type ScoredAnswer } from "../lib/scoring";
import { errorPattern, dominantError, compareProgress } from "../lib/diagnosis";
import type { ReviewItem } from "../lib/checkup";
import type { TopicBreakdown } from "../lib/scoring";

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

console.log(failed === 0 ? "\nTümü geçti.\n" : `\n${failed} kontrol BAŞARISIZ.\n`);
process.exitCode = failed === 0 ? 0 : 1;
