import "server-only";
import { Prisma } from "./generated/client";
import { db } from "./db";
import { sqlKendisiYaDaKonusuSinavda, sqlKonuSinavda } from "./exam-scope";
import { MIN_L1_PER_OBJECTIVE, levelSizes } from "./levels";
import { EXAM_SCOPES, LEGACY_EXAM_SCOPE } from "./shared/exams";
import { S1_KAZANIM_EN_AZ_SORU } from "./shared/levels";
import type { HavuzSayisi } from "./package-rules";
import { denemeHazirlikEngelleri } from "./mock-rules";

/** Ham sorgulardaki sınav ifadeleri (sütun; kullanıcı girdisi değil). */
const PAKET_SINAVI = Prisma.raw('p."examScope"');
const SEVIYELI_SINAV = Prisma.raw("lp.ex");
const KAYNAK_SINAVI = Prisma.raw("k.ex");

/**
 * Soru havuzunun sağlığı. Tek bir soruya cevap verir: **hangi paket gerçekten
 * başlatılabiliyor?**
 *
 * Toplam soru sayısı yanıltıcı: 400 soruluk havuzla bile bir paketin istediği
 * konuda 2 soru varsa o paket başlamaz (öğrenci uygulamasındaki startCheckup
 * eksik testi reddeder). Bu yüzden kırılım paket × konu.
 *
 * Paket sayımları öğrenci uygulamasının seçimiyle (app/lib/question-selection.ts)
 * AYNI süzgeçten geçer: soru `examScopes` doluysa yalnızca listelediği
 * sınavlarda sorulur; boşsa konusunun sınavlarında (shared/exam-scope.ts). Eskiden panel bunu saymıyordu — "yalnızca AYT"
 * işaretli sorular LGS paketinin havuzunda görünüyor, havuzu yetmeyen paket
 * yayına alınabiliyordu.
 */

export interface TopicPoolRow {
  topicId: string;
  slug: string;
  name: string;
  examScope: string;
  published: number;
  draft: number;
  easy: number;
  medium: number;
  hard: number;
}

interface RawTopicRow {
  topicId: string;
  slug: string;
  name: string;
  examScope: string;
  published: bigint;
  draft: bigint;
  easy: bigint;
  medium: bigint;
  hard: bigint;
}

/** Yaprak konular (soru yalnızca yaprağa bağlanır) ve yayındaki soruların zorluk bantları. */
export async function loadTopicPool(): Promise<TopicPoolRow[]> {
  const rows = await db.$queryRaw<RawTopicRow[]>`
    SELECT t.id AS "topicId", t.slug, t.name, t."examScope"::text AS "examScope",
           count(q.id) FILTER (WHERE q.status = 'PUBLISHED')                        AS published,
           count(q.id) FILTER (WHERE q.status IN ('DRAFT','REVIEW'))                AS draft,
           count(q.id) FILTER (WHERE q.status = 'PUBLISHED' AND q.difficulty <= 2)  AS easy,
           count(q.id) FILTER (WHERE q.status = 'PUBLISHED' AND q.difficulty = 3)   AS medium,
           count(q.id) FILTER (WHERE q.status = 'PUBLISHED' AND q.difficulty >= 4)  AS hard
    FROM "Topic" t
    LEFT JOIN "Question" q ON q."topicId" = t.id
    WHERE NOT EXISTS (SELECT 1 FROM "Topic" c WHERE c."parentId" = t.id)
    GROUP BY t.id, t.slug, t.name, t."examScope"
    ORDER BY t."examScope", t.name
  `;

  // Postgres count() bigint döner; JSON'a ve aritmetiğe sokmadan sayıya çevir.
  return rows.map((r) => ({
    topicId: r.topicId,
    slug: r.slug,
    name: r.name,
    examScope: r.examScope,
    published: Number(r.published),
    draft: Number(r.draft),
    easy: Number(r.easy),
    medium: Number(r.medium),
    hard: Number(r.hard),
  }));
}

