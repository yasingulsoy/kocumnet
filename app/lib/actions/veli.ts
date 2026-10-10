"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/mailer";
import { sinirAsildi } from "@/lib/rate-limit";
import { veliSuresiMi } from "@/lib/veli";
import { veliBaglantisiOlustur, veliBaglantisiniKaldir } from "@/lib/veli-raporu";

/*
 * Profildeki "Veli bağlantısı" kartının eylemleri. Sabitler ve kurallar
 * lib/veli.ts'te: "use server" dosyası yalnızca async fonksiyon ihraç eder.
 */

export interface VeliOlusturSonucu {
  id?: string;
  /** Tam adres; yalnızca bu yanıtta var (jeton saklanmaz). */
  link?: string;
  expiresAt?: Date;
  error?: string;
}

export async function veliBaglantisiOlusturAction(gun: unknown): Promise<VeliOlusturSonucu> {
  const user = await requireUser();
  if (!veliSuresiMi(gun)) return { error: "Bağlantının ne kadar açık kalacağını seç." };
  // Oluştur-kaldır döngüsüyle satır üretilmesin.
  if (await sinirAsildi("veli-olustur:" + user.id, 10, 60 * 60_000)) {
    return { error: "Kısa sürede çok fazla bağlantı oluşturdun. Bir saat sonra tekrar dene." };
  }
  try {
    const b = await veliBaglantisiOlustur(user.id, gun);
    revalidatePath("/profil");
    return { id: b.id, link: `${appUrl()}/veli/${b.jeton}`, expiresAt: b.expiresAt };
  } catch (e) {
    // Sınır hatası öğrenciye gösterilir; başkası günlüğe düşsün.
    if (e instanceof Error && e.name === "VeliHatasi") return { error: e.message };
    throw e;
  }
}

export async function veliBaglantisiKaldirAction(id: unknown): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  if (typeof id !== "string" || !/^[a-z0-9]{6,64}$/i.test(id)) return { error: "Geçersiz istek." };
  const kaldirildi = await veliBaglantisiniKaldir(user.id, id);
  revalidatePath("/profil");
  return kaldirildi ? { ok: true } : { error: "Bağlantı bulunamadı ya da zaten kapalı." };
}
