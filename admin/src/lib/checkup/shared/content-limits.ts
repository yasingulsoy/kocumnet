// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/content-limits.ts · eşitlemek için: npm run checkup:sync

/**
 * Soru ve kazanım içeriğinin uzunluk sınırları — SAF modül, hiçbir şey içe
 * aktarmaz (panelin istemci bileşenleri de alabilsin).
 *
 * Neden ortak: panelin soru formu (admin/src/lib/checkup/actions/questions.ts)
 * ile toplu içe aktarma (lib/question-import.ts, komut satırı ve panel) aynı
 * sayıyla reddetmeli. Eskiden içe aktarma 900 karakterlik ipucunu ya da
 * 250 karakterlik kaynağı kabul ediyor, form o soruyu bir daha kaydetmiyordu:
 * yazar başka bir şeyi düzeltmeye çalışırken "ipucu çok uzun" hatası alıyordu.
 * Panel bu dosyanın kopyasını kullanır (admin/scripts/checkup-sync.mjs).
 *
 * Sınırlar yazım biçimindeki (markup) karakter sayısı: yazarın gördüğü ve
 * saydığı metin, baştaki ve sondaki boşluk hariç. Veritabanında ayrıca sınır yok.
 *
 * İpucu SAYISI burada değil: tek kaynağı question-content.ts MAX_HINTS (o
 * modül node:crypto kullandığı için panelin istemcisine alınamıyor).
 */

/** Soru metni en az: "x kaç?" bile 5 karakteri geçer; daha kısası yarım yapıştırma. */
export const SORU_METNI_EN_AZ = 5;

/** Bir ipucu: bir-iki cümle ve formül. Daha uzunu çözümün kendisidir. */
export const IPUCU_SINIRI = 600;

/**
 * Kaynak (Question.sourceRef), içe aktarmada "ID · kaynak" biçiminde saklanan
 * TAMAMI: formdaki "Kaynak" kutusu bu değeri gösterip aynı sınırla kaydediyor.
 */
export const KAYNAK_SINIRI = 200;

/** Video adresi: YouTube/Vimeo adresleri 100 karakteri geçmez; parametreli kopyalara pay. */
export const VIDEO_ADRES_SINIRI = 500;

/** Hedef (ideal) süre, saniye: bunun üstü öğrenciye "yavaş" diye döner. */
export const HEDEF_SURE_SINIRI = { min: 10, max: 600 } as const;

/** Kazanım adı: listede ve sonuç ekranında tek satır başlık. */
export const KAZANIM_ADI_SINIRI = { min: 3, max: 200 } as const;

/**
 * Kazanım özet kartı (Objective.summary): sonuç ekranında ve defterde, yanlış
 * yapılan kazanımın altında çıkan 3-5 satırlık kart. Kısa kalmalı: öğrenci
 * onu okuyup soruya döner, ders anlatımı başka yerde.
 */
export const OZET_KARTI_SINIRI = 1200;
