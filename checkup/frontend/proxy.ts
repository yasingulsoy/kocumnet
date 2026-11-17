import { NextResponse, type NextRequest } from "next/server";
import { KAYNAK_CEREZI, KAYNAK_ETIKETLERI, OTURUM_CEREZI, cerezAyarlari } from "@/lib/cerezler";

/**
 * Next 16'da middleware'in adı proxy. Burada yalnızca HAFİF işler var:
 *
 *  1. Korunan sayfaya oturum çerezi olmadan gelen tarayıcıyı girişe yollar
 *     (?donus= ile). Çerezin GEÇERLİ olup olmadığına burada bakılmaz: asıl
 *     denetim sunucuda, her sayfa ve eylem jetonu backend'e götürür
 *     (lib/backend.ts). Proxy tek başına güvenlik sınırı değildir.
 *  2. kocum.net'ten gelen bağlantılar ?k=<etiket> taşır. Etiket izin
 *     listesindeyse 30 günlük `kaynak` çerezine yazılır; kayıtta backend'e gider.
 */

const KORUNAN = ["/panel", "/sinav-sec", "/test", "/rapor", "/profil"];

function korunanMi(yol: string): boolean {
  return KORUNAN.some((k) => yol === k || yol.startsWith(`${k}/`));
}

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  let yanit: NextResponse;
  if (korunanMi(pathname) && !request.cookies.has(OTURUM_CEREZI)) {
    const giris = new URL("/giris", request.url);
    giris.searchParams.set("donus", pathname + search);
    yanit = NextResponse.redirect(giris);
  } else {
    yanit = NextResponse.next();
  }

  const k = searchParams.get("k");
  if (k && KAYNAK_ETIKETLERI.has(k)) {
    yanit.cookies.set(KAYNAK_CEREZI, k, cerezAyarlari());
  }

  return yanit;
}

export const config = {
  matcher: [
    /*
     * Statik dosyalar, görseller ve ikonlar dışında her yol. Sunucu eylemleri
     * sayfaya POST olarak gelir; onların denetimi de backend'de.
     */
    "/((?!_next/static|_next/image|medya/|icons/|brand/|favicon.ico|icon.svg|apple-icon.png|opengraph-image|robots.txt).*)",
  ],
};
