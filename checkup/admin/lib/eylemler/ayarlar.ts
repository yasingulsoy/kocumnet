"use server";

import { cagir, gecersiz, kimlik } from "../eylem";
import type { AyarGovdesi, CheckupAyari, IslemSonucu } from "../tipler";

/**
 * Check-up ayarı (reçete ya da sabit liste) kaydı. Eksik ayar da kaydedilir;
 * backend dönen nesnede `hazirlik`ı hesaplar. Ekran durumunu dönen nesneyle
 * değiştirir, sayfayı yenilemez (öteki türlerin kaydedilmemiş değişiklikleri
 * kaybolmasın).
 */
export async function ayarKaydet(sinavId: number, turId: number, g: AyarGovdesi): Promise<IslemSonucu<CheckupAyari>> {
  const s = kimlik(sinavId);
  const t = kimlik(turId);
  if (!s || !t || (g?.secim !== "KARMA" && g?.secim !== "SABIT")) return gecersiz();
  if (!Array.isArray(g.recete) || !Array.isArray(g.sabitSoruIdleri)) return gecersiz();

  const recete: AyarGovdesi["recete"] = [];
  for (const r of g.recete.slice(0, 1000)) {
    const konuId = kimlik(r?.konuId);
    const kazanimId = kimlik(r?.kazanimId);
    const soruSayisi = Number(r?.soruSayisi);
    if ((konuId ? 1 : 0) + (kazanimId ? 1 : 0) !== 1 || !Number.isInteger(soruSayisi)) return gecersiz("Reçete satırı geçersiz.");
    recete.push(konuId ? { konuId, soruSayisi } : { kazanimId: kazanimId!, soruSayisi });
  }
  const sabitSoruIdleri: number[] = [];
  for (const id of g.sabitSoruIdleri.slice(0, 1000)) {
    const k = kimlik(id);
    if (!k) return gecersiz("Sabit listede geçersiz soru var.");
    sabitSoruIdleri.push(k);
  }

  return cagir<CheckupAyari>(`/admin/sinavlar/${s}/ayarlar/${t}`, {
    method: "PUT",
    govde: { secim: g.secim, recete, sabitSoruIdleri },
  });
}
