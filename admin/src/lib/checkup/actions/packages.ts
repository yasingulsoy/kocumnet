"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, staffForAction } from "@/lib/checkup/staff";
import { isQuestionStatus } from "@/lib/checkup/format";
import { loadPackageHealth } from "@/lib/checkup/pool";

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
 *
 * Denetim paketin TÜRÜNE göre (lib/checkup/pool.ts): katalog paketinde konu
 * dağılımı, konu tekrar testinde kontrol testine yeten konu, seviyeli
 * pakette seviye hazırlığı. Eskiden her pakete konu dağılımı soruluyordu;
 * dağılımı olmayan tekrar testi ve seviyeli paketler bir kez taslağa
 * çekilince panelden bir daha yayına alınamıyordu.
 */
export async function setPackageStatusAction(id: string, status: string): Promise<Result> {
  const auth = await staffForAction(MANAGE_ROLES);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (typeof id !== "string" || !id || !isQuestionStatus(status)) {
    return { ok: false, error: "Geçersiz istek." };
  }

  if (status === "PUBLISHED") {
    const paket = (await loadPackageHealth()).find((p) => p.id === id);
    if (!paket) return { ok: false, error: "Paket bulunamadı." };
    if (paket.state === "blocked") {
      return { ok: false, error: "Yayına alınamaz: " + paket.summary };
    }
  }

  const sonuc = await db.package.updateMany({ where: { id }, data: { status } });
  if (sonuc.count === 0) return { ok: false, error: "Paket bulunamadı." };

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
