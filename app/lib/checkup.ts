import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseQuestionContent, type QuestionContent } from "@/lib/question-content";
import { selectQuestionsForPackage, selectQuestionsForTopic } from "@/lib/question-selection";
import { scoreCheckup, type ScoredAnswer, type CheckupScore } from "@/lib/scoring";
import { checkPackageAccess } from "@/lib/entitlements";
import { planOlustur, retestIsiniKapat } from "@/lib/plan";

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
    /*
     * Süresi geçmiş oturum ÇÖPE ATILMIYOR, puanlanıyor.
     *
     * Eskiden doğrudan EXPIRED işaretleniyordu: 24 sorunun 20'sini
     * cevaplayıp sekmeyi kapatan öğrenci hiçbir şey alamıyordu — ne sonuç,
     * ne konu haritası. Cevaplar veritabanında duruyordu ama kimse
     * hesaplamıyordu.
     */
    await submitCheckup(existing.id, userId).catch(async () => {
      await prisma.checkupSession.update({
        where: { id: existing.id },
        data: { status: "EXPIRED" },
      });
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
        // Havuz darlığı yüzünden tekrar gösterilmek zorunda kalınan soru
        // sayısı: sonuç ekranındaki "tekrar çöz" tavsiyesi buna bakıyor.
        relaxedExposureCount: selection.relaxedExposureCount ?? 0,
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

    /*
     * Tekrar kaydı: aynı soru 30 gün içinde tekrar gelmesin.
     *
     * Tek tek upsert 24 ayrı gidiş-dönüş demekti ve hepsi de etkileşimli
     * işlemin içindeydi; yavaş bağlantıda Prisma'nın 5 sn'lik işlem sınırına
     * dayanıp testin başlamasını engelliyordu. Önce toplu güncelleme, sonra
     * yalnızca eksikler için toplu ekleme: en fazla iki sorgu.
     */
    const questionIds = selection.questions.map((q) => q.id);
    await tx.questionExposure.updateMany({
      where: { userId, questionId: { in: questionIds } },
      data: { lastShownAt: now, showCount: { increment: 1 } },
    });
    const mevcutlar = await tx.questionExposure.findMany({
      where: { userId, questionId: { in: questionIds } },
      select: { questionId: true },
    });
    const varOlan = new Set(mevcutlar.map((e) => e.questionId));
    const yeniler = questionIds.filter((id) => !varOlan.has(id));
    if (yeniler.length > 0) {
      await tx.questionExposure.createMany({
        data: yeniler.map((questionId) => ({ userId, questionId, lastShownAt: now })),
        skipDuplicates: true,
      });
    }

    return session.id;
  });
}

/**
 * Konu tekrar testi başlatır — plandaki "kanıt" adımı.
 *
 * 5 soru, 8 dakika, tek konu. Öğrenci 40 soru çözdüğünü söyleyebilir ama
 * kontrol testini geçemez; planın dürüst kalmasını sağlayan şey bu.
 */
/** 24 saatte en fazla kaç konu tekrar testi. */
export const GUNLUK_TEKRAR_SINIRI = 8;

