/*
 * Grafik ekseni için kısa tarihler (sunucuda da istemcide de çalışır).
 * Saat dilimi Türkiye: sunucu UTC'de, gece 00:00-03:00 testleri bir önceki
 * güne yazılmasın.
 */
const gun = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });
const saat = (d: Date) =>
  d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

export interface GrafikTarihi {
  /** Eksendeki satırlar, alt alta (ApexCharts dizi etiketi). */
  eksen: string[];
  /** Tek satır, tam: görünmez veri tablosu için. */
  tam: string;
}

/**
 * Tarihler eskiden yeniye sıralı verilir. Gün başına tek test: ["10 Eki"].
 * Aynı gün birden çok test: o günün ilk testi ["10 Eki", "09:05"], sonrakiler
 * yalnızca saat ["", "14:20"] — gruplu eksen gibi, gün bir kez yazılır.
 *
 * Neden: saat aynı satırda ("10 Eki 14:05") telefonda sütuna sığmıyor,
 * kesiliyordu; her etikette gün tekrar edince de etiketler birbirine
 * değiyor, bazıları gizleniyordu. Kısa satırlar sekiz sütuna da sığar.
 */
export function grafikTarihleri(tarihler: Date[]): GrafikTarihi[] {
  const sayac = new Map<string, number>();
  for (const d of tarihler) sayac.set(gun(d), (sayac.get(gun(d)) ?? 0) + 1);
  let oncekiGun = "";
  return tarihler.map((d) => {
    const g = gun(d);
    const ayniGunIlk = g !== oncekiGun;
    oncekiGun = g;
    if ((sayac.get(g) ?? 0) < 2) return { eksen: [g], tam: g };
    const s = saat(d);
    return { eksen: [ayniGunIlk ? g : "", s], tam: `${g} ${s}` };
  });
}
