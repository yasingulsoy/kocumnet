import "dotenv/config";
import { prisma } from "../lib/db";
import { EXAMS, type ExamScopeValue } from "../lib/exams";
import { soruSinavdaKosulu } from "../lib/exam-scope";

/**
 * Konu ağacı ve paketler. Bunlar "referans veri": uygulamanın çalışması için
 * gerekli, kullanıcı üretmiyor. Seed idempotent (slug üzerinden), tekrar
 * çalıştırmak güvenli.
 *
 *   npm run db:seed                  → eksik paketleri oluşturur, var olanların
 *                                      İÇERİĞİNE dokunmaz
 *   npm run db:seed -- --guncelle    → var olan paketlerin içeriğini de bu
 *                                      dosyadaki hâline getirir
 *
 * Katalog (STANDARD) paketlerinin İÇERİĞİ (ad, özet, süre, soru sayısı, konu
 * dağılımı) yönetim panelinden düzenlenebiliyor (admin.kocum.net → Paketler).
 * Seed her çalıştığında bunları yeniden yazsaydı paneldeki düzenleme ilk
 * deploy'da sessizce silinirdi. Bu yüzden var olan katalog paketinde içerik
 * yalnızca `--guncelle` ile yazılır. Sistem paketleri (tanışma, konu tekrar)
 * panelden düzenlenmiyor; onlar her çalıştırmada bu dosyadan yazılır — yoksa
 * burada yapılan bir değişiklik için `--guncelle` gerekir, o da paneldeki
 * düzenlemeleri ezerdi. Sınavdan türeyen alanlar (examScope, kind,
 * penaltyRatio) ve katalog sırası her çalıştırmada senkron kalır: sınav sabiti
 * (lib/exams.ts) değişince yayılsın. Konu ağacı her zaman bu dosyadan.
 */

/** Var olan paketlerin içeriğini de bu dosyadaki hâline getir (panel düzenlemelerini ezer). */
const GUNCELLE = process.argv.includes("--guncelle");

type Scope = ExamScopeValue;

type SeedTopic = {
  slug: string;
  name: string;
  /** Konunun ana sınavı (rozet ve varsayılan gruplama). */
  scope: Scope;
  /** Konunun geçtiği TÜM sınavlar. Verilmezse ORTAK_KONULAR'dan türetilir. */
  scopes?: Scope[];
  /** Gerçek sınavda bu konudan ortalama kaç soru çıkıyor: { TYT: 4 }. */
  weights?: Partial<Record<Scope, number>>;
  products?: string[];
  children?: SeedTopic[];
};

/**
 * ⚠️ KONU AĞACI SINAV BAŞINA ÇOĞALTILMIYOR.
 *
 * KPSS, DGS ve ALES matematiği TYT ile büyük ölçüde aynı konulardan oluşuyor.
 * Aynı konuyu her sınav için ayrı kaydetmek iki şeyi birden bozardı:
 *   1. Öğrenci sınav değiştirince konu geçmişi sıfırlanırdı (konu haritası
 *      konu kimliğine göre toplanıyor) — ürünün en değerli verisi parçalanırdı.
 *   2. Soru havuzu beşe bölünürdü; eldeki soruyla beş sınav açılamaz.
 *
 * Bu yüzden ortak konular TEK kayıt, birden çok sınav etiketiyle duruyor.
 * Kökün adı da bu yüzden sınavdan bağımsız ("Temel Matematik"): rapor
 * başlığında KPSS öğrencisine "TYT Matematik" yazmasın.
 */
const TEMEL_ORTAK: Scope[] = ["TYT", "KPSS_LISANS", "KPSS_ONLISANS", "DGS", "ALES"];
/** TYT'de olup KPSS'de olmayan, DGS/ALES'te olan konular. */
const DGS_ALES_EK: Scope[] = ["TYT", "DGS", "ALES"];
/** Yalnızca kamu/geçiş sınavlarında çıkan konular. */
const SINAV_SONRASI: Scope[] = ["KPSS_LISANS", "KPSS_ONLISANS", "DGS", "ALES"];

const ORTAK_KONULAR: Record<string, Scope[]> = Object.fromEntries([
  ...[
    "temel-kavramlar",
    "sayi-basamaklari",
    "bolunebilme",
    "ebob-ekok",
    "rasyonel-sayilar",
    "basit-esitsizlikler",
    "mutlak-deger",
    "uslu-sayilar",
    "koklu-sayilar",
    "carpanlara-ayirma",
    "oran-oranti",
    "denklem-cozme",
    "problemler",
    "sayi-kesir-problemleri",
    "yas-problemleri",
    "isci-havuz-problemleri",
    "hareket-hiz-problemleri",
    "yuzde-kar-zarar",
    "karisim-problemleri",
    "grafik-problemleri",
    "rutin-olmayan-problemler",
    "kumeler",
    "mantik",
    "permutasyon-kombinasyon-olasilik",
    "veri-istatistik",
  ].map((s) => [s, TEMEL_ORTAK]),
  ...["fonksiyonlar-tyt", "polinomlar-tyt", "ikinci-derece-tyt"].map((s) => [s, DGS_ALES_EK]),
]);

/** Ürün id'leri frontend/lib/products.ts ile aynı — zayıf konu buradan öneriye bağlanır. */
const P = {
  problemPaketi: "problemler-soru-paketi",
  osymDiliyle: "osym-diliyle-problemler",
  sankiOsym: "sanki-osym-problemleri",
  tytIlk15: "tyt-matematik-ilk-15",
  aytIlk16: "ayt-matematik-ilk-16",
  muhtesemUclu: "muhtesem-uclu",
  trigonometri: "trigonometri-5te5",
  analitik: "analitik-5te5",
} as const;

