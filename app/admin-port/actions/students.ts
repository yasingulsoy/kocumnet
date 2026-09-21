"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { grantEntitlement, revokeEntitlement } from "@/lib/entitlements";

export interface GrantState {
  error?: string;
  ok?: string;
}

const schema = z.object({
  userId: z.string().min(1),
  /** "all" = tüm paketler (abonelik), aksi halde paket kimliği. */
  packageId: z.string().min(1),
  /** Gün sayısı; 0 veya boş = süresiz. */
  days: z.coerce.number().int().min(0).max(3650),
  note: z.string().trim().max(200).optional(),
});

export async function grantEntitlementAction(
  _prev: GrantState,
  formData: FormData
): Promise<GrantState> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse({
    userId: formData.get("userId"),
    packageId: formData.get("packageId"),
    days: formData.get("days") || 0,
    note: String(formData.get("note") ?? "") || undefined,
  });
  if (!parsed.success) return { error: "Geçersiz istek." };

  const ogrenci = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!ogrenci) return { error: "Öğrenci bulunamadı." };

  await grantEntitlement({
    userId: ogrenci.id,
    // "all" = paket kısıtı yok → abonelik.
    packageId: parsed.data.packageId === "all" ? null : parsed.data.packageId,
    // 0 gün = süresiz → tek seferlik alım.
    expiresAt:
      parsed.data.days > 0 ? new Date(Date.now() + parsed.data.days * 86_400_000) : null,
    note: parsed.data.note,
    grantedById: admin.id,
  });

  revalidatePath("/admin/ogrenciler");
  return { ok: "Erişim hakkı verildi." };
}

export async function revokeEntitlementAction(id: string) {
  await requireAdmin();
  await revokeEntitlement(id);
  revalidatePath("/admin/ogrenciler");
}
