const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { Op } = require('sequelize');

/**
 * Yazı içi görseller — seçilir seçilmez yüklenen dosyalar.
 *
 * Eskiden editör görseli içeriğe base64 gömüyordu; kayıtta dosyaya
 * çevriliyordu (utils/blogContent.js). Büyük yazılarda 12 MB gövde sınırı ve
 * tarayıcı yedeğinin kotası doluyordu. Artık görsel önce buraya yüklenir,
 * içerikte yalnızca adresi durur. Eski base64 içerikler eskisi gibi çalışır.
 *
 *   uploads/media/<yyyymm>/<24 hex>.webp     →  /uploads/media/<yyyymm>/<ad>.webp
 *
 * Yazıya bağlı klasörde değil: yazı daha kaydedilmeden (yeni yazı) de
 * yüklenebilsin. Sahipsiz kalanlar (hiçbir yazıda ve hiçbir sürümde
 * geçmeyen, 7 günden eski) sahipsizMedyaTemizligi ile silinir.
 */

const MEDYA_KOK = path.resolve(__dirname, '..', 'uploads', 'media');
const EN_GENIS = 1600;
const KALITE = 82;
/** Sıkıştırma bombasına karşı: çözülmüş en fazla 60 megapiksel (8000×7500). */
const EN_FAZLA_PIKSEL = 60_000_000;
const VARSAYILAN_YAS_MS = 7 * 24 * 60 * 60 * 1000;
const AY_DESENI = /^\d{6}$/;
const AD_DESENI = /^[a-f0-9]{24}\.webp$/;
/** İçerikteki medya adresleri (göreli ya da mutlak). */
const ADRES_DESENI = /\/uploads\/media\/(\d{6})\/([a-f0-9]{24}\.webp)/g;

/**
 * Görseli en fazla 1600 px genişliğe indirip WebP'ye çevirir. EXIF yönünü
 * uygular (telefon fotoğrafı yan durmasın), meta veriyi (konum dahil) atar.
 * Hareketli GIF/WebP hareketli kalır.
 *
 * @param {Buffer} girdi
 * @param {'jpeg'|'png'|'gif'|'webp'} tur  sniffImage sonucu
 */
async function gorseliIsle(girdi, tur) {
  const hareketli = tur === 'gif' || tur === 'webp';
  const { data, info } = await sharp(girdi, { animated: hareketli, limitInputPixels: EN_FAZLA_PIKSEL })
    .rotate()
    .resize({ width: EN_GENIS, withoutEnlargement: true })
    .webp({ quality: KALITE })
    .toBuffer({ resolveWithObject: true });
  // Hareketli görselde info.height bütün karelerin toplamı; tek karenin yüksekliği pageHeight.
  return { data, width: info.width, height: info.pageHeight || info.height };
}

/** İşlenmiş görseli yazar, sitenin kullanacağı göreli adresi döndürür. */
function gorseliKaydet(veri) {
  const simdi = new Date();
  const ay = `${simdi.getUTCFullYear()}${String(simdi.getUTCMonth() + 1).padStart(2, '0')}`;
  const klasor = path.join(MEDYA_KOK, ay);
  fs.mkdirSync(klasor, { recursive: true });
  const ad = `${crypto.randomBytes(12).toString('hex')}.webp`;
  fs.writeFileSync(path.join(klasor, ad), veri);
  return `/uploads/media/${ay}/${ad}`;
}

/**
 * Sahipsiz medya temizliği: hiçbir yazının içeriğinde ve hiçbir sürümde
 * geçmeyen, `enAzYasMs`'ten eski dosyaları siler. Sürümlerde geçenler
 * korunur: yoksa bir sürüme dönülünce görseller kırık çıkardı.
 *
 * @returns {Promise<{taranan:number, silinen:number, korunan:number}>}
 */
async function sahipsizMedyaTemizligi({ enAzYasMs = VARSAYILAN_YAS_MS } = {}) {
  if (!fs.existsSync(MEDYA_KOK)) return { taranan: 0, silinen: 0, korunan: 0 };
  // Döngüsel require olmasın diye modeller burada yükleniyor.
  const { Blog, BlogRevision } = require('../models');
  const desen = { [Op.like]: '%/uploads/media/%' };
  const [yazilar, surumler] = await Promise.all([
    Blog.findAll({ attributes: ['content'], where: { content: desen }, raw: true }),
    BlogRevision.findAll({ attributes: ['content'], where: { content: desen }, raw: true }),
  ]);
  const kullanilan = new Set();
  for (const satir of [...yazilar, ...surumler]) {
    for (const m of String(satir.content || '').matchAll(ADRES_DESENI)) kullanilan.add(`${m[1]}/${m[2]}`);
  }

  const simdi = Date.now();
  let taranan = 0;
  let silinen = 0;
  for (const ay of fs.readdirSync(MEDYA_KOK)) {
    if (!AY_DESENI.test(ay)) continue;
    const klasor = path.join(MEDYA_KOK, ay);
    for (const ad of fs.readdirSync(klasor)) {
      if (!AD_DESENI.test(ad)) continue;
      taranan++;
      if (kullanilan.has(`${ay}/${ad}`)) continue;
      const tam = path.join(klasor, ad);
      try {
        if (simdi - fs.statSync(tam).mtimeMs < enAzYasMs) continue;
        fs.unlinkSync(tam);
        silinen++;
      } catch (e) {
        console.error('Sahipsiz görsel silinemedi:', `${ay}/${ad}`, '—', e.message);
      }
    }
    // Boşalan ay klasörünü de kaldır.
    try {
      if (fs.readdirSync(klasor).length === 0) fs.rmdirSync(klasor);
    } catch {
      /* yoksay */
    }
  }
  if (silinen > 0) console.log(`· ${silinen} sahipsiz içerik görseli silindi (${taranan} tarandı).`);
  return { taranan, silinen, korunan: taranan - silinen };
}

module.exports = {
  MEDYA_KOK,
  EN_GENIS,
  VARSAYILAN_YAS_MS,
  gorseliIsle,
  gorseliKaydet,
  sahipsizMedyaTemizligi,
};
