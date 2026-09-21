"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { startCheckup, saveAnswer, submitCheckup, CheckupError } from "@/lib/checkup";

export interface StartState {
  error?: string;
}

/**
 * Test başlatır ve test ekranına yönlendirir.
 * Havuz yetersizse hata mesajı geri döner — yarım test başlatmayız.
 */
export async function startCheckupAction(
  _prev: StartState,
  formData: FormData
): Promise<StartState> {
  const user = await requireUser();
  const slug = String(formData.get("packageSlug") ?? "");

  let sessionId: string;
  try {
    sessionId = await startCheckup(user.id, slug);
  } catch (e) {
    if (e instanceof CheckupError) return { error: e.message };
    throw e;
  }

  // redirect() try/catch DIŞINDA: içeride olsaydı fırlattığı özel hata
  // yakalanır ve yönlendirme hiç gerçekleşmezdi.
  redirect(`/checkup/${sessionId}`);
}

const answerSchema = z.object({
  sessionId: z.string().min(1),
  questionId: z.string().min(1),
  choiceId: z.string().min(1).nullable(),
  timeSpentMs: z.number().int().min(0).max(24 * 3600_000),
});

export type AnswerInput = z.infer<typeof answerSchema>;

/** Şık işaretler / işareti kaldırır. Doğruluk sunucuda hesaplanır. */
export async function saveAnswerAction(input: AnswerInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Geçersiz istek." };

  try {
    await saveAnswer({ ...parsed.data, userId: user.id });
    return { ok: true };
  } catch (e) {
    if (e instanceof CheckupError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Testi bitirir ve sonuç ekranına yönlendirir. */
export async function submitCheckupAction(sessionId: string): Promise<{ error: string } | never> {
  const user = await requireUser();

  try {
    await submitCheckup(sessionId, user.id);
  } catch (e) {
    if (e instanceof CheckupError) return { error: e.message };
    throw e;
  }

  revalidatePath("/gecmis");
  redirect(`/sonuc/${sessionId}`);
}
