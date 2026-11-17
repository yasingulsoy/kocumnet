import { NextResponse, type NextRequest } from "next/server";
import { backendHam, girisAdresi, yanitiCoz } from "@/lib/backend";

/**
 * Excel şablonu: GET /api/admin/ice-aktar/sablon?sinavId= yanıtını aynen
 * aktarır (Content-Type ve Content-Disposition korunur). Tarayıcı bu adrese
 * doğrudan gider (indirme bağlantısı); hata olursa düz metin gösterilir.
 */
export async function GET(istek: NextRequest) {
  const sinavId = Number(istek.nextUrl.searchParams.get("sinavId"));
  if (!Number.isSafeInteger(sinavId) || sinavId <= 0) {
    return new Response("Önce sınavı seçin.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const res = await backendHam(`/admin/ice-aktar/sablon?sinavId=${sinavId}`);
  if (res && res.ok && res.body) {
    const h = new Headers();
    for (const ad of ["content-type", "content-disposition", "content-length"]) {
      const v = res.headers.get(ad);
      if (v) h.set(ad, v);
    }
    if (!h.has("content-disposition")) h.set("content-disposition", `attachment; filename="soru-sablonu-${sinavId}.xlsx"`);
    h.set("cache-control", "no-store");
    return new Response(res.body, { status: 200, headers: h });
  }

  const s = await yanitiCoz(res);
  if (!s.ok && s.hata.kod === "OTURUM_YOK") {
    const hedef = new URL(girisAdresi("/ice-aktar", "bitti"), istek.nextUrl);
    return NextResponse.redirect(hedef);
  }
  const mesaj = s.ok ? "Şablon alınamadı." : s.hata.mesaj;
  return new Response(`Şablon indirilemedi: ${mesaj}`, {
    status: s.ok ? 502 : s.hata.durum || 502,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
