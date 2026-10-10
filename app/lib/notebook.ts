import { prisma } from "@/lib/db";
import { tekrarSonrasi, yanlisKarari, yanlisSonrasi } from "@/lib/review";

/**
 * Yanlış defteri — veritabanı tarafı. Kurallar ve aralıklar lib/review.ts'te.
 *
 * Bu modül alıştırmayı bilmez (lib/practice.ts bunu çağırır, tersi değil):
 * yalnızca maddeleri yazar ve ilerletir.
 */

/** Deftere yazan oturum türleri — yalnızca ÖLÇÜMLER. Alıştırma madde açmaz. */
const OLCUM_TURLERI = new Set(["PACKAGE", "TOPIC_RETEST", "LEVEL_STAGE"]);

/**
 * Puanlanan ölçümün yanlış ve boşlarını deftere yazar.
 *
 * Yeni soru → yeni madde, ilk aralık sonra. Defterde olan soru (açık ya da
 * çıkmış) → başa döner. İDEMPOTENT: aynı oturum ikinci kez işlenirse hiçbir
 * şey değişmez; daha eski bir oturum geç puanlanırsa (cron) sonradan yapılan
 * tekrarların ilerlemesi silinmez (kurallar: yanlisKarari). Koşullar
 * güncelleme sorgusunun içinde de yazılı: aynı anda gelen bir tekrar cevabı
 * da ezilmesin.
 */
export async function defteriGuncelle(sessionId: string): Promise<{ yeni: number; sifirlanan: number }> {
  const s = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      kind: true,
      status: true,
      expiresAt: true,
      submittedAt: true,
      package: { select: { examScope: true } },
      result: { select: { examScope: true } },
      items: {
        select: {
          questionId: true,
          answer: { select: { isCorrect: true } },
          question: { select: { topicId: true, objectiveId: true } },
        },
      },
    },
  });
  if (!s || !OLCUM_TURLERI.has(s.kind) || s.status !== "SUBMITTED") return { yeni: 0, sifirlanan: 0 };

  // Ölçümün GERÇEKTEN bittiği an: süresi dolup cron'la puanlanan testte
  // cevaplar süre dolmadan verilmişti.
  const bitis = s.submittedAt ?? new Date();
  const zaman = bitis.getTime() < s.expiresAt.getTime() ? bitis : s.expiresAt;
  const examScope = s.result?.examScope ?? s.package.examScope;

  const yanlislar = s.items.filter((i) => i.answer?.isCorrect !== true);
  if (yanlislar.length === 0) return { yeni: 0, sifirlanan: 0 };

  const mevcutlar = await prisma.notebookItem.findMany({
    where: { userId: s.userId, questionId: { in: yanlislar.map((i) => i.questionId) } },
    select: { id: true, questionId: true, lastSessionId: true, lastWrongAt: true, lastReviewedAt: true },
  });
  const mevcut = new Map(mevcutlar.map((m) => [m.questionId, m]));
  const yeniDurum = yanlisSonrasi(zaman);

  const olusturulacak = [];
  const sifirlanacak = [];
  for (const i of yanlislar) {
    const karar = yanlisKarari(mevcut.get(i.questionId) ?? null, { sessionId, zaman });
    if (karar === "OLUSTUR") olusturulacak.push(i);
    else if (karar === "SIFIRLA") sifirlanacak.push({ item: i, id: mevcut.get(i.questionId)!.id });
  }

  let yeni = 0;
  if (olusturulacak.length > 0) {
    const r = await prisma.notebookItem.createMany({
      data: olusturulacak.map((i) => ({
        userId: s.userId,
        questionId: i.questionId,
        topicId: i.question.topicId,
        objectiveId: i.question.objectiveId,
        examScope,
        stage: yeniDurum.stage,
        dueAt: yeniDurum.dueAt,
        lastSessionId: sessionId,
        lastWrongAt: zaman,
      })),
      // Aynı anda puanlanan iki test aynı soruyu yazarsa biri kazanır.
      skipDuplicates: true,
    });
    yeni = r.count;
  }

  let sifirlanan = 0;
  for (const { item, id } of sifirlanacak) {
    const r = await prisma.notebookItem.updateMany({
      where: {
        id,
        lastSessionId: { not: sessionId },
        lastWrongAt: { lt: zaman },
        OR: [{ lastReviewedAt: null }, { lastReviewedAt: { lt: zaman } }],
      },
      data: {
        stage: yeniDurum.stage,
        dueAt: yeniDurum.dueAt,
        resolvedAt: null,
        lastSessionId: sessionId,
        lastWrongAt: zaman,
        wrongCount: { increment: 1 },
        topicId: item.question.topicId,
        objectiveId: item.question.objectiveId,
        examScope,
      },
    });
    sifirlanan += r.count;
  }

  return { yeni, sifirlanan };
}

