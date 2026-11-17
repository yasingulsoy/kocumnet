/*
 * Çerez adları ve ayarları. Saf modül: proxy.ts de, sunucu kodu da kullanır.
 */

/** Backend'in verdiği öğrenci jetonu (httpOnly). Admin'deki karşılığı yonetici_oturum. */
export const OTURUM_CEREZI = "ogrenci_oturum";

/** kocum.net'ten gelen bağlantının ?k= etiketi; kayıtta backend'e gider. */
export const KAYNAK_CEREZI = "kaynak";

/** İkisi de 30 gün (API.md: öğrenci jetonu 30 gün geçerli). */
export const OTUZ_GUN_SANIYE = 30 * 24 * 60 * 60;

export function cerezAyarlari() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OTUZ_GUN_SANIYE,
  };
}

/**
 * API.md "Hesap" kuralları: kaynak yalnızca bu listedeyse saklanır. Listede
 * olmayan etiketi çereze hiç yazmıyoruz (backend zaten yok sayar).
 */
export const KAYNAK_ETIKETLERI = new Set([
  "ust",
  "hero",
  "bolum",
  "altbilgi",
  "blog",
  "iletisim",
  "whatsapp",
  "instagram",
  "diger",
]);
