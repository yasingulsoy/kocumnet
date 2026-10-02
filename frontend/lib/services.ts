import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Hizmet listesi — tek kaynak.
 *
 * `id` değerleri dile bağımsız ve KALICI: hizmetler sayfasındaki çapa
 * bağlantıları (`/hizmetlerimiz#tercih-danismanligi`) ve footer'daki hızlı
 * erişim linkleri bunlara bakıyor. Değiştirmek dışarıdan verilmiş
 * bağlantıları kırar.
 *
 * Başlıklar sözlükten geliyor; burada yalnızca hangi anahtarın hangi
 * hizmete ait olduğu duruyor. Eskiden bu eşleme hizmetler sayfasının
 * içinde gömülüydü ve ana sayfa hizmetleri hiç listelemiyordu.
 */
export interface ServiceRef {
  id: string;
  titleKey: keyof Dictionary["services"];
  /** Ana sayfadaki kısa tanıtım satırı. */
  leadKey: keyof Dictionary["services"];
}

export const SERVICES: ServiceRef[] = [
  { id: "tercih-danismanligi", titleKey: "tercihTitle", leadKey: "tercihP1" },
  { id: "sinav-hazirlik-materyalleri", titleKey: "materyalTitle", leadKey: "materyalLead" },
  { id: "sinav-calisma-koclugu", titleKey: "koclukTitle", leadKey: "koclukP1" },
  { id: "ogrenci-koclugu", titleKey: "ogrenciTitle", leadKey: "ogrenciP1" },
  { id: "psikolojik-destek", titleKey: "psikolojikTitle", leadKey: "psikolojikP1" },
  { id: "beslenme-danismanligi", titleKey: "beslenmeTitle", leadKey: "beslenmeP1" },
];

/** Uzun paragrafın ilk cümlesi — kart üstünde tam paragraf çok uzun kalıyor. */
export function ilkCumle(metin: string, enFazla = 120): string {
  const nokta = metin.indexOf(". ");
  const kisa = nokta > 30 ? metin.slice(0, nokta + 1) : metin;
  return kisa.length > enFazla ? kisa.slice(0, enFazla).trimEnd() + "…" : kisa;
}