// ─────────────────────────────────────────────────────────────
// Havuzun tükenmesi: konu başına tekrar soru
// ─────────────────────────────────────────────────────────────

/** Havuz ekranı: son kaç günün oturumları. */
export const HAVUZ_TUKENME_GUN = 14;

/**
 * Konu başına, son HAVUZ_TUKENME_GUN günde o konudan soru içeren oturum ve
 * bunlardan o konuda öğrenciye daha önce gördüğü soru gelenler.
 *
 * Oturumun relaxedExposureCount'u (havuz yetmedi, tekrar engeli gevşedi)
 * konuyu söylemiyor: 8 konulu bir pakette tek konunun havuzu bitince sekiz
 * konu birden "tükeniyor" görünürdü. Bu yüzden gevşeyen oturumda konu başına
 * bakılır: o konunun bir sorusu aynı öğrenciye pencere içinde (öğrenci
 * uygulamasının tekrar engeliyle aynı gün sayısı) başka bir oturumda da
 * sorulmuş mu. Deneme sayılmaz: soruları sabit, havuzdan seçilmiyor.
 * Alıştırma sayılır: o da havuzdan seçiyor ve tekrar engeline yazıyor.
 */
export async function loadHavuzTukenmesi(
  now: Date,
  pencereGun: number
): Promise<Map<string, { oturum: number; tekrarli: number }>> {
  const bas = new Date(now.getTime() - HAVUZ_TUKENME_GUN * 86_400_000);
  const rows = await db.$queryRaw<{ topicId: string; oturum: number; tekrarli: number }[]>`
    WITH kalem AS (
      SELECT s.id AS oturum, q."topicId",
             (s."relaxedExposureCount" > 0 AND EXISTS (
               SELECT 1
               FROM "SessionItem" i2
               JOIN "CheckupSession" s2 ON s2.id = i2."sessionId"
               WHERE i2."questionId" = i."questionId"
                 AND s2."userId" = s."userId"
                 AND s2.id <> s.id
                 AND s2."startedAt" < s."startedAt"
                 AND s2."startedAt" >= s."startedAt" - (${pencereGun}::int * interval '1 day')
             )) AS tekrar
      FROM "CheckupSession" s
      JOIN "Package" p ON p.id = s."packageId"
      JOIN "SessionItem" i ON i."sessionId" = s.id
      JOIN "Question" q ON q.id = i."questionId"
      WHERE s."startedAt" >= ${bas} AND p.kind <> 'MOCK'
    )
    SELECT "topicId",
           count(DISTINCT oturum)::int AS oturum,
           (count(DISTINCT oturum) FILTER (WHERE tekrar))::int AS tekrarli
    FROM kalem
    GROUP BY "topicId"
  `;
  return new Map(rows.map((r) => [r.topicId, { oturum: Number(r.oturum), tekrarli: Number(r.tekrarli) }]));
}

// ─────────────────────────────────────────────────────────────
// Paketler
// ─────────────────────────────────────────────────────────────

export type PackageKind = "STANDARD" | "INTRO" | "RETEST" | "LEVEL" | "MOCK" | "PRACTICE";
export type PackageState = "ready" | "narrow" | "blocked";

/** Konu dağılımı olan paketler (katalog). Tekrar testi ve seviyeli paketin dağılımı yok. */
export const BLUEPRINT_KINDS: readonly string[] = ["STANDARD", "INTRO"];

