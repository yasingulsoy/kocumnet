import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/backend";
import { OTURUM_CEREZI } from "@/lib/cerezler";
import type { Ogrenci } from "@/lib/tipler";

/**
 * Oturum düştü: çerezi siler ve girişe yollar.
 *
 * Sunucu bileşeni çizilirken çerez silinemez (Next yalnızca eylemde ve route
 * handler'da izin veriyor); lib/backend.ts OTURUM_YOK görünce buraya
 * yönlendirir. Çerezi körlemesine silmiyoruz: jeton hâlâ geçerliyse
 * (başka bir sitenin koyduğu bağlantıyla buraya gelindiyse) panele döneriz.
 */
export async function GET(istek: NextRequest) {
  if (istek.cookies.has(OTURUM_CEREZI)) {
    const sonuc = await api<{ ogrenci: Ogrenci }>("/ogrenci/ben", { sessiz: true });
    if (sonuc.ok) return NextResponse.redirect(new URL("/panel", istek.url));
    if (sonuc.hata.kod === "OTURUM_YOK") {
      const yanit = NextResponse.redirect(new URL("/giris?oturum=bitti", istek.url));
      yanit.cookies.delete(OTURUM_CEREZI);
      return yanit;
    }
  }
  return NextResponse.redirect(new URL("/giris", istek.url));
}
