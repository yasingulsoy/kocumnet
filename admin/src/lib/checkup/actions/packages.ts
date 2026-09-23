"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, staffForAction } from "@/lib/checkup/staff";
import { isQuestionStatus } from "@/lib/checkup/format";

type Result = { ok: boolean; error?: string };

function revalidatePackageScreens() {
  revalidatePath("/checkup");
  revalidatePath("/checkup/paketler");
  revalidatePath("/checkup/havuz");
}

/**
 * Paketin yayın durumu.
 *
 * Havuzu yetmeyen paket yayına ALINMAZ: öğrenci kataloğda görür, "Başla"ya
 * basar ve "yeterli soru yok" hatası alır — bu, hiç görmemesinden kötü.
 */
export async function setPackageStatusAction(id: string, status: string): Promise<Result> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !id || !isQuestionStatus(status)) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const paket = await db.package.findUnique({
    where: { id },
    select: {
      topics: { select: { questionCount: true, topicId: true, topic: { select: { name: true } } } },
    },
  });
  if (!paket) return { ok: false, error: "Paket bulunamadı." };

  if (status === "PUBLISHED") {
    if (paket.topics.length === 0) {
      return { ok: false, error: "Pakette konu tanımlı değil; yayına alınamaz." };
    }
    const sayimlar = await db.question.groupBy({
      by: ["topicId"],
      where: { status: "PUBLISHED", topicId: { in: paket.topics.map((t) => t.topicId) } },
      _count: { _all: true },
    });
    const var_ = new Map(sayimlar.map((s) => [s.topicId, s._count._all]));
    const eksik = paket.topics.filter((t) => (var_.get(t.topicId) ?? 0) < t.questionCount);
    if (eksik.length) {
      const ilk = eksik[0];
      return {
        ok: false,
        error:
          `Yayına alınamaz: "${ilk.topic.name}" konusunda ${var_.get(ilk.topicId) ?? 0} yayında ` +
          `soru var, paket ${ilk.questionCount} istiyor` +
          (eksik.length > 1 ? ` (ve ${eksik.length - 1} konu daha).` : "."),
      };
    }
  }

  await db.package.update({ where: { id }, data: { status } });
  revalidatePackageScreens();
  return { ok: true };
}

/**
 * Ücretsiz / ücretli. Ücretliye çevrilen pakette erişim hakkı olmayan
 * öğrenci YENİ test başlatamaz; tamamlanmış sonuçları durur.
 */
export async function setPackageFreeAction(id: string, isFree: boolean): Promise<Result> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !id || typeof isFree !== "boolean") {
    return { ok: false, error: "Geçersiz istek." };
  }

  const sonuc = await db.package.updateMany({ where: { id }, data: { isFree } });
  if (sonuc.count === 0) return { ok: false, error: "Paket bulunamadı." };

  revalidatePackageScreens();
  revalidatePath("/checkup/ogrenciler");
  return { ok: true };
}
