"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { CheckupError } from "@/lib/checkup";
import { asamaAc, seviyeliSinavBaslat, telafiyiAc } from "@/lib/level-run";
import { isExamScope } from "@/lib/exams";
import type { Seviye } from "@/lib/levels";

/**
 * Seviyeli check-up'ın sunucu eylemleri.
 *
 * Hepsi aynı deseni izliyor: başarılıysa test ekranına yönlendir,
 * başarısızsa deneme sayfasına hata mesajıyla dön. `redirect()` her zaman
 * try/catch DIŞINDA — içeride olsaydı fırlattığı özel hata yakalanır ve
 * yönlendirme hiç gerçekleşmezdi.
 */

export async function seviyeliBaslatAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sinav = String(formData.get("examScope") ?? "");
  if (!isExamScope(sinav)) redirect("/seviyeli?hata=" + encodeURIComponent("Sınav seçilmedi."));

  let sessionId: string;
  try {
    const sonuc = await seviyeliSinavBaslat(user.id, sinav);
    sessionId = sonuc.sessionId;
  } catch (e) {
    if (e instanceof CheckupError) {
      redirect("/seviyeli?hata=" + encodeURIComponent(e.message));
    }
    throw e;
  }

  revalidatePath("/panel");
  redirect(`/checkup/${sessionId}`);
}

/** Bekleyen telafi turunu açar. */
export async function telafiBaslatAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const runId = String(formData.get("runId") ?? "");

  let sessionId: string;
  try {
    sessionId = await telafiyiAc(runId, user.id);
  } catch (e) {
    if (e instanceof CheckupError) {
      redirect(`/seviye/${runId}?hata=` + encodeURIComponent(e.message));
    }
    throw e;
  }

  redirect(`/checkup/${sessionId}`);
}

/** Açılmış bir sonraki seviyeyi başlatır. */
export async function seviyeBaslatAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const runId = String(formData.get("runId") ?? "");
  const seviye = Number(formData.get("seviye"));

  if (![1, 2, 3].includes(seviye)) {
    redirect(`/seviye/${runId}?hata=` + encodeURIComponent("Geçersiz seviye."));
  }

  let sessionId: string;
  try {
    // Sahiplik denetimi asamaAc içinde: run.userId ile oturum açılıyor.
    const run = await import("@/lib/db").then((m) =>
      m.prisma.levelRun.findUnique({ where: { id: runId }, select: { userId: true } })
    );
    if (!run || run.userId !== user.id) {
      redirect(`/seviye/${runId}?hata=` + encodeURIComponent("Deneme bulunamadı."));
    }
    const sonuc = await asamaAc(runId, seviye as Seviye, "MAIN");
    sessionId = sonuc.sessionId;
  } catch (e) {
    if (e instanceof CheckupError) {
      redirect(`/seviye/${runId}?hata=` + encodeURIComponent(e.message));
    }
    throw e;
  }

  redirect(`/checkup/${sessionId}`);
}
