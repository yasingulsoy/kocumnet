import "server-only";
import { Prisma } from "./generated/client";
import { db } from "./db";
import { yakinOdevDurumlari, type YakinOdev } from "./gruplar";
import { haftaBasi } from "./shared/coaching";
import { YARIM_TEST_ESIGI } from "./shared/insights";
import { RISK_ESIK, riskBulgulari, riskPuani, sonEtkinlik, type RiskBulgusu, type RiskOzeti } from "./risk";

/**
 * Riskli öğrenci verisi — tek sorguda kapsamdaki bütün öğrencilerin özeti,
 * karar risk.ts'te. Üç ekran kullanır: Riskli öğrenciler (bulgusu olanlar),
 * Bu hafta (hepsi, rozetler) ve öğrenci ayrıntısı (tek öğrenci). Öğrenci
 * kişisel verisi: yalnızca yönetici/müdür ekranları çağırır (KVKK).
 */

export interface RiskliOgrenci extends RiskOzeti {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  targetExam: string | null;
  sonEtkinlik: Date;
  bulgular: RiskBulgusu[];
  puan: number;
  /** Yakın tarihli ödevler (açık ve son RISK_ESIK.odevPencereGun günde süresi dolan). */
  odevler: YakinOdev[];
}

/** Kimler: bütün öğrenciler, bir grubun üyeleri ya da tek öğrenci. */
export interface RiskKapsami {
  grupId?: string | null;
  userId?: string | null;
}

interface Raw {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  targetExam: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
  sonTest: Date | null;
  sonBaslama: Date | null;
  testSayisi: number;
  kapananTest: number;
  p1c: number | null;
  p1w: number | null;
  p1b: number | null;
  p2c: number | null;
  p2w: number | null;
  p2b: number | null;
  planToplam: number | null;
  planBiten: number | null;
}

function oran(c: number | null, w: number | null, b: number | null): number | null {
  if (c === null || w === null || b === null) return null;
  const toplam = Number(c) + Number(w) + Number(b);
  return toplam > 0 ? Number(c) / toplam : null;
}

/*
 * Ölçüm sayılan sonuç — shared/insights.ts olcumDisi'nin SQL İKİZİ (değili).
 * Takma adlar çağıran koddaki sabitlerdir; kullanıcı girdisi buraya girmez.
 *   işaretli:        doğru + yanlış > 0                         (isaretsiz değil)
 *   yarım kalmamış:  öğrenci bitirdi (STUDENT) ya da eski kayıt (endedBy boş)
 *                    ya da işaretli pay YARIM_TEST_ESIGI'nin altında değil (yarimKaldi değil)
 * Kural değişirse ikisi birlikte değişmeli; eşik sayısı kopyadan okunuyor.
 */
function sqlOlcum(cs: string, r: string): Prisma.Sql {
  const S = Prisma.raw(cs);
  const R = Prisma.raw(r);
  return Prisma.sql`(${R}."correctCount" + ${R}."wrongCount" > 0 AND NOT (
    ${S}."endedBy" IS NOT NULL AND ${S}."endedBy" <> 'STUDENT'
    AND (${R}."correctCount" + ${R}."wrongCount")::float8
        < (${R}."correctCount" + ${R}."wrongCount" + ${R}."blankCount")::float8 * ${YARIM_TEST_ESIGI}::float8
  ))`;
}

/** Kapsam süzgeci: `kolon` bir öğrenci kimliği sütunu (sabit). */
function sqlKapsam(kolon: string, k: RiskKapsami): Prisma.Sql {
  const K = Prisma.raw(kolon);
  if (k.userId) return Prisma.sql`AND ${K} = ${k.userId}`;
  if (k.grupId) return Prisma.sql`AND ${K} IN (SELECT gm."userId" FROM "GroupMember" gm WHERE gm."groupId" = ${k.grupId})`;
  return Prisma.empty;
}

/**
 * Kapsamdaki BÜTÜN öğrencilerin risk özeti (bulgusu olmayanlar dahil).
 * Toplam üç-dört sorgu: tek ham SQL ve ödevlerin toplu sorgusu
 * (gruplar.ts yakinOdevDurumlari); öğrenci başına sorgu yok.
 */
