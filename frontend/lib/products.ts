import type { Locale } from "@/lib/i18n/config";

/**
 * Ürün kataloğu — PDF "Ürünlerimiz" içeriğinden.
 * Ürün ADLARI marka/ürün adı olduğu için üç dilde de Türkçe kalır (ÖSYM/TYT/AYT
 * zaten özel ad). Slogan ve format 3 dilde çevrilidir. Fotoğraf yok (sade).
 */
export type LocalizedText = Record<Locale, string>;

export type ProductCategory = "problem" | "matematik" | "turkce";

export interface Product {
  id: string;
  category: ProductCategory;
  /** Türkçe ürün adı (tüm dillerde aynı) */
  name: string;
  /** Soru sayısı (sadece rakam; "1000+" gibi ise "+" dahil) */
  questionCount: string;
  /** Sınav etiketleri — özel ad, çevrilmez */
  exams: string[];
  tagline: LocalizedText;
  format: LocalizedText;
}

export const PRODUCT_CATEGORIES: ProductCategory[] = ["problem", "matematik", "turkce"];

export const PRODUCTS: Product[] = [
  // ── Matematik – Problemler ───────────────────────────────────────────────
  {
    id: "problemler-soru-paketi",
    category: "problem",
    name: "“Tam ÖSYM Ayarı” Problemler Soru Paketi",
    questionCount: "1200",
    exams: ["TYT", "MSÜ"],
    tagline: {
      tr: "Tek bir kalın kitap yerine taşınabilir, bitirilebilir 6 tematik fasikül; ÖSYM’nin gerçek ağırlık dengesine göre ayrılmış 1200 özgün problem.",
      en: "Six portable, finishable thematic booklets instead of one thick book — 1200 original problems split by ÖSYM’s real topic weighting.",
      ar: "ستة كتيّبات موضوعية محمولة يمكن إنهاؤها بدل كتاب واحد ضخم — 1200 مسألة أصلية موزّعة حسب أوزان ÖSYM الحقيقية.",
    },
    format: {
      tr: "6 fasikül · A4 tel dikiş",
      en: "6 booklets · A4 stapled",
      ar: "6 كتيّبات · A4 بغرزة سلكية",
    },
  },
  {
    id: "osym-diliyle-problemler",
    category: "problem",
    name: "“ÖSYM Diliyle Problemler” – 50×13 Branş Denemesi",
    questionCount: "650",
    exams: ["TYT", "MSÜ"],
    tagline: {
      tr: "Sınavdaki 12-13 soruluk problem bloğunun birebir simülasyonu; süre baskısını reflekse çeviren 50 etaplık prova.",
      en: "A one-to-one simulation of the exam’s 12–13 question problem block — 50 timed drills that turn time pressure into reflex.",
      ar: "محاكاة مطابقة لكتلة المسائل المكوّنة من 12–13 سؤالًا في الامتحان — 50 اختبارًا موقوتًا يحوّل ضغط الوقت إلى انعكاس.",
    },
    format: {
      tr: "13 soruluk 50 deneme",
      en: "50 tests × 13 questions",
      ar: "50 اختبارًا × 13 سؤالًا",
    },
  },
  {
    id: "sanki-osym-problemleri",
    category: "problem",
    name: "“Sanki ÖSYM Problemleri” – İkiz Kurgulanmış Sorular",
    questionCount: "950",
    exams: ["TYT", "MSÜ", "ALES", "DGS", "KPSS"],
    tagline: {
      tr: "Çıkmış problemlerin yeni nesil ve “ters akış” ikizleriyle ÖSYM’nin soru yazma mantığını kavratan özgün seri.",
      en: "Original “twin” reworkings — including reverse-flow versions — of past problems that teach ÖSYM’s question-writing logic.",
      ar: "صياغات «توأمية» أصلية — تشمل نسخًا معكوسة التدفّق — لمسائل سابقة تُكسبك منطق ÖSYM في كتابة الأسئلة.",
    },
    format: {
      tr: "950+ ikiz soru",
      en: "950+ twin questions",
      ar: "أكثر من 950 سؤالًا توأميًا",
    },
  },
  // ── TYT & AYT Matematik-Geometri ─────────────────────────────────────────
  {
    id: "tyt-matematik-ilk-15",
    category: "matematik",
    name: "TYT Matematik “İlk 15” Branş Denemeleri",
    questionCount: "750",
    exams: ["TYT"],
    tagline: {
      tr: "TYT’nin çekirdek matematiğini oluşturan ilk 15 soruyu firesiz ve hızlı geçmek için 50 branş denemesi (Problemler ve PKOB hariç).",
      en: "50 branch tests to clear TYT’s core first-15 questions fast and error-free (word problems and PKOB excluded).",
      ar: "50 اختبارًا نوعيًا لاجتياز الأسئلة الـ15 الأولى الأساسية في TYT بسرعة ودون أخطاء (باستثناء المسائل وPKOB).",
    },
    format: {
      tr: "15 soruluk 50 deneme",
      en: "50 tests × 15 questions",
      ar: "50 اختبارًا × 15 سؤالًا",
    },
  },
  {
    id: "ayt-matematik-ilk-16",
    category: "matematik",
    name: "AYT Matematik “İlk 16” Branş Denemeleri – Cebir Kuşağı",
    questionCount: "800",
    exams: ["AYT"],
    tagline: {
      tr: "Trigonometri ve Limit-Türev-İntegral öncesi cebir kuşağını hatasız kapatmak için 50 AYT branş denemesi.",
      en: "50 AYT branch tests to lock down the algebra band that comes before trigonometry and calculus.",
      ar: "50 اختبارًا نوعيًا لـ AYT لإتقان نطاق الجبر الذي يسبق حساب المثلثات والتفاضل والتكامل.",
    },
    format: {
      tr: "16 soruluk 50 deneme",
      en: "50 tests × 16 questions",
      ar: "50 اختبارًا × 16 سؤالًا",
    },
  },
  {
    id: "muhtesem-uclu",
    category: "matematik",
    name: "“Muhteşem Üçlü”: Binom · Mantık · Kartezyen",
    questionCount: "900",
    exams: ["AYT"],
    tagline: {
      tr: "“Kolay” sanılıp geçiştirilen üç konuda (Binom, Mantık, Kartezyen) her birinden 300+ soruyla +3 neti garantiye alın.",
      en: "300+ questions in each of the three ‘easy-looking’ topics (Binomial, Logic, Cartesian) to secure +3 net.",
      ar: "أكثر من 300 سؤال لكل موضوع من المواضيع الثلاثة التي تُظنّ «سهلة» (ذات الحدّين، المنطق، الجداء الديكارتي) لضمان +3 صافٍ.",
    },
    format: {
      tr: "3 fasikül · her biri 48 sayfa",
      en: "3 booklets · 48 pages each",
      ar: "3 كتيّبات · 48 صفحة لكلٍّ منها",
    },
  },
  {
    id: "trigonometri-5te5",
    category: "matematik",
    name: "Trigonometri 5’te 5 AYT Soru Seti",
    questionCount: "750",
    exams: ["AYT"],
    tagline: {
      tr: "Trigonometriyi 5’te 5’lik net kalesine çeviren, tamamı sınav ayarında 750+ özgün soru.",
      en: "750+ exam-calibre questions that turn trigonometry into a reliable 5-out-of-5.",
      ar: "أكثر من 750 سؤالًا بمعايير الامتحان تحوّل حساب المثلثات إلى 5 من 5 موثوقة.",
    },
    format: {
      tr: "A4 tel dikişli fasikül",
      en: "A4 stapled booklets",
      ar: "كتيّبات A4 بغرزة سلكية",
    },
  },
  {
    id: "analitik-5te5",
    category: "matematik",
    name: "Analitik 5’te 5 AYT Soru Seti",
    questionCount: "1000",
    exams: ["AYT"],
    tagline: {
      tr: "Alt başlıksız ve %90 sözel 1000+ soruyla AYT Geometri’nin analitik bloğunda 5’te 5.",
      en: "1000+ mostly text-based, un-subheaded questions for a 5-out-of-5 in AYT geometry’s analytic block.",
      ar: "أكثر من 1000 سؤال نصّي في معظمه وبلا عناوين فرعية، لتحقيق 5 من 5 في الجزء التحليلي من هندسة AYT.",
    },
    format: {
      tr: "A4 tel dikişli fasikül",
      en: "A4 stapled booklets",
      ar: "كتيّبات A4 بغرزة سلكية",
    },
  },
  // ── TYT Türkçe ───────────────────────────────────────────────────────────
  {
    id: "paragraf-celdirici-kampi",
    category: "turkce",
    name: "“Sanki ÖSYM” – Paragraf & Çeldirici Kampı",
    questionCount: "1250",
    exams: ["TYT"],
    tagline: {
      tr: "TYT Türkçe’nin yaklaşık %70’ini oluşturan paragraf maratonu için çeldirici odaklı, 1250+ soruluk dev kamp.",
      en: "A 1250+ question camp focused on distractors for the paragraph marathon that makes up ~70% of TYT Turkish.",
      ar: "معسكر يضمّ أكثر من 1250 سؤالًا ويركّز على المشتِّتات لماراثون الفقرات الذي يشكّل نحو 70% من اختبار التركية في TYT.",
    },
    format: {
      tr: "A4 tel dikişli fasikül",
      en: "A4 stapled booklets",
      ar: "كتيّبات A4 بغرزة سلكية",
    },
  },
  {
    id: "sinav-ikizi-turkce-denemeleri",
    category: "turkce",
    name: "“Sınav İkizi” TYT Türkçe Branş Denemeleri",
    questionCount: "1000",
    exams: ["TYT"],
    tagline: {
      tr: "25 tam deneme × 40 soruyla süre yönetimini ve çeldirici refleksini gerçek sınav ritminde prova edin.",
      en: "25 full tests × 40 questions to rehearse time management and distractor reflexes at real exam pace.",
      ar: "25 اختبارًا كاملًا × 40 سؤالًا للتدرّب على إدارة الوقت والتعامل مع المشتِّتات بإيقاع الامتحان الحقيقي.",
    },
    format: {
      tr: "40 soruluk 25 deneme",
      en: "25 tests × 40 questions",
      ar: "25 اختبارًا × 40 سؤالًا",
    },
  },
  {
    id: "dilbilgisi-anlam-soru-bankasi",
    category: "turkce",
    name: "“Kritik Dil Bilgisi & Anlam” Soru Bankası",
    questionCount: "1200",
    exams: ["TYT"],
    tagline: {
      tr: "TYT Türkçe’nin ilk 14 sorusunu (Sözcükte/Cümlede Anlam ve Dil Bilgisi) 15 dakikada geçmek için modüler 1200 soru.",
      en: "1200 modular questions to clear TYT Turkish’s first 14 (word/sentence meaning and grammar) in 15 minutes.",
      ar: "1200 سؤالًا معياريًا لاجتياز الأسئلة الـ14 الأولى في التركية (معنى الكلمة/الجملة والقواعد) خلال 15 دقيقة.",
    },
    format: {
      tr: "A4 modüler fasikül",
      en: "A4 modular booklets",
      ar: "كتيّبات A4 معيارية",
    },
  },
];
