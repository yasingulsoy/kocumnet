import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseQuestionContent, type QuestionContent } from "@/lib/question-content";
import { selectQuestionsForPackage } from "@/lib/question-selection";
import { scoreCheckup, type ScoredAnswer, type CheckupScore } from "@/lib/scoring";
import { checkPackageAccess } from "@/lib/entitlements";

/**
 * Check-up akışı: başlat → cevapla → bitir.
 *
 * ⚠️ CEVAP ANAHTARI: öğrenciye giden hiçbir yapıda `isCorrect` veya `errorType`
 * bulunmaz. Bunu "alanları tek tek seçerek" sağlıyoruz; veritabanı satırını
 * asla yaymıyoruz (`...question` YAZMA). scripts/leak-test.mts bunu denetler.
 */

export class CheckupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckupError";
  }
}

// ─────────────────────────────────────────────────────────────
// Öğrenciye giden şekiller
// ─────────────────────────────────────────────────────────────

export interface StudentChoice {
  id: string;
  label: string;
  content: QuestionContent;
}

export interface StudentQuestion {
  id: string;
  order: number;
  topicName: string;
  stem: QuestionContent;
  targetTimeSeconds: number;
  choices: StudentChoice[];
  /** Öğrencinin şu anki işareti. */
  selectedChoiceId: string | null;
}

export interface StudentSession {
  id: string;
  packageName: string;
  packageSlug: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED" | "ABANDONED";
  durationMinutes: number;
  startedAt: Date;
  expiresAt: Date;
  /** Kalan süre (ms). Sunucu saatine göre — istemciye güvenilmez. */
  remainingMs: number;
  questions: StudentQuestion[];
}

// ─────────────────────────────────────────────────────────────
// Başlat
// ─────────────────────────────────────────────────────────────

/**
 * Yeni bir check-up başlatır. Aynı paket için devam eden bir oturum varsa
 * onu döndürür — öğrenci sekmeyi kapatıp geri geldiğinde testi baştan
 * başlatmak, hem soruları hem süreyi çöpe atmaktır.
 */
