/**
 * Ürün kataloğunun ince kopyası — yalnızca öneri kartlarını çizmek için
 * gereken alanlar.
 *
 * Kaynak: kocumnet/frontend/lib/products.ts. İki proje ayrı deploy edildiği
 * için paylaşılan paket kurmak yerine id + ad tutuluyor; id'ler orayla
 * BİREBİR aynı olmalı (Topic.recommendedProductIds bu id'leri saklıyor).
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kocum.net";

export interface ProductRef {
  id: string;
  name: string;
  questionCount: string;
  note: string;
}

export const PRODUCTS: Record<string, ProductRef> = {
  "problemler-soru-paketi": {
    id: "problemler-soru-paketi",
    name: "“Tam ÖSYM Ayarı” Problemler Soru Paketi",
    questionCount: "1200",
    note: "Problem tiplerinin tamamı, ÖSYM kalibresinde.",
  },
  "osym-diliyle-problemler": {
    id: "osym-diliyle-problemler",
    name: "“ÖSYM Diliyle Problemler” – 50×13 Branş Denemesi",
    questionCount: "650",
    note: "Sınav dilini tanımak için branş denemeleri.",
  },
  "sanki-osym-problemleri": {
    id: "sanki-osym-problemleri",
    name: "“Sanki ÖSYM Problemleri” – İkiz Kurgulanmış Sorular",
    questionCount: "950",
    note: "Çıkmış soruların ikiz kurguları.",
  },
  "tyt-matematik-ilk-15": {
    id: "tyt-matematik-ilk-15",
    name: "TYT Matematik “İlk 15” Branş Denemeleri",
    questionCount: "750",
    note: "Sınavın ilk 15 sorusunu garantiye almak için.",
  },
  "ayt-matematik-ilk-16": {
    id: "ayt-matematik-ilk-16",
    name: "AYT Matematik “İlk 16” Branş Denemeleri – Cebir Kuşağı",
    questionCount: "800",
    note: "Cebir kuşağının tamamı.",
  },
  "muhtesem-uclu": {
    id: "muhtesem-uclu",
    name: "“Muhteşem Üçlü”: Binom · Mantık · Kartezyen",
    questionCount: "900",
    note: "Kümeler, mantık ve olasılık üçlüsü.",
  },
  "trigonometri-5te5": {
    id: "trigonometri-5te5",
    name: "Trigonometri 5’te 5 AYT Soru Seti",
    questionCount: "750",
    note: "Birim çemberden denklemlere.",
  },
  "analitik-5te5": {
    id: "analitik-5te5",
    name: "Analitik 5’te 5 AYT Soru Seti",
    questionCount: "1000",
    note: "Nokta, doğru ve çemberin analitiği.",
  },
};

export function productUrl(id: string) {
  return `${SITE_URL}/urunlerimiz#${id}`;
}