/** Paketin bir konusu: istenen soru ve paketin SINAVINDA sorulabilen yayındaki soru. */
export interface BlueprintRow {
  topicId: string;
  slug: string;
  name: string;
  need: number;
  have: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface LevelReadiness {
  /** Yayında ve bu sınavda ölçülen kazanım (sorusu olsun olmasın). */
  l1Total: number;
  /**
   * Öğrenciye GERÇEKTEN sorulacak kazanımlardan (sorulabilenlerin sıradaki
   * ilk l1Need tanesi) en az MIN_L1_PER_OBJECTIVE yayında L1 sorusu olanlar:
   * teyit turunda yeni soru bulabilen kazanım.
   */
  l1Ready: number;
  /**
   * Sorulabilen kazanım: bu sınavda en az S1_KAZANIM_EN_AZ_SORU yayında L1
   * sorusu var. l1Need'den azsa seviye 1 (ve koşu) hiç başlamaz.
   */
  l1Any: number;
  l1Need: number;
  l2: number;
  l2Need: number;
  l3: number;
  l3Need: number;
}

export interface PackageHealth {
  id: string;
  slug: string;
  name: string;
  kind: PackageKind;
  status: string;
  isFree: boolean;
  examScope: string;
  questionCount: number;
  durationMinutes: number;
  topicCount: number;
  /** Katalog paketlerinde konu konu havuz (sınav süzgeçli). */
  blueprint: BlueprintRow[];
  /** Havuzu ihtiyacın 2 katından az olan konular. */
  gaps: { name: string; need: number; have: number }[];
  /** Havuzu ihtiyacın bile altında kalan konular — paket BAŞLAMAZ. */
  blocking: { name: string; need: number; have: number }[];
  /** Konu tekrar testi: kaç yaprak konuda kontrol testine yetecek soru var. */
  retest: { ready: number; total: number } | null;
  /** Seviyeli check-up: seviye başına hazırlık. */
  level: LevelReadiness | null;
  /** Deneme: sabit listenin durumu (mock-rules.ts ListeDurumu) ve yayın engelleri. */
  mock: { listede: number; yayindaOlmayan: Record<string, number>; sinavDisi: number; engeller: string[] } | null;
  state: PackageState;
  /** Durumun tek cümlelik açıklaması — tabloda ve yayın engeli mesajında. */
  summary: string;
}

interface RawBlueprint {
  packageId: string;
  topicId: string;
  slug: string;
  name: string;
  need: number;
  have: number;
  easy: number;
  medium: number;
  hard: number;
}

interface RawRetest {
  packageId: string;
  total: number;
  ready: number;
}

interface RawMock {
  packageId: string;
  status: string;
  n: number;
  sinavDisi: number;
}

interface RawLevel {
  packageId: string;
  l1Total: number;
  l1Ready: number;
  l1Any: number;
  l2: number;
  l3: number;
}

/**
 * Bütün paketlerin sağlığı, türüne göre:
 *
 * - Katalog (STANDARD, INTRO): konu dağılımı × paketin sınavında sorulabilen
 *   yayındaki soru.
 * - Konu tekrar testi (RETEST): dağılımı yok, soru oturumun konusundan
 *   seçiliyor. Hazırlık = kaç yaprak konuda kontrol testine yetecek soru var.
 * - Seviyeli (LEVEL): dağılımı yok. Hazırlık = seviye 1 kazanımları, seviye
 *   2-3 soruları.
 *
 * "Bu sınavda sorulabilir" kuralı öğrenci uygulamasının seviyeli seçimiyle
 * birebir aynı (lib/checkup/exam-scope.ts): soru/kazanım `examScopes`'u doluysa
 * o liste, boşsa konusunun sınavları. Paket seçimi (`pick`) de aynı kuralı
 * uyguluyor: konusu paketin sınavında değilse kapsamı boş soru gelmez.
 */
export async function loadPackageHealth(): Promise<PackageHealth[]> {
  const [packages, blueprint, retest, level, mock] = await Promise.all([
    db.package.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        status: true,
        isFree: true,
        examScope: true,
        questionCount: true,
        durationMinutes: true,
      },
    }),
    db.$queryRaw<RawBlueprint[]>`
      SELECT pt."packageId", pt."topicId", t.slug, t.name, pt."questionCount" AS need,
             count(q.id)::int                                       AS have,
             count(q.id) FILTER (WHERE q.difficulty <= 2)::int      AS easy,
             count(q.id) FILTER (WHERE q.difficulty = 3)::int       AS medium,
             count(q.id) FILTER (WHERE q.difficulty >= 4)::int      AS hard
      FROM "PackageTopic" pt
      JOIN "Package" p ON p.id = pt."packageId"
      JOIN "Topic" t ON t.id = pt."topicId"
      LEFT JOIN "Question" q
        ON q."topicId" = pt."topicId"
       AND q.status = 'PUBLISHED'
       AND ${sqlKendisiYaDaKonusuSinavda("q", "t", PAKET_SINAVI)}
      GROUP BY pt.id, t.id
      ORDER BY pt."packageId", pt."sortOrder"
    `,
    // Tekrar testinin konusu öğrencinin sonucundan gelir; aday konular
    // sınavın yaprak konuları (konu kuralı), soru süzgeci `pick` ile aynı.
    db.$queryRaw<RawRetest[]>`
      SELECT p.id AS "packageId",
             count(t.id)::int AS total,
             count(t.id) FILTER (WHERE (
               SELECT count(*) FROM "Question" q
               WHERE q."topicId" = t.id
                 AND q.status = 'PUBLISHED'
                 AND ${sqlKendisiYaDaKonusuSinavda("q", "t", PAKET_SINAVI)}
             ) >= p."questionCount")::int AS ready
      FROM "Package" p
      JOIN "Topic" t ON ${sqlKonuSinavda("t", PAKET_SINAVI)}
      WHERE p.kind = 'RETEST'
        AND NOT EXISTS (SELECT 1 FROM "Topic" c WHERE c."parentId" = t.id)
      GROUP BY p.id
    `,
    db.$queryRaw<RawLevel[]>(seviyeliHazirlikSorgusu()),
    // Deneme: sabit liste — kaç soru, kaçı yayında değil (duruma göre), kaçı
    // paketin sınavında sorulamıyor. Kural lib/checkup/mock-rules.ts denemeHazirlikEngelleri (sınav dışı soru yalnızca uyarı, engel değil).
    db.$queryRaw<RawMock[]>`
      SELECT pq."packageId", q.status::text AS status,
             count(*)::int AS n,
             count(*) FILTER (WHERE NOT ${sqlKendisiYaDaKonusuSinavda("q", "t", PAKET_SINAVI)})::int AS "sinavDisi"
      FROM "PackageQuestion" pq
      JOIN "Package" p ON p.id = pq."packageId"
      JOIN "Question" q ON q.id = pq."questionId"
      JOIN "Topic" t ON t.id = q."topicId"
      WHERE p.kind = 'MOCK'
      GROUP BY pq."packageId", q.status
    `,
  ]);

  const dagilim = new Map<string, BlueprintRow[]>();
  for (const r of blueprint) {
    const liste = dagilim.get(r.packageId) ?? [];
    liste.push({
      topicId: r.topicId,
      slug: r.slug,
      name: r.name,
      need: Number(r.need),
      have: Number(r.have),
      easy: Number(r.easy),
      medium: Number(r.medium),
      hard: Number(r.hard),
    });
    dagilim.set(r.packageId, liste);
  }
  const tekrar = new Map(retest.map((r) => [r.packageId, r]));
  const seviyeli = new Map(level.map((r) => [r.packageId, r]));
  const deneme = new Map<string, { listede: number; yayindaOlmayan: Record<string, number>; sinavDisi: number }>();
  for (const r of mock) {
    const d = deneme.get(r.packageId) ?? { listede: 0, yayindaOlmayan: {}, sinavDisi: 0 };
    d.listede += Number(r.n);
    d.sinavDisi += Number(r.sinavDisi);
    if (r.status !== "PUBLISHED") d.yayindaOlmayan[r.status] = Number(r.n);
    deneme.set(r.packageId, d);
  }

  return packages.map((p): PackageHealth => {
    const kind = p.kind as PackageKind;
    const rows = dagilim.get(p.id) ?? [];
    const ihtiyac = rows.map((r) => ({ name: r.name, need: r.need, have: r.have }));
    // Tekrar engeli yüzünden "tam yeterli" havuz aslında yetmez: öğrenci aynı
    // paketi ikinci kez çözemez. İhtiyacın 2 katını sağlıklı sayıyoruz.
    const gaps = ihtiyac.filter((g) => g.have < g.need * 2);
    const blocking = gaps.filter((g) => g.have < g.need);

    const base = {
      id: p.id,
      slug: p.slug,
      name: p.name,
      kind,
      status: p.status,
      isFree: p.isFree,
      examScope: p.examScope,
      questionCount: p.questionCount,
      durationMinutes: p.durationMinutes,
      topicCount: rows.length,
      blueprint: rows,
      gaps,
      blocking,
      retest: null,
      level: null,
      mock: null,
    };

    if (kind === "MOCK") {
      // Konu dağılımı yok (PackageTopic satırı gerekmez): ölçü sabit listenin kendisi.
      const d = deneme.get(p.id) ?? { listede: 0, yayindaOlmayan: {}, sinavDisi: 0 };
      const engeller = denemeHazirlikEngelleri({ soruSayisi: p.questionCount, ...d });
      return {
        ...base,
        gaps: [],
        blocking: [],
        mock: { ...d, engeller },
        state: engeller.length ? "blocked" : "ready",
        summary: engeller.length ? engeller.join(" ") : "Liste tam: " + d.listede + " soru, hepsi yayında.",
      };
    }

    if (kind === "RETEST") {
      const r = tekrar.get(p.id);
      const hazir = { ready: Number(r?.ready ?? 0), total: Number(r?.total ?? 0) };
      return {
        ...base,
        gaps: [],
        blocking: [],
        retest: hazir,
        state: hazir.ready === 0 ? "blocked" : hazir.ready < hazir.total ? "narrow" : "ready",
        summary:
          hazir.ready === 0
            ? "Hiçbir konuda kontrol testine yetecek soru yok (konu başına en az " + p.questionCount + ")."
            : hazir.ready +
              "/" +
              hazir.total +
              " konuda kontrol testi açılabilir (konu başına en az " +
              p.questionCount +
              " soru).",
      };
    }

    if (kind === "LEVEL") {
      const r = seviyeli.get(p.id);
      const hedef = levelSizes(p.examScope);
      const s: LevelReadiness = {
        l1Total: Number(r?.l1Total ?? 0),
        l1Ready: Number(r?.l1Ready ?? 0),
        l1Any: Number(r?.l1Any ?? 0),
        l1Need: hedef.seviye1,
        l2: Number(r?.l2 ?? 0),
        l2Need: hedef.seviye2,
        l3: Number(r?.l3 ?? 0),
        l3Need: hedef.seviye3,
      };
      /*
       * Öğrenci uygulamasıyla aynı kural (app/lib/level-selection.ts
       * seviyeliHazirlik): koşu, üç seviyenin ana aşaması da TAM sayıyla
       * açılabiliyorsa başlar. Eskiden "hiç soru yoksa engel" deniyordu;
       * uygulama ise eksik soruyla aşama açıyordu. Şimdi uygulama eksik
       * havuzda koşuyu hiç açmıyor: yayındaki paket öğrenciye "hazır değil"
       * der, panel de bu yüzden yayına almaz.
       * Dar: sorulacak kazanımların bir kısmında yedek soru yok (teyit turu
       * kısmi açılır).
       */
      const engel = s.l1Any < s.l1Need || s.l2 < s.l2Need || s.l3 < s.l3Need;
      const dar = s.l1Ready < s.l1Need;
      return {
        ...base,
        gaps: [],
        blocking: [],
        level: s,
        state: engel ? "blocked" : dar ? "narrow" : "ready",
        summary:
          "Seviye 1: " + Math.min(s.l1Any, s.l1Need) + "/" + s.l1Need + " kazanım sorulabilir (" +
          s.l1Ready + " tanesinde teyit turu için yedek soru var) · " +
          "Seviye 2: " + s.l2 + " soru (" + s.l2Need + " gerekli) · " +
          "Seviye 3: " + s.l3 + " soru (" + s.l3Need + " gerekli)",
      };
    }

    const state: PackageState =
      rows.length === 0 || blocking.length ? "blocked" : gaps.length ? "narrow" : "ready";
    let summary = "Her konuda yeterli soru var.";
    if (rows.length === 0) {
      summary = "Pakette konu tanımlı değil.";
    } else if (blocking.length) {
      const ilk = blocking[0];
      summary =
        "“" + ilk.name + "” konusunda " + ilk.have + " yayında soru var, paket " + ilk.need + " istiyor" +
        (blocking.length > 1 ? " (ve " + (blocking.length - 1) + " konu daha)." : ".");
    } else if (gaps.length) {
      summary =
        gaps.length + " konuda havuz dar: öğrenci paketi ikinci kez çözerken soru tekrar edebilir.";
    }
    return { ...base, state, summary };
  });
}

