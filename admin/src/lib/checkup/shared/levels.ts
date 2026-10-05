// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/levels.ts · eşitlemek için: npm run checkup:sync

import type { ExamScopeValue } from "./exams";

/**
 * Seviyeli check-up — kurallar.
 *
 * Akış (Serhat Hoca'nın şeması, 2026-10-02):
 *
 *   Seviye 1 (50 soru · her soru bir kazanım)
 *        │
 *        ├─ ≥ %60 ──────────────────────────────► Seviye 2 açılır
 *        │
 *        └─ < %60 ─► TELAFİ TURU (eksik kazanımlar)
 *                         │
 *                         ├─ birleşik ≥ %55 ───► Seviye 2 açılır
 *                         └─ birleşik < %55 ───► DURUR + Seviye 1 karnesi
 *
 *   Seviye 2 (25 soru · çok adımlı / iki konu birleşik)
 *        ├─ ≥ %60 ──────────────────────────────► Seviye 3 açılır
 *        └─ < %60 ─────────────────────────────► DURUR + Seviye 2 karnesi
 *
 *   Seviye 3 (25 soru · sınav standardı) ───────► Nihai rapor
 *
 * Bu dosya veritabanı bilmez: girdi sayılar, çıktı karar. Böylece
 * `npm run smoke` ile sınanabiliyor ve kapı mantığı arayüzden bağımsız
 * tek yerde duruyor.
 *
 * ⚠️ PUANLAMA HAM DOĞRU SAYISI. Şema baştan sona "doğru sayısı" ve
 * "başarı oranı" diyor — yanlışın doğruyu götürmesi (net) YOK. Bu bilinçli:
 * burada ölçülen şey sınav taktiği değil, kazanımın var olup olmadığı.
 * Bu yüzden oturum `penaltyRatio = 0` ile açılıyor.
 */

export const SEVIYELER = [1, 2, 3] as const;
export type Seviye = (typeof SEVIYELER)[number];

export interface SeviyeAyari {
  /** Kaç soru sorulacak. */
  soruSayisi: number;
  /** Süre (dakika). */
  dakika: number;
  /** Bu seviyeyi geçmek için gereken oran (0–1). */
  gecmeOrani: number;
}

export interface SeviyeliSinavAyari {
  seviye1: SeviyeAyari;
  seviye2: SeviyeAyari;
  seviye3: SeviyeAyari;
  /**
   * Telafi turundan sonra Seviye 2'nin açılması için gereken BİRLEŞİK oran.
   * Seviye 1'in doğrudan geçme oranından düşük: telafi turu ikinci bir şans,
   * ama baraj tamamen kalkmıyor.
   */
  telafiSonrasiOran: number;
  /** Telafi turu için soru başına süre (dakika). */
  telafiDakikaPerSoru: number;
}

/**
 * Varsayılan ayar — şemadaki sayılar.
 *
 * Seviye 2 için şema "30-35 dakika" diyor; 32 seçildi (25 soru × ~77 sn).
 * Seviye 3 sınav standardı olduğu için soru başına süre biraz daha yüksek.
 */
export const VARSAYILAN_AYAR: SeviyeliSinavAyari = {
  seviye1: { soruSayisi: 50, dakika: 50, gecmeOrani: 0.6 },
  seviye2: { soruSayisi: 25, dakika: 32, gecmeOrani: 0.6 },
  seviye3: { soruSayisi: 25, dakika: 35, gecmeOrani: 0.6 },
  telafiSonrasiOran: 0.55,
  telafiDakikaPerSoru: 1,
};

/**
 * Sınava göre sapmalar.
 *
 * LGS 8. sınıf sınavı: 50 kazanımlık bir tarama hem kazanım sayısı olarak
 * fazla hem de 50 dakika o yaş için uzun. Diğer sınavlar varsayılanı
 * kullanıyor; kazanım listeleri netleştikçe burası güncellenecek.
 */
