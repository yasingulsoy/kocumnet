"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { startTopicRetest, CheckupError } from "@/lib/checkup";
import { haftaBasi } from "@/lib/coaching";
import { examShort } from "@/lib/exams";
import { kontrolTestiSinavi, planKaynagi, planOlustur } from "@/lib/plan";
import { guvenliDonusYolu, hataAdresi, kontrolTestiHataKodu } from "@/lib/hata-kodlari";

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
 * Hata olursa dönülecek sayfa: formdaki `donus` alanı, yoksa isteğin
 * Referer'ı (yalnızca bu uygulamanınki). İkisi de bilinen bir sayfanın
 * göreli yolu değilse ana sayfa (lib/hata-kodlari.ts guvenliDonusYolu).
 * Eskiden her hata ana sayfaya atıyordu: sonuç ekranındaki "5 soruluk test"
 * düğmesine basan öğrenci, hakkı dolunca sonucunu kaybediyordu.
 */
async function donusYolu(formData: FormData): Promise<string> {
  const alan = formData.get("donus");
  if (typeof alan === "string" && alan) return guvenliDonusYolu(alan);
  const h = await headers();
  const referer = h.get("referer");
  const host = h.get("host");
  if (!referer || !host) return "/panel";
  try {
    const u = new URL(referer);
    // Başka kökenden gelen Referer'ın yolu da güvenilmez: ana sayfa.
    return u.host === host ? guvenliDonusYolu(u.pathname) : "/panel";
  } catch {
    return "/panel";
  }
}

/**
 * Konu tekrar testini başlatır ve test ekranına gönderir.
 *
 * Form action'ı olarak doğrudan kullanılıyor (useActionState gerekmiyor):
 * başarılıysa test ekranına gidiyoruz, başarısızsa öğrenci geldiği sayfaya
 * döner ve uyarıyı orada görür. Adrese hatanın metni değil KODU yazılır;
 * sayfa sabit cümleyi lib/hata-kodlari.ts'ten okur (sahte uyarı gösterilemesin).
 */
export async function konuTekrarBaslat(formData: FormData): Promise<void> {
  const user = await requireUser();
  const topicId = String(formData.get("topicId") ?? "");
  if (!topicId) redirect(hataAdresi(await donusYolu(formData), "konu-secilmedi"));

  // Plandaki iş planın sınavıyla, değilse güncel hedefle (lib/plan.ts).
  const sinav = await kontrolTestiSinavi(user.id, topicId, new Date(), user.targetExam);
  if (!sinav) redirect("/tanisma");

  let sessionId: string;
  try {
    sessionId = await startTopicRetest(user.id, topicId, sinav);
  } catch (e) {
    if (e instanceof CheckupError) {
      redirect(hataAdresi(await donusYolu(formData), kontrolTestiHataKodu(e.message)));
    }
    throw e;
  }

  // redirect() try/catch DIŞINDA.
  redirect(`/checkup/${sessionId}`);
}

/**
 * Planı olmayan öğrenci için bu haftanın planını son sonuçtan üretir.
 * (Normalde plan test bitince otomatik oluşuyor; bu, eski sonuçları olan
 * öğrencilerin de plan görebilmesi için.) "Son sonuç" kuralı planKaynagi'nde
 * (lib/plan.ts): paket testi, işaretli, hedef sınavdan.
 */
export async function planYenidenUretAction(): Promise<{
  ok: boolean;
  error?: string;
  /** ZAYIF_YOK: plan gerekmiyor — ekran hata değil "gerek yok" gösterir. */
  kod?: "SONUC_YOK" | "ZAYIF_YOK";
}> {
  const user = await requireUser();
  const now = new Date();

  const mevcut = await prisma.studyPlan.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart: haftaBasi(now) } },
    select: { id: true },
  });
  if (mevcut) return { ok: true };

  const hedef = user.targetExam;
  const kaynak = await planKaynagi(user.id, hedef);
  if (!kaynak) {
    return {
      ok: false,
      error: hedef
        ? `Plan için önce bir ${examShort(hedef)} check-up'ı çözmen gerekiyor.`
        : "Plan için önce bir check-up çözmen gerekiyor.",
      kod: "SONUC_YOK",
    };
  }

  const sonuc = await planOlustur({ userId: user.id, ...kaynak, now });

  revalidatePath("/panel");
  return sonuc.planId
    ? { ok: true }
    : { ok: false, error: "Kanıtlı zayıf konu bulunamadı.", kod: "ZAYIF_YOK" };
}
