import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Tekrar kaydı (QuestionExposure): öğrenciye gösterilen sorular.
 *
 * Seçim kodları (paket, kontrol testi, seviyeli aşama) son 30 günde
 * gösterilmiş sorulardan kaçınır; "aynı sorular gelmez" sözü bu tabloya
 * dayanıyor. Eskiden yazım iki yerde kopyaydı (paket testi, kontrol testi)
 * ve seviyeli aşama hiç yazmıyordu: Seviye 1'in 50 sorusu ertesi gün paket
 * testinde yeniden gelebiliyordu.
 *
 * Testi açan işlemin İÇİNDE çağrılır (`tx`): oturum açılmadıysa sorular
 * gösterilmiş sayılmasın. Tek tek upsert, 24 soruda 24 gidiş-dönüş demekti
 * ve hepsi etkileşimli işlemin içindeydi; yavaş bağlantıda Prisma'nın 5
 * sn'lik işlem sınırına dayanıp testin başlamasını engelliyordu. Önce
 * toplu güncelleme, sonra yalnızca eksikler için toplu ekleme: en fazla üç
 * sorgu.
 *
 * @param an Gösterim anı; verilmezse şimdi. Oturumun başlangıç anı verilirse
 *           tekrar kaydı ile oturum aynı saniyeyi taşır.
 */
export async function maruziyetiYaz(
  tx: Prisma.TransactionClient,
  userId: string,
  soruIdleri: readonly string[],
  an: Date = new Date()
): Promise<void> {
  const idler = [...new Set(soruIdleri)];
  if (idler.length === 0) return;

  await tx.questionExposure.updateMany({
    where: { userId, questionId: { in: idler } },
    data: { lastShownAt: an, showCount: { increment: 1 } },
  });
  const mevcutlar = await tx.questionExposure.findMany({
    where: { userId, questionId: { in: idler } },
    select: { questionId: true },
  });
  const varOlan = new Set(mevcutlar.map((e) => e.questionId));
  const yeniler = idler.filter((id) => !varOlan.has(id));
  if (yeniler.length > 0) {
    await tx.questionExposure.createMany({
      data: yeniler.map((questionId) => ({ userId, questionId, lastShownAt: an })),
      // Aynı anda açılan iki testte aynı soru: benzersizlik hatası testi düşürmesin.
      skipDuplicates: true,
    });
  }
}
