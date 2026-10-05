import "server-only";
import { db } from "./db";
import { haftaBasi } from "./shared/coaching";
import { riskBulgulari, riskPuani, sonEtkinlik, type RiskBulgusu, type RiskOzeti } from "./risk";

/**
 * Riskli öğrenci verisi — tek sorguda bütün öğrencilerin özeti, karar
 * risk.ts'te. Öğrenci kişisel verisi: yalnızca yönetici/müdür ekranları
 * çağırır (KVKK).
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
}

interface Raw {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  targetExam: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  sonTest: Date | null;
  testSayisi: number;
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

/** Yalnızca en az bir bulgusu olan öğrenciler, en ciddisi en üstte. */
export async function loadRiskliOgrenciler(now: Date = new Date()): Promise<{ liste: RiskliOgrenci[]; toplam: number }> {
  // Geçen hafta: öğrenci uygulamasının hafta tanımıyla (pazartesi, Türkiye saati).
  // StudyPlan.weekStart @db.Date — karşılaştırma tarih metniyle, saat dilimi karışmasın.
  const gecenHafta = new Date(haftaBasi(now).getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

  const rows = await db.$queryRaw<Raw[]>`
    WITH testler AS (
      SELECT "userId", max("submittedAt") AS son, count(*)::int AS n
      FROM "CheckupSession"
      WHERE status = 'SUBMITTED'
      GROUP BY "userId"
    ),
    paket AS (
      SELECT cs."userId", r."correctCount" AS c, r."wrongCount" AS w, r."blankCount" AS b,
             row_number() OVER (PARTITION BY cs."userId" ORDER BY cs."submittedAt" DESC, cs.id) AS sira
      FROM "CheckupSession" cs
      JOIN "CheckupResult" r ON r."sessionId" = cs.id
      WHERE cs.status = 'SUBMITTED' AND cs.kind = 'PACKAGE'
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
      WHERE sp."weekStart" = ${gecenHafta}::date
      GROUP BY sp."userId"
    )
    SELECT u.id, u.name, u.email, u.grade::text AS grade, u."targetExam"::text AS "targetExam",
           u."createdAt", u."lastLoginAt",
           t.son AS "sonTest", COALESCE(t.n, 0)::int AS "testSayisi",
           p1.c AS p1c, p1.w AS p1w, p1.b AS p1b,
           p2.c AS p2c, p2.w AS p2w, p2.b AS p2b,
           pl.toplam AS "planToplam", pl.biten AS "planBiten"
    FROM "User" u
    LEFT JOIN testler t ON t."userId" = u.id
    LEFT JOIN paket p1 ON p1."userId" = u.id AND p1.sira = 1
    LEFT JOIN paket p2 ON p2."userId" = u.id AND p2.sira = 2
    LEFT JOIN plan pl ON pl."userId" = u.id
    WHERE u.role = 'STUDENT'
  `;

  const liste: RiskliOgrenci[] = [];
  for (const r of rows) {
    const ozet: RiskOzeti = {
      createdAt: r.createdAt,
      lastLoginAt: r.lastLoginAt,
      sonTest: r.sonTest,
      testSayisi: Number(r.testSayisi),
      sonIkiPaket: [oran(r.p1c, r.p1w, r.p1b), oran(r.p2c, r.p2w, r.p2b)],
      gecenHaftaPlan:
        r.planToplam === null ? null : { toplam: Number(r.planToplam), biten: Number(r.planBiten ?? 0) },
    };
    const bulgular = riskBulgulari(ozet, now);
    if (bulgular.length === 0) continue;
    liste.push({
      ...ozet,
      id: r.id,
      name: r.name,
      email: r.email,
      grade: r.grade,
      targetExam: r.targetExam,
      sonEtkinlik: sonEtkinlik(ozet),
      bulgular,
      puan: riskPuani(bulgular),
    });
  }

  // En ciddi önce; eşitlikte en uzun süredir sessiz olan.
  liste.sort((a, b) => b.puan - a.puan || a.sonEtkinlik.getTime() - b.sonEtkinlik.getTime());
  return { liste, toplam: rows.length };
}
