import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { aktifPlan } from "@/lib/plan";
import { aggregateTopics, egilimeGirer, konuHaritasinaGirer, studentStats, type ResultLike } from "@/lib/insights";
import { EXAMS, daysUntilExam, isExamScope } from "@/lib/exams";
import type { TopicBreakdown } from "@/lib/scoring";
import { grafikTarihleri } from "@/components/grafik-tarihleri";
import {
  EN_FAZLA_VELI_BAGLANTISI,
  RAPOR_KONU_SAYISI,
  RAPOR_OLCUM_SINIRI,
  RAPOR_TEST_SAYISI,
  VELI_JETONU,
  VELI_KAYIT_SAKLAMA_GUN,
  ilkAd,
  type VeliSuresi,
} from "@/lib/veli";

/**
 * Veli bağlantısı — veritabanı tarafı. Kurallar lib/veli.ts'te.
 *
 * İki kural bu dosyanın varlık sebebi:
 *  1. Jeton saklanmaz, yalnızca SHA-256'sı (oturum ve parola sıfırlamayla aynı).
 *     Bağlantı yalnızca oluşturulduğu an öğrenciye gösterilir.
 *  2. Rapor alan alan SEÇİLİR (VeliRaporu). Veritabanı satırı yayılmaz; soru,
 *     cevap, çözüm, e-posta buraya hiç okunmaz. `npm run test:veli` denetler.
 */

const GUN_MS = 86_400_000;

function jetonOzeti(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/** Öğrenciye gösterilecek hata (sınır, bulunamadı). Adına bakın: tsx'te instanceof tutmayabilir. */
export class VeliHatasi extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VeliHatasi";
  }
}

// ─────────────────────────────────────────────────────────────
// Bağlantılar (öğrenci)
// ─────────────────────────────────────────────────────────────

export interface VeliBaglantisiSatiri {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  lastViewedAt: Date | null;
  viewCount: number;
}

const etkinKosulu = (userId: string, now: Date) => ({ userId, revokedAt: null, expiresAt: { gt: now } });

/** Profildeki liste: kaldırılmamış ve süresi dolmamış bağlantılar, yeniden eskiye. */
export async function etkinVeliBaglantilari(userId: string, now = new Date()): Promise<VeliBaglantisiSatiri[]> {
  return prisma.parentLink.findMany({
    where: etkinKosulu(userId, now),
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true, lastViewedAt: true, viewCount: true },
  });
}

/**
 * Yeni bağlantı. Jeton YALNIZCA burada, dönüş değerinde var; çağıran onu bir
 * kez gösterir ve unutur. En fazla EN_FAZLA_VELI_BAGLANTISI etkin bağlantı:
 * sayım ve yazım aynı işlemde, öğrencinin satırı kilitli (çift tıklama
 * dördüncüyü açmasın).
 */
export async function veliBaglantisiOlustur(
  userId: string,
  gun: VeliSuresi,
  now = new Date()
): Promise<{ id: string; jeton: string; expiresAt: Date }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const etkin = await tx.parentLink.count({ where: etkinKosulu(userId, now) });
    if (etkin >= EN_FAZLA_VELI_BAGLANTISI) {
      throw new VeliHatasi(`En fazla ${EN_FAZLA_VELI_BAGLANTISI} etkin bağlantın olabilir. Yenisi için birini kaldır.`);
    }
    const jeton = randomBytes(32).toString("base64url");
    const b = await tx.parentLink.create({
      data: { userId, tokenHash: jetonOzeti(jeton), expiresAt: new Date(now.getTime() + gun * GUN_MS) },
      select: { id: true, expiresAt: true },
    });
    return { id: b.id, jeton, expiresAt: b.expiresAt };
  });
}

/** Öğrenci kaldırır; hemen kapanır. Başkasının bağlantısı ya da zaten kapalı olan: false. */
export async function veliBaglantisiniKaldir(userId: string, id: string, now = new Date()): Promise<boolean> {
  const r = await prisma.parentLink.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: now },
  });
  return r.count > 0;
}

