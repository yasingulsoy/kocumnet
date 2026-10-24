import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { CheckupError } from "@/lib/checkup";
import { checkPackageAccess } from "@/lib/entitlements";
import { maruziyetiYaz } from "@/lib/maruziyet";
import { baslatmaKilidi } from "@/lib/kullanici-kilidi";
import {
  kazanimBasinaBirSoru,
  seviyeliHazirlik,
  seviyeSorulari,
  sinavinKazanimlari,
  type SeviyeSecimi,
} from "@/lib/level-selection";
import {
  ayarGetir,
  seviye1AnaKarar,
  seviyeAyari,
  telafiDakikasi,
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
 * Bu dosyanın işi yalnızca: zinciri kurmak, kapıları değerlendirmek,
 * telafi turunu açmak ve koşuyu bırakmak.
 */

/** Havuz yetmediğinde öğrencinin gördüğü tek metin (/seviyeli sayfası da bunu yazar). */
export const SEVIYELI_HAZIR_DEGIL =
  "Bu sınav için seviyeli check-up henüz hazır değil. Soru havuzu tamamlanınca burada açılacak.";

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

/**
 * Öğrencinin süren denemesi (varsa).
 *
 * `examScope` verilirse yalnızca o sınavın denemesi: /seviyeli sayfası
 * öğrencinin hedef sınavıyla sorar. Eskiden sınava bakılmıyordu; hedefini
 * LGS'den TYT'ye çeviren öğrenci TYT sayfasında eski LGS denemesine
 * yönlendiriliyor, TYT'yi hiç başlatamıyordu. Verilmezse en son başlatılan
 * (pano: hangi sınavdan olursa olsun yarım kalan iş). Bırakılan koşu
 * (ABANDONED) süren sayılmaz; "Bugün" kartına da girmez.
 *
 * `db`: başlatma, kullanıcı kilidinden sonra işlemin içinden yeniden sorar.
 */
export async function aktifKosu(
  userId: string,
  examScope?: ExamScopeValue,
  db: Prisma.TransactionClient = prisma
) {
  return db.levelRun.findFirst({
    where: { userId, status: "IN_PROGRESS", ...(examScope ? { examScope: examScope as never } : {}) },
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
 * Aynı sınavın süren denemesi varsa yenisini AÇMAZ, onu döner (açık aşaması
 * yoksa `sessionId: null`; çağıran deneme sayfasına gider, sıradaki adımı
 * orası söyler). İki paralel deneme hem ölçümü hem soru havuzunu bozar.
 *
 * Başka sınavın süren denemesi BIRAKILIR (ABANDONED): hedef sınavını
 * değiştiren öğrencinin eski koşusu "Bugün" kartında sonsuza dek "yarım
 * kaldı" demesin. Bırakma ancak yeni koşu gerçekten açılırken olur; erişim
 * ya da havuz yüzünden açılamayan başlatma eskisine dokunmaz.
 *
 * Koşu ve ilk aşama TEK işlemde yazılır. Eskiden koşu önce yazılıyor, aşama
 * sonra açılıyordu; havuz yetmeyince aşamasız bir koşu kalıyor ve "Bugün"
 * kartı her gün "Seviye 1 seni bekliyor" diyordu.
 *
 * İki sekme aynı anda başlatınca ikisi de süren koşu görmüyor ve aynı
 * sınavdan iki koşu açılıyordu. İşlem kullanıcı kilidini alır ve süren koşuya
 * kilitten sonra yeniden bakar (lib/kullanici-kilidi.ts): ikinci sekme
 * birincinin koşusuna döner.
 */
export async function seviyeliSinavBaslat(
  userId: string,
  examScope: ExamScopeValue
): Promise<{ runId: string; sessionId: string | null }> {
  const acik = await aktifKosu(userId, examScope);
  if (acik) {
    const devam = acik.stages.find((s) => s.status === "IN_PROGRESS");
    return { runId: acik.id, sessionId: devam?.id ?? null };
  }

  const paket = await seviyeliPaket(examScope);
  const erisim = await checkPackageAccess(userId, paket.id, paket.isFree);
  if (!erisim.allowed) {
    throw new CheckupError("Bu check-up için erişim hakkın yok.");
  }

  // Üç seviyenin havuzu birlikte: Seviye 1'i çözüp Seviye 2'nin kapısında
  // "havuzda soru yok" diye kalmak, hiç başlamamaktan kötü.
  const hazirlik = await seviyeliHazirlik(examScope);
  if (!hazirlik.hazir) throw new CheckupError(SEVIYELI_HAZIR_DEGIL);

  // Seçim işlemin dışında (yalnızca okur); yazımlar tek işlemde.
  const plan = await asamaSec({ userId, scope: examScope, level: 1, kind: "MAIN", gosterilmis: [] });

  return prisma.$transaction(async (tx) => {
    await baslatmaKilidi(tx, userId);
    const simdiAcik = await aktifKosu(userId, examScope, tx);
    if (simdiAcik) {
      // Öbür sekme az önce açtı: seçtiğimiz sorular yazılmaz, onunki döner.
      const devam = simdiAcik.stages.find((s) => s.status === "IN_PROGRESS");
      return { runId: simdiAcik.id, sessionId: devam?.id ?? null };
    }
    await kosulariBirak(tx, { userId, examScope: { not: examScope as never } });
    const run = await tx.levelRun.create({
      data: { userId, examScope: examScope as never },
      select: { id: true },
    });
    const sessionId = await asamaYaz(tx, { runId: run.id, userId, paketId: paket.id, plan });
    return { runId: run.id, sessionId };
  });
}

/** Seçilmiş, yazılmaya hazır aşama. */
interface AsamaPlani {
  level: Seviye;
  kind: "MAIN" | "REMEDIAL";
  secim: SeviyeSecimi;
  dakika: number;
}

/**
 * Aşamanın sorularını seçer (veritabanına yazmaz).
 *
 * ANA AŞAMA TAM SAYIYLA AÇILIR: beklenenden az soru bulunursa reddedilir.
 * Eskiden havuzda ne varsa onunla açılıyordu: 50 soruluk Seviye 1 32 soruyla,
 * Seviye 2 hiç soru kalmayınca bile bir iki soruyla. Kapı oranı aynı kaldığı
 * için ölçüm bozulmuyor gibi görünüyordu, ama sorulmayan kazanımlar hiç
 * ölçülmüyor ve süre soru sayısına göre değil seviyeye göre veriliyordu.
 *
 * Telafi turu kısmi açılabilir: tek sorulu kazanımın yeni sorusu yoktur
 * (soru sayısı ve süre bulunan soruya göre).
 */
async function asamaSec(a: {
  userId: string;
  scope: ExamScopeValue;
  level: Seviye;
  kind: "MAIN" | "REMEDIAL";
  objectiveIds?: string[];
  /** Bu denemede gösterilmiş sorular — hiçbiri yeniden gelmez. */
  gosterilmis: string[];
}): Promise<AsamaPlani> {
  const ayar = ayarGetir(a.scope);

  if (a.kind === "REMEDIAL") {
    if (!a.objectiveIds || a.objectiveIds.length === 0) {
      throw new CheckupError("Telafi turu için eksik kazanım listesi gerekiyor.");
    }
    const secim = await kazanimBasinaBirSoru(a.objectiveIds, a.scope, a.userId, a.gosterilmis);
    return { level: 1, kind: "REMEDIAL", secim, dakika: telafiDakikasi(secim.questions.length, ayar) };
  }

  const beklenen = seviyeAyari(a.scope, a.level);
  let secim: SeviyeSecimi;
  if (a.level === 1) {
    const kazanimlar = await sinavinKazanimlari(a.scope, beklenen.soruSayisi);
    secim = await kazanimBasinaBirSoru(
      kazanimlar.map((k) => k.id),
      a.scope,
      a.userId,
      a.gosterilmis
    );
  } else {
    secim = await seviyeSorulari(
      a.level === 2 ? "L2_ORTA" : "L3_ANALIZ",
      beklenen.soruSayisi,
      a.scope,
      a.userId,
      a.gosterilmis
    );
  }

  if (secim.questions.length < beklenen.soruSayisi) {
    throw new CheckupError(
      `Seviye ${a.level} için soru havuzu henüz yetmiyor. İçerik tamamlanınca açılacak.`
    );
  }
  return { level: a.level, kind: "MAIN", secim, dakika: beklenen.dakika };
}

/**
 * Aşama oturumunu yazar (çağıranın işleminin içinde): oturum, soru listesi
 * ve tekrar kaydı. Tekrar kaydı paket testindeki gibi (lib/maruziyet.ts):
 * eskiden seviyeli aşama yazmıyordu, Seviye 1'in soruları ertesi gün paket
 * testinde yeniden gelebiliyordu — ekran "aynı sorular gelmez" derken.
 */
async function asamaYaz(
  tx: Prisma.TransactionClient,
  a: { runId: string; userId: string; paketId: string; plan: AsamaPlani }
): Promise<string> {
  const simdi = new Date();
  const { plan } = a;
  const session = await tx.checkupSession.create({
    data: {
      userId: a.userId,
      packageId: a.paketId,
      kind: "LEVEL_STAGE",
      levelRunId: a.runId,
      stageLevel: plan.level,
      stageKind: plan.kind,
      status: "IN_PROGRESS",
      durationMinutes: plan.dakika,
      // Ham doğru sayısı — seviyeli sınavda net YOK (lib/levels.ts).
      penaltyRatio: 0,
      relaxedExposureCount: plan.secim.relaxedExposureCount,
      startedAt: simdi,
      expiresAt: new Date(simdi.getTime() + plan.dakika * 60_000),
      items: {
        create: plan.secim.questions.map((q, i) => ({
          questionId: q.id,
          sortOrder: i,
          questionVersion: q.version,
        })),
      },
    },
    select: { id: true },
  });
  await maruziyetiYaz(
    tx,
    a.userId,
    plan.secim.questions.map((q) => q.id),
    simdi
  );
  return session.id;
}

/**
 * Bir ana aşamayı açar (oturum oluşturur): Seviye 2 ve 3, ya da süren bir
 * koşuda henüz açılmamış Seviye 1. Telafi turu `telafiyiAc` ile açılır.
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
      stages: {
        select: {
          id: true,
          status: true,
          stageLevel: true,
          stageKind: true,
          result: { select: { id: true } },
          items: { select: { questionId: true } },
        },
      },
    },
  });
  if (!run) throw new CheckupError("Deneme bulunamadı.");
  if (run.status !== "IN_PROGRESS") throw new CheckupError("Bu deneme kapandı.");
  if (level > run.unlockedLevel) throw new CheckupError("Bu seviye henüz açılmadı.");

  const yarim = run.stages.find((s) => s.status === "IN_PROGRESS");
  if (yarim) throw new CheckupError("Önce yarım kalan aşamayı bitirmelisin.");

  /*
   * Bir seviyenin ana aşaması bir koşuda bir kez ÖLÇÜLÜR. Kapısı
   * değerlendirilmemiş bir koşuda aynı seviye yeniden açılıyordu ("Seviye 0
   * geçildi"); şimdi kapıyı bitişte submitCheckup, kaçanı bakım onarımı
   * (seviyeliKapilariOnar) yazıyor. Sonucu hiç yazılamamış aşama sayılmaz:
   * ölçüm yok, o seviye yeniden açılabilir.
   */
  if (kind === "MAIN" && run.stages.some((s) => s.stageLevel === level && s.stageKind === "MAIN" && s.result)) {
    throw new CheckupError(`Seviye ${level} bu denemede zaten çözüldü. Sonucun karnende.`);
  }

  const scope = run.examScope as ExamScopeValue;
  const paket = await seviyeliPaket(scope);

  /*
   * Bu denemede gösterilmiş HER soru dışlanır.
   *
   * Telafi turunun tek anlamı bu: aynı kazanımı FARKLI bir soruyla yeniden
   * sormak. Aynı soru gelirse öğrenci hatırlar, doğru yapar ve sistem
   * kazanımın oturduğunu sanır.
   */
  const gosterilmis = run.stages.flatMap((s) => s.items.map((i) => i.questionId));
  const plan = await asamaSec({ userId: run.userId, scope, level, kind, objectiveIds, gosterilmis });
  if (plan.secim.questions.length === 0) {
    throw new CheckupError(`Seviye ${level} için havuzda soru yok. İçerik tamamlanınca açılacak.`);
  }

  const sessionId = await prisma.$transaction(async (tx) => {
    // Kullanıcı kilidi önce (kosuyuBirak ve yeni koşu başlatma da onu alıyor):
    // bırakılmakta olan koşuda aşama açılıp sahipsiz kalmasın.
    await baslatmaKilidi(tx, run.userId);
    await kosuyuKilitle(tx, run.id);
    return asamaYaz(tx, { runId: run.id, userId: run.userId, paketId: paket.id, plan });
  });
  return { sessionId, soruSayisi: plan.secim.questions.length };
}

/**
 * Koşunun satırını işlem sonuna kadar kilitler ve aşama açmanın koşullarını
 * İŞLEMİN İÇİNDE yeniden denetler: koşu sürüyor, açık aşama yok.
 *
 * Dışarıdaki denetim yetmiyor: çift tıklama ya da iki sekmede ikisi de
 * "açık aşama yok" görüp aynı aşamayı iki kez açıyordu. Kapı kararı da
 * (kararIsle) aynı satırı kilitliyor; karar ile aşama açma sıraya girer.
 */
async function kosuyuKilitle(tx: Prisma.TransactionClient, runId: string) {
  await tx.$queryRaw`SELECT id FROM "LevelRun" WHERE id = ${runId} FOR UPDATE`;
  const run = await tx.levelRun.findUniqueOrThrow({
    where: { id: runId },
    select: {
      status: true,
      pendingRemedialIds: true,
      _count: { select: { stages: { where: { status: "IN_PROGRESS" } } } },
    },
  });
  if (run.status !== "IN_PROGRESS") throw new CheckupError("Bu deneme kapandı.");
  if (run._count.stages > 0) throw new CheckupError("Önce yarım kalan aşamayı bitirmelisin.");
  return run;
}

/**
 * Bekleyen telafi (teyit) turunu açar — öğrenci "devam" dediğinde.
 *
 * Tur, eksik kazanımlardan bu denemede gösterilmemiş sorularla KISMİ
 * açılabilir: tek sorulu kazanımın yeni sorusu yoktur. Bulunan soru
 * sayısıyla kapının kısa devresi yeniden hesaplanır (seviye1AnaKarar
 * `bulunabilir`):
 *  - hiç soru yoksa karar turu beklemeden verilir (telafiKarar(ana, 0));
 *  - bulunanların tamamı doğru olsa bile baraj aşılamıyorsa tur açılmaz;
 *  - ikisi de değilse tur bulunan sorularla açılır.
 * Eskiden sıfır soruda "havuzda soru yok" hatası veriliyor, koşu bekleyen
 * turla kilitleniyordu: "Devam et" her seferinde aynı hatayı döndürüyordu.
 *
 * @returns Açılan turun oturumu; tur açılmadan karar verildiyse null
 *          (çağıran deneme sayfasına döner, sıradaki adımı orası söyler).
 */
export async function telafiyiAc(runId: string, userId: string): Promise<string | null> {
  const run = await prisma.levelRun.findUnique({
    where: { id: runId },
    select: {
      userId: true,
      status: true,
      examScope: true,
      pendingRemedialIds: true,
      stages: {
        select: {
          status: true,
          stageLevel: true,
          stageKind: true,
          result: { select: { correctCount: true, wrongCount: true, blankCount: true } },
          items: { select: { questionId: true } },
        },
      },
    },
  });
  if (!run || run.userId !== userId) throw new CheckupError("Deneme bulunamadı.");
  if (run.status !== "IN_PROGRESS") throw new CheckupError("Bu deneme kapandı.");
  if (run.pendingRemedialIds.length === 0) {
    throw new CheckupError("Bekleyen telafi turu yok.");
  }
  if (run.stages.some((s) => s.status === "IN_PROGRESS")) {
    throw new CheckupError("Önce yarım kalan aşamayı bitirmelisin.");
  }

  const scope = run.examScope as ExamScopeValue;
  const ayar = ayarGetir(scope);
  const paket = await seviyeliPaket(scope);
  const gosterilmis = run.stages.flatMap((s) => s.items.map((i) => i.questionId));
  const plan = await asamaSec({
    userId,
    scope,
    level: 1,
    kind: "REMEDIAL",
    objectiveIds: run.pendingRemedialIds,
    gosterilmis,
  });

  // Kapı ana turun sonucuna bakar (telafi birleşik oranı da ana turdan başlar).
  const anaAsama = run.stages.find((s) => s.stageLevel === 1 && s.stageKind === "MAIN" && s.result);
  const ana = anaAsama?.result;
  const anaDogru = ana?.correctCount ?? 0;
  const anaToplam = ana ? ana.correctCount + ana.wrongCount + ana.blankCount : 0;
  const karar = seviye1AnaKarar(anaDogru, anaToplam, run.pendingRemedialIds, ayar, plan.secim.questions.length);

  if (karar.tur !== "TELAFI") {
    // Tur açılmadan karar: aşamasız kapı kaydı (kararIsle `asama` vermeden).
    // Bekleyen listeyi o tüketir; "Devam"a iki kez basılınca ikinci kez yazmaz.
    await kararIsle(runId, 1, karar, { dogru: anaDogru, toplam: anaToplam });
    return null;
  }

  // Tur ve bekleyen listenin temizlenmesi birlikte: biri yazılıp öteki
  // yazılamazsa ya tur iki kez açılır ya da bekleyen liste askıda kalır.
  return prisma.$transaction(async (tx) => {
    await baslatmaKilidi(tx, userId);
    const kilitli = await kosuyuKilitle(tx, runId);
    if (kilitli.pendingRemedialIds.length === 0) throw new CheckupError("Bekleyen telafi turu yok.");
    const sessionId = await asamaYaz(tx, { runId, userId, paketId: paket.id, plan });
    await tx.levelRun.update({ where: { id: runId }, data: { pendingRemedialIds: [] } });
    return sessionId;
  });
}

/**
 * Süren koşuları ve açık aşamalarını BIRAKILDI (ABANDONED) işaretler
 * (çağıranın işleminin içinde). Açık aşama puanlanmaz: yarıda bırakılan
 * aşamanın sonucu karneye girmez, süresi dolunca da cron onu puanlamaz.
 * Bekleyen teyit turu listesi boşalır: alıştırma o kazanımların maddelerini
 * "teyit bekliyor" diye tutmasın (lib/practice.ts korunanlar).
 */
async function kosulariBirak(
  tx: Prisma.TransactionClient,
  where: Prisma.LevelRunWhereInput
): Promise<number> {
  const kosular = await tx.levelRun.findMany({
    where: { ...where, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (kosular.length === 0) return 0;
  const idler = kosular.map((k) => k.id);
  await tx.checkupSession.updateMany({
    where: { levelRunId: { in: idler }, status: "IN_PROGRESS" },
    data: { status: "ABANDONED" },
  });
  const r = await tx.levelRun.updateMany({
    where: { id: { in: idler }, status: "IN_PROGRESS" },
    data: { status: "ABANDONED", finishedAt: new Date(), pendingRemedialIds: [] },
  });
  return r.count;
}

/**
 * Öğrenci denemeyi bırakır (karnedeki "Bu denemeyi bırak", onaydan sonra).
 *
 * Koşu silinmez: karnede "bırakıldı" olarak durur, geçmişte görünür.
 * Yeni koşu açmayı engellemez.
 */
export async function kosuyuBirak(runId: string, userId: string): Promise<void> {
  const run = await prisma.levelRun.findUnique({
    where: { id: runId },
    select: { userId: true, status: true },
  });
  if (!run || run.userId !== userId) throw new CheckupError("Deneme bulunamadı.");
  if (run.status !== "IN_PROGRESS") throw new CheckupError("Bu deneme zaten kapandı.");
  /*
   * Kullanıcı kilidiyle: öbür sekmede aynı anda "Devam" (asamaAc) denirse ya
   * aşama önce açılır ve burada o da bırakılır, ya da bırakma önce olur ve
   * aşama açılmaz. Kilitsiz, bırakılan koşuda açık bir aşama kalabiliyordu.
   */
  await prisma.$transaction(async (tx) => {
    await baslatmaKilidi(tx, userId);
    await kosulariBirak(tx, { id: runId, userId });
  });
}

/** Aşamasız koşu bu kadar eskiyse sahipsiz sayılır (yazılırken yakalanmasın). */
const SAHIPSIZ_KOSU_ESIGI_MS = 60 * 60_000;

/**
 * Veri onarımı: aşamasız, bir saatten eski ve süren koşuları siler.
 *
 * Koşu ile ilk aşama artık tek işlemde yazılıyor; bu satırlar eski koddan
 * kaldı (havuz yetmeyince koşu yazılıp aşama açılamıyordu). "Bugün" kartı
 * onları her gün "Seviye 1 seni bekliyor" diye gösteriyordu. İçlerinde
 * çözülmüş hiçbir şey yok: silmek veri kaybı değil. Cron'dan çağrılır.
 *
 * @returns Silinen koşu sayısı.
 */
export async function sahipsizKosulariSil(simdi: Date = new Date()): Promise<number> {
  const r = await prisma.levelRun.deleteMany({
    where: {
      status: "IN_PROGRESS",
      stages: { none: {} },
      startedAt: { lt: new Date(simdi.getTime() - SAHIPSIZ_KOSU_ESIGI_MS) },
    },
  });
  return r.count;
}

/**
 * Bir aşama bitti — kapıyı değerlendir, zinciri ilerlet.
 *
 * Oturumun kendisi `submitCheckup` ile kapatılmış olmalı; burada yalnızca
 * sonucuna bakılıyor. Çağıran: submitCheckup (sonucu yazan çağrı, öğrencinin
 * "Bitir"i de cron'un süre dolumu da) ve bakım onarımı (seviyeliKapilariOnar).
 *
 * İDEMPOTENT: karar her çağrıda hesaplanıp döner, ama koşuya yalnızca bir
 * kez yazılır (kararIsle). İkinci çağrı, karne ekranının ya da testin
 * yeniden sorması zinciri iki adım ilerletmez.
 */
export async function asamaDegerlendir(sessionId: string, userId: string): Promise<KapiKarari> {
  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      startedAt: true,
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

  await kararIsle(run.id, seviye, karar, { dogru, toplam }, { id: session.id, startedAt: session.startedAt });
  return karar;
}

/** gateLog'un bir satırı. `sessionId` 22 Ekim 2026'dan önceki kayıtlarda yok. */
interface KapiKaydi {
  sessionId?: string;
  seviye: number;
  karar: KapiKarari["tur"];
  dogru: number;
  toplam: number;
  zaman: string;
  sebep?: string;
}

function kapiKayitlari(gateLog: unknown): KapiKaydi[] {
  return Array.isArray(gateLog) ? (gateLog as KapiKaydi[]) : [];
}

/**
 * Kapı kararını LevelRun'a yazar; yazdıysa true.
 *
 * `asama`: kararı veren aşama (oturum). Verilmezse karar bir aşamadan
 * değil, telafi turu AÇILMADAN bekleyen listeden verildi (telafiyiAc: havuz
 * yetmedi ya da baraj aşılamaz).
 *
 * Hiçbir şey YAZMAZ (false döner) eğer:
 *  - koşu artık sürmüyorsa (bitti, durdu, bırakıldı);
 *  - aşamalı kararda: bu aşamanın kaydı zaten varsa (gateLog'da sessionId,
 *    ikinci değerlendirme) ya da bu aşamadan SONRA açılmış bir aşama varsa
 *    (karar eskidi: eski kusur yüzünden kapısı değerlendirilmeden kalan bir
 *    aşamanın ardından aynı seviye yeniden açıldıysa, onarım eski aşama için
 *    zinciri ilerletmesin);
 *  - aşamasız kararda: bekleyen telafi listesi boşsa (karar onu tüketir;
 *    "Devam"a iki kez basılınca ikinci karar yazılmasın).
 *
 * Denetim ve yazım aynı işlemde, koşunun satırı kilitli: bitişteki
 * değerlendirme ile bakım onarımı aynı anda gelse de tek kayıt düşer.
 */
async function kararIsle(
  runId: string,
  seviye: Seviye,
  karar: KapiKarari,
  olcum: { dogru: number; toplam: number },
  asama?: { id: string; startedAt: Date }
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "LevelRun" WHERE id = ${runId} FOR UPDATE`;
    const mevcut = await tx.levelRun.findUniqueOrThrow({
      where: { id: runId },
      select: {
        status: true,
        gateLog: true,
        reachedLevel: true,
        pendingRemedialIds: true,
        stages: asama
          ? { where: { id: { not: asama.id }, startedAt: { gt: asama.startedAt } }, select: { id: true }, take: 1 }
          : { select: { id: true }, take: 0 },
      },
    });

    const kayit = kapiKayitlari(mevcut.gateLog);
    if (mevcut.status !== "IN_PROGRESS") return false;
    if (asama) {
      if (kayit.some((k) => k.sessionId === asama.id)) return false;
      if (mevcut.stages.length > 0) return false;
    } else if (mevcut.pendingRemedialIds.length === 0) {
      return false;
    }

    kayit.push({
      ...(asama ? { sessionId: asama.id } : {}),
      seviye,
      karar: karar.tur,
      dogru: olcum.dogru,
      toplam: olcum.toplam,
      zaman: new Date().toISOString(),
      ...(karar.tur === "DUR" ? { sebep: karar.sebep } : {}),
    });

    if (karar.tur === "SONRAKI_SEVIYE") {
      await tx.levelRun.update({
        where: { id: runId },
        data: {
          unlockedLevel: karar.seviye,
          reachedLevel: Math.max(mevcut.reachedLevel, karar.seviye),
          gateLog: kayit as never,
          pendingRemedialIds: [],
        },
      });
      return true;
    }

    if (karar.tur === "TELAFI") {
      /*
       * Tur HEMEN AÇILMIYOR. Şema "ekrana uyarı gelir" diyor: öğrenci neden
       * ek soru çözdüğünü bilmeden soruyla karşılaşmamalı. Ayrıca sayaç
       * "devam" dediğinde başlamalı, karne ekranını okurken değil.
       */
      await tx.levelRun.update({
        where: { id: runId },
        data: { gateLog: kayit as never, pendingRemedialIds: karar.eksikObjectiveIds },
      });
      return true;
    }

    await tx.levelRun.update({
      where: { id: runId },
      data: {
        status: karar.tur === "BITTI" ? "COMPLETED" : "STOPPED",
        stoppedAtLevel: karar.tur === "DUR" ? karar.seviye : null,
        finishedAt: new Date(),
        gateLog: kayit as never,
        pendingRemedialIds: [],
      },
    });
    return true;
  });
}

/** Bir bakım çağrısında en fazla kaç koşuya bakılır. */
const ONARIM_KOSU_SINIRI = 200;

/**
 * Bakım (cron): kapısı değerlendirilmeden kalmış seviyeli koşuları onarır.
 *
 * Eskiden kapı yalnızca öğrencinin "Bitir"inde değerlendiriliyordu; süresi
 * dolup cron'la puanlanan aşamanın kapısına kimse bakmıyordu. Koşu
 * "sürüyor" kalıyor, karne "Seviye 0" diyordu ve aynı seviye yeniden
 * açılıyordu. Artık kapı submitCheckup'ta; bu iş eski kayıtları ve bitişte
 * düşen değerlendirmeleri toplar.
 *
 * Aday: koşu sürüyor, açık (IN_PROGRESS) aşama yok, son biten aşamanın
 * sonucu var ama gateLog kaydı yok. Kayıt sessionId'yle aranır; sessionId
 * taşımayan eski günlükte satır sayısına bakılır (her biten aşama bir satır
 * yazar: satır sayısı biten aşama sayısından azsa son aşama değerlendirilmemiş).
 * Eski kusur yüzünden ARADA bir aşama atlandıysa sayı yanıltır; o yüzden son
 * aşama başladıktan sonra yazılmış bir satır da "değerlendirilmiş" sayılır
 * (aşamalar sırayla açılır: o satır ancak bu aşamanındır).
 */
export async function seviyeliKapilariOnar(): Promise<{ bakilan: number; onarilan: number; hatali: number }> {
  const kosular = await prisma.levelRun.findMany({
    where: { status: "IN_PROGRESS", stages: { none: { status: "IN_PROGRESS" } } },
    orderBy: { startedAt: "asc" },
    take: ONARIM_KOSU_SINIRI,
    select: {
      id: true,
      userId: true,
      gateLog: true,
      stages: {
        where: { status: { in: ["SUBMITTED", "EXPIRED"] } },
        orderBy: { startedAt: "asc" },
        select: { id: true, startedAt: true, result: { select: { id: true } } },
      },
    },
  });

  let onarilan = 0;
  let hatali = 0;
  for (const k of kosular) {
    const son = k.stages.at(-1);
    // Sonucu yazılamamış aşamanın kapısı değerlendirilemez (ölçüm yok); öğrenci
    // devam dediğinde aynı seviye yeniden açılır.
    if (!son?.result) continue;
    const kayit = kapiKayitlari(k.gateLog);
    const degerlendirildi = kayit.some((g) => g.sessionId)
      ? kayit.some((g) => g.sessionId === son.id)
      : kayit.length >= k.stages.length ||
        kayit.some((g) => Date.parse(g.zaman) >= son.startedAt.getTime());
    if (degerlendirildi) continue;
    try {
      await asamaDegerlendir(son.id, k.userId);
      onarilan += 1;
    } catch (e) {
      hatali += 1;
      console.error("[seviyeliKapilariOnar] kapı değerlendirilemedi:", k.id, son.id, e);
    }
  }
  if (hatali > 0) {
    throw new Error(`${hatali} koşunun kapısı değerlendirilemedi (${onarilan} onarıldı).`);
  }
  return { bakilan: kosular.length, onarilan, hatali };
}
