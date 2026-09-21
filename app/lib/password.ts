import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// promisify(scrypt) tip olarak yalnızca options'sız aşırı yüklemeyi yakalıyor;
// maliyet parametrelerini geçirebilmek için kendi sarmalayıcımız.
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Parola özetleme — Node'un yerleşik scrypt'i.
 *
 * bcrypt/argon2 native derleme ister; Windows'ta kurulum kırılgan ve deploy
 * imajında derleyici gerektirir. scrypt Node çekirdeğinde ve OWASP'ın kabul
 * ettiği bir parola KDF'i, dolayısıyla bağımlılık eklemeye değmiyor.
 *
 * Parametreler OWASP önerisi: N=2^16, r=8, p=1 (yaklaşık 64 MB bellek).
 */
const N = 65536;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

// scrypt N=2^16 için varsayılan 32 MB limit yetmez.
const MAX_MEM = 128 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });

  // Parametreleri de saklıyoruz: ileride maliyet artırılırsa eski özetler
  // doğrulanmaya devam etsin (aksi halde herkesin parolası geçersiz olur).
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltB64, keyB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");

  const key = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
    maxmem: MAX_MEM,
  });

  // Uzunluk farklıysa timingSafeEqual fırlatır; önce kontrol et.
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}
