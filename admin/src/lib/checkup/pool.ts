import "server-only";
import { db } from "./db";

/**
 * Soru havuzunun sağlığı. Tek bir soruya cevap verir: **hangi paket gerçekten
 * başlatılabiliyor?**
 *
 * Toplam soru sayısı yanıltıcı: 400 soruluk havuzla bile bir paketin istediği
 * konuda 2 soru varsa o paket başlamaz (öğrenci uygulamasındaki startCheckup
 * eksik testi reddeder). Bu yüzden kırılım paket × konu.
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

export type PackageState = "ready" | "narrow" | "blocked";

export interface PackageHealth {
  id: string;
  slug: string;
  name: string;
  status: string;
  isFree: boolean;
  examScope: string;
  questionCount: number;
  durationMinutes: number;
  topicCount: number;
  /** Havuzu ihtiyacın 2 katından az olan konular. */
  gaps: { name: string; need: number; have: number }[];
  /** Havuzu ihtiyacın bile altında kalan konular — paket BAŞLAMAZ. */
  blocking: { name: string; need: number; have: number }[];
  state: PackageState;
}

export async function loadPackageHealth(pool?: TopicPoolRow[]): Promise<PackageHealth[]> {
  const [topicRows, packages] = await Promise.all([
    pool ? Promise.resolve(pool) : loadTopicPool(),
    db.package.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        isFree: true,
        examScope: true,
        questionCount: true,
        durationMinutes: true,
        topics: {
          orderBy: { sortOrder: "asc" },
          select: { questionCount: true, topic: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const byTopicId = new Map(topicRows.map((r) => [r.topicId, r]));

  return packages.map((p) => {
    const ihtiyac = p.topics.map((pt) => ({
      name: pt.topic.name,
      need: pt.questionCount,
      have: byTopicId.get(pt.topic.id)?.published ?? 0,
    }));
    // Tekrar engeli yüzünden "tam yeterli" havuz aslında yetmez: öğrenci aynı
    // paketi ikinci kez çözemez. İhtiyacın 2 katını sağlıklı sayıyoruz.
    const gaps = ihtiyac.filter((g) => g.have < g.need * 2);
    const blocking = gaps.filter((g) => g.have < g.need);

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      isFree: p.isFree,
      examScope: p.examScope,
      questionCount: p.questionCount,
      durationMinutes: p.durationMinutes,
      topicCount: p.topics.length,
      gaps,
      blocking,
      state: blocking.length ? "blocked" : gaps.length ? "narrow" : "ready",
    };
  });
}

export const PACKAGE_STATE_LABEL: Record<PackageState, string> = {
  ready: "Hazır",
  narrow: "Havuz dar",
  blocked: "Başlatılamaz",
};