export const SINAV_AYARLARI: Partial<Record<ExamScopeValue, Partial<SeviyeliSinavAyari>>> = {
  LGS: {
    seviye1: { soruSayisi: 35, dakika: 35, gecmeOrani: 0.6 },
    seviye2: { soruSayisi: 20, dakika: 26, gecmeOrani: 0.6 },
    seviye3: { soruSayisi: 20, dakika: 28, gecmeOrani: 0.6 },
  },
};

export function ayarGetir(sinav: ExamScopeValue): SeviyeliSinavAyari {
  const ozel = SINAV_AYARLARI[sinav];
  if (!ozel) return VARSAYILAN_AYAR;
  return { ...VARSAYILAN_AYAR, ...ozel };
}

export function seviyeAyari(sinav: ExamScopeValue, seviye: Seviye): SeviyeAyari {
  const a = ayarGetir(sinav);
  return seviye === 1 ? a.seviye1 : seviye === 2 ? a.seviye2 : a.seviye3;
}

// ─────────────────────────────────────────────────────────────
// Kapı kararları
// ─────────────────────────────────────────────────────────────

/** Bir aşama bittiğinde sistemin verdiği karar. */
export type KapiKarari =
  /** Sonraki seviye açıldı. */
  | { tur: "SONRAKI_SEVIYE"; seviye: Seviye }
  /** Telafi turu açılıyor; şu kazanımlardan soru gelecek. */
  | { tur: "TELAFI"; eksikObjectiveIds: string[]; soruSayisi: number; dakika: number }
  /** Süreç durdu, karne basılacak. */
  | { tur: "DUR"; seviye: Seviye; sebep: "BARAJ" | "TELAFI_SONRASI" }
  /** Sınav tamamlandı. */
  | { tur: "BITTI" };

/**
 * Seviye 1 ana turu bittiğinde.
 *
 * `eksikObjectiveIds` = yanlış YA DA boş bırakılan soruların kazanımları.
 * Boş da eksik sayılıyor: şema "yanlış yaptığı veya boş bıraktığı konular"
 * diyor ve haklı — bilmediği için boş bırakmakla yanlış yapmak arasında
 * kazanım açısından fark yok.
 */
export function seviye1AnaKarar(
  dogru: number,
  toplam: number,
  eksikObjectiveIds: string[],
  ayar: SeviyeliSinavAyari
): KapiKarari {
  const oran = toplam === 0 ? 0 : dogru / toplam;

  if (oran >= ayar.seviye1.gecmeOrani) {
    return { tur: "SONRAKI_SEVIYE", seviye: 2 };
  }

  /*
   * Matematiksel kısa devre.
   *
   * Telafi turunun TAMAMINI doğru yapsa bile barajı aşamayacak öğrenciyi
   * o tura sokmuyoruz. 10 doğrusu olan birine 40 soruluk telafi turu
   * açmak, sonucu değiştirmeyecek 40 dakikayı çalmak demek.
   *
   * En iyi ihtimal: (dogru + eksik) / (toplam + eksik)
   */
  const enIyi = (dogru + eksikObjectiveIds.length) / (toplam + eksikObjectiveIds.length);
  if (eksikObjectiveIds.length === 0 || enIyi < ayar.telafiSonrasiOran) {
    return { tur: "DUR", seviye: 1, sebep: "BARAJ" };
  }

  return {
    tur: "TELAFI",
    eksikObjectiveIds,
    soruSayisi: eksikObjectiveIds.length,
    dakika: Math.max(5, Math.ceil(eksikObjectiveIds.length * ayar.telafiDakikaPerSoru)),
  };
}

/**
 * Telafi turu bittiğinde — BİRLEŞİK orana bakılır.
 *
 * Birleşik = (ana tur doğru + telafi doğru) / (ana tur soru + telafi soru).
 * Yani telafi, ilk turdaki yanlışları SİLMİYOR, üstüne ekleniyor. Şema
 * "ek sorularla birlikte güncellenen genel başarı oranı" diyor.
 */
export function telafiKarar(
  anaDogru: number,
  anaToplam: number,
  telafiDogru: number,
  telafiToplam: number,
  ayar: SeviyeliSinavAyari
): KapiKarari {
  const toplam = anaToplam + telafiToplam;
  const dogru = anaDogru + telafiDogru;
  const oran = toplam === 0 ? 0 : dogru / toplam;

  return oran >= ayar.telafiSonrasiOran
    ? { tur: "SONRAKI_SEVIYE", seviye: 2 }
    : { tur: "DUR", seviye: 1, sebep: "TELAFI_SONRASI" };
}

