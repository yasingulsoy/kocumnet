"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { startTopicRetest, CheckupError } from "@/lib/checkup";
import { haftaBasi } from "@/lib/coaching";

/**
 * Plandaki bir işi işaretler / işareti kaldırır.
 *
 * ⚠️ RETEST işleri BURADAN kapanmaz. Onların tek kapanma yolu testi
 * gerçekten çözmek — planın dürüstlüğü buna dayanıyor.
 */
export async function planIsiAction(
  itemId: string,
  done: boolean
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const item = await prisma.planItem.findFirst({
    where: { id: itemId, plan: { userId: user.id } },
    select: { id: true, kind: true },
  });
  if (!item) return { ok: false, error: "İş bulunamadı." };

  if (item.kind === "RETEST") {
    return {
      ok: false,
      error: "Kontrol testi elle işaretlenemez — testi çözmen gerekiyor.",
    };
  }

  await prisma.planItem.update({
    where: { id: item.id },
    data: { doneAt: done ? new Date() : null },
  });

  revalidatePath("/panel");
  return { ok: true };
}

/** Plandan bir işi çıkarır — koç da öğrencinin itirazını dinler. */
export async function planIsiSilAction(itemId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const item = await prisma.planItem.findFirst({
    where: { id: itemId, plan: { userId: user.id } },
    select: { id: true, planId: true },
  });
  if (!item) return { ok: false, error: "İş bulunamadı." };

  await prisma.planItem.delete({ where: { id: item.id } });

  revalidatePath("/panel");
  return { ok: true };
}

/**
 * Konu tekrar testini başlatır ve test ekranına gönderir.
 *
 * Form action'ı olarak doğrudan kullanılıyor (useActionState gerekmiyor):
 * başarılıysa zaten test ekranına gidiyoruz, başarısızsa kullanıcı plan
 * sayfasında uyarıyı görüyor.
 */
export async function konuTekrarBaslat(formData: FormData): Promise<void> {
  const user = await requireUser();
  const topicId = String(formData.get("topicId") ?? "");
  if (!topicId) redirect("/panel?hata=konu-secilmedi");
  if (!user.targetExam) redirect("/tanisma");

  let sessionId: string;
  try {
    sessionId = await startTopicRetest(user.id, topicId, user.targetExam);
  } catch (e) {
    if (e instanceof CheckupError) {
      redirect("/panel?hata=" + encodeURIComponent(e.message));
    }
    throw e;
  }

  // redirect() try/catch DIŞINDA.
  redirect(`/checkup/${sessionId}`);
}

/**
 * Planı olmayan öğrenci için bu haftanın planını son sonuçtan üretir.
 * (Normalde plan test bitince otomatik oluşuyor; bu, eski sonuçları olan
 * öğrencilerin de plan görebilmesi için.)
 */
export async function planYenidenUretAction(): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const now = new Date();

  const mevcut = await prisma.studyPlan.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart: haftaBasi(now) } },
    select: { id: true },
  });
  if (mevcut) return { ok: true };

  const son = await prisma.checkupSession.findFirst({
    where: { userId: user.id, status: "SUBMITTED", result: { isNot: null } },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      package: { select: { examScope: true } },
      result: { select: { topicBreakdown: true } },
    },
  });
  if (!son?.result) {
    return { ok: false, error: "Plan için önce bir check-up çözmen gerekiyor." };
  }

  const { planOlustur } = await import("@/lib/plan");
  const sonuc = await planOlustur({
    userId: user.id,
    sessionId: son.id,
    examScope: son.package.examScope,
    breakdown: son.result.topicBreakdown as never,
    now,
  });

  revalidatePath("/panel");
  return sonuc.planId ? { ok: true } : { ok: false, error: "Kanıtlı zayıf konu bulunamadı." };
}