const TOPICS: SeedTopic[] = [
  {
    // Slug tarihsel sebeple "tyt-matematik" (mevcut satırlar bozulmasın);
    // ADI sınavdan bağımsız, çünkü altındaki konular beş sınavda ortak.
    slug: "tyt-matematik",
    name: "Temel Matematik",
    scope: "TYT",
    scopes: TEMEL_ORTAK,
    children: [
      { slug: "temel-kavramlar", name: "Temel Kavramlar", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 3, KPSS_LISANS: 2, DGS: 2, ALES: 2 } },
      { slug: "sayi-basamaklari", name: "Sayı Basamakları", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 2, KPSS_LISANS: 2, DGS: 2, ALES: 2 } },
      { slug: "bolunebilme", name: "Bölme ve Bölünebilme", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 3, KPSS_LISANS: 2, DGS: 2, ALES: 2 } },
      { slug: "ebob-ekok", name: "EBOB - EKOK", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 2, KPSS_LISANS: 1, DGS: 1, ALES: 1 } },
      { slug: "rasyonel-sayilar", name: "Rasyonel Sayılar", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 2, KPSS_LISANS: 2, DGS: 2 } },
      { slug: "basit-esitsizlikler", name: "Basit Eşitsizlikler", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 2, KPSS_LISANS: 1, DGS: 1 } },
      { slug: "mutlak-deger", name: "Mutlak Değer", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 2, KPSS_LISANS: 1 } },
      { slug: "uslu-sayilar", name: "Üslü Sayılar", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 2, KPSS_LISANS: 2, DGS: 2, ALES: 2 } },
      { slug: "koklu-sayilar", name: "Köklü Sayılar", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 2, KPSS_LISANS: 2, DGS: 2, ALES: 2 } },
      { slug: "carpanlara-ayirma", name: "Çarpanlara Ayırma", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 2, KPSS_LISANS: 1, DGS: 2 } },
      { slug: "oran-oranti", name: "Oran - Orantı", scope: "TYT", products: [P.tytIlk15, P.problemPaketi], weights: { TYT: 2, KPSS_LISANS: 3, DGS: 3, ALES: 3 } },
      { slug: "denklem-cozme", name: "Denklem Çözme", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 2, KPSS_LISANS: 2, DGS: 2 } },
      {
        slug: "problemler",
        name: "Problemler",
        scope: "TYT",
        products: [P.problemPaketi, P.osymDiliyle, P.sankiOsym],
        weights: { TYT: 8, KPSS_LISANS: 10, DGS: 12, ALES: 10 },
        children: [
          { slug: "sayi-kesir-problemleri", name: "Sayı - Kesir Problemleri", scope: "TYT", products: [P.problemPaketi, P.sankiOsym], weights: { TYT: 2, KPSS_LISANS: 2, DGS: 3 } },
          { slug: "yas-problemleri", name: "Yaş Problemleri", scope: "TYT", products: [P.problemPaketi], weights: { TYT: 1, KPSS_LISANS: 1, DGS: 1 } },
          { slug: "isci-havuz-problemleri", name: "İşçi - Havuz Problemleri", scope: "TYT", products: [P.problemPaketi, P.osymDiliyle], weights: { TYT: 1, KPSS_LISANS: 2, DGS: 2 } },
          { slug: "hareket-hiz-problemleri", name: "Hareket - Hız Problemleri", scope: "TYT", products: [P.problemPaketi, P.osymDiliyle], weights: { TYT: 2, KPSS_LISANS: 2, DGS: 2 } },
          { slug: "yuzde-kar-zarar", name: "Yüzde - Kâr - Zarar Problemleri", scope: "TYT", products: [P.problemPaketi, P.sankiOsym], weights: { TYT: 2, KPSS_LISANS: 3, DGS: 3 } },
          { slug: "karisim-problemleri", name: "Karışım Problemleri", scope: "TYT", products: [P.problemPaketi], weights: { TYT: 1, KPSS_LISANS: 1, DGS: 1 } },
          { slug: "faiz-problemleri", name: "Faiz Problemleri", scope: "KPSS_LISANS", scopes: SINAV_SONRASI, products: [P.problemPaketi], weights: { KPSS_LISANS: 2, DGS: 2, ALES: 2 } },
          { slug: "grafik-problemleri", name: "Grafik Problemleri", scope: "TYT", products: [P.osymDiliyle], weights: { TYT: 1, KPSS_LISANS: 2, DGS: 2 } },
          { slug: "rutin-olmayan-problemler", name: "Rutin Olmayan Problemler", scope: "TYT", products: [P.sankiOsym, P.osymDiliyle], weights: { TYT: 2 } },
        ],
      },
      { slug: "kumeler", name: "Kümeler", scope: "TYT", products: [P.muhtesemUclu], weights: { TYT: 1, KPSS_LISANS: 1, DGS: 1, ALES: 1 } },
      { slug: "mantik", name: "Mantık", scope: "TYT", products: [P.muhtesemUclu], weights: { TYT: 1 } },
      { slug: "fonksiyonlar-tyt", name: "Fonksiyonlar", scope: "TYT", products: [P.tytIlk15, P.muhtesemUclu], weights: { TYT: 2, DGS: 2, ALES: 2 } },
      { slug: "polinomlar-tyt", name: "Polinomlar", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 1, DGS: 1 } },
      { slug: "ikinci-derece-tyt", name: "2. Dereceden Denklemler", scope: "TYT", products: [P.tytIlk15], weights: { TYT: 1, DGS: 2 } },
      { slug: "permutasyon-kombinasyon-olasilik", name: "Permütasyon - Kombinasyon - Olasılık", scope: "TYT", products: [P.muhtesemUclu], weights: { TYT: 2, KPSS_LISANS: 2, DGS: 2, ALES: 2 } },
      { slug: "veri-istatistik", name: "Veri - İstatistik", scope: "TYT", products: [P.muhtesemUclu], weights: { TYT: 2, KPSS_LISANS: 2, ALES: 2 } },
      // ── KPSS / DGS / ALES'e özgü muhakeme konuları ──────────────
      { slug: "sayi-dizileri", name: "Sayı Dizileri", scope: "KPSS_LISANS", scopes: SINAV_SONRASI, weights: { KPSS_LISANS: 2, DGS: 2, ALES: 2 } },
      { slug: "tablo-grafik-yorumlama", name: "Tablo - Grafik Yorumlama", scope: "KPSS_LISANS", scopes: SINAV_SONRASI, weights: { KPSS_LISANS: 3, DGS: 3, ALES: 3 } },
      { slug: "islem-moduler-aritmetik", name: "İşlem - Modüler Aritmetik", scope: "KPSS_LISANS", scopes: SINAV_SONRASI, weights: { KPSS_LISANS: 2, DGS: 2, ALES: 2 } },
      { slug: "sayisal-mantik", name: "Sayısal Mantık", scope: "DGS", scopes: ["DGS", "ALES", "KPSS_LISANS"], weights: { DGS: 4, ALES: 3, KPSS_LISANS: 2 } },
      // ── Temel geometri: TYT'de de, kamu sınavlarında da çıkıyor ──
      {
        slug: "temel-geometri",
        name: "Geometri",
        scope: "TYT",
        scopes: TEMEL_ORTAK,
        weights: { TYT: 10, KPSS_LISANS: 6, DGS: 6, ALES: 6 },
        children: [
          { slug: "geo-acilar", name: "Doğruda ve Üçgende Açılar", scope: "TYT", scopes: TEMEL_ORTAK, weights: { TYT: 2, KPSS_LISANS: 1 } },
          { slug: "geo-ucgenler", name: "Üçgenler", scope: "TYT", scopes: TEMEL_ORTAK, weights: { TYT: 3, KPSS_LISANS: 2, DGS: 2 } },
          { slug: "geo-dortgenler", name: "Dörtgenler ve Çokgenler", scope: "TYT", scopes: TEMEL_ORTAK, weights: { TYT: 2, KPSS_LISANS: 1, DGS: 1 } },
          { slug: "geo-cember-daire", name: "Çember ve Daire", scope: "TYT", scopes: TEMEL_ORTAK, weights: { TYT: 2, KPSS_LISANS: 1, DGS: 1 } },
          { slug: "geo-kati-cisimler", name: "Katı Cisimler", scope: "TYT", scopes: TEMEL_ORTAK, weights: { TYT: 1, KPSS_LISANS: 1, DGS: 1 } },
        ],
      },
    ],
  },
  {
    slug: "ayt-matematik",
    name: "İleri Matematik (AYT)",
    scope: "AYT",
    scopes: ["AYT"],
    children: [
      { slug: "fonksiyonlar-ayt", name: "Fonksiyonlar (İleri)", scope: "AYT", scopes: ["AYT"], products: [P.aytIlk16], weights: { AYT: 3 } },
      { slug: "polinomlar-ayt", name: "Polinomlar", scope: "AYT", scopes: ["AYT"], products: [P.aytIlk16], weights: { AYT: 2 } },
      { slug: "ikinci-derece-ayt", name: "2. Dereceden Denklemler ve Eşitsizlikler", scope: "AYT", scopes: ["AYT"], products: [P.aytIlk16], weights: { AYT: 2 } },
      { slug: "karmasik-sayilar", name: "Karmaşık Sayılar", scope: "AYT", scopes: ["AYT"], products: [P.aytIlk16], weights: { AYT: 2 } },
      { slug: "logaritma", name: "Logaritma", scope: "AYT", scopes: ["AYT"], products: [P.aytIlk16], weights: { AYT: 2 } },
      { slug: "diziler", name: "Diziler", scope: "AYT", scopes: ["AYT"], products: [P.aytIlk16], weights: { AYT: 2 } },
      { slug: "limit-sureklilik", name: "Limit ve Süreklilik", scope: "AYT", scopes: ["AYT"], weights: { AYT: 2 } },
      { slug: "turev", name: "Türev", scope: "AYT", scopes: ["AYT"], weights: { AYT: 5 } },
      { slug: "integral", name: "İntegral", scope: "AYT", scopes: ["AYT"], weights: { AYT: 4 } },
      {
        slug: "trigonometri",
        name: "Trigonometri",
        scope: "AYT",
        scopes: ["AYT"],
        products: [P.trigonometri],
        weights: { AYT: 4 },
        children: [
          { slug: "birim-cember", name: "Birim Çember", scope: "AYT", scopes: ["AYT"], products: [P.trigonometri] },
          { slug: "trigonometrik-fonksiyonlar", name: "Trigonometrik Fonksiyonlar", scope: "AYT", scopes: ["AYT"], products: [P.trigonometri] },
          { slug: "toplam-fark-formulleri", name: "Toplam - Fark Formülleri", scope: "AYT", scopes: ["AYT"], products: [P.trigonometri] },
          { slug: "trigonometrik-denklemler", name: "Trigonometrik Denklemler", scope: "AYT", scopes: ["AYT"], products: [P.trigonometri] },
        ],
      },
      {
        slug: "analitik-geometri",
        name: "Analitik Geometri",
        scope: "AYT",
        scopes: ["AYT"],
        products: [P.analitik],
        weights: { AYT: 3 },
        children: [
          { slug: "noktanin-analitigi", name: "Noktanın Analitiği", scope: "AYT", scopes: ["AYT"], products: [P.analitik] },
          { slug: "dogrunun-analitigi", name: "Doğrunun Analitiği", scope: "AYT", scopes: ["AYT"], products: [P.analitik] },
          { slug: "cemberin-analitigi", name: "Çemberin Analitiği", scope: "AYT", scopes: ["AYT"], products: [P.analitik] },
        ],
      },
    ],
  },
  {
    // LGS müfredatı ayrı: 8. sınıf kazanımları YKS konularıyla adlandırma ve
    // derinlik olarak örtüşmüyor (MEB dili: "Üslü İfadeler", "Çarpanlar ve Katlar").
    slug: "lgs-matematik",
    name: "LGS Matematik",
    scope: "LGS",
    scopes: ["LGS"],
    children: [
      { slug: "lgs-carpanlar-katlar", name: "Çarpanlar ve Katlar", scope: "LGS", scopes: ["LGS"], weights: { LGS: 2 } },
      { slug: "lgs-uslu-ifadeler", name: "Üslü İfadeler", scope: "LGS", scopes: ["LGS"], weights: { LGS: 2 } },
      { slug: "lgs-karekoklu-ifadeler", name: "Kareköklü İfadeler", scope: "LGS", scopes: ["LGS"], weights: { LGS: 2 } },
      { slug: "lgs-veri-analizi", name: "Veri Analizi", scope: "LGS", scopes: ["LGS"], weights: { LGS: 1 } },
      { slug: "lgs-olasilik", name: "Basit Olayların Olma Olasılığı", scope: "LGS", scopes: ["LGS"], weights: { LGS: 1 } },
      { slug: "lgs-cebirsel-ifadeler", name: "Cebirsel İfadeler ve Özdeşlikler", scope: "LGS", scopes: ["LGS"], weights: { LGS: 2 } },
      { slug: "lgs-dogrusal-denklemler", name: "Doğrusal Denklemler", scope: "LGS", scopes: ["LGS"], weights: { LGS: 2 } },
      { slug: "lgs-esitsizlikler", name: "Eşitsizlikler", scope: "LGS", scopes: ["LGS"], weights: { LGS: 1 } },
      { slug: "lgs-ucgenler", name: "Üçgenler", scope: "LGS", scopes: ["LGS"], weights: { LGS: 3 } },
      { slug: "lgs-eslik-benzerlik", name: "Eşlik ve Benzerlik", scope: "LGS", scopes: ["LGS"], weights: { LGS: 1 } },
      { slug: "lgs-donusum-geometrisi", name: "Dönüşüm Geometrisi", scope: "LGS", scopes: ["LGS"], weights: { LGS: 1 } },
      { slug: "lgs-geometrik-cisimler", name: "Geometrik Cisimler", scope: "LGS", scopes: ["LGS"], weights: { LGS: 2 } },
    ],
  },
];

