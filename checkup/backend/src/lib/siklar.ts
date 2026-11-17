import { icerikHatasi } from "./icerik.js";

/**
 * Şık kuralları (checkup/API.md "Doğrulama"): tam 5 şık (A–E), metinler boş
 * değil, boşluk ve büyük-küçük harf farkı yok sayıldığında da ayrık, tam bir
 * doğru şık. Elle girişte ve Excel içe aktarmada aynı fonksiyon kullanılır.
 *
 * Saf modül. Hata anahtarları API'deki alan yoluyla aynıdır:
 *   siklar.<0-4>.metin, siklar.<0-4>.aciklama, dogruSik
 */

export const HARFLER = ["A", "B", "C", "D", "E"] as const;
export type Harf = (typeof HARFLER)[number];
export const SIK_SAYISI = 5;

export interface SikGirdisi {
  metin: string;
  aciklama?: string | null;
}

/** Ayrıklık karşılaştırması için: bütün boşluklar atılır, Türkçe küçük harf. */
export function sikNormalize(metin: string): string {
  return metin.replace(/\s+/g, "").toLocaleLowerCase("tr-TR");
}

export function harfSirasi(harf: string): number {
  return HARFLER.indexOf(harf.trim().toUpperCase() as Harf);
}

/** Hata yoksa boş nesne döner. */
export function siklariDenetle(siklar: SikGirdisi[], dogruSik: string | null | undefined): Record<string, string> {
  const hatalar: Record<string, string> = {};

  if (siklar.length !== SIK_SAYISI) {
    hatalar["siklar"] = `Tam ${SIK_SAYISI} şık (A–E) olmalı; ${siklar.length} şık geldi.`;
    return hatalar;
  }

  const gorulen = new Map<string, number>();
  siklar.forEach((sik, i) => {
    const harf = HARFLER[i]!;
    const metin = sik.metin ?? "";
    if (!metin.trim()) {
      hatalar[`siklar.${i}.metin`] = `${harf} şıkkı boş olamaz.`;
      return;
    }
    const icerikSorunu = icerikHatasi(metin);
    if (icerikSorunu) {
      hatalar[`siklar.${i}.metin`] = `${harf} şıkkı: ${icerikSorunu}`;
      return;
    }
    const anahtar = sikNormalize(metin);
    const onceki = gorulen.get(anahtar);
    if (onceki !== undefined) {
      hatalar[`siklar.${i}.metin`] = `${harf} şıkkı ${HARFLER[onceki]} şıkkıyla aynı (boşluk ve büyük-küçük harf farkı sayılmaz).`;
    } else {
      gorulen.set(anahtar, i);
    }
    if (sik.aciklama) {
      const aciklamaSorunu = icerikHatasi(sik.aciklama);
      if (aciklamaSorunu) hatalar[`siklar.${i}.aciklama`] = `${harf} şıkkının açıklaması: ${aciklamaSorunu}`;
    }
  });

  if (dogruSik === null || dogruSik === undefined || String(dogruSik).trim() === "") {
    hatalar["dogruSik"] = "Doğru şık seçilmeli (A–E).";
  } else if (harfSirasi(String(dogruSik)) < 0) {
    hatalar["dogruSik"] = "Doğru şık A, B, C, D ya da E olmalı.";
  }

  return hatalar;
}
