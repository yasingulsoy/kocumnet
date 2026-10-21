import "server-only";
import type { Prisma } from "./generated/client";
import { db } from "./db";
import { basHarfler, soruDurumu, type Kutu, type SoruDurumu } from "./koca-soru";
import { contentToMarkup } from "./shared/question-markup";
import { safeParseQuestionContent } from "./shared/question-content";

/**
 * "Koça sor" gelen kutusu — okuma (sunucu). Yazma actions/koca-sorular.ts'te.
 *
 * KVKK: öğrencinin adı ve e-postası yalnızca MANAGE rollerine. Editör için
 * yalnızca baş harfler HESAPLANIP döner; ad ve e-posta bu modülün dönüşüne
 * hiç girmez (sayfanın RSC yükünde de olmaz).
 */

export const SAYFA_BOYU = 20;

const KOSUL: Record<Kutu, Prisma.CoachQuestionWhereInput> = {
  bekleyen: { answeredAt: null, closedAt: null },
  cevaplanan: { answeredAt: { not: null }, closedAt: null },
  kapatilan: { closedAt: { not: null } },
};

/** Bekleyenler eskiden yeniye (sıra bekleyen önce); ötekiler en yeni önce. */
const SIRA: Record<Kutu, Prisma.CoachQuestionOrderByWithRelationInput[]> = {
  bekleyen: [{ createdAt: "asc" }, { id: "asc" }],
  cevaplanan: [{ answeredAt: "desc" }, { id: "asc" }],
  kapatilan: [{ closedAt: "desc" }, { id: "asc" }],
};

export interface SoruBaglami {
  id: string;
  konu: string;
  durum: string;
  /** Yazım biçimi (ContentPreview); gövde okunamadıysa düz metin. */
  govde: string;
  secenekler: { id: string; label: string; markup: string; dogru: boolean; ogrencininki: boolean }[];
  /** Öğrencinin o oturumdaki cevabı: null = oturumda bu soru yok ya da bağlam yok. */
  ogrenciCevabi: { durum: "SECTI" | "BOS" | "CEVAPSIZ"; dogru: boolean | null } | null;
}

export interface GelenSoru {
  id: string;
  body: string;
  createdAt: Date;
  durum: SoruDurumu;
  answerBody: string | null;
  answeredAt: Date | null;
  answeredByStaff: string | null;
  readAt: Date | null;
  closedAt: Date | null;
  closedByStaff: string | null;
  /** MANAGE için dolu; editörde null. */
  ogrenci: { id: string; name: string; email: string } | null;
  basHarfler: string;
  /** Nereden soruldu (oturum öğrencinin kendisininse). */
  kaynak: { tur: "SONUC" | "ALISTIRMA" | "SEVIYELI" | "KONTROL"; paket: string } | null;
  soru: SoruBaglami | null;
}

/** Blok dizisinden yazım biçimi; bozuk kayıtta boş (önizleme "boş" der). */
function markup(deger: unknown, yedek = ""): string {
  const p = safeParseQuestionContent(deger);
  if (!p.success) return yedek;
  try {
    return contentToMarkup(p.data);
  } catch {
    return yedek;
  }
}

const KAYNAK_TURU: Record<string, "SONUC" | "ALISTIRMA" | "SEVIYELI" | "KONTROL"> = {
  PACKAGE: "SONUC",
  PRACTICE: "ALISTIRMA",
  LEVEL_STAGE: "SEVIYELI",
  TOPIC_RETEST: "KONTROL",
};

export async function kutuSayilari(): Promise<Record<Kutu, number>> {
  const [bekleyen, cevaplanan, kapatilan] = await Promise.all([
    db.coachQuestion.count({ where: KOSUL.bekleyen }),
    db.coachQuestion.count({ where: KOSUL.cevaplanan }),
    db.coachQuestion.count({ where: KOSUL.kapatilan }),
  ]);
  return { bekleyen, cevaplanan, kapatilan };
}

