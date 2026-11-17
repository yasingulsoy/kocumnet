import sharp from "sharp";

/**
 * Soru görseli: PNG, JPEG ya da WebP kabul edilir, en fazla 10 MB. SVG kabul
 * edilmez (betik taşıyabilir; sharp SVG'yi de okuyabildiği için biçim
 * baytlardan denetlenir, dosya adına ya da istemcinin bildirdiği türe bakılmaz).
 *
 * EXIF yönü uygulanır (telefondan çekilen fotoğraf yan yatmasın), genişlik en
 * fazla 1200 piksele indirilir, WebP'ye çevrilir. Çıktıya üst veri (EXIF, GPS)
 * yazılmaz: sharp yalnızca istenirse yazar.
 */
export const GORSEL_EN_FAZLA_BAYT = 10 * 1024 * 1024;
export const GORSEL_EN_FAZLA_GENISLIK = 1200;
const IZINLI_BICIMLER = new Set(["png", "jpeg", "webp"]);

export class GorselHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "GorselHatasi";
  }
}

export interface IslenmisGorsel {
  veri: Uint8Array<ArrayBuffer>;
  mime: "image/webp";
  genislik: number;
  yukseklik: number;
  boyut: number;
}

export async function gorselIsle(girdi: Buffer): Promise<IslenmisGorsel> {
  if (girdi.byteLength > GORSEL_EN_FAZLA_BAYT) throw new GorselHatasi("Görsel en fazla 10 MB olabilir.");

  let bicim: string | undefined;
  try {
    bicim = (await sharp(girdi).metadata()).format;
  } catch {
    throw new GorselHatasi("Dosya okunamadı. PNG, JPEG ya da WebP bir görsel yükleyin.");
  }
  if (bicim === "svg") throw new GorselHatasi("SVG kabul edilmiyor. PNG, JPEG ya da WebP yükleyin.");
  if (!bicim || !IZINLI_BICIMLER.has(bicim)) throw new GorselHatasi("Yalnızca PNG, JPEG ya da WebP görsel yüklenebilir.");

  try {
    const { data, info } = await sharp(girdi)
      .rotate()
      .resize({ width: GORSEL_EN_FAZLA_GENISLIK, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    // Prisma'nın Bytes alanı Uint8Array<ArrayBuffer> bekliyor.
    return { veri: new Uint8Array(data), mime: "image/webp", genislik: info.width, yukseklik: info.height, boyut: data.byteLength };
  } catch {
    throw new GorselHatasi("Görsel işlenemedi; dosya bozuk olabilir.");
  }
}
