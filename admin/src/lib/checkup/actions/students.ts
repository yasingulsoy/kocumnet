"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/checkup/db";
import {
  SIFIRLAMA_GECERLILIK_SAAT,
  SIFIRLAMA_SAATLIK_SINIR,
  damgaKimligi,
  sifirlamaBaglantisi,
  sifirlamaJetonuOzeti,
  sifirlamaJetonuUret,
} from "@/lib/checkup/sifirlama";
import { MANAGE_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import { uygulamaAdresi } from "@/lib/checkup/uygulama";

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

/**
 * Parola sıfırlama bağlantısı üret — e-posta altyapısı yokken parolasını
 * unutan öğrenciye koç bağlantıyı WhatsApp'tan iletir. Yalnızca yönetici ve
 * müdür. Jeton biçimi ve gerekçe lib/checkup/sifirlama.ts'te (app ile eşit).
 *
 *  - Tabloya jetonun kendisi değil özeti yazılır; bağlantı yalnızca bu
 *    yanıtta, bir kez döner (sayfada saklanmaz, günlüğe yazılmaz).
 *  - 24 saat geçerli, tek kullanımlık; kim ürettiyse createdByStaff'ta.
 *  - Öğrencinin bekleyen BÜTÜN eski bağlantıları geçersiz olur (personelin
 *    ürettikleri de öğrencinin e-postayla istediği de): uygulamanın kendi
 *    kuralı gibi, aynı anda tek geçerli bağlantı dolaşsın.
 *  - Personel başına saatte SIFIRLAMA_SAATLIK_SINIR bağlantı; sayaç tablodan.
 */
export async function sifirlamaBaglantisiAction(
  userId: unknown
): Promise<{ ok: true; baglanti: string; gecerlilik: Date } | { ok: false; error: string }> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof userId !== "string" || !/^[a-z0-9]{6,64}$/i.test(userId)) return { ok: false, error: "Geçersiz istek." };

  const ogrenci = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  // Yalnızca öğrenci hesabı: panelden bir yönetici hesabının parolası sıfırlanamasın.
  if (!ogrenci || ogrenci.role !== "STUDENT") return { ok: false, error: "Öğrenci bulunamadı." };

  const now = new Date();
  const sonSaat = await db.passwordResetToken.count({
    where: { createdByStaff: { endsWith: damgaKimligi(auth.staff.id) }, createdAt: { gte: new Date(now.getTime() - 3_600_000) } },
  });
  if (sonSaat >= SIFIRLAMA_SAATLIK_SINIR) {
    return { ok: false, error: "Son bir saatte " + SIFIRLAMA_SAATLIK_SINIR + " bağlantı ürettin. Biraz sonra tekrar dene." };
  }

  const jeton = sifirlamaJetonuUret();
  const gecerlilik = new Date(now.getTime() + SIFIRLAMA_GECERLILIK_SAAT * 3_600_000);
  const damga = staffStamp(auth.staff);
  await db.$transaction([
    db.passwordResetToken.updateMany({ where: { userId: ogrenci.id, usedAt: null }, data: { usedAt: now } }),
    db.passwordResetToken.create({
      data: { userId: ogrenci.id, tokenHash: sifirlamaJetonuOzeti(jeton), expiresAt: gecerlilik, createdByStaff: damga },
    }),
  ]);
  // Bağlantı günlüğe yazılmaz: günlüğü okuyan parolayı değiştiremesin.
  console.info("[checkup] parola sıfırlama bağlantısı üretildi — öğrenci " + ogrenci.id + " · " + damga);
  revalidatePath("/checkup/ogrenciler/" + ogrenci.id);
  return { ok: true, baglanti: sifirlamaBaglantisi(uygulamaAdresi(), jeton), gecerlilik };
}
