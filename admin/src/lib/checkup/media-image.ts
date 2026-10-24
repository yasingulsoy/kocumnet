import "server-only";

/**
 * Soru görselinin saklanan biçimi (EXIF yönü, üst veri atılır, 1200 px,
 * WebP). Kural burada DEĞİL: öğrenci uygulamasının app/lib/media-image.ts'inde
 * (kopyası shared/media-image.ts); komut satırı içe aktarması da onu kullanıyor,
 * üç yol aynı görseli yazsın. Bu dosya kopyayı sunucuya kilitler: sharp
 * istemci paketine sızmasın.
 */
export * from "./shared/media-image";
