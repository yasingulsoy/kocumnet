import { prisma } from "@/lib/db";
import { ayarGetir, karneBasligi, type Seviye } from "@/lib/levels";
import type { ExamScopeValue } from "@/lib/exams";

/**
 * Karne verisi.
 *
 * Üç karne de (Seviye 1 Eksik Analiz, Seviye 2 Teşhis, Nihai Rapor) aynı
 * yapıyı kullanıyor; farkları başlık, ton ve hangi bölümlerin dolu geldiği.
 * Şemanın istediği iki şey burada: **eksik kazanımlar** ve **fazla vakit
 * harcanan sorular**.
 */

export interface AsamaOzeti {
  seviye: Seviye;
  telafiMi: boolean;
  dogru: number;
  yanlis: number;
  bos: number;
  toplam: number;
  oran: number;
  sureMs: number;
}

export interface EksikKazanim {
  code: string;
  name: string;
  topicName: string;
  /** Kaç kez soruldu (ana tur + telafi), kaçında doğru. */
  soruldu: number;
  dogru: number;
}

export interface YavasSoru {
  sortOrder: number;
  seviye: Seviye;
  topicName: string;
  sureSn: number;
  hedefSn: number;
  dogruMu: boolean | null;
}

export interface SeviyeKarnesi {
  runId: string;
  examScope: ExamScopeValue;
  baslik: string;
  durum: "IN_PROGRESS" | "COMPLETED" | "STOPPED";
  ulasilanSeviye: number;
  durduguSeviye: number | null;
  asamalar: AsamaOzeti[];
  /** Seviye 1 birleşik oranı (ana tur + telafi). Kapı bu sayıya baktı. */
  seviye1Birlesik: { dogru: number; toplam: number; oran: number } | null;
  eksikKazanimlar: EksikKazanim[];
  yavasSorular: YavasSoru[];
  /** Konu bazında Seviye 2/3 başarısı — teşhis karnesi bunu gösteriyor. */
  konuDagilimi: { topicName: string; dogru: number; toplam: number }[];
}

/** Hedef sürenin bu katından uzun süren soru "yavaş" sayılır. */
const YAVAS_CARPAN = 1.3;

