"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth";
import { hataBildir } from "@/lib/hata-bildirimi";
import { sinirAsildiKullanici } from "@/lib/rate-limit";
import { BildirimHatasi, RAPOR_ACIKLAMA_SINIRI, RAPOR_SEBEP_DEGERLERI } from "@/lib/bildirim-kurallari";

/**
 * "Bu soruda hata var" eylemi. Kurallar (görmüş olma, açık bildirim, günlük
 * sınır) lib/hata-bildirimi.ts'te; burası oturum, girdi denetimi ve sayfanın
 * yeniden çizilmesi ("Bildirdin: inceleniyor" hemen görünsün).
 */

const kimlik = z.string().min(1).max(64);

const bildirimSemasi = z.object({
  questionId: kimlik,
  sessionId: kimlik,
  reason: z.enum(RAPOR_SEBEP_DEGERLERI),
  body: z.string().max(RAPOR_ACIKLAMA_SINIRI + 50).default(""),
});

export type HataBildirimiGirdisi = z.input<typeof bildirimSemasi>;

export async function hataBildirAction(
  input: HataBildirimiGirdisi
): Promise<{ ok: boolean; error?: string; oturumYok?: boolean }> {
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, oturumYok: true, error: "Oturumun kapanmış. Tekrar giriş yap." };
    throw e;
  }
  const parsed = bildirimSemasi.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bir sebep seç." };
  // Veritabanındaki günlük sınırın önünde kaba bir kalkan: aynı hesaptan istek seli.
  if (await sinirAsildiKullanici(userId, "hata-bildir", 30, 10 * 60_000)) {
    return { ok: false, error: "Çok fazla deneme. Biraz sonra tekrar dene." };
  }

  try {
    await hataBildir({ userId, ...parsed.data });
  } catch (e) {
    if (e instanceof BildirimHatasi) return { ok: false, error: e.message };
    throw e;
  }
  refresh();
  return { ok: true };
}
