import { prisma } from "@/lib/db";
import { safeParseQuestionContent, type QuestionContent } from "@/lib/question-content";
import { gunBasi } from "@/lib/review";
import { soruyuGordu } from "@/lib/hata-bildirimi";
import {
  ACIK_KOCA_SORU_SINIRI,
  BildirimHatasi,
  GUNLUK_KOCA_SORU_SINIRI,
  KOCA_SORU_SINIRI,
  kocaSoruDurumu,
  type KocaSoruDurumu,
} from "@/lib/bildirim-kurallari";

/**
 * "Koça sor" — öğrenci tarafı. Koç cevabı panelde yazar (admin); burada
 * yalnızca soru açılır, liste okunur ve görülen cevaplar işaretlenir.
 *
 * Soru-cevap, yazışma değil: her satırın tek cevabı var; takip sorusu yeni
 * satır. Koçun cevabı düz metin; öğrenciye HTML olarak hiç basılmaz.
 */

/** Cevap bekleyen (cevapsız ve kapatılmamış) sorular. */
const acikKosulu = (userId: string) => ({ userId, answeredAt: null, closedAt: null });

/**
 * Yeni soru. Bir soruya bağlıysa öğrenci o soruyu gerçekten görmüş olmalı
 * (lib/hata-bildirimi.ts soruyuGordu); genel soruda bağlam yok. Aynı anda en
 * fazla ACIK_KOCA_SORU_SINIRI cevapsız soru ve bir Türkiye gününde en fazla
 * GUNLUK_KOCA_SORU_SINIRI soru. Sayım ve yazım aynı işlemde, satır kilitli.
 */
export async function kocaSoruSor(args: {
  userId: string;
  body: string;
  questionId?: string | null;
  sessionId?: string | null;
  now?: Date;
}): Promise<{ id: string }> {
  const { userId } = args;
  const now = args.now ?? new Date();
  const body = args.body.trim();
  const questionId = args.questionId ?? null;
  // Genel soruda oturum bağlamı anlamsız; yalnızca soruyla birlikte saklanır.
  const sessionId = questionId ? (args.sessionId ?? null) : null;

  if (body.length === 0) throw new BildirimHatasi("Sorunu yaz.");
  if (body.length > KOCA_SORU_SINIRI) {
    throw new BildirimHatasi(`Sorun en fazla ${KOCA_SORU_SINIRI} karakter olabilir.`);
  }
  if (questionId && !(await soruyuGordu(userId, questionId, sessionId))) {
    throw new BildirimHatasi("Bu soru hakkında koça soru gönderilemiyor.");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const [acik, bugun] = await Promise.all([
      tx.coachQuestion.count({ where: acikKosulu(userId) }),
      tx.coachQuestion.count({ where: { userId, createdAt: { gte: gunBasi(now) } } }),
    ]);
    if (acik >= ACIK_KOCA_SORU_SINIRI) {
      throw new BildirimHatasi(
        `Cevap bekleyen ${acik} sorun var. Koçun onları cevaplayınca yenisini sorabilirsin.`
      );
    }
    if (bugun >= GUNLUK_KOCA_SORU_SINIRI) {
      throw new BildirimHatasi(`Bugün ${GUNLUK_KOCA_SORU_SINIRI} soru sordun. Yarın yeniden sorabilirsin.`);
    }
    return tx.coachQuestion.create({
      data: { userId, questionId, sessionId, body, createdAt: now },
      select: { id: true },
    });
  });
}

/** Form için: şu an kaç cevapsız soru var, bugün kaç soru soruldu. */
export async function kocaSoruHakki(userId: string, now = new Date()) {
  const [acik, bugun] = await Promise.all([
    prisma.coachQuestion.count({ where: acikKosulu(userId) }),
    prisma.coachQuestion.count({ where: { userId, createdAt: { gte: gunBasi(now) } } }),
  ]);
  const kapali =
    acik >= ACIK_KOCA_SORU_SINIRI
      ? `Cevap bekleyen ${acik} sorun var. Koçun cevaplayınca yenisini sorabilirsin.`
      : bugun >= GUNLUK_KOCA_SORU_SINIRI
        ? `Bugün ${GUNLUK_KOCA_SORU_SINIRI} soru sordun. Yarın yeniden sorabilirsin.`
        : null;
  return { acik, bugun, kapali };
}

/** Ana sayfa kartı ve haftalık posta: koçun yazdığı ama öğrencinin henüz görmediği cevaplar. */
export async function okunmamisCevapSayisi(userId: string): Promise<number> {
  return prisma.coachQuestion.count({ where: { userId, answeredAt: { not: null }, readAt: null } });
}

