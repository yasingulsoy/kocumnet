/**
 * Öğrenci uygulamasının kök adresi (checkup.kocum.net): panelin ürettiği
 * bağlantılar (grup daveti, parola sıfırlama) bunun üstüne kurulur.
 *
 * Uygulamanın kendi kuralıyla AYNI (app/lib/site.ts appUrl): aynı ortam
 * değişkeni, aynı yedekler. Panelde NEXT_PUBLIC_APP_URL tanımlı değilse
 * üretimde gerçek adres, geliştirmede uygulamanın yerel portu (3100) çıkar.
 * NEXT_PUBLIC_ değişkeni derlemede gömülür: Dokploy'da derleme ortamında da
 * tanımlı olmalı.
 */
export function uygulamaAdresi(): string {
  const ayarli = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const yedek = process.env.NODE_ENV === "production" ? "https://checkup.kocum.net" : "http://localhost:3100";
  return (ayarli || yedek).replace(/\/$/, "");
}
