import { prisma } from "@/lib/db";
import { CheckupError } from "@/lib/checkup";
import { checkPackageAccess } from "@/lib/entitlements";
import { kazanimBasinaBirSoru, seviyeSorulari, sinavinKazanimlari } from "@/lib/level-selection";
import {
  ayarGetir,
  seviye1AnaKarar,
  seviyeAyari,
  telafiKarar,
  ustSeviyeKarar,
  type KapiKarari,
  type Seviye,
} from "@/lib/levels";
import type { ExamScopeValue } from "@/lib/exams";

/**
 * Seviyeli check-up — veritabanı tarafı.
 *
 * Her aşama bir CheckupSession satırı. Bu bilinçli: soru sabitleme, sayaç,
 * cevap kaydı, cevap anahtarı sızıntı koruması, tekrar engeli ve inceleme
 * ekranı zaten orada çalışıyor. Yeniden yazmak, aynı hataları ikinci kez
 * yapmak olurdu.
 *
 * Bu dosyanın işi yalnızca: zinciri kurmak, kapıları değerlendirmek ve
 * telafi turunu açmak.
 */

/** Aşamaların bağlandığı gizli paket — erişim hakkı ve ad için. */
async function seviyeliPaket(examScope: ExamScopeValue) {
  const paket = await prisma.package.findFirst({
    where: { kind: "LEVEL", examScope: examScope as never, status: "PUBLISHED" },
    select: { id: true, name: true, slug: true, isFree: true },
  });
  if (!paket) {
    throw new CheckupError(`${examScope} için seviyeli check-up tanımlı değil.`);
  }
  return paket;
}

/** Öğrencinin devam eden denemesi (varsa). */
export async function aktifKosu(userId: string) {
  return prisma.levelRun.findFirst({
    where: { userId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      examScope: true,
      unlockedLevel: true,
      reachedLevel: true,
      pendingRemedialIds: true,
      startedAt: true,
      stages: {
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          status: true,
          stageLevel: true,
          stageKind: true,
          expiresAt: true,
          submittedAt: true,
          result: { select: { correctCount: true, wrongCount: true, blankCount: true } },
        },
      },
    },
  });
}

/**
 * Yeni bir seviyeli check-up başlatır ve Seviye 1'i açar.
 *
 * Açık bir deneme varsa yenisini AÇMAZ, mevcudu döner: iki paralel deneme
 * hem ölçümü hem soru havuzunu bozar.
 */
export async function seviyeliSinavBaslat(
  userId: string,
  examScope: ExamScopeValue
): Promise<{ runId: string; sessionId: string }> {
  const acik = await aktifKosu(userId);
  if (acik) {
    const devam = acik.stages.find((s) => s.status === "IN_PROGRESS");
    if (devam) return { runId: acik.id, sessionId: devam.id };
    // Açık deneme var ama oynanacak aşama yok → sıradakini aç.
    const sonuc = await asamaAc(acik.id, acik.unlockedLevel as Seviye, "MAIN");
    return { runId: acik.id, sessionId: sonuc.sessionId };
  }

  const paket = await seviyeliPaket(examScope);
  const erisim = await checkPackageAccess(userId, paket.id, paket.isFree);
  if (!erisim.allowed) {
    throw new CheckupError("Bu check-up için erişim hakkın yok.");
  }

  const run = await prisma.levelRun.create({
    data: { userId, examScope: examScope as never },
    select: { id: true },
  });

  const sonuc = await asamaAc(run.id, 1, "MAIN");
  return { runId: run.id, sessionId: sonuc.sessionId };
}

/**
 * Bir aşamayı açar (oturum oluşturur).
 *
 * `objectiveIds` yalnızca telafi turunda dolu gelir — hangi kazanımlardan
 * soru isteneceğini kapı kararı belirliyor.
 */
