/**
 * Vitrin kök URL — env (build zamanı) veya admin alt alanından türetme.
 */

const ADMIN_HOST_PREFIXES = ["admin.", "www.admin."] as const;

function stripAdminFromHostname(host: string): string | null {
  const h = host.toLowerCase();
  for (const prefix of ADMIN_HOST_PREFIXES) {
    if (h.startsWith(prefix)) return h.slice(prefix.length);
  }
  return null;
}

/**
 * Env'deki kök URL admin alt alanına işaret ediyorsa vitrin köküne çevirir
 * (örn. https://admin.dekoartizan.com -> https://dekoartizan.com).
 */
function normalizeEnvOriginToStorefront(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    const mainHost = stripAdminFromHostname(u.hostname);
    if (mainHost) u.hostname = mainHost;
    return u.origin;
  } catch {
    return trimmed;
  }
}

export function getStorefrontOriginFromEnv(): string {
  const raw =
    process.env.NEXT_PUBLIC_STOREFRONT_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  return normalizeEnvOriginToStorefront(raw);
}

/**
 * Tarayıcıda: admin örnek.com (veya portlu origin) -> aynı şemayla örnek.com
 */
export function getStorefrontOriginFromAdminSubdomain(): string {
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  const mainHost = stripAdminFromHostname(hostname);
  if (!mainHost) return "";
  const portPart = port ? `:${port}` : "";
  return `${protocol}//${mainHost}${portPart}`;
}

export function getStorefrontProductPath(productSlug: string): string {
  return `/magaza/urunler/${encodeURIComponent(productSlug)}`;
}
