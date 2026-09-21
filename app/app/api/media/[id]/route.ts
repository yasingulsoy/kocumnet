import { prisma } from "@/lib/db";

/**
 * Görsel servisi. Baytlar veritabanında duruyor (şemadaki gerekçeye bak).
 *
 * Yetki denetimi YOK, bilinçli: görseller soru gövdesinin parçası ve zaten
 * teste giren öğrenciye gösteriliyor. Kimlik tahmin edilemez (cuid) ve
 * cevap anahtarı içermiyor. Yetki koysaydık, `<img>` etiketleri çerez
 * göndermeyen bağlamlarda (ileride PDF/e-posta) kırılırdı.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: { data: true, mimeType: true, byteSize: true },
  });

  if (!asset) {
    return new Response("Bulunamadı", { status: 404 });
  }

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.byteSize ?? asset.data.byteLength),
      /*
       * Görselin içeriği hiç değişmez — değiştirmek gerekirse yeni kayıt
       * açılır ve soru yeni kimliği gösterir. Bu yüzden sonsuza yakın
       * önbellek güvenli ve her soru açılışında veritabanına gitmeyi önler.
       */
      "Cache-Control": "public, max-age=31536000, immutable",
      // Tarayıcı içerik tipini kendi tahmin etmesin.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
