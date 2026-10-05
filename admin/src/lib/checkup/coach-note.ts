/**
 * Koç notu (StudyPlan.coachNote) — kurallar. Saf modül: düzenleyici
 * (istemci) ve eylem (sunucu) aynı sınırı ve aynı temizliği kullanır.
 *
 * Öğrenci notu iki yerde görür: panodaki plan kartında ("Koç notu: …") ve
 * pazartesi koçluk postasında. Plan oluşurken sistem bir not yazıyor
 * (app/lib/coaching.ts kocNotu); personel onu değiştirebilir ya da
 * kaldırabilir. Kaldırılırsa kartta not görünmez, postada genel bir cümle
 * gider.
 */

/** "Koçun o haftaki tek cümlesi" (şema) — kartta tek paragraf, postada tek satır. */
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
