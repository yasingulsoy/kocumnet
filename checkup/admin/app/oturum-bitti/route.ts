import { NextResponse, type NextRequest } from "next/server";
import { OTURUM_CEREZI, girisAdresi, guvenliYol } from "@/lib/backend";

/**
 * Backend jetonu reddetti (süresi doldu, yönetici pasif yapıldı…). Sunucu
 * bileşeni çerezi silemediği için buraya yönlendirir: çerez silinir, giriş
 * sayfasına gidilir; girişten sonra kalınan sayfaya dönülür.
 */
export async function GET(istek: NextRequest) {
  const sonraki = guvenliYol(istek.nextUrl.searchParams.get("sonraki"));
  const yanit = NextResponse.redirect(new URL(girisAdresi(sonraki, "bitti"), istek.nextUrl));
  yanit.cookies.delete(OTURUM_CEREZI);
  return yanit;
}
