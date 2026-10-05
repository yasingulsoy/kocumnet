import { prisma } from "@/lib/db";
import type { ExamScope, QuestionLevel } from "@/lib/generated/prisma/client";
import { kazanimSinavdaKosulu, soruSinavdaKosulu } from "@/lib/exam-scope";
import { EXPOSURE_WINDOW_DAYS, type SelectedQuestion } from "@/lib/question-selection";

/**
 * Seviyeli check-up için soru seçimi.
 *
 * Paket testlerinden (lib/question-selection.ts) ayrı duruyor çünkü seçim
 * ölçütü farklı: orada "bu konudan şu zorlukta N soru", burada "her
 * kazanımdan BİRER soru".
 *
 * En kritik kural telafi turunda: aynı denemede öğrenciye gösterilmiş bir
 * soru telafi turunda TEKRAR GELEMEZ. Gelirse öğrenci soruyu hatırlar,
 * ikinci turda doğru yapar ve sistem kazanımın oturduğunu sanır — ölçüm
 * olduğu yerde çöker.
 */

export interface SeviyeSecimi {
  questions: (SelectedQuestion & { objectiveId: string | null })[];
  /** Soru bulunamayan kazanımlar. Boş değilse test eksiktir. */
  eksikKazanimlar: { objectiveId: string; code: string }[];
  /** Tekrar engeli gevşetilerek doldurulan soru sayısı. */
  relaxedExposureCount: number;
}

/** Fisher-Yates — dizinin kendisini değiştirir. */
function karistir<T>(dizi: T[]): T[] {
  for (let i = dizi.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dizi[i], dizi[j]] = [dizi[j], dizi[i]];
  }
  return dizi;
}

// Sınav kapsamı: tanım lib/exam-scope.ts içinde (boş liste = KONUNUN sınavları).

/**
 * Bir sınavın yayındaki kazanımları, sıra numarasına göre.
 *
 * `examScopes` boşsa kazanım konusunun geçtiği her sınavda ölçülür —
 * sorudaki kuralla aynı (PLAN §11.1, lib/exam-scope.ts).
 */
