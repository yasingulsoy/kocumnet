import { ERROR_TYPE_LABELS } from "@/lib/error-types";
import type { ReviewItem } from "@/lib/checkup";
import type { TopicBreakdown, TopicBreakdownEntry } from "@/lib/scoring";

/**
 * Sonuç ekranının iki ek okuması: hata deseni ve önceki denemeye göre ilerleme.
 * Saf fonksiyonlar — veritabanı bilmez.
 */

// ─────────────────────────────────────────────────────────────
// Hata deseni
// ─────────────────────────────────────────────────────────────

export interface ErrorPattern {
  type: string;
  label: string;
  count: number;
  /** Hata tipi etiketli yanlışlar içindeki payı. */
  share: number;
}

/**
 * "Yanlış yaptın" bilgi değil. "Kavram eksiğin yok, işlem hatası yapıyorsun"
 * bilgidir — ve öğrencinin çalışma biçimini değiştirir.
 *
 * Yalnızca etiketli çeldiricileri sayıyoruz; etiketsiz yanlışlar paydaya
 * girmez, yoksa hata tipi girilmemiş bir havuzda oranlar yanıltıcı çıkar.
 */
export function errorPattern(items: ReviewItem[]): ErrorPattern[] {
  const sayac = new Map<string, number>();

  for (const item of items) {
    if (item.isCorrect !== false) continue;
    const secilen = item.choices.find((c) => c.id === item.selectedChoiceId);
    if (!secilen?.errorType) continue;
    sayac.set(secilen.errorType, (sayac.get(secilen.errorType) ?? 0) + 1);
  }

  const toplam = [...sayac.values()].reduce((a, b) => a + b, 0);
  if (toplam === 0) return [];

  return [...sayac.entries()]
    .map(([type, count]) => ({
      type,
      label: ERROR_TYPE_LABELS[type as keyof typeof ERROR_TYPE_LABELS] ?? type,
      count,
      share: count / toplam,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Hata deseni ne zaman gösterilmeli?
 *
 * Tek bir etiketli yanlıştan "şu hatayı yapıyorsun" çıkarmak, tek soruluk
 * konudan seviye çıkarmakla aynı hata (PLAN §2). En az 3 etiketli yanlış ve
 * baskın bir tip arıyoruz.
 */
export function dominantError(pattern: ErrorPattern[]): ErrorPattern | null {
  const toplam = pattern.reduce((s, p) => s + p.count, 0);
  if (toplam < 3) return null;
  const ilk = pattern[0];
  return ilk && ilk.share >= 0.4 ? ilk : null;
}

// ─────────────────────────────────────────────────────────────
// İlerleme
// ─────────────────────────────────────────────────────────────

export interface TopicProgress {
  topicId: string;
  name: string;
  oncekiRatio: number;
  simdikiRatio: number;
  /** Yüzde puan farkı (+18 gibi). */
  delta: number;
}

export interface ProgressSummary {
  netDelta: number;
  gelisen: TopicProgress[];
  gerileyen: TopicProgress[];
}

/**
 * Aynı paketin bir önceki denemesiyle karşılaştırma.
 *
 * Yalnızca İKİ denemede de YETERLİ soru sorulmuş konuları karşılaştırıyoruz.
 * Bir denemede 1, diğerinde 4 soru sorulmuş bir konuda "gelişti" demek,
 * gürültüyü ilerleme diye sunmaktır.
 */
export function compareProgress(
  simdiki: TopicBreakdown,
  onceki: TopicBreakdown,
  netDelta: number
): ProgressSummary {
  const oncekiHaritasi = new Map<string, TopicBreakdownEntry>(
    onceki.topics.map((t) => [t.topicId, t])
  );

  const degisenler: TopicProgress[] = [];

  for (const t of simdiki.topics) {
    const o = oncekiHaritasi.get(t.topicId);
    if (!o) continue;
    if (t.level === null || o.level === null) continue;

    const delta = Math.round((t.ratio - o.ratio) * 100);
    // Bir soruluk oynamalar (küçük farklar) ilerleme sayılmaz.
    if (Math.abs(delta) < 15) continue;

    degisenler.push({
      topicId: t.topicId,
      name: t.name,
      oncekiRatio: o.ratio,
      simdikiRatio: t.ratio,
      delta,
    });
  }

  return {
    netDelta: Math.round(netDelta * 100) / 100,
    gelisen: degisenler.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta),
    gerileyen: degisenler.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta),
  };
}
