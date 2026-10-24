import "server-only";
import { db } from "./db";
import type { Prisma } from "./generated/client";
import { odevKayitlari } from "./gruplar";
import {
  birakmaDagilimi,
  huniHesapla,
  ilkOlcumAnlari,
  kaynakDagilimi,
  kazancEslestir,
  kazancOzeti,
  kontrolTestleri,
  odevOzeti,
  testDurumlari,
  zorlukAlgisi,
  type AlgiPaketi,
  type BirakmaDagilimi,
  type HuniAdimi,
  type KaynakSatiri,
  type KazancOzeti,
  type KonuSayisi,
  type OdevOzeti,
  type OturumSatiri,
  type PilotSuzgeci,
  type TestDurumlari,
} from "./pilot-kurallari";
import type { OzellikAnahtari } from "./pilot-tanimlar";
import { isaretsiz, yarimKaldi } from "./shared/insights";
import { odevIlerlemesi, tamamlandiMi } from "./shared/odev";
import type { TopicBreakdown, TopicBreakdownEntry } from "./shared/scoring";

/**
 * Pilot ölçümünün sorguları (server-only). Hesapların hepsi saf modülde
 * (pilot-kurallari.ts); burada yalnızca satırlar toplanır.
 *
 * DÖNEN VERİDE KİŞİ YOK: öğrenci kimliği, adı, e-postası buradan çıkmaz,
 * yalnızca sayılar ve konu/paket/grup adları. Küçük sayı kuralı (<5) çizim
 * anında uygulanır (ekran ve rapor aynı fonksiyonla, pilot-kurallari.ts
 * sayiMetni); ham sayı sunucuda kalır, istemciye giden HTML'de yazılmaz.
 *
 * Bu modülü yalnızca MANAGE rollerini denetleyen sayfa ve rapor çağırır:
 * sayılar öğrenci verisinden türüyor.
 */

const GUN = 86_400_000;

export interface PilotGrubu {
  id: string;
  name: string;
  arsiv: boolean;
}

export interface PilotVerisi {
  suzgec: PilotSuzgeci;
  /** Seçili grubun adı; grup yoksa ya da bulunamadıysa null (bütün öğrenciler). */
  grupAdi: string | null;
  huni: HuniAdimi[];
  testler: TestDurumlari;
  birakma: BirakmaDagilimi;
  ozellik: {
    /** Dönemde etkin öğrenci: oranların paydası. */
    etkin: number;
    satirlar: { anahtar: OzellikAnahtari; sayi: number }[];
    odev: OdevOzeti;
  };
  kazanc: KazancOzeti;
  ek: {
    kontrol: { olculen: number; gecen: number; ogrenci: number };
    defter: { toplam: number; cikan: number; ogrenci: number };
    ipucu: { dogru: number; ipucuyla: number; ogrenci: number };
  };
  algi: { paketler: AlgiPaketi[]; gizlenen: number; ogrenci: number };
  kaynak: KaynakSatiri[];
  /** Dönemde en az bir test başlatan öğrenci (testler bölümünün tabanı). */
  testOgrenci: number;
}

/** Süzgeçteki grup seçimi için liste (arşivdekiler sonda). */
export async function pilotGruplari(): Promise<PilotGrubu[]> {
  const gruplar = await db.studyGroup.findMany({
    orderBy: [{ archivedAt: { sort: "desc", nulls: "first" } }, { name: "asc" }],
    take: 300,
    select: { id: true, name: true, archivedAt: true },
  });
  return gruplar.map((g) => ({ id: g.id, name: g.name, arsiv: g.archivedAt !== null }));
}

function konuSatirlari(tb: unknown): TopicBreakdownEntry[] {
  const t = tb as TopicBreakdown | null;
  return t && Array.isArray(t.topics) ? t.topics : [];
}

const sonucSec = { correctCount: true, wrongCount: true, blankCount: true, computedAt: true } as const;