/** Sınav → Seviye 1 soru sayısı (= sorulacak kazanım sayısı), SQL VALUES satırları. */
function s1Ihtiyaci(): Prisma.Sql {
  const sinavlar: string[] = [...EXAM_SCOPES, LEGACY_EXAM_SCOPE];
  return Prisma.join(sinavlar.map((s) => Prisma.sql`(${s}::text, ${levelSizes(s).seviye1}::int)`));
}

/**
 * Seviye 1'in kazanım kümesi — ÖĞRENCİ UYGULAMASIYLA AYNI küme ve AYNI sıra
 * (app/lib/level-selection.ts sinavinKazanimlari):
 *
 *   s1obj     = yayında + bu sınavda ölçülen kazanımlar; her birinin bu
 *               sınavda sorulabilen yayında L1 soru sayısı (l1)
 *   s1uygun   = l1 >= S1_KAZANIM_EN_AZ_SORU olanlar, sıra numarasıyla
 *               (konu sırası → konu slug'ı → kazanım sırası → kod)
 *   s1sorulan = s1uygun'un ilk N'i (N = sınavın Seviye 1 soru sayısı):
 *               öğrenciye GERÇEKTEN sorulacak kazanımlar
 *
 * Eskiden sayaç bütün kazanımları sayıyordu, öğrenciye ise ilk N soruluyordu:
 * sayaç "hazır" derken sorulan kazanımların yedeği yoktu, ya da sorusuz
 * kazanım sıradaki yeri doldurup aşamayı eksik açıyordu. Sıra değişirse
 * (hocaya soruldu) app'teki orderBy ile buradaki ROW_NUMBER birlikte değişir.
 *
 * `kaynak`: (pid, ex) satırları veren alt sorgu — paket başına ya da tek sınav.
 */
