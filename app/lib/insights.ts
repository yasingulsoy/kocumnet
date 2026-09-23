import type { TopicBreakdown } from "./scoring";

/**
 * Öğrenci panosunun okumaları: tüm sonuçlar üzerinden genel konu haritası
 * ve özet sayılar. Saf fonksiyonlar — veritabanı bilmez.
 */

export interface ResultLike {
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  netScore: number;
  totalTimeMs: number;
  computedAt: Date;
  topicBreakdown: TopicBreakdown;
}

export interface AggregateTopic {
  topicId: string;
  name: string;
  asked: number;
  correct: number;
  ratio: number;
  level: "STRONG" | "MEDIUM" | "WEAK" | null;
}

/**
 * Genel konu haritası: bir konu birden fazla testte sorulduysa hepsi toplanır.
 *
 * Seviye eşiği tek testten DAHA YÜKSEK (3 soru): burada farklı günlerde,
 * farklı paketlerde sorulmuş soruları topluyoruz; az veriyle "genel olarak
 * zayıfsın" demek tek testteki hatanın büyütülmüş hâli olur.
 */
export function aggregateTopics(results: ResultLike[]): AggregateTopic[] {
  const map = new Map<string, { name: string; asked: number; correct: number }>();

  for (const r of results) {
    for (const t of r.topicBreakdown.topics) {
      const cur = map.get(t.topicId) ?? { name: t.name, asked: 0, correct: 0 };
      cur.asked += t.asked;
      cur.correct += t.correct;
      map.set(t.topicId, cur);
    }
  }

  return [...map.entries()].map(([topicId, v]) => {
    const ratio = v.asked === 0 ? 0 : v.correct / v.asked;
    return {
      topicId,
      name: v.name,
      asked: v.asked,
      correct: v.correct,
      ratio,
      level: v.asked < 3 ? null : ratio >= 0.75 ? "STRONG" : ratio >= 0.45 ? "MEDIUM" : "WEAK",
    };
  });
}

export interface StudentStats {
  testCount: number;
  /** Tüm testlerde doğru / sorulan (0-1). Paketler farklı uzunlukta olduğu
   *  için net ortalaması yerine oran — 15 soruluk testin neti 24 soruluğunkiyle
   *  kıyaslanamaz. */
  avgRatio: number;
  lastNet: number | null;
  totalMinutes: number;
  /** Son iki testin başarı oranı farkı (puan). */
  trend: number | null;
}

export function studentStats(results: ResultLike[]): StudentStats {
  if (results.length === 0) {
    return { testCount: 0, avgRatio: 0, lastNet: null, totalMinutes: 0, trend: null };
  }

  const sirali = [...results].sort((a, b) => a.computedAt.getTime() - b.computedAt.getTime());
  const oran = (r: ResultLike) => {
    const t = r.correctCount + r.wrongCount + r.blankCount;
    return t === 0 ? 0 : r.correctCount / t;
  };

  const toplamSoru = sirali.reduce((s, r) => s + r.correctCount + r.wrongCount + r.blankCount, 0);
  const toplamDogru = sirali.reduce((s, r) => s + r.correctCount, 0);
  const son = sirali[sirali.length - 1];
  const onceki = sirali.length > 1 ? sirali[sirali.length - 2] : null;

  return {
    testCount: sirali.length,
    avgRatio: toplamSoru === 0 ? 0 : toplamDogru / toplamSoru,
    lastNet: son.netScore,
    totalMinutes: Math.round(sirali.reduce((s, r) => s + r.totalTimeMs, 0) / 60_000),
    trend: onceki ? Math.round((oran(son) - oran(onceki)) * 100) : null,
  };
}

/** Günün saatine göre selam — Türkiye saatiyle, sunucu UTC'de olsa bile. */
export function greeting(now: Date): string {
  const saat = Number(
    new Intl.DateTimeFormat("tr-TR", { hour: "numeric", hour12: false, timeZone: "Europe/Istanbul" }).format(
      now
    )
  );
  if (saat >= 5 && saat < 12) return "Günaydın";
  if (saat >= 12 && saat < 18) return "İyi günler";
  if (saat >= 18 && saat < 23) return "İyi akşamlar";
  return "İyi geceler";
}
