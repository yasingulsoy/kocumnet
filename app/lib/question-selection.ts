import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Soru seçimi — MVP'de adaptif DEĞİL, katmanlı sabit uzunluk (PLAN §5).
 *
 * Tam adaptif test (CAT) cazip ama IRT parametreleri yeterli veriyle kalibre
 * olmadan güvenilmez: az veriyle aşırı uyum yapar ve öğrenciyi yanlış seviyede
 * sabitler. Bu algoritmanın "neden bu soru geldi?" sorusuna cevabı var.
 */

/** Zorluk bantları: 1-2 kolay, 3 orta, 4-5 zor. */
const BANDS = {
  easy: { min: 1, max: 2, share: 0.3 },
  medium: { min: 3, max: 3, share: 0.5 },
  hard: { min: 4, max: 5, share: 0.2 },
} as const;

/** Aynı öğrenciye aynı soruyu bu kadar gün içinde tekrar göstermeyiz. */
export const EXPOSURE_WINDOW_DAYS = 30;

export interface SelectedQuestion {
  id: string;
  topicId: string;
  version: number;
}

export interface SelectionResult {
  questions: SelectedQuestion[];
  /** Havuz yetmediği için eksik kalan konular. Boş değilse test eksiktir. */
  shortfalls: { topicId: string; requested: number; got: number }[];
  /** Tekrar engeli gevşetilerek doldurulan soru sayısı. */
  relaxedExposureCount: number;
}

function bandTargets(total: number) {
  const easy = Math.round(total * BANDS.easy.share);
  const hard = Math.round(total * BANDS.hard.share);
  const medium = Math.max(0, total - easy - hard);
  return [
    { ...BANDS.easy, want: easy },
    { ...BANDS.medium, want: medium },
    { ...BANDS.hard, want: hard },
  ];
}

interface PickArgs {
  topicId: string;
  limit: number;
  minDifficulty: number;
  maxDifficulty: number;
  excludeIds: string[];
  /** null ise tekrar engeli uygulanmaz. */
  userId: string | null;
  exposureCutoff: Date;
}

/**
 * Rastgele seçim veritabanında yapılır: tüm havuzu belleğe çekip karıştırmak
 * havuz büyüdükçe çöker.
 */
async function pick({
  topicId,
  limit,
  minDifficulty,
  maxDifficulty,
  excludeIds,
  userId,
  exposureCutoff,
}: PickArgs): Promise<SelectedQuestion[]> {
  if (limit <= 0) return [];

  const notInChosen = excludeIds.length
    ? Prisma.sql`AND q.id NOT IN (${Prisma.join(excludeIds)})`
    : Prisma.empty;

  const notRecentlySeen = userId
    ? Prisma.sql`
        AND NOT EXISTS (
          SELECT 1 FROM "QuestionExposure" e
          WHERE e."questionId" = q.id
            AND e."userId" = ${userId}
            AND e."lastShownAt" > ${exposureCutoff}
        )`
    : Prisma.empty;

  return prisma.$queryRaw<SelectedQuestion[]>`
    SELECT q.id, q."topicId", q.version
    FROM "Question" q
    WHERE q."topicId" = ${topicId}
      AND q.status = 'PUBLISHED'
      AND q.difficulty BETWEEN ${minDifficulty} AND ${maxDifficulty}
      ${notInChosen}
      ${notRecentlySeen}
    ORDER BY random()
    LIMIT ${limit}
  `;
}

/**
 * Bir paket için soruları seçer.
 *
 * Havuz yetmezse kısıtları sırayla gevşetir: önce zorluk bandı, sonra tekrar
 * engeli. Yine de yetmezse `shortfalls` doldurulur — çağıran bunu sessizce
 * yutmamalı, eksik soruyla test başlatmak öğrenciye yanlış sonuç vermektir.
 */
export async function selectQuestionsForPackage(
  packageId: string,
  userId: string | null
): Promise<SelectionResult> {
  const packageTopics = await prisma.packageTopic.findMany({
    where: { packageId },
    orderBy: { sortOrder: "asc" },
    select: { topicId: true, questionCount: true },
  });

  const exposureCutoff = new Date(Date.now() - EXPOSURE_WINDOW_DAYS * 86_400_000);
  const chosen: SelectedQuestion[] = [];
  const shortfalls: SelectionResult["shortfalls"] = [];
  let relaxedExposureCount = 0;

  for (const pt of packageTopics) {
    const before = chosen.length;
    const topicPicked: SelectedQuestion[] = [];

    // 1. Zorluk bantlarına göre.
    for (const band of bandTargets(pt.questionCount)) {
      const rows = await pick({
        topicId: pt.topicId,
        limit: band.want,
        minDifficulty: band.min,
        maxDifficulty: band.max,
        excludeIds: chosen.concat(topicPicked).map((q) => q.id),
        userId,
        exposureCutoff,
      });
      topicPicked.push(...rows);
    }

    // 2. Eksik kaldıysa bandı gevşet (her zorluktan).
    let missing = pt.questionCount - topicPicked.length;
    if (missing > 0) {
      const rows = await pick({
        topicId: pt.topicId,
        limit: missing,
        minDifficulty: 1,
        maxDifficulty: 5,
        excludeIds: chosen.concat(topicPicked).map((q) => q.id),
        userId,
        exposureCutoff,
      });
      topicPicked.push(...rows);
    }

    // 3. Hâlâ eksikse tekrar engelini gevşet. Öğrenciye daha önce gördüğü bir
    //    soruyu göstermek, eksik test vermekten iyidir.
    missing = pt.questionCount - topicPicked.length;
    if (missing > 0 && userId) {
      const rows = await pick({
        topicId: pt.topicId,
        limit: missing,
        minDifficulty: 1,
        maxDifficulty: 5,
        excludeIds: chosen.concat(topicPicked).map((q) => q.id),
        userId: null,
        exposureCutoff,
      });
      relaxedExposureCount += rows.length;
      topicPicked.push(...rows);
    }

    chosen.push(...topicPicked);

    const got = chosen.length - before;
    if (got < pt.questionCount) {
      shortfalls.push({ topicId: pt.topicId, requested: pt.questionCount, got });
    }
  }

  return { questions: shuffle(chosen), shortfalls, relaxedExposureCount };
}

/**
 * Fisher-Yates. Sorular konu konu seçildi; karıştırmazsak öğrenci testi
 * konu blokları halinde görür ve bu ölçümü bozar (bir konuya ısınıp
 * devamını daha iyi yapar).
 */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
