import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { ROUTE_KEYS, ROUTE_SEGMENTS } from "@/lib/routes";

/**
 * Next.js 16'da Middleware'in adı Proxy oldu (proxy.ts).
 *
 * Amaç: Türkçe (varsayılan dil) KÖKTE servis edilsin — /hizmetlerimiz gibi.
 * Uygulama içinde tüm rotalar app/[lang]/... altında olduğundan, kök yollar
 * içeriden /tr/<kanonik-segment> adresine REWRITE edilir (URL değişmez).
 *
 *   /                 → /tr            (rewrite)
 *   /hizmetlerimiz    → /tr/services   (rewrite)
 *   /blog/bir-yazi    → /tr/blog/bir-yazi (rewrite)
 *   /en/services      → dokunulmaz (zaten kanonik)
 *   /tr/services      → /hizmetlerimiz'e 308 (çift içeriği önler)
 */

const PREFIXED_LOCALES = ["en", "ar"] as const;

/** Türkçe görünen segment → kanonik klasör adı  (ör. "hizmetlerimiz" → "services") */
const TR_SEGMENT_TO_CANONICAL = new Map<string, string>(
  ROUTE_KEYS.filter((key) => ROUTE_SEGMENTS[key][DEFAULT_LOCALE]).map((key) => [
    ROUTE_SEGMENTS[key][DEFAULT_LOCALE],
    key === "home" ? "" : key,
  ])
);

/** Kanonik klasör adı → Türkçe görünen segment (ör. "services" → "hizmetlerimiz") */
const CANONICAL_TO_TR_SEGMENT = new Map<string, string>(
  ROUTE_KEYS.map((key) => [key === "home" ? "" : key, ROUTE_SEGMENTS[key][DEFAULT_LOCALE]])
);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  // /en/... ve /ar/... zaten kanonik yapıda → dokunma
  if (first && (PREFIXED_LOCALES as readonly string[]).includes(first)) {
    return NextResponse.next();
  }

  // /tr/... → kanonik Türkçe köke 308 (aynı içerik iki URL'de görünmesin)
  if (first === DEFAULT_LOCALE) {
    const canonical = segments[1] ?? "";
    const trSegment = CANONICAL_TO_TR_SEGMENT.get(canonical);
    // Bilinmeyen segment ise dokunma (404'e düşsün)
    if (trSegment === undefined) return NextResponse.next();

    const rest = segments.slice(2).join("/");
    const target = ["", trSegment, rest].filter(Boolean).join("/");
    const url = request.nextUrl.clone();
    url.pathname = target ? `/${target}` : "/";
    return NextResponse.redirect(url, 308);
  }

  // Kök (Türkçe) yollar → içeriden /tr/<kanonik> olarak servis et
  const canonical = first === undefined ? "" : TR_SEGMENT_TO_CANONICAL.get(first);

  // Tanımadığımız bir kök yol → dokunma; [lang] eşleşmesi başarısız olup 404 verir
  if (canonical === undefined) return NextResponse.next();

  const rest = segments.slice(1).join("/");
  const url = request.nextUrl.clone();
  url.pathname = `/${[DEFAULT_LOCALE, canonical, rest].filter(Boolean).join("/")}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Statik dosyalar, API ve Next dahili yollar hariç her istek
  matcher: [
    "/((?!api|_next/static|_next/image|images|uploads|favicon.ico|icon.svg|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};
