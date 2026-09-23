import { prisma } from "@/lib/db";
import { haftaBasi, haftalikPlan, kocNotu, oncelikSirasi, type OncelikliKonu } from "@/lib/coaching";
import type { TopicBreakdown } from "@/lib/scoring";

/**
 * Haftalık çalışma planı — koçun asıl işi.
 *
 * Döngü: ölç → ata → DOĞRULA → ayarla. Doğrulama adımı olmayan bir plan
 * yapılacaklar listesidir ve yapılacaklar listeleri terk edilir.
 */

export interface PlanGorunumu {
  id: string;
  weekStart: Date;
  coachNote: string | null;
  items: {
    id: string;
    kind: "STUDY" | "SOLVE" | "REVIEW" | "RETEST";
    title: string;
    topicId: string | null;
    /** Konu adı — kart işleri konuya göre gruplayabilsin diye. */
    topicName: string | null;
    estimatedMinutes: number;
    done: boolean;
    /** RETEST işleri öğrenci tarafından işaretlenemez. */
    verifiable: boolean;
    verifiedBySessionId: string | null;
    productId: string | null;
  }[];
  toplamDakika: number;
  biten: number;
}

/** Bu haftanın planı (varsa). */
export async function aktifPlan(userId: string, now: Date): Promise<PlanGorunumu | null> {
  const plan = await prisma.studyPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart: haftaBasi(now) } },
    select: {
      id: true,
      weekStart: true,
      coachNote: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          kind: true,
          title: true,
          topicId: true,
          topic: { select: { name: true } },
          estimatedMinutes: true,
          doneAt: true,
          verifiedBySessionId: true,
          productId: true,
        },
      },
    },
  });
  if (!plan) return null;

  const items = plan.items.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title,
    topicId: i.topicId,
    topicName: i.topic?.name ?? null,
    estimatedMinutes: i.estimatedMinutes,
    done: i.kind === "RETEST" ? i.verifiedBySessionId !== null : i.doneAt !== null,
    verifiable: i.kind === "RETEST",
    verifiedBySessionId: i.verifiedBySessionId,
    productId: i.productId,
  }));

  return {
    id: plan.id,
    weekStart: plan.weekStart,
    coachNote: plan.coachNote,
    items,
    toplamDakika: items.reduce((t, i) => t + i.estimatedMinutes, 0),
    biten: items.filter((i) => i.done).length,
  };
}

/** Geçen haftanın tamamlama oranı — planı küçültmek için. */
async function gecenHaftaOrani(userId: string, buHafta: Date): Promise<number | null> {
  const oncekiBasi = new Date(buHafta.getTime() - 7 * 86_400_000);
  const plan = await prisma.studyPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart: oncekiBasi } },
    select: { items: { select: { kind: true, doneAt: true, verifiedBySessionId: true } } },
  });
  if (!plan || plan.items.length === 0) return null;
  const biten = plan.items.filter((i) =>
    i.kind === "RETEST" ? i.verifiedBySessionId !== null : i.doneAt !== null
  ).length;
  return biten / plan.items.length;
}

/**
 * Sonuçtan bu haftanın planını üretir.
 *
 * Aynı hafta için plan varsa DOKUNMAZ: öğrencinin üstünü çizdiği işleri
 * yeni bir testten sonra geri getirmek, planı güvenilmez yapar.
 */
export async function planOlustur(params: {
  userId: string;
  sessionId: string;
  examScope: string;
  breakdown: TopicBreakdown;
  now: Date;
}): Promise<{ olusturuldu: boolean; planId: string | null }> {
  const { userId, sessionId, examScope, breakdown, now } = params;
  const hafta = haftaBasi(now);

  const mevcut = await prisma.studyPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart: hafta } },
    select: { id: true },
  });
  if (mevcut) return { olusturuldu: false, planId: mevcut.id };

  // Konu ağırlıkları ve ürün önerileri — öncelik sırası ve plan için.
  const konular = await prisma.topic.findMany({
    where: { id: { in: breakdown.topics.map((t) => t.topicId) } },
    select: { id: true, examWeights: true, recommendedProductIds: true },
  });

  const agirliklar = new Map<string, number>();
  const urunler = new Map<string, string[]>();
  for (const k of konular) {
    const w = (k.examWeights ?? {}) as Record<string, number>;
    if (typeof w[examScope] === "number") agirliklar.set(k.id, w[examScope]);
    urunler.set(k.id, k.recommendedProductIds);
  }

  const oncelikler: OncelikliKonu[] = oncelikSirasi(breakdown.topics, agirliklar);
  const isler = haftalikPlan(oncelikler, urunler);
  if (isler.length === 0) return { olusturuldu: false, planId: null };

  const oran = await gecenHaftaOrani(userId, hafta);

  const plan = await prisma.studyPlan.create({
    data: {
      userId,
      examScope: examScope as never,
      weekStart: hafta,
      sourceSessionId: sessionId,
      coachNote: kocNotu(oncelikler, oran),
      items: {
        create: isler.map((i, sira) => ({
          kind: i.kind,
          title: i.title,
          topicId: i.topicId ?? null,
          estimatedMinutes: i.estimatedMinutes,
          targetQuestionCount: i.targetQuestionCount ?? null,
          productId: i.productId ?? null,
          sortOrder: sira,
        })),
      },
    },
    select: { id: true },
  });

  return { olusturuldu: true, planId: plan.id };
}

/**
 * Konu tekrar testi bitince plandaki RETEST işini kapatır.
 *
 * Öğrenci bu işi elle işaretleyemez — kapanması için gerçekten testi
 * çözmesi gerekir. Planın dürüst kalmasını sağlayan tek mekanizma bu.
 */
export async function retestIsiniKapat(params: {
  userId: string;
  topicId: string;
  sessionId: string;
  now: Date;
}) {
  const { userId, topicId, sessionId, now } = params;
  const plan = await prisma.studyPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart: haftaBasi(now) } },
    select: { id: true },
  });
  if (!plan) return;

  await prisma.planItem.updateMany({
    where: { planId: plan.id, topicId, kind: "RETEST", verifiedBySessionId: null },
    data: { verifiedBySessionId: sessionId, doneAt: now },
  });
}