/** Seviye 2 ya da 3 bittiğinde. */
export function ustSeviyeKarar(
  seviye: 2 | 3,
  dogru: number,
  toplam: number,
  ayar: SeviyeliSinavAyari
): KapiKarari {
  const esik = seviye === 2 ? ayar.seviye2.gecmeOrani : ayar.seviye3.gecmeOrani;
  const oran = toplam === 0 ? 0 : dogru / toplam;

  if (seviye === 3) {
    // Seviye 3'te baraj yok: buraya gelen zaten iki kapıyı geçmiş.
    // Sonuç rapora yazılır, "kaldın" denmez.
    return { tur: "BITTI" };
  }

  return oran >= esik
    ? { tur: "SONRAKI_SEVIYE", seviye: 3 }
    : { tur: "DUR", seviye: 2, sebep: "BARAJ" };
}

// ─────────────────────────────────────────────────────────────
// Öğrenciye gösterilecek metin
// ─────────────────────────────────────────────────────────────

export interface AsamaMesaji {
  baslik: string;
  metin: string;
  ton: "ok" | "warn" | "bad";
}

export function kapiMesaji(karar: KapiKarari, oran: number): AsamaMesaji {
  const yuzde = Math.round(oran * 100);

  switch (karar.tur) {
    case "SONRAKI_SEVIYE":
      return {
        ton: "ok",
        baslik: `%${yuzde} — Seviye ${karar.seviye}'ye geçtin.`,
        metin:
          karar.seviye === 2
            ? "Temel kazanımların yerinde. Sıradaki testte iki konunun birleştiği ve birden fazla işlem adımı isteyen sorular var."
            : "Çok adımlı sorularda da sağlamsın. Son test sınav standardında.",
      };

    case "TELAFI":
      return {
        ton: "warn",
        baslik: "Temel kazanımlarını teyit ediyoruz.",
        metin: `${karar.soruSayisi} soruluk kısa bir tur daha var. Sorular yalnızca eksik çıkan kazanımlardan ve hepsi ilk turda görmediğin sorular.`,
      };

    case "DUR":
      return {
        ton: "bad",
        baslik:
          karar.seviye === 1
            ? `%${yuzde} — Seviye 1'de kalıyoruz.`
            : `%${yuzde} — Seviye 2'de kalıyoruz.`,
        metin:
          karar.seviye === 1
            ? "Üst seviyelere geçmek şu an işine yaramaz: temel kazanımlar oturmadan çok adımlı sorular yanlış ölçer. Aşağıda hangi kazanımların eksik olduğu tek tek yazıyor."
            : "Temel işlemlerin sağlam ama problem kurma ve çoklu işlemlerde eksiklerin var. Aşağıdaki karne hangi tipte takıldığını gösteriyor.",
      };

    case "BITTI":
      return {
        ton: "ok",
        baslik: `Üç seviyeyi de tamamladın.`,
        metin: "Nihai raporun aşağıda: ulaştığın seviye, eksik kazanımlar ve soru bazlı süre analizi.",
      };
  }
}

/**
 * Karne başlığı — her durağın kendi adı var.
 *
 * Akış SÜRERKEN "Eksik Analiz Karnesi" yazmıyoruz: öğrenci henüz kalmadı,
 * telafi turu ya da sonraki seviye bekliyor. O başlığı erken göstermek
 * "bitti, kaldın" demek olur.
 */
export function karneBasligi(
  seviye: Seviye,
  durum: "IN_PROGRESS" | "COMPLETED" | "STOPPED"
): string {
  if (durum === "COMPLETED") return "Nihai Check-up Raporu";
  if (durum === "IN_PROGRESS") return "Şu ana kadarki durumun";
  return seviye === 1 ? "Seviye 1 Eksik Analiz Karnesi" : "Seviye 2 Teşhis Karnesi";
}
