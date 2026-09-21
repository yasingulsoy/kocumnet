import { prisma } from "@/lib/db";

/**
 * Erişim hakkı denetimi.
 *
 * Kural basit: paket ücretsizse herkes girer. Ücretliyse öğrencinin geçerli
 * bir hakkı olmalı — ya o pakete özel (tek seferlik alım) ya da tümünü
 * kapsayan (abonelik).
 *
 * ⚠️ Denetim `startCheckup` içinde, servis katmanında yapılıyor; arayüzde
 * kilit rozeti göstermek yetmez — adres çubuğuna paket slug'ı yazan biri
 * testi başlatabilirdi.
 */

export interface AccessResult {
  allowed: boolean;
  /** Ücretsiz paket mi, yoksa hakla mı açıldı. */
  reason: "free" | "entitled" | "locked";
  /** Abonelikse bitiş tarihi. */
  expiresAt?: Date | null;
}

export async function checkPackageAccess(
  userId: string,
  packageId: string,
  isFree: boolean
): Promise<AccessResult> {
  if (isFree) return { allowed: true, reason: "free" };

  const now = new Date();
  const hak = await prisma.entitlement.findFirst({
    where: {
      userId,
      revokedAt: null,
      // packageId null = tüm paketleri kapsayan abonelik.
      OR: [{ packageId }, { packageId: null }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    select: { expiresAt: true },
  });

  return hak
    ? { allowed: true, reason: "entitled", expiresAt: hak.expiresAt }
    : { allowed: false, reason: "locked" };
}

/**
 * Bir öğrencinin erişebildiği paket slug'ları — liste ekranında kilit
 * rozetini çizmek için. Tek tek sorgu atmak yerine tek turda topluyoruz.
 */
export async function accessiblePackageSlugs(userId: string): Promise<Set<string>> {
  const now = new Date();

  const [ucretsizler, haklar] = await Promise.all([
    prisma.package.findMany({
      where: { isFree: true, status: "PUBLISHED" },
      select: { slug: true },
    }),
    prisma.entitlement.findMany({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { packageId: true, package: { select: { slug: true } } },
    }),
  ]);

  const set = new Set(ucretsizler.map((p) => p.slug));

  // packageId null olan bir hak varsa tüm paketler açılır.
  if (haklar.some((h) => h.packageId === null)) {
    const hepsi = await prisma.package.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true },
    });
    for (const p of hepsi) set.add(p.slug);
    return set;
  }

  for (const h of haklar) {
    if (h.package?.slug) set.add(h.package.slug);
  }
  return set;
}

export interface GrantInput {
  userId: string;
  /** null = tüm paketler (abonelik). */
  packageId: string | null;
  /** null = süresiz (tek seferlik alım). */
  expiresAt: Date | null;
  source?: string;
  note?: string;
  grantedById?: string;
}

export async function grantEntitlement(input: GrantInput) {
  return prisma.entitlement.create({
    data: {
      userId: input.userId,
      packageId: input.packageId,
      expiresAt: input.expiresAt,
      source: input.source ?? "manual",
      note: input.note,
      grantedById: input.grantedById,
    },
    select: { id: true },
  });
}

/** İptal/iade. Satırı silmiyoruz — uyuşmazlıkta kayıt gerekir. */
export async function revokeEntitlement(id: string) {
  await prisma.entitlement.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}
