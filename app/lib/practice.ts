import { prisma } from "@/lib/db";
import type { ExamScope, PracticeMode, QuestionLevel } from "@/lib/generated/prisma/client";
import { parseQuestionContent, type QuestionContent } from "@/lib/question-content";
import { EXPOSURE_WINDOW_DAYS, selectQuestionsForTopic } from "@/lib/question-selection";
import { konuSinavdaMi, soruSinavdaKosulu } from "@/lib/exam-scope";
import { CheckupError, KAYIT_TOLERANSI_MS, type StudentChoice } from "@/lib/checkup";
import { examShort, isExamScope } from "@/lib/exams";
import { ERROR_TYPE_LABELS } from "@/lib/error-types";
import { hataTipiTavsiyesi } from "@/lib/coaching";
import {
  ALISTIRMA_OMRU_SAAT,
  ASGARI_ARA_SAAT,
  BENZER_ZORLUK_FARKI,
  GUNLUK_ALISTIRMA_SORU,
  GUNLUK_TEKRAR_SORU,
  KONU_CALISMA_SORU,
  TEKRAR_ARALIKLARI_GUN,
  benzerAta,
  benzeriVar,
  gunBasi,
  vade,
  vadeMetni,
  type BenzerAday,
  type BenzerSoru,
} from "@/lib/review";
import { tekrarIsle, vadesiGelenler } from "@/lib/notebook";

/**
 * Alıştırma — ölçümün yanındaki öğrenme döngüsü.
 *
 * Sınav oturumuyla aynı makineyi (CheckupSession + SessionItem + Answer)
 * kullanır ama iki şeyi tersine çevirir:
 *
 *  1. Her cevaptan HEMEN sonra doğrusu, yanlış şıkkın hata tipi ve çözüm
 *     gösterilir. Cevap ilk kayıtta kilitlenir; çözümü gördükten sonra
 *     işaret değiştirilemez.
 *  2. Ölçüm DEĞİLDİR: sonuç satırı üretmez, soru/şık sayaçlarına, gelişime,
 *     plana, haftalık postaya, risk listelerine ve madde analizine girmez.
 *
 * ⚠️ CEVAP ANAHTARI: yalnızca CEVAPLANMIŞ alıştırma sorusunun anahtarı
 * okunur ve öğrenciye gider. Cevaplanmamış sorunun anahtarı veritabanından
 * hiç çekilmez. Açık bir sınavda da bulunan soru için anahtar açılmaz.
 * scripts/practice-test.mts bunu denetliyor.
 */

const SAAT = 3600_000;

type Sinav = ExamScope;

/** Kapsamı belirsiz eski kayıtlar ("BOTH") alıştırma açmaz. */
function sinavGecerli(scope: string | null | undefined): scope is Sinav {
  return isExamScope(scope);
}

// ─────────────────────────────────────────────────────────────
// Ortak parçalar
// ─────────────────────────────────────────────────────────────

/**
 * Sınavın alıştırma paketi — yoksa açılır.
 *
 * Oturumun bir pakete bağlanması şart (şema); alıştırmanın gerçek bir paketi
 * yok. Tohuma koymak yerine ilk kullanımda açıyoruz: üretimde tohum yalnızca
 * ilk kurulumda elle çalışıyor, unutulursa alıştırma hiç açılmazdı.
 */
async function alistirmaPaketi(examScope: Sinav): Promise<string> {
  const slug = `sistem-alistirma-${examScope.toLowerCase().replace(/_/g, "-")}`;
  const kayit = {
    name: `Alıştırma (${examShort(examScope)})`,
    summary: "Benzer soru, konu çalışması ve yanlış defteri. Ölçüm değil; katalogda görünmez.",
    kind: "PRACTICE" as const,
    examScope,
    questionCount: 0,
    durationMinutes: ALISTIRMA_OMRU_SAAT * 60,
    status: "PUBLISHED" as const,
    isFree: true,
    penaltyRatio: 0,
    sortOrder: 9000,
  };
  let paket: { id: string; kind: string } | null;
  try {
    paket = await prisma.package.upsert({
      where: { slug },
      create: { slug, ...kayit },
      update: {},
      select: { id: true, kind: true },
    });
  } catch (e) {
    // Aynı anda iki istek açmaya çalıştı: biri yazdı, öteki okusun.
    paket = await prisma.package.findUnique({ where: { slug }, select: { id: true, kind: true } });
    if (!paket) throw e;
  }
  if (paket.kind !== "PRACTICE") {
    throw new Error(`"${slug}" adresli paket bir alıştırma paketi değil.`);
  }
  return paket.id;
}

/**
 * Alıştırmaya HİÇ girmeyecekler:
 *  - öğrencinin açık (bitmemiş) oturumlarındaki sorular: açık bir sınavın
 *    sorusu alıştırmaya düşerse cevabı test sürerken görünür;
 *  - seviyeli check-up'ta teyit turu bekleyen kazanımlar: o turun "yeni
 *    soru" havuzu alıştırmada harcanmasın (lib/level-run.ts).
 */
