import { NextResponse, type NextRequest } from "next/server";
import { ISTENEN_YOL_BASLIGI, OTURUM_GUN, SESSION_COOKIE } from "@/lib/hesap-kurallari";

/**
 * Sayfa isteklerinin önünde iki küçük iş (Next 16'da middleware'in adı proxy).
 *
 * 1. İstenen yol: isteğe `x-kocum-yol` başlığı eklenir. Server Component kendi
 *    adresini bilmiyor; giriş isteyen sayfa girişe yönlendirirken bunu
 *    `?sonra=` olarak taşır (lib/auth.ts girisAdresi). İstemcinin gönderdiği
 *    aynı adlı başlık her zaman EZİLİR; değer yine de guvenliSonra'dan geçer.
 *
 * 2. Kayan oturum çerezi: oturum çerezi varsa aynı değerle, OTURUM_GUN'lük
 *    süreyle yeniden yazılır. Veritabanındaki bitişi getCurrentUser uzatıyor
 *    (kalan süre 15 günün altına inince); çerez Server Component'te
 *    yazılamadığı için burada. Çerez süresi asıl sınır değil: geçerliliği
 *    veritabanı söyler, burada veritabanına bakılmaz (proxy ayrı paketleniyor,
 *    Prisma buraya girmesin). Bilinmeyen ya da süresi dolmuş jetonun çerezi
 *    uzasa da bir işe yaramaz; giriş yeni çerez yazar.
 *    Yalnızca GET: eylemler (POST) çerezi kendisi yazıyor ya da siliyor
 *    (giriş, çıkış). Aynı yanıta iki Set-Cookie düşerse hangisinin kazanacağı
 *    sıraya kalırdı ve çıkış yapan öğrencinin çerezi geri gelebilirdi.
 *
 * Kimlik denetimi burada YAPILMAZ: her sayfa ve eylem kendisi denetliyor
 * (Next'in önerisi de bu; eşleyici değişince proxy sessizce devre dışı kalabilir).
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const arama = new URLSearchParams(url.search);
  // İstemci gezinmesinin önbellek anahtarı; sayfanın adresi değil.
  arama.delete("_rsc");
  const q = arama.toString();

  const basliklar = new Headers(request.headers);
  basliklar.set(ISTENEN_YOL_BASLIGI, url.pathname + (q ? `?${q}` : ""));
  const yanit = NextResponse.next({ request: { headers: basliklar } });

  const jeton = request.cookies.get(SESSION_COOKIE)?.value;
  if (jeton && request.method === "GET") {
    yanit.cookies.set(SESSION_COOKIE, jeton, {
      httpOnly: true,
      // lib/auth.ts createSession ile aynı ayarlar.
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OTURUM_GUN * 86_400,
    });
  }
  return yanit;
}

export const config = {
  // Sayfalar: bakım ve görsel uçları (api), Next'in dosyaları ve uzantılı
  // dosyalar (simge, KaTeX stili, paylaşım görseli) hariç.
  matcher: ["/((?!api/|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
