/**
 * "Bu soruda hata var" ve "Koça sor" — sınırlar, etiketler ve durumlar.
 *
 * SAF MODÜL: istemci bileşenleri (HataBildir, KocaSor) etiketleri ve
 * uzunluk sınırlarını buradan okur. Veritabanı tarafı lib/hata-bildirimi.ts
 * ve lib/koca-soru.ts'te. "use server" dosyasından sabit ihraç edilemez
 * (istemciye boş ulaşır); bu yüzden ayrı dosya.
 *
 * ⚠️ Sayılar hoca/koç kararı bekliyor; değişecekse yalnızca bu dosya değişir.
 */

// ─────────────────────────────────────────────────────────────
// Hata bildirimi
// ─────────────────────────────────────────────────────────────

/** Şemadaki ReportReason ile aynı sırada; panel de bu etiketleri kullanmalı. */
export const RAPOR_SEBEPLERI = [
  { deger: "YANLIS_ANAHTAR", etiket: "Doğru cevap yanlış işaretlenmiş" },
  { deger: "COZUM_HATALI", etiket: "Çözümde hata var" },
  { deger: "YAZIM_HATASI", etiket: "Yazım ya da sayı hatası" },
  { deger: "GORSEL_SORUNU", etiket: "Şekil ya da görsel sorunlu" },
  { deger: "SORU_ANLASILMIYOR", etiket: "Soru anlaşılmıyor ya da eksik" },
  { deger: "DIGER", etiket: "Başka bir sorun" },
] as const;

export type RaporSebebi = (typeof RAPOR_SEBEPLERI)[number]["deger"];

export const RAPOR_SEBEP_DEGERLERI = RAPOR_SEBEPLERI.map((s) => s.deger) as [RaporSebebi, ...RaporSebebi[]];

/** İsteğe bağlı açıklama: sebep çoğu zaman yeter; uzun metin panelde okunmuyor. */
export const RAPOR_ACIKLAMA_SINIRI = 500;

/**
 * Bir öğrencinin bir Türkiye gününde açabileceği bildirim. Gerçek bir hata
 * avcısı için bol; panelin gelen kutusunu tek kişinin doldurmasına yetmez.
 */
export const GUNLUK_RAPOR_SINIRI = 10;

/**
 * Öğrencinin gördüğü durum. Panelde "çözüldü" (resolvedAt) hem "düzeltildi"
 * hem "hata yok" demek olabiliyor; öğrenciye ikisini de doğru anlatan
 * "incelendi" diyoruz.
 */
export type RaporDurumu = "INCELENIYOR" | "INCELENDI";

// ─────────────────────────────────────────────────────────────
// Koça sor
// ─────────────────────────────────────────────────────────────

/** Öğrencinin sorusu en fazla bu kadar karakter (düz metin). */
export const KOCA_SORU_SINIRI = 1000;

/**
 * Aynı anda cevap bekleyen en fazla kaç soru. Koç tek kişi; öğrenci önce
 * cevapları okusun, sonra yenisini yazsın.
 */
export const ACIK_KOCA_SORU_SINIRI = 3;

/** Bir Türkiye gününde en fazla kaç soru. */
export const GUNLUK_KOCA_SORU_SINIRI = 5;

export type KocaSoruDurumu = "BEKLIYOR" | "CEVAPLANDI" | "KAPATILDI";

/**
 * Satırın durumu. Cevap yazıldıysa (sonradan kapatılmış olsa da) cevaplandı;
 * cevapsız kapatıldıysa kapatıldı; yoksa bekliyor.
 */
export function kocaSoruDurumu(s: { answeredAt: Date | null; closedAt: Date | null }): KocaSoruDurumu {
  if (s.answeredAt) return "CEVAPLANDI";
  if (s.closedAt) return "KAPATILDI";
  return "BEKLIYOR";
}

export const KOCA_SORU_DURUM_ETIKETI: Record<KocaSoruDurumu, string> = {
  BEKLIYOR: "Bekliyor",
  CEVAPLANDI: "Cevaplandı",
  KAPATILDI: "Kapatıldı",
};

// ─────────────────────────────────────────────────────────────
// Ortak
// ─────────────────────────────────────────────────────────────

/** Hata bildirimi ve koça sorunun reddi: ileti öğrenciye gider. */
export class BildirimHatasi extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BildirimHatasi";
  }
}
