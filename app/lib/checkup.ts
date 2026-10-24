import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { parseQuestionContent, type QuestionContent } from "@/lib/question-content";
import {
  selectQuestionsForMock,
  selectQuestionsForPackage,
  selectQuestionsForTopic,
  type SelectionResult,
} from "@/lib/question-selection";
import { scoreCheckup, type ScoredAnswer, type CheckupScore } from "@/lib/scoring";
import { checkPackageAccess } from "@/lib/entitlements";
import { planOlustur, retestIsiniKapat } from "@/lib/plan";
import { konuSinavdaMi } from "@/lib/exam-scope";
import { examShort } from "@/lib/exams";
import { defteriGuncelle, dogruCikanlariKapat } from "@/lib/notebook";
import { isaretsiz } from "@/lib/insights";
// İnceleme (getCheckupReview) için: video, kazanım özeti, bildirim ve koça soru durumu.
import { parseVideoUrl, safeParseQuestionContent, type VideoRef } from "@/lib/question-content";
import { raporDurumlari } from "@/lib/hata-bildirimi";
import { kocaSoruDurumlari } from "@/lib/koca-soru";
import type { KocaSoruDurumu, RaporDurumu } from "@/lib/bildirim-kurallari";
import {
  DENEME_HAZIRLANIYOR,
  KAGIT_ISLEME_SURESI_SAAT,
  kagittaCozulebilir,
  karsilastir,
  type HavuzKaydi,
  type Karsilastirma,
} from "@/lib/deneme";
import { sureAnalizi, type SureAnaliziSonucu } from "@/lib/sure-analizi";
import { maruziyetiYaz } from "@/lib/maruziyet";

/**
 * Check-up akışı: başlat → cevapla → bitir.
 *
 * ⚠️ CEVAP ANAHTARI: öğrenciye giden hiçbir yapıda `isCorrect` veya `errorType`
 * bulunmaz. Bunu "alanları tek tek seçerek" sağlıyoruz; veritabanı satırını
 * asla yaymıyoruz (`...question` YAZMA). scripts/leak-test.mts bunu denetler.
 */

/**
 * Hatanın türü — mesaj öğrenciye gider, kod istemcinin ne yapacağını söyler.
 * KAPANDI ve SURE_DOLDU kalıcıdır: aynı isteği tekrar denemek işe yaramaz,
 * sınav ekranı tekrar denemeyi bırakıp testi bitirmeye geçer.
 */
export type CheckupErrorCode = "GECERSIZ" | "KAPANDI" | "SURE_DOLDU";

export class CheckupError extends Error {
  code: CheckupErrorCode;
  constructor(message: string, code: CheckupErrorCode = "GECERSIZ") {
    super(message);
    this.name = "CheckupError";
    this.code = code;
  }
}

/**
 * Süre bittikten sonra cevap kaydı için tolerans.
 *
 * İstemcinin sayacı sayfa TARAYICIDA açıldığında başlıyor; sunucunun saati ise
 * sayfayı çizdiği anda. Aradaki fark (indirme + hidrasyon, yavaş telefonda
 * birkaç saniye) kadar istemci sayacı geç biter. Son saniyede işaretlenen
 * cevap sunucuya "süre doldu"dan sonra varıyor ve öğrencinin ekranda seçili
 * gördüğü cevap boş sayılıyordu. Tolerans yalnızca kayıt için: süre bitince
 * istemci zaten testi kendisi bitiriyor.
 */
export const KAYIT_TOLERANSI_MS = 15_000;

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
  /** Alıştırma (PRACTICE) sınav ekranında açılmaz, kendi ekranına gider. */
  kind: "PACKAGE" | "TOPIC_RETEST" | "LEVEL_STAGE" | "PRACTICE";
  /** Kâğıt oturumu sayaçlı ekran yerine optik formu açar. */
  mode: "ONLINE" | "PAPER";
  packageName: string;
  packageSlug: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED" | "ABANDONED";
  /** Seviyeli check-up aşamasıysa bağlı olduğu deneme — bitince oraya dönülür. */
  levelRunId: string | null;
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
 * başlatmak, hem soruları hem süreyi çöpe atmaktır. Açık oturum hangi
 * biçimdeyse (ekran / kâğıt) o döner; istenen biçim yalnızca yeni oturumda.
 *
 * `mode: "PAPER"`: kitapçık yazdırılır, sayaç çalışmaz; expiresAt cevapları
 * optik forma işlemenin son anıdır (lib/deneme.ts KAGIT_ISLEME_SURESI_SAAT).
 */
