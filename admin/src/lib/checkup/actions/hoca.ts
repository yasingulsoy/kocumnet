"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/checkup/generated/client";
import { db } from "@/lib/checkup/db";
import { CONTENT_ROLES, MANAGE_ROLES, staffForAction, staffStamp } from "@/lib/checkup/staff";
import { UYGULAMA_NOTU_SINIRI, cevapDogrula, cevapEsitMi, metniTemizle, soruBul } from "@/lib/checkup/hoca/cevap";
import type { CevapDegeri } from "@/lib/checkup/hoca/tipler";
import { HOCA_BOLUMLERI } from "@/lib/checkup/hoca/sorular";

/**
 * "Hocaya sorular" — cevap kaydet, temizle, "uygulandı" işaretle / geri al.
 *
 * Yetki: cevap yazma ve temizleme içerik rollerinde (admin, müdür, editör;
 * hoca editör hesabıyla girer); "uygulandı" işareti yönetimde (admin, müdür).
 * Okuma sayfada, bütün personel. Kurallar lib/checkup/hoca/cevap.ts'te.
 *
 * Aynı anda iki kişi kaydederse sonuncusu yazar (yeterli). Cevap (değer ya da
 * not) DEĞİŞİRSE "uygulandı" alanları boşalır: yeniden uygulanması gerekir.
 * "Uygulandı" işareti, işaretleyenin gördüğü cevaba (answeredAt) bağlı: bu
 * arada hoca cevabı değiştirdiyse işaret konmaz.
 *
 * Günlüğe cevabın kendisi yazılmaz; yalnızca kim, hangi soru.
 */

type Yanit = { ok: true } | { ok: false; error: string };

export type HocaKayitYaniti =
  | {
      ok: true;
      /** Kaydedilen (normalize edilmiş) cevap; ekran formunu buna eşitler. */
      deger: CevapDegeri | null;
      not: string | null;
      /** Cevap öncekinin aynısıydı: hiçbir şey yazılmadı. */
      degismedi: boolean;
      /** Cevap boştu: kayıt silindi, soru "bekliyor"a döndü. */
      silindi: boolean;
    }
  | { ok: false; error: string };

function tazele() {
  revalidatePath("/checkup/hoca");
  // Genel bakıştaki "Hocaya sorular" kutusu.
  revalidatePath("/checkup");
}

/** Soru listesinde olan anahtar; yoksa null. */
function soruAnahtari(anahtar: unknown) {
  if (typeof anahtar !== "string" || anahtar.length === 0 || anahtar.length > 200) return null;
  return soruBul(HOCA_BOLUMLERI, anahtar);
}

const benzersizIhlali = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2002";

export async function hocaCevapKaydetAction(anahtar: unknown, girdi: unknown): Promise<HocaKayitYaniti> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const konum = soruAnahtari(anahtar);
  if (!konum) return { ok: false, error: "Bu soru listede yok; sayfayı yenileyin." };
  const key = konum.soru.anahtar;

  const d = cevapDogrula(konum.soru, girdi);
  if (!d.ok) return { ok: false, error: d.hata };

  const damga = staffStamp(auth.staff);

  if (d.bos) {
    // Hiç cevap yok: kayıt tutulmaz, soru "bekliyor"a döner.
    const r = await db.teacherAnswer.deleteMany({ where: { questionKey: key } });
    if (r.count > 0) {
      console.info("[checkup] hocaya soru cevabı boş kaydedildi, silindi — " + key + " · " + damga);
      tazele();
    }
    return { ok: true, deger: null, not: null, degismedi: r.count === 0, silindi: true };
  }

  const mevcut = await db.teacherAnswer.findUnique({ where: { questionKey: key }, select: { value: true, note: true } });
  if (mevcut && cevapEsitMi({ deger: mevcut.value, not: mevcut.note }, d)) {
    // Aynı cevap: kim/ne zaman ve "uygulandı" işareti olduğu gibi kalır.
    return { ok: true, deger: d.deger, not: d.not, degismedi: true, silindi: false };
  }

  const veri = {
    value: d.deger === null ? Prisma.DbNull : (d.deger as unknown as Prisma.InputJsonValue),
    note: d.not,
    answeredByStaff: damga,
    answeredAt: new Date(),
    // Cevap değişti: önceki "uygulandı" artık bu cevap için geçerli değil.
    appliedAt: null,
    appliedByStaff: null,
    appliedNote: null,
  };
  const yaz = () => db.teacherAnswer.upsert({ where: { questionKey: key }, create: { questionKey: key, ...veri }, update: veri });
  try {
    await yaz();
  } catch (e) {
    // İki kişi aynı anda İLK cevabı yazıyorsa biri benzersizlik hatası alabilir: sonuncusu yazsın.
    if (!benzersizIhlali(e)) throw e;
    await yaz();
  }

  console.info("[checkup] hocaya soru cevaplandı — " + key + " · " + damga);
  tazele();
  return { ok: true, deger: d.deger, not: d.not, degismedi: false, silindi: false };
}

