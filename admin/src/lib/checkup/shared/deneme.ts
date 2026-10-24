// ⚠️ OTOMATİK KOPYA — ELLE DÜZENLEMEYİN.
// Kaynak: kocumnet/app/lib/deneme.ts · eşitlemek için: npm run checkup:sync

/**
 * Deneme sınavı (PackageKind.MOCK) ve kâğıtta çözme kuralları — saf modül,
 * veritabanı bilmez, hiçbir şey import etmez (gerekirse admin'e kopyalanabilsin).
 *
 * Veritabanı tarafı: soru listesi lib/question-selection.ts
 * (selectQuestionsForMock), katalogdaki hazırlık durumu lib/catalog.ts
 * (denemeDurumlari), karşılaştırma havuzu lib/checkup.ts
 * (denemeKarsilastirmasi). Testleri scripts/deneme-test.mts.
 */

// ─────────────────────────────────────────────────────────────
// Kâğıtta çözme
// ─────────────────────────────────────────────────────────────

/**
 * Kâğıt oturumunda cevapları optik forma işlemek için süre (saat).
 *
 * Sayaç yok: öğrenci kitapçığı yazdırıp süresini kendisi tutuyor. Yine de
 * oturum sonsuza kadar açık kalmamalı: açık oturumun soruları alıştırmaya
 * düşmüyor ve pano "yarım test" diye bekletiyor. 48 saat, akşam çözüp ertesi
 * gün okulda işleyen öğrenciye de yetiyor. Süre dolunca bakım işi (cron)
 * işaretlenmiş cevaplarla puanlıyor; boşlar boş sayılıyor.
 */
export const KAGIT_ISLEME_SURESI_SAAT = 48;

/**
 * Son anın metni: "23 Ekim Perşembe 14:30". Saat dilimi sabit: sunucu UTC'de
 * çalışıyor, öğrenci Türkiye saatini görmeli.
 */
