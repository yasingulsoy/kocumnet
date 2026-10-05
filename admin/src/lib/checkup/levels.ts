/**
 * Seviyeli check-up'ın soru sayıları — panelin hazırlık sayaçları için ince
 * sarmalayıcı. Sayılar öğrenci uygulamasının kendi ayarından geliyor:
 * `shared/levels.ts` (app/lib/levels.ts'in kopyası, `npm run checkup:sync`).
 * Eskiden burada elle tutulan bir ayna vardı; hoca sayıları değiştirince
 * panel sessizce eski hedefi gösterirdi. Artık `checkup:check` (CI dahil)
 * kopya eskiyse hata veriyor.
 *
 * Kapı kararlarını panel vermez; yalnızca "kaç kazanım / kaç soru gerekiyor"
 * sorusuna aynı cevabı verir.
 */
import { isExamScope } from "./shared/exams";
import { VARSAYILAN_AYAR, ayarGetir, type SeviyeliSinavAyari } from "./shared/levels";

export interface LevelSizes {
  /** Seviye 1 soru sayısı = kazanım sayısı (her kazanımdan bir soru). */
  seviye1: number;
  seviye2: number;
  seviye3: number;
}

/** Sınavın seviye soru sayıları. Bilinmeyen (eski "BOTH" gibi) değerde varsayılan ayar. */
export function levelSizes(exam: string): LevelSizes {
  const ayar: SeviyeliSinavAyari = isExamScope(exam) ? ayarGetir(exam) : VARSAYILAN_AYAR;
  return {
    seviye1: ayar.seviye1.soruSayisi,
    seviye2: ayar.seviye2.soruSayisi,
    seviye3: ayar.seviye3.soruSayisi,
  };
}

/**
 * Bir kazanımın seviye 1'e "hazır" sayılması için gereken en az yayında L1
 * sorusu. Bir değil iki: telafi turu aynı kazanımdan YENİ soru ister — tek
 * sorulu kazanımda telafi boş kalır. (Öğrenci uygulamasında böyle bir eşik
 * yok; seçim bir soruyla da başlar. Bu, panelin "sağlıklı" ölçüsü.)
 */
export const MIN_L1_PER_OBJECTIVE = 2;