async function korunanlar(userId: string): Promise<{ sorular: Set<string>; kazanimlar: string[] }> {
  const [acik, kosu] = await Promise.all([
    prisma.sessionItem.findMany({
      where: { session: { userId, status: "IN_PROGRESS" } },
      select: { questionId: true },
    }),
    prisma.levelRun.findFirst({
      where: { userId, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      select: { pendingRemedialIds: true },
    }),
  ]);
  return { sorular: new Set(acik.map((s) => s.questionId)), kazanimlar: kosu?.pendingRemedialIds ?? [] };
}

/** Benzer seçiminin kaynağı: soru + o sorunun sorulduğu sınav. */
export interface BenzerKaynagi extends BenzerSoru {
  examScope: Sinav;
}

/** Aday listesinin içindeki etiketli biçim (kapsamlar dolu). */
type EtiketliAday = BenzerAday & { kapsamlar: string[] };

/**
 * Kaynakların benzer adayları — tek sorgu, sınav başına.
 *
 * Kural (benzerMi) saf modülde; burada aynı kural veritabanı koşulu olarak
 * yazılı ve üstüne sınav kapsamı (lib/exam-scope.ts) ekleniyor. Aday her
 * kaynağın kendi sınavında sorulabilir olmalı; etiketi `kapsamlar`da.
 *
 * `asgariAraSaat`: son bu kadar saatte gösterilen soru hiç gelmez. Anında
 * alıştırmada ASGARI_ARA_SAAT; günlük tekrarda 0. Tekrar zaten gün sonra ve
 * vadeler gün başına yuvarlı: akşam testinden sonraki sabah tekrarı dün
 * akşam görülen soruları yasaklasaydı dar havuzda boş kalırdı. Orada "önce
 * hiç görülmemiş" tercihi yeter.
 */
export async function benzerAdaylari(
  kaynaklar: BenzerKaynagi[],
  userId: string,
  haric: ReadonlySet<string>,
  kazanimHaric: readonly string[],
  now: Date,
  asgariAraSaat: number = ASGARI_ARA_SAAT
): Promise<BenzerAday[]> {
  if (kaynaklar.length === 0) return [];

  const sinavlar = [...new Set(kaynaklar.map((k) => k.examScope))];
  const adaylar = new Map<string, EtiketliAday>();

  for (const sinav of sinavlar) {
    const grup = kaynaklar.filter((k) => k.examScope === sinav);
    const satirlar = await prisma.question.findMany({
      where: {
        status: "PUBLISHED",
        ...(haric.size > 0 ? { id: { notIn: [...haric] } } : {}),
        ...(kazanimHaric.length > 0
          ? { OR: [{ objectiveId: null }, { objectiveId: { notIn: [...kazanimHaric] } }] }
          : {}),
        AND: [
          soruSinavdaKosulu(sinav),
          {
            OR: grup.map((k) => ({
              AND: [
                k.objectiveId ? { objectiveId: k.objectiveId } : { topicId: k.topicId },
                { level: (k.level as QuestionLevel | null) ?? null },
                {
                  difficulty: {
                    gte: k.difficulty - BENZER_ZORLUK_FARKI,
                    lte: k.difficulty + BENZER_ZORLUK_FARKI,
                  },
                },
              ],
            })),
          },
        ],
      },
      select: { id: true, topicId: true, objectiveId: true, level: true, difficulty: true },
      take: 2000,
    });

    for (const s of satirlar) {
      const mevcut = adaylar.get(s.id);
      if (mevcut) {
        mevcut.kapsamlar.push(sinav);
        continue;
      }
      adaylar.set(s.id, {
        questionId: s.id,
        topicId: s.topicId,
        objectiveId: s.objectiveId,
        level: s.level,
        difficulty: s.difficulty,
        sonGosterim: null,
        kapsamlar: [sinav],
      });
    }
  }

  if (adaylar.size === 0) return [];

  // Son 30 günde gösterilenler seçimde en sona kalır (yasak değil); son
  // asgariAraSaat içinde gösterilenler hiç gelmez.
  const kesim = new Date(now.getTime() - EXPOSURE_WINDOW_DAYS * 86_400_000);
  const tazeSinir = now.getTime() - asgariAraSaat * SAAT;
  const gosterimler = await prisma.questionExposure.findMany({
    where: { userId, questionId: { in: [...adaylar.keys()] }, lastShownAt: { gt: kesim } },
    select: { questionId: true, lastShownAt: true },
  });
  for (const g of gosterimler) {
    if (g.lastShownAt.getTime() > tazeSinir) {
      adaylar.delete(g.questionId);
      continue;
    }
    const a = adaylar.get(g.questionId);
    if (a) a.sonGosterim = g.lastShownAt;
  }

  return [...adaylar.values()];
}

/** Son ASGARI_ARA_SAAT içinde bu öğrenciye gösterilen sorular. */
async function azOnceGosterilenler(userId: string, now: Date): Promise<string[]> {
  const satirlar = await prisma.questionExposure.findMany({
    where: { userId, lastShownAt: { gt: new Date(now.getTime() - ASGARI_ARA_SAAT * SAAT) } },
    select: { questionId: true },
  });
  return satirlar.map((s) => s.questionId);
}

/** Son 24 saatte kaç alıştırma sorusu açıldı (benzer + konu). */
async function kullanilanHak(userId: string, now: Date): Promise<number> {
  return prisma.sessionItem.count({
    where: {
      session: {
        userId,
        kind: "PRACTICE",
        practiceMode: { in: ["SIMILAR", "TOPIC"] },
        startedAt: { gt: new Date(now.getTime() - 24 * SAAT) },
      },
    },
  });
}

/** Bugün açılabilecek alıştırma sorusu (GUNLUK_ALISTIRMA_SORU'dan kalan). */
export async function alistirmaHakki(userId: string, now = new Date()): Promise<number> {
  return Math.max(0, GUNLUK_ALISTIRMA_SORU - (await kullanilanHak(userId, now)));
}

const HAK_DOLDU =
  "Bugünlük alıştırma hakkın doldu. Yarın devam edelim; bu arada yanlışlarının çözümlerine bak.";

/** Alıştırma oturumunu açar: sorular sabitlenir, tekrar engeli kaydı düşülür. */
async function alistirmaAc(args: {
  userId: string;
  examScope: Sinav;
  mode: PracticeMode;
  focusTopicId: string | null;
  sourceSessionId: string | null;
  sorular: { id: string; version: number; sourceQuestionId: string | null }[];
  relaxedExposureCount: number;
  now: Date;
  /** Varsayılan ALISTIRMA_OMRU_SAAT sonra. */
  expiresAt?: Date;
}): Promise<string> {
  const { userId, examScope, mode, focusTopicId, sourceSessionId, sorular, relaxedExposureCount, now } = args;
  const expiresAt = args.expiresAt ?? new Date(now.getTime() + ALISTIRMA_OMRU_SAAT * SAAT);
  const packageId = await alistirmaPaketi(examScope);

  return prisma.$transaction(async (tx) => {
    const session = await tx.checkupSession.create({
      data: {
        userId,
        packageId,
        kind: "PRACTICE",
        practiceMode: mode,
        focusTopicId,
        sourceSessionId,
        status: "IN_PROGRESS",
        durationMinutes: ALISTIRMA_OMRU_SAAT * 60,
        // Alıştırmada net yok.
        penaltyRatio: 0,
        relaxedExposureCount,
        startedAt: now,
        expiresAt,
        items: {
          create: sorular.map((q, i) => ({
            questionId: q.id,
            sortOrder: i,
            questionVersion: q.version,
            sourceQuestionId: q.sourceQuestionId,
          })),
        },
      },
      select: { id: true },
    });

    /*
     * Tekrar engeli: alıştırmada çözümü görülen soru 30 gün sınava gelmesin.
     * Gelirse öğrenci cevabı hatırlar ve ölçüm şişer.
     */
    const ids = sorular.map((q) => q.id);
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

/** Sonuç ekranından açılan alıştırmanın kaynağı: öğrencinin BİTMİŞ bir testi. */
async function kaynakOturum(userId: string, sessionId: string) {
  const s = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      kind: true,
      status: true,
      package: { select: { examScope: true } },
      result: { select: { examScope: true } },
      items: {
        select: {
          questionId: true,
          answer: { select: { isCorrect: true } },
          question: {
            select: { id: true, topicId: true, objectiveId: true, level: true, difficulty: true },
          },
        },
      },
    },
  });
  if (!s || s.userId !== userId) throw new CheckupError("Test bulunamadı.");
  if (s.kind === "PRACTICE") throw new CheckupError("Alıştırma yalnızca bir testin sonucundan açılır.");
  if (s.status === "IN_PROGRESS") throw new CheckupError("Test bitmeden alıştırma açılmaz.");
  const sinav = s.result?.examScope ?? s.package.examScope;
  if (!sinavGecerli(sinav)) throw new CheckupError("Bu testin sınavı belirsiz; alıştırma açılamıyor.");
  return { ...s, sinav };
}

// ─────────────────────────────────────────────────────────────
// "Benzerini çöz"
// ─────────────────────────────────────────────────────────────

/**
 * Sonuç ekranı için: yanlış/boş her sorunun benzeri havuzda var mı.
 * Düğme yalnızca benzeri olan soruda görünür; "ölü düğme" yok.
 */
export async function benzerDurumlari(userId: string, sessionId: string): Promise<Map<string, boolean>> {
  const s = await kaynakOturum(userId, sessionId);
  const kaynaklar: BenzerKaynagi[] = s.items
    .filter((i) => i.answer?.isCorrect !== true)
    .map((i) => ({ ...soruAlanlari(i.question), examScope: s.sinav }));
  const { sorular: korunan, kazanimlar } = await korunanlar(userId);
  // Sonuç ekranında çözümüyle görülen sorular aday değil.
  const haric = new Set([...korunan, ...s.items.map((i) => i.questionId)]);
  const adaylar = await benzerAdaylari(kaynaklar, userId, haric, kazanimlar, new Date());
  return new Map(kaynaklar.map((k) => [k.questionId, benzeriVar(k, adaylar)]));
}

function soruAlanlari(q: {
  id: string;
  topicId: string;
  objectiveId: string | null;
  level: string | null;
  difficulty: number;
}): BenzerSoru {
  return { questionId: q.id, topicId: q.topicId, objectiveId: q.objectiveId, level: q.level, difficulty: q.difficulty };
}

/**
 * Sonuçtaki bir yanlışın (ya da boşun) benzeriyle tek soruluk alıştırma açar.
 * Aynı kaynak için açık bir alıştırma varsa ona döner.
 */
export async function benzeriniCozBaslat(
  userId: string,
  sourceSessionId: string,
  questionId: string
): Promise<string> {
  const now = new Date();
  const s = await kaynakOturum(userId, sourceSessionId);
  const kaynakItem = s.items.find((i) => i.questionId === questionId);
  if (!kaynakItem) throw new CheckupError("Soru bu teste ait değil.");
  if (kaynakItem.answer?.isCorrect === true) {
    throw new CheckupError("Bu soruyu doğru yaptın; benzer soru yanlışların ve boşların için.");
  }

  // Geri tuşu ya da çift dokunuş: açık alıştırmaya dön.
  const acik = await prisma.checkupSession.findFirst({
    where: {
      userId,
      kind: "PRACTICE",
      practiceMode: "SIMILAR",
      status: "IN_PROGRESS",
      expiresAt: { gt: now },
      items: { some: { sourceQuestionId: questionId, answer: { is: null } } },
    },
    select: { id: true },
  });
  if (acik) return acik.id;

  if ((await alistirmaHakki(userId, now)) < 1) throw new CheckupError(HAK_DOLDU);

  const kaynak: BenzerKaynagi = { ...soruAlanlari(kaynakItem.question), examScope: s.sinav };
  const { sorular: korunan, kazanimlar } = await korunanlar(userId);
  const haric = new Set([...korunan, ...s.items.map((i) => i.questionId)]);
  const adaylar = await benzerAdaylari([kaynak], userId, haric, kazanimlar, now);
  const secilen = benzerAta([kaynak], adaylar).get(questionId);
  if (!secilen) throw new CheckupError("Bu sorunun benzeri havuzda henüz yok.");

  const version = await prisma.question.findUniqueOrThrow({
    where: { id: secilen.questionId },
    select: { version: true },
  });

  return alistirmaAc({
    userId,
    examScope: s.sinav,
    mode: "SIMILAR",
    focusTopicId: secilen.topicId,
    sourceSessionId,
    sorular: [{ id: secilen.questionId, version: version.version, sourceQuestionId: questionId }],
    relaxedExposureCount: secilen.sonGosterim ? 1 : 0,
    now,
  });
}

// ─────────────────────────────────────────────────────────────
// "Bu konuda çalış"
// ─────────────────────────────────────────────────────────────

/**
 * Bir sonucun zayıf konusundan KONU_CALISMA_SORU soruluk süresiz alıştırma.
 *
 * Konu o testte ölçülmüş olmalı (kontrol testindeki kuralla aynı gerekçe:
 * bu uç paket hakkına bakmıyor). Soru seçimi kontrol testinin merdiveni:
 * zorluk bantları → bant gevşer → tekrar engeli gevşer.
 */
export async function konuCalismasiBaslat(
  userId: string,
  topicId: string,
  sourceSessionId: string
): Promise<string> {
  const now = new Date();
  const s = await kaynakOturum(userId, sourceSessionId);
  if (!s.items.some((i) => i.question.topicId === topicId)) {
    throw new CheckupError("Bu konu bu testte ölçülmedi.");
  }

  const konu = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, name: true, examScope: true, examScopes: true },
  });
  if (!konu) throw new CheckupError("Konu bulunamadı.");
  if (!konuSinavdaMi(konu, s.sinav)) {
    throw new CheckupError(`${konu.name}, ${examShort(s.sinav)} konuları arasında değil.`);
  }

  // Aynı konuda yarım kalan alıştırma varsa ona dön.
  const acik = await prisma.checkupSession.findFirst({
    where: {
      userId,
      kind: "PRACTICE",
      practiceMode: "TOPIC",
      focusTopicId: topicId,
      status: "IN_PROGRESS",
      expiresAt: { gt: now },
      items: { some: { answer: { is: null } } },
    },
    select: { id: true },
  });
  if (acik) return acik.id;

  const adet = Math.min(KONU_CALISMA_SORU, await alistirmaHakki(userId, now));
  if (adet < 1) throw new CheckupError(HAK_DOLDU);

  const { sorular: korunan, kazanimlar } = await korunanlar(userId);
  const [bekleyenKazanimSorulari, azOnce] = await Promise.all([
    kazanimlar.length > 0
      ? prisma.question.findMany({
          where: { topicId, objectiveId: { in: kazanimlar } },
          select: { id: true },
        })
      : Promise.resolve([]),
    azOnceGosterilenler(userId, now),
  ]);
  const haric = [
    ...new Set([
      ...korunan,
      ...s.items.map((i) => i.questionId),
      ...bekleyenKazanimSorulari.map((q) => q.id),
      ...azOnce,
    ]),
  ];

  const secim = await selectQuestionsForTopic(topicId, adet, userId, s.sinav, haric);
  if (secim.questions.length === 0) {
    throw new CheckupError(`${konu.name} konusunda şu an alıştırmalık soru kalmadı.`);
  }

  return alistirmaAc({
    userId,
    examScope: s.sinav,
    mode: "TOPIC",
    focusTopicId: topicId,
    sourceSessionId,
    sorular: secim.questions.map((q) => ({ id: q.id, version: q.version, sourceQuestionId: null })),
    relaxedExposureCount: secim.relaxedExposureCount,
    now,
  });
}

