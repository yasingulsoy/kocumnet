import { dosyaYaniti, indirmeYetkisi } from "@/lib/checkup/indirme";
import { ORNEK_SEKIL_PNG_BASE64 } from "@/lib/checkup/shared/belgeler";

/** Örnek dosyadaki şekilli sorunun görseli (ornek-sekil.png); .md ile aynı klasöre konur. */
export async function GET() {
  const yetkisiz = await indirmeYetkisi();
  if (yetkisiz) return yetkisiz;
  return dosyaYaniti(new Uint8Array(Buffer.from(ORNEK_SEKIL_PNG_BASE64, "base64")), "ornek-sekil.png", "image/png");
}