type SeedPackage = {
  slug: string;
  name: string;
  summary: string;
  scope: Scope;
  durationMinutes: number;
  kind?: "STANDARD" | "INTRO" | "RETEST";
  /** [konu slug, soru adedi] */
  dist: [string, number][];
};

/**
 * ⚠️ PAKET TASARIMININ TEK KURALI: bir pakette bir konuya EN AZ 3 soru.
 *
 * Check-up'ın denemeden farkı bu (PLAN §1). 25 soruyu 23 konuya dağıtmak
 * konu başına 1 soru demektir ve tek soruyla seviye ölçülemez — puanlama
 * o konuya seviye etiketi vermez, öğrenci "yeterli soru yok" görür.
 * Yani kapsamı genişletmek ölçümü geliştirmez, yok eder.
 *
 * Kapsam istiyorsan konu sayısını değil paket sayısını artır.
 */
const MIN_PER_TOPIC = 3;

/** Tanışma testi: yeni öğrencinin boş panosundaki tek çağrı. Kısa olmak zorunda. */

const PACKAGES: SeedPackage[] = [
  // ── LGS ───────────────────────────────────────────────────────
  {
    slug: "lgs-tanisma",
    name: "LGS Tanışma Check-up'ı",
    summary: "12 soru, 18 dakika. Dört temel ünitede nerede olduğunu görmek için ilk adım.",
    scope: "LGS",
    kind: "INTRO",
    durationMinutes: 18,
    dist: [["lgs-carpanlar-katlar", 3], ["lgs-uslu-ifadeler", 3], ["lgs-cebirsel-ifadeler", 3], ["lgs-ucgenler", 3]],
  },
  {
    slug: "lgs-sayilar-cebir",
    name: "LGS Sayılar ve Cebir",
    summary: "Üslü ve kareköklü ifadelerden özdeşliklere, denklem ve eşitsizliklere kadar cebir bloğu.",
    scope: "LGS",
    durationMinutes: 36,
    dist: [
      ["lgs-uslu-ifadeler", 4], ["lgs-karekoklu-ifadeler", 4], ["lgs-cebirsel-ifadeler", 4],
      ["lgs-dogrusal-denklemler", 4], ["lgs-esitsizlikler", 3],
    ],
  },
  {
    slug: "lgs-geometri",
    name: "LGS Geometri",
    summary: "Üçgenler, eşlik-benzerlik, dönüşüm geometrisi ve geometrik cisimler.",
    scope: "LGS",
    durationMinutes: 32,
    dist: [["lgs-ucgenler", 5], ["lgs-eslik-benzerlik", 4], ["lgs-donusum-geometrisi", 3], ["lgs-geometrik-cisimler", 4]],
  },
  {
    slug: "lgs-veri-olasilik",
    name: "LGS Veri ve Olasılık",
    summary: "Veri analizi ve olasılıkta altışar soru: kısa test, iki konuda net seviye.",
    scope: "LGS",
    durationMinutes: 22,
    dist: [["lgs-veri-analizi", 6], ["lgs-olasilik", 6]],
  },
  // ── TYT ───────────────────────────────────────────────────────
  {
    slug: "tyt-tanisma",
    name: "TYT Tanışma Check-up'ı",
    summary: "12 soru, 15 dakika. Dört çekirdek konuda hızlı bir başlangıç ölçümü.",
    scope: "TYT",
    kind: "INTRO",
    durationMinutes: 15,
    dist: [["temel-kavramlar", 3], ["bolunebilme", 3], ["uslu-sayilar", 3], ["oran-oranti", 3]],
  },
  {
    slug: "tyt-matematik-genel",
    name: "TYT Matematik Çekirdek",
    summary:
      "TYT matematiğin en çok soru getiren sekiz konusunda, her birinden üçer soruyla gerçek seviye ölçümü.",
    scope: "TYT",
    durationMinutes: 30,
    dist: [
      ["temel-kavramlar", 3], ["bolunebilme", 3], ["uslu-sayilar", 3], ["koklu-sayilar", 3],
      ["carpanlara-ayirma", 3], ["oran-oranti", 3], ["fonksiyonlar-tyt", 3],
      ["sayi-kesir-problemleri", 3],
    ],
  },
  {
    slug: "tyt-ilk-15",
    name: 'TYT Matematik "İlk 15"',
    summary: "Sınavın ilk sorularını getiren beş çekirdek konu. Hızlı ama derin.",
    scope: "TYT",
    durationMinutes: 18,
    dist: [
      ["temel-kavramlar", 3], ["sayi-basamaklari", 3], ["bolunebilme", 3],
      ["uslu-sayilar", 3], ["koklu-sayilar", 3],
    ],
  },
  {
    slug: "problemler",
    name: "Problemler",
    summary: "En çok zaman kaybettiren beş problem tipinde, her birinden dörder soru.",
    scope: "TYT",
    durationMinutes: 25,
    dist: [
      ["sayi-kesir-problemleri", 4], ["hareket-hiz-problemleri", 4], ["yuzde-kar-zarar", 4],
      ["isci-havuz-problemleri", 4], ["rutin-olmayan-problemler", 4],
    ],
  },
  {
    slug: "tyt-sayma-olasilik-veri",
    name: "TYT Sayma, Olasılık ve Veri",
    summary: "Kümeler, mantık, sayma-olasılık ve veri: ezberle geçilemeyen dörtlü.",
    scope: "TYT",
    durationMinutes: 20,
    dist: [["kumeler", 4], ["mantik", 4], ["permutasyon-kombinasyon-olasilik", 4], ["veri-istatistik", 4]],
  },
  {
    slug: "tyt-geometri",
    name: "TYT Geometri",
    summary: "Açılar, üçgenler, dörtgenler ve çemberde temel seviye ölçümü.",
    scope: "TYT",
    durationMinutes: 25,
    dist: [["geo-acilar", 3], ["geo-ucgenler", 4], ["geo-dortgenler", 4], ["geo-cember-daire", 4]],
  },
  // ── AYT ───────────────────────────────────────────────────────
  {
    slug: "ayt-tanisma",
    name: "AYT Tanışma Check-up'ı",
    summary: "12 soru, 20 dakika. AYT cebirinin dört temel konusunda başlangıç ölçümü.",
    scope: "AYT",
    kind: "INTRO",
    durationMinutes: 20,
    dist: [["fonksiyonlar-ayt", 3], ["polinomlar-ayt", 3], ["ikinci-derece-ayt", 3], ["logaritma", 3]],
  },
  {
    slug: "ayt-cebir-kusagi",
    name: "AYT Cebir Kuşağı",
    summary: "Trigonometri ve limit-türev-integral öncesi cebirin beş temel konusu.",
    scope: "AYT",
    durationMinutes: 28,
    dist: [
      ["fonksiyonlar-ayt", 4], ["polinomlar-ayt", 4], ["ikinci-derece-ayt", 4],
      ["karmasik-sayilar", 4], ["logaritma", 4],
    ],
  },
  {
    slug: "trigonometri",
    name: "Trigonometri",
    summary: "Birim çemberden trigonometrik denklemlere, dört alt konuda dörder soru.",
    scope: "AYT",
    durationMinutes: 20,
    dist: [
      ["birim-cember", 4], ["trigonometrik-fonksiyonlar", 4],
      ["toplam-fark-formulleri", 4], ["trigonometrik-denklemler", 4],
    ],
  },
  {
    slug: "analitik-geometri",
    name: "Analitik Geometri",
    summary: "Nokta, doğru ve çemberin analitiğinde beşer soru.",
    scope: "AYT",
    durationMinutes: 20,
    dist: [["noktanin-analitigi", 5], ["dogrunun-analitigi", 5], ["cemberin-analitigi", 5]],
  },
  {
    slug: "ayt-analiz",
    name: "AYT Analiz",
    summary: "Diziler, limit, türev ve integral: AYT'nin son çeyreğini belirleyen dört konu.",
    scope: "AYT",
    durationMinutes: 35,
    dist: [["diziler", 4], ["limit-sureklilik", 4], ["turev", 4], ["integral", 4]],
  },
  // ── KPSS (Lisans) ─────────────────────────────────────────────
  {
    slug: "kpss-tanisma",
    name: "KPSS Tanışma Check-up'ı",
    summary: "12 soru, 15 dakika. KPSS matematiğin dört temel konusunda başlangıç ölçümü.",
    scope: "KPSS_LISANS",
    kind: "INTRO",
    durationMinutes: 15,
    dist: [["temel-kavramlar", 3], ["bolunebilme", 3], ["oran-oranti", 3], ["sayi-kesir-problemleri", 3]],
  },
  {
    slug: "kpss-matematik-genel",
    name: "KPSS Matematik Çekirdek",
    summary: "KPSS'de her yıl soru getiren altı temel konuda seviye taraması.",
    scope: "KPSS_LISANS",
    durationMinutes: 24,
    dist: [
      ["temel-kavramlar", 3], ["bolunebilme", 3], ["uslu-sayilar", 3],
      ["koklu-sayilar", 3], ["oran-oranti", 3], ["carpanlara-ayirma", 3],
    ],
  },
  {
    slug: "kpss-problemler",
    name: "KPSS Problemler",
    summary: "Sayı-kesirden faize, KPSS'de en çok zaman yakan beş problem tipi.",
    scope: "KPSS_LISANS",
    durationMinutes: 26,
    dist: [
      ["sayi-kesir-problemleri", 4], ["yuzde-kar-zarar", 4], ["hareket-hiz-problemleri", 4],
      ["isci-havuz-problemleri", 4], ["faiz-problemleri", 4],
    ],
  },
  {
    slug: "kpss-mantik-veri",
    name: "KPSS Sayısal Mantık ve Veri",
    summary: "Sayı dizileri, tablo-grafik, sayma-olasılık: formülle değil muhakemeyle çözülen blok.",
    scope: "KPSS_LISANS",
    durationMinutes: 22,
    dist: [
      ["sayi-dizileri", 4], ["tablo-grafik-yorumlama", 4],
      ["permutasyon-kombinasyon-olasilik", 4], ["islem-moduler-aritmetik", 3],
    ],
  },
  {
    slug: "kpss-geometri",
    name: "KPSS Geometri",
    summary: "Açılardan katı cisimlere, KPSS geometrisinin beş ana bloğu.",
    scope: "KPSS_LISANS",
    durationMinutes: 24,
    dist: [
      ["geo-acilar", 3], ["geo-ucgenler", 4], ["geo-dortgenler", 4],
      ["geo-cember-daire", 3], ["geo-kati-cisimler", 3],
    ],
  },
  // ── DGS ───────────────────────────────────────────────────────
  {
    slug: "dgs-tanisma",
    name: "DGS Tanışma Check-up'ı",
    summary: "12 soru, 17 dakika. DGS sayısalın dört temel konusunda başlangıç ölçümü.",
    scope: "DGS",
    kind: "INTRO",
    durationMinutes: 17,
    dist: [["temel-kavramlar", 3], ["oran-oranti", 3], ["sayi-kesir-problemleri", 3], ["sayisal-mantik", 3]],
  },
  {
    slug: "dgs-sayisal-genel",
    name: "DGS Sayısal Çekirdek",
    summary: "DGS sayısal bölümün temel matematik konuları ve sayısal mantık.",
    scope: "DGS",
    durationMinutes: 26,
    dist: [
      ["temel-kavramlar", 3], ["bolunebilme", 3], ["uslu-sayilar", 3],
      ["koklu-sayilar", 3], ["oran-oranti", 3], ["sayisal-mantik", 3],
    ],
  },
  {
    slug: "dgs-problemler",
    name: "DGS Problemler",
    summary: "DGS'de en çok karşılaşılan beş problem tipinde dörder soru.",
    scope: "DGS",
    durationMinutes: 28,
    dist: [
      ["sayi-kesir-problemleri", 4], ["yuzde-kar-zarar", 4], ["hareket-hiz-problemleri", 4],
      ["isci-havuz-problemleri", 4], ["karisim-problemleri", 4],
    ],
  },
  {
    slug: "dgs-mantik-veri",
    name: "DGS Sayısal Mantık ve Veri",
    summary: "DGS'yi DGS yapan blok: sayısal mantık, tablo-grafik, sayma-olasılık.",
    scope: "DGS",
    durationMinutes: 22,
    dist: [
      ["sayisal-mantik", 4], ["tablo-grafik-yorumlama", 4],
      ["permutasyon-kombinasyon-olasilik", 4], ["kumeler", 3],
    ],
  },
  // ── ALES ──────────────────────────────────────────────────────
  {
    slug: "ales-tanisma",
    name: "ALES Tanışma Check-up'ı",
    summary: "12 soru, 16 dakika. ALES sayısalın dört temel konusunda başlangıç ölçümü.",
    scope: "ALES",
    kind: "INTRO",
    durationMinutes: 16,
    dist: [["temel-kavramlar", 3], ["oran-oranti", 3], ["sayi-kesir-problemleri", 3], ["sayi-dizileri", 3]],
  },
  {
    slug: "ales-sayisal-genel",
    name: "ALES Sayısal Çekirdek",
    summary: "ALES sayısalın beş temel konusunda üçer soruyla seviye taraması.",
    scope: "ALES",
    durationMinutes: 23,
    dist: [
      ["temel-kavramlar", 3], ["bolunebilme", 3], ["uslu-sayilar", 3],
      ["koklu-sayilar", 3], ["oran-oranti", 3],
    ],
  },
  {
    slug: "ales-problemler",
    name: "ALES Problemler",
    summary: "ALES sayısalın ağırlık merkezi: beş problem tipinde dörder soru.",
    scope: "ALES",
    durationMinutes: 30,
    dist: [
      ["sayi-kesir-problemleri", 4], ["yuzde-kar-zarar", 4], ["hareket-hiz-problemleri", 4],
      ["isci-havuz-problemleri", 4], ["faiz-problemleri", 4],
    ],
  },
  {
    slug: "ales-mantik-veri",
    name: "ALES Sayısal Mantık ve Veri",
    summary: "Sayı dizileri, tablo-grafik, sayma-olasılık ve veri: muhakeme bloğu.",
    scope: "ALES",
    durationMinutes: 23,
    dist: [
      ["sayi-dizileri", 4], ["tablo-grafik-yorumlama", 4],
      ["permutasyon-kombinasyon-olasilik", 4], ["veri-istatistik", 3],
    ],
  },
];

