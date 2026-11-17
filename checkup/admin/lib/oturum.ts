import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { OTURUM_CEREZI, OTURUM_SURESI_SN, api, oturumuSonlandir } from "./backend";
import type { Rol, Yonetici } from "./tipler";

/**
 * Oturum: backend'in verdiği jeton bu alan adında httpOnly çerezde
 * (`yonetici_oturum`, 12 saat). Doğrulama her istekte backend'e sorulur
 * (GET /api/admin/ben): pasif yapılan ya da rolü değişen yönetici beklemeden
 * etkilenir. React `cache`: düzen ve sayfa ayrı ayrı sorsa da istek başına
 * tek çağrı.
 */

export type OturumDurumu =
  | { tur: "var"; yonetici: Yonetici }
  | { tur: "yok"; cerezVardi: boolean }
  | { tur: "ulasilamadi"; mesaj: string };

export const oturumDurumu = cache(async (): Promise<OturumDurumu> => {
  const jeton = (await cookies()).get(OTURUM_CEREZI)?.value;
  if (!jeton) return { tur: "yok", cerezVardi: false };

  const s = await api<{ yonetici: Yonetici }>("/admin/ben", { oturumYoksa: "dondur" });
  if (s.ok) {
    const y = s.veri?.yonetici;
    // Hata kapalı: beklenen biçimde olmayan yanıt "oturum yok" sayılır.
    if (!y || (y.rol !== "YONETICI" && y.rol !== "EDITOR") || y.aktif === false) return { tur: "yok", cerezVardi: true };
    return { tur: "var", yonetici: y };
  }
  if (s.hata.kod === "OTURUM_YOK") return { tur: "yok", cerezVardi: true };
  return { tur: "ulasilamadi", mesaj: s.hata.mesaj };
});

/**
 * Sayfalar için: oturum yoksa girişe yönlendirir; varsa yöneticiyi ve rol
 * izni sonucunu döndürür. Rol yetmezse sayfa "yetkiniz yok" kutusu çizer.
 *
 * Düzendeki denetim YETMEZ: istemci içi gezinmede düzen yeniden çizilmez,
 * yalnızca sayfa çizilir. Her sayfa bunu çağırır; `cache` sayesinde bedava.
 */
export async function yoneticiGerekli(rol?: Rol): Promise<{ yonetici: Yonetici; yetkili: boolean }> {
  const d = await oturumDurumu();
  if (d.tur === "yok") return oturumuSonlandir();
  if (d.tur === "ulasilamadi") throw new Error(d.mesaj);
  return { yonetici: d.yonetici, yetkili: !rol || d.yonetici.rol === rol };
}

/** Giriş sonrası çerezi yazar (yalnızca server action / route handler). */
export async function oturumYaz(jeton: string, bitis?: string) {
  const bitisTarihi = bitis ? new Date(bitis) : null;
  const sn =
    bitisTarihi && !Number.isNaN(bitisTarihi.getTime())
      ? Math.max(60, Math.min(OTURUM_SURESI_SN, Math.floor((bitisTarihi.getTime() - Date.now()) / 1000)))
      : OTURUM_SURESI_SN;
  (await cookies()).set(OTURUM_CEREZI, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sn,
  });
}

export async function oturumSil() {
  (await cookies()).delete(OTURUM_CEREZI);
}
