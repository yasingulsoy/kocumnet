import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * Rota anahtarı = app/[lang]/ altındaki KANONİK klasör adı.
 * Değerler = kullanıcıya görünen (lokalize) yol parçası.
 *
 * Türkçe kökte servis edilir: /hizmetlerimiz  → içeride /tr/services
 * Diğer diller prefixli:      /en/services, /ar/services
 * Bu eşleme proxy.ts tarafından da kullanılır — tek kaynak burasıdır.
 */
export const ROUTE_SEGMENTS = {
  home: { tr: "", en: "", ar: "" },
  about: { tr: "kurumsal", en: "about", ar: "about" },
  services: { tr: "hizmetlerimiz", en: "services", ar: "services" },
  blog: { tr: "blog", en: "blog", ar: "blog" },
  contact: { tr: "iletisim", en: "contact", ar: "contact" },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteKey = keyof typeof ROUTE_SEGMENTS;

export const ROUTE_KEYS = Object.keys(ROUTE_SEGMENTS) as RouteKey[];

/** Kullanıcıya görünen yol: localizedPath("services", "en") -> "/en/services" */
export function localizedPath(key: RouteKey, locale: Locale, suffix?: string): string {
  const segment = ROUTE_SEGMENTS[key][locale];
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  const base = segment ? `${prefix}/${segment}` : prefix || "/";
  const tail = suffix ? `/${suffix.replace(/^\/+/, "")}` : "";
  const full = `${base}${tail}`;
  return full === "" ? "/" : full;
}

/** Blog detay yolu: blogPath("my-slug", "ar") -> "/ar/blog/my-slug" */
export function blogPath(slug: string, locale: Locale): string {
  return localizedPath("blog", locale, slug);
}

/**
 * hreflang alternates — metadata.alternates.languages için.
 * suffix: blog slug'ı gibi dinamik kuyruk (opsiyonel).
 */
export function languageAlternates(
  key: RouteKey,
  suffix?: string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    out[locale] = localizedPath(key, locale, suffix);
  }
  // Dil belirtmeyen kullanıcılar için varsayılan
  out["x-default"] = localizedPath(key, DEFAULT_LOCALE, suffix);
  return out;
}

/**
 * Görünen yoldan rota anahtarını bul (dil değiştirici için).
 * "/en/services" -> { key: "services", locale: "en", suffix: undefined }
 * "/blog/abc"    -> { key: "blog", locale: "tr", suffix: "abc" }
 */
export function matchRoute(
  pathname: string
): { key: RouteKey; locale: Locale; suffix?: string } | null {
  const parts = pathname.split("/").filter(Boolean);

  let locale: Locale = DEFAULT_LOCALE;
  if (parts.length > 0 && (LOCALES as readonly string[]).includes(parts[0])) {
    locale = parts[0] as Locale;
    parts.shift();
  }

  if (parts.length === 0) return { key: "home", locale };

  const segment = parts[0];
  const suffix = parts.slice(1).join("/") || undefined;

  for (const key of ROUTE_KEYS) {
    if (ROUTE_SEGMENTS[key][locale] === segment) {
      return { key, locale, suffix };
    }
  }
  return null;
}

/** Dil değiştirici: aynı sayfanın hedef dildeki karşılığı. Bulunamazsa o dilin ana sayfası. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const match = matchRoute(pathname);
  if (!match) return localizedPath("home", target);
  // Blog detayında slug dile özgüdür; hedef dilde aynı slug olmayabilir → blog listesine gönder.
  if (match.key === "blog" && match.suffix) {
    return localizedPath("blog", target);
  }
  return localizedPath(match.key, target, match.suffix);
}
