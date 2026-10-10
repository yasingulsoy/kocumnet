import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { konuSinavdaMi } from "@/lib/exam-scope";

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
  /**
   * Sınav kapsamı. Soru `examScopes` doluysa yalnızca listelediği sınavlarda
   * çıkar; boşsa KONUSUNUN sınavlarında (lib/exam-scope.ts). Eskiden kapsama
   * hiç bakılmıyordu: "yalnızca AYT" diye işaretlenmiş bir türev sorusu LGS
   * testine düşebiliyordu.
   */
  examScope: string | null;
  /**
   * Kapsamı boş sorular bu sınavda geçerli mi — yani konu bu sınavda mı.
   * Konu sabit olduğu için çağıran bir kez hesaplar.
   */
  bosKapsamGecerli: boolean;
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
  examScope,
  bosKapsamGecerli,
}: PickArgs): Promise<SelectedQuestion[]> {
  if (limit <= 0) return [];

  const scopeMatches = !examScope
    ? Prisma.empty
    : bosKapsamGecerli
      ? Prisma.sql`AND (cardinality(q."examScopes") = 0 OR ${examScope}::"ExamScope" = ANY(q."examScopes"))`
      : Prisma.sql`AND ${examScope}::"ExamScope" = ANY(q."examScopes")`;

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
      ${scopeMatches}
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
  const [paket, packageTopics] = await Promise.all([
    prisma.package.findUnique({ where: { id: packageId }, select: { examScope: true } }),
    prisma.packageTopic.findMany({
      where: { packageId },
      orderBy: { sortOrder: "asc" },
      select: { topicId: true, questionCount: true },
    }),
  ]);
  const examScope: string | null = paket?.examScope ?? null;

  // Paket konuları paketin sınavında olmalı; değilse kapsamı boş sorular o
  // konudan gelmez (bugünkü katalogda böyle bir paket konusu yok).
  const konular = examScope
    ? await prisma.topic.findMany({
        where: { id: { in: packageTopics.map((pt) => pt.topicId) } },
        select: { id: true, examScope: true, examScopes: true },
      })
    : [];
  const sinavdakiKonular = new Set(
    konular.filter((k) => konuSinavdaMi(k, examScope as string)).map((k) => k.id)
  );
  const bosKapsam = (topicId: string) => sinavdakiKonular.has(topicId);

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
        examScope,
        bosKapsamGecerli: bosKapsam(pt.topicId),
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
        examScope,
        bosKapsamGecerli: bosKapsam(pt.topicId),
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
        examScope,
        bosKapsamGecerli: bosKapsam(pt.topicId),
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
 * Tek konudan soru seçer — konu tekrar testi için.
 *
 * Paket seçiciyle aynı merdiveni kullanır (bant → bant gevşet → tekrar
 * engelini gevşet), çünkü kontrol testinin de zorluk dağılımı dengeli
 * olmalı: beş kolay soruyla "konu oturdu" demek öğrenciyi kandırmak olur.
 */
export async function selectQuestionsForTopic(
  topicId: string,
  count: number,
  userId: string | null,
  /** Öğrencinin hedef sınavı — sınava özgü işaretli sorular başka sınava gitmesin. */
  examScope: string | null = null,
  /**
   * Hiç seçilmeyecek sorular. Alıştırma bunu kullanıyor: açık bir testteki
   * soru alıştırmaya düşerse cevabı test sürerken görünür (lib/practice.ts).
   */
  haric: string[] = []
): Promise<SelectionResult> {
  const exposureCutoff = new Date(Date.now() - EXPOSURE_WINDOW_DAYS * 86_400_000);
  const secilen: SelectedQuestion[] = [];
  const dislanan = () => [...haric, ...secilen.map((q) => q.id)];
  let relaxedExposureCount = 0;

  // Konu öğrencinin sınavında değilse kapsamı boş sorular gelmez; yalnızca
  // o sınav için açıkça işaretlenmiş sorular kalır (startTopicRetest konuyu
  // ayrıca reddeder).
  const konu = examScope
    ? await prisma.topic.findUnique({
        where: { id: topicId },
        select: { examScope: true, examScopes: true },
      })
    : null;
  const bosKapsamGecerli = !examScope || (konu !== null && konuSinavdaMi(konu, examScope));

  for (const band of bandTargets(count)) {
    const rows = await pick({
      topicId,
      limit: band.want,
      minDifficulty: band.min,
      maxDifficulty: band.max,
      excludeIds: dislanan(),
      userId,
      exposureCutoff,
      examScope,
      bosKapsamGecerli,
    });
    secilen.push(...rows);
  }

  let eksik = count - secilen.length;
  if (eksik > 0) {
    const rows = await pick({
      topicId,
      limit: eksik,
      minDifficulty: 1,
      maxDifficulty: 5,
      excludeIds: dislanan(),
      userId,
      exposureCutoff,
      examScope,
      bosKapsamGecerli,
    });
    secilen.push(...rows);
  }

  eksik = count - secilen.length;
  if (eksik > 0 && userId) {
    const rows = await pick({
      topicId,
      limit: eksik,
      minDifficulty: 1,
      maxDifficulty: 5,
      excludeIds: dislanan(),
      userId: null,
      exposureCutoff,
      examScope,
      bosKapsamGecerli,
    });
    relaxedExposureCount += rows.length;
    secilen.push(...rows);
  }

  const shortfalls =
    secilen.length < count ? [{ topicId, requested: count, got: secilen.length }] : [];

  return { questions: shuffle(secilen), shortfalls, relaxedExposureCount };
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
