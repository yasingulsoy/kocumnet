// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/scoring.ts · eşitlemek için: npm run checkup:sync

/**
 * Puanlama ve konu teşhisi. Saf fonksiyonlar — veritabanı bilmez, test edilebilir.
 */

export const SCORING_VERSION = 1;

export type TopicLevel = "STRONG" | "MEDIUM" | "WEAK";

/** Tek bir cevabın puanlamaya giren hali. */
export interface ScoredAnswer {
  topicId: string;
  topicSlug: string;
  topicName: string;
  /** Üst konu — yaprakta yeterli soru yoksa rapor buraya toplanır. */
  parentId: string | null;
  parentSlug: string | null;
  parentName: string | null;
  /** null = boş bırakıldı. Boş, yanlıştan farklıdır. */
  isCorrect: boolean | null;
  timeSpentMs: number;
  targetTimeSeconds: number;
  recommendedProductIds: string[];
}

export interface TopicBreakdownEntry {
  topicId: string;
  slug: string;
  name: string;
  asked: number;
  correct: number;
  wrong: number;
  blank: number;
  /** doğru / sorulan */
  ratio: number;
  avgTimeMs: number;
  /**
   * Seviye etiketi. TEK SORUYA BAKIP SEVİYE VERMİYORUZ: 25 soruluk genel
   * taramada konu başına 1 soru düşer ve 0/1 sonucu yazı-turadan ayırt edilemez.
   * asked < MIN_FOR_LEVEL ise null döner, arayüz "yeterli soru sorulmadı" der.
   */
  level: TopicLevel | null;
  /** asked >= 3 ise "HIGH", 2 ise "LOW". level null ise yok. */
  confidence: "HIGH" | "LOW" | null;
  /** Hedef sürenin üstünde mi geçirdi. */
  slow: boolean;
}

export interface TopicBreakdown {
  /** Yaprak konular — ince ayrıntı. */
  topics: TopicBreakdownEntry[];
  /** Üst konu toplamları — genel taramada anlamlı sinyal burada oluşur. */
  groups: TopicBreakdownEntry[];
}

export interface CheckupScore {
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  netScore: number;
  totalTimeMs: number;
  topicBreakdown: TopicBreakdown;
  recommendedProductIds: string[];
  scoringVersion: number;
}

/** Seviye etiketi için gereken en az soru sayısı. */
const MIN_FOR_LEVEL = 2;
/** "HIGH" güven için gereken soru sayısı. */
const MIN_FOR_HIGH_CONFIDENCE = 3;

const STRONG_AT = 0.75;
const MEDIUM_AT = 0.45;

function levelFor(ratio: number): TopicLevel {
  if (ratio >= STRONG_AT) return "STRONG";
  if (ratio >= MEDIUM_AT) return "MEDIUM";
  return "WEAK";
}

interface Bucket {
  topicId: string;
  slug: string;
  name: string;
  correct: number;
  wrong: number;
  blank: number;
  timeMs: number;
  targetMs: number;
  products: string[];
}

function newBucket(topicId: string, slug: string, name: string): Bucket {
  return { topicId, slug, name, correct: 0, wrong: 0, blank: 0, timeMs: 0, targetMs: 0, products: [] };
}

function addToBucket(b: Bucket, a: ScoredAnswer) {
  if (a.isCorrect === null) b.blank += 1;
  else if (a.isCorrect) b.correct += 1;
  else b.wrong += 1;

  b.timeMs += a.timeSpentMs;
  b.targetMs += a.targetTimeSeconds * 1000;
  for (const p of a.recommendedProductIds) {
    if (!b.products.includes(p)) b.products.push(p);
  }
}

function finalize(b: Bucket): TopicBreakdownEntry {
  const asked = b.correct + b.wrong + b.blank;
  // Boş bırakılan soru "bilmiyorum"dur: oranın paydasında kalır, yoksa
  // hiçbir şey işaretlemeyen öğrenci her konuda güçlü görünür.
  const ratio = asked === 0 ? 0 : b.correct / asked;
  const hasLevel = asked >= MIN_FOR_LEVEL;

  return {
    topicId: b.topicId,
    slug: b.slug,
    name: b.name,
    asked,
    correct: b.correct,
    wrong: b.wrong,
    blank: b.blank,
    ratio: Math.round(ratio * 1000) / 1000,
    avgTimeMs: asked === 0 ? 0 : Math.round(b.timeMs / asked),
    level: hasLevel ? levelFor(ratio) : null,
    confidence: hasLevel ? (asked >= MIN_FOR_HIGH_CONFIDENCE ? "HIGH" : "LOW") : null,
    slow: b.targetMs > 0 && b.timeMs > b.targetMs * 1.3,
  };
}

