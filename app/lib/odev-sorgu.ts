import { prisma } from "@/lib/db";
import {
  bugunOdevi,
  geciktiMi,
  odevBolumu,
  odevIlerlemesi,
  ogrenciGorur,
  type OdevCevabi,
  type OdevIlerlemesi,
  type OdevOturumu,
  type OdevTuru,
} from "@/lib/odev";
import { yarimKaldi } from "@/lib/insights";

/**
 * Öğrencinin ödevleri — veritabanı tarafı. Kural lib/odev.ts'te (saf,
 * panelle ortak); burada yalnızca o kuralın istediği kayıtlar okunur.
 *
 * GİZLİLİK: öğrenci yalnızca KENDİ kayıtlarını görür. Grubun öbür üyeleri,
 * üye sayısı ve kimin ne yaptığı bu modülden hiçbir yoldan çıkmaz; her
 * sorgu `userId` ile kısıtlı.
 */

/** Geçmiş listesinde en fazla kaç ödev (eski dönemler birikmesin). */
const GECMIS_SINIRI = 30;
/** Okunan en fazla ödev: açıklar + geçmiş için bol bol yeter. */
const OKUMA_SINIRI = 120;

export interface OgrenciOdevi {
  id: string;
  grupAdi: string;
  kind: OdevTuru;
  title: string;
  /** Koçun notu. */
  note: string | null;
  startsAt: Date;
  dueAt: Date;
  paket: {
    slug: string;
    name: string;
    /** Ödev verildikten sonra yayından kalktıysa "Başla" yok. */
    yayinda: boolean;
    questionCount: number;
    durationMinutes: number;
  } | null;
  konu: { id: string; name: string } | null;
  ilerleme: OdevIlerlemesi;
  gecikti: boolean;
  /** Paket ödevinde süren oturum ("Teste dön"). */
  acikOturumId: string | null;
}

export interface OgrenciOdevleri {
  /** Etkin (arşivlenmemiş) grup sayısı: boş ekranın hangi cümleyi kuracağı buna bağlı. */
  grupSayisi: number;
  /** Bitmemiş ve süresi geçmemiş (ya da gecikme penceresinde), son tarihi yakın önce. */
  acik: OgrenciOdevi[];
  /** Tamamlanan ya da penceresi kapanan, en yeni önce. */
  gecmis: OgrenciOdevi[];
}

/** Kural dışı ödev türü (şemaya yeni tür eklenip burası unutulursa) listeye girmez. */
function turMu(kind: string): kind is OdevTuru {
  return kind === "PACKAGE" || kind === "TOPIC_PRACTICE";
}

