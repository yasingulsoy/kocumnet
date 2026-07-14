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
