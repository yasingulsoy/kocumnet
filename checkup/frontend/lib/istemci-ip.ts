import "server-only";
import { headers } from "next/headers";
import { istemciIpBelirle } from "./istemci-ip-kurali";

/**
 * İsteği yapan tarayıcının IP'si (sunucu tarafı). Bulunamazsa null.
 * Kural istemci-ip-kurali.ts'te. x-forwarded-for kullanılmaz: Traefik onu
 * da kenar sunucusunun adresiyle yeniden yazıyor.
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
