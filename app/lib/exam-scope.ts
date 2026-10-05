import type { ExamScope, Prisma } from "@/lib/generated/prisma/client";

/**
 * Sınav kapsamı — TEK tanım, bütün seçim yolları bunu kullanır.
 *
 * Konu: `Topic.examScopes` (konunun geçtiği bütün sınavlar); liste boşsa
 * konunun ana sınavı (`Topic.examScope`).
 * Kazanım ve soru: kendi `examScopes` listesi DOLUYSA o liste karar verir;
 * BOŞSA "konusunun geçtiği her sınav" (şemadaki tanım). Yönetim panelinin
 * kazanım ekranı da aynı tanımı kullanıyor.
 *
 * Eskiden boş liste "her sınav" sayılıyordu ve konuya hiç bakılmıyordu:
 * kapsamı boş bir AYT trigonometri sorusu LGS seviye 2'ye, TYT'de ölçülmüş
 * bir konunun soruları LGS kontrol testine düşebiliyordu. test:levels ve
 * test:leak ikisini de denetliyor.
 */

/** Konu bu sınavda mı (bellekteki satır için). */
export function konuSinavdaMi(
  konu: { examScope: string; examScopes: readonly string[] },
  sinav: string
): boolean {
  return konu.examScopes.length > 0 ? konu.examScopes.includes(sinav) : konu.examScope === sinav;
}

/** Konu bu sınavda mı (sorgu koşulu). */
export function konuSinavdaKosulu(sinav: ExamScope): Prisma.TopicWhereInput {
  return {
    OR: [{ examScopes: { has: sinav } }, { AND: [{ examScopes: { isEmpty: true } }, { examScope: sinav }] }],
  };
}

/** Kazanım bu sınavda ölçülür mü (sorgu koşulu). */
export function kazanimSinavdaKosulu(sinav: ExamScope): Prisma.ObjectiveWhereInput {
  return {
    OR: [
      { examScopes: { has: sinav } },
      { AND: [{ examScopes: { isEmpty: true } }, { topic: konuSinavdaKosulu(sinav) }] },
    ],
  };
}

/** Soru bu sınavda sorulabilir mi (sorgu koşulu). */
export function soruSinavdaKosulu(sinav: ExamScope): Prisma.QuestionWhereInput {
  return {
    OR: [
      { examScopes: { has: sinav } },
      { AND: [{ examScopes: { isEmpty: true } }, { topic: konuSinavdaKosulu(sinav) }] },
    ],
  };
}
