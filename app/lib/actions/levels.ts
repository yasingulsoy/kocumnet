"use server";

import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { CheckupError } from "@/lib/checkup";
import { asamaAc, kosuyuBirak, seviyeliSinavBaslat, telafiyiAc } from "@/lib/level-run";
import { isExamScope } from "@/lib/exams";
import type { Seviye } from "@/lib/levels";
import { hataAdresi, seviyeliHataKodu } from "@/lib/hata-kodlari";

/**
 * Seviyeli check-up'ın sunucu eylemleri.
 *
 * Hepsi aynı deseni izliyor: başarılıysa test ekranına yönlendir,
 * başarısızsa deneme sayfasına hata KODUYLA dön (lib/hata-kodlari.ts):
 * adrese metin yazılmaz, sayfa sabit cümleyi tablodan okur. `redirect()` her zaman
 * try/catch DIŞINDA — içeride olsaydı fırlattığı özel hata yakalanır ve
 * yönlendirme hiç gerçekleşmezdi.
 */

/** Deneme sayfasının yolu; kimlik formdan geldiği için kaçışlanır. */
function denemeYolu(runId: string): string {
  return `/seviye/${encodeURIComponent(runId)}`;
}

export async function seviyeliBaslatAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sinav = String(formData.get("examScope") ?? "");
  if (!isExamScope(sinav)) redirect(hataAdresi("/seviyeli", "sinav-secilmedi"));

  let sonuc: { runId: string; sessionId: string | null };
  try {
    sonuc = await seviyeliSinavBaslat(user.id, sinav);
  } catch (e) {
    if (e instanceof CheckupError) {
      redirect(hataAdresi("/seviyeli", seviyeliHataKodu(e.message)));
    }
    throw e;
  }

  revalidatePath("/panel");
  // Süren deneme açık aşamasızsa sıradaki adımı deneme sayfası söyler.
  redirect(sonuc.sessionId ? `/checkup/${sonuc.sessionId}` : `/seviye/${sonuc.runId}`);
}

/** Bekleyen telafi turunu açar. */
export async function telafiBaslatAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const runId = String(formData.get("runId") ?? "");

  let sessionId: string | null;
  try {
    sessionId = await telafiyiAc(runId, user.id);
  } catch (e) {
    if (e instanceof CheckupError) {
      redirect(hataAdresi(denemeYolu(runId), seviyeliHataKodu(e.message)));
    }
    throw e;
  }

  // Tur açılmadan karar verildiyse (havuzda yeni soru yok) karne sıradakini gösterir.
  revalidatePath("/panel");
  redirect(sessionId ? `/checkup/${sessionId}` : `/seviye/${runId}`);
}

/**
 * Süren denemeyi bırakır (karnedeki "Bu denemeyi bırak", onay penceresinden
 * sonra). Sayfa yerinde yenilenir: karne "bırakıldı" olarak çizilir.
 */
export async function seviyeliBirakAction(runId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (typeof runId !== "string" || !runId || runId.length > 64) {
    return { ok: false, error: "Geçersiz istek." };
  }
  try {
    await kosuyuBirak(runId, user.id);
  } catch (e) {
    if (e instanceof CheckupError) return { ok: false, error: e.message };
    throw e;
  }
  revalidatePath("/panel");
  refresh();
  return { ok: true };
}

/** Açılmış bir sonraki seviyeyi başlatır. */
export async function seviyeBaslatAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const runId = String(formData.get("runId") ?? "");
  const seviye = Number(formData.get("seviye"));

  if (![1, 2, 3].includes(seviye)) {
    redirect(hataAdresi(denemeYolu(runId), "seviye-gecersiz"));
  }

  let sessionId: string;
  try {
    // Sahiplik denetimi asamaAc içinde: run.userId ile oturum açılıyor.
    const run = await import("@/lib/db").then((m) =>
      m.prisma.levelRun.findUnique({ where: { id: runId }, select: { userId: true } })
    );
    if (!run || run.userId !== user.id) {
      redirect(hataAdresi(denemeYolu(runId), "deneme-yok"));
    }
    const sonuc = await asamaAc(runId, seviye as Seviye, "MAIN");
    sessionId = sonuc.sessionId;
  } catch (e) {
    if (e instanceof CheckupError) {
      redirect(hataAdresi(denemeYolu(runId), seviyeliHataKodu(e.message)));
    }
    throw e;
  }

  redirect(`/checkup/${sessionId}`);
}
