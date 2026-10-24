// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/insights.ts · eşitlemek için: npm run checkup:sync

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

// ─────────────────────────────────────────────────────────────
// Ölçüm süzgeci: hangi sonuç hangi okumaya girer
// ─────────────────────────────────────────────────────────────

/**
 * Süzgecin bir sonuçtan okuduğu alanlar. `kind` oturumun türüdür
 * (SessionKind: PACKAGE | TOPIC_RETEST | LEVEL_STAGE | PRACTICE); burada
 * Prisma tipi yok, panel de aynı dosyayı kullanıyor.
 */
export interface OlcumKaydi {
  kind: string;
  correctCount: number;
  wrongCount: number;
  /** Sonucun sınavı. Eski kayıtlarda boş: o zaman her sınava uyar sayılır. */
  examScope?: string | null;
}

/**
 * Hiç işaret konmadan kapanmış oturum: doğru + yanlış = 0.
 *
 * Öğrenci "cevaplara bakayım" diye boş gönderdi ya da sekmeyi kapattı ve
 * süreyi cron doldurdu. Bu bir ölçüm değil: eğilime girerse grafik sıfıra
 * çakılıyor, plana girerse bütün konular "zayıf" çıkıyor, deftere 40 madde
 * yazılıyor. Deneme havuzu (lib/checkup.ts denemeHavuzu) aynı kuralla
 * dışlıyor; tanım tek yerde, burada.
 */
export function isaretsiz(r: { correctCount: number; wrongCount: number }): boolean {
  return r.correctCount + r.wrongCount === 0;
}

/** Sınav süzgeci: sınav verilmediyse ya da kayıtta yazmıyorsa (eski kayıt) geçer. */
function sinavaUyar(s: OlcumKaydi, sinav?: string | null): boolean {
  return !sinav || !s.examScope || s.examScope === sinav;
}

/**
 * Eğilime (grafik, "son ölçüm", değişim puanı), tahmini nete ve özet
 * sayılara giren sonuç: yalnızca PAKET testi ve işaretli.
 *
 * Deneme, tanışma, standart paket ve kâğıtta çözülen dahil: kâğıt da
 * geçerli bir ölçüm, yalnızca süresi tutulmuyor. Dışarıda kalanlar:
 *  - Kontrol testi: 5 soru, tek zayıf konu. Çizgiye girince plandaki kontrol
 *    testini çözen öğrencinin grafiği sebepsiz düşüyordu.
 *  - Seviyeli aşama: cezasız (ham doğru) ve kazanım başına tek soru; neti
 *    paket testinin netiyle kıyaslanamaz, tahmini neti şişiriyordu.
 *  - Alıştırma: ölçüm değil (sonuç satırı da yok).
 */
export function egilimeGirer(s: OlcumKaydi, sinav?: string | null): boolean {
  return s.kind === "PACKAGE" && !isaretsiz(s) && sinavaUyar(s, sinav);
}

const KONU_HARITASI_TURLERI = new Set(["PACKAGE", "TOPIC_RETEST", "LEVEL_STAGE"]);

/**
 * Konu haritasına giren sonuç: paket, kontrol testi ya da seviyeli aşama;
 * işaretli. Kontrol testi ve aşama o konunun GERÇEK ölçümüdür (eğilimden
 * farkı bu): soru soruldu, öğrenci cevapladı. Alıştırma girmez.
 */
export function konuHaritasinaGirer(s: OlcumKaydi, sinav?: string | null): boolean {
  return KONU_HARITASI_TURLERI.has(s.kind) && !isaretsiz(s) && sinavaUyar(s, sinav);
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
 * Genel konu haritasının eşikleri. Dışa aktarılıyor: panel (grup raporunun
 * ısı haritası lejantı) ve öbür ekranlar sayıyı elle yazmasın; burada
 * değişince her yerde değişsin.
 *
 * Oran eşikleri tek testin puanlamasıyla aynı (scoring.ts: %75 güçlü,
 * %45 orta); soru eşiği tek testten DAHA YÜKSEK, gerekçesi aşağıda.
 */
export const HARITA_EN_AZ_SORU = 3;
export const HARITA_GUCLU_ORAN = 0.75;
export const HARITA_ORTA_ORAN = 0.45;

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
      level:
        v.asked < HARITA_EN_AZ_SORU
          ? null
          : ratio >= HARITA_GUCLU_ORAN
            ? "STRONG"
            : ratio >= HARITA_ORTA_ORAN
              ? "MEDIUM"
              : "WEAK",
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
