import "server-only";
import { db } from "./db";
import type { ExamScope } from "./generated/client";
import { aggregateTopics, type AggregateTopic, type ResultLike } from "./shared/insights";
import { odevIlerlemesi, type OdevCevabi, type OdevIlerlemesi, type OdevKurali, type OdevOturumu } from "./shared/odev";
import type { TopicBreakdown } from "./shared/scoring";

/**
 * Koçluk grupları — okuma (sunucu). Yazma actions/gruplar.ts'te, panel
 * kuralları grup-kurallari.ts'te, tamamlanma kuralı shared/odev.ts'te
 * (öğrenci uygulamasıyla ortak). Sorgular öğrenci tarafındakinden ayrı
 * (app/lib/odev-sorgu.ts): orada tek öğrenci, burada bütün üyeler.
 *
 * Öğrenci kişisel verisi: bu modülü yalnızca MANAGE rolleri açan sayfalar
 * çağırır (sayfa ve eylem başında checkStaff/staffForAction).
 */

const GUN = 86_400_000;
/** Grup raporu: son kaç günün sonuçları. */
export const RAPOR_GUN = 30;

export type OgrenciKayitlari = { oturumlar: OdevOturumu[]; cevaplar: OdevCevabi[] };

/**
 * Üyelerin ödev kayıtları: verilen ödevlerin paketlerindeki oturumlar ve
 * konularındaki alıştırma cevapları, en erken ödev başlangıcından beri.
 * Kural (shared/odev.ts) ödeve göre ayrıca süzer.
 */
