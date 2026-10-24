import { MD_TURU, dosyaYaniti, indirmeYetkisi } from "@/lib/checkup/indirme";
import { ORNEK_SORU_DOSYASI } from "@/lib/checkup/shared/belgeler";

/**
 * "Örnek dosya": 3 soruluk, biri şekilli örnek (app/scripts/fixtures/ornek-gorselli.md).
 * Şekil ayrı bağlantıdan iner (ornek-sekil); ikisi aynı klasöre konup birlikte
 * seçilince Denetle üç soruyu da geçerli bulur — app/scripts/icerik-panel-test.mts
 * bunu denetliyor.
 */
export async function GET() {
  const yetkisiz = await indirmeYetkisi();
  if (yetkisiz) return yetkisiz;
  return dosyaYaniti(ORNEK_SORU_DOSYASI, "ornek-sorular.md", MD_TURU);
}
