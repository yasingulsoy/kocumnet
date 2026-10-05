import "server-only";
import { Prisma } from "./generated/client";
import { db } from "./db";
import type { ExamScope } from "./format";
import {
  bulgular,
  dogruOrani,
  medyan,
  oncelik,
  pearson,
  type Bulgu,
  type ItemStats,
} from "./item-flags";

/**
 * Madde analizi — gerçek cevaplardan. Hesap kuralları ve eşikler
 * item-flags.ts'te (saf modül).
 *
 * Hangi cevaplar sayılır:
 * - Yalnızca TAMAMLANMIŞ testler (SUBMITTED). Süresi dolan testler de cron
 *   tarafından puanlanıp SUBMITTED olur; yarım kalan test sayılmaz.
 * - Yalnızca sorunun ŞU ANKİ sürümü (SessionItem.questionVersion). Cevap
 *   anahtarı değişince sürüm artar ve eski cevapların doğru/yanlış bilgisi
 *   eski anahtara göredir — karıştırılırsa düzeltilen soru "hâlâ hatalı"
 *   görünür.
 * - Hiç dokunulmamış ya da işareti kaldırılmış soru boş sayılır.
 *
 * Süzgeçler (liste ekranı, CSV): sınav = cevabın geldiği testin paketinin
 * sınavı (aynı soru TYT ve KPSS testlerinde farklı davranabilir); dönem =
 * testin bitiş tarihi. Süzgeç oturumları seçer; "kalan puan" da yalnızca o
 * oturumlardan hesaplanır, tutarlı kalır.
 */

export interface AnalizKapsami {
  sinav?: ExamScope | "";
  /** Son kaç günde biten testler. null/undefined = hepsi. */
  gun?: number | null;
}

export interface ItemRow extends ItemStats {
  questionId: string;
  version: number;
  stemText: string;
  status: string;
  level: string | null;
  topicName: string;
  topicSlug: string;
  examScope: string;
  /** Doğru oranı (n > 0 olduğundan dolu). */
  p: number;
  bulgular: Bulgu[];
  oncelik: number;
}

interface RawItem {
  questionId: string;
  version: number;
  stemText: string;
  status: string;
  difficulty: number;
  targetTimeSeconds: number;
  level: string | null;
  topicName: string;
  topicSlug: string;
  examScope: string;
  n: number;
  correct: number;
  blank: number;
  medianMs: number | null;
  r: number | null;
  choices: unknown;
}

type RawChoice = { label: string; isCorrect: boolean; count: number };

function choicesOf(value: unknown): RawChoice[] {
  // Sürücüye göre json sütunu çözülmüş nesne ya da metin gelebilir.
  const v = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  if (!Array.isArray(v)) return [];
  return v.map((c) => ({
    label: String((c as RawChoice).label),
    isCorrect: Boolean((c as RawChoice).isCorrect),
    count: Number((c as RawChoice).count) || 0,
  }));
}

const sayi = (x: unknown): number | null => (x === null || x === undefined ? null : Number(x));

/**
 * Cevabı olan bütün sorular, tek sorguda. Oturum başına toplamlar pencere
 * fonksiyonu yerine CTE ile: "kalan puan" = aynı testteki diğer soruların
 * doğru oranı.
 */