// ─────────────────────────────────────────────────────────────
// Açılış (veli, girişsiz)
// ─────────────────────────────────────────────────────────────

export type VeliErisimi =
  | { durum: "GECERLI"; baglantiId: string; userId: string; expiresAt: Date }
  /** Bilinmeyen, süresi dolmuş ya da kaldırılmış: ekran hepsine aynı şeyi söyler. */
  | { durum: "GECERSIZ" };

export async function veliBaglantisiniCoz(jeton: string, now = new Date()): Promise<VeliErisimi> {
  if (!VELI_JETONU.test(jeton)) return { durum: "GECERSIZ" };
  const b = await prisma.parentLink.findUnique({
    where: { tokenHash: jetonOzeti(jeton) },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true },
  });
  if (!b || b.revokedAt || b.expiresAt <= now) return { durum: "GECERSIZ" };
  return { durum: "GECERLI", baglantiId: b.id, userId: b.userId, expiresAt: b.expiresAt };
}

/** Açılma sayacı. Kim açtı yazılmaz; kapanmış bağlantıya yazılmaz. */
export async function goruntulenmeKaydet(baglantiId: string, now = new Date()): Promise<void> {
  await prisma.parentLink.updateMany({
    where: { id: baglantiId, revokedAt: null, expiresAt: { gt: now } },
    data: { viewCount: { increment: 1 }, lastViewedAt: now },
  });
}

/** Bakım (cron): süresi dolalı ya da kaldırılalı VELI_KAYIT_SAKLAMA_GUN geçen kayıtlar. */
export async function eskiVeliBaglantilariniSil(now = new Date()): Promise<number> {
  const sinir = new Date(now.getTime() - VELI_KAYIT_SAKLAMA_GUN * GUN_MS);
  const r = await prisma.parentLink.deleteMany({
    where: { OR: [{ expiresAt: { lt: sinir } }, { revokedAt: { lt: sinir } }] },
  });
  return r.count;
}

// ─────────────────────────────────────────────────────────────
// Rapor
// ─────────────────────────────────────────────────────────────

export interface VeliKonu {
  ad: string;
  /** 0-100 */
  oran: number;
  dogru: number;
  soru: number;
}

export interface VeliTesti {
  tarih: Date;
  paket: string;
  /** 0-100 */
  oran: number;
  net: number;
}

/** Grafik noktası (components/BasariGrafikleri BasariNoktasi ile aynı biçim; etiket grafikTarihleri'nden). */
export interface VeliEgilimNoktasi {
  etiket: ReturnType<typeof grafikTarihleri>[number];
  deger: number;
  ayrinti: string;
}

/**
 * Velinin gördüğü HER ŞEY. Yeni alan eklemeden önce: soru metni, şık, çözüm,
 * cevap, e-posta, telefon, kimlik (soru/oturum kimliği dahil) buraya girmez.
 */
export interface VeliRaporu {
  /** Yalnızca ilk ad. */
  ad: string;
  sinav: { kisa: string; ad: string; kalanGun: number | null; donem: string } | null;
  sonOlcum: (VeliTesti & { degisim: number | null }) | null;
  /** Eskiden yeniye, en fazla RAPOR_OLCUM_SINIRI. */
  egilim: VeliEgilimNoktasi[];
  olcumSayisi: number;
  gucluKonular: VeliKonu[];
  zayifKonular: VeliKonu[];
  /** Yeniden eskiye, en fazla RAPOR_TEST_SAYISI. */
  sonTestler: VeliTesti[];
  plan: { biten: number; toplam: number } | null;
  acikDefter: number;
}

/** Konu haritası için en fazla bu kadar sonuç okunur (en yeniler). */
const SONUC_SINIRI = 200;

const yuzde = (r: ResultLike) => {
  const t = r.correctCount + r.wrongCount + r.blankCount;
  return t === 0 ? 0 : Math.round((r.correctCount / t) * 100);
};