// ─────────────────────────────────────────────────────────────
// "Bugünkü tekrar" (yanlış defteri)
// ─────────────────────────────────────────────────────────────

/**
 * Vadesi gelmiş maddeler ve her birine atanabilecek benzer soru.
 *
 * Teyit turu bekleyen kazanımın maddesi bekletilir (seviyeli check-up'ın
 * "yeni soru" havuzu tekrarda harcanmasın); turu bitince kendiliğinden gelir.
 */
async function tekrarPlani(userId: string, now: Date) {
  const [maddeler, { sorular: korunan, kazanimlar }] = await Promise.all([
    vadesiGelenler(userId, now),
    korunanlar(userId),
  ]);
  const bekleyen = new Set(kazanimlar);
  const kaynaklar: BenzerKaynagi[] = [];
  let teyitBekleyen = 0;
  for (const m of maddeler) {
    if (m.question.objectiveId && bekleyen.has(m.question.objectiveId)) {
      teyitBekleyen += 1;
      continue;
    }
    if (!sinavGecerli(m.examScope)) continue;
    kaynaklar.push({ ...soruAlanlari({ id: m.questionId, ...m.question }), examScope: m.examScope });
  }
  const adaylar =
    kaynaklar.length > 0 ? await benzerAdaylari(kaynaklar, userId, korunan, kazanimlar, now, 0) : [];
  // En eski vadeli önce: benzer sıkıntısı varsa önce bekleyen madde alsın.
  const atama = benzerAta(kaynaklar, adaylar);
  return { vadesiGelen: maddeler.length, teyitBekleyen, kaynaklar, atama };
}

