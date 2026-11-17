import { NextResponse, type NextRequest } from "next/server";

/**
 * İyimser oturum denetimi: çerez yoksa sayfa çizilmeden girişe gidilir.
 * Asıl doğrulama sunucuda (lib/oturum.ts → GET /api/admin/ben) ve backend'de.
 *
 * Ayrıca sayfanın yolunu `x-yol` başlığıyla sunucuya taşır: oturumu düşen
 * yönetici girişten sonra kaldığı sayfaya döner.
 *
 * /api/** (yükleme ve indirme route handler'ları) burada değil: proxy gövdeyi
 * belleğe alıyor, büyük dosyalarda gereksiz. Onlar çerezi kendileri denetler.
 */
const OTURUM_CEREZI = "yonetici_oturum";
const ACIK = new Set(["/giris", "/oturum-bitti"]);

export function proxy(istek: NextRequest) {
  const { pathname, search } = istek.nextUrl;

  if (!ACIK.has(pathname) && !istek.cookies.get(OTURUM_CEREZI)?.value) {
    const hedef = istek.nextUrl.clone();
    hedef.pathname = "/giris";
    hedef.search = "";
    if (pathname !== "/" && istek.method === "GET" && !pathname.startsWith("/medya/")) {
      hedef.searchParams.set("sonraki", pathname + search);
    }
    return NextResponse.redirect(hedef);
  }

  const basliklar = new Headers(istek.headers);
  basliklar.set("x-yol", pathname + search);
  return NextResponse.next({ request: { headers: basliklar } });
}

export const config = {
  matcher: ["/((?!api/|_next/|icons/|favicon\\.ico|icon\\.svg|apple-icon\\.png|robots\\.txt).*)"],
};
