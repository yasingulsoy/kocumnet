/**
 * Süre kuralları (checkup/API.md "Süre"). Saf modül.
 *
 *   bitisSiniri = baslangic + sureDakika
 *   Cevaplar sınırdan sonra 15 saniye daha kabul edilir (ağ gecikmesi,
 *   son saniyede işaretlenen cevap). Sonrası SURE_DOLDU ve check-up kapanır.
 */
export const TOLERANS_MS = 15_000;

export function bitisSiniriHesapla(baslangic: Date, sureDakika: number): Date {
  return new Date(baslangic.getTime() + sureDakika * 60_000);
}

/** Tolerans da geçtiyse true: check-up kapatılmalı. */
export function suresiDoldu(simdi: Date, bitisSiniri: Date): boolean {
  return simdi.getTime() > bitisSiniri.getTime() + TOLERANS_MS;
}

/** Bitiş anı sınırı aşmaz: süre dolduktan sonra kapatılan check-up sınırda bitmiş sayılır. */
export function bitisAni(simdi: Date, bitisSiniri: Date): Date {
  return simdi.getTime() < bitisSiniri.getTime() ? simdi : bitisSiniri;
}

export function sureSaniye(baslangic: Date, bitis: Date): number {
  return Math.max(0, Math.round((bitis.getTime() - baslangic.getTime()) / 1000));
}
