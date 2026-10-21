import { prisma } from "@/lib/db";
import type { ReportReason } from "@/lib/generated/prisma/enums";
import { gunBasi } from "@/lib/review";
import {
  BildirimHatasi,
  GUNLUK_RAPOR_SINIRI,
  RAPOR_ACIKLAMA_SINIRI,
  type RaporDurumu,
} from "@/lib/bildirim-kurallari";

/**
 * "Bu soruda hata var" — öğrenci bildirimi (QuestionNote, kind STUDENT_REPORT).
 *
 * Bildirim panelde personelin inceleme listesine düşer; öğrenci yalnızca
 * KENDİ bildiriminin durumunu görür (açık: inceleniyor, resolvedAt dolu:
 * incelendi). Personel notları öğrenciye hiçbir yoldan gitmez.
 */

/**
 * Öğrenci bu soruyu GERÇEKTEN gördü mü — bildirim ve koça soru için kapı.
 *
 * Görülmüş sayılan: öğrencinin BİTMİŞ bir ölçümündeki soru (sonuç ekranında
 * çözümüyle gördü) ya da CEVAPLADIĞI bir alıştırma sorusu. Süren testteki
 * soru sayılmaz: orada "hata var" düğmesi yok, olmamalı da. Bu kapı soru
 * kimliği tahmin edilerek yapılan yoklamayı da kapatıyor: görmediğin
 * sorunun var olup olmadığını bu yoldan öğrenemezsin (ret iletisi ikisinde
 * de aynı).
 *
 * `sessionId` verilirse soru o oturumda görülmüş olmalı (bağlam doğru olsun).
 */
export async function soruyuGordu(userId: string, questionId: string, sessionId: string | null): Promise<boolean> {
  const item = await prisma.sessionItem.findFirst({
    where: {
      questionId,
      ...(sessionId ? { sessionId } : {}),
      session: { userId },
      OR: [
        { session: { kind: { not: "PRACTICE" }, status: { not: "IN_PROGRESS" } } },
        { session: { kind: "PRACTICE" }, answer: { isNot: null } },
      ],
    },
    select: { id: true },
  });
  return item !== null;
}

/** Ret iletisi tek: "görmedin" ile "böyle bir soru yok" ayırt edilmesin. */
const GORULMEDI = "Bu soru için bildirim açılamıyor.";

/**
 * Bildirim açar. Aynı soruda açık bildirimi varken ikincisi açılmaz; bir
 * Türkiye gününde en fazla GUNLUK_RAPOR_SINIRI bildirim. Sayım ve yazım aynı
 * işlemde, öğrencinin satırı kilitli: çift dokunuş iki bildirim açmasın.
 */
export async function hataBildir(args: {
  userId: string;
  questionId: string;
  sessionId: string;
  reason: ReportReason;
  body: string;
  now?: Date;
}): Promise<{ id: string }> {
  const { userId, questionId, sessionId, reason } = args;
  const now = args.now ?? new Date();
  const body = args.body.trim();
  if (body.length > RAPOR_ACIKLAMA_SINIRI) {
    throw new BildirimHatasi(`Açıklama en fazla ${RAPOR_ACIKLAMA_SINIRI} karakter olabilir.`);
  }
  if (!(await soruyuGordu(userId, questionId, sessionId))) throw new BildirimHatasi(GORULMEDI);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const acik = await tx.questionNote.findFirst({
      where: { kind: "STUDENT_REPORT", reportedById: userId, questionId, resolvedAt: null },
      select: { id: true },
    });
    if (acik) throw new BildirimHatasi("Bu soru için bildirimin inceleniyor. Sonuçlanınca burada görürsün.");
    const bugun = await tx.questionNote.count({
      where: { kind: "STUDENT_REPORT", reportedById: userId, createdAt: { gte: gunBasi(now) } },
    });
    if (bugun >= GUNLUK_RAPOR_SINIRI) {
      throw new BildirimHatasi(`Bugün ${GUNLUK_RAPOR_SINIRI} bildirim gönderdin. Yarın devam edebilirsin; teşekkürler!`);
    }
    return tx.questionNote.create({
      data: { questionId, kind: "STUDENT_REPORT", reportedById: userId, reason, sessionId, body, createdAt: now },
      select: { id: true },
    });
  });
}

/**
 * Öğrencinin bu sorulardaki bildirim durumu. Açık bildirimi olan soru
 * "inceleniyor"; yalnızca kapanmış bildirimi olan "incelendi"; hiç
 * bildirmediği soru haritada yok.
 */
export async function raporDurumlari(userId: string, questionIds: string[]): Promise<Map<string, RaporDurumu>> {
  const sonuc = new Map<string, RaporDurumu>();
  if (questionIds.length === 0) return sonuc;
  const satirlar = await prisma.questionNote.findMany({
    where: { kind: "STUDENT_REPORT", reportedById: userId, questionId: { in: [...new Set(questionIds)] } },
    select: { questionId: true, resolvedAt: true },
  });
  for (const s of satirlar) {
    if (s.resolvedAt === null) sonuc.set(s.questionId, "INCELENIYOR");
    else if (!sonuc.has(s.questionId)) sonuc.set(s.questionId, "INCELENDI");
  }
  return sonuc;
}
