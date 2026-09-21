/**
 * Çeldirici hata tipleri — şemadaki ErrorType enum'ının insan okunur adları.
 *
 * ⚠️ Bu liste BİLEREK ayrı bir modülde: server action dosyaları ("use server")
 * yalnızca async fonksiyon ihraç edebilir.
 * Sabit bir nesneyi oradan dışa aktarmak istemciye BOŞ olarak ulaşıyor —
 * hata sessiz: açılır liste boş görünür, kimse sebebini anlamaz.
 */
export const ERROR_TYPES = [
  "ISLEM_HATASI",
  "ISARET_HATASI",
  "TERS_ISLEM",
  "KAVRAM_YANILGISI",
  "EKSIK_OKUMA",
  "BIRIM_HATASI",
  "YAKLASIK_DEGER",
  "FORMUL_KARISTIRMA",
  "DIGER",
] as const;

export type ErrorTypeValue = (typeof ERROR_TYPES)[number];

export const ERROR_TYPE_LABELS: Record<ErrorTypeValue, string> = {
  ISLEM_HATASI: "İşlem hatası",
  ISARET_HATASI: "İşaret hatası",
  TERS_ISLEM: "Ters işlem",
  KAVRAM_YANILGISI: "Kavram yanılgısı",
  EKSIK_OKUMA: "Eksik okuma",
  BIRIM_HATASI: "Birim hatası",
  YAKLASIK_DEGER: "Yaklaşık değer",
  FORMUL_KARISTIRMA: "Formül karıştırma",
  DIGER: "Diğer",
};
