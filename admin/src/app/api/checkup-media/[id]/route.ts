import { db } from "@/lib/checkup/db";
import { ANY_STAFF, checkStaff } from "@/lib/checkup/staff";

/**
 * Soru görselleri — yönetim panelindeki önizleme için.
 *
 * Baytlar check-up veritabanında (MediaAsset.data). Öğrenci uygulamasının
 * kendi görsel rotası herkese açık (görsel zaten teste giren öğrenciye
 * gösteriliyor); panel ise oturumsuz kimseye hiçbir şey sunmuyor — taslak
 * sorunun şekli de burada görünüyor.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/checkup-media/[id]">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) {
    return new Response("Yetkisiz", {
      status: gate.reason === "unreachable" ? 503 : 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { id } = await ctx.params;
  const asset = await db.mediaAsset.findUnique({
    where: { id },
    select: { data: true, mimeType: true, byteSize: true },
  });

  if (!asset) {
    return new Response("Bulunamadı", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.byteSize ?? asset.data.byteLength),
      // İçerik hiç değişmez (değişirse yeni kayıt açılır). "private": ara
      // önbellekler yetkili yanıtı başkasına sunmasın.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
