"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth";
import {
  startCheckup,
  saveAnswer,
  submitCheckup,
  getSessionState,
  CheckupError,
  type CheckupErrorCode,
  type SessionState,
} from "@/lib/checkup";
import { prisma } from "@/lib/db";

export interface StartState {
  error?: string;
}

const startSchema = z.object({
  packageSlug: z.string().min(1).max(120),
  // Bilinmeyen değer ekran sayılır: kâğıt ancak bilerek seçilir.
  mode: z.enum(["ONLINE", "PAPER"]).catch("ONLINE"),
});

/**
 * Test başlatır ve test ekranına yönlendirir; kâğıtta çözülecekse kitapçığa.
 * Havuz yetersizse hata mesajı geri döner — yarım test başlatmayız.
 */
export async function startCheckupAction(
  _prev: StartState,
  formData: FormData
): Promise<StartState> {
  const user = await requireUser();
  const parsed = startSchema.safeParse({
    packageSlug: formData.get("packageSlug"),
    mode: formData.get("mode") ?? "ONLINE",
  });
  if (!parsed.success) return { error: "Geçersiz istek." };

  let sessionId: string;
  try {
    sessionId = await startCheckup(user.id, parsed.data.packageSlug, { mode: parsed.data.mode });
  } catch (e) {
    if (e instanceof CheckupError) return { error: e.message };
    throw e;
  }

  // Açık bir oturum varsa o döner (biçimi ne seçildiyse değil, neyse o):
  // yönlendirme oturumun kendi biçimine göre.
  const acilan = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: { mode: true },
  });

  // redirect() try/catch DIŞINDA: içeride olsaydı fırlattığı özel hata
  // yakalanır ve yönlendirme hiç gerçekleşmezdi.
  redirect(acilan?.mode === "PAPER" ? `/kitapcik/${sessionId}` : `/checkup/${sessionId}`);
}

const answerSchema = z.object({
  sessionId: z.string().min(1),
  questionId: z.string().min(1),
  choiceId: z.string().min(1).nullable(),
  timeSpentMs: z.number().int().min(0).max(24 * 3600_000),
});

export type AnswerInput = z.infer<typeof answerSchema>;

/**
 * Sınav ekranının hatayı nasıl karşılayacağı. OTURUM: giriş düşmüş (ör.
 * öğrenci başka cihazdan "diğerlerinden çıkış" dedi) — tekrar denemek boşuna,
 * yeniden giriş gerekir. Fırlatılan hata yerine kod döndürüyoruz: üretimde
 * Next fırlatılan hatanın mesajını istemciye göndermiyor, ağ kopmasından
 * ayırt edilemiyordu ve ekran sonsuza kadar "tekrar deniyor"du.
 */
export type SinavHataKodu = CheckupErrorCode | "OTURUM";

const OTURUM_MESAJI = "Oturumun kapanmış. Tekrar giriş yap; kaydedilen cevapların duruyor.";

/** Şık işaretler / işareti kaldırır. Doğruluk sunucuda hesaplanır. */
export async function saveAnswerAction(
  input: AnswerInput
): Promise<{ ok: boolean; error?: string; kod?: SinavHataKodu }> {
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: OTURUM_MESAJI, kod: "OTURUM" };
    throw e;
  }
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Geçersiz istek.", kod: "GECERSIZ" };

  try {
    await saveAnswer({ ...parsed.data, userId });
    return { ok: true };
  } catch (e) {
    if (e instanceof CheckupError) return { ok: false, error: e.message, kod: e.code };
    throw e;
  }
}

/**
 * Sınav ekranını sunucuyla eşitler: durum, kalan süre, öğrencinin işaretleri.
 * Ekran açılınca ve sekmeye geri dönülünce çağrılır (bkz. getSessionState).
 */
export async function sinavDurumuAction(
  sessionId: string
): Promise<({ ok: true } & SessionState) | { ok: false; kod: SinavHataKodu }> {
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, kod: "OTURUM" };
    throw e;
  }
  if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 64) {
    return { ok: false, kod: "GECERSIZ" };
  }
  try {
    return { ok: true, ...(await getSessionState(sessionId, userId)) };
  } catch (e) {
    if (e instanceof CheckupError) return { ok: false, kod: e.code };
    throw e;
  }
}

/** Soru başına biriken süreler: { questionId: ms }. En fazla 60 soru. */
const timesSchema = z
  .record(z.string().min(1), z.number().int().min(0).max(6 * 3600_000))
  .refine((r) => Object.keys(r).length <= 60, "Çok fazla kayıt.");

/** Testi bitirir ve sonuç ekranına yönlendirir. */
export async function submitCheckupAction(
  sessionId: string,
  times?: Record<string, number>
): Promise<{ error: string; kod?: SinavHataKodu } | never> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return { error: OTURUM_MESAJI, kod: "OTURUM" };
    throw e;
  }
  if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 64) {
    return { error: "Geçersiz istek.", kod: "GECERSIZ" };
  }

  // Süre haritası bozuksa testi bitirmeyi engellemez: yoksayıp devam ederiz.
  const sureler = times ? (timesSchema.safeParse(times).data ?? undefined) : undefined;

  try {
    await submitCheckup(sessionId, user.id, sureler);
  } catch (e) {
    if (e instanceof CheckupError) return { error: e.message, kod: e.code };
    throw e;
  }

  /*
   * Seviyeli check-up aşaması mı?
   *
   * Öyleyse öğrenci deneme sayfasına gider — paket sonucu ekranı (koçluk
   * çıktısı) burada yanlış olurdu: orada "bu hafta şunu çalış" yazıyor, oysa
   * aday sınavın ortasında. Kapı burada DEĞİL, submitCheckup'ta
   * değerlendirildi: süresi dolup cron'la kapanan aşama da aynı yoldan geçsin.
   */
  const asama = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: { kind: true, levelRunId: true },
  });

  if (asama?.kind === "LEVEL_STAGE" && asama.levelRunId) {
    revalidatePath("/panel");
    redirect(`/seviye/${asama.levelRunId}`);
  }

  revalidatePath("/panel");
  revalidatePath("/gelisim");
  redirect(`/sonuc/${sessionId}`);
}
