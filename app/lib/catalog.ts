import { prisma } from "@/lib/db";
import { accessiblePackageSlugs } from "@/lib/entitlements";
import type { PackageCardData } from "@/components/PackageCard";

/**
 * Öğrenciye özel paket listesi: kilitli mi, yarım testi var mı, kaç kez
 * çözdü. Pano ve katalog aynı veriyi kullanıyor — tek yerde hesaplanıyor
 * ki "kilitli" ile "açık" iki ekranda farklı çıkmasın.
 */
export async function loadCatalog(userId: string, now: Date): Promise<PackageCardData[]> {
  const [packages, acik, yarimlar, bitenler] = await Promise.all([
    prisma.package.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        summary: true,
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
    topicCount: p._count.topics,
    locked: !acik.has(p.slug),
    inProgress: yarimSet.has(p.id),
    timesTaken: bitenSayisi.get(p.id) ?? 0,
  }));
}