export async function startTopicRetest(
  userId: string,
  topicId: string,
  examScope: string
): Promise<string> {
  const paket = await prisma.package.findFirst({
    where: { kind: "RETEST", examScope: examScope as never, status: "PUBLISHED" },
    select: { id: true, questionCount: true, durationMinutes: true, penaltyRatio: true },
  });
  if (!paket) throw new CheckupError("Bu sınav için konu tekrar testi tanımlı değil.");

  const konu = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, name: true },
  });
  if (!konu) throw new CheckupError("Konu bulunamadı.");

  const now = new Date();

  /*
   * Kontrol testi yalnızca ÖLÇÜLMÜŞ konuda açılır.
   *
   * İki sebep var. Ürün sebebi: "kontrol" demek, daha önce ölçülen bir şeyi
   * yeniden ölçmek demek; hiç girmediğin konuda kontrol testi yoktur.
   * Güvenlik sebebi: bu uç nokta paket erişim hakkına bakmıyor (tekrar testi
   * bir paket satın alımı değil). Denetimsiz bırakılsaydı, herhangi bir
   * öğrenci istediği konu kimliğiyle çağırarak ücretli havuzdan beşer beşer
   * soru çekebilirdi.
   */
  const olculdu = await prisma.sessionItem.findFirst({
    where: {
      session: { userId, status: "SUBMITTED" },
      question: { topicId },
    },
    select: { id: true },
  });
  if (!olculdu) {
    throw new CheckupError(
      `${konu.name} konusunu henüz ölçmedik. Önce bu konuyu içeren bir check-up çöz.`
    );
  }

  /*
   * Günlük sınır: hem havuzu korur hem de öğrenciyi korur. Günde on kontrol
   * testi çözmek "çalışmak" değil, çalışmaktan kaçmanın rahat yolu.
   */
  const bugun = await prisma.checkupSession.count({
    where: {
      userId,
      kind: "TOPIC_RETEST",
      startedAt: { gt: new Date(now.getTime() - 24 * 3600_000) },
    },
  });
  if (bugun >= GUNLUK_TEKRAR_SINIRI) {
    throw new CheckupError(
      "Bugünlük kontrol testi hakkın doldu. Aradaki zamanı konuyu çalışmaya ayır, yarın ölçeriz."
    );
  }

  // Aynı konuda açık bir tekrar testi varsa ona devam et.
  const acik = await prisma.checkupSession.findFirst({
    where: {
      userId,
      kind: "TOPIC_RETEST",
      focusTopicId: topicId,
      status: "IN_PROGRESS",
      expiresAt: { gt: now },
    },
    select: { id: true },
  });
  if (acik) return acik.id;

  const secim = await selectQuestionsForTopic(topicId, paket.questionCount, userId);
  if (secim.questions.length < paket.questionCount) {
    throw new CheckupError(
      `${konu.name} konusunda kontrol testi için yeterli soru yok (${secim.questions.length}/${paket.questionCount}).`
    );
  }

  const expiresAt = new Date(now.getTime() + paket.durationMinutes * 60_000);

  return prisma.$transaction(async (tx) => {
    const session = await tx.checkupSession.create({
      data: {
        userId,
        packageId: paket.id,
        kind: "TOPIC_RETEST",
        focusTopicId: topicId,
        status: "IN_PROGRESS",
        durationMinutes: paket.durationMinutes,
        penaltyRatio: paket.penaltyRatio,
        relaxedExposureCount: secim.relaxedExposureCount,
        startedAt: now,
        expiresAt,
        items: {
          create: secim.questions.map((q, i) => ({
            questionId: q.id,
            sortOrder: i,
            questionVersion: q.version,
          })),
        },
      },
      select: { id: true },
    });

    const ids = secim.questions.map((q) => q.id);
    await tx.questionExposure.updateMany({
      where: { userId, questionId: { in: ids } },
      data: { lastShownAt: now, showCount: { increment: 1 } },
    });
    const mevcut = await tx.questionExposure.findMany({
      where: { userId, questionId: { in: ids } },
      select: { questionId: true },
    });
    const varOlan = new Set(mevcut.map((e) => e.questionId));
    const yeniler = ids.filter((id) => !varOlan.has(id));
    if (yeniler.length > 0) {
      await tx.questionExposure.createMany({
        data: yeniler.map((questionId) => ({ userId, questionId, lastShownAt: now })),
        skipDuplicates: true,
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

  /*
   * Tek upsert: eskiden "cevap var mı" diye okuyup ona göre create/update
   * yapılıyordu. Hızlı iki dokunuşta iki istek de "yok" görüp create deniyor
   * ve ikincisi benzersizlik hatasıyla düşüyordu — öğrencinin işareti
   * sessizce kayboluyordu.
   */
  await prisma.answer.upsert({
    where: { sessionItemId: item.id },
    create: { sessionItemId: item.id, choiceId, isCorrect, timeSpentMs },
    update: {
      choiceId,
      isCorrect,
      timeSpentMs,
      changedCount: { increment: 1 },
      answeredAt: new Date(),
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Bitir
// ─────────────────────────────────────────────────────────────

/**
 * Bitirirken istemcinin biriktirdiği soru sürelerini birleştirir.
 *
 * Neden gerekli: süre yalnızca şık işaretlenince sunucuya gidiyor. Hiç
 * dokunulmamış bir soruda 4 dakika geçirip boş bırakan öğrencinin o 4
 * dakikası kayboluyordu — "hangi konuda yavaşsın" analizi de, toplam süre de
 * eksik çıkıyordu. Boş cevap satırı açmak boşluğu bozmaz: isCorrect null
 * kaldığı için puanlama onu hâlâ boş sayar (scoreCheckup).
 *
 * İstemciye güvenmiyoruz: değerler oturum süresiyle sınırlanıyor ve mevcut
 * kayıttan küçükse yazılmıyor.
 */
async function sureleriBirlestir(
  sessionId: string,
  sinirMs: number,
  times: Record<string, number>
): Promise<void> {
  const items = await prisma.sessionItem.findMany({
    where: { sessionId, questionId: { in: Object.keys(times) } },
    select: { id: true, questionId: true, answer: { select: { timeSpentMs: true } } },
  });

  const guncellenecek: { id: string; ms: number }[] = [];
  const olusturulacak: { sessionItemId: string; timeSpentMs: number }[] = [];

  for (const item of items) {
    const ms = Math.min(Math.max(0, Math.round(times[item.questionId] ?? 0)), sinirMs);
    if (ms <= 0) continue;
    if (!item.answer) olusturulacak.push({ sessionItemId: item.id, timeSpentMs: ms });
    else if (ms > item.answer.timeSpentMs) guncellenecek.push({ id: item.id, ms });
  }

  await Promise.all([
    olusturulacak.length > 0
      ? prisma.answer.createMany({ data: olusturulacak, skipDuplicates: true })
      : null,
    ...guncellenecek.map((g) =>
      prisma.answer.update({ where: { sessionItemId: g.id }, data: { timeSpentMs: g.ms } })
    ),
  ]);
}

/**
 * Testi kapatır ve sonucu hesaplar. Süre dolmuşsa da çalışır (otomatik bitiş):
 * öğrencinin cevapları kaybolmaz.
 */
export async function submitCheckup(
  sessionId: string,
  userId: string,
  times?: Record<string, number>
): Promise<CheckupScore> {
  if (times && Object.keys(times).length > 0) {
    const oturum = await prisma.checkupSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true, durationMinutes: true },
    });
    // Sessizce geçiyoruz: süre birleştirme başarısız olsa bile test bitmeli.
    if (oturum?.userId === userId && oturum.status === "IN_PROGRESS") {
      await sureleriBirlestir(sessionId, oturum.durationMinutes * 60_000, times).catch(() => {});
    }
  }

  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      expiresAt: true,
      penaltyRatio: true,
      kind: true,
      focusTopicId: true,
      package: { select: { examScope: true } },
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

  const simdi = new Date();

  try {
    await prisma.$transaction(async (tx) => {
    await tx.checkupSession.update({
      where: { id: sessionId },
      data: { status: "SUBMITTED", submittedAt: simdi },
    });

    await tx.checkupResult.create({
      data: {
        sessionId,
        // Pano ve gelişim ekranı toplamları sınava göre ayırabilsin:
        // LGS, TYT ve KPSS sonuçlarını tek bir çizgide toplamak anlamsız.
        examScope: session.package.examScope,
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

    /*
     * İstatistikler BİTİŞTE güncellenir (her cevap değişikliğinde saysaydık,
     * şık değiştiren öğrenci sayaçları şişirirdi) ve TOPLU yazılır: eskiden
     * 24 soru için 48'e varan ayrı sorgu tek işlemin içinde sıraya giriyordu
     * ve yavaş bağlantıda işlem zaman aşımına uğrayıp bütün bitirme geri
     * alınıyordu — öğrenci testi bitiremiyordu.
     */
    const dogruIds = session.items.filter((i) => i.answer?.isCorrect === true).map((i) => i.questionId);
    const digerIds = session.items.filter((i) => i.answer?.isCorrect !== true).map((i) => i.questionId);

    if (dogruIds.length > 0) {
      await tx.question.updateMany({
        where: { id: { in: dogruIds } },
        data: { shownCount: { increment: 1 }, correctCount: { increment: 1 } },
      });
    }
    if (digerIds.length > 0) {
      await tx.question.updateMany({
        where: { id: { in: digerIds } },
        data: { shownCount: { increment: 1 } },
      });
    }

    const secilenler = session.items
      .map((i) => i.answer?.choiceId)
      .filter((id): id is string => Boolean(id));
    if (secilenler.length > 0) {
      await tx.choice.updateMany({
        where: { id: { in: secilenler } },
        data: { chosenCount: { increment: 1 } },
      });
    }
    });
  } catch (e) {
    /*
     * ÇİFT BİTİRME: sayaç sıfıra inince otomatik bitirme ile öğrencinin
     * "Bitir" düğmesi aynı anda çalışabiliyor. İkisi de durum denetiminden
     * geçiyor, ikisi de sonucu yazmaya çalışıyor ve ikincisi benzersizlik
     * hatasıyla patlıyordu — öğrenci skoru yerine hata ekranı görüyordu.
     * Sonuç zaten yazıldıysa onu döndürmek doğru davranış.
     */
    const cakisma =
      typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
    const mevcutSonuc = cakisma
      ? await prisma.checkupResult.findUnique({ where: { sessionId } })
      : null;
    if (mevcutSonuc) return resultToScore(mevcutSonuc);
    throw e;
  }

  /*
   * Bitişten SONRA, işlemin dışında: koçluk katmanı.
   * İşlemin içine almıyoruz — plan üretimi başarısız olsa bile öğrencinin
   * sonucu yazılmış olmalı.
   */
  try {
    if (session.kind === "TOPIC_RETEST" && session.focusTopicId) {
      // Plandaki kontrol testi işini kapat (öğrenci elle işaretleyemez).
      await retestIsiniKapat({
        userId,
        topicId: session.focusTopicId,
        sessionId,
        now: simdi,
      });
    } else {
      await planOlustur({
        userId,
        sessionId,
        examScope: session.package.examScope,
        breakdown: score.topicBreakdown,
        now: simdi,
      });
    }
  } catch (e) {
    console.error("Koçluk planı üretilemedi:", e);
  }

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
