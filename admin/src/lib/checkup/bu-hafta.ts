import "server-only";
import { Prisma } from "./generated/client";
import { db } from "./db";
import { acikOdevOzeti, buHaftaSirala, gecenOdevOzeti, type BuHaftaSatiri } from "./bu-hafta-kurallari";
import { riskSatirlari } from "./risk-data";
import { haftaBasi, haftaBasiAni } from "./shared/coaching";

/**
 * "Bu hafta" ekranının verisi (sunucu). Satır öğrenci; kurallar ve sıra
 * bu-hafta-kurallari.ts'te. Öğrenci kişisel verisi: yalnızca yönetim rolleri.
 *
 * Sorgu sayısı öğrenci sayısından bağımsız: risk özeti (tek ham SQL + ödevler),
 * haftanın cevap sayısı (tek ham SQL), bu haftanın planları ve bekleyen koça
 * sorular (birer sorgu). 30-100 öğrencilik pilot için hepsi tek seferde.
 */

export interface BuHaftaVerisi {
  satirlar: BuHaftaSatiri[];
  /** Haftanın başı (StudyPlan.weekStart biçiminde tarih; etiket için). */
  hafta: Date;
}

export async function buHaftaVerisi(now: Date, grupId: string | null): Promise<BuHaftaVerisi> {
  const hafta = haftaBasi(now);
  const risk = await riskSatirlari(now, grupId ? { grupId } : {});
  const idler = risk.map((r) => r.id);
  if (idler.length === 0) return { satirlar: [], hafta };

  const kapsam = grupId
    ? Prisma.sql`AND s."userId" IN (SELECT gm."userId" FROM "GroupMember" gm WHERE gm."groupId" = ${grupId})`
    : Prisma.empty;

  const [cevaplar, planlar, sorular] = await Promise.all([
    /*
     * Bu hafta çözülen soru: HER TÜR oturumda (test, kontrol testi, seviyeli
     * aşama, alıştırma) şık işaretlenen cevap. "Bilmiyorum" (alıştırmada
     * choiceId boş) ve testte boş kalan satır sayılmaz: koçun sorusu "kaç
     * soru çözdü". Öğrencinin seri sayacı (app/lib/seri.ts) "Bilmiyorum"u
     * emek diye sayıyor; o bilerek farklı. Cevabın anı ilk işaretleme
     * (firstAnsweredAt; eski satırlarda answeredAt), seri sayacıyla aynı.
     * Hafta pazartesi 00:00 Türkiye (shared/coaching.ts haftaBasiAni).
     */
    db.$queryRaw<{ userId: string; adet: number }[]>`
      SELECT s."userId", count(*)::int AS adet
      FROM "Answer" a
      JOIN "SessionItem" si ON si.id = a."sessionItemId"
      JOIN "CheckupSession" s ON s.id = si."sessionId"
      WHERE a."choiceId" IS NOT NULL
        -- Saklanan damgalar saat dilimsiz UTC: sınır metin olarak gidip UTC'ye
        -- çevriliyor, bağlantının saat dilimi ne olursa olsun kaymasın (seri.ts ile aynı).
        AND COALESCE(a."firstAnsweredAt", a."answeredAt") >= (${haftaBasiAni(now).toISOString()}::timestamptz AT TIME ZONE 'UTC')
        ${kapsam}
      GROUP BY s."userId"
    `,
    db.studyPlan.findMany({
      where: { weekStart: hafta, userId: { in: idler } },
      select: { userId: true, items: { select: { kind: true, doneAt: true, verifiedBySessionId: true } } },
    }),
    db.coachQuestion.groupBy({
      by: ["userId"],
      where: { userId: { in: idler }, answeredAt: null, closedAt: null },
      _count: { _all: true },
    }),
  ]);

  const soru = new Map(cevaplar.map((c) => [c.userId, Number(c.adet)]));
  const bekleyen = new Map(sorular.map((s) => [s.userId, s._count._all]));
  // Öğrenci uygulamasındaki tanım (app/lib/plan.ts): kontrol testi işi yalnızca sistem doğruladıysa biter.
  const plan = new Map(
    planlar.map((p) => [
      p.userId,
      {
        toplam: p.items.length,
        biten: p.items.filter((i) => (i.kind === "RETEST" ? i.verifiedBySessionId !== null : i.doneAt !== null)).length,
      },
    ])
  );

  const satirlar: BuHaftaSatiri[] = risk.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    sonEtkinlik: r.sonEtkinlik,
    haftaSoru: soru.get(r.id) ?? 0,
    gecenOdev: gecenOdevOzeti(r.odevler, now),
    acikOdev: acikOdevOzeti(r.odevler, now),
    plan: plan.get(r.id) ?? null,
    bulgular: r.bulgular,
    puan: r.puan,
    bekleyenSoru: bekleyen.get(r.id) ?? 0,
  }));
  return { satirlar: buHaftaSirala(satirlar), hafta };
}