/**
 * Görülen cevapları işaretler. Sayfa çizilirken DEĞİL, öğrencinin
 * tarayıcısı sayfayı gösterdikten sonra çağrılır (sorularim sayfasındaki
 * istemci bileşeni): ön yükleme ya da yarıda kalan bir istek "okundu"
 * saymasın. Yalnızca kendi, cevaplanmış ve okunmamış satırlar.
 */
export async function cevaplariOkundu(userId: string, ids: string[], now = new Date()): Promise<number> {
  if (ids.length === 0) return 0;
  const r = await prisma.coachQuestion.updateMany({
    where: { id: { in: ids }, userId, answeredAt: { not: null }, readAt: null },
    data: { readAt: now },
  });
  return r.count;
}

/** Sorulardaki son koça soru durumu (sonuç ve alıştırma ekranındaki düğmenin yanı). */
export async function kocaSoruDurumlari(userId: string, questionIds: string[]): Promise<Map<string, KocaSoruDurumu>> {
  const sonuc = new Map<string, KocaSoruDurumu>();
  if (questionIds.length === 0) return sonuc;
  const satirlar = await prisma.coachQuestion.findMany({
    where: { userId, questionId: { in: [...new Set(questionIds)] } },
    orderBy: { createdAt: "desc" },
    select: { questionId: true, answeredAt: true, closedAt: true },
  });
  for (const s of satirlar) {
    if (s.questionId && !sonuc.has(s.questionId)) sonuc.set(s.questionId, kocaSoruDurumu(s));
  }
  return sonuc;
}

export interface KocaSoruSatiri {
  id: string;
  body: string;
  createdAt: Date;
  durum: KocaSoruDurumu;
  answerBody: string | null;
  answeredAt: Date | null;
  /** Cevap var ve öğrenci henüz görmedi. */
  yeni: boolean;
  /**
   * Soru öğrencinin AÇIK bir testinde de var: gövde ve koçun cevabı test
   * bitene kadar gösterilmez (cevap çözümü anlatıyor olabilir).
   */
  gizli: boolean;
  soru: { stem: QuestionContent; konu: string } | null;
  /** Sorunun sorulduğu testin sonuç ekranı (varsa). */
  sonucId: string | null;
}

/** /sorularim listesi: en yeniden eskiye, son 100 soru. */
export async function kocaSorulari(userId: string): Promise<KocaSoruSatiri[]> {
  const satirlar = await prisma.coachQuestion.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      body: true,
      createdAt: true,
      answerBody: true,
      answeredAt: true,
      readAt: true,
      closedAt: true,
      sessionId: true,
      questionId: true,
      question: { select: { stem: true, topic: { select: { name: true } } } },
    },
  });

  const soruIdleri = [...new Set(satirlar.map((s) => s.questionId).filter((id): id is string => id !== null))];
  const oturumIdleri = [...new Set(satirlar.map((s) => s.sessionId).filter((id): id is string => id !== null))];
  const [acikSinav, oturumlar] = await Promise.all([
    soruIdleri.length > 0
      ? prisma.sessionItem.findMany({
          where: {
            questionId: { in: soruIdleri },
            session: { userId, kind: { not: "PRACTICE" }, status: "IN_PROGRESS" },
          },
          select: { questionId: true },
        })
      : Promise.resolve([]),
    oturumIdleri.length > 0
      ? prisma.checkupSession.findMany({
          where: { id: { in: oturumIdleri }, userId },
          select: { id: true, kind: true, result: { select: { id: true } } },
        })
      : Promise.resolve([]),
  ]);
  const gizliSorular = new Set(acikSinav.map((s) => s.questionId));
  // Sonuç ekranı paket testinde ve kontrol testinde var (seviyeli aşamanın kendi karnesi var).
  const sonucuOlan = new Set(
    oturumlar.filter((o) => (o.kind === "PACKAGE" || o.kind === "TOPIC_RETEST") && o.result).map((o) => o.id)
  );

  return satirlar.map((s) => {
    const gizli = s.questionId !== null && gizliSorular.has(s.questionId);
    const govde = s.question ? safeParseQuestionContent(s.question.stem) : null;
    return {
      id: s.id,
      body: s.body,
      createdAt: s.createdAt,
      durum: kocaSoruDurumu(s),
      answerBody: gizli ? null : s.answerBody,
      answeredAt: s.answeredAt,
      yeni: !gizli && s.answeredAt !== null && s.readAt === null,
      gizli,
      soru: !gizli && s.question && govde?.success ? { stem: govde.data, konu: s.question.topic.name } : null,
      sonucId: s.sessionId && sonucuOlan.has(s.sessionId) ? s.sessionId : null,
    };
  });
}
