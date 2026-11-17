/**
 * Sunucu saati. Süre kuralları ve oturum bitişleri bunu kullanır; testler
 * ileri sarılabilen bir saat verir (createApp({ saat })).
 */
export interface Saat {
  simdi(): Date;
}

export const sistemSaati: Saat = { simdi: () => new Date() };
