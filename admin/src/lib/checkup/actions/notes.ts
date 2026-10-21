"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/checkup/db";
import { CONTENT_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import { NOT_SINIRI, notuTemizle } from "@/lib/checkup/question-note";

/**
 * Soru inceleme notu: ekle, çözüldü işaretle, yeniden aç. Yalnızca içerik
 * rolleri (admin, müdür, editör); görüntüleyici okur. Not öğrenciye gitmez.
 *
 * Notun metni günlüğe yazılmaz; yalnızca kim, hangi soru.
 */

type Yanit = { ok: true } | { ok: false; error: string };

const KIMLIK = /^[a-z0-9]{6,64}$/i;

function tazele(questionId: string) {
  revalidatePath("/checkup/sorular/" + questionId);
  // Listedeki "açık not" / "bildirim" rozetleri ve süzgeçleri.
  revalidatePath("/checkup/sorular");
  // Öğrenci bildirimleri de bu tabloda: bildirim listesi ve genel bakıştaki sayı.
  revalidatePath("/checkup/bildirimler");
  revalidatePath("/checkup");
}

export async function notEkleAction(questionId: unknown, body: unknown): Promise<Yanit> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof questionId !== "string" || !KIMLIK.test(questionId) || typeof body !== "string" || body.length > NOT_SINIRI * 5) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const metin = notuTemizle(body);
  if (!metin) return { ok: false, error: "Notu yaz." };
  if (metin.length > NOT_SINIRI) {
    return { ok: false, error: `Not en fazla ${NOT_SINIRI} karakter olabilir (şu an ${metin.length}).` };
  }

  const soru = await db.question.findUnique({ where: { id: questionId }, select: { id: true } });
  if (!soru) return { ok: false, error: "Soru bulunamadı." };

  const damga = staffStamp(auth.staff);
  await db.questionNote.create({ data: { questionId, body: metin, authorStaff: damga } });
  console.info("[checkup] soru notu eklendi — soru " + questionId + " · " + damga);

  tazele(questionId);
  return { ok: true };
}

/**
 * cozuldu=true: notu kapatır (çözen ve zaman yazılır); false: yeniden açar
 * (ikisi de boşalır). Personel notu da öğrenci bildirimi de: öğrenci çözülen
 * bildirimini "incelendi" diye görür (düzeltildi de hata yok da).
 */
export async function notDurumuAction(noteId: unknown, cozuldu: unknown): Promise<Yanit> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof noteId !== "string" || !KIMLIK.test(noteId) || typeof cozuldu !== "boolean") {
    return { ok: false, error: "Geçersiz istek." };
  }

  const not = await db.questionNote.findUnique({ where: { id: noteId }, select: { questionId: true } });
  if (!not) return { ok: false, error: "Not bulunamadı." };

  const damga = staffStamp(auth.staff);
  // Koşul güncellemenin içinde: iki kişi aynı anda basarsa ilk çözen damgada kalır.
  const r = await db.questionNote.updateMany({
    where: { id: noteId, resolvedAt: cozuldu ? null : { not: null } },
    data: cozuldu ? { resolvedAt: new Date(), resolvedByStaff: damga } : { resolvedAt: null, resolvedByStaff: null },
  });
  if (r.count > 0) {
    console.info("[checkup] soru notu " + (cozuldu ? "çözüldü" : "yeniden açıldı") + " — soru " + not.questionId + " · " + damga);
  }

  tazele(not.questionId);
  return { ok: true };
}

/**
 * Bir sorunun AÇIK öğrenci bildirimlerinin hepsini çözüldü işaretler: soru
 * düzeltilince aynı hatayı bildiren on öğrenciye tek tek basılmasın.
 * Yalnızca bildirimler; personel notlarına dokunmaz.
 */
export async function bildirimleriCozAction(questionId: unknown): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof questionId !== "string" || !KIMLIK.test(questionId)) return { ok: false, error: "Geçersiz istek." };

  const damga = staffStamp(auth.staff);
  const r = await db.questionNote.updateMany({
    where: { questionId, kind: "STUDENT_REPORT", resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedByStaff: damga },
  });
  if (r.count > 0) console.info("[checkup] " + r.count + " öğrenci bildirimi çözüldü — soru " + questionId + " · " + damga);

  tazele(questionId);
  return { ok: true, count: r.count };
}
