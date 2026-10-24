/**
 * Ürün kataloğunun ince kopyası — yalnızca öneri kartlarını çizmek için
 * gereken alanlar.
 *
 * Kaynak: kocumnet/frontend/lib/products.ts. İki proje ayrı deploy edildiği
 * için paylaşılan paket kurmak yerine id + ad tutuluyor; id'ler orayla
 * BİREBİR aynı olmalı (Topic.recommendedProductIds bu id'leri saklıyor).
 * `exams` da oradan birebir kopya (sitedeki sınav etiketleri: "KPSS" tek
 * etiket, "MSÜ" check-up'ta yok).
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kocum.net";

export interface ProductRef {
  id: string;
  name: string;
  questionCount: string;
  note: string;
  /** Sitedeki sınav etiketleri (frontend/lib/products.ts `exams`). */
  exams: readonly string[];
}

export const PRODUCTS: Record<string, ProductRef> = {
  "problemler-soru-paketi": {
    id: "problemler-soru-paketi",
    name: "“Tam ÖSYM Ayarı” Problemler Soru Paketi",
    questionCount: "1200",
    note: "Problem tiplerinin tamamı, ÖSYM kalibresinde.",
    exams: ["TYT", "MSÜ"],
  },
  "osym-diliyle-problemler": {
    id: "osym-diliyle-problemler",
    name: "“ÖSYM Diliyle Problemler” – 50×13 Branş Denemesi",
    questionCount: "650",
    note: "Sınav dilini tanımak için branş denemeleri.",
    exams: ["TYT", "MSÜ"],
  },
  "sanki-osym-problemleri": {
    id: "sanki-osym-problemleri",
    name: "“Sanki ÖSYM Problemleri” – İkiz Kurgulanmış Sorular",
    questionCount: "950",
    note: "Çıkmış soruların ikiz kurguları.",
    exams: ["TYT", "MSÜ", "ALES", "DGS", "KPSS"],
  },
  "tyt-matematik-ilk-15": {
    id: "tyt-matematik-ilk-15",
    name: "TYT Matematik “İlk 15” Branş Denemeleri",
    questionCount: "750",
    note: "Sınavın ilk 15 sorusunu garantiye almak için.",
    exams: ["TYT"],
  },
  "ayt-matematik-ilk-16": {
    id: "ayt-matematik-ilk-16",
    name: "AYT Matematik “İlk 16” Branş Denemeleri – Cebir Kuşağı",
    questionCount: "800",
    note: "Cebir kuşağının tamamı.",
    exams: ["AYT"],
  },
  "muhtesem-uclu": {
    id: "muhtesem-uclu",
    name: "“Muhteşem Üçlü”: Binom · Mantık · Kartezyen",
    questionCount: "900",
    // Sitede: üç konu, her birinden 300+ soru. Eski not "kümeler, mantık ve
    // olasılık" diyordu; ürünün adıyla bile çelişiyordu.
    note: "Binom, mantık ve kartezyen; her birinden 300+ soru.",
    exams: ["AYT"],
  },
  "trigonometri-5te5": {
    id: "trigonometri-5te5",
    name: "Trigonometri 5’te 5 AYT Soru Seti",
    questionCount: "750",
    note: "Birim çemberden denklemlere.",
    exams: ["AYT"],
  },
  "analitik-5te5": {
    id: "analitik-5te5",
    name: "Analitik 5’te 5 AYT Soru Seti",
    questionCount: "1000",
    note: "Nokta, doğru ve çemberin analitiği.",
    exams: ["AYT"],
  },
};

/**
 * Check-up sınavı → sitedeki sınav etiketi. KPSS Lisans ve Ön Lisans sitede
 * tek "KPSS" etiketi.
 */
const SITE_ETIKETI: Record<string, string> = {
  LGS: "LGS",
  TYT: "TYT",
  AYT: "AYT",
  KPSS_LISANS: "KPSS",
  KPSS_ONLISANS: "KPSS",
  DGS: "DGS",
  ALES: "ALES",
};

/**
 * Ürün bu sınavın öğrencisine önerilebilir mi?
 *
 * Konu → ürün eşlemesi sınav bilmiyor ("Problemler" konusu hem TYT'de hem
 * ALES'te var); ALES adayına TYT kitabı öneriliyordu. Bilinmeyen sınavda
 * (eski BOTH kaydı) öneri yok: yanlış kitap önermektense hiç önermemek.
 */
export function urunSinavaUygun(urun: ProductRef, sinav: string | null | undefined): boolean {
  const etiket = sinav ? SITE_ETIKETI[sinav] : undefined;
  return etiket !== undefined && urun.exams.includes(etiket);
}

/** Kimlik listesinden bu sınava uygun, katalogda bulunan ürünler (sıra korunur). */
export function sinavinUrunleri(ids: readonly string[], sinav: string | null | undefined): ProductRef[] {
  return ids
    .map((id): ProductRef | undefined => PRODUCTS[id])
    .filter((p): p is ProductRef => p !== undefined && urunSinavaUygun(p, sinav));
}

export function productUrl(id: string) {
  return `${SITE_URL}/urunlerimiz#${id}`;
}
