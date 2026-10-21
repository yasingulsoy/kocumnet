import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { accessiblePackageSlugs } from "@/lib/entitlements";
import { denemeHazirMi, type DenemeListeDurumu } from "@/lib/deneme";
import type { PackageCardData } from "@/components/PackageCard";

/**
 * Katalogda görünen ve paket akışıyla (startCheckup) başlatılabilen türler.
 *
 * Konu tekrar testleri (RETEST) planındaki konudan, seviyeli check-up (LEVEL)
 * kendi sayfasından başlar; ikisinin de konu dağılımı yok. Seviyeli paket
 * katalogda kalmıştı: panoda "sıradaki adım" diye öneriliyor, başlatılınca
 * sıfır soruluk bir oturum açılıp sınav ekranı çöküyordu.
 *
 * Deneme sınavları (MOCK) burada DEĞİL, ayrı: DENEME_TURU. Bu liste tanıtım
 * sayfasında "her biri 15-30 dakika" başlığının altında da kullanılıyor;
 * 55 dakikalık tam prova oraya ve panodaki "sıradaki adım" önerisine
 * karışmasın. Denemeler yalnızca katalog sayfasında, kendi bölümünde.
 */
export const KATALOG_TURLERI = ["STANDARD", "INTRO"] as const;

/** Deneme sınavı: katalog sayfasında "Deneme sınavları" bölümü. */
export const DENEME_TURU = "MOCK" as const;

/**
 * Denemelerin sabit soru listesinin durumu: kaç soru, kaçı yayında.
 * "Hazırlanıyor" kararı lib/deneme.ts denemeHazirMi'de; başlatma aynı kuralı
 * kullanıyor ki katalogda "hazır" görünen deneme açılırken reddedilmesin.
 */
export async function denemeDurumlari(packageIds: string[]): Promise<Map<string, DenemeListeDurumu>> {
  if (packageIds.length === 0) return new Map();
  const satirlar = await prisma.$queryRaw<{ packageId: string; toplam: number; yayinda: number }[]>`
    SELECT pq."packageId",
           count(*)::int AS toplam,
           count(*) FILTER (WHERE q.status = 'PUBLISHED')::int AS yayinda
    FROM "PackageQuestion" pq
    JOIN "Question" q ON q.id = pq."questionId"
    WHERE pq."packageId" IN (${Prisma.join(packageIds)})
    GROUP BY pq."packageId"
  `;
  return new Map(satirlar.map((s) => [s.packageId, { toplam: s.toplam, yayinda: s.yayinda }]));
}

/**
 * Öğrenciye özel paket listesi: kilitli mi, yarım testi var mı, kaç kez
 * çözdü. Pano ve katalog aynı veriyi kullanıyor — tek yerde hesaplanıyor
 * ki "kilitli" ile "açık" iki ekranda farklı çıkmasın.
 *
 * `denemeler: true` yalnızca katalog sayfasında: deneme kartları da gelir
 * (hazır mı, ceza kuralı). Pano ve gelişim bunu istemez.
 */