/**
 * Konu tekrar testleri — her sınav için bir gizli paket.
 *
 * Plandaki "kanıt" adımı bunlarla çalışıyor: tek konudan 5 soru, 8 dakika.
 * Katalogda görünmezler (kind=RETEST), konu üzerinden başlatılırlar.
 * Soruları PackageTopic'ten değil oturumun focusTopicId'sinden seçiliyor,
 * bu yüzden dağılımları boş.
 */
const RETEST_PACKAGES: SeedPackage[] = (
  ["LGS", "TYT", "AYT", "KPSS_LISANS", "DGS", "ALES"] as const
).map((scope) => ({
  slug: `konu-tekrar-${scope.toLowerCase()}`,
  name: `Konu Tekrar Testi (${EXAMS[scope].short})`,
  summary: "Tek konudan 5 soru. Çalıştığın konunun gerçekten oturup oturmadığını ölçer.",
  scope,
  kind: "RETEST" as const,
  durationMinutes: 8,
  dist: [],
}));

const RETEST_SORU = 5;

async function seedTopics(list: SeedTopic[], parentId: string | null, depth = 0) {
  let index = 0;
  for (const t of list) {
    const scopes = t.scopes ?? ORTAK_KONULAR[t.slug] ?? [t.scope];
    const ortak = {
      name: t.name,
      examScope: t.scope,
      examScopes: scopes,
      examWeights: t.weights ?? {},
      parentId,
      sortOrder: index,
      recommendedProductIds: t.products ?? [],
    };

    const topic = await prisma.topic.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, ...ortak },
      update: ortak,
    });

    const etiket = scopes.length > 1 ? ` (${scopes.length} sınav)` : "";
    console.log(`${"  ".repeat(depth + 1)}· ${t.name}${etiket}`);
    if (t.children) await seedTopics(t.children, topic.id, depth + 1);
    index += 1;
  }
}