/** Bugün (Türkiye saatiyle) tekrarda açılan soru sayısı. */
async function bugunTekrarlanan(userId: string, now: Date): Promise<number> {
  return prisma.sessionItem.count({
    where: {
      session: { userId, kind: "PRACTICE", practiceMode: "REVIEW", startedAt: { gte: gunBasi(now) } },
    },
  });
}

/** Yarım kalan tekrar oturumu (varsa) ve cevaplanmamış soru sayısı. */
async function acikTekrar(userId: string, now: Date) {
  const s = await prisma.checkupSession.findFirst({
    where: { userId, kind: "PRACTICE", practiceMode: "REVIEW", status: "IN_PROGRESS", expiresAt: { gt: now } },
    orderBy: { startedAt: "desc" },
    select: { id: true, items: { select: { answer: { select: { id: true } } } } },
  });
  if (!s) return null;
  const kalan = s.items.filter((i) => !i.answer).length;
  return kalan > 0 ? { id: s.id, kalan, toplam: s.items.length } : null;
}

export interface BugunkuTekrar {
  /** Şimdi açılırsa kaç soruluk tekrar gelir (günlük sınır ve benzer havuzuyla). */
  hazir: number;
  /** Vadesi gelmiş açık madde. */
  vadesiGelen: number;
  /** Vadesi gelmiş ama havuzda şu an benzeri olmayan madde. */
  benzeriYok: number;
  /** Seviyeli check-up'ta teyit turu bekleyen kazanımın maddesi. */
  teyitBekleyen: number;
  /** Bugün tekrarda açılan soru (GUNLUK_TEKRAR_SORU sınırına sayılır). */
  bugunTekrarlanan: number;
  /** Yarım kalan tekrar oturumu. */
  acik: { id: string; kalan: number; toplam: number } | null;
  /** Defterdeki açık (çıkmamış) madde. */
  acikMadde: number;
  /** Vadesi gelen yoksa sıradaki vade. */
  siradakiVade: Date | null;
}