export async function ogrenciOdevleri(userId: string, now = new Date()): Promise<OgrenciOdevleri> {
  const uyelikler = await prisma.groupMember.findMany({
    where: { userId, group: { archivedAt: null } },
    select: { groupId: true },
  });
  if (uyelikler.length === 0) return { grupSayisi: 0, acik: [], gecmis: [] };

  const satirlar = await prisma.assignment.findMany({
    where: {
      groupId: { in: uyelikler.map((u) => u.groupId) },
      cancelledAt: null,
      group: { archivedAt: null },
    },
    orderBy: [{ dueAt: "desc" }, { id: "asc" }],
    take: OKUMA_SINIRI,
    select: {
      id: true,
      kind: true,
      packageId: true,
      topicId: true,
      questionCount: true,
      title: true,
      note: true,
      startsAt: true,
      dueAt: true,
      cancelledAt: true,
      group: { select: { name: true, archivedAt: true } },
      package: { select: { slug: true, name: true, status: true, questionCount: true, durationMinutes: true } },
      topic: { select: { id: true, name: true } },
    },
  });
  // Sorgu zaten süzüyor; kural yine de tek yerden (iptal ve arşiv) geçsin.
  const odevler = satirlar.filter((o) => ogrenciGorur(o, o.group) && turMu(o.kind));

  const paketIdleri = [...new Set(odevler.flatMap((o) => (o.kind === "PACKAGE" && o.packageId ? [o.packageId] : [])))];
  const konuIdleri = [...new Set(odevler.flatMap((o) => (o.kind === "TOPIC_PRACTICE" && o.topicId ? [o.topicId] : [])))];
  const enErken = (tur: string) =>
    new Date(Math.min(...odevler.filter((o) => o.kind === tur).map((o) => o.startsAt.getTime())));

  const [oturumlar, cevaplar] = await Promise.all([
    paketIdleri.length > 0
      ? prisma.checkupSession.findMany({
          where: {
            userId,
            packageId: { in: paketIdleri },
            kind: { not: "PRACTICE" },
            OR: [
              { status: "IN_PROGRESS" },
              { startedAt: { gte: enErken("PACKAGE") } },
              { submittedAt: { gte: enErken("PACKAGE") } },
              { expiresAt: { gte: enErken("PACKAGE") } },
            ],
          },
          select: {
            id: true,
            packageId: true,
            status: true,
            mode: true,
            startedAt: true,
            submittedAt: true,
            expiresAt: true,
            // Yarım test kuralı (lib/insights.ts yarimKaldi) endedBy ve blankCount ister.
            endedBy: true,
            result: { select: { netScore: true, correctCount: true, wrongCount: true, blankCount: true } },
            // Boş gönderilen oturum ödevi tamamlamaz (lib/odev.ts isaretli). Sonuç
            // varsa doğru + yanlış; sonucu yazılamamış oturumda işaretli cevap sayısı.
            _count: { select: { items: { where: { answer: { choiceId: { not: null } } } } } },
          },
        })
      : Promise.resolve([]),
    konuIdleri.length > 0
      ? prisma.answer.findMany({
          where: {
            answeredAt: { gte: enErken("TOPIC_PRACTICE") },
            sessionItem: { session: { userId, kind: "PRACTICE", focusTopicId: { in: konuIdleri } } },
          },
          select: { answeredAt: true, sessionItem: { select: { session: { select: { focusTopicId: true } } } } },
        })
      : Promise.resolve([]),
  ]);

  const kayitlar: { oturumlar: OdevOturumu[]; cevaplar: OdevCevabi[] } = {
    oturumlar: oturumlar.map((s) => ({
      id: s.id,
      packageId: s.packageId,
      status: s.status,
      mode: s.mode,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
      expiresAt: s.expiresAt,
      net: s.result ? Number(s.result.netScore) : null,
      isaretli: s.result ? s.result.correctCount + s.result.wrongCount > 0 : s._count.items > 0,
      // Yarım kalan test ödevi tamamlamaz (lib/odev.ts yarim). Sonucu yazılamamış
      // oturumda soru sayısı okunmuyor; o nadir durumda kural işlemez (eskisi gibi).
      yarim: s.result ? yarimKaldi({ ...s.result, endedBy: s.endedBy }) : false,
    })),
    cevaplar: cevaplar.flatMap((c) =>
      c.sessionItem.session.focusTopicId
        ? [{ topicId: c.sessionItem.session.focusTopicId, answeredAt: c.answeredAt }]
        : []
    ),
  };
  // Süresi dolmamış açık oturum: paket sayfası da onu sürdürür, kart doğrudan teste götürsün.
  const acikOturum = new Map(
    oturumlar
      .filter((s) => s.status === "IN_PROGRESS" && s.expiresAt.getTime() > now.getTime())
      .map((s) => [s.packageId, s.id])
  );

  const hepsi: OgrenciOdevi[] = odevler.map((o) => {
    const ilerleme = odevIlerlemesi(o, kayitlar);
    return {
      id: o.id,
      grupAdi: o.group.name,
      kind: o.kind as OdevTuru,
      title: o.title,
      note: o.note,
      startsAt: o.startsAt,
      dueAt: o.dueAt,
      paket: o.package
        ? {
            slug: o.package.slug,
            name: o.package.name,
            yayinda: o.package.status === "PUBLISHED",
            questionCount: o.package.questionCount,
            durationMinutes: o.package.durationMinutes,
          }
        : null,
      konu: o.topic,
      ilerleme,
      gecikti: geciktiMi(o, ilerleme, now),
      acikOturumId: o.packageId ? (acikOturum.get(o.packageId) ?? null) : null,
    };
  });

  const acik = hepsi
    .filter((o) => odevBolumu(o, o.ilerleme, now) === "ACIK")
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const gecmis = hepsi
    .filter((o) => odevBolumu(o, o.ilerleme, now) === "GECMIS")
    .sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime())
    .slice(0, GECMIS_SINIRI);

  return { grupSayisi: uyelikler.length, acik, gecmis };
}

/**
 * Pano "Bugün" kartı için: son tarihi yakın, bitmemiş ödev (lib/odev.ts
 * bugunOdevi). Gruba üye değilse tek sorguda döner.
 */
export async function bugunkuOdev(userId: string, now = new Date()): Promise<OgrenciOdevi | null> {
  const { acik } = await ogrenciOdevleri(userId, now);
  return bugunOdevi(acik, now);
}