function s1KazanimCteleri(kaynak: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    kaynak AS (${kaynak}),
    ihtiyac(ex, n) AS (VALUES ${s1Ihtiyaci()}),
    s1obj AS (
      SELECT k.pid, o.id AS oid,
             (SELECT count(*) FROM "Question" q
                JOIN "Topic" tq ON tq.id = q."topicId"
               WHERE q."objectiveId" = o.id
                 AND q.level = 'L1_TEMEL'
                 AND q.status = 'PUBLISHED'
                 AND ${sqlKendisiYaDaKonusuSinavda("q", "tq", KAYNAK_SINAVI)})::int AS l1,
             t."sortOrder" AS tsira, t.slug AS tslug, o."sortOrder" AS osira, o.code AS kod
      FROM kaynak k
      JOIN "Objective" o ON o.status = 'PUBLISHED'
      JOIN "Topic" t ON t.id = o."topicId"
      WHERE ${sqlKendisiYaDaKonusuSinavda("o", "t", KAYNAK_SINAVI)}
    ),
    s1uygun AS (
      SELECT s.pid, s.oid, s.l1,
             ROW_NUMBER() OVER (PARTITION BY s.pid ORDER BY s.tsira, s.tslug, s.osira, s.kod) AS sira
      FROM s1obj s
      WHERE s.l1 >= ${S1_KAZANIM_EN_AZ_SORU}
    ),
    s1sorulan AS (
      SELECT u.pid, u.oid, u.l1, u.sira
      FROM s1uygun u
      JOIN kaynak k ON k.pid = u.pid
      JOIN ihtiyac i ON i.ex = k.ex::text
      WHERE u.sira <= i.n
    )`;
}

/**
 * Seviyeli paketlerin hazırlık sayımı — öğrenci uygulamasının seçimiyle aynı
 * küme (kural: shared/exam-scope.ts, SQL ikizi: lib/checkup/exam-scope.ts).
 *
 *   S1    = s1KazanimCteleri: sorulabilen kazanımlar (l1Any), sorulacak ilk N
 *           içinde yedek sorusu olanlar (l1Ready) — sinavinKazanimlari +
 *           kazanimBasinaBirSoru
 *   S2/S3 = bu sınavda sorulabilen yayında L2/L3 soruları (seviyeSorulari)
 *
 * Ayrı fonksiyon: karşılaştırma testi aynı sorguyu çalıştırabilsin diye.
 */
export function seviyeliHazirlikSorgusu(): Prisma.Sql {
  return Prisma.sql`
    WITH ${s1KazanimCteleri(Prisma.sql`SELECT id AS pid, "examScope" AS ex FROM "Package" WHERE kind = 'LEVEL'`)},
    lp AS (
      SELECT pid AS id, ex FROM kaynak
    ),
    lv AS (
      SELECT lp.id AS pid, q.level::text AS level, count(*)::int AS n
      FROM lp
      JOIN "Question" q ON q.status = 'PUBLISHED' AND q.level IN ('L2_ORTA', 'L3_ANALIZ')
      JOIN "Topic" tq ON tq.id = q."topicId"
      WHERE ${sqlKendisiYaDaKonusuSinavda("q", "tq", SEVIYELI_SINAV)}
      GROUP BY lp.id, q.level
    )
    SELECT lp.id AS "packageId",
           (SELECT count(*) FROM s1obj WHERE s1obj.pid = lp.id)::int AS "l1Total",
           (SELECT count(*) FROM s1sorulan WHERE s1sorulan.pid = lp.id AND s1sorulan.l1 >= ${MIN_L1_PER_OBJECTIVE})::int AS "l1Ready",
           (SELECT count(*) FROM s1uygun WHERE s1uygun.pid = lp.id)::int AS "l1Any",
           COALESCE((SELECT n FROM lv WHERE lv.pid = lp.id AND lv.level = 'L2_ORTA'), 0)::int AS l2,
           COALESCE((SELECT n FROM lv WHERE lv.pid = lp.id AND lv.level = 'L3_ANALIZ'), 0)::int AS l3
    FROM lp
  `;
}

export interface Seviye1Kumesi {
  /** Sınavın Seviye 1 soru sayısı = sorulacak kazanım sayısı. */
  gerekli: number;
  /** Sorulabilen kazanım (en az S1_KAZANIM_EN_AZ_SORU yayında L1 sorusu). */
  uygun: number;
  /** Öğrenciye gerçekten sorulacak kazanımlar (uygunların sıradaki ilk N'i). */
  sorulacak: Set<string>;
  /** Sorulacaklardan teyit turu için yedek sorusu olan (en az MIN_L1_PER_OBJECTIVE). */
  hazir: number;
  /** Sorulacaklardan tek sorulu olan: teyit turunda yeni soru gelemez. */
  tekSorulu: number;
}

/**
 * Bir sınavın Seviye 1 kümesi — paket sağlığıyla (seviyeliHazirlikSorgusu)
 * aynı CTE'ler. Kazanımlar ekranı sayacı buradan alır; ekrandaki süzgeçler
 * (özet kartı olmayanlar) sayacı değiştirmez.
 */
export async function seviye1Kumesi(sinav: string): Promise<Seviye1Kumesi> {
  const satirlar = await db.$queryRaw<{ oid: string; l1: number; sorulacak: boolean }[]>`
    WITH ${s1KazanimCteleri(Prisma.sql`SELECT 'tek'::text AS pid, ${sinav}::"ExamScope" AS ex`)}
    SELECT u.oid, u.l1, EXISTS (SELECT 1 FROM s1sorulan s WHERE s.oid = u.oid) AS sorulacak
    FROM s1uygun u
  `;
  const sorulacaklar = satirlar.filter((r) => r.sorulacak);
  return {
    gerekli: levelSizes(sinav).seviye1,
    uygun: satirlar.length,
    sorulacak: new Set(sorulacaklar.map((r) => r.oid)),
    hazir: sorulacaklar.filter((r) => Number(r.l1) >= MIN_L1_PER_OBJECTIVE).length,
    tekSorulu: sorulacaklar.filter((r) => Number(r.l1) < MIN_L1_PER_OBJECTIVE).length,
  };
}

// Zorluk bandı hedefleri saf kurallar modülünde (paket düzenleyici istemcide de kullanıyor).
export { bandTargets } from "./package-rules";

/**
 * Paket düzenleyicinin havuzu: her (sınav, yaprak konu) için paketin
 * çekebileceği yayındaki soru ve zorluk bantları. Kural öğrenci uygulamasının
 * paket seçimiyle (question-selection.ts `pick`) aynı: soru `examScopes` doluysa
 * yalnızca listelediği sınavlarda; boşsa konusu o sınavdaysa. Paket sağlığındaki
 * (loadPackageHealth) sayımla birebir aynı koşul.
 */
export async function paketHavuzu(): Promise<Record<string, Record<string, HavuzSayisi>>> {
  const rows = await db.$queryRaw<{ topicId: string; exam: string; have: number; easy: number; medium: number; hard: number }[]>`
    SELECT q."topicId", e.ex::text AS exam,
           count(*)::int                                  AS have,
           count(*) FILTER (WHERE q.difficulty <= 2)::int AS easy,
           count(*) FILTER (WHERE q.difficulty = 3)::int  AS medium,
           count(*) FILTER (WHERE q.difficulty >= 4)::int AS hard
    FROM "Question" q
    JOIN "Topic" t ON t.id = q."topicId"
    CROSS JOIN unnest(enum_range(NULL::"ExamScope")) AS e(ex)
    WHERE q.status = 'PUBLISHED'
      AND ${sqlKendisiYaDaKonusuSinavda("q", "t", Prisma.raw("e.ex"))}
    GROUP BY q."topicId", e.ex
  `;
  const out: Record<string, Record<string, HavuzSayisi>> = {};
  for (const r of rows) {
    (out[r.exam] ??= {})[r.topicId] = {
      have: Number(r.have),
      easy: Number(r.easy),
      medium: Number(r.medium),
      hard: Number(r.hard),
    };
  }
  return out;
}

/** Paket düzenleyicinin konu seçenekleri: yaprak konular, üst konu adıyla. */
export async function paketKonulari(): Promise<
  { id: string; name: string; parentName: string | null; examScope: string; examScopes: string[] }[]
> {
  const topics = await db.topic.findMany({
    where: { children: { none: {} } },
    orderBy: [{ examScope: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, examScope: true, examScopes: true, parent: { select: { name: true } } },
  });
  return topics.map((t) => ({
    id: t.id,
    name: t.name,
    parentName: t.parent?.name ?? null,
    examScope: t.examScope,
    examScopes: t.examScopes as string[],
  }));
}

export const PACKAGE_STATE_LABEL: Record<PackageState, string> = {
  ready: "Hazır",
  narrow: "Havuz dar",
  blocked: "Başlatılamaz",
};
