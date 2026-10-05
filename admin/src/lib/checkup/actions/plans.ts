"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import { KOC_NOTU_SINIR, kocNotunuTemizle } from "@/lib/checkup/coach-note";
import { haftaBasi } from "@/lib/checkup/shared/coaching";

/**
 * Koç notunu yaz / değiştir / kaldır (boş metin = kaldır).
 *
 * Yalnızca yönetici ve müdür: not bir öğrencinin planına yazılıyor ve plan
 * öğrencinin kişisel verisi (KVKK — öğrenci verisi MANAGE rollerinde).
 *
 * Yalnızca BU HAFTANIN planı: öğrenci uygulaması yalnızca içinde bulunulan
 * haftanın planını gösteriyor (app/lib/plan.ts aktifPlan); geçmiş haftaya
 * yazılan not hiçbir yere ulaşmaz, üstelik geçmişi değiştirir. Hafta sınırı
 * uygulamanın kendi fonksiyonundan (shared/coaching.ts haftaBasi).
 *
 * Kim yazdı: StudyPlan'da personel damgası sütunu yok (Question.updatedByStaff
 * gibi). Şemaya dokunmadan kalıcı iz tutulamıyor; en azından sunucu
 * günlüğüne "e-posta (#id)" damgasıyla yazılıyor. Kalıcı iz için app/'te
 * `StudyPlan.coachNoteByStaff` alanı gerekir.
 */
export async function setCoachNoteAction(
  planId: unknown,
  note: unknown
): Promise<{ ok: boolean; error?: string; note?: string | null }> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof planId !== "string" || !planId || planId.length > 64 || typeof note !== "string" || note.length > 5000) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const temiz = kocNotunuTemizle(note);
  if (temiz.length > KOC_NOTU_SINIR) {
    return { ok: false, error: `Not en fazla ${KOC_NOTU_SINIR} karakter olabilir (şu an ${temiz.length}).` };
  }

  const plan = await db.studyPlan.findUnique({
    where: { id: planId },
    select: { userId: true, weekStart: true },
  });
  if (!plan) return { ok: false, error: "Plan bulunamadı." };
  if (plan.weekStart.getTime() !== haftaBasi(new Date()).getTime()) {
    return {
      ok: false,
      error: "Yalnızca bu haftanın planına not yazılabilir: öğrenci geçmiş haftaların planını görmüyor.",
    };
  }

  await db.studyPlan.update({ where: { id: planId }, data: { coachNote: temiz || null } });

  // Notun kendisi günlüğe yazılmaz (öğrenciye dair içerik); yalnızca kim, hangi plan.
  console.info(
    "[checkup] koç notu " + (temiz ? "yazıldı" : "kaldırıldı") + " — plan " + planId + " · " + staffStamp(auth.staff)
  );

  revalidatePath("/checkup/ogrenciler/" + plan.userId);
  return { ok: true, note: temiz || null };
}
