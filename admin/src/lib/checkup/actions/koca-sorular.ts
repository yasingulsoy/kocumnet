"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/checkup/db";
import { CONTENT_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import { CEVAP_SINIRI, cevabiTemizle } from "@/lib/checkup/koca-soru";

/**
 * "Koça sor" gelen kutusu — cevapla, düzelt, kapat, geri aç. Soru içeriğini
 * yazabilen roller (admin, müdür, editör); görüntüleyici sayfayı açamaz.
 * Kurallar lib/checkup/koca-soru.ts'te.
 *
 * Günlüğe cevabın metni yazılmaz (öğrenciye dair içerik); yalnızca kim, hangi soru.
 * Koşullar güncellemenin İÇİNDE (updateMany where): iki koç aynı anda
 * basarsa biri ötekinin cevabını sessizce ezmesin.
 */

type Yanit = { ok: true } | { ok: false; error: string };

const KIMLIK = /^[a-z0-9]{6,64}$/i;

function tazele() {
  revalidatePath("/checkup/koca-sorular");
  // Genel bakıştaki "bekleyen soru" kutusu.
  revalidatePath("/checkup");
}

/**
 * Cevapla (duzeltme=false) ya da cevabı düzelt (true). Her ikisinde de
 * öğrencinin okundu işareti sıfırlanır: düzeltilen cevap "yeni" görünsün.
 */
export async function kocaCevapAction(id: unknown, metin: unknown, duzeltme: unknown): Promise<Yanit> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (
    typeof id !== "string" ||
    !KIMLIK.test(id) ||
    typeof metin !== "string" ||
    metin.length > CEVAP_SINIRI * 5 ||
    typeof duzeltme !== "boolean"
  ) {
    return { ok: false, error: "Geçersiz istek." };
  }

  const temiz = cevabiTemizle(metin);
  if (!temiz) return { ok: false, error: "Cevabı yaz." };
  if (temiz.length > CEVAP_SINIRI) {
    return { ok: false, error: `Cevap en fazla ${CEVAP_SINIRI} karakter olabilir (şu an ${temiz.length}).` };
  }

  const soru = await db.coachQuestion.findUnique({ where: { id }, select: { answeredAt: true, closedAt: true } });
  if (!soru) return { ok: false, error: "Soru bulunamadı." };
  if (soru.closedAt) return { ok: false, error: "Bu soru kapatılmış; cevaplamak için önce geri aç." };
  if (!duzeltme && soru.answeredAt) {
    return { ok: false, error: "Bu soruyu az önce başka biri cevapladı. Sayfayı yenileyip cevabı gör; gerekirse düzelt." };
  }

  const damga = staffStamp(auth.staff);
  const r = await db.coachQuestion.updateMany({
    where: duzeltme ? { id, closedAt: null } : { id, answeredAt: null, closedAt: null },
    data: { answerBody: temiz, answeredAt: new Date(), answeredByStaff: damga, readAt: null },
  });
  if (r.count === 0) return { ok: false, error: "Soru bu arada değişti; sayfayı yenile." };

  console.info("[checkup] koça soru " + (duzeltme ? "cevabı düzeltildi" : "cevaplandı") + " — " + id + " · " + damga);
  tazele();
  return { ok: true };
}

/** Cevapsız kapat (yinelenen, konu dışı). Cevaplanmış soru kapatılmaz. */
export async function kocaSoruKapatAction(id: unknown): Promise<Yanit> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !KIMLIK.test(id)) return { ok: false, error: "Geçersiz istek." };

  const damga = staffStamp(auth.staff);
  const r = await db.coachQuestion.updateMany({
    where: { id, answeredAt: null, closedAt: null },
    data: { closedAt: new Date(), closedByStaff: damga },
  });
  if (r.count === 0) {
    const soru = await db.coachQuestion.findUnique({ where: { id }, select: { answeredAt: true, closedAt: true } });
    if (!soru) return { ok: false, error: "Soru bulunamadı." };
    if (soru.answeredAt && !soru.closedAt) return { ok: false, error: "Cevaplanmış soru kapatılmaz." };
    // Zaten kapalı: ilk kapatanın damgası kalır.
    tazele();
    return { ok: true };
  }
  console.info("[checkup] koça soru kapatıldı — " + id + " · " + damga);
  tazele();
  return { ok: true };
}

/** Kapatılan soruyu yeniden "bekleyen"e al. */
export async function kocaSoruGeriAcAction(id: unknown): Promise<Yanit> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !KIMLIK.test(id)) return { ok: false, error: "Geçersiz istek." };

  const r = await db.coachQuestion.updateMany({
    where: { id, closedAt: { not: null } },
    data: { closedAt: null, closedByStaff: null },
  });
  if (r.count === 0 && !(await db.coachQuestion.findUnique({ where: { id }, select: { id: true } }))) {
    return { ok: false, error: "Soru bulunamadı." };
  }
  if (r.count > 0) console.info("[checkup] koça soru geri açıldı — " + id + " · " + staffStamp(auth.staff));
  tazele();
  return { ok: true };
}
