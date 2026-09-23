import { prisma } from "@/lib/db";
import { accessiblePackageSlugs } from "@/lib/entitlements";
import type { PackageCardData } from "@/components/PackageCard";

/**
 * Öğrenciye özel paket listesi: kilitli mi, yarım testi var mı, kaç kez
 * çözdü. Pano ve katalog aynı veriyi kullanıyor — tek yerde hesaplanıyor
 * ki "kilitli" ile "açık" iki ekranda farklı çıkmasın.
 *
 * Konu tekrar testleri (kind: RETEST) burada GÖRÜNMEZ: onlar katalogdan
 * değil, çalışma planındaki konudan başlatılır.
 */
export async function loadCatalog(
  userId: string,
  now: Date,
  opts: { scope?: string | null } = {}
): Promise<PackageCardData[]> {
  const [packages, acik, yarimlar, bitenler] = await Promise.all([
    prisma.package.findMany({
      where: {
        status: "PUBLISHED",
        kind: { not: "RETEST" },
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
        _count: { select: { topics: true } },
      },
    }),
    accessiblePackageSlugs(userId),
    prisma.checkupSession.findMany({
      where: { userId, status: "IN_PROGRESS", expiresAt: { gt: now } },
      select: { packageId: true },
    }),
    prisma.checkupSession.groupBy({
      by: ["packageId"],
      where: { userId, status: "SUBMITTED" },
      _count: { _all: true },
    }),
  ]);

  const yarimSet = new Set(yarimlar.map((s) => s.packageId));
  const bitenSayisi = new Map(bitenler.map((b) => [b.packageId, b._count._all]));

  return packages.map((p) => ({
    slug: p.slug,
    name: p.name,
    summary: p.summary,
    questionCount: p.questionCount,
    durationMinutes: p.durationMinutes,
    examScope: p.examScope,
    isIntro: p.kind === "INTRO",
    topicCount: p._count.topics,
    locked: !acik.has(p.slug),
    inProgress: yarimSet.has(p.id),
    timesTaken: bitenSayisi.get(p.id) ?? 0,
  }));
}

/**
 * Paketleri öğrencinin sırayla görmesi gereken biçimde gruplar.
 *
 * Sıra bilinçli: yarım kalan test her şeyin önünde (kaybolmasın), sonra
 * hiç çözülmemişler, sonra tekrar çözülebilecekler, en sonda kilitliler —
 * kullanamayacağı şeyleri kaydırarak geçmek zorunda kalmasın.
 */
export interface CatalogGroup {
  key: "devam" | "onerilen" | "tekrar" | "kilitli";
  title: string;
  hint?: string;
  items: PackageCardData[];
}

export function groupCatalog(items: PackageCardData[]): CatalogGroup[] {
  const devam = items.filter((p) => p.inProgress);
  const kalan = items.filter((p) => !p.inProgress);

  const kilitli = kalan.filter((p) => p.locked);
  const acik = kalan.filter((p) => !p.locked);

  // Tanışma testi hiç çözülmemişse en başta: boş panodaki tek çağrı o.
  const yeni = acik
    .filter((p) => (p.timesTaken ?? 0) === 0)
    .sort((a, b) => Number(b.isIntro) - Number(a.isIntro));
  const tekrar = acik.filter((p) => (p.timesTaken ?? 0) > 0);

  const gruplar: CatalogGroup[] = [
    { key: "devam", title: "Yarım kalan", hint: "Süresi dolmadan tamamla.", items: devam },
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

/** Hangi sınavlarda öğrenciye açık paket var — katalog sekmeleri buradan. */
export async function availableExamScopes(): Promise<string[]> {
  const rows = await prisma.package.groupBy({
    by: ["examScope"],
    where: { status: "PUBLISHED", kind: { not: "RETEST" } },
    _count: { _all: true },
  });
  return rows.map((r) => r.examScope);
}