export async function startCheckup(
  userId: string,
  packageSlug: string,
  secenek: { mode?: "ONLINE" | "PAPER" } = {}
): Promise<string> {
  const mode = secenek.mode ?? "ONLINE";
  const pkg = await prisma.package.findUnique({
    where: { slug: packageSlug },
    select: {
      id: true,
      kind: true,
      status: true,
      questionCount: true,
      durationMinutes: true,
      penaltyRatio: true,
      isFree: true,
    },
  });

  if (!pkg) throw new CheckupError("Paket bulunamadı.");
  if (pkg.status !== "PUBLISHED") throw new CheckupError("Bu paket şu anda yayında değil.");
  /*
   * Seviyeli check-up ve konu tekrar paketlerinin konu dağılımı yok: bu
   * akışla başlatılınca SIFIR soruluk oturum açılıyor, sınav ekranı
   * çöküyordu. Onların kendi giriş yolları var (lib/level-run.ts,
   * startTopicRetest). test:leak denetliyor.
   */
  if (pkg.kind === "LEVEL") {
    throw new CheckupError("Seviyeli check-up kendi sayfasından başlar.");
  }
  if (pkg.kind === "RETEST") {
    throw new CheckupError("Kontrol testi planındaki konudan başlar.");
  }
  if (pkg.kind === "PRACTICE") {
    throw new CheckupError("Alıştırma sonuç ekranından ya da yanlış defterinden başlar.");
  }
  // Bugün yukarıdaki üç ret yüzünden ulaşılmıyor; yeni bir tür eklenirse
  // kâğıt kendiliğinden açılmasın diye ayrı kapı.
  if (mode === "PAPER" && !kagittaCozulebilir(pkg.kind)) {
    throw new CheckupError("Bu test kâğıtta çözülemez.");
  }

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

  let selection: SelectionResult;
  if (pkg.kind === "MOCK") {
    // Deneme: sabit liste, sırası korunur. Liste eksikse ya da içinde
    // yayında olmayan soru varsa deneme açılmaz (lib/deneme.ts).
    const deneme = await selectQuestionsForMock(pkg.id, pkg.questionCount);
    if (!deneme.hazir) throw new CheckupError(DENEME_HAZIRLANIYOR);
    selection = { questions: deneme.questions, shortfalls: [], relaxedExposureCount: 0 };
  } else {
    selection = await selectQuestionsForPackage(pkg.id, userId);
  }

  // Eksik soruyla test başlatmak öğrenciye yanlış sonuç vermektir (PLAN §5).
  // Dağılımı boş bir paket de sessizce sıfır soruluk test açmasın.
  if (selection.questions.length === 0) {
    throw new CheckupError("Bu pakette henüz soru yok. Lütfen daha sonra deneyin.");
  }
  if (selection.shortfalls.length > 0) {
    const detail = selection.shortfalls
      .map((s) => `${s.got}/${s.requested}`)
      .join(", ");
    throw new CheckupError(
      `Bu paket için soru havuzu yetersiz (${detail}). Lütfen daha sonra deneyin.`
    );
  }

  // Kâğıtta sayaç yok: son an, cevapları optik forma işleme süresi. Önerilen
  // süre (durationMinutes) yine kopyalanır; kitapçıkta yazar.
  const expiresAt = new Date(
    now.getTime() +
      (mode === "PAPER" ? KAGIT_ISLEME_SURESI_SAAT * 3_600_000 : pkg.durationMinutes * 60_000)
  );

  return prisma.$transaction(async (tx) => {
    const session = await tx.checkupSession.create({
      data: {
        userId,
        packageId: pkg.id,
        mode,
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

    // Tekrar kaydı: aynı soru 30 gün içinde tekrar gelmesin (lib/maruziyet.ts).
    await maruziyetiYaz(tx, userId, selection.questions.map((q) => q.id), now);

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
    select: { id: true, name: true, examScope: true, examScopes: true },
  });
  if (!konu) throw new CheckupError("Konu bulunamadı.");

  /*
   * Konu öğrencinin sınavında olmalı (tanım lib/exam-scope.ts). Hedefini
   * TYT'den LGS'ye çeviren öğrenci, TYT'de ölçtüğü bir konunun kontrol
   * testini LGS paketiyle açabiliyordu ve kapsamı boş TYT soruları LGS
   * kontrol testine doluyordu. test:leak denetliyor.
   */
  if (!konuSinavdaMi(konu, examScope)) {
    throw new CheckupError(
      `${konu.name}, ${examShort(examScope)} konuları arasında değil. Kontrol testi yalnızca sınavındaki konularda açılır.`
    );
  }

  const now = new Date();

  /*
   * Aynı konuda açık bir tekrar testi varsa ona devam et. Günlük sınırdan
   * ÖNCE: sınırı dolduran öğrenci, açık bıraktığı teste geri dönemiyordu
   * ("hakkın doldu" diyordu, oysa yeni test açmıyordu).
   */
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
  // Alıştırma ölçüm değil: konuyu "ölçülmüş" yapmaz.
  const olculdu = await prisma.sessionItem.findFirst({
    where: {
      session: { userId, status: "SUBMITTED", kind: { not: "PRACTICE" } },
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

  const secim = await selectQuestionsForTopic(topicId, paket.questionCount, userId, examScope);
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

    await maruziyetiYaz(tx, userId, secim.questions.map((q) => q.id), now);

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
      kind: true,
      mode: true,
      status: true,
      durationMinutes: true,
      startedAt: true,
      expiresAt: true,
      levelRunId: true,
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
    kind: session.kind,
    mode: session.mode,
    packageName: session.package.name,
    packageSlug: session.package.slug,
    status: session.status,
    levelRunId: session.levelRunId,
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

/**
 * Kâğıt oturumunun yazdırılacak kitapçığı (/kitapcik/[sessionId]).
 *
 * ⚠️ getStudentSession'ın kuralları burada da: alanlar tek tek seçilir; cevap
 * anahtarı (isCorrect), hata tipi, çözüm, ipucu ve video YOK — kitapçık
 * yazdırılıp paylaşılabilen bir belge. Şık kimliği de yok: kâğıtta gerekmez,
 * işaretleme optik formda harfle yapılır. leak-test denetler.
 *
 * Yalnızca KÂĞIT oturumu: ekranda çözülen süreli testin soruları yazdırılıp
 * sayaç dışında çözülmesin. Başkasının oturumu ve ekran oturumu aynı
 * "bulunamadı" hatasını alır (oturumun varlığını doğrulamayalım).
 */
export interface KitapcikSorusu {
  order: number;
  stem: QuestionContent;
  choices: { label: string; content: QuestionContent }[];
}

export interface Kitapcik {
  id: string;
  packageName: string;
  examScope: string;
  studentName: string;
  status: StudentSession["status"];
  startedAt: Date;
  /** Cevapları optik forma işlemenin son anı. */
  expiresAt: Date;
  /** Önerilen süre (dakika). */
  durationMinutes: number;
  penaltyRatio: number;
  questions: KitapcikSorusu[];
}

export async function getKitapcik(sessionId: string, userId: string): Promise<Kitapcik> {
  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      mode: true,
      status: true,
      startedAt: true,
      expiresAt: true,
      durationMinutes: true,
      penaltyRatio: true,
      user: { select: { name: true } },
      package: { select: { name: true, examScope: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          question: {
            select: {
              stem: true,
              choices: {
                orderBy: { sortOrder: "asc" },
                // ⚠️ isCorrect ve errorType BİLİNÇLİ OLARAK YOK.
                select: { label: true, content: true },
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.userId !== userId || session.mode !== "PAPER") {
    throw new CheckupError("Kitapçık bulunamadı.");
  }

  return {
    id: session.id,
    packageName: session.package.name,
    examScope: session.package.examScope,
    studentName: session.user.name,
    status: session.status,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    durationMinutes: session.durationMinutes,
    penaltyRatio: Number(session.penaltyRatio),
    questions: session.items.map((item) => ({
      order: item.sortOrder,
      stem: parseQuestionContent(item.question.stem),
      choices: item.question.choices.map((c) => ({
        label: c.label,
        content: parseQuestionContent(c.content),
      })),
    })),
  };
}

/**
 * Sınav ekranının sunucuyla eşitlenmesi için hafif okuma: durum, kalan süre
 * ve öğrencinin KENDİ işaretleri.
 *
 * Neden gerekli: Next geri/ileri gezinmede sayfanın eski çıktısını
 * önbellekten geri getiriyor. "Çık" deyip panoya giden ve geri tuşuyla dönen
 * öğrencinin ekranı ilk açılıştaki kalan süreyi ve işaretleri gösteriyordu —
 * sayaç fazla süre gösteriyor, sonradan işaretlenen cevaplar boş görünüyordu.
 *
 * ⚠️ Cevap anahtarı YOK: yalnızca seçilen şıkkın kimliği. leak-test denetler.
 */
export interface SessionState {
  status: StudentSession["status"];
  remainingMs: number;
  /** Bitmiş testte öğrencinin gideceği yer. */
  target: string;
  selections: Record<string, string | null>;
}

export async function getSessionState(sessionId: string, userId: string): Promise<SessionState> {
  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      kind: true,
      status: true,
      expiresAt: true,
      levelRunId: true,
      result: { select: { id: true } },
      items: { select: { questionId: true, answer: { select: { choiceId: true } } } },
    },
  });
  if (!session || session.userId !== userId) throw new CheckupError("Oturum bulunamadı.");

  // Sonucu yazılamamış kapalı oturum (EXPIRED) için sonuç sayfası 404 olurdu.
  // Alıştırmanın sonucu yok; kendi ekranı özetini gösteriyor.
  const target =
    session.kind === "PRACTICE"
      ? `/alistirma/${sessionId}`
      : session.levelRunId
        ? `/seviye/${session.levelRunId}`
        : session.result
          ? `/sonuc/${sessionId}`
          : "/panel";

  return {
    status: session.status,
    remainingMs: Math.max(0, session.expiresAt.getTime() - Date.now()),
    target,
    selections: Object.fromEntries(
      session.items.map((i) => [i.questionId, i.answer?.choiceId ?? null])
    ),
  };
}

// ─────────────────────────────────────────────────────────────
// Cevapla
// ─────────────────────────────────────────────────────────────

/**
 * Bir cevabın doğruluğu: seçilen şıkkın GÜNCEL anahtarı; boşta null.
 *
 * Tek tanım; cevap kaydı (saveAnswer), bitiş ve yeniden puanlama
 * (sonucuHesapla) bunu kullanır. Kayıt anındaki değer Answer.isCorrect'e
 * yazılır ama son söz bitişindir: test açıkken panelde anahtar düzeltilirse
 * bitiş güncel anahtarla puanlar, bitmiş testi de bakım yeniden puanlar.
 */
function cevapDogruMu(secilen: { isCorrect: boolean } | null | undefined): boolean | null {
  return secilen ? secilen.isCorrect : null;
}

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
      session: { select: { status: true, expiresAt: true, kind: true, mode: true } },
      answer: { select: { id: true, firstAnsweredAt: true } },
    },
  });

  if (!item) throw new CheckupError("Soru bu oturuma ait değil.");
  /*
   * Alıştırmanın cevabı yalnızca kendi yolundan yazılır (answerPractice):
   * orada cevap ilk kayıtta KİLİTLENİR. Buradan yazılabilseydi öğrenci
   * çözümü gördükten sonra işaretini değiştirebilirdi.
   */
  if (item.session.kind === "PRACTICE") throw new CheckupError("Bu oturum bir alıştırma.");
  if (item.session.status !== "IN_PROGRESS") throw new CheckupError("Bu test kapandı.", "KAPANDI");
  if (item.session.expiresAt.getTime() + KAYIT_TOLERANSI_MS < Date.now()) {
    throw new CheckupError("Süre doldu.", "SURE_DOLDU");
  }

  let isCorrect: boolean | null = null;
  if (choiceId) {
    // Şık gerçekten bu soruya mı ait? Aksi halde başka bir sorunun doğru
    // şıkkının id'si gönderilerek puan alınabilir.
    const choice = await prisma.choice.findFirst({
      where: { id: choiceId, questionId },
      select: { isCorrect: true },
    });
    if (!choice) throw new CheckupError("Geçersiz şık.");
    isCorrect = cevapDogruMu(choice);
  }

  /*
   * Kâğıt oturumunda soru başına süre ve çözüm sırası YOK: optik form
   * sonradan, istenen sırayla doldurulur. İstemci ne gönderirse göndersin
   * süre 0 yazılır ve ilk işaret anı tutulmaz (süre analizi bunlara bakar).
   */
  const kagit = item.session.mode === "PAPER";
  const sure = kagit ? 0 : timeSpentMs;
  const simdi = new Date();
  const ilkIsaret = !kagit && choiceId !== null ? simdi : null;

  /*
   * Tek upsert: eskiden "cevap var mı" diye okuyup ona göre create/update
   * yapılıyordu. Hızlı iki dokunuşta iki istek de "yok" görüp create deniyor
   * ve ikincisi benzersizlik hatasıyla düşüyordu — öğrencinin işareti
   * sessizce kayboluyordu.
   */
  await prisma.answer.upsert({
    where: { sessionItemId: item.id },
    create: { sessionItemId: item.id, choiceId, isCorrect, timeSpentMs: sure, firstAnsweredAt: ilkIsaret, answeredAt: simdi },
    update: {
      choiceId,
      isCorrect,
      timeSpentMs: sure,
      changedCount: { increment: 1 },
      answeredAt: simdi,
    },
  });

  /*
   * İlk işaret anı yalnızca BİR KEZ yazılır: sonraki değişiklikler onu
   * oynatmaz (çözüm sırası analizi "ilk ne zaman işaretledi"ye bakıyor,
   * answeredAt her değişiklikte ilerliyor). Satır işaretsiz açılmışsa ilk
   * işarette doldurulur; koşul veritabanında, eşzamanlı iki istek de ilkini ezmez.
   */
  if (ilkIsaret && item.answer && !item.answer.firstAnsweredAt) {
    await prisma.answer.updateMany({
      where: { sessionItemId: item.id, firstAnsweredAt: null },
      data: { firstAnsweredAt: ilkIsaret },
    });
  }
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

/** Puanlamanın bir sorudan gördüğü. */
export interface PuanlananMadde {
  questionId: string;
  /** Cevap satırı; hiç dokunulmamış soruda null. */
  answerId: string | null;
  choiceId: string | null;
  /** Kayıttaki doğruluk (Answer.isCorrect). */
  kayitli: boolean | null;
  /** Seçilen şıkkın GÜNCEL anahtarına göre doğruluk; boşta null (cevapDogruMu). */
  dogru: boolean | null;
}

export interface HesaplananSonuc {
  score: CheckupScore;
  maddeler: PuanlananMadde[];
}

/**
 * Bir oturumun sonucunu GÜNCEL cevap anahtarıyla hesaplar; hiçbir şey yazmaz.
 *
 * Bitiş (submitCheckup) ve yeniden puanlama (yenidenPuanla) bu tek hesabı
 * kullanır: iki ayrı yazım er geç ayrışır ve yeniden puanlanan sonuç, aynı
 * cevaplarla bugün bitirilen testten farklı çıkardı. `db` işlem içinden
 * çağrılabilsin diye parametre.
 */
export async function sonucuHesapla(
  sessionId: string,
  db: Prisma.TransactionClient = prisma
): Promise<HesaplananSonuc> {
  const s = await db.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      penaltyRatio: true,
      items: {
        orderBy: { sortOrder: "asc" },
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
          answer: {
            select: {
              id: true,
              isCorrect: true,
              timeSpentMs: true,
              choiceId: true,
              choice: { select: { isCorrect: true } },
            },
          },
        },
      },
    },
  });
  if (!s) throw new CheckupError("Oturum bulunamadı.");

  const maddeler: PuanlananMadde[] = s.items.map((item) => ({
    questionId: item.questionId,
    answerId: item.answer?.id ?? null,
    choiceId: item.answer?.choiceId ?? null,
    kayitli: item.answer?.isCorrect ?? null,
    // Cevap satırı yoksa ya da şık seçilmemişse boş bırakılmış demektir.
    dogru: cevapDogruMu(item.answer?.choice),
  }));

  const scored: ScoredAnswer[] = s.items.map((item, i) => ({
    topicId: item.question.topic.id,
    topicSlug: item.question.topic.slug,
    topicName: item.question.topic.name,
    parentId: item.question.topic.parent?.id ?? null,
    parentSlug: item.question.topic.parent?.slug ?? null,
    parentName: item.question.topic.parent?.name ?? null,
    isCorrect: maddeler[i].dogru,
    timeSpentMs: item.answer?.timeSpentMs ?? 0,
    targetTimeSeconds: item.question.targetTimeSeconds,
    recommendedProductIds: item.question.topic.recommendedProductIds,
  }));

  return { score: scoreCheckup(scored, Number(s.penaltyRatio)), maddeler };
}

/**
 * Kayıttaki doğruluğu (Answer.isCorrect) güncel anahtara eşitler; değişen
 * maddeleri döndürür. En fazla üç toplu sorgu (doğru / yanlış / boş).
 */
async function dogruluguEsitle(
  db: Prisma.TransactionClient,
  maddeler: readonly PuanlananMadde[]
): Promise<PuanlananMadde[]> {
  const farkli = maddeler.filter((m) => m.answerId !== null && m.kayitli !== m.dogru);
  for (const deger of [true, false, null] as const) {
    const ids = farkli.filter((m) => m.dogru === deger).map((m) => m.answerId!);
    if (ids.length > 0) {
      await db.answer.updateMany({ where: { id: { in: ids } }, data: { isCorrect: deger } });
    }
  }
  return farkli;
}

/** Sonuç satırının puanlamadan gelen alanları (bitişte yazılır, yeniden puanlamada güncellenir). */
function sonucAlanlari(score: CheckupScore) {
  return {
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
  };
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
      select: { userId: true, status: true, durationMinutes: true, kind: true, mode: true },
    });
    // Alıştırmada süre birleştirme boş cevap satırı açardı; alıştırmada
    // cevap satırı "cevaplandı, çözümü aç" demek (lib/practice.ts).
    if (oturum?.kind === "PRACTICE") throw new CheckupError("Alıştırma bu yolla bitirilmez.");
    // Sessizce geçiyoruz: süre birleştirme başarısız olsa bile test bitmeli.
    // Kâğıtta soru başına süre yok: optik formun ekranda kaldığı süre çözüm
    // süresi değildir, "yavaş" uyarısı üretmesin.
    if (oturum?.userId === userId && oturum.status === "IN_PROGRESS" && oturum.mode !== "PAPER") {
      await sureleriBirlestir(sessionId, oturum.durationMinutes * 60_000, times).catch(() => {});
    }
  }

  const session = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      kind: true,
      focusTopicId: true,
      package: { select: { examScope: true } },
    },
  });

  if (!session) throw new CheckupError("Oturum bulunamadı.");
  if (session.userId !== userId) throw new CheckupError("Oturum bulunamadı.");

  /*
   * Alıştırma PUANLANMAZ: sonuç satırı, soru/şık sayaçları ve plan yalnızca
   * ölçümden çıkar (lib/practice.ts). Bu kapı, ileride biri alıştırmayı
   * yanlışlıkla bu yoldan bitirmeye kalkarsa ölçümü kirletmesin diye.
   */
  if (session.kind === "PRACTICE") throw new CheckupError("Alıştırma bu yolla bitirilmez.");

  if (session.status !== "IN_PROGRESS") {
    const existing = await prisma.checkupResult.findUnique({ where: { sessionId } });
    if (existing) return resultToScore(existing);
    throw new CheckupError("Bu test kapandı.", "KAPANDI");
  }

  /*
   * Doğruluk BİTİŞTE güncel anahtardan hesaplanır (sonucuHesapla). Cevap
   * kaydedildikten sonra panelde anahtar düzeltildiyse kayıttaki eski değer
   * değil, düzeltilmiş anahtar sayılır; kayıt da aşağıda eşitlenir.
   */
  const { score, maddeler } = await sonucuHesapla(sessionId);

  const simdi = new Date();

  try {
    await prisma.$transaction(async (tx) => {
    await tx.checkupSession.update({
      where: { id: sessionId },
      data: { status: "SUBMITTED", submittedAt: simdi },
    });

    // İnceleme ekranı ve defter Answer.isCorrect'i okuyor: sonuçla aynı şeyi söylesinler.
    await dogruluguEsitle(tx, maddeler);

    await tx.checkupResult.create({
      data: {
        sessionId,
        // Pano ve gelişim ekranı toplamları sınava göre ayırabilsin:
        // LGS, TYT ve KPSS sonuçlarını tek bir çizgide toplamak anlamsız.
        examScope: session.package.examScope,
        ...sonucAlanlari(score),
      },
    });

    /*
     * İstatistikler BİTİŞTE güncellenir (her cevap değişikliğinde saysaydık,
     * şık değiştiren öğrenci sayaçları şişirirdi) ve TOPLU yazılır: eskiden
     * 24 soru için 48'e varan ayrı sorgu tek işlemin içinde sıraya giriyordu
     * ve yavaş bağlantıda işlem zaman aşımına uğrayıp bütün bitirme geri
     * alınıyordu — öğrenci testi bitiremiyordu.
     */
    const dogruIds = maddeler.filter((m) => m.dogru === true).map((m) => m.questionId);
    const digerIds = maddeler.filter((m) => m.dogru !== true).map((m) => m.questionId);

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

    const secilenler = maddeler
      .map((m) => m.choiceId)
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
   * Bitişten SONRA, işlemin dışında: oturumun türüne göre üç yol.
   *
   * Bu blok yalnızca sonucu YAZAN çağrıda çalışır: yarışı kaybeden (çift
   * bitirme, cron ile "Bitir" aynı anda) yukarıda erken döndü. Kapı, plan ve
   * kontrol testi işi bu yüzden bir kez işlenir.
   *
   * İşlemin içine almıyoruz — kapı ya da plan başarısız olsa bile öğrencinin
   * sonucu yazılmış olmalı.
   */
  if (session.kind === "LEVEL_STAGE") {
    /*
     * Seviyeli aşama → kapı değerlendirmesi. Eskiden yalnızca öğrencinin
     * "Bitir"inde (eylemde) çalışıyordu: süresi dolan aşamayı cron puanlıyor
     * ama kapıya kimse bakmıyordu; koşu takılıyor, aynı seviye yeniden
     * açılıyordu. Boş aşamada da çalışır: boş bırakmak kapıdan kalmaktır
     * (işaretsiz kuralı kapıya uygulanmaz). Aşamadan plan KURULMAZ: aday
     * sınavın ortasında, "bu hafta şunu çalış" yanlış olur.
     *
     * Dinamik import: level-run.ts bu dosyadan CheckupError alıyor; statik
     * import döngü kurardı.
     */
    try {
      const { asamaDegerlendir } = await import("@/lib/level-run");
      await asamaDegerlendir(sessionId, userId);
    } catch (e) {
      // Bakım işi (level-run.ts seviyeliKapilariOnar) kapısız kalan aşamayı yeniden dener.
      console.error("Seviye kapısı değerlendirilemedi:", sessionId, e);
    }
  } else if (!isaretsiz(score)) {
    /*
     * Hiç işaret konmadan kapanan test (boş gönderim, cron'un kapattığı
     * terk edilmiş test) ölçüm değil: plandaki kontrol testi işini kapatmaz,
     * bütün konuları "zayıf" sayan bir plan kurmaz (lib/insights.ts isaretsiz).
     */
    try {
      if (session.kind === "TOPIC_RETEST") {
        // Plandaki kontrol testi işini kapat (öğrenci elle işaretleyemez).
        if (session.focusTopicId) {
          await retestIsiniKapat({
            userId,
            topicId: session.focusTopicId,
            sessionId,
            now: simdi,
          });
        }
      } else if (session.kind === "PACKAGE") {
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
  }

  /*
   * Yanlış defteri: yanlış ve boşlar aralıklı tekrara girer (lib/notebook.ts).
   * Plandan ayrı korumada: biri başarısız olursa öteki yine yazılsın. İşlev
   * idempotent; aynı test ikinci kez işlense de madde çoğalmaz, ilerleme
   * sıfırlanmaz. Cron'un puanladığı süresi dolmuş testler de buradan geçer;
   * işaretsiz testi defter kendisi atlar.
   */
  try {
    await defteriGuncelle(sessionId);
  } catch (e) {
    console.error("Yanlış defteri güncellenemedi:", e);
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
  questionId: string;
  order: number;
  topicName: string;
  stem: QuestionContent;
  solution: QuestionContent | null;
  choices: ReviewChoice[];
  selectedChoiceId: string | null;
  isCorrect: boolean | null;
  timeSpentMs: number;
  targetTimeSeconds: number;
  /*
   * Aşağıdakiler isteğe bağlı: saf testlerdeki elle kurulan örnekler (smoke,
   * hata deseni) bunları vermiyor. getCheckupReview hepsini doldurur.
   */
  /** Video çözüm; yoksa null. */
  video?: VideoRef | null;
  /** Sorunun kazanımı; özet kartı yoksa ya da bozuksa summary null. */
  objective?: { id: string; name: string; summary: QuestionContent | null } | null;
  /** Öğrencinin bu sorudaki hata bildirimi ve koça sorusu. */
  rapor?: RaporDurumu | null;
  kocaSoru?: KocaSoruDurumu | null;
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
      kind: true,
      status: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          questionId: true,
          question: {
            select: {
              stem: true,
              solution: true,
              videoUrl: true,
              targetTimeSeconds: true,
              topic: { select: { name: true } },
              objective: { select: { id: true, name: true, summary: true } },
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
  // Alıştırmanın kendi geri bildirimi var ve yalnızca CEVAPLANMIŞ soruyu
  // açıyor (lib/practice.ts). Buradan açılsaydı yarım bırakılan alıştırmanın
  // hiç denenmemiş sorularının cevabı görünürdü.
  if (session.kind === "PRACTICE") throw new CheckupError("Alıştırmanın incelemesi kendi ekranında.");

  const soruIdleri = session.items.map((i) => i.questionId);
  const [raporlar, kocaSorulari] = await Promise.all([
    raporDurumlari(userId, soruIdleri),
    kocaSoruDurumlari(userId, soruIdleri),
  ]);

  // Bozuk özet sayfayı düşürmesin: kart çıkmaz, inceleme çalışır.
  const ozet = (summary: unknown): QuestionContent | null => {
    const r = summary ? safeParseQuestionContent(summary) : null;
    return r?.success ? r.data : null;
  };

  return session.items.map((item) => ({
    questionId: item.questionId,
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
    video: parseVideoUrl(item.question.videoUrl),
    objective: item.question.objective
      ? {
          id: item.question.objective.id,
          name: item.question.objective.name,
          summary: ozet(item.question.objective.summary),
        }
      : null,
    rapor: raporlar.get(item.questionId) ?? null,
    kocaSoru: kocaSorulari.get(item.questionId) ?? null,
  }));
}

/**
 * Bir bakım çağrısında en fazla kaç süresi dolmuş oturum işlenir. Uzun bir
 * kesintiden sonra yüzlerce oturum birikmiş olabilir; hepsini tek çağrıda
 * puanlamak çağrıyı zaman aşımına sokar. En eskiler önce, kalanı sonraki
 * çağrıda (15 dakika).
 */
const BAKIM_OTURUM_SINIRI = 200;

/**
 * Süresi dolmuş ama bitirilmemiş oturumları kapatır ve sonuçlarını üretir.
 * Kayıt toleransı içindeki oturumlara dokunmaz: yoldaki son cevap yazılabilsin.
 *
 * Bir oturumun hatası öbürlerini durdurmaz ve YUTULMAZ: oturum kimliğiyle
 * günlüğe yazılır. Eskiden `catch {}` hatayı sessizce EXPIRED'a çeviriyordu;
 * yedek güncelleme de düşerse döngünün geri kalanı hiç çalışmıyordu.
 */
export async function expireStaleSessions(): Promise<number> {
  const stale = await prisma.checkupSession.findMany({
    where: { status: "IN_PROGRESS", expiresAt: { lt: new Date(Date.now() - KAYIT_TOLERANSI_MS) } },
    orderBy: { expiresAt: "asc" },
    take: BAKIM_OTURUM_SINIRI,
    select: { id: true, userId: true, kind: true },
  });

  for (const s of stale) {
    try {
      if (s.kind === "PRACTICE") {
        // Alıştırma puanlanmaz: yalnızca kapanır. Cevaplanan sorular durur,
        // cevaplanmayanların cevabı açılmaz (lib/practice.ts).
        await prisma.checkupSession.updateMany({
          where: { id: s.id, status: "IN_PROGRESS" },
          data: { status: "EXPIRED" },
        });
        continue;
      }
      await submitCheckup(s.id, s.userId);
    } catch (e) {
      console.error("[expireStaleSessions] puanlanamadı:", s.id, e);
      // Yedek: oturum en azından kapansın (sınav ekranı "süre doldu" desin).
      // Koşul IN_PROGRESS: arada öğrenci bitirdiyse SUBMITTED'ı ezmesin.
      try {
        await prisma.checkupSession.updateMany({
          where: { id: s.id, status: "IN_PROGRESS" },
          data: { status: "EXPIRED" },
        });
      } catch (e2) {
        console.error("[expireStaleSessions] kapatılamadı:", s.id, e2);
      }
    }
  }
  return stale.length;
}

// ─────────────────────────────────────────────────────────────
// Yeniden puanlama (cevap anahtarı sonradan düzeltilince)
// ─────────────────────────────────────────────────────────────

/**
 * Bakım yalnızca son bu kadar saatte güncellenmiş sorulara bakar (verim için).
 * Cron 15 dakikada bir çalışıyor; pencere geniş ki birkaç kaçan çağrı ya da
 * bir kesinti düzeltmeyi kaçırmasın.
 */
const YENIDEN_PUANLAMA_PENCERESI_SAAT = 24;
/** Bir çağrıda en fazla kaç oturum; kalanı sonraki çağrıda. */
const YENIDEN_PUANLAMA_OTURUM_SINIRI = 100;

/** CheckupResult.rescoreNote'un biçimi. */
export interface YenidenPuanlamaNotu {
  /** İLK yeniden puanlamadan önceki sonuç; sonraki puanlamalarda korunur. */
  onceki: { dogru: number; yanlis: number; bos: number; net: number };
  /** Anahtarı düzeltilen farklı soru sayısı (bütün yeniden puanlamalar boyunca). */
  soruSayisi: number;
  /** Bu soruların kimlikleri: ikinci düzeltmede aynı soru iki kez sayılmasın. */
  soruIdleri?: string[];
}

function notuOku(deger: unknown): YenidenPuanlamaNotu | null {
  if (!deger || typeof deger !== "object") return null;
  const n = deger as Partial<YenidenPuanlamaNotu>;
  const o = n.onceki;
  if (!o || typeof o.dogru !== "number" || typeof o.net !== "number") return null;
  return {
    onceki: { dogru: o.dogru, yanlis: Number(o.yanlis ?? 0), bos: Number(o.bos ?? 0), net: o.net },
    soruSayisi: Number(n.soruSayisi ?? 0),
    soruIdleri: Array.isArray(n.soruIdleri) ? n.soruIdleri.filter((x): x is string => typeof x === "string") : [],
  };
}

/**
 * Cevap anahtarı düzeltilen soruların BİTMİŞ oturumlarını yeniden puanlar
 * (bakım işi, /api/cron).
 *
 * Tespit SÜRÜME göre değil UYUMSUZLUĞA göre: kayıttaki doğruluk
 * (Answer.isCorrect) seçilen şıkkın güncel anahtarından farklıysa o cevap
 * yeniden puanlanır. Böylece sürüm kuralı ne olursa olsun (içerik
 * düzeltmesi sürüm artırmasa da) anahtar değişikliği kaçmaz; anahtar geri
 * alınırsa sonuç da geri döner. SessionItem.questionVersion'a DOKUNULMAZ:
 * panelin madde analizi onunla "hangi sürüm gösterildi"yi okuyor.
 *
 * Alıştırma hariç (ölçüm değil). Kapsam dışında kalanlar BİLEREK: plan,
 * kapanmış kontrol testi işi, ödev tamamlanması, seri ve seviye kapısı o
 * günkü sonuca göre verilmiş kararlar; geriye dönük değişmezler. Deneme
 * yüzdeliği sonucu canlı okuduğu için kendiliğinden düzelir.
 */
export async function yenidenPuanla(
  now = new Date()
): Promise<{ oturum: number; cevap: number; hatali: number }> {
  const sinir = new Date(now.getTime() - YENIDEN_PUANLAMA_PENCERESI_SAAT * 3_600_000);
  const adaylar = await prisma.$queryRaw<{ sessionId: string }[]>`
    SELECT DISTINCT si."sessionId"
    FROM "Answer" a
    JOIN "SessionItem" si ON si.id = a."sessionItemId"
    JOIN "CheckupSession" s ON s.id = si."sessionId"
    JOIN "Question" q ON q.id = si."questionId"
    JOIN "Choice" c ON c.id = a."choiceId"
    WHERE q."updatedAt" >= (${sinir.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      AND s.status IN ('SUBMITTED', 'EXPIRED')
      AND s.kind <> 'PRACTICE'
      AND a."isCorrect" IS DISTINCT FROM c."isCorrect"
    LIMIT ${YENIDEN_PUANLAMA_OTURUM_SINIRI}::int
  `;

  let oturum = 0;
  let cevap = 0;
  let hatali = 0;
  for (const { sessionId } of adaylar) {
    try {
      const n = await oturumuYenidenPuanla(sessionId, now);
      if (n > 0) {
        oturum += 1;
        cevap += n;
      }
    } catch (e) {
      hatali += 1;
      console.error("[yenidenPuanla] oturum yeniden puanlanamadı:", sessionId, e);
    }
  }
  // Öbür oturumlar işlendi; bakım yanıtı yine de bu işi "düştü" göstersin.
  if (hatali > 0) {
    throw new Error(`${hatali} oturum yeniden puanlanamadı (${oturum} oturum, ${cevap} cevap düzeltildi).`);
  }
  return { oturum, cevap, hatali };
}

/**
 * Tek oturumu yeniden puanlar; düzeltilen cevap sayısını döner (0: uyumsuzluk
 * kalmamış). Sırası:
 *  1. Answer.isCorrect güncel anahtara eşitlenir.
 *  2. Sonuç aynı hesapla (sonucuHesapla) yeniden yazılır; rescoredAt ve
 *     rescoreNote. `onceki` İLK yeniden puanlamada dolar, sonra korunur.
 *  3. Sorunun doğru sayacı (Question.correctCount) düzeltilir: bitişte bu
 *     oturum için +1 yazılmıştı ya da yazılmamıştı.
 *  4. İşlemden sonra defter: artık doğru olan madde kapanır, artık yanlış
 *     olan deftere girer (defteriGuncelle, idempotent).
 * Sonucu hiç yazılamamış (EXPIRED) oturumda yalnızca 1. adım: sayaçlar o
 * oturum için hiç artmamıştı.
 */
async function oturumuYenidenPuanla(sessionId: string, now: Date): Promise<number> {
  const islem = await prisma.$transaction(async (tx) => {
    // Aynı oturumu iki çağrı birlikte işlemesin (cron kilidi var; elle çağrı da olabilir).
    await tx.$queryRaw`SELECT id FROM "CheckupSession" WHERE id = ${sessionId} FOR UPDATE`;
    const s = await tx.checkupSession.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        status: true,
        kind: true,
        result: {
          select: { correctCount: true, wrongCount: true, blankCount: true, netScore: true, rescoreNote: true },
        },
      },
    });
    if (!s || s.kind === "PRACTICE" || (s.status !== "SUBMITTED" && s.status !== "EXPIRED")) return null;

    const { score, maddeler } = await sonucuHesapla(sessionId, tx);
    const farkli = await dogruluguEsitle(tx, maddeler);
    if (farkli.length === 0 || !s.result) return { userId: s.userId, farkli, sonucVar: false };

    const eski = notuOku(s.result.rescoreNote);
    const soruIdleri = [...new Set([...(eski?.soruIdleri ?? []), ...farkli.map((m) => m.questionId)])];
    const not: YenidenPuanlamaNotu = {
      onceki: eski?.onceki ?? {
        dogru: s.result.correctCount,
        yanlis: s.result.wrongCount,
        bos: s.result.blankCount,
        net: Number(s.result.netScore),
      },
      soruSayisi: soruIdleri.length,
      soruIdleri,
    };
    await tx.checkupResult.update({
      where: { sessionId },
      data: {
        ...sonucAlanlari(score),
        rescoredAt: now,
        rescoreNote: not as unknown as Prisma.InputJsonValue,
      },
    });

    const artan = farkli.filter((m) => m.dogru === true).map((m) => m.questionId);
    const azalan = farkli.filter((m) => m.kayitli === true).map((m) => m.questionId);
    if (artan.length > 0) {
      await tx.question.updateMany({ where: { id: { in: artan } }, data: { correctCount: { increment: 1 } } });
    }
    if (azalan.length > 0) {
      await tx.question.updateMany({
        where: { id: { in: azalan }, correctCount: { gt: 0 } },
        data: { correctCount: { decrement: 1 } },
      });
    }
    return { userId: s.userId, farkli, sonucVar: true };
  });

  if (!islem) return 0;
  if (islem.sonucVar) {
    const dogruCikan = islem.farkli.filter((m) => m.dogru === true).map((m) => m.questionId);
    await dogruCikanlariKapat({ userId: islem.userId, sessionId, questionIds: dogruCikan, now });
    await defteriGuncelle(sessionId);
  }
  return islem.farkli.length;
}

/** Sonuç ekranındaki "sonucun yeniden hesaplandı" bandının verisi. */
export interface YenidenPuanlamaBilgisi {
  tarih: Date;
  soruSayisi: number;
  onceki: { dogru: number; net: number };
  simdi: { dogru: number; net: number };
}

/**
 * Bu sonuç cevap anahtarı düzeltildiği için yeniden puanlandıysa bandın
 * verisi; değilse ya da başkasının sonucuysa null. Cevap anahtarı içermez.
 */
export async function yenidenPuanlamaBilgisi(
  sessionId: string,
  userId: string
): Promise<YenidenPuanlamaBilgisi | null> {
  const r = await prisma.checkupResult.findUnique({
    where: { sessionId },
    select: {
      correctCount: true,
      netScore: true,
      rescoredAt: true,
      rescoreNote: true,
      session: { select: { userId: true } },
    },
  });
  if (!r || r.session.userId !== userId || !r.rescoredAt) return null;
  const not = notuOku(r.rescoreNote);
  if (!not || not.soruSayisi === 0) return null;
  return {
    tarih: r.rescoredAt,
    soruSayisi: not.soruSayisi,
    onceki: { dogru: not.onceki.dogru, net: not.onceki.net },
    simdi: { dogru: r.correctCount, net: Number(r.netScore) },
  };
}

// ─────────────────────────────────────────────────────────────
// Deneme karşılaştırması ve süre analizi (sonuç ekranı)
// ─────────────────────────────────────────────────────────────

/**
 * Deneme havuzu: bu MOCK paketi çözenlerin kişi başına İLK oturumu; yalnızca
 * o ilk oturum EKRANDA çözülüp puanlandıysa (SUBMITTED ya da EXPIRED ve
 * sonucu var) sayılır.
 *
 * - "İlk": deneme sorularını herkes aynı görür; ikinci çözüşte öğrenci
 *   cevapları biliyor. İlk oturumu kâğıtta olan da havuza girmez: soruları
 *   kitapçıktan görmüş, sonraki ekran oturumu artık prova değil.
 * - Kâğıt havuza girmez: süreyi öğrenci kendisi tutuyor, aynı koşul değil.
 * - Hiç işaret konmadan gönderilen oturum havuza girmez: "cevaplara bakayım"
 *   diye boş gönderilen deneme dağılımın dibine sahte bir sıfır ekliyordu.
 *
 * Satır başına yalnızca kullanıcı kimliği (kendi kaydını ayırmak için) ve net
 * döner; ekrana hiçbir kimlik gitmez (lib/deneme.ts karsilastir).
 */
export async function denemeHavuzu(packageId: string): Promise<HavuzKaydi[]> {
  const satirlar = await prisma.$queryRaw<{ userId: string; net: Prisma.Decimal }[]>`
    SELECT ilk."userId", r."netScore" AS net
    FROM (
      SELECT DISTINCT ON (s."userId") s.id, s."userId", s.mode, s.status
      FROM "CheckupSession" s
      WHERE s."packageId" = ${packageId} AND s.kind = 'PACKAGE'
      ORDER BY s."userId", s."startedAt" ASC, s.id ASC
    ) ilk
    JOIN "CheckupResult" r ON r."sessionId" = ilk.id
    WHERE ilk.mode = 'ONLINE'
      AND ilk.status IN ('SUBMITTED', 'EXPIRED')
      AND r."correctCount" + r."wrongCount" > 0
  `;
  return satirlar.map((s) => ({ userId: s.userId, net: Number(s.net) }));
}

export type DenemeKarsilastirmasi = Karsilastirma & {
  /** Bu oturum kâğıtta çözüldü: havuzda değil, yalnızca konumu gösteriliyor. */
  kagit: boolean;
  /** Bu oturum havuzdaki kaydı mı (ilk ekran denemesi). */
  havuzda: boolean;
  net: number;
};

/**
 * Sonuç ekranındaki "denemeyi çözenler arasında" kartının verisi. Deneme
 * olmayan, bitmemiş ya da başkasının oturumunda null.
 */
export async function denemeKarsilastirmasi(
  sessionId: string,
  userId: string
): Promise<DenemeKarsilastirmasi | null> {
  const s = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      mode: true,
      packageId: true,
      package: { select: { kind: true, questionCount: true } },
      result: { select: { netScore: true } },
    },
  });
  if (!s || s.userId !== userId || s.package.kind !== "MOCK" || !s.result) return null;

  const havuz = await denemeHavuzu(s.packageId);
  const net = Number(s.result.netScore);
  // Havuz kişi başına tek kayıt; öğrencinin kaydı bu oturum mu, bilmek için
  // ilk oturumuna bakıyoruz.
  const ilk = await prisma.checkupSession.findFirst({
    where: { userId, packageId: s.packageId, kind: "PACKAGE" },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const havuzda = ilk?.id === sessionId && havuz.some((h) => h.userId === userId);

  return {
    ...karsilastir({ benimNet: net, benimUserId: userId, havuz, soruSayisi: s.package.questionCount }),
    kagit: s.mode === "PAPER",
    havuzda,
    net,
  };
}

/**
 * Sonuç ekranındaki "Süre ve strateji" kartının verisi (lib/sure-analizi.ts).
 *
 * Yalnızca EKRANDA çözülmüş, puanlanmış ölçüm oturumu: kâğıtta soru başına
 * süre yok, alıştırma ölçüm değil. Cevap anahtarı içermez; yalnızca doğru /
 * yanlış / boş durumu (sonuç ekranı zaten gösteriyor).
 */
export async function sureAnaliziGetir(
  sessionId: string,
  userId: string
): Promise<SureAnaliziSonucu | null> {
  const s = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      kind: true,
      mode: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      durationMinutes: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          question: { select: { targetTimeSeconds: true } },
          answer: {
            select: { choiceId: true, isCorrect: true, timeSpentMs: true, firstAnsweredAt: true, answeredAt: true },
          },
        },
      },
    },
  });
  if (!s || s.userId !== userId) return null;
  if (s.mode === "PAPER" || s.kind === "PRACTICE" || s.status === "IN_PROGRESS") return null;

  return sureAnalizi({
    baslangic: s.startedAt,
    sureDk: s.durationMinutes,
    bitis: s.submittedAt,
    maddeler: s.items.map((i) => {
      const isaretli = Boolean(i.answer?.choiceId);
      return {
        sira: i.sortOrder,
        sureMs: i.answer?.timeSpentMs ?? 0,
        hedefSn: i.question.targetTimeSeconds,
        durum: !isaretli ? "bos" : i.answer?.isCorrect ? "dogru" : "yanlis",
        ilkIsaret: i.answer?.firstAnsweredAt ?? null,
        sonIsaret: isaretli ? (i.answer?.answeredAt ?? null) : null,
      };
    }),
  });
}
