import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Parola özeti: Node'un yerleşik scrypt'i (native derleme gerektiren bcrypt ya
 * da argon2 yok). Parametreler OWASP önerisi: N=2^16, r=8, p=1 (~64 MB).
 * Parametreler özetle birlikte saklanır; maliyet ileride artırılırsa eski
 * özetler doğrulanmaya devam eder.
 *
 * Biçim: scrypt$N$r$p$tuz(base64)$anahtar(base64)
 */
const N = 65536;
const R = 8;
const P = 1;
const ANAHTAR_UZUNLUGU = 64;
const TUZ_UZUNLUGU = 16;
// N=2^16 için varsayılan 32 MB bellek sınırı yetmez.
const EN_FAZLA_BELLEK = 128 * 1024 * 1024;

function scryptAsync(parola: string, tuz: Buffer, uzunluk: number, secenek: ScryptOptions): Promise<Buffer> {
  return new Promise((coz, reddet) => {
    scrypt(parola, tuz, uzunluk, secenek, (hata, anahtar) => (hata ? reddet(hata) : coz(anahtar)));
  });
}

export async function parolaOzetle(parola: string): Promise<string> {
  const tuz = randomBytes(TUZ_UZUNLUGU);
  const anahtar = await scryptAsync(parola.normalize("NFKC"), tuz, ANAHTAR_UZUNLUGU, { N, r: R, p: P, maxmem: EN_FAZLA_BELLEK });
  return `scrypt$${N}$${R}$${P}$${tuz.toString("base64")}$${anahtar.toString("base64")}`;
}

export async function parolaDogrula(parola: string, saklanan: string): Promise<boolean> {
  const parcalar = saklanan.split("$");
  if (parcalar.length !== 6 || parcalar[0] !== "scrypt") return false;
  const [, nMetin, rMetin, pMetin, tuzB64, anahtarB64] = parcalar;
  const beklenen = Buffer.from(anahtarB64!, "base64");
  const anahtar = await scryptAsync(parola.normalize("NFKC"), Buffer.from(tuzB64!, "base64"), beklenen.length, {
    N: Number(nMetin),
    r: Number(rMetin),
    p: Number(pMetin),
    maxmem: EN_FAZLA_BELLEK,
  });
  // Uzunluk farklıysa timingSafeEqual fırlatır.
  if (anahtar.length !== beklenen.length) return false;
  return timingSafeEqual(anahtar, beklenen);
}

/**
 * Hesap yokken de aynı süreyi harcamak için (giriş denemesinde e-postanın
 * kayıtlı olup olmadığı yanıt süresinden anlaşılmasın).
 */
let sahteOzet: Promise<string> | null = null;
export async function sahteDogrulama(parola: string): Promise<false> {
  sahteOzet ??= parolaOzetle(randomBytes(16).toString("hex"));
  await parolaDogrula(parola, await sahteOzet);
  return false;
}