/** Pano kartı ve defter sayfası için "bugünkü tekrar" durumu. */
export async function bugunkuTekrarDurumu(userId: string, now = new Date()): Promise<BugunkuTekrar> {
  const [acik, tekrarlanan, acikMadde, siradaki] = await Promise.all([
    acikTekrar(userId, now),
    bugunTekrarlanan(userId, now),
    prisma.notebookItem.count({ where: { userId, resolvedAt: null } }),
    prisma.notebookItem.findFirst({
      where: { userId, resolvedAt: null, dueAt: { gt: now } },
      orderBy: { dueAt: "asc" },
      select: { dueAt: true },
    }),
  ]);
  const plan = acikMadde > 0 ? await tekrarPlani(userId, now) : null;
  const benzeriOlan = plan?.atama.size ?? 0;
  return {
    hazir: acik ? 0 : Math.min(Math.max(0, GUNLUK_TEKRAR_SORU - tekrarlanan), benzeriOlan),
    vadesiGelen: plan?.vadesiGelen ?? 0,
    benzeriYok: plan ? plan.kaynaklar.length - benzeriOlan : 0,
    teyitBekleyen: plan?.teyitBekleyen ?? 0,
    bugunTekrarlanan: tekrarlanan,
    acik,
    acikMadde,
    siradakiVade: siradaki?.dueAt ?? null,
  };
}

