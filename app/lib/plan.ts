import { prisma } from "@/lib/db";
import {
  haftaBasi,
  haftalikKonuSiniri,
  haftalikPlan,
  kocNotu,
  oncelikSirasi,
  MAX_TOPICS_PER_WEEK,
  type OncelikliKonu,
} from "@/lib/coaching";
import { konuSinavdaMi } from "@/lib/exam-scope";
import { egilimeGirer } from "@/lib/insights";
import { sinavinUrunleri } from "@/lib/products";
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
  /** Planın kurulduğu sınav; kontrol testi bu sınavla açılır (öğrencinin güncel hedefiyle değil). */
  examScope: string;
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
    /**
     * Kontrol testi açılabilir mi: konu planın sınavında ve o sınavın tekrar
     * paketi yayında. Açılamayan iş kartta silinebilir; yoksa öğrencinin
     * önünde ne çözülebilen ne kaldırılabilen bir iş kalıyordu. RETEST
     * dışındaki işlerde her zaman true.
     */
    acilabilir: boolean;
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
      examScope: true,
      coachNote: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          kind: true,
          title: true,
          topicId: true,
          topic: { select: { name: true, examScope: true, examScopes: true } },
          estimatedMinutes: true,
          doneAt: true,
          verifiedBySessionId: true,
          productId: true,
        },
      },
    },
  });
  if (!plan) return null;

  // Tekrar paketi yalnızca planda kontrol testi varsa sorulur.
  const tekrarPaketiVar = plan.items.some((i) => i.kind === "RETEST")
    ? (await prisma.package.count({
        where: { kind: "RETEST", examScope: plan.examScope, status: "PUBLISHED" },
      })) > 0
    : false;

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
    // startTopicRetest'in iki sınav denetimiyle aynı: paket var mı, konu sınavda mı.
    acilabilir:
      i.kind !== "RETEST" ||
      (tekrarPaketiVar && i.topic !== null && konuSinavdaMi(i.topic, plan.examScope)),
  }));

  return {
    id: plan.id,
    weekStart: plan.weekStart,
    examScope: plan.examScope,
    coachNote: plan.coachNote,
    items,
    toplamDakika: items.reduce((t, i) => t + i.estimatedMinutes, 0),
    biten: items.filter((i) => i.done).length,
  };
}

/** Geçen haftanın tamamlama oranı — planı küçültmek için. */
export async function gecenHaftaOrani(userId: string, buHafta: Date): Promise<number | null> {
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

  const [konular, oran] = await Promise.all([
    // Konu ağırlıkları ve ürün önerileri — öncelik sırası ve plan için.
    prisma.topic.findMany({
      where: { id: { in: breakdown.topics.map((t) => t.topicId) } },
      select: { id: true, examWeights: true, recommendedProductIds: true },
    }),
    // Geçen haftanın oranı ÖNCE: planın kaç konuyla kurulacağı buna bağlı.
    gecenHaftaOrani(userId, hafta),
  ]);

  const agirliklar = new Map<string, number>();
  const urunler = new Map<string, string[]>();
  for (const k of konular) {
    const w = (k.examWeights ?? {}) as Record<string, number>;
    if (typeof w[examScope] === "number") agirliklar.set(k.id, w[examScope]);
    // Yalnızca planın sınavına uygun ürünler (ALES adayına TYT kitabı yok).
    urunler.set(k.id, sinavinUrunleri(k.recommendedProductIds, examScope).map((u) => u.id));
  }

  const enFazla = haftalikKonuSiniri(oran);
  const oncelikler: OncelikliKonu[] = oncelikSirasi(breakdown.topics, agirliklar, enFazla);
  const isler = haftalikPlan(oncelikler, urunler);
  if (isler.length === 0) return { olusturuldu: false, planId: null };

  // "Bu hafta tek konu" yalnızca sınır gerçekten bir konuyu dışarıda bıraktıysa.
  const kisaltildi =
    enFazla < MAX_TOPICS_PER_WEEK &&
    oncelikSirasi(breakdown.topics, agirliklar, MAX_TOPICS_PER_WEEK).length > oncelikler.length;

  const plan = await prisma.studyPlan.create({
    data: {
      userId,
      examScope: examScope as never,
      weekStart: hafta,
      sourceSessionId: sessionId,
      coachNote: kocNotu(oncelikler, kisaltildi),
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

/** Geçen haftanın bitmemiş bir işi — pazartesi postası (lib/digest.ts). */
export interface KalanIs {
  kind: "STUDY" | "SOLVE" | "REVIEW" | "RETEST";
  topicName: string | null;
  estimatedMinutes: number;
}

/**
 * Geçen haftanın planında bitmeyen işler (plan sırasıyla en fazla `enFazla`
 * tanesi) ve toplam sayıları.
 *
 * Plan bir sonraki haftaya DEVRETMİYOR (ürün kararı bekliyor). Pazartesi
 * sabahı bu haftanın planı henüz yokken posta en azından yarım kalanı
 * hatırlatsın diye.
 */
export async function gecenHaftaninKalanlari(
  userId: string,
  now: Date,
  enFazla = 3
): Promise<{ toplam: number; isler: KalanIs[] }> {
  const oncekiBasi = new Date(haftaBasi(now).getTime() - 7 * 86_400_000);
  const plan = await prisma.studyPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart: oncekiBasi } },
    select: {
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          kind: true,
          doneAt: true,
          verifiedBySessionId: true,
          estimatedMinutes: true,
          topic: { select: { name: true } },
        },
      },
    },
  });
  const kalan = (plan?.items ?? []).filter((i) =>
    i.kind === "RETEST" ? i.verifiedBySessionId === null : i.doneAt === null
  );
  return {
    toplam: kalan.length,
    isler: kalan.slice(0, enFazla).map((i) => ({
      kind: i.kind,
      topicName: i.topic?.name ?? null,
      estimatedMinutes: i.estimatedMinutes,
    })),
  };
}

