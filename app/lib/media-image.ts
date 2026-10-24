import sharp from "sharp";

/**
 * Soru görselinin saklanan biçimi — üç yol AYNI ayarı kullanır: panelin tek
 * şekil yüklemesi, panelin toplu içe aktarması ve komut satırı
 * (scripts/import-questions.mts). Panel bu dosyanın kopyasını kullanır
 * (admin/scripts/checkup-sync.mjs); bu yüzden `server-only` yok ve yalnızca
 * paket importu var (sharp iki projede de bağımlılık).
 *
 * Neden ortak: komut satırı eskiden dosyayı olduğu gibi yazıyordu. Telefondan
 * çekilmiş fotoğraf EXIF'teki GPS konumuyla, 4000 px ve birkaç MB olarak
 * veritabanına giriyor ve öğrenciye öyle gidiyordu; panelden gelen aynı görsel
 * 1200 px WebP'ydi.
 *
 * - EXIF yönü uygulanır (telefondan gelen fotoğraf yan yatmasın), sonra BÜTÜN
 *   üst veri atılır: sharp çıktıya EXIF/GPS/XMP'yi yalnızca `keepMetadata()` /
 *   `withMetadata()` istenirse yazar; burada istenmiyor.
 * - Genişlik en fazla 1200 px (soru gövdesinde daha geniş gösterilmiyor).
 * - WebP, kalite 82.
 */
export const GORSEL_EN_FAZLA_GENISLIK = 1200;

/**
 * Ham dosya sınırı: üç yol da bunu aşan dosyayı çevirmeden reddeder. Panelin
 * next.config.ts gövde sınırı (10 MB) bunun üstünde olmalı. Piksel sınırı
 * sharp'ın varsayılanı (~268 MP): 200 MP telefon fotoğrafı da açılır.
 */
export const GORSEL_DOSYA_SINIRI = 8 * 1024 * 1024;

const mb = (bayt: number) => (bayt / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " MB";

/** İçe aktarma raporunun cümlesi: dosya sınırı aşıldıysa sebep, yoksa null (komut satırı ve panel aynı dili konuşsun). */
export function gorselBoyutSorunu(bayt: number): string | null {
  return bayt > GORSEL_DOSYA_SINIRI ? `dosya çok büyük (${mb(bayt)}); en fazla ${mb(GORSEL_DOSYA_SINIRI)}` : null;
}

/** webpYap null döndüğünde raporun cümlesi. */
export const GORSEL_OKUNAMADI = "görsel okunamadı, dosya bozuk olabilir";

export interface WebpGorsel {
  /** Prisma 7 Bytes alanı Uint8Array bekliyor; Node Buffer'ını doğrudan kabul etmiyor. */
  data: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  byteSize: number;
}

/** Ham baytları saklanacak biçime çevirir. Okunamayan (bozuk ya da sahte) dosyada null. */
export async function webpYap(girdi: Buffer | Uint8Array): Promise<WebpGorsel | null> {
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
