import { MD_TURU, dosyaYaniti, indirmeYetkisi } from "@/lib/checkup/indirme";
import { SORU_SABLONU } from "@/lib/checkup/shared/belgeler";

/**
 * "Şablonu indir": app/SORU-SABLONU.md'nin kendisi. Panel app/ olmadan da
 * çalışsın diye kopyadan (shared/belgeler.ts, `npm run checkup:sync`).
 */
export async function GET() {
  const yetkisiz = await indirmeYetkisi();
  if (yetkisiz) return yetkisiz;
  return dosyaYaniti(SORU_SABLONU, "SORU-SABLONU.md", MD_TURU);
}