export type TekrarSonucu = "ILERLEDI" | "COZULDU" | "SIFIRLANDI" | "ATLANDI";

/**
 * "Bugünkü tekrar" cevabı maddeyi ilerletir (doğru) ya da başa döndürür
 * (yanlış / "Bilmiyorum").
 *
 * Yalnızca oturum AÇILIRKEN vadesi gelmiş ve o zamandan beri tekrar
 * edilmemiş madde işlenir. Böylece aynı madde iki açık oturumda iki kez
 * ilerlemez; oturum açıldıktan sonra yeni bir ölçümde yeniden yanlış yapılan
 * (başa dönen) madde de eski oturumun cevabıyla ilerlemez.
 */
export async function tekrarIsle(args: {
  userId: string;
  /** Maddenin sorusu (alıştırmadaki sorunun kaynağı). */
  questionId: string;
  dogru: boolean;
  oturumBasi: Date;
  now: Date;
}): Promise<TekrarSonucu> {
  const { userId, questionId, dogru, oturumBasi, now } = args;
  const madde = await prisma.notebookItem.findUnique({
    where: { userId_questionId: { userId, questionId } },
    select: { id: true, stage: true },
  });
  if (!madde) return "ATLANDI";

  const sonraki = tekrarSonrasi(madde.stage, dogru, now);
  const r = await prisma.notebookItem.updateMany({
    where: {
      id: madde.id,
      stage: madde.stage,
      resolvedAt: null,
      dueAt: { lte: oturumBasi },
      OR: [{ lastReviewedAt: null }, { lastReviewedAt: { lt: oturumBasi } }],
    },
    data: {
      stage: sonraki.stage,
      dueAt: sonraki.dueAt,
      resolvedAt: sonraki.resolvedAt,
      lastReviewedAt: now,
    },
  });
  if (r.count === 0) return "ATLANDI";
  return sonraki.cozuldu ? "COZULDU" : dogru ? "ILERLEDI" : "SIFIRLANDI";
}

/** Vadesi gelmiş açık maddeler — en eski vadeli önce (bugünkü tekrarın kaynağı). */
export async function vadesiGelenler(userId: string, now: Date, enFazla = 60) {
  return prisma.notebookItem.findMany({
    where: { userId, resolvedAt: null, dueAt: { lte: now } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    take: enFazla,
    select: {
      id: true,
      examScope: true,
      questionId: true,
      question: { select: { topicId: true, objectiveId: true, level: true, difficulty: true } },
    },
  });
}

/** Defter sayfası: açık maddeler (soru, konu, aşama, vade) ve çıkan madde sayısı. */
export async function defterListesi(userId: string) {
  const [acik, cozulen] = await Promise.all([
    prisma.notebookItem.findMany({
      where: { userId, resolvedAt: null },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: 300,
      select: {
        id: true,
        questionId: true,
        stage: true,
        dueAt: true,
        wrongCount: true,
        examScope: true,
        lastSessionId: true,
        lastWrongAt: true,
        topic: { select: { id: true, name: true, sortOrder: true } },
        question: {
          select: {
            id: true,
            stem: true,
            topicId: true,
            objectiveId: true,
            level: true,
            difficulty: true,
          },
        },
      },
    }),
    prisma.notebookItem.count({ where: { userId, resolvedAt: { not: null } } }),
  ]);
  return { acik, cozulen };
}