/**
 * "Bugünkü tekrar"ı açar: vadesi gelen her madde için bir BENZER soru,
 * en fazla GUNLUK_TEKRAR_SORU (gün başına). Yarım kalan tekrar varsa ona döner.
 */
export async function tekrarBaslat(
  userId: string,
  hedefSinav: string | null,
  now = new Date()
): Promise<string> {
  const acik = await acikTekrar(userId, now);
  if (acik) return acik.id;

  const kalan = GUNLUK_TEKRAR_SORU - (await bugunTekrarlanan(userId, now));
  if (kalan <= 0) throw new CheckupError("Bugünkü tekrarını bitirdin. Sıradaki maddeler yarın.");

  const plan = await tekrarPlani(userId, now);
  const secilen = plan.kaynaklar.filter((k) => plan.atama.has(k.questionId)).slice(0, kalan);
  if (secilen.length === 0) {
    throw new CheckupError(
      plan.vadesiGelen === 0
        ? "Bugün tekrar edilecek madde yok."
        : "Bugün vadesi gelen maddelerin benzeri havuzda yok. Yeni sorular eklenince gelecekler."
    );
  }

  const benzerler = secilen.map((k) => plan.atama.get(k.questionId)!);
  const surumler = new Map(
    (
      await prisma.question.findMany({
        where: { id: { in: benzerler.map((b) => b.questionId) } },
        select: { id: true, version: true },
      })
    ).map((q) => [q.id, q.version])
  );

  return alistirmaAc({
    userId,
    examScope: sinavGecerli(hedefSinav) ? hedefSinav : secilen[0].examScope,
    mode: "REVIEW",
    focusTopicId: null,
    sourceSessionId: null,
    sorular: secilen.map((k) => {
      const b = plan.atama.get(k.questionId)!;
      return { id: b.questionId, version: surumler.get(b.questionId) ?? 1, sourceQuestionId: k.questionId };
    }),
    relaxedExposureCount: benzerler.filter((b) => b.sonGosterim !== null).length,
    now,
    // "Bugünkü" tekrar: gün bitince kapanır; yarın vadesi gelenlerle yenisi kurulur.
    // Gece yarısına az kala açılana yine de birkaç saat tanınır.
    expiresAt: new Date(Math.max(vade(now, 1).getTime(), now.getTime() + 3 * SAAT)),
  });
}

/**
 * Defter sayfası için: açık maddelerin hangisinin havuzda şu an benzeri var.
 * Vadesi gelmemiş maddeler de dahil — öğrenci "bu madde hiç gelmeyecek mi"
 * sorusunun cevabını önceden görsün.
 */
export async function defterBenzerDurumu(
  userId: string,
  maddeler: { questionId: string; examScope: string; question: { topicId: string; objectiveId: string | null; level: string | null; difficulty: number } }[]
): Promise<Map<string, boolean>> {
  const kaynaklar: BenzerKaynagi[] = maddeler
    .filter((m) => sinavGecerli(m.examScope))
    .map((m) => ({ ...soruAlanlari({ id: m.questionId, ...m.question }), examScope: m.examScope as Sinav }));
  if (kaynaklar.length === 0) return new Map();
  const { sorular: korunan, kazanimlar } = await korunanlar(userId);
  // Tekrardaki kuralla aynı: son 24 saat yasağı yok.
  const adaylar = await benzerAdaylari(kaynaklar, userId, korunan, kazanimlar, new Date(), 0);
  return new Map(kaynaklar.map((k) => [k.questionId, benzeriVar(k, adaylar)]));
}

// ─────────────────────────────────────────────────────────────
// Oku
// ─────────────────────────────────────────────────────────────