type PaketDagilimi = { topicId: string; questionCount: number }[];

/**
 * Bir sınavda paketin her konudan çekebileceği yayındaki soru — öğrenci
 * uygulamasının paket seçimindeki kuralla (lib/exam-scope.ts soruSinavdaKosulu):
 * soru kapsamı doluysa o liste, boşsa konusunun sınavları. Eskiden kapsama hiç
 * bakılmıyordu; başka sınava kısıtlı sorular havuzda sayılıyordu.
 */
const havuzlar = new Map<Scope, Map<string, number>>();
async function sinavHavuzu(sinav: Scope): Promise<Map<string, number>> {
  let havuz = havuzlar.get(sinav);
  if (!havuz) {
    const sayimlar = await prisma.question.groupBy({
      by: ["topicId"],
      where: { status: "PUBLISHED", ...soruSinavdaKosulu(sinav) },
      _count: { _all: true },
    });
    havuz = new Map(sayimlar.map((s) => [s.topicId, s._count._all]));
    havuzlar.set(sinav, havuz);
  }
  return havuz;
}

async function eksikKonular(sinav: Scope, dagilim: PaketDagilimi): Promise<PaketDagilimi> {
  const havuz = await sinavHavuzu(sinav);
  return dagilim.filter((d) => (havuz.get(d.topicId) ?? 0) < d.questionCount);
}

