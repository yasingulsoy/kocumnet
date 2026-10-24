"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth";
import { cevaplariOkundu, kocaSoruSor } from "@/lib/koca-soru";
import { sinirAsildiKullanici } from "@/lib/rate-limit";
import { BildirimHatasi, KOCA_SORU_SINIRI } from "@/lib/bildirim-kurallari";

/**
 * "Koça sor" eylemleri. Kurallar lib/koca-soru.ts'te; burası oturum, girdi
 * denetimi ve sayfanın yeniden çizilmesi.
 */

const kimlik = z.string().min(1).max(64);

const soruSemasi = z.object({
  body: z.string().max(KOCA_SORU_SINIRI + 50),
  questionId: kimlik.nullish(),
  sessionId: kimlik.nullish(),
});

export type KocaSoruGirdisi = z.input<typeof soruSemasi>;

export async function kocaSorAction(
  input: KocaSoruGirdisi
): Promise<{ ok: boolean; error?: string; oturumYok?: boolean }> {
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, oturumYok: true, error: "Oturumun kapanmış. Tekrar giriş yap." };
    throw e;
  }
  const parsed = soruSemasi.safeParse(input);
  if (!parsed.success) return { ok: false, error: `Sorun en fazla ${KOCA_SORU_SINIRI} karakter olabilir.` };
  if (await sinirAsildiKullanici(userId, "koca-sor", 20, 10 * 60_000)) {
    return { ok: false, error: "Çok fazla deneme. Biraz sonra tekrar dene." };
  }

  try {
    await kocaSoruSor({ userId, ...parsed.data });
  } catch (e) {
    if (e instanceof BildirimHatasi) return { ok: false, error: e.message };
    throw e;
  }
  refresh();
  return { ok: true };
}

const okunduSemasi = z.array(kimlik).max(100);

/**
 * Koçun cevapları ekranda gösterildi: "yeni" rozeti ve ana sayfa kartı
 * sönsün. Sayfa yeniden çizdirilmez; öğrenci o an "Yeni" rozetlerini
 * görmeye devam eder.
 */
export async function cevaplariOkuduAction(ids: string[]): Promise<void> {
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (e) {
    if (e instanceof AuthError) return;
    throw e;
  }
  const parsed = okunduSemasi.safeParse(ids);
  if (!parsed.success) return;
  await cevaplariOkundu(userId, parsed.data);
}