export function sonGunMetni(d: Date): string {
  return d.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Kâğıtta çözülebilen paket türleri: seviyeli check-up ve kontrol testi değil. */
export const KAGIT_TURLERI = ["STANDARD", "INTRO", "MOCK"] as const;

export function kagittaCozulebilir(kind: string): boolean {
  return (KAGIT_TURLERI as readonly string[]).includes(kind);
}

// ─────────────────────────────────────────────────────────────
// Deneme hazır mı
// ─────────────────────────────────────────────────────────────

/** Öğrenciye giden mesaj: hem başlatmada hem katalogda aynı cümle. */
export const DENEME_HAZIRLANIYOR = "Bu deneme şu an hazırlanıyor. Soruları tamamlanınca buradan başlayabilirsin.";

export interface DenemeListeDurumu {
  /** Sabit listedeki soru sayısı. */
  toplam: number;
  /** Bunlardan yayında olanlar. */
  yayinda: number;
}

/**
 * Deneme ancak sabit listesi TAM ve TAMAMI YAYINDA ise başlar.
 *
 * Eksik ya da taslak soruyla açılan bir deneme, öğrenciye gerçek sınavdan
 * kısa bir prova verir ve yüzdelik dilimi bozar: 38 soruluk denemenin neti
 * 40 soruluk denemenin netiyle aynı havuzda karşılaştırılamaz. Bu yüzden
 * "elde ne varsa onu çöz" yok; panel listeyi tamamlayana kadar "hazırlanıyor".
 */
export function denemeHazirMi(durum: DenemeListeDurumu | undefined, questionCount: number): boolean {
  return (
    durum !== undefined &&
    questionCount > 0 &&
    durum.toplam === questionCount &&
    durum.yayinda === questionCount
  );
}

/** 0.25 → "4 yanlış 1 doğruyu götürür". Oran koda gömülü değil, paketten geliyor. */
export function cezaKurali(oran: number): string {
  if (!(oran > 0)) return "Yanlış doğruyu götürmez";
  return `${Math.round(1 / oran)} yanlış 1 doğruyu götürür`;
}

// ─────────────────────────────────────────────────────────────
// Yüzdelik dilim
// ─────────────────────────────────────────────────────────────

/**
 * Karşılaştırmanın açılması için gereken en az katılımcı.
 *
 * Neden 10: üç kişilik bir havuzda "%67'sinden yüksek" bilgi değil gürültü;
 * ayrıca küçük havuzda dağılım tek tek kişilerin netini ele verir (sınıftan
 * iki arkadaş çözdüyse kimin kaç yaptığı anlaşılır).
 */
export const KARSILASTIRMA_ESIGI = 10;

/** Dağılımda en fazla kaç net aralığı. */
const EN_FAZLA_ARALIK = 10;

/** Aralık genişliği adayları: 0–2, 0–5, 0–10 gibi okunur sınırlar. */
const ARALIK_ADAYLARI = [2, 5, 10, 20] as const;

/** Soru sayısına göre net aralığı genişliği: en fazla 10 aralık, okunur sınırlar. */
export function aralikGenisligi(soruSayisi: number): number {
  for (const w of ARALIK_ADAYLARI) {
    if (Math.ceil(Math.max(1, soruSayisi) / w) <= EN_FAZLA_ARALIK) return w;
  }
  return ARALIK_ADAYLARI[ARALIK_ADAYLARI.length - 1];
}

export interface NetAraligi {
  /** Dahil. */
  alt: number;
  /** Hariç; son aralıkta dahil (tam net). */
  ust: number;
  sayi: number;
  /** Öğrencinin bu oturumdaki neti bu aralıkta mı. */
  benim: boolean;
}

export interface HavuzKaydi {
  userId: string;
  net: number;
}

export type Karsilastirma =
  | {
      acik: false;
      /** Havuzdaki kişi sayısı (öğrenci dahil). */
      katilimci: number;
      esik: number;
    }
  | {
      acik: true;
      katilimci: number;
      /** Öğrencinin kendisi hariç kaç kişiyle karşılaştırıldı. */
      karsilastirilan: number;
      /** Netin, karşılaştırılanların yüzde kaçından YÜKSEK (aşağı yuvarlanır). */
      yuzdelik: number;
      /** Netin, karşılaştırılanların yüzde kaçıyla AYNI. */
      esitYuzde: number;
      araliklar: NetAraligi[];
    };

/**
 * Öğrencinin netini havuza göre konumlar.
 *
 * - Havuz kişi başına tek kayıt (çağıran kurar: ilk, ekranda, puanlanmış).
 * - Karşılaştırma öğrencinin KENDİ kaydı hariç yapılır: ikinci denemesini
 *   ilk denemesiyle yarıştırmak anlamsız. Kâğıt oturumunda öğrenci havuzda
 *   yoktur; yine de havuza göre yeri hesaplanır.
 * - "%Y'sinden yüksek" kesin büyüklük: eşitler sayılmaz, yüzde aşağı
 *   yuvarlanır. Abartılmış bir dilim öğrencinin gerçek yerini bulandırır.
 * - Dağılım tüm havuzu sayar; kimlik, ad, sıra numarası yok.
 */
export function karsilastir(args: {
  benimNet: number;
  benimUserId: string;
  havuz: readonly HavuzKaydi[];
  soruSayisi: number;
  esik?: number;
}): Karsilastirma {
  const { benimNet, benimUserId, havuz, soruSayisi } = args;
  const esik = args.esik ?? KARSILASTIRMA_ESIGI;
  const katilimci = havuz.length;
  if (katilimci < esik) return { acik: false, katilimci, esik };

  const digerleri = havuz.filter((h) => h.userId !== benimUserId);
  const altinda = digerleri.filter((h) => h.net < benimNet).length;
  const esit = digerleri.filter((h) => h.net === benimNet).length;
  const n = Math.max(1, digerleri.length);

  const w = aralikGenisligi(soruSayisi);
  const adet = Math.max(1, Math.ceil(Math.max(1, soruSayisi) / w));
  const indeks = (net: number) => Math.min(adet - 1, Math.max(0, Math.floor(net / w)));
  // Son aralık tam nete kadar: 15 soruda "14–16" değil "14–15".
  const araliklar: NetAraligi[] = Array.from({ length: adet }, (_, i) => ({
    alt: i * w,
    ust: i === adet - 1 ? Math.max(1, soruSayisi) : (i + 1) * w,
    sayi: 0,
    benim: false,
  }));
  for (const h of havuz) araliklar[indeks(h.net)].sayi += 1;
  araliklar[indeks(benimNet)].benim = true;

  return {
    acik: true,
    katilimci,
    karsilastirilan: digerleri.length,
    yuzdelik: Math.floor((altinda / n) * 100),
    esitYuzde: Math.floor((esit / n) * 100),
    araliklar,
  };
}

/*
 * "%40'ından", "%50'sinden": Türkçede ek sayının OKUNUŞUNA uyar. Son sıfırdan
 * farklı basamağın (yoksa onlar basamağının, o da yoksa "yüz"ün) adına göre.
 */
const BIRLER_EKI = ["ından", "inden", "sinden", "ünden", "ünden", "inden", "sından", "sinden", "inden", "undan"];
const ONLAR_EKI = ["", "undan", "sinden", "undan", "ından", "sinden", "ından", "inden", "inden", "ından"];

/** 40 → "%40'ından". Tamsayı yüzde (0-100) için. */
export function yuzdeSinden(n: number): string {
  const y = Math.max(0, Math.min(100, Math.round(n)));
  const ek =
    y === 100 ? "ünden" : y % 10 !== 0 ? BIRLER_EKI[y % 10] : y === 0 ? BIRLER_EKI[0] : ONLAR_EKI[y / 10];
  return `%${y}'${ek}`;
}
