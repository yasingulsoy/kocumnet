/**
 * Koçluk grubu ve ödev — panelin kuralları. Saf modül: formlar (istemci) ve
 * eylemler (sunucu) aynı sınırı, aynı temizliği ve aynı etiketleri kullanır.
 *
 * Tamamlanma kuralı BURADA DEĞİL: öğrenci uygulamasıyla ortak
 * shared/odev.ts'te (app/lib/odev.ts'in kopyası). Burada yalnızca panele
 * özgü olanlar: alan sınırları, hangi paketin ödev olabileceği, koçun
 * gördüğü durum adları.
 */

import type { BadgeColor } from "@/components/tailadmin/ui/Badge";
import type { OdevDurumu } from "./shared/odev";
import { konuSinavdaMi } from "./shared/exam-scope";

export const GRUP_ADI_SINIRI = 80;
export const GRUP_NOTU_SINIRI = 500;
export const ODEV_BASLIGI_SINIRI = 120;
export const ODEV_NOTU_SINIRI = 500;
/** Üye aramasında en az kaç harf: tek harfle bütün öğrenci listesi dökülmesin. */
export const ARAMA_EN_AZ = 2;
export const ARAMA_SONUC_SINIRI = 10;

/**
 * Ödev olarak verilebilecek paketler: katalog testleri (STANDARD, INTRO) ve
 * denemeler (MOCK). Seviyeli, tekrar ve alıştırma paketleri kendi yolundan
 * başlıyor; öğrencinin paket sayfası onları açmıyor (app/(panel)/paketler/[slug]).
 */
export const ODEV_PAKET_TURLERI = ["STANDARD", "INTRO", "MOCK"] as const;

/** Grup adı, ödev başlığı: tek satır, boşluklar tekil. */
export function tekSatir(ham: string): string {
  return ham
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Not ve açıklama: satır sonları kalır, denetim karakterleri gider, boş satırlar ikiye iner. */
export function cokSatir(ham: string): string {
  return ham
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, "")
    .replace(/[  ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Koçun ekranındaki durum adı (öğrenci kendi ekranında "tamamladın" görür). */
export const ODEV_DURUM_ETIKETI: Record<OdevDurumu, string> = {
  TAMAMLANDI: "Tamamladı",
  GEC_TAMAMLANDI: "Geç tamamladı",
  BASLADI: "Başladı",
  BASLAMADI: "Başlamadı",
};

export const ODEV_DURUM_RENGI: Record<OdevDurumu, BadgeColor> = {
  TAMAMLANDI: "success",
  GEC_TAMAMLANDI: "warning",
  BASLADI: "info",
  BASLAMADI: "light",
};

/** Tabloda önce yapmayanlar: koçun aradığı onlar. */
export const ODEV_DURUM_SIRASI: Record<OdevDurumu, number> = {
  BASLAMADI: 0,
  BASLADI: 1,
  GEC_TAMAMLANDI: 2,
  TAMAMLANDI: 3,
};

export const ODEV_TURU_ETIKETI: Record<string, string> = {
  PACKAGE: "Test",
  TOPIC_PRACTICE: "Konu alıştırması",
};

/**
 * Konu ödevinin alıştırması hangi sınavdan soru seçer — ödev formunun havuz
 * sayımı ve ödev verme denetimi bununla sayar. Öğrenci uygulaması
 * (app/lib/practice.ts odevKonuCalismasiBaslat): grubun sınavı, yoksa
 * öğrencinin hedef sınavı, o da konuyu kapsamıyorsa konunun ana sınavı.
 * Grubun sınavı varsa: konuyu kapsıyorsa o, kapsamıyorsa konunun ana sınavı.
 * Sınavsız grupta öğrenciye göre değişir: null (konunun bütün yayındaki soruları).
 */
export function odevKonuSinavi<S extends string>(grupSinavi: S | null, konu: { examScope: S; examScopes: readonly string[] }): S | null {
  if (!grupSinavi) return null;
  return konuSinavdaMi(konu, grupSinavi) ? grupSinavi : konu.examScope;
}