export async function loadPilot(s: PilotSuzgeci): Promise<PilotVerisi> {
  // Seçili grup yoksa (silinmiş, yanlış adres) bütün öğrencilere dön; ekran grubu "Hepsi" gösterir.
  const grup = s.grupId
    ? await db.studyGroup.findUnique({ where: { id: s.grupId }, select: { id: true, name: true } })
    : null;
  const suzgec: PilotSuzgeci = { ...s, grupId: grup?.id ?? null };

  const ogrenci: Prisma.UserWhereInput = grup
    ? { role: "STUDENT", groupMemberships: { some: { groupId: grup.id } } }
    : { role: "STUDENT" };
  const kohort: Prisma.UserWhereInput = { ...ogrenci, createdAt: { gte: s.basAn, lt: s.bitisAn } };
  const donem = { gte: s.basAn, lt: s.bitisAn };

  const [
    kayitlar,
    kohortOturumlari,
    donemOturumlari,
    ipucuOturumlari,
    veliBaglantilari,
    kocaSoranlar,
    bildirenler,
    sonGorulenler,
    postaKapatanlar,
    odevler,
    kazancSatirlari,
    oncekiDenemeler,
    planlar,
    defterMaddeleri,
    defterCikan,
    alistirmaDogru,
    ipucuylaDogru,
  ] = await Promise.all([
    db.user.findMany({
      where: kohort,
      select: { id: true, createdAt: true, onboardedAt: true, lastSeenAt: true, signupSource: true },
    }),
    // Kayıt grubunun dönem sonuna kadarki bütün oturumları (huni: ilk ölçüm ve haftalık etkinlik).
    db.checkupSession.findMany({
      where: { user: kohort, startedAt: { lt: s.gozlemSonu } },
      select: {
        userId: true,
        kind: true,
        status: true,
        endedBy: true,
        startedAt: true,
        submittedAt: true,
        result: { select: sonucSec },
      },
    }),
    // Dönemde başlatılan bütün oturumlar (testler, kullanım, zorluk algısı).
    db.checkupSession.findMany({
      where: { user: ogrenci, startedAt: donem },
      select: {
        id: true,
        userId: true,
        kind: true,
        mode: true,
        practiceMode: true,
        status: true,
        endedBy: true,
        startedAt: true,
        submittedAt: true,
        perceivedDifficulty: true,
        packageId: true,
        package: { select: { name: true } },
        result: { select: sonucSec },
      },
    }),
    db.sessionItem.groupBy({
      by: ["sessionId"],
      where: { hintsUsed: { gt: 0 }, session: { user: ogrenci, startedAt: donem } },
    }),
    db.parentLink.findMany({ where: { user: ogrenci, createdAt: donem }, select: { userId: true, viewCount: true } }),
    db.coachQuestion.findMany({
      where: { user: ogrenci, createdAt: donem },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.questionNote.findMany({
      where: { kind: "STUDENT_REPORT", reportedBy: ogrenci, createdAt: donem },
      distinct: ["reportedById"],
      select: { reportedById: true },
    }),
    db.user.findMany({ where: { ...ogrenci, lastSeenAt: donem }, select: { id: true } }),
    db.user.findMany({ where: { ...ogrenci, mailOptOut: true }, select: { id: true } }),
    // Dönemle çakışan, iptal edilmemiş ödevler; grup seçiliyse yalnızca onunkiler.
    db.assignment.findMany({
      where: {
        cancelledAt: null,
        startsAt: { lt: s.bitisAn },
        dueAt: { gte: s.basAn },
        ...(grup ? { groupId: grup.id } : {}),
      },
      select: {
        kind: true,
        packageId: true,
        topicId: true,
        questionCount: true,
        startsAt: true,
        dueAt: true,
        group: { select: { members: { where: { user: { role: "STUDENT" } }, select: { userId: true } } } },
      },
    }),
    db.checkupResult.findMany({
      where: { computedAt: donem, session: { user: ogrenci, kind: { in: ["PACKAGE", "TOPIC_RETEST"] } } },
      select: {
        ...sonucSec,
        topicBreakdown: true,
        session: {
          select: {
            userId: true,
            kind: true,
            endedBy: true,
            relaxedExposureCount: true,
            packageId: true,
            focusTopicId: true,
            package: { select: { kind: true } },
          },
        },
      },
    }),
    // Dönemden önce çözülmüş denemeler: dönemdeki ikinci çözüm tekrar sayılsın.
    db.checkupSession.findMany({
      where: { user: ogrenci, package: { kind: "MOCK" }, status: "SUBMITTED", submittedAt: { lt: s.basAn } },
      distinct: ["userId", "packageId"],
      select: { userId: true, packageId: true },
    }),
    // Dönemle çakışan haftaların planlarındaki konular (hafta başı dönemden en çok 7 gün önce).
    db.planItem.findMany({
      where: {
        topicId: { not: null },
        plan: { user: ogrenci, weekStart: { gte: new Date(s.basAn.getTime() - 7 * GUN), lt: s.bitisAn } },
      },
      select: { topicId: true, plan: { select: { userId: true, weekStart: true } } },
    }),
    db.notebookItem.groupBy({ by: ["userId"], where: { user: ogrenci, createdAt: donem }, _count: { _all: true } }),
    db.notebookItem.count({ where: { user: ogrenci, createdAt: donem, resolvedAt: { not: null } } }),
    db.answer.count({
      where: { isCorrect: true, sessionItem: { session: { kind: "PRACTICE", user: ogrenci, startedAt: donem } } },
    }),
    db.answer.count({
      where: {
        isCorrect: true,
        sessionItem: { hintsUsed: { gt: 0 }, session: { kind: "PRACTICE", user: ogrenci, startedAt: donem } },
      },
    }),
  ]);

  const oturumSatiri = (o: {
    userId: string;
    kind: string;
    status: string;
    endedBy: string | null;
    startedAt: Date;
    submittedAt: Date | null;
    result: { correctCount: number; wrongCount: number; blankCount: number; computedAt: Date } | null;
  }): OturumSatiri => ({
    userId: o.userId,
    kind: o.kind,
    status: o.status,
    endedBy: o.endedBy,
    startedAt: o.startedAt,
    sonuc: o.result
      ? {
          correctCount: o.result.correctCount,
          wrongCount: o.result.wrongCount,
          blankCount: o.result.blankCount,
          an: o.submittedAt ?? o.result.computedAt,
        }
      : null,
  });

  // ── (a) Huni ve (f) kayıt kaynağı ─────────────────────────
  const kohortSatirlari = kohortOturumlari.map(oturumSatiri);
  const huni = huniHesapla(kayitlar, kohortSatirlari, s.gozlemSonu);
  const ilkOlcum = ilkOlcumAnlari(kohortSatirlari, s.gozlemSonu);
  const kaynak = kaynakDagilimi(kayitlar.map((u) => ({ signupSource: u.signupSource, ilkOlcum: ilkOlcum.has(u.id) })));

  // ── (b) Testler ───────────────────────────────────────────
  const testOturumlari = donemOturumlari.filter((o) => o.kind !== "PRACTICE");
  const testler = testDurumlari(testOturumlari.map(oturumSatiri));
  // Bıraktığı yer: yarım kalan (en az bir işaretli) testlerin soruları.
  const yarimIdler = testOturumlari
    .filter((o) => {
      if (!o.result) return false;
      const r = { ...o.result, endedBy: o.endedBy };
      return !isaretsiz(r) && yarimKaldi(r);
    })
    .map((o) => o.id);
  const yarimKalemler = yarimIdler.length
    ? await db.sessionItem.findMany({
        where: { sessionId: { in: yarimIdler } },
        select: {
          sessionId: true,
          sortOrder: true,
          answer: { select: { choiceId: true, firstAnsweredAt: true, answeredAt: true } },
        },
      })
    : [];
  const testBasina = new Map<string, { sira: number; isaretli: boolean; an: Date | null }[]>();
  for (const k of yarimKalemler) {
    const isaretli = k.answer?.choiceId != null;
    const l = testBasina.get(k.sessionId) ?? [];
    l.push({ sira: k.sortOrder, isaretli, an: isaretli ? (k.answer?.firstAnsweredAt ?? k.answer?.answeredAt ?? null) : null });
    testBasina.set(k.sessionId, l);
  }
  const birakma = birakmaDagilimi([...testBasina.values()]);

  // ── (c) Özellik kullanımı ─────────────────────────────────
  const kim = (kosul: (o: (typeof donemOturumlari)[number]) => boolean) =>
    new Set(donemOturumlari.filter(kosul).map((o) => o.userId));
  const oturumSahibi = new Map(donemOturumlari.map((o) => [o.id, o.userId]));
  const kullananlar: Record<Exclude<OzellikAnahtari, "postaKapatan">, Set<string>> = {
    alistirma: kim((o) => o.kind === "PRACTICE"),
    alistirmaSIMILAR: kim((o) => o.kind === "PRACTICE" && o.practiceMode === "SIMILAR"),
    alistirmaTOPIC: kim((o) => o.kind === "PRACTICE" && o.practiceMode === "TOPIC"),
    alistirmaREVIEW: kim((o) => o.kind === "PRACTICE" && o.practiceMode === "REVIEW"),
    ipucu: new Set(ipucuOturumlari.map((r) => oturumSahibi.get(r.sessionId)).filter((u): u is string => !!u)),
    kagit: kim((o) => o.mode === "PAPER"),
    kontrol: kim((o) => o.kind === "TOPIC_RETEST"),
    seviyeli: kim((o) => o.kind === "LEVEL_STAGE"),
    veliOlusturan: new Set(veliBaglantilari.map((v) => v.userId)),
    veliGoruntulenen: new Set(veliBaglantilari.filter((v) => v.viewCount > 0).map((v) => v.userId)),
    kocaSoru: new Set(kocaSoranlar.map((k) => k.userId)),
    hataBildirimi: new Set(bildirenler.map((b) => b.reportedById).filter((u): u is string => !!u)),
  };

  // Ödev: öğrenci × ödev çiftleri, tamamlanma öğrencinin ekranındaki kuralla.
  // Grup seçiliyse ödevler (ve üyeleri) zaten yalnızca o grubun.
  const odevUyeleri = new Set(odevler.flatMap((o) => o.group.members.map((m) => m.userId)));
  const odevKayit = await odevKayitlari([...odevUyeleri], odevler);
  const atamalar = odevler.flatMap((o) =>
    o.group.members.map((m) => {
      const i = odevIlerlemesi(o, odevKayit.get(m.userId) ?? { oturumlar: [], cevaplar: [] });
      const zamaninda = i.tamamlanmaAni !== null && i.tamamlanmaAni.getTime() <= s.gozlemSonu.getTime();
      return { ogrenci: m.userId, tamamlandi: tamamlandiMi(i.durum) && zamaninda };
    })
  );
  const odev = odevOzeti(atamalar);

  // Etkin öğrenci: dönemde oturum başlatan, son görülmesi döneme düşen ya da bir özelliği kullanan.
  const etkin = new Set<string>([...donemOturumlari.map((o) => o.userId), ...sonGorulenler.map((u) => u.id)]);
  for (const l of Object.values(kullananlar)) for (const u of l) etkin.add(u);
  const postaKapatan = postaKapatanlar.filter((u) => etkin.has(u.id)).length;

  const ozellikSirasi: OzellikAnahtari[] = [
    "alistirma",
    "alistirmaSIMILAR",
    "alistirmaTOPIC",
    "alistirmaREVIEW",
    "ipucu",
    "kagit",
    "kontrol",
    "seviyeli",
    "veliOlusturan",
    "veliGoruntulenen",
    "kocaSoru",
    "hataBildirimi",
    "postaKapatan",
  ];
  const satirlar = ozellikSirasi.map((anahtar) => ({
    anahtar,
    sayi: anahtar === "postaKapatan" ? postaKapatan : kullananlar[anahtar].size,
  }));

  // ── (d) Öğrenme kazancı ve ek göstergeler ────────────────
  const kazancSonuclari = kazancSatirlari.map((r) => {
    const konular = konuSatirlari(r.topicBreakdown);
    return {
      userId: r.session.userId,
      kind: r.session.kind,
      endedBy: r.session.endedBy,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      blankCount: r.blankCount,
      relaxedExposureCount: r.session.relaxedExposureCount,
      packageId: r.session.packageId,
      packageKind: r.session.package.kind,
      focusTopicId: r.session.focusTopicId,
      an: r.computedAt,
      konular: konular.map(
        (t): KonuSayisi & { level: TopicBreakdownEntry["level"] } => ({
          topicId: t.topicId,
          name: t.name,
          asked: t.asked,
          correct: t.correct,
          level: t.level,
        })
      ),
    };
  });
  const eslesmeler = kazancEslestir(
    kazancSonuclari,
    planlar.map((p) => ({ userId: p.plan.userId, topicId: p.topicId as string, weekStart: p.plan.weekStart })),
    oncekiDenemeler
  );
  const kazanc = kazancOzeti(eslesmeler);
  const kontrol = kontrolTestleri(kazancSonuclari);

  // ── (e) Zorluk algısı ─────────────────────────────────────
  const algi = zorlukAlgisi(
    testOturumlari.flatMap((o) =>
      o.perceivedDifficulty !== null && o.result
        ? [
            {
              userId: o.userId,
              packageId: o.packageId,
              paketAdi: o.package.name,
              kind: o.kind,
              endedBy: o.endedBy,
              correctCount: o.result.correctCount,
              wrongCount: o.result.wrongCount,
              blankCount: o.result.blankCount,
              algi: o.perceivedDifficulty,
            },
          ]
        : []
    )
  );

  return {
    suzgec,
    grupAdi: grup?.name ?? null,
    huni,
    testler,
    birakma,
    ozellik: { etkin: etkin.size, satirlar, odev },
    kazanc,
    ek: {
      kontrol,
      defter: {
        toplam: defterMaddeleri.reduce((t, r) => t + r._count._all, 0),
        cikan: defterCikan,
        ogrenci: defterMaddeleri.length,
      },
      ipucu: { dogru: alistirmaDogru, ipucuyla: ipucuylaDogru, ogrenci: kullananlar.alistirma.size },
    },
    algi,
    kaynak,
    testOgrenci: new Set(testOturumlari.map((o) => o.userId)).size,
  };
}
