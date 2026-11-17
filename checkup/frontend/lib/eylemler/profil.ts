"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@/lib/backend";
import { OTURUM_CEREZI } from "@/lib/cerezler";
import type { FormDurumu, Ogrenci } from "@/lib/tipler";

/*
 * Profil eylemleri. Her biri oturumu backend'de yeniden doğrular (jeton
 * çerezden gider); oturum düştüyse api() girişe yönlendirir.
 * "use server": yalnızca async fonksiyon ihraç edilir.
 */

function deger(form: FormData, ad: string): string {
  const d = form.get(ad);
  return typeof d === "string" ? d : "";
}

export async function adSoyadGuncelle(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const adSoyad = deger(form, "adSoyad").trim();
  if (adSoyad.length < 2 || adSoyad.length > 80) {
    return { alanlar: { adSoyad: "Ad soyad 2 ile 80 karakter arasında olmalı." } };
  }
  const sonuc = await api<{ ogrenci: Ogrenci }>("/ogrenci/ben", { method: "PATCH", govde: { adSoyad } });
  if (!sonuc.ok) return { hata: sonuc.hata.mesaj, alanlar: sonuc.hata.alanlar };
  // Üst çubuk ve panel selamı yeni adı göstersin.
  refresh();
  return { basari: "Adın güncellendi." };
}

export async function parolaDegistir(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const mevcutParola = deger(form, "mevcutParola");
  const yeniParola = deger(form, "yeniParola");
  const tekrar = deger(form, "yeniParolaTekrar");

  const alanlar: Record<string, string> = {};
  if (!mevcutParola) alanlar.mevcutParola = "Şu anki parolanı yaz.";
  if (yeniParola.length < 8) alanlar.yeniParola = "Yeni parola en az 8 karakter olmalı.";
  else if (yeniParola !== tekrar) alanlar.yeniParolaTekrar = "İki parola aynı değil.";
  if (Object.keys(alanlar).length) return { hata: "Lütfen işaretli alanları düzelt.", alanlar };

  const sonuc = await api("/ogrenci/ben/parola", { method: "PUT", govde: { mevcutParola, yeniParola } });
  if (!sonuc.ok) return { hata: sonuc.hata.mesaj, alanlar: sonuc.hata.alanlar };
  return { basari: "Parolan değişti. Başka cihazlardaki oturumların kapatıldı." };
}

export async function hesabiSil(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const parola = deger(form, "parola");
  if (!parola) return { alanlar: { parola: "Hesabını silmek için parolanı yaz." } };

  const sonuc = await api("/ogrenci/ben", { method: "DELETE", govde: { parola } });
  if (!sonuc.ok) return { hata: sonuc.hata.mesaj, alanlar: sonuc.hata.alanlar };

  (await cookies()).delete(OTURUM_CEREZI);
  redirect("/?hesap=silindi");
}
