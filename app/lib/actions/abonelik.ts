"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AbonelikState {
  ok?: boolean;
  kapali?: boolean;
  error?: string;
}

/**
 * Postadaki bağlantıdan: giriş gerektirmez, jeton yeter. Jeton tahmin
 * edilemez (UUID) ve yalnızca bu tercihi değiştirebilir — başka hiçbir şeyi.
 */
export async function abonelikDegistirAction(token: string, kapat: boolean): Promise<AbonelikState> {
  if (!UUID.test(token)) return { error: "Bağlantı geçersiz." };
  const sonuc = await prisma.user.updateMany({ where: { mailToken: token }, data: { mailOptOut: kapat } });
  if (sonuc.count === 0) return { error: "Bağlantı geçersiz ya da hesap silinmiş." };
  revalidatePath(`/abonelik/${token}`);
  return { ok: true, kapali: kapat };
}

/** Profil sayfasındaki kutucuk — oturum ister. */
export async function mailTercihAction(_prev: AbonelikState, formData: FormData): Promise<AbonelikState> {
  const user = await requireUser();
  const kapat = formData.get("haftalik") !== "on";
  await prisma.user.update({ where: { id: user.id }, data: { mailOptOut: kapat } });
  revalidatePath("/profil");
  return { ok: true, kapali: kapat };
}
