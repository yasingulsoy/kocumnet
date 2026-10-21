import type { BadgeColor } from "@/components/tailadmin/ui/Badge";

/**
 * Öğrenci hata bildirimi (QuestionNote, kind = STUDENT_REPORT) — etiketler.
 * Saf modül: sayfalar (sunucu) ve satırlar (istemci) aynı adı kullanır.
 *
 * Bildirimi öğrenci uygulaması yazar ("Bu soruda hata var"); panel okur,
 * çözüldü/yeniden aç işaretler. Çözülen bildirimi öğrenci "incelendi" diye
 * görür. Bildireni (ad, öğrenci sayfası) yalnızca MANAGE rolleri görür
 * (KVKK: öğrenci kişisel verisi en az kişiye); ötekiler "Bir öğrenci".
 */

export const BILDIRIM_SEBEPLERI = [
  "YANLIS_ANAHTAR",
  "COZUM_HATALI",
  "YAZIM_HATASI",
  "GORSEL_SORUNU",
  "SORU_ANLASILMIYOR",
  "DIGER",
] as const;
export type BildirimSebebi = (typeof BILDIRIM_SEBEPLERI)[number];

/** Panelde görünen ad (şemadaki ReportReason). */
export const BILDIRIM_SEBEBI: Record<BildirimSebebi, string> = {
  YANLIS_ANAHTAR: "Cevap anahtarı yanlış",
  COZUM_HATALI: "Çözüm hatalı",
  YAZIM_HATASI: "Yazım hatası",
  GORSEL_SORUNU: "Görsel sorunu",
  SORU_ANLASILMIYOR: "Soru anlaşılmıyor",
  DIGER: "Diğer",
};

/**
 * Rozet rengi: yanlış anahtar en ağır (öğrenci haksız yere yanlış sayılıyor),
 * çözüm ve anlaşılmayan soru orta, yazım/görsel hafif.
 */
export const BILDIRIM_RENGI: Record<BildirimSebebi, BadgeColor> = {
  YANLIS_ANAHTAR: "error",
  COZUM_HATALI: "warning",
  YAZIM_HATASI: "light",
  GORSEL_SORUNU: "info",
  SORU_ANLASILMIYOR: "warning",
  DIGER: "light",
};

export function isBildirimSebebi(v: unknown): v is BildirimSebebi {
  return typeof v === "string" && (BILDIRIM_SEBEPLERI as readonly string[]).includes(v);
}

export function sebepAdi(v: string | null | undefined): string {
  return isBildirimSebebi(v) ? BILDIRIM_SEBEBI[v] : "Sebep yok";
}

export function sebepRengi(v: string | null | undefined): BadgeColor {
  return isBildirimSebebi(v) ? BILDIRIM_RENGI[v] : "light";
}