export async function veliRaporu(userId: string, now = new Date()): Promise<VeliRaporu> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, targetExam: true },
  });
  const sinav = isExamScope(user.targetExam) ? user.targetExam : null;

  const [ham, plan, acikDefter] = await Promise.all([
    prisma.checkupResult.findMany({
      where: {
        // Alıştırma zaten sonuç üretmez; yine de açıkça süzülür: ölçüm değil.
        session: { userId, kind: { not: "PRACTICE" } },
        // Panodaki gibi öğrencinin sınavı (eski kayıtlarda kapsam boş).
        ...(sinav ? { OR: [{ examScope: sinav }, { examScope: null }] } : {}),
      },
      orderBy: { computedAt: "desc" },
      take: SONUC_SINIRI,
      select: {
        correctCount: true,
        wrongCount: true,
        blankCount: true,
        netScore: true,
        totalTimeMs: true,
        computedAt: true,
        topicBreakdown: true,
        examScope: true,
        session: { select: { kind: true, package: { select: { name: true } } } },
      },
    }),
    aktifPlan(userId, now),
    prisma.notebookItem.count({ where: { userId, resolvedAt: null } }),
  ]);

  const sonuclar = ham.reverse().map((r) => ({
    kind: r.session.kind,
    examScope: r.examScope,
    paket: r.session.package.name,
    correctCount: r.correctCount,
    wrongCount: r.wrongCount,
    blankCount: r.blankCount,
    netScore: Number(r.netScore),
    totalTimeMs: r.totalTimeMs,
    computedAt: r.computedAt,
    topicBreakdown: r.topicBreakdown as unknown as TopicBreakdown,
  }));

  // Eğilim, son ölçüm ve test listesi yalnızca ÖLÇÜMLERDEN: paket testi,
  // işaretli (lib/insights.ts egilimeGirer; pano ve gelişimle aynı süzgeç).
  // Kontrol testi tek zayıf konuyu ölçer, seviyeli aşama cezasız, boş
  // gönderilen test sıfır. Konu haritası kontrol testini ve aşamayı da toplar.
  const olcumler = sonuclar.filter((r) => egilimeGirer(r, sinav));
  const testOf = (r: (typeof sonuclar)[number]): VeliTesti => ({
    tarih: r.computedAt,
    paket: r.paket,
    oran: yuzde(r),
    net: Math.round(r.netScore * 100) / 100,
  });

  const grafikte = olcumler.slice(-RAPOR_OLCUM_SINIRI);
  const etiketler = grafikTarihleri(grafikte.map((r) => r.computedAt));
  const egilim = grafikte.map((r, i) => ({
    etiket: etiketler[i],
    deger: yuzde(r),
    ayrinti: r.paket + " · " + r.netScore.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " net",
  }));

  const son = olcumler.at(-1);
  const konular = aggregateTopics(sonuclar.filter((r) => konuHaritasinaGirer(r, sinav)));
  const konuOf = (k: (typeof konular)[number]): VeliKonu => ({
    ad: k.name,
    oran: Math.round(k.ratio * 100),
    dogru: k.correct,
    soru: k.asked,
  });

  return {
    ad: ilkAd(user.name),
    sinav: sinav
      ? { kisa: EXAMS[sinav].short, ad: EXAMS[sinav].name, kalanGun: daysUntilExam(sinav, now), donem: EXAMS[sinav].season }
      : null,
    sonOlcum: son ? { ...testOf(son), degisim: studentStats(olcumler).trend } : null,
    egilim,
    olcumSayisi: olcumler.length,
    gucluKonular: konular
      .filter((k) => k.level === "STRONG")
      .sort((a, b) => b.ratio - a.ratio || b.asked - a.asked)
      .slice(0, RAPOR_KONU_SAYISI)
      .map(konuOf),
    zayifKonular: konular
      .filter((k) => k.level === "WEAK")
      .sort((a, b) => a.ratio - b.ratio || b.asked - a.asked)
      .slice(0, RAPOR_KONU_SAYISI)
      .map(konuOf),
    sonTestler: olcumler.slice(-RAPOR_TEST_SAYISI).reverse().map(testOf),
    plan: plan ? { biten: plan.biten, toplam: plan.items.length } : null,
    acikDefter,
  };
}