export async function loadCatalog(
  userId: string,
  now: Date,
  opts: { scope?: string | null; denemeler?: boolean } = {}
): Promise<PackageCardData[]> {
  const turler: ((typeof KATALOG_TURLERI)[number] | typeof DENEME_TURU)[] = opts.denemeler
    ? [...KATALOG_TURLERI, DENEME_TURU]
    : [...KATALOG_TURLERI];
  const [packages, acik, yarimlar, bitenler] = await Promise.all([
    prisma.package.findMany({
      where: {
        status: "PUBLISHED",
        kind: { in: turler },
        ...(opts.scope ? { examScope: opts.scope as never } : {}),
      },
      orderBy: [{ examScope: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        summary: true,
        kind: true,
        questionCount: true,
        durationMinutes: true,
        examScope: true,
        penaltyRatio: true,
        _count: { select: { topics: true } },
      },
    }),
    accessiblePackageSlugs(userId),
    prisma.checkupSession.findMany({
      where: { userId, status: "IN_PROGRESS", expiresAt: { gt: now } },
      select: { packageId: true, mode: true },
    }),
    prisma.checkupSession.groupBy({
      by: ["packageId"],
      where: { userId, status: "SUBMITTED" },
      _count: { _all: true },
    }),
  ]);

  const yarimMod = new Map(yarimlar.map((s) => [s.packageId, s.mode]));
  const bitenSayisi = new Map(bitenler.map((b) => [b.packageId, b._count._all]));
  const durumlar = await denemeDurumlari(packages.filter((p) => p.kind === DENEME_TURU).map((p) => p.id));

  return packages.map((p) => {
    const deneme = p.kind === DENEME_TURU;
    return {
      slug: p.slug,
      name: p.name,
      summary: p.summary,
      questionCount: p.questionCount,
      durationMinutes: p.durationMinutes,
      examScope: p.examScope,
      isIntro: p.kind === "INTRO",
      topicCount: p._count.topics,
      locked: !acik.has(p.slug),
      inProgress: yarimMod.has(p.id),
      inProgressPaper: yarimMod.get(p.id) === "PAPER",
      timesTaken: bitenSayisi.get(p.id) ?? 0,
      ...(deneme
        ? {
            isMock: true,
            penaltyRatio: Number(p.penaltyRatio),
            hazir: denemeHazirMi(durumlar.get(p.id), p.questionCount),
          }
        : {}),
    };
  });
}

/**
 * Öğrenciye önerilecek sıradaki paketler: açık ve yarım olmayanlar; en az
 * çözülen önce, eşitlikte tanışma testi. Pano ve gelişim sayfası aynı sırayı
 * kullanır ki iki ekran farklı "ilk adım" göstermesin. Deneme sınavı öneri
 * değil: tam prova öğrencinin bilerek seçtiği bir şey.
 */
export function siradakiPaketler(katalog: PackageCardData[], adet = 2): PackageCardData[] {
  return katalog
    .filter((p) => !p.locked && !p.inProgress && !p.isMock)
    .sort(
      (a, b) => (a.timesTaken ?? 0) - (b.timesTaken ?? 0) || Number(b.isIntro) - Number(a.isIntro)
    )
    .slice(0, adet);
}

/**
 * Paketleri öğrencinin sırayla görmesi gereken biçimde gruplar.
 *
 * Sıra bilinçli: yarım kalan test her şeyin önünde (kaybolmasın), sonra
 * deneme sınavları (ayrı bölüm: odaklı paketlerle aynı şey değil), sonra hiç
 * çözülmemişler, sonra tekrar çözülebilecekler, en sonda kilitliler —
 * kullanamayacağı şeyleri kaydırarak geçmek zorunda kalmasın.
 */
export interface CatalogGroup {
  key: "devam" | "deneme" | "onerilen" | "tekrar" | "kilitli";
  title: string;
  hint?: string;
  items: PackageCardData[];
}

export function groupCatalog(items: PackageCardData[]): CatalogGroup[] {
  const devam = items.filter((p) => p.inProgress);
  const kalan = items.filter((p) => !p.inProgress);

  // Denemeler kendi bölümünde; içinde önce başlatılabilenler, hazırlanan ve
  // kilitli olanlar sonda.
  const denemeler = kalan
    .filter((p) => p.isMock)
    .sort((a, b) => Number(a.locked || !a.hazir) - Number(b.locked || !b.hazir));
  const paketler = kalan.filter((p) => !p.isMock);

  const kilitli = paketler.filter((p) => p.locked);
  const acik = paketler.filter((p) => !p.locked);

  // Tanışma testi hiç çözülmemişse en başta: boş panodaki tek çağrı o.
  const yeni = acik
    .filter((p) => (p.timesTaken ?? 0) === 0)
    .sort((a, b) => Number(b.isIntro) - Number(a.isIntro));
  const tekrar = acik.filter((p) => (p.timesTaken ?? 0) > 0);

  const gruplar: CatalogGroup[] = [
    { key: "devam", title: "Yarım kalan", hint: "Süresi dolmadan tamamla.", items: devam },
    {
      key: "deneme",
      title: "Deneme sınavları",
      hint: "Gerçek sınavın soru sayısı, süresi ve yanlış kuralıyla tam prova. Herkes aynı soruları çözer; sonunda netinin bu denemeyi çözenler arasındaki yerini görürsün.",
      items: denemeler,
    },
    { key: "onerilen", title: "Henüz çözmediklerin", items: yeni },
    {
      key: "tekrar",
      title: "Tekrar çözebilecekleri",
      hint: "Aynı paketi tekrar çözdüğünde farklı sorular gelir.",
      items: tekrar,
    },
    { key: "kilitli", title: "Kilitli", items: kilitli },
  ];

  return gruplar.filter((g) => g.items.length > 0);
}

/** Hangi sınavlarda öğrenciye açık paket var — katalog sekmeleri buradan (denemeler dahil). */
export async function availableExamScopes(): Promise<string[]> {
  const rows = await prisma.package.groupBy({
    by: ["examScope"],
    where: { status: "PUBLISHED", kind: { in: [...KATALOG_TURLERI, DENEME_TURU] } },
    _count: { _all: true },
  });
  return rows.map((r) => r.examScope);
}
