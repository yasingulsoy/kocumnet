/**
 * Hesap ve oturumun saf kuralları: girişten sonra dönülecek yol, kayıt
 * kaynağı etiketi, oturum ve son etkinlik süreleri.
 *
 * Saf modül (veritabanı, çerez, Next API'si yok): proxy.ts de bunu içe
 * aktarıyor ve proxy uygulamanın geri kalanından ayrı paketleniyor; ağır bir
 * modül (Prisma) oraya taşınmasın. scripts/hesap-test.mts doğrudan sınar.
 */

// ─────────────────────────────────────────────────────────────
// Oturum
// ─────────────────────────────────────────────────────────────

export const SESSION_COOKIE = "kocum_sess";

/** Oturum ömrü (gün): açılışta ve her uzatmada bu kadar. */
export const OTURUM_GUN = 30;

/**
 * Kayan oturum: kalan süre bunun altına inince veritabanındaki bitiş
 * OTURUM_GUN'e uzar. 5 haftalık pilotta sabit 30 gün, her gün çalışan
 * öğrenciyi 5. haftada girişe düşürüyordu. Her istekte değil eşikte
 * uzatıyoruz: oturum satırına günde bir kez bile yazmak gereksiz.
 */
export const OTURUM_UZATMA_ESIGI_GUN = 15;

const GUN_MS = 86_400_000;

/** Oturumun bitişi uzatılmalı mı (kalan süre eşiğin altında). */
export function oturumUzatilmali(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() - now.getTime() < OTURUM_UZATMA_ESIGI_GUN * GUN_MS;
}

export function yeniOturumBitisi(now: Date): Date {
  return new Date(now.getTime() + OTURUM_GUN * GUN_MS);
}

/**
 * Son etkinlik (User.lastSeenAt) en fazla bu aralıkla yazılır. Panelin
 * "son görülme"si için saat yeter; her istekte kullanıcı satırına yazmak
 * hem gereksiz yük hem gereksiz iz.
 */
export const SON_ETKINLIK_ARALIGI_MS = 60 * 60_000;

/** Son etkinlik yazılmalı mı: hiç yazılmamış ya da aralıktan eski. */
export function sonEtkinlikYazilmali(lastSeenAt: Date | null, now: Date): boolean {
  return !lastSeenAt || now.getTime() - lastSeenAt.getTime() >= SON_ETKINLIK_ARALIGI_MS;
}

// ─────────────────────────────────────────────────────────────
// Girişten sonra dönülecek yol (?sonra=)
// ─────────────────────────────────────────────────────────────

/**
 * proxy.ts her sayfa isteğine istenen yolu bu başlıkla ekler; giriş
 * gerektiren sayfa girişe yönlendirirken `sonra` olarak taşır (lib/auth.ts
 * girisAdresi). Server Component kendi adresini bilmiyor; başlık tek yol.
 */
export const ISTENEN_YOL_BASLIGI = "x-kocum-yol";

/** Uzun adres günlükleri ve çerez boyutunu şişirmesin; uygulamanın yolları kısa. */
const SONRA_EN_UZUN = 512;

/** Girişe ve kayda geri dönmek döngü olurdu; oralara "sonra" verilmez. */
const SONRA_OLAMAZ = ["/giris", "/kayit"];

/**
 * `sonra` değerini doğrular; güvenli değilse null.
 *
 * YALNIZCA aynı sitedeki göreli yol: `/` ile başlar, `//` ya da `/\` ile
 * başlamaz (tarayıcı ikisini de başka bir sunucu adresi sayar: açık
 * yönlendirme). Kontrol karakteri ve ters bölü hiç kabul edilmez: adres
 * ayrıştırıcısı sekme ve satır sonunu SİLER, "/<sekme>/kotu.com" ayrıştırılınca
 * "//kotu.com" olur. Son olarak sahte bir kökene göre çözülür ve köken
 * değişmediyse, çözülen yol da aynı kurallardan geçiyorsa kabul edilir
 * ("/a/..//kotu.com" çözülünce "//kotu.com" olur, o da reddedilir).
 * Çapa (#) atılır: sunucuya zaten gelmez.
 */
export function guvenliSonra(deger: unknown): string | null {
  const ham = Array.isArray(deger) ? deger[0] : deger;
  if (typeof ham !== "string" || ham.length === 0 || ham.length > SONRA_EN_UZUN) return null;
  if (!onEkUygun(ham)) return null;
  if (/[\u0000-\u001f\u007f\\\s]/.test(ham)) return null;

  const KOK = "https://kok.invalid";
  let u: URL;
  try {
    u = new URL(ham, KOK);
  } catch {
    return null;
  }
  if (u.origin !== KOK) return null;
  const yol = u.pathname + u.search;
  if (!onEkUygun(yol)) return null;
  if (SONRA_OLAMAZ.some((y) => u.pathname === y || u.pathname.startsWith(y + "/"))) return null;
  return yol;
}

function onEkUygun(s: string): boolean {
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\");
}

/** Girişe yönlendirme adresi: `sonra` geçerliyse taşınır, panoysa gerek yok. */
export function girisYolu(sonra: string | null): string {
  return sonra && sonra !== "/panel" ? `/giris?sonra=${encodeURIComponent(sonra)}` : "/giris";
}

// ─────────────────────────────────────────────────────────────
// Kayıt kaynağı (?k=)
// ─────────────────────────────────────────────────────────────

/**
 * kocum.net'teki "Check-up'a başla" bağlantılarının kısa etiketleri (`?k=`).
 * TEK liste: site ajanı bağlantılara bunları yazar, panel toplamı bunlarla
 * gösterir. Çerez yok, IP yok, yönlendiren adres yok: yalnızca hesabın
 * signupSource alanına bu etiket yazılır.
 */
export const KAYIT_KAYNAKLARI = [
  "ust",
  "hero",
  "bolum",
  "altbilgi",
  "blog",
  "iletisim",
  "whatsapp",
  "instagram",
  "diger",
] as const;

export type KayitKaynagi = (typeof KAYIT_KAYNAKLARI)[number];

/**
 * `?k=` değerini izin listesinden geçirir. Boşsa null (kaynak bilinmiyor:
 * öğrenci adresi kendisi yazdı); listede olmayan değer "diger". Serbest metin
 * hiç yazılmaz: adres çubuğuna yazılan her şey veritabanına girmesin.
 */
export function kayitKaynagi(deger: unknown): KayitKaynagi | null {
  const ham = Array.isArray(deger) ? deger[0] : deger;
  if (typeof ham !== "string") return null;
  const k = ham.trim().toLowerCase();
  if (k.length === 0) return null;
  return (KAYIT_KAYNAKLARI as readonly string[]).includes(k) ? (k as KayitKaynagi) : "diger";
}

/**
 * Kimlik sayfaları arasında taşınan parametreler (giriş ↔ kayıt):
 * `sonra`, `grup` (davet kodu) ve `k`. Yalnızca doğrulanmış değerler
 * yazılır; boşsa soru işareti de yok.
 */
export function kimlikAdresi(
  yol: "/giris" | "/kayit",
  p: { sonra?: string | null; grup?: string | null; k?: string | null }
): string {
  const q = new URLSearchParams();
  if (p.sonra) q.set("sonra", p.sonra);
  if (p.grup) q.set("grup", p.grup);
  if (p.k) q.set("k", p.k);
  const s = q.toString();
  return s ? `${yol}?${s}` : yol;
}