export async function asamaAc(
  runId: string,
  level: Seviye,
  kind: "MAIN" | "REMEDIAL",
  objectiveIds?: string[]
): Promise<{ sessionId: string; soruSayisi: number }> {
  const run = await prisma.levelRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      userId: true,
      examScope: true,
      status: true,
      unlockedLevel: true,
      stages: { select: { id: true, status: true, items: { select: { questionId: true } } } },
    },
  });
  if (!run) throw new CheckupError("Deneme bulunamadı.");
  if (run.status !== "IN_PROGRESS") throw new CheckupError("Bu deneme kapandı.");
  if (level > run.unlockedLevel) throw new CheckupError("Bu seviye henüz açılmadı.");

  const yarim = run.stages.find((s) => s.status === "IN_PROGRESS");
  if (yarim) throw new CheckupError("Önce yarım kalan aşamayı bitirmelisin.");

  const scope = run.examScope as ExamScopeValue;
  const ayar = ayarGetir(scope);
  const paket = await seviyeliPaket(scope);

  /*
   * Bu denemede gösterilmiş HER soru dışlanır.
   *
   * Telafi turunun tek anlamı bu: aynı kazanımı FARKLI bir soruyla yeniden
   * sormak. Aynı soru gelirse öğrenci hatırlar, doğru yapar ve sistem
   * kazanımın oturduğunu sanır.
   */
  const gosterilmis = run.stages.flatMap((s) => s.items.map((i) => i.questionId));

  let secim;
  let dakika: number;

  if (kind === "REMEDIAL") {
    if (!objectiveIds || objectiveIds.length === 0) {
      throw new CheckupError("Telafi turu için eksik kazanım listesi gerekiyor.");
    }
    secim = await kazanimBasinaBirSoru(objectiveIds, scope, run.userId, gosterilmis);
    dakika = Math.max(5, Math.ceil(secim.questions.length * ayar.telafiDakikaPerSoru));
  } else if (level === 1) {
    const kazanimlar = await sinavinKazanimlari(scope, ayar.seviye1.soruSayisi);
    secim = await kazanimBasinaBirSoru(
      kazanimlar.map((k) => k.id),
      scope,
      run.userId,
      gosterilmis
    );
    dakika = ayar.seviye1.dakika;
  } else {
    const a = seviyeAyari(scope, level);
    secim = await seviyeSorulari(
      level === 2 ? "L2_ORTA" : "L3_ANALIZ",
      a.soruSayisi,
      scope,
      run.userId,
      gosterilmis
    );
    dakika = a.dakika;
  }

  if (secim.questions.length === 0) {
    throw new CheckupError(
      `Seviye ${level} için havuzda soru yok. İçerik tamamlanınca açılacak.`
    );
  }

  const simdi = new Date();
  const session = await prisma.$transaction(async (tx) => {
    return tx.checkupSession.create({
      data: {
        userId: run.userId,
        packageId: paket.id,
        kind: "LEVEL_STAGE",
        levelRunId: run.id,
        stageLevel: level,
        stageKind: kind,
        status: "IN_PROGRESS",
        durationMinutes: dakika,
        // Ham doğru sayısı — seviyeli sınavda net YOK (lib/levels.ts).
        penaltyRatio: 0,
        relaxedExposureCount: secim.relaxedExposureCount,
        startedAt: simdi,
        expiresAt: new Date(simdi.getTime() + dakika * 60_000),
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
  });

  return { sessionId: session.id, soruSayisi: secim.questions.length };
}

/**
 * Bekleyen telafi turunu açar (öğrenci "devam" dediğinde).
 */
export async function telafiyiAc(runId: string, userId: string): Promise<string> {
  const run = await prisma.levelRun.findUnique({
    where: { id: runId },
    select: { userId: true, status: true, pendingRemedialIds: true },
  });
  if (!run || run.userId !== userId) throw new CheckupError("Deneme bulunamadı.");
  if (run.status !== "IN_PROGRESS") throw new CheckupError("Bu deneme kapandı.");
  if (run.pendingRemedialIds.length === 0) {
    throw new CheckupError("Bekleyen telafi turu yok.");
  }

  const { sessionId } = await asamaAc(runId, 1, "REMEDIAL", run.pendingRemedialIds);
  await prisma.levelRun.update({
    where: { id: runId },
    data: { pendingRemedialIds: [] },
  });
  return sessionId;
}

/**
 * Bir aşama bitti — kapıyı değerlendir, zinciri ilerlet.
 *
 * Oturumun kendisi `submitCheckup` ile kapatılmış olmalı; burada yalnızca
 * sonucuna bakılıyor.
 */
export async function asamaDegerlendir(sessionId: string, userId: string): Promise<KapiKarari> {
  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      stageLevel: true,
      stageKind: true,
      levelRunId: true,
      result: { select: { correctCount: true, wrongCount: true, blankCount: true } },
      items: {
        select: {
          question: { select: { objectiveId: true } },
          answer: { select: { isCorrect: true } },
        },
      },
    },
  });

  if (!session || session.userId !== userId) throw new CheckupError("Oturum bulunamadı.");
  if (!session.levelRunId || !session.stageLevel) throw new CheckupError("Bu oturum seviyeli sınava ait değil.");
  if (!session.result) throw new CheckupError("Bu aşama henüz bitmedi.");

  const run = await prisma.levelRun.findUniqueOrThrow({
    where: { id: session.levelRunId },
    select: {
      id: true,
      examScope: true,
      gateLog: true,
      stages: {
        where: { stageLevel: 1, status: "SUBMITTED" },
        select: {
          stageKind: true,
          result: { select: { correctCount: true, wrongCount: true, blankCount: true } },
        },
      },
    },
  });

  const ayar = ayarGetir(run.examScope as ExamScopeValue);
  const seviye = session.stageLevel as Seviye;
  const dogru = session.result.correctCount;
  const toplam = session.result.correctCount + session.result.wrongCount + session.result.blankCount;

  let karar: KapiKarari;

  if (seviye === 1 && session.stageKind === "MAIN") {
    // Yanlış YA DA boş → kazanım eksik sayılır.
    const eksik = [
      ...new Set(
        session.items
          .filter((i) => i.answer?.isCorrect !== true)
          .map((i) => i.question.objectiveId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    karar = seviye1AnaKarar(dogru, toplam, eksik, ayar);
  } else if (seviye === 1 && session.stageKind === "REMEDIAL") {
    const ana = run.stages.find((s) => s.stageKind === "MAIN")?.result;
    const anaToplam = ana ? ana.correctCount + ana.wrongCount + ana.blankCount : 0;
    karar = telafiKarar(ana?.correctCount ?? 0, anaToplam, dogru, toplam, ayar);
  } else {
    karar = ustSeviyeKarar(seviye as 2 | 3, dogru, toplam, ayar);
  }

  await kararIsle(run.id, seviye, karar, { dogru, toplam });
  return karar;
}

/** Kapı kararını LevelRun'a yazar ve gerekiyorsa sonraki aşamayı açar. */
async function kararIsle(
  runId: string,
  seviye: Seviye,
  karar: KapiKarari,
  olcum: { dogru: number; toplam: number }
) {
  const mevcut = await prisma.levelRun.findUniqueOrThrow({
    where: { id: runId },
    select: { gateLog: true, reachedLevel: true },
  });

  const kayit = Array.isArray(mevcut.gateLog) ? (mevcut.gateLog as unknown[]) : [];
  kayit.push({
    seviye,
    karar: karar.tur,
    dogru: olcum.dogru,
    toplam: olcum.toplam,
    zaman: new Date().toISOString(),
    ...(karar.tur === "DUR" ? { sebep: karar.sebep } : {}),
  });

  if (karar.tur === "SONRAKI_SEVIYE") {
    await prisma.levelRun.update({
      where: { id: runId },
      data: {
        unlockedLevel: karar.seviye,
        reachedLevel: Math.max(mevcut.reachedLevel, karar.seviye),
        gateLog: kayit as never,
        pendingRemedialIds: [],
      },
    });
    return;
  }

  if (karar.tur === "TELAFI") {
    /*
     * Tur HEMEN AÇILMIYOR. Şema "ekrana uyarı gelir" diyor: öğrenci neden
     * ek soru çözdüğünü bilmeden soruyla karşılaşmamalı. Ayrıca sayaç
     * "devam" dediğinde başlamalı, karne ekranını okurken değil.
     */
    await prisma.levelRun.update({
      where: { id: runId },
      data: { gateLog: kayit as never, pendingRemedialIds: karar.eksikObjectiveIds },
    });
    return;
  }

  await prisma.levelRun.update({
    where: { id: runId },
    data: {
      status: karar.tur === "BITTI" ? "COMPLETED" : "STOPPED",
      stoppedAtLevel: karar.tur === "DUR" ? karar.seviye : null,
      finishedAt: new Date(),
      gateLog: kayit as never,
      pendingRemedialIds: [],
    },
  });
}
