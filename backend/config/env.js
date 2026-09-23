const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!isNonEmptyString(String(v || ''))) {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v).trim();
}

function requireOneOf(names) {
  for (const n of names) {
    if (isNonEmptyString(process.env[n])) return String(process.env[n]).trim();
  }
  throw new Error(`Missing required env: ${names.join(' or ')}`);
}

/**
 * Güvenlik kararlarında "üretim mi?" sorusu KAPALI TARAFA düşer:
 * yalnızca NODE_ENV açıkça "development" ise geliştirme sayılır.
 *
 * Eskiden tersiydi (NODE_ENV === 'production' ise üretim). NODE_ENV'i
 * tanımlamayı unutmak çok yaygın ve sonucu sessizdi: çerez `Secure`
 * bayrağını kaybediyor, CSRF kapatılabiliyordu. Yani en kritik iki koruma
 * bir ortam değişkenini unutmaya bağlıydı.
 */
const IS_PRODUCTION = String(process.env.NODE_ENV || '').toLowerCase() !== 'development';

requireEnv('JWT_SECRET');
requireEnv('DB_HOST');
requireEnv('DB_NAME');
requireEnv('DB_USER');
requireEnv('DB_PASSWORD');
requireOneOf(['FRONTEND_URL', 'SITE_URL']);
requireOneOf(['BACKEND_URL', 'API_URL']);

const JWT_SECRET = requireEnv('JWT_SECRET');

/**
 * .env.example'daki örnek değerler ve kısa anahtarlar. Bu dosya depoda
 * olduğu için örnek anahtarla çalışan bir sunucuda HERKES yönetici jetonu
 * imzalayabilir — kimlik doğrulamanın tamamı devre dışı kalır.
 */
const ORNEK_ANAHTARLAR = new Set([
  'degistirin-guclu-bir-secret-anahtar',
  'your-secret-key',
  'secret',
  'changeme',
]);

const anahtarZayif = ORNEK_ANAHTARLAR.has(JWT_SECRET) || JWT_SECRET.length < 32;

if (anahtarZayif) {
  const nasil =
    'Yeni anahtar üret:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n' +
    'Sonra JWT_SECRET olarak tanımla. Anahtar değişince açık oturumlar düşer, personel yeniden giriş yapar.';

  if (IS_PRODUCTION) {
    throw new Error(
      'GÜVENLİK: JWT_SECRET örnek/zayıf bir değer (en az 32 karakter ve depoda geçmeyen bir değer olmalı).\n' +
        'Bu anahtarla herkes kendine yönetici jetonu imzalayabilir, sunucu bu yüzden açılmıyor.\n' +
        nasil
    );
  }
  console.warn(
    '\n⚠️  JWT_SECRET zayıf ya da .env.example ile aynı. Geliştirmede sorun değil;\n' +
      '    ÜRETİMDE sunucu bu değerle AÇILMAZ.\n    ' +
      nasil.replace('\n', '\n    ') +
      '\n'
  );
}

module.exports = {
  JWT_SECRET,
  IS_PRODUCTION,
  FRONTEND_URL: requireOneOf(['FRONTEND_URL', 'SITE_URL']),
  ADMIN_URL: String(process.env.ADMIN_URL || 'http://localhost:3001').trim(),
  BACKEND_URL: requireOneOf(['BACKEND_URL', 'API_URL']),
};
