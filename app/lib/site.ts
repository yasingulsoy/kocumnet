/**
 * Destek adresi — tek yerde. Eskiden iki sayfada elle yazılıydı ve env'i yok
 * sayıyordu; posta ve parola sıfırlama da kendi yedeğini (info@) yazıyordu.
 * Canlıda kullanılan adres bilgi@.
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "bilgi@kocum.net";

/**
 * Uygulamanın tam adresi (postadaki bağlantılar, metadataBase). Sondaki /
 * atılır.
 *
 * Değişken boşsa üretimde localhost'a DÜŞMEZ: unutulan bir değişken
 * yüzünden öğrencilere giden her posta "localhost:3100" bağlantısı
 * taşıyordu.
 */
export function appUrl(): string {
  const ayarli = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const yedek = process.env.NODE_ENV === "production" ? "https://checkup.kocum.net" : "http://localhost:3100";
  return (ayarli || yedek).replace(/\/$/, "");
}
