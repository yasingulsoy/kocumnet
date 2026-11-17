import { dosyaAl, hataYaniti, multipartAktar } from "@/lib/aktarim";

/**
 * Soru görseli yükleme: tarayıcı → burası → POST /api/admin/gorseller.
 * Server action değil: gövde 1 MB sınırına takılırdı (görsel 10 MB'a kadar).
 * Yanıt: IslemSonucu<{ id, genislik, yukseklik }>.
 */
const TURLER = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(istek: Request) {
  const alinan = await dosyaAl(istek);
  if (alinan instanceof Response) return alinan;
  const { dosya } = alinan;
  if (dosya.type && !TURLER.has(dosya.type)) return hataYaniti("DOGRULAMA", "Yalnızca PNG, JPEG ya da WebP yükleyebilirsiniz.");

  const govde = new FormData();
  govde.append("dosya", dosya, dosya.name || "gorsel");
  return multipartAktar("/admin/gorseller", govde);
}
