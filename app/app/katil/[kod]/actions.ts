"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DAVET_HATA_PENCERESI_MS,
  DAVET_HATA_SINIRI_KULLANICI,
  grubaKatil,
} from "@/lib/grup-katilim";
import { denemeYazKullanici, sinirDoluKullanici } from "@/lib/rate-limit";

export interface KatilDurumu {
  sonuc?: "KATILDI" | "ZATEN_UYE" | "GECERSIZ" | "SINIR" | "OTURUM";
  grupAdi?: string;
}

/**
 * "Gruba katıl" düğmesi (/katil/<kod>). Kurallar lib/grup-katilim.ts'te;
 * burada oturum ve hız sınırı: yalnızca GEÇERSİZ kod denemesi sayılır,
 * öğrencinin kimliğiyle (okulda tek IP'yi paylaşanlar birbirini kilitlemesin).
 */
export async function katilAction(_onceki: KatilDurumu, formData: FormData): Promise<KatilDurumu> {
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (e) {
    if (e instanceof AuthError) return { sonuc: "OTURUM" };
    throw e;
  }

  if (sinirDoluKullanici(userId, "davet-hata", DAVET_HATA_SINIRI_KULLANICI)) return { sonuc: "SINIR" };

  const katilim = await grubaKatil(prisma, formData.get("kod"), userId);
  if (katilim.sonuc === "GECERSIZ") {
    denemeYazKullanici(userId, "davet-hata", DAVET_HATA_PENCERESI_MS);
    return { sonuc: "GECERSIZ" };
  }

  // Grup ödevleri ana sayfada ve ödevler sayfasında hemen görünsün.
  revalidatePath("/panel");
  revalidatePath("/odevler");
  return { sonuc: katilim.sonuc, grupAdi: katilim.grupAdi };
}
