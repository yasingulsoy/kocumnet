"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth";
import { CheckupError } from "@/lib/checkup";
import { answerPractice, benzeriniCozBaslat, konuCalismasiBaslat, tekrarBaslat } from "@/lib/practice";

/**
 * Alıştırma eylemleri. Kurallar lib/practice.ts'te; burası yalnızca oturum,
 * girdi denetimi ve yönlendirme.
 */

export interface AlistirmaBaslatDurumu {
  error?: string;
}

const kimlik = z.string().min(1).max(64);

/** Sonuçtaki bir yanlışın benzerini açar ve alıştırma ekranına gönderir. */
export async function benzeriniCozAction(
  _prev: AlistirmaBaslatDurumu,
  formData: FormData
): Promise<AlistirmaBaslatDurumu> {
  const user = await requireUser();
  const sessionId = kimlik.safeParse(formData.get("sessionId"));
  const questionId = kimlik.safeParse(formData.get("questionId"));
  if (!sessionId.success || !questionId.success) return { error: "Geçersiz istek." };

  let yeni: string;
  try {
    yeni = await benzeriniCozBaslat(user.id, sessionId.data, questionId.data);
  } catch (e) {
    if (e instanceof CheckupError) return { error: e.message };
    throw e;
  }
  // redirect() try/catch DIŞINDA.
  redirect(`/alistirma/${yeni}`);
}

/** Bir sonucun zayıf konusunda süresiz alıştırma açar. */
export async function konuCalisAction(
  _prev: AlistirmaBaslatDurumu,
  formData: FormData
): Promise<AlistirmaBaslatDurumu> {
  const user = await requireUser();
  const sessionId = kimlik.safeParse(formData.get("sessionId"));
  const topicId = kimlik.safeParse(formData.get("topicId"));
  if (!sessionId.success || !topicId.success) return { error: "Geçersiz istek." };

  let yeni: string;
  try {
    yeni = await konuCalismasiBaslat(user.id, topicId.data, sessionId.data);
  } catch (e) {
    if (e instanceof CheckupError) return { error: e.message };
    throw e;
  }
  redirect(`/alistirma/${yeni}`);
}

/**
 * Yanlış defterinden "Bugünkü tekrar"ı açar (yarım kaldıysa ona döner).
 * Girdisi yok: hangi maddelerin geleceğine sunucu karar verir.
 */
export async function tekrarBaslatAction(): Promise<AlistirmaBaslatDurumu> {
  const user = await requireUser();
  let yeni: string;
  try {
    yeni = await tekrarBaslat(user.id, user.targetExam);
  } catch (e) {
    if (e instanceof CheckupError) return { error: e.message };
    throw e;
  }
  redirect(`/alistirma/${yeni}`);
}

const cevapSemasi = z.object({
  sessionId: kimlik,
  questionId: kimlik,
  choiceId: kimlik.nullable(),
  timeSpentMs: z.number().int().min(0).max(24 * 3600_000),
});

export type AlistirmaCevabi = z.infer<typeof cevapSemasi>;

/**
 * Alıştırma cevabı. Başarılıysa sayfa aynı yanıtla yeniden çizilir (refresh):
 * geri bildirim, yalnızca cevaplanmış soru için sunucuda hazırlanıp gelir.
 */
export async function alistirmaCevaplaAction(
  input: AlistirmaCevabi
): Promise<{ ok: boolean; error?: string; oturumYok?: boolean }> {
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, oturumYok: true, error: "Oturumun kapanmış. Tekrar giriş yap." };
    }
    throw e;
  }
  const parsed = cevapSemasi.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Geçersiz istek." };

  try {
    await answerPractice({ ...parsed.data, userId });
  } catch (e) {
    if (e instanceof CheckupError) {
      // Kapanmış alıştırmada da sayfayı tazele: ekran son durumu göstersin.
      if (e.code === "KAPANDI") refresh();
      return { ok: false, error: e.message };
    }
    throw e;
  }
  refresh();
  return { ok: true };
}