export async function startCheckup(userId: string, packageSlug: string): Promise<string> {
  const pkg = await prisma.package.findUnique({
    where: { slug: packageSlug },
    select: {
      id: true,
      status: true,
      questionCount: true,
      durationMinutes: true,
      penaltyRatio: true,
      isFree: true,
    },
  });

  if (!pkg) throw new CheckupError("Paket bulunamadı.");
  if (pkg.status !== "PUBLISHED") throw new CheckupError("Bu paket şu anda yayında değil.");

  // Erişim denetimi SERVİS katmanında: arayüzde kilit rozeti göstermek yetmez,
  // adres çubuğuna paket slug'ı yazan biri testi başlatabilirdi.
  const erisim = await checkPackageAccess(userId, pkg.id, pkg.isFree);
  if (!erisim.allowed) {
    throw new CheckupError("Bu paket için erişim hakkın yok.");
  }

  const now = new Date();

  const existing = await prisma.checkupSession.findFirst({
    where: { userId, packageId: pkg.id, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
    select: { id: true, expiresAt: true },
  });

  if (existing) {
    if (existing.expiresAt > now) return existing.id;
    // Süresi geçmiş: kapat, yenisini aç.
    await prisma.checkupSession.update({
      where: { id: existing.id },
      data: { status: "EXPIRED" },
    });
  }

  const selection = await selectQuestionsForPackage(pkg.id, userId);

  // Eksik soruyla test başlatmak öğrenciye yanlış sonuç vermektir (PLAN §5).
  if (selection.shortfalls.length > 0) {
    const detail = selection.shortfalls
      .map((s) => `${s.got}/${s.requested}`)
      .join(", ");
    throw new CheckupError(
      `Bu paket için soru havuzu yetersiz (${detail}). Lütfen daha sonra deneyin.`
    );
  }

  const expiresAt = new Date(now.getTime() + pkg.durationMinutes * 60_000);

  return prisma.$transaction(async (tx) => {
    const session = await tx.checkupSession.create({
      data: {
        userId,
        packageId: pkg.id,
        status: "IN_PROGRESS",
        // Paket ayarlarının kopyası: admin test ortasında paketi düzenlerse
        // puanlama değişmesin.
        durationMinutes: pkg.durationMinutes,
        penaltyRatio: pkg.penaltyRatio,
        startedAt: now,
        expiresAt,
        items: {
          create: selection.questions.map((q, i) => ({
            questionId: q.id,
            sortOrder: i,
            questionVersion: q.version,
          })),
        },
      },
      select: { id: true },
    });

    // Tekrar kaydı: aynı soru 30 gün içinde tekrar gelmesin.
    for (const q of selection.questions) {
      await tx.questionExposure.upsert({
        where: { userId_questionId: { userId, questionId: q.id } },
        create: { userId, questionId: q.id },
        update: { lastShownAt: now, showCount: { increment: 1 } },
      });
    }

    return session.id;
  });
}

// ─────────────────────────────────────────────────────────────
// Oku
// ─────────────────────────────────────────────────────────────

export async function getStudentSession(
  sessionId: string,
  userId: string
): Promise<StudentSession> {
  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      durationMinutes: true,
      startedAt: true,
      expiresAt: true,
      package: { select: { name: true, slug: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          question: {
            select: {
              id: true,
              stem: true,
              targetTimeSeconds: true,
              topic: { select: { name: true } },
              choices: {
                orderBy: { sortOrder: "asc" },
                // ⚠️ isCorrect ve errorType BİLİNÇLİ OLARAK YOK.
                select: { id: true, label: true, content: true },
              },
            },
          },
          answer: { select: { choiceId: true } },
        },
      },
    },
  });

  if (!session) throw new CheckupError("Oturum bulunamadı.");
  // Başkasının oturumu: "bulunamadı" diyoruz, "yetkiniz yok" demiyoruz —
  // ikincisi oturumun var olduğunu doğrular.
  if (session.userId !== userId) throw new CheckupError("Oturum bulunamadı.");

  return {
    id: session.id,
    packageName: session.package.name,
    packageSlug: session.package.slug,
    status: session.status,
    durationMinutes: session.durationMinutes,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    remainingMs: Math.max(0, session.expiresAt.getTime() - Date.now()),
    questions: session.items.map((item) => ({
      id: item.question.id,
      order: item.sortOrder,
      topicName: item.question.topic.name,
      stem: parseQuestionContent(item.question.stem),
      targetTimeSeconds: item.question.targetTimeSeconds,
      choices: item.question.choices.map((c) => ({
        id: c.id,
        label: c.label,
        content: parseQuestionContent(c.content),
      })),
      selectedChoiceId: item.answer?.choiceId ?? null,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// Cevapla
// ─────────────────────────────────────────────────────────────

/**
 * Cevabı kaydeder. Doğruluk SUNUCUDA hesaplanır.
 * `choiceId: null` işareti kaldırmak (boş bırakmak) demektir.
 */
export async function saveAnswer(args: {
  sessionId: string;
  userId: string;
  questionId: string;
  choiceId: string | null;
  timeSpentMs: number;
}): Promise<void> {
  const { sessionId, userId, questionId, choiceId, timeSpentMs } = args;

  const item = await prisma.sessionItem.findFirst({
    where: { sessionId, questionId, session: { userId } },
    select: {
      id: true,
      session: { select: { status: true, expiresAt: true } },
      answer: { select: { id: true } },
    },
  });

  if (!item) throw new CheckupError("Soru bu oturuma ait değil.");
  if (item.session.status !== "IN_PROGRESS") throw new CheckupError("Bu test kapandı.");
  if (item.session.expiresAt < new Date()) throw new CheckupError("Süre doldu.");

  let isCorrect: boolean | null = null;
  if (choiceId) {
    // Şık gerçekten bu soruya mı ait? Aksi halde başka bir sorunun doğru
    // şıkkının id'si gönderilerek puan alınabilir.
    const choice = await prisma.choice.findFirst({
      where: { id: choiceId, questionId },
      select: { isCorrect: true },
    });
    if (!choice) throw new CheckupError("Geçersiz şık.");
    isCorrect = choice.isCorrect;
  }

  if (item.answer) {
    await prisma.answer.update({
      where: { id: item.answer.id },
      data: {
        choiceId,
        isCorrect,
        timeSpentMs,
        changedCount: { increment: 1 },
        answeredAt: new Date(),
      },
    });
  } else {
    await prisma.answer.create({
      data: { sessionItemId: item.id, choiceId, isCorrect, timeSpentMs },
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Bitir
// ─────────────────────────────────────────────────────────────

/**
 * Testi kapatır ve sonucu hesaplar. Süre dolmuşsa da çalışır (otomatik bitiş):
 * öğrencinin cevapları kaybolmaz.
 */
export async function submitCheckup(sessionId: string, userId: string): Promise<CheckupScore> {
  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      expiresAt: true,
      penaltyRatio: true,
      items: {
        select: {
          questionId: true,
          question: {
            select: {
              targetTimeSeconds: true,
              topic: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  recommendedProductIds: true,
                  parent: { select: { id: true, slug: true, name: true } },
                },
              },
            },
          },
          answer: { select: { isCorrect: true, timeSpentMs: true, choiceId: true } },
        },
      },
    },
  });

  if (!session) throw new CheckupError("Oturum bulunamadı.");
  if (session.userId !== userId) throw new CheckupError("Oturum bulunamadı.");

  if (session.status !== "IN_PROGRESS") {
    const existing = await prisma.checkupResult.findUnique({ where: { sessionId } });
    if (existing) return resultToScore(existing);
    throw new CheckupError("Bu test kapandı.");
  }

  const scored: ScoredAnswer[] = session.items.map((item) => ({
    topicId: item.question.topic.id,
    topicSlug: item.question.topic.slug,
    topicName: item.question.topic.name,
    parentId: item.question.topic.parent?.id ?? null,
    parentSlug: item.question.topic.parent?.slug ?? null,
    parentName: item.question.topic.parent?.name ?? null,
    // Cevap satırı yoksa boş bırakılmış demektir.
    isCorrect: item.answer?.isCorrect ?? null,
    timeSpentMs: item.answer?.timeSpentMs ?? 0,
    targetTimeSeconds: item.question.targetTimeSeconds,
    recommendedProductIds: item.question.topic.recommendedProductIds,
  }));

  const score = scoreCheckup(scored, Number(session.penaltyRatio));

  await prisma.$transaction(async (tx) => {
    await tx.checkupSession.update({
      where: { id: sessionId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    await tx.checkupResult.create({
      data: {
        sessionId,
        correctCount: score.correctCount,
        wrongCount: score.wrongCount,
        blankCount: score.blankCount,
        netScore: score.netScore.toFixed(2),
        totalTimeMs: score.totalTimeMs,
        // Prisma'nın Json girişi indeks imzalı bir tip bekliyor; arayüzümüze
        // indeks imzası eklemek her alanı `unknown` yapardı. Dönüşüm sadece
        // bu sınırda.
        topicBreakdown: score.topicBreakdown as unknown as Prisma.InputJsonValue,
        recommendedProductIds: score.recommendedProductIds,
        scoringVersion: score.scoringVersion,
      },
    });

    // İstatistikler BİTİŞTE güncellenir. Her cevap değişikliğinde saysaydık,
    // şık değiştiren öğrenci sayaçları şişirirdi.
    for (const item of session.items) {
      await tx.question.update({
        where: { id: item.questionId },
        data: {
          shownCount: { increment: 1 },
          correctCount: { increment: item.answer?.isCorrect === true ? 1 : 0 },
        },
      });
      if (item.answer?.choiceId) {
        await tx.choice.update({
          where: { id: item.answer.choiceId },
          data: { chosenCount: { increment: 1 } },
        });
      }
    }
  });

  return score;
}

function resultToScore(r: {
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  netScore: unknown;
  totalTimeMs: number;
  topicBreakdown: unknown;
  recommendedProductIds: string[];
  scoringVersion: number;
}): CheckupScore {
  return {
    correctCount: r.correctCount,
    wrongCount: r.wrongCount,
    blankCount: r.blankCount,
    netScore: Number(r.netScore),
    totalTimeMs: r.totalTimeMs,
    topicBreakdown: r.topicBreakdown as CheckupScore["topicBreakdown"],
    recommendedProductIds: r.recommendedProductIds,
    scoringVersion: r.scoringVersion,
  };
}


// ─────────────────────────────────────────────────────────────
// İnceleme (test bittikten SONRA)
// ─────────────────────────────────────────────────────────────

export interface ReviewChoice {
  id: string;
  label: string;
  content: QuestionContent;
  isCorrect: boolean;
  errorType: string | null;
}

export interface ReviewItem {
  order: number;
  topicName: string;
  stem: QuestionContent;
  solution: QuestionContent | null;
  choices: ReviewChoice[];
  selectedChoiceId: string | null;
  isCorrect: boolean | null;
  timeSpentMs: number;
  targetTimeSeconds: number;
}

/**
 * Cevap incelemesi — cevap anahtarını İÇERİR.
 *
 * ⚠️ getStudentSession ile karıştırma. Bu fonksiyon yalnızca BİTMİŞ oturumlar
 * için çalışır; devam eden bir testte çağrılırsa hata fırlatır. Kontrol
 * "durum SUBMITTED mi" şeklinde değil, "IN_PROGRESS DEĞİL mi" şeklinde:
 * ileride yeni bir durum eklenirse varsayılan güvenli tarafta kalsın.
 *
 * scripts/leak-test.mts hem sızıntıyı hem bu kapıyı denetliyor.
 */
export async function getCheckupReview(
  sessionId: string,
  userId: string
): Promise<ReviewItem[]> {
  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      status: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          question: {
            select: {
              stem: true,
              solution: true,
              targetTimeSeconds: true,
              topic: { select: { name: true } },
              choices: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, label: true, content: true, isCorrect: true, errorType: true },
              },
            },
          },
          answer: { select: { choiceId: true, isCorrect: true, timeSpentMs: true } },
        },
      },
    },
  });

  if (!session || session.userId !== userId) throw new CheckupError("Oturum bulunamadı.");
  if (session.status === "IN_PROGRESS") {
    throw new CheckupError("Test bitmeden cevaplar gösterilmez.");
  }

  return session.items.map((item) => ({
    order: item.sortOrder,
    topicName: item.question.topic.name,
    stem: parseQuestionContent(item.question.stem),
    solution: item.question.solution ? parseQuestionContent(item.question.solution) : null,
    targetTimeSeconds: item.question.targetTimeSeconds,
    choices: item.question.choices.map((c) => ({
      id: c.id,
      label: c.label,
      content: parseQuestionContent(c.content),
      isCorrect: c.isCorrect,
      errorType: c.errorType,
    })),
    selectedChoiceId: item.answer?.choiceId ?? null,
    isCorrect: item.answer?.isCorrect ?? null,
    timeSpentMs: item.answer?.timeSpentMs ?? 0,
  }));
}

/** Süresi dolmuş ama bitirilmemiş oturumları kapatır ve sonuçlarını üretir. */
export async function expireStaleSessions(): Promise<number> {
  const stale = await prisma.checkupSession.findMany({
    where: { status: "IN_PROGRESS", expiresAt: { lt: new Date() } },
    select: { id: true, userId: true },
  });

  for (const s of stale) {
    try {
      await submitCheckup(s.id, s.userId);
    } catch {
      await prisma.checkupSession.update({
        where: { id: s.id },
        data: { status: "EXPIRED" },
      });
    }
  }
  return stale.length;
}
