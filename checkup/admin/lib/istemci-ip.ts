import "server-only";
import { headers } from "next/headers";
import { istemciIpBelirle } from "./istemci-ip-kurali";

/**
 * İsteği yapan tarayıcının IP'si (sunucu tarafı). Backend'e `x-istemci-ip`
 * olarak gider; backend hız sınırlarını buna göre sayar. Bulunamazsa null.
 */
export async function istemciIp(): Promise<string | null> {
  try {
    const h = await headers();
    return istemciIpBelirle(h.get("x-real-ip"), h.get("cf-connecting-ip"));
  } catch {
    return null; // istek bağlamı dışı (derleme sırasında)
  }
}