async function seedPackages() {
  const topics = await prisma.topic.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(topics.map((t) => [t.slug, t.id]));
  const slugById = new Map(topics.map((t) => [t.id, t.slug]));

  const hepsi = [...PACKAGES, ...RETEST_PACKAGES];
  let korunan = 0;

  for (const [index, p] of hepsi.entries()) {
    const retest = p.kind === "RETEST";
    const total = retest ? RETEST_SORU : p.dist.reduce((sum, [, n]) => sum + n, 0);

    const missing = p.dist.filter(([slug]) => !idBySlug.has(slug)).map(([slug]) => slug);
    if (missing.length) {
      throw new Error(`Paket "${p.slug}": tanımsız konu → ${missing.join(", ")}`);
    }

    // Kural: konu başına en az MIN_PER_TOPIC soru. Burada patlaması, üretimde
    // "yeterli soru yok" yazan bir sonuç ekranından iyidir. (Panel aynı kuralı
    // kendi kaydında uyguluyor.)
    const thin = p.dist.filter(([, n]) => n < MIN_PER_TOPIC);
    if (thin.length) {
      throw new Error(
        `Paket "${p.slug}": şu konularda ${MIN_PER_TOPIC}'ten az soru var → ` +
          thin.map(([slug, n]) => `${slug} (${n})`).join(", ") +
          `. Tek/çift soruyla konu seviyesi ölçülemez; konu sayısını azalt.`
      );
    }

    const seedDagilimi: PaketDagilimi = p.dist.map(([slug, count]) => ({
      topicId: idBySlug.get(slug)!,
      questionCount: count,
    }));

    // Sınavdan türeyen alanlar: her çalıştırmada senkron (sınav sabiti değişince yayılsın).
    const sinavdan = {
      kind: p.kind ?? "STANDARD",
      examScope: p.scope,
      // Sınavın kendi puanlaması: LGS 3 yanlış 1 doğru, YKS 4 yanlış 1 doğru.
      penaltyRatio: EXAMS[p.scope].penaltyRatio.toFixed(4),
      sortOrder: index,
    } as const;
    // İçerik: yalnızca oluştururken ya da --guncelle ile.
    const icerik = {
      name: p.name,
      summary: p.summary,
      questionCount: total,
      durationMinutes: p.durationMinutes,
    };

    const mevcut = await prisma.package.findUnique({
      where: { slug: p.slug },
      select: {
        id: true,
        status: true,
        name: true,
        summary: true,
        questionCount: true,
        durationMinutes: true,
        topics: { orderBy: { sortOrder: "asc" }, select: { topicId: true, questionCount: true } },
      },
    });

    /*
     * Havuzu yetmeyen paket YAYINA ALINMAZ (ve yayındaysa taslağa çekilir).
     * Öğrencinin katalogda görüp "Başla"ya bastığında "yeterli soru yok"
     * hatası alması, paketi hiç görmemesinden kötü. Havuz dolunca panelden
     * (Check-up → Paketler) yayına alınır. Bakılan dağılım paketin GEÇERLİ
     * dağılımı: içerik korunuyorsa veritabanındaki (panelde değişmiş olabilir).
     */
    // Panelin düzenlediği tek tür katalog paketi; sistem paketleri hep bu dosyadan.
    const panelPaketi = (p.kind ?? "STANDARD") === "STANDARD";
    const icerikYaz = !mevcut || GUNCELLE || !panelPaketi;
    const gecerliDagilim = icerikYaz ? seedDagilimi : mevcut.topics;
    const eksik = retest ? [] : await eksikKonular(p.scope, gecerliDagilim);
    const hazir = !retest && eksik.length === 0;

    let notu: string;
    if (!mevcut) {
      await prisma.package.create({
        data: {
          slug: p.slug,
          ...sinavdan,
          ...icerik,
          // Konu tekrar testleri her zaman açık (katalogda görünmüyorlar).
          status: retest || hazir ? "PUBLISHED" : "DRAFT",
          topics: { create: seedDagilimi.map((d, i) => ({ ...d, sortOrder: i })) },
        },
      });
      notu = "yeni";
    } else {
      await prisma.package.update({
        where: { id: mevcut.id },
        data: {
          ...sinavdan,
          ...(icerikYaz ? icerik : {}),
          // Havuz yetmiyorsa yayından alıyoruz; yetiyorsa mevcut durumu
          // ezmiyoruz (panelden bilerek taslağa çekilmiş olabilir).
          ...(!retest && !hazir ? { status: "DRAFT" as const } : {}),
        },
      });
      if (icerikYaz) {
        await prisma.packageTopic.deleteMany({ where: { packageId: mevcut.id } });
        if (seedDagilimi.length) {
          await prisma.packageTopic.createMany({
            data: seedDagilimi.map((d, i) => ({ ...d, packageId: mevcut.id, sortOrder: i })),
          });
        }
        notu = panelPaketi ? "içerik bu dosyadan yazıldı" : "sistem paketi: içerik bu dosyadan";
      } else {
        // Hangi içerik alanı bu dosyadakinden farklı — panelde değiştirilmiş olabilir.
        const farklar = [
          mevcut.name !== icerik.name ? "ad" : null,
          (mevcut.summary ?? "") !== icerik.summary ? "özet" : null,
          mevcut.durationMinutes !== icerik.durationMinutes ? "süre" : null,
          mevcut.questionCount !== icerik.questionCount ? "soru sayısı" : null,
          JSON.stringify(mevcut.topics) !== JSON.stringify(seedDagilimi) ? "konu dağılımı" : null,
        ].filter(Boolean);
        if (farklar.length) korunan += 1;
        notu = farklar.length ? "içerik korundu (" + farklar.join(", ") + " bu dosyadakinden farklı)" : "içerik aynı";
      }
    }

    const durum = retest
      ? "gizli"
      : hazir
        ? mevcut?.status === "DRAFT"
          ? "havuz yeterli — panelden yayına alınabilir"
          : "yayında"
        : `TASLAK — eksik: ${eksik.map((d) => slugById.get(d.topicId) ?? d.topicId).join(", ")}`;
    const ad = icerikYaz ? p.name : mevcut!.name;
    const soru = icerikYaz ? total : mevcut!.questionCount;
    const dakika = icerikYaz ? p.durationMinutes : mevcut!.durationMinutes;
    console.log(`  · ${ad} — ${soru} soru / ${dakika} dk · ${durum} · ${notu}`);
  }

  if (korunan && !GUNCELLE) {
    console.log(
      `\n  ${korunan} paketin içeriği bu dosyadakinden farklı ve KORUNDU (panelde düzenlenmiş olabilir).` +
        `\n  Bu dosyadaki hâline döndürmek için: npm run db:seed -- --guncelle`
    );
  }
}

// Yönetici hesabı AÇILMIYOR: yönetim admin.kocum.net'te (kocumnet/admin) ve
// orada backend'in personel hesaplarıyla giriş yapılıyor. Bu veritabanındaki
// kullanıcılar yalnızca öğrenci.

async function main() {
  console.log("\nKonular:");
  await seedTopics(TOPICS, null);

  console.log(GUNCELLE ? "\nPaketler (--guncelle: içerik bu dosyadan yazılıyor):" : "\nPaketler:");
  await seedPackages();

  const [topicCount, packageCount, yayinda] = await Promise.all([
    prisma.topic.count(),
    prisma.package.count(),
    prisma.package.count({ where: { status: "PUBLISHED", kind: { not: "RETEST" } } }),
  ]);
  console.log(
    `\nToplam: ${topicCount} konu, ${packageCount} paket (${yayinda} tanesi öğrenciye açık).\n`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
