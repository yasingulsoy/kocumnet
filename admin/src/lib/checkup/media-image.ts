import "server-only";
import sharp from "sharp";

/**
 * Soru görselinin saklanan biçimi — tek şekil yükleme (actions/media.ts) ve
 * toplu içe aktarma (question-import.ts) AYNI ayarı kullanır.
 *
 * EXIF yönü düzeltilir (telefondan gelen fotoğraf yan yatmasın), genişlik en
 * fazla 1200 px (soru gövdesinde daha geniş gösterilmiyor), WebP.
 */
export const GORSEL_EN_FAZLA_GENISLIK = 1200;

/** Ham dosya sınırı. next.config.ts'teki gövde sınırı (10 MB) bunun üstünde olmalı. */
export const GORSEL_DOSYA_SINIRI = 8 * 1024 * 1024;

export interface WebpGorsel {
  /** Prisma 7 Bytes alanı Uint8Array bekliyor; Node Buffer'ını doğrudan kabul etmiyor. */
  data: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  byteSize: number;
}

/** Ham baytları saklanacak biçime çevirir. Okunamayan (bozuk ya da sahte) dosyada null. */
export async function webpYap(girdi: Buffer): Promise<WebpGorsel | null> {
  try {
    const { data, info } = await sharp(girdi)
      .rotate()
      .resize({ width: GORSEL_EN_FAZLA_GENISLIK, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height, byteSize: data.byteLength };
  } catch {
    return null;
  }
}
