import type { Baglam } from "../http/baglam.js";
import { jetonOzeti, jetonUret } from "../lib/jeton.js";

export const OGRENCI_OTURUM_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün
export const YONETICI_OTURUM_MS = 12 * 60 * 60 * 1000; // 12 saat

/**
 * Yeni oturum açar. Jetonun kendisi yalnızca bu yanıtta döner; veritabanında
 * SHA-256 özeti saklanır. Aynı kişinin süresi dolmuş oturumları da silinir.
 */
export async function oturumAc(b: Baglam, sahip: { ogrenciId: number } | { yoneticiId: number }): Promise<{ jeton: string; bitis: Date }> {
  const simdi = b.saat.simdi();
  const ogrenci = "ogrenciId" in sahip;
  const bitis = new Date(simdi.getTime() + (ogrenci ? OGRENCI_OTURUM_MS : YONETICI_OTURUM_MS));
  const jeton = jetonUret();
  await b.db.oturum.deleteMany({ where: { ...sahip, bitis: { lte: simdi } } });
  await b.db.oturum.create({ data: { jetonHash: jetonOzeti(jeton), bitis, ...sahip } });
  return { jeton, bitis };
}

/** Çıkış: jeton verildiyse ve bu türdeyse oturumu siler. Jeton yoksa da başarılı sayılır. */
export async function oturumKapat(b: Baglam, yetkilendirme: string | undefined, tur: "ogrenci" | "yonetici"): Promise<void> {
  const m = /^Bearer\s+(\S+)$/i.exec((yetkilendirme ?? "").trim());
  if (!m) return;
  await b.db.oturum.deleteMany({
    where: { jetonHash: jetonOzeti(m[1]!), ...(tur === "ogrenci" ? { ogrenciId: { not: null } } : { yoneticiId: { not: null } }) },
  });
}
