import "server-only";
import { headers } from "next/headers";
import { istemciIpBelirle } from "./client-ip-kurali";

/**
 * İsteği yapan tarayıcının IP'si (sunucu tarafı). Bulunamazsa ya da
 * geçersizse null.
 *
 * Kural client-ip-kurali.ts'te: Traefik'in yazdığı x-real-ip; o adres
 * Cloudflare'in kenar sunucusuysa cf-connecting-ip. x-forwarded-for
 * kullanılmaz: Traefik onu da kenar sunucusunun adresiyle yeniden yazıyor.
 */
export async function istemciIp(): Promise<string | null> {
  let h: Awaited<ReturnType<typeof headers>>;
  try {
    h = await headers();
  } catch {
    return null; // istek bağlamı dışı (ör. derleme sırasında)
  }
  return istemciIpBelirle(h.get("x-real-ip"), h.get("cf-connecting-ip"));
}
