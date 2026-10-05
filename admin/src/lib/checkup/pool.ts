import "server-only";
import { Prisma } from "./generated/client";
import { db } from "./db";
import { sqlKendisiYaDaKonusuSinavda, sqlKonuSinavda } from "./exam-scope";
import { MIN_L1_PER_OBJECTIVE, levelSizes } from "./levels";

/** Ham sorgulardaki sınav ifadeleri (sütun; kullanıcı girdisi değil). */
const PAKET_SINAVI = Prisma.raw('p."examScope"');
const SEVIYELI_SINAV = Prisma.raw("lp.ex");

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
 * sınavlarda sorulur. Eskiden panel bunu saymıyordu — "yalnızca AYT"
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
// Paketler
// ─────────────────────────────────────────────────────────────

export type PackageKind = "STANDARD" | "INTRO" | "RETEST" | "LEVEL";
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
  /** Yayında ve bu sınavda ölçülen kazanım — seviye 1 bunlardan ilk l1Need tanesini sorar. */
  l1Total: number;
  /** Yayında, bu sınavda ölçülen ve en az 2 yayında L1 sorusu olan kazanım. */
  l1Ready: number;
  /** En az 1 L1 sorusu olan kazanım — sıfırsa seviye 1 hiç başlamaz. */
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
 * o liste, boşsa konusunun sınavları. Paket dağılımında konu zaten paketin
 * konusu olduğundan orada yalnızca sorunun kendi listesine bakılır (`pick`).
 */
export async function loadPackageHealth(): Promise<PackageHealth[]> {
  const [packages, blueprint, retest, level] = await Promise.all([
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
       AND (cardinality(q."examScopes") = 0 OR p."examScope" = ANY(q."examScopes"))
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
                 AND (cardinality(q."examScopes") = 0 OR p."examScope" = ANY(q."examScopes"))
             ) >= p."questionCount")::int AS ready
      FROM "Package" p
      JOIN "Topic" t ON ${sqlKonuSinavda("t", PAKET_SINAVI)}
      WHERE p.kind = 'RETEST'
        AND NOT EXISTS (SELECT 1 FROM "Topic" c WHERE c."parentId" = t.id)
      GROUP BY p.id
    `,
    db.$queryRaw<RawLevel[]>(seviyeliHazirlikSorgusu()),
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
    };

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
      // Seviye 1'de hiç sorulu kazanım ya da üst seviyelerde hiç soru yoksa
      // öğrenci bir kapıda "havuzda soru yok" hatasıyla durur.
      const engel = s.l1Any === 0 || s.l2 === 0 || s.l3 === 0;
      const dar = s.l1Ready < s.l1Need || s.l2 < s.l2Need || s.l3 < s.l3Need;
      return {
        ...base,
        gaps: [],
        blocking: [],
        level: s,
        state: engel ? "blocked" : dar ? "narrow" : "ready",
        summary:
          "Seviye 1: " + s.l1Ready + "/" + s.l1Need + " kazanım hazır · " +
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

/**
 * Seviyeli paketlerin hazırlık sayımı — öğrenci uygulamasının seçimiyle aynı
 * küme (kural: shared/exam-scope.ts, SQL ikizi: lib/checkup/exam-scope.ts).
 *
 *   S1    = yayında + bu sınavda ölçülen kazanımlar; her biri için bu sınavda
 *           sorulabilen yayında L1 soruları (sinavinKazanimlari + kazanimBasinaBirSoru)
 *   S2/S3 = bu sınavda sorulabilen yayında L2/L3 soruları (seviyeSorulari)
 *
 * Ayrı fonksiyon: karşılaştırma testi aynı sorguyu çalıştırabilsin diye.
 */
export function seviyeliHazirlikSorgusu(): Prisma.Sql {
  return Prisma.sql`
    WITH lp AS (
      SELECT id, "examScope" AS ex FROM "Package" WHERE kind = 'LEVEL'
    ),
    obj AS (
      SELECT lp.id AS pid,
             (SELECT count(*) FROM "Question" q
                JOIN "Topic" tq ON tq.id = q."topicId"
               WHERE q."objectiveId" = o.id
                 AND q.level = 'L1_TEMEL'
                 AND q.status = 'PUBLISHED'
                 AND ${sqlKendisiYaDaKonusuSinavda("q", "tq", SEVIYELI_SINAV)}) AS l1
      FROM lp
      JOIN "Objective" o ON o.status = 'PUBLISHED'
      JOIN "Topic" t ON t.id = o."topicId"
      WHERE ${sqlKendisiYaDaKonusuSinavda("o", "t", SEVIYELI_SINAV)}
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
           (SELECT count(*) FROM obj WHERE obj.pid = lp.id)::int AS "l1Total",
           (SELECT count(*) FROM obj WHERE obj.pid = lp.id AND obj.l1 >= ${MIN_L1_PER_OBJECTIVE})::int AS "l1Ready",
           (SELECT count(*) FROM obj WHERE obj.pid = lp.id AND obj.l1 >= 1)::int AS "l1Any",
           COALESCE((SELECT n FROM lv WHERE lv.pid = lp.id AND lv.level = 'L2_ORTA'), 0)::int AS l2,
           COALESCE((SELECT n FROM lv WHERE lv.pid = lp.id AND lv.level = 'L3_ANALIZ'), 0)::int AS l3
    FROM lp
  `;
}

/**
 * Seçimin bir konudan istediği zorluk dağılımı: kolay %30 · orta %50 · zor %20
 * (app/lib/question-selection.ts bandTargets ile aynı yuvarlama). Bant
 * yetmezse seçim gevşer ve testin zorluğu kayar — engel değil, uyarı.
 */
export function bandTargets(total: number): { easy: number; medium: number; hard: number } {
  const easy = Math.round(total * 0.3);
  const hard = Math.round(total * 0.2);
  return { easy, medium: Math.max(0, total - easy - hard), hard };
}

export const PACKAGE_STATE_LABEL: Record<PackageState, string> = {
  ready: "Hazır",
  narrow: "Havuz dar",
  blocked: "Başlatılamaz",
};