/**
 * Kontrol testi hangi sınavla açılır?
 *
 * Konu bu haftanın planında bir kontrol testi işiyse PLANIN sınavı; değilse
 * (sonuç ekranındaki "5 soruluk test" düğmesi) öğrencinin güncel hedefi.
 * Eskiden hep güncel hedef kullanılıyordu: hafta ortasında hedefini TYT'den
 * ALES'e çeviren öğrencinin TYT planındaki kontrol testi "bu konu ALES'te
 * yok" diye açılmıyordu ve iş silinemiyordu.
 */
export async function kontrolTestiSinavi(
  userId: string,
  topicId: string,
  now: Date,
  hedef: string | null
): Promise<string | null> {
  const planIsi = await prisma.planItem.findFirst({
    where: { topicId, kind: "RETEST", plan: { userId, weekStart: haftaBasi(now) } },
    select: { plan: { select: { examScope: true } } },
  });
  return planIsi?.plan.examScope ?? hedef;
}

/**
 * "Planı oluştur"un kaynağı: eğilime giren son ölçüm (lib/insights.ts
 * egilimeGirer) — paket testi, işaretli, hedef sınavdan. Sınavı yazmayan
 * eski kayıtta sınav paketten okunur.
 *
 * Eskiden en son HER sonuç alınıyordu: 5 soruluk kontrol testinden, boş
 * gönderilmiş testten (her konu "zayıf") ya da öğrencinin bıraktığı
 * sınavdan plan kuruluyordu.
 */
export async function planKaynagi(
  userId: string,
  hedef: string | null
): Promise<{ sessionId: string; examScope: string; breakdown: TopicBreakdown } | null> {
  // Sorgu adayları daraltır; kararı egilimeGirer verir (tek tanım).
  const adaylar = await prisma.checkupSession.findMany({
    where: {
      userId,
      status: "SUBMITTED",
      kind: "PACKAGE",
      result: {
        is: {
          OR: [{ correctCount: { gt: 0 } }, { wrongCount: { gt: 0 } }],
          ...(hedef
            ? {
                AND: [
                  {
                    OR: [
                      { examScope: hedef as never },
                      { examScope: null, session: { package: { examScope: hedef as never } } },
                    ],
                  },
                ],
              }
            : {}),
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 5,
    select: {
      id: true,
      kind: true,
      package: { select: { examScope: true } },
      result: { select: { topicBreakdown: true, correctCount: true, wrongCount: true, examScope: true } },
    },
  });
  for (const s of adaylar) {
    const r = s.result;
    if (!r) continue;
    // Sınavı yazmayan eski kayıtta sınav paketten: plan o sınavla kurulacağı
    // için süzgeç de ona baksın (yoksa eski bir TYT sonucundan ALES adayına
    // TYT planı kurulurdu).
    const sinav = r.examScope ?? s.package.examScope;
    if (!egilimeGirer({ kind: s.kind, correctCount: r.correctCount, wrongCount: r.wrongCount, examScope: sinav }, hedef)) {
      continue;
    }
    return { sessionId: s.id, examScope: sinav, breakdown: r.topicBreakdown as unknown as TopicBreakdown };
  }
  return null;
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
