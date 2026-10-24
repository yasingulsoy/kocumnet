import { prisma } from "@/lib/db";
import type { ExamScope, Prisma, QuestionLevel } from "@/lib/generated/prisma/client";
import { kazanimSinavdaKosulu, soruSinavdaKosulu } from "@/lib/exam-scope";
import type { ExamScopeValue } from "@/lib/exams";
import { S1_KAZANIM_EN_AZ_SORU, ayarGetir, type Seviye } from "@/lib/levels";
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

/** Seviye 1 sorusu: yayında, temel seviye ve bu sınavda sorulabilir. */
function s1SoruKosulu(examScope: string): Prisma.QuestionWhereInput {
  return { status: "PUBLISHED", level: "L1_TEMEL", ...soruSinavdaKosulu(examScope as ExamScope) };
}

/**
 * Bir sınavın Seviye 1'e girebilen kazanımları, sıra numarasına göre.
 *
 * Kazanım yayında olmalı, bu sınavda ölçülmeli (`examScopes` boşsa konusunun
 * geçtiği her sınav — PLAN §11.1, lib/exam-scope.ts) ve bu sınavda sorulabilen
 * en az `S1_KAZANIM_EN_AZ_SORU` yayında L1 sorusu olmalı.
 *
 * ÖNCE SÜZ, SONRA AL: eskiden ilk N kazanım alınıyor, sorusu olmayanlar
 * soru seçiminde sessizce düşüyordu; 50 soruluk aşama 32 soruyla açılıyor,
 * öğrenci sorulmayan kazanımları hiç görmüyordu. Panelin hazırlık sayacı
 * (admin pool.ts seviyeliHazirlikSorgusu) aynı süzgeç ve aynı sırayla sayar.
 *
 * Sıra şimdilik konu sırası → konu slug'ı → kazanım sırası → kod (hocaya
 * soruldu; değişirse pool.ts'teki ROW_NUMBER da değişmeli).
 */
export async function sinavinKazanimlari(examScope: string, enFazla?: number) {
  const [kazanimlar, sayimlar] = await Promise.all([
    prisma.objective.findMany({
      where: {
        status: "PUBLISHED",
        ...kazanimSinavdaKosulu(examScope as ExamScope),
      },
      // Eşitlik bozucular şart: kardeş konuların sortOrder'ı aynı olabiliyor ve
      // `enFazla` ile ilk N alınırken hangi kazanımların sorulacağı belirsiz kalıyordu.
      orderBy: [{ topic: { sortOrder: "asc" } }, { topic: { slug: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, topicId: true },
    }),
    prisma.question.groupBy({
      by: ["objectiveId"],
      where: { ...s1SoruKosulu(examScope), objectiveId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const soruSayisi = new Map(sayimlar.map((s) => [s.objectiveId, s._count._all]));
  const yeterli = kazanimlar.filter((k) => (soruSayisi.get(k.id) ?? 0) >= S1_KAZANIM_EN_AZ_SORU);
  return enFazla ? yeterli.slice(0, enFazla) : yeterli;
}

export interface SeviyeHazirligi {
  seviye: Seviye;
  /** Seviye 1'de sorulabilen kazanım, 2-3'te sorulabilen soru. */
  mevcut: number;
  gerekli: number;
}

export interface SeviyeliHazirlik {
  /** Üç seviyenin ana aşaması da tam sayıyla açılabiliyor mu. */
  hazir: boolean;
  seviyeler: [SeviyeHazirligi, SeviyeHazirligi, SeviyeHazirligi];
}

/**
 * Seviyeli check-up bu sınav için açılabilir mi — ÜÇ SEVİYENİN havuzu birlikte.
 *
 * Koşu başlarken denetlenir (lib/level-run.ts); katalog, /seviyeli sayfası
 * ve tohum (paketi taslakta bırakmak için) aynı fonksiyonu kullanır. Yalnızca
 * Seviye 1'e bakmak yetmiyordu: öğrenci 50 soruyu çözüp Seviye 2'nin
 * kapısında "havuzda soru yok" hatasıyla kalıyordu.
 *
 * Ana aşamalar tam sayıyla açılır (lib/level-run.ts). Telafi turu buraya
 * girmez: kısmi açılabilir, hiç sorusu yoksa karar onsuz verilir.
 */
export async function seviyeliHazirlik(examScope: ExamScopeValue): Promise<SeviyeliHazirlik> {
  const ayar = ayarGetir(examScope);
  const sinav = examScope as ExamScope;
  const [kazanimlar, l2, l3] = await Promise.all([
    sinavinKazanimlari(examScope),
    prisma.question.count({ where: { status: "PUBLISHED", level: "L2_ORTA", ...soruSinavdaKosulu(sinav) } }),
    prisma.question.count({ where: { status: "PUBLISHED", level: "L3_ANALIZ", ...soruSinavdaKosulu(sinav) } }),
  ]);
  const seviyeler: SeviyeliHazirlik["seviyeler"] = [
    { seviye: 1, mevcut: kazanimlar.length, gerekli: ayar.seviye1.soruSayisi },
    { seviye: 2, mevcut: l2, gerekli: ayar.seviye2.soruSayisi },
    { seviye: 3, mevcut: l3, gerekli: ayar.seviye3.soruSayisi },
  ];
  return { hazir: seviyeler.every((s) => s.mevcut >= s.gerekli), seviyeler };
}

/**
 * Kazanım başına seçimin adayları (Seviye 1 ve telafi turu): istenen
 * kazanımların bu denemede gösterilmemiş L1 soruları. Soru da kazanımı da
 * bu sınavda sorulabilir olmalı: telafi listesi düzeltmeden önce açılmış bir
 * koşudan geliyorsa bile kapsam dışı kazanıma soru seçilmez (o kazanım
 * eksik sayılır).
 */
function kazanimAdayKosulu(
  objectiveIds: string[],
  examScope: string,
  excludeQuestionIds: string[]
): Prisma.QuestionWhereInput {
  return {
    status: "PUBLISHED",
    level: "L1_TEMEL",
    objectiveId: { in: objectiveIds },
    id: { notIn: excludeQuestionIds.length > 0 ? excludeQuestionIds : ["-"] },
    AND: [soruSinavdaKosulu(examScope as ExamScope), { objective: kazanimSinavdaKosulu(examScope as ExamScope) }],
  };
}

/**
 * Teyit turunda gerçekte kaç soru sorulabilir: istenen kazanımlardan, bu
 * denemede gösterilmemiş sorusu olanların sayısı (kazanım başına bir soru).
 *
 * Kapı kararının kısa devresi (levels.ts seviye1AnaKarar `bulunabilir`) ve
 * karnedeki "N soruluk tur" metni buna bakar. Tek sorulu kazanımın yeni
 * sorusu yoktur: o kazanım turda sorulamaz.
 */
export async function telafiIcinBulunabilir(
  objectiveIds: string[],
  examScope: string,
  excludeQuestionIds: string[]
): Promise<number> {
  if (objectiveIds.length === 0) return 0;
  const gruplar = await prisma.question.groupBy({
    by: ["objectiveId"],
    where: kazanimAdayKosulu(objectiveIds, examScope, excludeQuestionIds),
  });
  return gruplar.length;
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
    where: kazanimAdayKosulu(objectiveIds, examScope, excludeQuestionIds),
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
