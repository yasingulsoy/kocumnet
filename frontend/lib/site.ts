/**
 * Kanonik site adresi. Üretimde .env içinde NEXT_PUBLIC_SITE_URL tanımlayın (örn. https://www.ornek.com).
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/**
 * Matematik Check-up uygulamasının adresi (NEXT_PUBLIC_CHECKUP_URL; derleme
 * anında gömülür, bkz. DEPLOY.md). Ana sayfadaki check-up bölümü, başlık
 * şeridi, mobil menü ve altbilgi bunu okur.
 *
 * Tanımlı değilse (ya da http ile başlamıyorsa) check-up bağlantılarının
 * HİÇBİRİ çıkmaz: uygulama yayına alınmadan sitede 404'e giden bir düğme
 * durmasın. Uygulama açılınca tek değişkenle her yerde görünür.
 */
const checkupHam = process.env.NEXT_PUBLIC_CHECKUP_URL?.trim() ?? "";
export const CHECKUP_URL: string | null = /^https?:\/\//.test(checkupHam)
  ? checkupHam.replace(/\/$/, "")
  : null;
