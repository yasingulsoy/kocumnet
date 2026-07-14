const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const WEBP_OPTIONS = { lossless: true };

/**
 * Tek bir dosyayı kayıpsız (lossless) WebP'ye dönüştürür.
 * Zaten WebP ise dokunmaz. Orijinal dosyayı siler, yerine .webp yazar.
 *
 * @param {string} filePath  Diskteki tam dosya yolu
 * @returns {Promise<{ newPath: string, newFilename: string }>}
 */
async function convertToWebp(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.webp') {
    return {
      newPath: filePath,
      newFilename: path.basename(filePath),
    };
  }

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ext);
  const newFilename = `${baseName}.webp`;
  const newPath = path.join(dir, newFilename);

  await sharp(filePath).webp(WEBP_OPTIONS).toFile(newPath);

  fs.unlinkSync(filePath);

  return { newPath, newFilename };
}

/**
 * Buffer'ı kayıpsız (lossless) WebP Buffer'ına dönüştürür.
 *
 * @param {Buffer} inputBuffer
 * @returns {Promise<Buffer>}
 */
async function bufferToWebp(inputBuffer) {
  return sharp(inputBuffer).webp(WEBP_OPTIONS).toBuffer();
}

module.exports = { convertToWebp, bufferToWebp };