export async function riskSatirlari(now: Date = new Date(), kapsam: RiskKapsami = {}): Promise<RiskliOgrenci[]> {
  // Geçen hafta: öğrenci uygulamasının hafta tanımıyla (pazartesi, Türkiye saati).
  // StudyPlan.weekStart @db.Date — karşılaştırma tarih metniyle, saat dilimi karışmasın.
  const gecenHafta = new Date(haftaBasi(now).getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

  const rows = await db.$queryRaw<Raw[]>`
    WITH testler AS (
      -- "Hiç başlamadı" için ÖLÇÜM sayılan test (n): boş gönderilen ve yarım
      -- kalan (süresi dolan / yeniden başlatılan, yarısından azı işaretli)
      -- sayılmaz. "Pasif" için son biten test (son): boş da olsa etkinlik.
      SELECT cs."userId", max(cs."submittedAt") AS son,
             count(*)::int AS kapanan,
             count(*) FILTER (WHERE r.id IS NOT NULL AND ${sqlOlcum("cs", "r")})::int AS n
      FROM "CheckupSession" cs
      LEFT JOIN "CheckupResult" r ON r."sessionId" = cs.id
      -- Alıştırma test sayılmaz: ölçüm değil (öğrenci uygulaması, lib/practice.ts).
      WHERE cs.status = 'SUBMITTED' AND cs.kind <> 'PRACTICE' ${sqlKapsam('cs."userId"', kapsam)}
      GROUP BY cs."userId"
    ),
    -- "Pasif" için etkinlik: HER TÜRDEN oturumun (alıştırma, defter tekrarı,
    -- kontrol testi, yarım bırakılan dahil) en son başlama anı. lastSeenAt
    -- yeni (eski kayıtlarda boş) ve en fazla saatte bir yazılıyor; oturum bu
    -- yüzden hâlâ ayrı bir kanıt. ("userId", "startedAt") indeksi var; cevap
    -- tablosu (Answer) taranmaz.
    baslama AS (
      SELECT cs."userId", max(cs."startedAt") AS son
      FROM "CheckupSession" cs
      WHERE TRUE ${sqlKapsam('cs."userId"', kapsam)}
      GROUP BY cs."userId"
    ),
    /*
     * "Düşüşte": son iki ÖLÇÜM. SQL İKİZİ: öğrenci uygulamasının eğilim kuralı
     * app/lib/insights.ts egilimeGirer (panelde shared/insights.ts) — paket
     * testi (kind PACKAGE), ölçüm sayılan (sqlOlcum: boş ve yarım değil),
     * öğrencinin hedef sınavında (hedef yoksa her sınav). Kâğıtta çözülen
     * dahil: o da ölçüm. Kural değişirse ikisi birlikte değişmeli.
     *
     * Ek olarak iki test aynı paket TÜRÜNDEN (STANDARD, INTRO, MOCK): 40
     * soruluk denemenin oranı 15 soruluk testin oranıyla kıyaslanmaz. En son
     * testin türü alınır, önceki = aynı türden bir önceki test (sira 2).
     */
    paket AS (
      SELECT cs."userId", pk.kind::text AS tur,
             r."correctCount" AS c, r."wrongCount" AS w, r."blankCount" AS b,
             row_number() OVER (PARTITION BY cs."userId", pk.kind ORDER BY cs."submittedAt" DESC, cs.id) AS sira,
             row_number() OVER (PARTITION BY cs."userId" ORDER BY cs."submittedAt" DESC, cs.id) AS genel
      FROM "CheckupSession" cs
      JOIN "CheckupResult" r ON r."sessionId" = cs.id
      JOIN "Package" pk ON pk.id = cs."packageId"
      JOIN "User" su ON su.id = cs."userId"
      WHERE cs.status = 'SUBMITTED' AND cs.kind = 'PACKAGE'
        AND pk.kind IN ('STANDARD', 'INTRO', 'MOCK')
        AND ${sqlOlcum("cs", "r")}
        AND (su."targetExam" IS NULL OR pk."examScope" = su."targetExam")
        ${sqlKapsam('cs."userId"', kapsam)}
    ),
    sonTur AS (
      SELECT "userId", tur FROM paket WHERE genel = 1
    ),
    plan AS (
      SELECT sp."userId",
             count(pi.id)::int AS toplam,
             count(pi.id) FILTER (
               WHERE CASE WHEN pi.kind = 'RETEST' THEN pi."verifiedBySessionId" IS NOT NULL
                          ELSE pi."doneAt" IS NOT NULL END
             )::int AS biten
      FROM "StudyPlan" sp
      JOIN "PlanItem" pi ON pi."planId" = sp.id
      WHERE sp."weekStart" = ${gecenHafta}::date ${sqlKapsam('sp."userId"', kapsam)}
      GROUP BY sp."userId"
    )
    SELECT u.id, u.name, u.email, u.grade::text AS grade, u."targetExam"::text AS "targetExam",
           u."createdAt", u."lastLoginAt", u."lastSeenAt",
           t.son AS "sonTest", bs.son AS "sonBaslama",
           COALESCE(t.n, 0)::int AS "testSayisi", COALESCE(t.kapanan, 0)::int AS "kapananTest",
           p1.c AS p1c, p1.w AS p1w, p1.b AS p1b,
           p2.c AS p2c, p2.w AS p2w, p2.b AS p2b,
           pl.toplam AS "planToplam", pl.biten AS "planBiten"
    FROM "User" u
    LEFT JOIN testler t ON t."userId" = u.id
    LEFT JOIN baslama bs ON bs."userId" = u.id
    LEFT JOIN sonTur st ON st."userId" = u.id
    LEFT JOIN paket p1 ON p1."userId" = u.id AND p1.tur = st.tur AND p1.sira = 1
    LEFT JOIN paket p2 ON p2."userId" = u.id AND p2.tur = st.tur AND p2.sira = 2
    LEFT JOIN plan pl ON pl."userId" = u.id
    WHERE u.role = 'STUDENT' ${sqlKapsam("u.id", kapsam)}
  `;

  // "Ödevi yapmadı" ve Bu hafta'nın ödev sütunları: açık ödevler ve son
  // pencerede süresi dolanlar, kapsamdaki öğrenciler için tek seferde.
  const odevler = await yakinOdevDurumlari(
    kapsam.userId || kapsam.grupId ? rows.map((r) => r.id) : null,
    new Date(now.getTime() - RISK_ESIK.odevPencereGun * 86_400_000)
  );

  return rows.map((r) => {
    const ozet: RiskOzeti = {
      createdAt: r.createdAt,
      lastLoginAt: r.lastLoginAt,
      lastSeenAt: r.lastSeenAt,
      sonTest: r.sonTest,
      sonBaslama: r.sonBaslama,
      testSayisi: Number(r.testSayisi),
      kapananTest: Number(r.kapananTest),
      sonIkiPaket: [oran(r.p1c, r.p1w, r.p1b), oran(r.p2c, r.p2w, r.p2b)],
      gecenHaftaPlan:
        r.planToplam === null ? null : { toplam: Number(r.planToplam), biten: Number(r.planBiten ?? 0) },
      odevler: odevler.get(r.id) ?? [],
    };
    const bulgular = riskBulgulari(ozet, now);
    return {
      ...ozet,
      odevler: odevler.get(r.id) ?? [],
      id: r.id,
      name: r.name,
      email: r.email,
      grade: r.grade,
      targetExam: r.targetExam,
      sonEtkinlik: sonEtkinlik(ozet),
      bulgular,
      puan: riskPuani(bulgular),
    };
  });
}

/** Yalnızca en az bir bulgusu olan öğrenciler, en ciddisi en üstte. `toplam` kapsamdaki öğrenci sayısı. */
export async function loadRiskliOgrenciler(
  now: Date = new Date(),
  kapsam: RiskKapsami = {}
): Promise<{ liste: RiskliOgrenci[]; toplam: number }> {
  const hepsi = await riskSatirlari(now, kapsam);
  const liste = hepsi.filter((o) => o.bulgular.length > 0);
  // En ciddi önce; eşitlikte en uzun süredir sessiz olan.
  liste.sort((a, b) => b.puan - a.puan || a.sonEtkinlik.getTime() - b.sonEtkinlik.getTime());
  return { liste, toplam: hepsi.length };
}
