"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";

export interface GrantState {
  error?: string;
  ok?: string;
}

const schema = z.object({
  userId: z.string().min(1),
  /** "all" = tüm paketler (abonelik), aksi halde paket kimliği. */
  packageId: z.string().min(1),
  /** Gün sayısı; 0 = süresiz. */
  days: z.coerce.number().int().min(0).max(3650),
  note: z.string().trim().max(200).optional(),
});

/**
 * Erişim hakkı ver.
 *
 * İki satış biçimi tek formdan çıkıyor:
 *   paket seç + süre 0   → tek seferlik alım (o paket, süresiz)
 *   "Tüm paketler" + gün → abonelik
 */
export async function grantEntitlementAction(
  _prev: GrantState,
  formData: FormData
): Promise<GrantState> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { error: auth.error };

  const parsed = schema.safeParse({
    userId: formData.get("userId"),
    packageId: formData.get("packageId"),
    days: formData.get("days") || 0,
    note: String(formData.get("note") ?? "") || undefined,
  });
  if (!parsed.success) return { error: "Geçersiz istek." };

  const ogrenci = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!ogrenci) return { error: "Öğrenci bulunamadı." };

  const tumu = parsed.data.packageId === "all";
  if (!tumu) {
    const paket = await db.package.findUnique({
      where: { id: parsed.data.packageId },
      select: { id: true },
    });
    if (!paket) return { error: "Paket bulunamadı." };
  }

  await db.entitlement.create({
    data: {
      userId: ogrenci.id,
      // "all" = paket kısıtı yok → abonelik.
      packageId: tumu ? null : parsed.data.packageId,
      // 0 gün = süresiz → tek seferlik alım.
      expiresAt:
        parsed.data.days > 0 ? new Date(Date.now() + parsed.data.days * 86_400_000) : null,
      source: "manual",
      note: parsed.data.note,
      grantedByStaff: staffStamp(auth.staff),
    },
  });

  revalidatePath("/checkup/ogrenciler");
  revalidatePath("/checkup/ogrenciler/" + ogrenci.id);
  return { ok: "Erişim hakkı verildi." };
}

/** Hakkı geri al. Satır silinmiyor, revokedAt işaretleniyor — uyuşmazlıkta kayıt gerekir. */
export async function revokeEntitlementAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !id) return { ok: false, error: "Geçersiz istek." };

  const hak = await db.entitlement.findUnique({
    where: { id },
    select: { userId: true, revokedAt: true },
  });
  if (!hak) return { ok: false, error: "Hak bulunamadı." };
  // Zaten geri alınmışsa ilk geri alma kaydını (kim, ne zaman) ezmiyoruz.
  if (hak.revokedAt) return { ok: true };

  await db.entitlement.update({
    where: { id },
    data: { revokedAt: new Date(), revokedByStaff: staffStamp(auth.staff) },
  });

  revalidatePath("/checkup/ogrenciler");
  revalidatePath("/checkup/ogrenciler/" + hak.userId);
  return { ok: true };
}