export async function loadItemAnalysis(kapsam: AnalizKapsami = {}): Promise<ItemRow[]> {
  const sinavSuzgeci = kapsam.sinav
    ? Prisma.sql`JOIN "Package" pk ON pk.id = s."packageId" AND pk."examScope" = ${kapsam.sinav}::"ExamScope"`
    : Prisma.empty;
  const donemSuzgeci = kapsam.gun
    ? Prisma.sql`WHERE s."submittedAt" >= ${new Date(Date.now() - kapsam.gun * 86_400_000)}`
    : Prisma.empty;

  const rows = await db.$queryRaw<RawItem[]>`
    WITH items AS (
      SELECT si."sessionId" AS sid, si."questionId" AS qid, si."questionVersion" AS qv,
             a."choiceId" AS cid, a."timeSpentMs" AS ms, COALESCE(a."isCorrect", false) AS ok
      FROM "SessionItem" si
      JOIN "CheckupSession" s ON s.id = si."sessionId" AND s.status = 'SUBMITTED'
      ${sinavSuzgeci}
      LEFT JOIN "Answer" a ON a."sessionItemId" = si.id
      ${donemSuzgeci}
    ),
    totals AS (
      SELECT sid, count(*)::int AS n, count(*) FILTER (WHERE ok)::int AS c
      FROM items
      GROUP BY sid
    ),
    resp AS (
      SELECT i.qid, i.cid, i.ms, i.ok,
             CASE WHEN t.n > 1 THEN (t.c - i.ok::int)::float8 / (t.n - 1) END AS rest
      FROM items i
      JOIN totals t ON t.sid = i.sid
      JOIN "Question" q ON q.id = i.qid AND q.version = i.qv
    ),
    agg AS (
      SELECT qid,
             count(*)::int                                    AS n,
             count(*) FILTER (WHERE ok)::int                  AS correct,
             count(*) FILTER (WHERE cid IS NULL)::int         AS blank,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY ms) FILTER (WHERE cid IS NOT NULL) AS median_ms,
             corr(ok::int::float8, rest)                      AS r
      FROM resp
      GROUP BY qid
    ),
    cc AS (
      SELECT cid, count(*)::int AS k FROM resp WHERE cid IS NOT NULL GROUP BY cid
    )
    SELECT q.id AS "questionId", q.version, q."stemText", q.status::text AS status, q.difficulty,
           q."targetTimeSeconds", q.level::text AS level,
           t.name AS "topicName", t.slug AS "topicSlug", t."examScope"::text AS "examScope",
           agg.n, agg.correct, agg.blank, agg.median_ms AS "medianMs", agg.r,
           (SELECT json_agg(json_build_object('label', c.label, 'isCorrect', c."isCorrect", 'count', COALESCE(cc.k, 0))
                            ORDER BY c."sortOrder")
              FROM "Choice" c LEFT JOIN cc ON cc.cid = c.id
             WHERE c."questionId" = q.id) AS choices
    FROM agg
    JOIN "Question" q ON q.id = agg.qid
    JOIN "Topic" t ON t.id = q."topicId"
  `;

  return rows.map((r) => {
    const stats: ItemStats = {
      n: Number(r.n),
      correct: Number(r.correct),
      blank: Number(r.blank),
      medianMs: sayi(r.medianMs),
      r: sayi(r.r),
      choices: choicesOf(r.choices),
      difficulty: Number(r.difficulty),
      targetTimeSeconds: Number(r.targetTimeSeconds),
    };
    const b = bulgular(stats);
    return {
      ...stats,
      questionId: r.questionId,
      version: Number(r.version),
      stemText: r.stemText,
      status: r.status,
      level: r.level,
      topicName: r.topicName,
      topicSlug: r.topicSlug,
      examScope: r.examScope,
      p: dogruOrani(stats) ?? 0,
      bulgular: b,
      oncelik: oncelik(b),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Tek soru: üst/alt grup kırılımı
// ─────────────────────────────────────────────────────────────

export interface ChoiceAnalysis {
  id: string;
  label: string;
  isCorrect: boolean;
  errorType: string | null;
  count: number;
  /** Üst/alt grupta bu şıkkı seçenlerin oranı (grup yoksa null). */
  upper: number | null;
  lower: number | null;
}

export interface QuestionAnalysis {
  stats: ItemStats;
  p: number | null;
  bulgular: Bulgu[];
  /** Testin geri kalanında en başarılı / en başarısız %27. Az veride null. */
  groups: { size: number; upperP: number; lowerP: number; upperBlank: number; lowerBlank: number } | null;
  choices: ChoiceAnalysis[];
  /** Önceki sürümlerden gelen (hesaba katılmayan) cevap sayısı. */
  olderVersionN: number;
}

interface RawResponse {
  sid: string;
  choiceId: string | null;
  ok: boolean;
  ms: number | null;
  rest: number | null;
}

/** Üst/alt grup kırılımı için en az bu kadar cevap (her grupta ~3 kişi). */
const MIN_GRUP = 10;

export async function loadQuestionAnalysis(q: {
  id: string;
  version: number;
  difficulty: number;
  targetTimeSeconds: number;
  choices: { id: string; label: string; isCorrect: boolean; errorType: string | null }[];
}): Promise<QuestionAnalysis> {
  const [rows, olderVersionN] = await Promise.all([
    db.$queryRaw<RawResponse[]>`
      WITH sess AS (
        SELECT si."sessionId" AS sid
        FROM "SessionItem" si
        JOIN "CheckupSession" s ON s.id = si."sessionId" AND s.status = 'SUBMITTED'
        WHERE si."questionId" = ${q.id} AND si."questionVersion" = ${q.version}
      ),
      totals AS (
        SELECT si."sessionId" AS sid, count(*)::int AS n, count(*) FILTER (WHERE a."isCorrect")::int AS c
        FROM "SessionItem" si
        JOIN sess ON sess.sid = si."sessionId"
        LEFT JOIN "Answer" a ON a."sessionItemId" = si.id
        GROUP BY si."sessionId"
      )
      SELECT si."sessionId" AS sid, a."choiceId" AS "choiceId", COALESCE(a."isCorrect", false) AS ok,
             a."timeSpentMs" AS ms,
             CASE WHEN t.n > 1
                  THEN (t.c - COALESCE(a."isCorrect", false)::int)::float8 / (t.n - 1) END AS rest
      FROM "SessionItem" si
      JOIN totals t ON t.sid = si."sessionId"
      LEFT JOIN "Answer" a ON a."sessionItemId" = si.id
      WHERE si."questionId" = ${q.id} AND si."questionVersion" = ${q.version}
    `,
    db.sessionItem.count({
      where: { questionId: q.id, questionVersion: { not: q.version }, session: { status: "SUBMITTED" } },
    }),
  ]);

  const sayac = new Map<string, number>();
  for (const r of rows) {
    if (r.choiceId) sayac.set(r.choiceId, (sayac.get(r.choiceId) ?? 0) + 1);
  }

  const puanli = rows.filter((r) => r.rest !== null).map((r) => ({ ...r, rest: Number(r.rest) }));
  const stats: ItemStats = {
    n: rows.length,
    correct: rows.filter((r) => r.ok).length,
    blank: rows.filter((r) => !r.choiceId).length,
    medianMs: medyan(rows.filter((r) => r.choiceId && r.ms !== null).map((r) => Number(r.ms))),
    r: pearson(
      puanli.map((r) => (r.ok ? 1 : 0)),
      puanli.map((r) => r.rest)
    ),
    choices: q.choices.map((c) => ({ label: c.label, isCorrect: c.isCorrect, count: sayac.get(c.id) ?? 0 })),
    difficulty: q.difficulty,
    targetTimeSeconds: q.targetTimeSeconds,
  };

  // Üst/alt %27 (Kelley): kalan puana göre sıralanır; eşitlikte oturum
  // kimliği — doğru/yanlışla ilişkisiz, sınırdaki eşitlikleri yanlı bölmesin.
  let groups: QuestionAnalysis["groups"] = null;
  let ust: typeof puanli = [];
  let alt: typeof puanli = [];
  if (puanli.length >= MIN_GRUP) {
    const sirali = [...puanli].sort((a, b) => a.rest - b.rest || (a.sid < b.sid ? -1 : a.sid > b.sid ? 1 : 0));
    const g = Math.max(1, Math.round(sirali.length * 0.27));
    alt = sirali.slice(0, g);
    ust = sirali.slice(-g);
    const oran = (liste: typeof puanli, f: (r: (typeof puanli)[number]) => boolean) =>
      liste.filter(f).length / liste.length;
    groups = {
      size: g,
      upperP: oran(ust, (r) => r.ok),
      lowerP: oran(alt, (r) => r.ok),
      upperBlank: oran(ust, (r) => !r.choiceId),
      lowerBlank: oran(alt, (r) => !r.choiceId),
    };
  }

  const choices: ChoiceAnalysis[] = q.choices.map((c) => ({
    id: c.id,
    label: c.label,
    isCorrect: c.isCorrect,
    errorType: c.errorType,
    count: sayac.get(c.id) ?? 0,
    upper: groups ? ust.filter((r) => r.choiceId === c.id).length / ust.length : null,
    lower: groups ? alt.filter((r) => r.choiceId === c.id).length / alt.length : null,
  }));

  return {
    stats,
    p: dogruOrani(stats),
    bulgular: bulgular(stats),
    groups,
    choices,
    olderVersionN,
  };
}

