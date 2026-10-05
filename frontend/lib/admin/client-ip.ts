import "server-only";
import { isIP } from "node:net";
import { headers } from "next/headers";

/**
 * İsteği yapan tarayıcının IP'si (sunucu tarafı).
 *
 * Önümüzde TEK bir güvenilir vekil varsayılır (Dokploy/Traefik): onun
 * yazdığı `x-real-ip`, yoksa `x-forwarded-for`'un SON öğesi (vekilin
 * eklediği). İlk öğe kullanılmaz: istemci başlığı kendisi gönderip
 * istediği IP'yi yazabilir. Bulunamazsa ya da geçersizse null.
 */
export async function istemciIp(): Promise<string | null> {
  let h: Awaited<ReturnType<typeof headers>>;
  try {
    h = await headers();
  } catch {
    return null; // istek bağlamı dışı (ör. derleme sırasında)
  }
  const xff = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ip = (h.get("x-real-ip") ?? "").trim() || xff[xff.length - 1] || "";
  return isIP(ip) ? ip : null;
}