/** Cevaplanmış alıştırma sorusunun geri bildirimi. Cevaplanmamış soruda YOK. */
export interface PracticeFeedback {
  selectedChoiceId: string | null;
  /** null = "Bilmiyorum" (boş). */
  isCorrect: boolean | null;
  correctChoiceId: string | null;
  /** Seçilen yanlış şıkkın hata tipi; doğru, boş ya da etiketsizse null. */
  errorLabel: string | null;
  errorAdvice: string | null;
  solution: QuestionContent | null;
  /** Bugünkü tekrarda: maddenin şimdiki durumu ("Sıradaki tekrar 3 gün sonra"). */
  defterNotu: string | null;
}

export interface PracticeQuestion {
  id: string;
  order: number;
  topicName: string;
  stem: QuestionContent;
  choices: StudentChoice[];
  feedback: PracticeFeedback | null;
}

export interface PracticeSessionView {
  id: string;
  mode: PracticeMode;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED" | "ABANDONED";
  examScope: string;
  topicName: string | null;
  sourceSessionId: string | null;
  /** Tek soruluk benzer alıştırmada asıl soru ("bir benzerini daha" için). */
  sourceQuestionId: string | null;
  questions: PracticeQuestion[];
}

/**
 * Alıştırma ekranının verisi.
 *
 * İki aşamalı okuma bilinçli: önce sorular cevap anahtarı OLMADAN çekilir,
 * sonra yalnızca cevaplanmış soruların anahtarı ve çözümü. Cevaplanmamış
 * sorunun anahtarı bu fonksiyonun belleğine bile girmez.
 */
export async function getPracticeSession(sessionId: string, userId: string): Promise<PracticeSessionView> {
  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      kind: true,
      practiceMode: true,
      status: true,
      sourceSessionId: true,
      focusTopic: { select: { name: true } },
      package: { select: { examScope: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          sourceQuestionId: true,
          question: {
            select: {
              id: true,
              stem: true,
              topic: { select: { name: true } },
              choices: {
                orderBy: { sortOrder: "asc" },
                // ⚠️ isCorrect ve errorType BİLİNÇLİ OLARAK YOK.
                select: { id: true, label: true, content: true },
              },
            },
          },
          answer: { select: { choiceId: true, isCorrect: true } },
        },
      },
    },
  });

  if (!session || session.userId !== userId) throw new CheckupError("Oturum bulunamadı.");
  if (session.kind !== "PRACTICE" || !session.practiceMode) {
    throw new CheckupError("Bu oturum bir alıştırma değil.");
  }

  const cevaplananlar = session.items.filter((i) => i.answer).map((i) => i.question.id);
  const anahtarlar =
    cevaplananlar.length > 0
      ? await prisma.question.findMany({
          where: { id: { in: cevaplananlar } },
          select: {
            id: true,
            solution: true,
            choices: { select: { id: true, isCorrect: true, errorType: true } },
          },
        })
      : [];
  const anahtar = new Map(anahtarlar.map((a) => [a.id, a]));

  // Bugünkü tekrar: cevaplanan sorunun kaynağı olan maddenin şimdiki hâli.
  const kaynaklar =
    session.practiceMode === "REVIEW"
      ? session.items.filter((i) => i.answer && i.sourceQuestionId).map((i) => i.sourceQuestionId!)
      : [];
  const maddeler =
    kaynaklar.length > 0
      ? await prisma.notebookItem.findMany({
          where: { userId, questionId: { in: kaynaklar } },
          select: { questionId: true, dueAt: true, resolvedAt: true },
        })
      : [];
  const madde = new Map(maddeler.map((m) => [m.questionId, m]));
  const simdi = new Date();
  const defterNotu = (kaynak: string | null): string | null => {
    const m = kaynak ? madde.get(kaynak) : undefined;
    if (!m) return null;
    if (m.resolvedAt) {
      return `Bu yanlış defterden çıktı: aralıklarla ${TEKRAR_ARALIKLARI_GUN.length} kez doğru yaptın.`;
    }
    return `Yanlış defteri: sıradaki tekrar ${vadeMetni(m.dueAt, simdi)}.`;
  };

  return {
    id: session.id,
    mode: session.practiceMode,
    status: session.status,
    examScope: session.package.examScope,
    topicName: session.focusTopic?.name ?? null,
    sourceSessionId: session.sourceSessionId,
    sourceQuestionId:
      session.practiceMode === "SIMILAR" ? (session.items[0]?.sourceQuestionId ?? null) : null,
    questions: session.items.map((item) => {
      const a = item.answer ? anahtar.get(item.question.id) : undefined;
      let feedback: PracticeFeedback | null = null;
      if (item.answer && a) {
        const secilen = a.choices.find((c) => c.id === item.answer!.choiceId) ?? null;
        const yanlisTipi =
          secilen && !secilen.isCorrect && secilen.errorType && secilen.errorType !== "DIGER"
            ? secilen.errorType
            : null;
        feedback = {
          selectedChoiceId: item.answer.choiceId,
          isCorrect: item.answer.isCorrect,
          correctChoiceId: a.choices.find((c) => c.isCorrect)?.id ?? null,
          errorLabel: yanlisTipi ? (ERROR_TYPE_LABELS[yanlisTipi] ?? yanlisTipi) : null,
          errorAdvice: hataTipiTavsiyesi(yanlisTipi),
          solution: a.solution ? parseQuestionContent(a.solution) : null,
          defterNotu: session.practiceMode === "REVIEW" ? defterNotu(item.sourceQuestionId) : null,
        };
      }
      return {
        id: item.question.id,
        order: item.sortOrder,
        topicName: item.question.topic.name,
        stem: parseQuestionContent(item.question.stem),
        choices: item.question.choices.map((c) => ({
          id: c.id,
          label: c.label,
          content: parseQuestionContent(c.content),
        })),
        feedback,
      };
    }),
  };
}

