"use server";

import { redirect } from "next/navigation";
import { api, girisAdresi, guvenliYol } from "../backend";
import { cagir, metin } from "../eylem";
import { oturumSil, oturumYaz } from "../oturum";
import type { IslemSonucu, Yonetici } from "../tipler";

/**
 * Giriş: backend jeton verir, httpOnly çereze yazılır. Başarıda yönlendirir
 * (dönüş değeri yalnızca hata için). Form durumu istemcide tutulur; bu eylem
 * form action olarak değil elle çağrılır (React form sıfırlaması e-postayı
 * silmesin).
 */
export async function girisYap(eposta: unknown, parola: unknown, sonraki: unknown): Promise<IslemSonucu> {
  const e = metin(eposta, 320).trim();
  const p = metin(parola, 1000);
  if (!e || !p) return { ok: false, kod: "DOGRULAMA", mesaj: "E-posta ve parolayı yazın." };

  const s = await api<{ jeton: string; bitis: string; yonetici: Yonetici }>("/admin/giris", {
    method: "POST",
    govde: { eposta: e, parola: p },
    oturum: false,
    oturumYoksa: "dondur",
  });
  if (!s.ok) {
    // Yanlış e-posta/parola: 400 DOGRULAMA "E-posta ya da parola yanlış." (API.md).
    // Giriş ucunda OTURUM_YOK çerez silme/yönlendirme tetiklemez (oturumYoksa: "dondur").
    const h = s.hata;
    return { ok: false, kod: h.kod, mesaj: h.mesaj, alanlar: h.alanlar };
  }
  if (!s.veri?.jeton) return { ok: false, kod: "SUNUCU", mesaj: "Sunucudan beklenmeyen yanıt geldi." };

  await oturumYaz(s.veri.jeton, s.veri.bitis);
  redirect(guvenliYol(sonraki) ?? "/");
}

export async function cikisYap(): Promise<void> {
  // Backend'deki oturumu da kapat; ulaşılamasa bile çerez silinir.
  await api("/admin/cikis", { method: "POST", oturumYoksa: "dondur" });
  await oturumSil();
  redirect(girisAdresi(null, "cikis"));
}

export async function parolaDegistir(mevcutParola: unknown, yeniParola: unknown): Promise<IslemSonucu> {
  // Yanlış mevcut parola: 400 DOGRULAMA, alanlar.mevcutParola (formda alanın altında).
  // Bu uçta OTURUM_YOK da kullanıcıyı dışarı atmaz; mesaj formda gösterilir.
  return cagir("/admin/ben/parola", {
    method: "PUT",
    govde: { mevcutParola: metin(mevcutParola, 1000), yeniParola: metin(yeniParola, 1000) },
    oturumYoksa: "dondur",
  });
}
