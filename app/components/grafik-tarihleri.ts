/*
 * Grafik ekseni için kısa tarihler (sunucuda da istemcide de çalışır).
 * Saat dilimi Türkiye: sunucu UTC'de, gece 00:00-03:00 testleri bir önceki
 * güne yazılmasın.
 */
const gun = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });
const saat = (d: Date) =>
  d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

/**
 * "10 Eki"; aynı gün birden çok test varsa saatle ("10 Eki 14:05") — yoksa
 * eksende yan yana üç "10 Eki" çıkıyor ve hangisinin hangisi olduğu
 * anlaşılmıyordu.
 */
export function grafikTarihleri(tarihler: Date[]): string[] {
  const sayac = new Map<string, number>();
  for (const d of tarihler) sayac.set(gun(d), (sayac.get(gun(d)) ?? 0) + 1);
  return tarihler.map((d) => ((sayac.get(gun(d)) ?? 0) > 1 ? `${gun(d)} ${saat(d)}` : gun(d)));
}