export async function sinavinKazanimlari(examScope: string, enFazla?: number) {
  return prisma.objective.findMany({
    where: {
      status: "PUBLISHED",
      ...kazanimSinavdaKosulu(examScope as ExamScope),
    },
    // Eşitlik bozucular şart: kardeş konuların sortOrder'ı aynı olabiliyor ve
    // `enFazla` ile ilk N alınırken hangi kazanımların sorulacağı belirsiz kalıyordu.
    orderBy: [{ topic: { sortOrder: "asc" } }, { topic: { slug: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, topicId: true },
    ...(enFazla ? { take: enFazla } : {}),
  });
}

/**
 * Her kazanımdan BİR soru seçer (Seviye 1 ve telafi turu).
 *
 * @param objectiveIds Hangi kazanımlardan soru istendiği.
 * @param excludeQuestionIds Bu denemede daha önce gösterilmiş sorular.
 */
export async function kazanimBasinaBirSoru(
  objectiveIds: string[],
  examScope: string,
  userId: string,
  excludeQuestionIds: string[]
): Promise<SeviyeSecimi> {
  if (objectiveIds.length === 0) {
    return { questions: [], eksikKazanimlar: [], relaxedExposureCount: 0 };
  }

  const adaylar = await prisma.question.findMany({
    where: {
      status: "PUBLISHED",
      level: "L1_TEMEL",
      objectiveId: { in: objectiveIds },
      id: { notIn: excludeQuestionIds.length > 0 ? excludeQuestionIds : ["-"] },
      // Soru da kazanımı da bu sınavda sorulabilir olmalı. Telafi listesi
      // düzeltmeden önce açılmış bir koşudan geliyorsa bile kapsam dışı
      // kazanıma soru seçilmez (o kazanım eksik sayılır).
      AND: [
        soruSinavdaKosulu(examScope as ExamScope),
        { objective: kazanimSinavdaKosulu(examScope as ExamScope) },
      ],
    },
    select: { id: true, topicId: true, objectiveId: true, version: true },
  });

  // Son 30 günde bu öğrenciye gösterilmiş sorular — mümkünse kaçınılır.
  const gorulmus = await yakindaGorulen(
    userId,
    adaylar.map((a) => a.id)
  );

  const kazanimaGore = new Map<string, typeof adaylar>();
  for (const a of adaylar) {
    if (!a.objectiveId) continue;
    const liste = kazanimaGore.get(a.objectiveId) ?? [];
    liste.push(a);
    kazanimaGore.set(a.objectiveId, liste);
  }

  const secilen: SeviyeSecimi["questions"] = [];
  const bulunamayan: string[] = [];
  let relaxed = 0;

  for (const oid of objectiveIds) {
    const liste = kazanimaGore.get(oid);
    if (!liste || liste.length === 0) {
      bulunamayan.push(oid);
      continue;
    }

    // Önce hiç görülmemişler; hepsi görülmüşse gevşet ve say.
    const taze = karistir(liste.filter((q) => !gorulmus.has(q.id)));
    if (taze.length > 0) {
      secilen.push(taze[0]);
    } else {
      relaxed += 1;
      secilen.push(karistir([...liste])[0]);
    }
  }

  const kodlar =
    bulunamayan.length > 0
      ? await prisma.objective.findMany({
          where: { id: { in: bulunamayan } },
          select: { id: true, code: true },
        })
      : [];

  return {
    questions: karistir(secilen),
    eksikKazanimlar: kodlar.map((k) => ({ objectiveId: k.id, code: k.code })),
    relaxedExposureCount: relaxed,
  };
}

/**
 * Seviye 2 ve 3 için soru seçimi — kazanım değil SEVİYE ölçütü.
 *
 * Bu seviyelerde soru zaten birden fazla kazanımı birlikte ölçüyor; tek
 * kazanıma bağlamak yanlış olurdu.
 */
export async function seviyeSorulari(
  level: QuestionLevel,
  adet: number,
  examScope: string,
  userId: string,
  excludeQuestionIds: string[]
): Promise<SeviyeSecimi> {
  const adaylar = await prisma.question.findMany({
    where: {
      status: "PUBLISHED",
      level,
      id: { notIn: excludeQuestionIds.length > 0 ? excludeQuestionIds : ["-"] },
      ...soruSinavdaKosulu(examScope as ExamScope),
    },
    select: { id: true, topicId: true, objectiveId: true, version: true },
  });

  const gorulmus = await yakindaGorulen(
    userId,
    adaylar.map((a) => a.id)
  );

  /*
   * Konu çeşitliliği: aynı konudan art arda soru gelmesin diye önce
   * konulara göre gruplayıp sırayla topluyoruz. Düz rastgele seçimde
   * 25 sorunun 9'u aynı konudan gelebiliyordu.
   */
  const taze = karistir(adaylar.filter((q) => !gorulmus.has(q.id)));
  const eski = karistir(adaylar.filter((q) => gorulmus.has(q.id)));

  const secilen = konuyaYayarakSec(taze, adet);
  let relaxed = 0;
  if (secilen.length < adet) {
    const ek = konuyaYayarakSec(eski, adet - secilen.length);
    relaxed = ek.length;
    secilen.push(...ek);
  }

  return { questions: karistir(secilen), eksikKazanimlar: [], relaxedExposureCount: relaxed };
}

/** Konulara sırayla uğrayarak seçer — tek konunun listeyi doldurmasını engeller. */
function konuyaYayarakSec<T extends { topicId: string }>(havuz: T[], adet: number): T[] {
  const konuyaGore = new Map<string, T[]>();
  for (const q of havuz) {
    const liste = konuyaGore.get(q.topicId) ?? [];
    liste.push(q);
    konuyaGore.set(q.topicId, liste);
  }

  const kuyruklar = karistir([...konuyaGore.values()]);
  const secilen: T[] = [];
  let tur = 0;
  while (secilen.length < adet) {
    let eklendi = false;
    for (const kuyruk of kuyruklar) {
      if (tur < kuyruk.length) {
        secilen.push(kuyruk[tur]);
        eklendi = true;
        if (secilen.length === adet) break;
      }
    }
    if (!eklendi) break; // havuz tükendi
    tur += 1;
  }
  return secilen;
}

async function yakindaGorulen(userId: string, questionIds: string[]): Promise<Set<string>> {
  if (questionIds.length === 0) return new Set();
  const kesim = new Date(Date.now() - EXPOSURE_WINDOW_DAYS * 86_400_000);
  const satirlar = await prisma.questionExposure.findMany({
    where: { userId, questionId: { in: questionIds }, lastShownAt: { gt: kesim } },
    select: { questionId: true },
  });
  return new Set(satirlar.map((s) => s.questionId));
}
