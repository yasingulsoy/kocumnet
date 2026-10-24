import { createHash, randomBytes } from "node:crypto";

/**
 * Personelin ürettiği parola sıfırlama bağlantısı — jeton biçimi ve sınırlar.
 *
 * Neden var: e-posta altyapısı henüz yok; parolasını unutan öğrenciye koç
 * bağlantıyı panelden üretip WhatsApp'tan iletir. Bağlantıyı öğrenci
 * uygulamasının KENDİ sıfırlama ekranı açar (`/sifre-sifirla/<jeton>`,
 * app/lib/actions/password-reset.ts resetPasswordAction): panel yalnızca
 * PasswordResetToken satırını yazar.
 *
 * ⚠️ APP İLE EŞİT OLMALI (app/lib/actions/password-reset.ts):
 *   jeton  = randomBytes(32).toString("base64url")
 *   özet   = sha256(jeton) hex   (tabloda yalnızca özet durur, jeton değil)
 *   adres  = <uygulama>/sifre-sifirla/<jeton>
 * Orada hashToken dışa aktarılmıyor ve dosya "use server" (server-only
 * zinciri); ortak bir saf modüle taşınana kadar burada aynısı yazılı.
 * app/scripts/koc-panel-test.mts iki tarafın bu üç kuralını karşılaştırır.
 *
 * "server-only" bilerek yok: test betiği bu dosyayı tsx ile yüklüyor. İstemci
 * bileşeni zaten içe aktaramaz (node:crypto).
 */

/** Bağlantı 24 saat geçerli ve tek kullanımlık (uygulama kullanınca usedAt yazar). */
export const SIFIRLAMA_GECERLILIK_SAAT = 24;

/**
 * Personel başına saatte en çok kaç bağlantı. Sayaç veritabanından
 * (PasswordResetToken.createdByStaff): panelde bellek içi bir sınırlayıcı
 * yok ve olsa da her kopya ayrı sayardı. Bir sınıfın parolasını aynı saatte
 * sıfırlamak olağan değil; 5 hem gerçek ihtiyaca yeter hem ele geçirilmiş bir
 * personel hesabının toplu hesap ele geçirmesini yavaşlatır.
 */
export const SIFIRLAMA_SAATLIK_SINIR = 5;

/** Ekrandaki uyarı (tek yerde: kart ve pencere aynı cümleyi kullanır). */
export const SIFIRLAMA_UYARISI = "Bu bağlantıyla öğrencinin parolası değiştirilebilir. Yalnızca öğrencinin kendisine ilet.";

export function sifirlamaJetonuUret(): string {
  return randomBytes(32).toString("base64url");
}

/** Veritabanına yazılan özet — app'in hashToken'ı ile aynı. */
export function sifirlamaJetonuOzeti(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export function sifirlamaBaglantisi(uygulamaKoku: string, jeton: string): string {
  return uygulamaKoku.replace(/\/$/, "") + "/sifre-sifirla/" + jeton;
}

/**
 * Personel damgasının "(#id)" kuyruğu: sayaç e-postaya değil kimliğe bakar,
 * personelin e-postası değişse de sınır sıfırlanmasın (staffStamp biçimi).
 */
export function damgaKimligi(personelId: number): string {
  return "(#" + personelId + ")";
}
