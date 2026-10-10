/**
 * Toplu içe aktarmanın rapor tipleri ve sınırları — SUNUCU/İSTEMCİ ORTAK.
 *
 * Hiçbir sunucu API'si içermez: içe aktarma ekranı (istemci) sınırları
 * buradan okuyup dosyayı göndermeden önce uyarır, sunucu aynı sayılarla
 * reddeder. Çözümleme ve denetim kuralları burada DEĞİL:
 * shared/question-import.ts (app/lib'den kopya, komut satırıyla ortak).
 */

/**
 * Server action gövde sınırı. next.config.ts → experimental.serverActions
 * .bodySizeLimit ("10mb") ile AYNI olmalı; biri değişirse öteki de.
 */
export const ISTEK_SINIRI = 10 * 1024 * 1024;

/**
 * Dosyaların toplamı için sınır. Sınır ham HTTP gövdesine uygulanıyor;
 * multipart sınırları ve parça başlıkları için pay bırakılıyor (Next
 * belgesi 10-20 KB öneriyor, 300 görselde daha fazlası gerekir).
 */
export const YUKLEME_SINIRI = ISTEK_SINIRI - 256 * 1024;

/** Soru dosyası için ayrı sınır: 1000 soruluk metin bile 1 MB'ı geçmez. */
export const MD_SINIRI = 2 * 1024 * 1024;

/** Bir içe aktarmada en fazla bu kadar görsel ve soru. */
export const GORSEL_SAYI_SINIRI = 300;
export const SORU_SAYI_SINIRI = 1000;

/** Dosya seçicinin `accept` değeri (sunucu yine uzantıya ve içeriğe bakar). */
export const MD_KABUL = ".md,.markdown,.txt,text/markdown,text/plain";
export const GORSEL_KABUL = ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";

/** "1,4 MB" biçiminde boyut. */
export function boyutYazisi(bayt: number): string {
  if (bayt < 1024) return bayt + " B";
  if (bayt < 1024 * 1024) return Math.max(1, Math.round(bayt / 1024)) + " KB";
  return (bayt / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " MB";
}

/** Sınır aşıldığında gösterilen tek mesaj (istemci ön denetimi ve sunucu yanıtı aynı dili konuşsun). */
export function sinirAsildiMesaji(toplam?: number): string {
  return (
    "Seçilen dosyalar " +
    (toplam ? boyutYazisi(toplam) + " ediyor; " : "") +
    "bir içe aktarmada en fazla " +
    boyutYazisi(YUKLEME_SINIRI) +
    " gönderilebilir (sunucu sınırı 10 MB). Dosyayı ikiye böl ya da görselleri küçült (kısa kenar 600-1200 piksel yeter)."
  );
}

// ─── Rapor ─────────────────────────────────────────────────────

export interface RaporSorusu {
  /** Dosyadaki sırası (1'den). */
  sira: number;
  /** `### …` başlığının satırı. */
  satir: number;
  baslik: string;
  id: string;
  gecerli: boolean;
  hatalar: string[];
  uyarilar: string[];
  /** Geçerli sorular için kısa künye. */
  ozet: {
    konu: string;
    konuKodu: string;
    seviye: string | null;
    zorluk: number;
    sure: number;
    sikSayisi: number;
    kazanim: string | null;
    yeniKazanim: boolean;
    sinavlar: string[];
    gorselSayisi: number;
  } | null;
  /** Çift kayıt: aynı metnin dosyadaki ilk satırı ya da havuzdaki soru. */
  cift: { dosyadaSatir?: number; havuzdakiSoruId?: string } | null;
  /** Önizleme için ham yazım (görseller dosya adıyla). */
  onizleme: {
    soru: string;
    secenekler: { harf: string; metin: string; dogru: boolean }[];
    cozum: string;
  };
}

export interface IceAktarmaRaporu {
  dosyaAdi: string;
  sayilar: {
    bulunan: number;
    gecerli: number;
    reddedilen: number;
    uyarili: number;
    gorsel: number;
    yeniKazanim: number;
  };
  /** Dosyanın geneline dair uyarılar (tek sorulu kazanım, kullanılmayan görsel…). */
  genelUyarilar: string[];
  sorular: RaporSorusu[];
}

export type DenetimYaniti = { ok: true; rapor: IceAktarmaRaporu } | { ok: false; hata: string };

export type KayitYaniti =
  | {
      ok: true;
      rapor: IceAktarmaRaporu;
      partiId: string;
      yazilan: number;
      atlanan: number;
      yayinda: boolean;
      yeniKazanimlar: string[];
    }
  | { ok: false; hata: string; rapor?: IceAktarmaRaporu };

export type GeriAlYaniti =
  | {
      ok: true;
      dosyaAdi: string;
      silinen: number;
      /** Öğrenci testlerinde kullanıldığı için silinmeyen sorular. */
      korunan: number;
      gorselSilinen: number;
      gorselKorunan: number;
      kazanimSilinen: number;
      /** Hiç soru kalmadıysa parti kaydı da silindi. */
      partiSilindi: boolean;
      partiId: string;
    }
  | { ok: false; hata: string };

/** ImportBatch.status → ekranda görünen ad. */
export const PARTI_DURUM_ETIKETI: Record<string, string> = {
  PENDING: "Sürüyor",
  DONE: "Tamamlandı",
  FAILED: "Başarısız",
  REVERTED_PARTIAL: "Kısmen geri alındı",
};