export async function seviyeKarnesi(
  runId: string,
  userId: string
): Promise<SeviyeKarnesi | null> {
  const run = await prisma.levelRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      userId: true,
      examScope: true,
      status: true,
      reachedLevel: true,
      stoppedAtLevel: true,
      stages: {
        where: { status: "SUBMITTED" },
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          stageLevel: true,
          stageKind: true,
          result: {
            select: {
              correctCount: true,
              wrongCount: true,
              blankCount: true,
              totalTimeMs: true,
            },
          },
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              sortOrder: true,
              question: {
                select: {
                  targetTimeSeconds: true,
                  topic: { select: { name: true } },
                  objective: {
                    select: { code: true, name: true, topic: { select: { name: true } } },
                  },
                },
              },
              answer: { select: { isCorrect: true, timeSpentMs: true } },
            },
          },
        },
      },
    },
  });

  if (!run || run.userId !== userId) return null;

  const asamalar: AsamaOzeti[] = [];
  const kazanimlar = new Map<string, EksikKazanim>();
  const yavaslar: YavasSoru[] = [];
  const konular = new Map<string, { dogru: number; toplam: number }>();

  for (const stage of run.stages) {
    if (!stage.result || !stage.stageLevel) continue;
    const seviye = stage.stageLevel as Seviye;
    const toplam =
      stage.result.correctCount + stage.result.wrongCount + stage.result.blankCount;

    asamalar.push({
      seviye,
      telafiMi: stage.stageKind === "REMEDIAL",
      dogru: stage.result.correctCount,
      yanlis: stage.result.wrongCount,
      bos: stage.result.blankCount,
      toplam,
      oran: toplam === 0 ? 0 : stage.result.correctCount / toplam,
      sureMs: stage.result.totalTimeMs,
    });

    for (const item of stage.items) {
      const dogruMu = item.answer?.isCorrect ?? null;

      // Kazanım izleme — yalnızca Seviye 1 soruları kazanıma bağlı.
      const kz = item.question.objective;
      if (kz) {
        const mevcut = kazanimlar.get(kz.code) ?? {
          code: kz.code,
          name: kz.name,
          topicName: kz.topic.name,
          soruldu: 0,
          dogru: 0,
        };
        mevcut.soruldu += 1;
        if (dogruMu === true) mevcut.dogru += 1;
        kazanimlar.set(kz.code, mevcut);
      }

      // Konu dağılımı — üst seviyelerde teşhis bunun üzerinden.
      if (seviye >= 2) {
        const ad = item.question.topic.name;
        const k = konular.get(ad) ?? { dogru: 0, toplam: 0 };
        k.toplam += 1;
        if (dogruMu === true) k.dogru += 1;
        konular.set(ad, k);
      }

      // Yavaş sorular.
      const sureMs = item.answer?.timeSpentMs ?? 0;
      const hedefMs = item.question.targetTimeSeconds * 1000;
      if (sureMs > hedefMs * YAVAS_CARPAN) {
        yavaslar.push({
          sortOrder: item.sortOrder + 1,
          seviye,
          topicName: item.question.topic.name,
          sureSn: Math.round(sureMs / 1000),
          hedefSn: item.question.targetTimeSeconds,
          dogruMu,
        });
      }
    }
  }

  // Seviye 1 birleşik oran — kapının baktığı sayı.
  const s1 = asamalar.filter((a) => a.seviye === 1);
  const seviye1Birlesik =
    s1.length > 0
      ? (() => {
          const dogru = s1.reduce((t, a) => t + a.dogru, 0);
          const toplam = s1.reduce((t, a) => t + a.toplam, 0);
          return { dogru, toplam, oran: toplam === 0 ? 0 : dogru / toplam };
        })()
      : null;

  const eksikKazanimlar = [...kazanimlar.values()]
    .filter((k) => k.dogru < k.soruldu)
    .sort((a, b) => a.dogru - b.dogru || a.topicName.localeCompare(b.topicName, "tr"));

  return {
    runId: run.id,
    examScope: run.examScope as ExamScopeValue,
    baslik: karneBasligi((run.stoppedAtLevel ?? run.reachedLevel) as Seviye, run.status),
    durum: run.status,
    ulasilanSeviye: run.reachedLevel,
    durduguSeviye: run.stoppedAtLevel,
    asamalar,
    seviye1Birlesik,
    eksikKazanimlar,
    // En yavaş 8 soru yeter: tam liste karneyi okunmaz yapıyor.
    yavasSorular: yavaslar.sort((a, b) => b.sureSn - a.sureSn).slice(0, 8),
    /*
     * En zayıf 8 konu. Tamamını listelemek raporu boğuyordu: üst
     * seviyelerde 50 soru 30'dan fazla konuya dağılıyor ve her satırda
     * 1-2 soru oluyor — o kadar az soruyla konu hakkında bir şey
     * söylenemez zaten. İki soru görülmemiş konular da eleniyor.
     */
    konuDagilimi: [...konular.entries()]
      .map(([topicName, v]) => ({ topicName, ...v }))
      .filter((k) => k.toplam >= 2)
      .sort((a, b) => a.dogru / a.toplam - b.dogru / b.toplam)
      .slice(0, 8),
  };
}

/** Bir sonraki adımın ne olduğu — deneme sayfası buna göre çiziliyor. */
export type SonrakiAdim =
  | { tur: "DEVAM_EDEN_ASAMA"; sessionId: string }
  | { tur: "TELAFI_BEKLIYOR"; kazanimSayisi: number }
  | { tur: "SEVIYE_HAZIR"; seviye: Seviye }
  | { tur: "DURDU"; seviye: Seviye }
  | { tur: "BITTI" };

export async function sonrakiAdim(runId: string, userId: string): Promise<SonrakiAdim | null> {
  const run = await prisma.levelRun.findUnique({
    where: { id: runId },
    select: {
      userId: true,
      status: true,
      unlockedLevel: true,
      stoppedAtLevel: true,
      pendingRemedialIds: true,
      examScope: true,
      stages: {
        select: { id: true, status: true, stageLevel: true, stageKind: true },
        orderBy: { startedAt: "asc" },
      },
    },
  });
  if (!run || run.userId !== userId) return null;

  const acik = run.stages.find((s) => s.status === "IN_PROGRESS");
  if (acik) return { tur: "DEVAM_EDEN_ASAMA", sessionId: acik.id };

  if (run.status === "STOPPED") {
    return { tur: "DURDU", seviye: (run.stoppedAtLevel ?? 1) as Seviye };
  }
  if (run.status === "COMPLETED") return { tur: "BITTI" };

  if (run.pendingRemedialIds.length > 0) {
    return { tur: "TELAFI_BEKLIYOR", kazanimSayisi: run.pendingRemedialIds.length };
  }

  return { tur: "SEVIYE_HAZIR", seviye: run.unlockedLevel as Seviye };
}

/** Bir seviyenin kaç soru / kaç dakika olduğu — ekranda göstermek için. */
export function seviyeOzeti(examScope: ExamScopeValue, seviye: Seviye) {
  const a = ayarGetir(examScope);
  return seviye === 1 ? a.seviye1 : seviye === 2 ? a.seviye2 : a.seviye3;
}