export async function gelenSorular(kutu: Kutu, sayfa: number, kisisel: boolean): Promise<GelenSoru[]> {
  const satirlar = await db.coachQuestion.findMany({
    where: KOSUL[kutu],
    orderBy: SIRA[kutu],
    skip: (sayfa - 1) * SAYFA_BOYU,
    take: SAYFA_BOYU,
    select: {
      id: true,
      userId: true,
      sessionId: true,
      body: true,
      createdAt: true,
      answerBody: true,
      answeredAt: true,
      answeredByStaff: true,
      readAt: true,
      closedAt: true,
      closedByStaff: true,
      user: { select: { name: true, email: true } },
      question: {
        select: {
          id: true,
          stem: true,
          stemText: true,
          status: true,
          topic: { select: { name: true } },
          choices: { orderBy: { sortOrder: "asc" }, select: { id: true, label: true, content: true, isCorrect: true } },
        },
      },
    },
  });

  // Bağlam: soruların sorulduğu oturumlar ve öğrencinin o oturumdaki cevabı.
  const oturumIdleri = [...new Set(satirlar.flatMap((s) => (s.sessionId ? [s.sessionId] : [])))];
  const ciftler = satirlar.flatMap((s) => (s.sessionId && s.question ? [{ sessionId: s.sessionId, questionId: s.question.id }] : []));
  const [oturumlar, maddeler] = await Promise.all([
    oturumIdleri.length > 0
      ? db.checkupSession.findMany({
          where: { id: { in: oturumIdleri } },
          select: { id: true, userId: true, kind: true, package: { select: { name: true } } },
        })
      : Promise.resolve([]),
    ciftler.length > 0
      ? db.sessionItem.findMany({
          where: { OR: ciftler },
          select: { sessionId: true, questionId: true, answer: { select: { choiceId: true, isCorrect: true } } },
        })
      : Promise.resolve([]),
  ]);
  const oturumMap = new Map(oturumlar.map((o) => [o.id, o]));
  const maddeMap = new Map(maddeler.map((m) => [m.sessionId + "|" + m.questionId, m]));

  return satirlar.map((s) => {
    // Sahiplik: oturum bu öğrencinin değilse (bozuk ya da elle yazılmış kimlik) bağlam gösterilmez.
    const oturum = s.sessionId ? oturumMap.get(s.sessionId) : undefined;
    const kendi = oturum && oturum.userId === s.userId ? oturum : null;
    const madde = kendi && s.question ? maddeMap.get(kendi.id + "|" + s.question.id) : undefined;
    const secilen = madde?.answer?.choiceId ?? null;

    const soru: SoruBaglami | null = s.question
      ? {
          id: s.question.id,
          konu: s.question.topic.name,
          durum: s.question.status,
          govde: markup(s.question.stem, s.question.stemText),
          secenekler: s.question.choices.map((c) => ({
            id: c.id,
            label: c.label,
            markup: markup(c.content),
            dogru: c.isCorrect,
            ogrencininki: c.id === secilen,
          })),
          ogrenciCevabi: madde
            ? madde.answer
              ? madde.answer.choiceId
                ? { durum: "SECTI", dogru: madde.answer.isCorrect }
                : { durum: "BOS", dogru: null }
              : { durum: "CEVAPSIZ", dogru: null }
            : null,
        }
      : null;

    return {
      id: s.id,
      body: s.body,
      createdAt: s.createdAt,
      durum: soruDurumu(s),
      answerBody: s.answerBody,
      answeredAt: s.answeredAt,
      answeredByStaff: s.answeredByStaff,
      readAt: s.readAt,
      closedAt: s.closedAt,
      closedByStaff: s.closedByStaff,
      ogrenci: kisisel ? { id: s.userId, name: s.user.name, email: s.user.email } : null,
      basHarfler: basHarfler(s.user.name),
      kaynak: kendi ? { tur: KAYNAK_TURU[kendi.kind] ?? "SONUC", paket: kendi.package.name } : null,
      soru,
    };
  });
}

/** Genel bakıştaki kutu: bekleyen sayısı ve en eskisinin zamanı. */
export async function bekleyenOzeti(): Promise<{ sayi: number; enEski: Date | null }> {
  const [sayi, enEski] = await Promise.all([
    db.coachQuestion.count({ where: KOSUL.bekleyen }),
    db.coachQuestion.findFirst({ where: KOSUL.bekleyen, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  return { sayi, enEski: enEski?.createdAt ?? null };
}