/**
 * Rapor sırası: en zayıf ÖLÇÜLEBİLMİŞ konu en üstte, seviyesi belirlenemeyen
 * konular en altta.
 *
 * Yalnızca orana göre sıralamak, "0/1" çıkan ve hakkında hiçbir şey
 * söyleyemediğimiz bir konuyu listenin tepesine taşıyor — öğrenci en üsttekine
 * bakar, oysa orada eyleme geçirilecek bilgi yok.
 */
function byActionability(a: TopicBreakdownEntry, b: TopicBreakdownEntry): number {
  const aMeasured = a.level !== null;
  const bMeasured = b.level !== null;
  if (aMeasured !== bMeasured) return aMeasured ? -1 : 1;
  if (a.ratio !== b.ratio) return a.ratio - b.ratio;
  // Eşit oranda çok soru sorulan daha güvenilir: önce o gelsin.
  return b.asked - a.asked;
}

/**
 * Net hesabı. penaltyRatio pakete ait — koda gömülmez (PLAN §4):
 * YKS 0.25, LGS 0.3333, KPSS 0.
 */
export function calculateNet(correct: number, wrong: number, penaltyRatio: number): number {
  const net = correct - wrong * penaltyRatio;
  // Negatif net gösterilmez; öğrenciye "-2 net" demek bilgi değil moral kırar.
  return Math.max(0, Math.round(net * 100) / 100);
}

export function scoreCheckup(answers: ScoredAnswer[], penaltyRatio: number): CheckupScore {
  const leaves = new Map<string, Bucket>();
  const groups = new Map<string, Bucket>();

  for (const a of answers) {
    let leaf = leaves.get(a.topicId);
    if (!leaf) {
      leaf = newBucket(a.topicId, a.topicSlug, a.topicName);
      leaves.set(a.topicId, leaf);
    }
    addToBucket(leaf, a);

    // Üst konusu olmayan konular kendi başlarına bir grup sayılır, yoksa
    // rapordan düşerler.
    const gId = a.parentId ?? a.topicId;
    const gSlug = a.parentSlug ?? a.topicSlug;
    const gName = a.parentName ?? a.topicName;
    let group = groups.get(gId);
    if (!group) {
      group = newBucket(gId, gSlug, gName);
      groups.set(gId, group);
    }
    addToBucket(group, a);
  }

  const topicEntries = [...leaves.values()].map(finalize);
  const groupEntries = [...groups.values()].map(finalize);

  const correctCount = answers.filter((a) => a.isCorrect === true).length;
  const wrongCount = answers.filter((a) => a.isCorrect === false).length;
  const blankCount = answers.filter((a) => a.isCorrect === null).length;

  return {
    correctCount,
    wrongCount,
    blankCount,
    netScore: calculateNet(correctCount, wrongCount, penaltyRatio),
    totalTimeMs: answers.reduce((s, a) => s + a.timeSpentMs, 0),
    topicBreakdown: {
      topics: topicEntries.sort(byActionability),
      groups: groupEntries.sort(byActionability),
    },
    recommendedProductIds: recommendProducts(leaves, groups),
    scoringVersion: SCORING_VERSION,
  };
}

/**
 * Ürün önerisi yalnızca YETERLİ KANITI OLAN zayıf konulardan çıkar.
 * Tek soruluk bir yanlıştan ürün önermek satış değil gürültüdür; öğrenci
 * bir kez yanıldığında güvenini kaybeder.
 */
function recommendProducts(
  leaves: Map<string, Bucket>,
  groups: Map<string, Bucket>
): string[] {
  const weak: { entry: TopicBreakdownEntry; products: string[] }[] = [];

  for (const b of [...leaves.values(), ...groups.values()]) {
    const entry = finalize(b);
    if (entry.level === "WEAK" && entry.asked >= MIN_FOR_HIGH_CONFIDENCE) {
      weak.push({ entry, products: b.products });
    }
  }

  // En zayıf konu en üstte — öğrenci listenin başındakine bakar.
  weak.sort((a, b) => a.entry.ratio - b.entry.ratio);

  const out: string[] = [];
  for (const w of weak) {
    for (const p of w.products) {
      if (!out.includes(p)) out.push(p);
    }
  }
  // Üçten fazla öneri seçim felcine yol açar.
  return out.slice(0, 3);
}
