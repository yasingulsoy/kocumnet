/**
 * İçerik alanlarının uzunluk sınırları — SUNUCU/İSTEMCİ ORTAK saf modül.
 * Form sayaçları ve eylemlerin zod şemaları aynı sayıyı kullanır.
 *
 * Sınırlar yazım biçimindeki (markup) karakter sayısı: yazarın gördüğü ve
 * saydığı metin. Veritabanında ayrıca sınır yok.
 *
 * İpucu SAYISI burada değil: tek kaynağı shared/question-content.ts MAX_HINTS
 * (o modül istemciye alınamıyor, sayfa forma prop olarak geçiriyor).
 */

/** Bir ipucu: bir-iki cümle ve formül. Daha uzunu çözümün kendisidir. */
export const IPUCU_SINIRI = 600;

/** Video adresi: YouTube/Vimeo adresleri 100 karakteri geçmez; parametreli kopyalara pay. */
export const VIDEO_ADRES_SINIRI = 500;

/**
 * Kazanım özet kartı (Objective.summary): sonuç ekranında ve defterde, yanlış
 * yapılan kazanımın altında çıkan 3-5 satırlık kart. Kısa kalmalı: öğrenci
 * onu okuyup soruya döner, ders anlatımı başka yerde.
 */
export const OZET_KARTI_SINIRI = 1200;