/** Cevabı sil: soru "bekliyor"a döner (uygulandı işareti de gider). */
export async function hocaCevapTemizleAction(anahtar: unknown): Promise<Yanit> {
  const auth = await staffForAction(CONTENT_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const konum = soruAnahtari(anahtar);
  if (!konum) return { ok: false, error: "Bu soru listede yok; sayfayı yenileyin." };

  const r = await db.teacherAnswer.deleteMany({ where: { questionKey: konum.soru.anahtar } });
  if (r.count > 0) console.info("[checkup] hocaya soru cevabı silindi — " + konum.soru.anahtar + " · " + staffStamp(auth.staff));
  tazele();
  return { ok: true };
}

/**
 * "Uygulandı" işareti: cevap sisteme işlendi. `surum`, işaretleyenin ekranda
 * gördüğü cevabın zamanı (answeredAt, ISO); cevap bu arada değiştiyse işaret
 * konmaz. Zaten işaretliyse not ve zaman yenilenir.
 */
export async function hocaUygulandiAction(anahtar: unknown, surum: unknown, not: unknown): Promise<Yanit> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const konum = soruAnahtari(anahtar);
  if (!konum) return { ok: false, error: "Bu soru listede yok; sayfayı yenileyin." };
  const key = konum.soru.anahtar;

  const zaman = typeof surum === "string" && surum.length <= 40 ? new Date(surum) : null;
  if (!zaman || Number.isNaN(zaman.getTime())) return { ok: false, error: "Geçersiz istek." };
  if (not !== null && not !== undefined && (typeof not !== "string" || not.length > UYGULAMA_NOTU_SINIRI * 5)) {
    return { ok: false, error: "Geçersiz not." };
  }
  const temiz = typeof not === "string" ? metniTemizle(not) : "";
  if (temiz.length > UYGULAMA_NOTU_SINIRI) {
    return { ok: false, error: `Not en fazla ${UYGULAMA_NOTU_SINIRI} karakter olabilir (şu an ${temiz.length}).` };
  }

  const damga = staffStamp(auth.staff);
  const r = await db.teacherAnswer.updateMany({
    where: { questionKey: key, answeredAt: zaman },
    data: { appliedAt: new Date(), appliedByStaff: damga, appliedNote: temiz || null },
  });
  if (r.count === 0) {
    const kayit = await db.teacherAnswer.findUnique({ where: { questionKey: key }, select: { id: true } });
    return {
      ok: false,
      error: kayit
        ? "Cevap bu arada değişti. Sayfayı yenileyip yeni cevaba bakın, sonra işaretleyin."
        : "Bu sorunun cevabı yok; uygulanacak bir şey yok.",
    };
  }
  console.info("[checkup] hocaya soru uygulandı işaretlendi — " + key + " · " + damga);
  tazele();
  return { ok: true };
}

/** "Uygulandı" işaretini kaldır (yanlışlıkla işaretlendiyse). */
export async function hocaUygulandiGeriAlAction(anahtar: unknown): Promise<Yanit> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  const konum = soruAnahtari(anahtar);
  if (!konum) return { ok: false, error: "Bu soru listede yok; sayfayı yenileyin." };
  const key = konum.soru.anahtar;

  const r = await db.teacherAnswer.updateMany({
    where: { questionKey: key, appliedAt: { not: null } },
    data: { appliedAt: null, appliedByStaff: null, appliedNote: null },
  });
  if (r.count === 0 && !(await db.teacherAnswer.findUnique({ where: { questionKey: key }, select: { id: true } }))) {
    return { ok: false, error: "Bu sorunun cevabı yok." };
  }
  if (r.count > 0) console.info("[checkup] hocaya soru uygulandı işareti kaldırıldı — " + key + " · " + staffStamp(auth.staff));
  tazele();
  return { ok: true };
}