export async function odevKayitlari(
  userIds: readonly string[],
  odevler: readonly Pick<OdevKurali, "kind" | "packageId" | "topicId" | "startsAt">[]
): Promise<Map<string, OgrenciKayitlari>> {
  const sonuc = new Map<string, OgrenciKayitlari>(userIds.map((id) => [id, { oturumlar: [], cevaplar: [] }]));
  if (userIds.length === 0 || odevler.length === 0) return sonuc;

  const paketler = odevler.filter((o) => o.kind === "PACKAGE" && o.packageId);
  const konular = odevler.filter((o) => o.kind === "TOPIC_PRACTICE" && o.topicId);
  const enErken = (l: typeof odevler) => new Date(Math.min(...l.map((o) => o.startsAt.getTime())));

  const [oturumlar, cevaplar] = await Promise.all([
    paketler.length > 0
      ? db.checkupSession.findMany({
          where: {
            userId: { in: [...userIds] },
            packageId: { in: [...new Set(paketler.map((o) => o.packageId!))] },
            kind: { not: "PRACTICE" },
            OR: [
              { status: "IN_PROGRESS" },
              { startedAt: { gte: enErken(paketler) } },
              { submittedAt: { gte: enErken(paketler) } },
              { expiresAt: { gte: enErken(paketler) } },
            ],
          },
          select: {
            id: true,
            userId: true,
            packageId: true,
            status: true,
            mode: true,
            startedAt: true,
            submittedAt: true,
            expiresAt: true,
            result: { select: { netScore: true, correctCount: true, wrongCount: true } },
            // Boş gönderilen oturum ödevi tamamlamaz (shared/odev.ts isaretli). Sonuç
            // varsa doğru + yanlış; sonucu yazılamamış oturumda işaretli cevap sayısı.
            _count: { select: { items: { where: { answer: { choiceId: { not: null } } } } } },
          },
        })
      : Promise.resolve([]),
    konular.length > 0
      ? db.answer.findMany({
          where: {
            answeredAt: { gte: enErken(konular) },
            sessionItem: {
              session: {
                userId: { in: [...userIds] },
                kind: "PRACTICE",
                focusTopicId: { in: [...new Set(konular.map((o) => o.topicId!))] },
              },
            },
          },
          select: {
            answeredAt: true,
            sessionItem: { select: { session: { select: { userId: true, focusTopicId: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  for (const s of oturumlar) {
    sonuc.get(s.userId)?.oturumlar.push({
      id: s.id,
      packageId: s.packageId,
      status: s.status,
      mode: s.mode,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
      expiresAt: s.expiresAt,
      net: s.result ? Number(s.result.netScore) : null,
      isaretli: s.result ? s.result.correctCount + s.result.wrongCount > 0 : s._count.items > 0,
    });
  }
  for (const c of cevaplar) {
    const { userId, focusTopicId } = c.sessionItem.session;
    if (focusTopicId) sonuc.get(userId)?.cevaplar.push({ topicId: focusTopicId, answeredAt: c.answeredAt });
  }
  return sonuc;
}

/**
 * Bir üye bu ödevin oranına sayılır mı: son tarihten SONRA gruba katılan
 * öğrenci o ödevi hiç görmeden "yapmadı" sayılmasın.
 */
export function oranaSayilir(uye: { createdAt: Date }, odev: { dueAt: Date }): boolean {
  return uye.createdAt.getTime() <= odev.dueAt.getTime();
}

export interface OdevOrani {
  /** Tamamlayan (geç dahil) / sayılan üye. Sayılan üye yoksa null. */
  oran: number | null;
  tamamlayan: number;
  sayilan: number;
}

export function odevOrani(
  odev: OdevKurali,
  uyeler: readonly { userId: string; createdAt: Date }[],
  kayitlar: Map<string, OgrenciKayitlari>
): OdevOrani & { ilerlemeler: Map<string, OdevIlerlemesi> } {
  const ilerlemeler = new Map<string, OdevIlerlemesi>();
  let tamamlayan = 0;
  let sayilan = 0;
  for (const u of uyeler) {
    const i = odevIlerlemesi(odev, kayitlar.get(u.userId) ?? { oturumlar: [], cevaplar: [] });
    ilerlemeler.set(u.userId, i);
    if (!oranaSayilir(u, odev)) continue;
    sayilan += 1;
    if (i.durum === "TAMAMLANDI" || i.durum === "GEC_TAMAMLANDI") tamamlayan += 1;
  }
  return { oran: sayilan > 0 ? tamamlayan / sayilan : null, tamamlayan, sayilan, ilerlemeler };
}

export interface GrupSatiri {
  id: string;
  name: string;
  examScope: string | null;
  note: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  uyeSayisi: number;
  /** İptal edilmemiş, son tarihi gelmemiş ödev. */
  acikOdev: number;
  /** Süresi dolan (iptal edilmemiş) ödevlerin ortalama tamamlanma oranı. */
  oran: number | null;
  /** Oranın kaç ödevden hesaplandığı. */
  biten: number;
}

/**
 * Grup listesi. Ortalama tamamlanma oranı yalnızca SÜRESİ DOLAN ödevlerden:
 * dün verilmiş bir ödevin %0'ı grubun karnesini düşürmesin; açık ödevler
 * ayrı sütunda sayılıyor.
 */
export async function grupListesi(arsiv: boolean, now: Date): Promise<GrupSatiri[]> {
  const gruplar = await db.studyGroup.findMany({
    where: { archivedAt: arsiv ? { not: null } : null },
    orderBy: arsiv ? [{ archivedAt: "desc" }] : [{ name: "asc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      examScope: true,
      note: true,
      archivedAt: true,
      createdAt: true,
      members: { select: { userId: true, createdAt: true } },
      assignments: {
        where: { cancelledAt: null },
        select: { kind: true, packageId: true, topicId: true, questionCount: true, startsAt: true, dueAt: true },
      },
    },
  });

  const uyeler = [...new Set(gruplar.flatMap((g) => g.members.map((m) => m.userId)))];
  const bitenler = gruplar.flatMap((g) => g.assignments.filter((a) => a.dueAt.getTime() < now.getTime()));
  const kayitlar = await odevKayitlari(uyeler, bitenler);

  return gruplar.map((g) => {
    const suresiDolan = g.assignments.filter((a) => a.dueAt.getTime() < now.getTime());
    const oranlar = suresiDolan
      .map((a) => odevOrani(a, g.members, kayitlar).oran)
      .filter((o): o is number => o !== null);
    return {
      id: g.id,
      name: g.name,
      examScope: g.examScope,
      note: g.note,
      archivedAt: g.archivedAt,
      createdAt: g.createdAt,
      uyeSayisi: g.members.length,
      acikOdev: g.assignments.length - suresiDolan.length,
      oran: oranlar.length > 0 ? oranlar.reduce((t, o) => t + o, 0) / oranlar.length : null,
      biten: oranlar.length,
    };
  });
}

export async function grupSayilari(): Promise<{ etkin: number; arsiv: number }> {
  const [etkin, arsiv] = await Promise.all([
    db.studyGroup.count({ where: { archivedAt: null } }),
    db.studyGroup.count({ where: { archivedAt: { not: null } } }),
  ]);
  return { etkin, arsiv };
}

// ─────────────────────────────────────────────────────────────
// Grup raporu: konu × öğrenci
// ─────────────────────────────────────────────────────────────

export interface RaporKonusu extends AggregateTopic {
  /** Bu konuda seviyesi "zayıf" çıkan üye sayısı. */
  zayifUye: number;
  /** Bu konuda ölçülmüş (en az bir soru) üye sayısı. */
  olculenUye: number;
}

export interface GrupRaporu {
  /** Satırlar: ölçülebilen konular en zayıftan, sonra seviyesi belirsizler. */
  konular: RaporKonusu[];
  /** Hücreler: userId → topicId → üyenin o konudaki toplamı. */
  hucreler: Map<string, Map<string, AggregateTopic>>;
  /** Grubun en zayıf (seviyesi ölçülebilmiş) 3 konusu. */
  enZayif: RaporKonusu[];
  sonucSayisi: number;
}

/**
 * Son RAPOR_GUN günün puanlanmış sonuçlarından (CheckupResult.topicBreakdown)
 * konu × öğrenci haritası. Oran ve seviye eşikleri öğrenci panosunun
 * (shared/insights.ts aggregateTopics, eşikler HARITA_*) aynısı.
 *
 * Grubun sınavı belliyse yalnızca o sınavın sonuçları (ve sınavı yazılmamış
 * eski kayıtlar): LGS ve TYT konu oranlarını tek hücrede toplamak anlamsız.
 * Kontrol testleri girer (o konunun gerçek ölçümü); alıştırma sonuç üretmez.
 */
export async function grupRaporu(userIds: readonly string[], examScope: string | null, now: Date): Promise<GrupRaporu> {
  const bos: GrupRaporu = { konular: [], hucreler: new Map(), enZayif: [], sonucSayisi: 0 };
  if (userIds.length === 0) return bos;

  const sonuclar = await db.checkupResult.findMany({
    where: {
      computedAt: { gte: new Date(now.getTime() - RAPOR_GUN * GUN) },
      session: { userId: { in: [...userIds] } },
      ...(examScope ? { OR: [{ examScope: examScope as ExamScope }, { examScope: null }] } : {}),
    },
    orderBy: { computedAt: "desc" },
    take: 3000,
    select: {
      correctCount: true,
      wrongCount: true,
      blankCount: true,
      netScore: true,
      totalTimeMs: true,
      computedAt: true,
      topicBreakdown: true,
      session: { select: { userId: true } },
    },
  });

  const kisiBasi = new Map<string, ResultLike[]>();
  const hepsi: ResultLike[] = [];
  for (const r of sonuclar) {
    const tb = r.topicBreakdown as unknown as TopicBreakdown | null;
    if (!tb || !Array.isArray(tb.topics)) continue;
    const satir: ResultLike = {
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      blankCount: r.blankCount,
      netScore: Number(r.netScore),
      totalTimeMs: r.totalTimeMs,
      computedAt: r.computedAt,
      topicBreakdown: tb,
    };
    hepsi.push(satir);
    const l = kisiBasi.get(r.session.userId) ?? [];
    l.push(satir);
    kisiBasi.set(r.session.userId, l);
  }

  const hucreler = new Map<string, Map<string, AggregateTopic>>();
  for (const [userId, l] of kisiBasi) {
    hucreler.set(userId, new Map(aggregateTopics(l).map((t) => [t.topicId, t])));
  }

  const konular: RaporKonusu[] = aggregateTopics(hepsi).map((t) => {
    let zayifUye = 0;
    let olculenUye = 0;
    for (const m of hucreler.values()) {
      const h = m.get(t.topicId);
      if (!h || h.asked === 0) continue;
      olculenUye += 1;
      if (h.level === "WEAK") zayifUye += 1;
    }
    return { ...t, zayifUye, olculenUye };
  });
  konular.sort((a, b) => {
    if ((a.level === null) !== (b.level === null)) return a.level === null ? 1 : -1;
    if (a.ratio !== b.ratio) return a.ratio - b.ratio;
    return b.asked - a.asked;
  });

  return {
    konular,
    hucreler,
    enZayif: konular.filter((k) => k.level !== null).slice(0, 3),
    sonucSayisi: hepsi.length,
  };
}

// ─────────────────────────────────────────────────────────────
// Öğrenci ayrıntısı: öğrencinin grupları ve ödevleri
// ─────────────────────────────────────────────────────────────

export interface OgrencininGrubu {
  id: string;
  name: string;
  examScope: string | null;
  archivedAt: Date | null;
  katildi: Date;
}

export interface OgrencininOdevi {
  id: string;
  groupId: string;
  grupAdi: string;
  title: string;
  kind: string;
  dueAt: Date;
  ilerleme: OdevIlerlemesi;
  /** Son tarihten sonra katıldıysa oranlara sayılmıyor. */
  sayilir: boolean;
}

/** Açıklar (son tarihi gelmemiş) ve süresi dolan son ödevlerden kaçı gösterilir. */
const SON_ODEV_SAYISI = 5;

/**
 * Öğrenci ayrıntı sayfasının "Gruplar ve ödevler" kartı. Ödevler yalnızca
 * etkin gruplardan ve iptal edilmemişlerden: öğrencinin kendi ekranında
 * gördüğüyle aynı küme (shared/odev.ts ogrenciGorur).
 */
export async function ogrencininGruplari(
  userId: string,
  now: Date
): Promise<{ gruplar: OgrencininGrubu[]; acik: OgrencininOdevi[]; son: OgrencininOdevi[] }> {
  const uyelikler = await db.groupMember.findMany({
    where: { userId },
    orderBy: [{ group: { name: "asc" } }, { id: "asc" }],
    select: { createdAt: true, group: { select: { id: true, name: true, examScope: true, archivedAt: true } } },
  });
  const gruplar = uyelikler.map((u) => ({ ...u.group, katildi: u.createdAt }));
  const etkin = gruplar.filter((g) => g.archivedAt === null);
  if (etkin.length === 0) return { gruplar, acik: [], son: [] };

  const odevler = await db.assignment.findMany({
    where: { groupId: { in: etkin.map((g) => g.id) }, cancelledAt: null },
    orderBy: [{ dueAt: "desc" }, { id: "asc" }],
    take: 60,
    select: {
      id: true,
      groupId: true,
      kind: true,
      packageId: true,
      topicId: true,
      questionCount: true,
      title: true,
      startsAt: true,
      dueAt: true,
      group: { select: { name: true } },
    },
  });
  const kayit = (await odevKayitlari([userId], odevler)).get(userId) ?? { oturumlar: [], cevaplar: [] };
  const katilma = new Map(etkin.map((g) => [g.id, g.katildi]));
  const satirlar: OgrencininOdevi[] = odevler.map((o) => ({
    id: o.id,
    groupId: o.groupId,
    grupAdi: o.group.name,
    title: o.title,
    kind: o.kind,
    dueAt: o.dueAt,
    ilerleme: odevIlerlemesi(o, kayit),
    sayilir: oranaSayilir({ createdAt: katilma.get(o.groupId) ?? now }, o),
  }));

  return {
    gruplar,
    acik: satirlar
      .filter((o) => o.dueAt.getTime() >= now.getTime())
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()),
    son: satirlar.filter((o) => o.dueAt.getTime() < now.getTime()).slice(0, SON_ODEV_SAYISI),
  };
}