// ─────────────────────────────────────────────────────────────
// Cevapla
// ─────────────────────────────────────────────────────────────

/**
 * Alıştırma cevabı. İlk kayıt KİLİTLİDİR: ikinci gönderim hiçbir şeyi
 * değiştirmez (çözümü gördükten sonra işaret değiştirilemez).
 * `choiceId: null` = "Bilmiyorum".
 */
export async function answerPractice(args: {
  sessionId: string;
  userId: string;
  questionId: string;
  choiceId: string | null;
  timeSpentMs: number;
}): Promise<{ yeni: boolean }> {
  const { sessionId, userId, questionId, choiceId, timeSpentMs } = args;
  const now = new Date();

  const item = await prisma.sessionItem.findFirst({
    where: { sessionId, questionId, session: { userId } },
    select: {
      id: true,
      sourceQuestionId: true,
      answer: { select: { id: true } },
      session: { select: { kind: true, status: true, expiresAt: true, practiceMode: true, startedAt: true } },
    },
  });

  if (!item) throw new CheckupError("Soru bu oturuma ait değil.");
  // Sınav oturumuna bu yoldan cevap yazılırsa çözüm test sürerken açılırdı.
  if (item.session.kind !== "PRACTICE") throw new CheckupError("Bu oturum bir alıştırma değil.");
  if (item.answer) return { yeni: false };
  if (item.session.status !== "IN_PROGRESS" || item.session.expiresAt.getTime() < now.getTime()) {
    throw new CheckupError("Bu alıştırma kapandı. Yenisini açabilirsin.", "KAPANDI");
  }

  /*
   * Aynı soru öğrencinin AÇIK bir sınavında da varsa anahtar açılmaz.
   * Seçim bu soruları zaten dışlıyor; bu ikinci kilit: alıştırma açıldıktan
   * sonra başlayan bir sınav (havuz darken) aynı soruyu seçmiş olabilir.
   */
  const acikSinavda = await prisma.sessionItem.findFirst({
    where: {
      questionId,
      session: {
        userId,
        kind: { not: "PRACTICE" },
        status: "IN_PROGRESS",
        expiresAt: { gt: new Date(now.getTime() - KAYIT_TOLERANSI_MS) },
      },
    },
    select: { id: true },
  });
  if (acikSinavda) {
    throw new CheckupError("Bu soru açık bir testinde de var. Önce o testi bitir; çözümünü sonra burada görürsün.");
  }

  let isCorrect: boolean | null = null;
  if (choiceId) {
    const choice = await prisma.choice.findFirst({
      where: { id: choiceId, questionId },
      select: { isCorrect: true },
    });
    if (!choice) throw new CheckupError("Geçersiz şık.");
    isCorrect = choice.isCorrect;
  }

  try {
    await prisma.answer.create({
      data: { sessionItemId: item.id, choiceId, isCorrect, timeSpentMs, answeredAt: now },
    });
  } catch (e) {
    // Hızlı çift dokunuş: ilk kayıt kazandı, kilit onda.
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return { yeni: false };
    }
    throw e;
  }

  /*
   * Bugünkü tekrar: cevap yanlış defterindeki maddeyi ilerletir (doğru) ya
   * da başa döndürür (yanlış, "Bilmiyorum"). Benzer alıştırma ve konu
   * çalışması defteri değiştirmez: hemen ardından çözülen benzer soru
   * aralıklı tekrar sayılmaz.
   */
  if (item.session.practiceMode === "REVIEW" && item.sourceQuestionId) {
    try {
      await tekrarIsle({
        userId,
        questionId: item.sourceQuestionId,
        dogru: isCorrect === true,
        oturumBasi: item.session.startedAt,
        now,
      });
    } catch (e) {
      // Cevap kaydedildi; defter bir sonraki tekrarda yine işlenir.
      console.error("Yanlış defteri ilerletilemedi:", e);
    }
  }

  // Son soru da cevaplandıysa oturum kapanır (sonuç satırı YOK).
  const kalan = await prisma.sessionItem.count({ where: { sessionId, answer: { is: null } } });
  if (kalan === 0) {
    await prisma.checkupSession.updateMany({
      where: { id: sessionId, status: "IN_PROGRESS" },
      data: { status: "SUBMITTED", submittedAt: now },
    });
  }

  return { yeni: true };
}
