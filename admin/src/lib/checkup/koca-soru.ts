/**
 * "Koça sor" gelen kutusu — panelin kuralları. Saf modül: cevap kutusu
 * (istemci) ve eylem (sunucu) aynı sınırı ve aynı temizliği kullanır.
 *
 * Soru-cevap, yazışma değil (şema): koçun TEK cevabı var, düzeltilebilir.
 * Düzeltilince öğrencinin "okundu" işareti sıfırlanır ki yeni cevabı görsün.
 * Kapatma yalnızca cevapsız soruda (yinelenen, konu dışı); geri açılabilir.
 */

export { cokSatir as cevabiTemizle } from "./grup-kurallari";

/** Şemadaki sınır yok; burada denetlenir. */
export const CEVAP_SINIRI = 2000;

export const KUTULAR = ["bekleyen", "cevaplanan", "kapatilan"] as const;
export type Kutu = (typeof KUTULAR)[number];

export function isKutu(value: unknown): value is Kutu {
  return typeof value === "string" && (KUTULAR as readonly string[]).includes(value);
}

export const KUTU_ETIKETI: Record<Kutu, string> = {
  bekleyen: "Bekleyen",
  cevaplanan: "Cevaplanan",
  kapatilan: "Kapatılan",
};

export type SoruDurumu = "BEKLIYOR" | "CEVAPLANDI" | "KAPATILDI";

export function soruDurumu(q: { answeredAt: Date | null; closedAt: Date | null }): SoruDurumu {
  if (q.closedAt) return "KAPATILDI";
  return q.answeredAt ? "CEVAPLANDI" : "BEKLIYOR";
}

/**
 * Öğrenci kimliği yetkisi olmayana (editör): adın ve soyadın baş harfi,
 * "A. Y.". KVKK: soruyu cevaplamak için kim olduğunu bilmek gerekmiyor.
 */
export function basHarfler(ad: string): string {
  const parcalar = ad.trim().split(/\s+/).filter(Boolean);
  if (parcalar.length === 0) return "?";
  const harf = (s: string) => s.charAt(0).toLocaleUpperCase("tr-TR") + ".";
  return parcalar.length === 1 ? harf(parcalar[0]) : harf(parcalar[0]) + " " + harf(parcalar[parcalar.length - 1]);
}
