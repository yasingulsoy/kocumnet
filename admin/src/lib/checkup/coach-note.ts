/**
 * Koç notu (StudyPlan.coachNote) — kurallar. Saf modül: düzenleyici
 * (istemci) ve eylem (sunucu) aynı sınırı ve aynı temizliği kullanır.
 *
 * Öğrenci notu panosunda, bu haftanın plan kartında görür ("Koç notu: …").
 * Pazartesi postası yalnızca o an plan varsa notu taşır; plan çoğunlukla
 * haftanın ilk check-up'ıyla kurulduğu için postaya genelde girmez. Plan
 * oluşurken sistem bir not yazıyor (app/lib/coaching.ts kocNotu); personel
 * onu değiştirebilir ya da kaldırabilir. Kaldırılırsa kartta not görünmez.
 */

/** "Koçun o haftaki tek cümlesi" (şema) — kartta tek paragraf. */
export const KOC_NOTU_SINIR = 280;

/**
 * Satır sonu ve denetim karakterleri boşluğa iner, boşluklar tekilleşir.
 * Kart notu tek paragraf çiziyor; postada satır sonu düz metinde dağılıyordu.
 */
export function kocNotunuTemizle(ham: string): string {
  return ham
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
