import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/password";

/**
 * Konu ağacı ve paketler. Bunlar "referans veri": uygulamanın çalışması için
 * gerekli, kullanıcı üretmiyor. Seed idempotent (slug üzerinden upsert), tekrar
 * çalıştırmak güvenli.
 *
 *   npm run db:seed
 */

type SeedTopic = {
  slug: string;
  name: string;
  scope: "TYT" | "AYT";
  products?: string[];
  children?: SeedTopic[];
};

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
    slug: "tyt-matematik",
    name: "TYT Matematik",
    scope: "TYT",
    children: [
      { slug: "temel-kavramlar", name: "Temel Kavramlar", scope: "TYT", products: [P.tytIlk15] },
      { slug: "sayi-basamaklari", name: "Sayı Basamakları", scope: "TYT", products: [P.tytIlk15] },
      { slug: "bolunebilme", name: "Bölme ve Bölünebilme", scope: "TYT", products: [P.tytIlk15] },
      { slug: "ebob-ekok", name: "EBOB - EKOK", scope: "TYT", products: [P.tytIlk15] },
      { slug: "rasyonel-sayilar", name: "Rasyonel Sayılar", scope: "TYT", products: [P.tytIlk15] },
      { slug: "basit-esitsizlikler", name: "Basit Eşitsizlikler", scope: "TYT", products: [P.tytIlk15] },
      { slug: "mutlak-deger", name: "Mutlak Değer", scope: "TYT", products: [P.tytIlk15] },
      { slug: "uslu-sayilar", name: "Üslü Sayılar", scope: "TYT", products: [P.tytIlk15] },
      { slug: "koklu-sayilar", name: "Köklü Sayılar", scope: "TYT", products: [P.tytIlk15] },
      { slug: "carpanlara-ayirma", name: "Çarpanlara Ayırma", scope: "TYT", products: [P.tytIlk15] },
      { slug: "oran-oranti", name: "Oran - Orantı", scope: "TYT", products: [P.tytIlk15, P.problemPaketi] },
      { slug: "denklem-cozme", name: "Denklem Çözme", scope: "TYT", products: [P.tytIlk15] },
      {
        slug: "problemler",
        name: "Problemler",
        scope: "TYT",
        products: [P.problemPaketi, P.osymDiliyle, P.sankiOsym],
        children: [
          { slug: "sayi-kesir-problemleri", name: "Sayı - Kesir Problemleri", scope: "TYT", products: [P.problemPaketi, P.sankiOsym] },
          { slug: "yas-problemleri", name: "Yaş Problemleri", scope: "TYT", products: [P.problemPaketi] },
          { slug: "isci-havuz-problemleri", name: "İşçi - Havuz Problemleri", scope: "TYT", products: [P.problemPaketi, P.osymDiliyle] },
          { slug: "hareket-hiz-problemleri", name: "Hareket - Hız Problemleri", scope: "TYT", products: [P.problemPaketi, P.osymDiliyle] },
          { slug: "yuzde-kar-zarar", name: "Yüzde - Kâr - Zarar Problemleri", scope: "TYT", products: [P.problemPaketi, P.sankiOsym] },
          { slug: "karisim-problemleri", name: "Karışım Problemleri", scope: "TYT", products: [P.problemPaketi] },
          { slug: "grafik-problemleri", name: "Grafik Problemleri", scope: "TYT", products: [P.osymDiliyle] },
          { slug: "rutin-olmayan-problemler", name: "Rutin Olmayan Problemler", scope: "TYT", products: [P.sankiOsym, P.osymDiliyle] },
        ],
      },
      { slug: "kumeler", name: "Kümeler", scope: "TYT", products: [P.muhtesemUclu] },
      { slug: "mantik", name: "Mantık", scope: "TYT", products: [P.muhtesemUclu] },
      { slug: "fonksiyonlar-tyt", name: "Fonksiyonlar", scope: "TYT", products: [P.tytIlk15, P.muhtesemUclu] },
      { slug: "polinomlar-tyt", name: "Polinomlar", scope: "TYT", products: [P.tytIlk15] },
      { slug: "ikinci-derece-tyt", name: "2. Dereceden Denklemler", scope: "TYT", products: [P.tytIlk15] },
      { slug: "permutasyon-kombinasyon-olasilik", name: "Permütasyon - Kombinasyon - Olasılık", scope: "TYT", products: [P.muhtesemUclu] },
      { slug: "veri-istatistik", name: "Veri - İstatistik", scope: "TYT", products: [P.muhtesemUclu] },
    ],
  },
  {
    slug: "ayt-matematik",
    name: "AYT Matematik",
    scope: "AYT",
    children: [
      { slug: "fonksiyonlar-ayt", name: "Fonksiyonlar (İleri)", scope: "AYT", products: [P.aytIlk16] },
      { slug: "polinomlar-ayt", name: "Polinomlar", scope: "AYT", products: [P.aytIlk16] },
      { slug: "ikinci-derece-ayt", name: "2. Dereceden Denklemler ve Eşitsizlikler", scope: "AYT", products: [P.aytIlk16] },
      { slug: "karmasik-sayilar", name: "Karmaşık Sayılar", scope: "AYT", products: [P.aytIlk16] },
      { slug: "logaritma", name: "Logaritma", scope: "AYT", products: [P.aytIlk16] },
      { slug: "diziler", name: "Diziler", scope: "AYT", products: [P.aytIlk16] },
      { slug: "limit-sureklilik", name: "Limit ve Süreklilik", scope: "AYT" },
      { slug: "turev", name: "Türev", scope: "AYT" },
      { slug: "integral", name: "İntegral", scope: "AYT" },
      {
        slug: "trigonometri",
        name: "Trigonometri",
        scope: "AYT",
        products: [P.trigonometri],
        children: [
          { slug: "birim-cember", name: "Birim Çember", scope: "AYT", products: [P.trigonometri] },
          { slug: "trigonometrik-fonksiyonlar", name: "Trigonometrik Fonksiyonlar", scope: "AYT", products: [P.trigonometri] },
          { slug: "toplam-fark-formulleri", name: "Toplam - Fark Formülleri", scope: "AYT", products: [P.trigonometri] },
          { slug: "trigonometrik-denklemler", name: "Trigonometrik Denklemler", scope: "AYT", products: [P.trigonometri] },
        ],
      },
      {
        slug: "analitik-geometri",
        name: "Analitik Geometri",
        scope: "AYT",
        products: [P.analitik],
        children: [
          { slug: "noktanin-analitigi", name: "Noktanın Analitiği", scope: "AYT", products: [P.analitik] },
          { slug: "dogrunun-analitigi", name: "Doğrunun Analitiği", scope: "AYT", products: [P.analitik] },
          { slug: "cemberin-analitigi", name: "Çemberin Analitiği", scope: "AYT", products: [P.analitik] },
        ],
      },
    ],
  },
];

type SeedPackage = {
  slug: string;
  name: string;
  summary: string;
  scope: "TYT" | "AYT";
  durationMinutes: number;
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

const PACKAGES: SeedPackage[] = [
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
];

async function seedTopics(list: SeedTopic[], parentId: string | null, depth = 0) {
  let index = 0;
  for (const t of list) {
    const topic = await prisma.topic.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        examScope: t.scope,
        parentId,
        sortOrder: index,
        recommendedProductIds: t.products ?? [],
      },
      update: {
        name: t.name,
        examScope: t.scope,
        parentId,
        sortOrder: index,
        recommendedProductIds: t.products ?? [],
      },
    });
    console.log(`${"  ".repeat(depth + 1)}· ${t.name}`);
    if (t.children) await seedTopics(t.children, topic.id, depth + 1);
    index += 1;
  }
}

async function seedPackages() {
  const topics = await prisma.topic.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(topics.map((t) => [t.slug, t.id]));

  for (const [index, p] of PACKAGES.entries()) {
    const total = p.dist.reduce((sum, [, n]) => sum + n, 0);

    // Dağılım toplamı ile soru adedi tutmazsa paket sessizce eksik/fazla soru
    // üretir. Seed'de patlaması, üretimde fark edilmemesinden iyidir.
    const missing = p.dist.filter(([slug]) => !idBySlug.has(slug)).map(([slug]) => slug);
    if (missing.length) {
      throw new Error(`Paket "${p.slug}": tanımsız konu → ${missing.join(", ")}`);
    }

    // Kural: konu başına en az MIN_PER_TOPIC soru. Burada patlaması, üretimde
    // "yeterli soru yok" yazan bir sonuç ekranından iyidir.
    const thin = p.dist.filter(([, n]) => n < MIN_PER_TOPIC);
    if (thin.length) {
      throw new Error(
        `Paket "${p.slug}": şu konularda ${MIN_PER_TOPIC}'ten az soru var → ` +
          thin.map(([slug, n]) => `${slug} (${n})`).join(", ") +
          `. Tek/çift soruyla konu seviyesi ölçülemez; konu sayısını azalt.`
      );
    }

    const pkg = await prisma.package.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        summary: p.summary,
        examScope: p.scope,
        questionCount: total,
        durationMinutes: p.durationMinutes,
        status: "PUBLISHED",
        sortOrder: index,
        penaltyRatio: "0.25", // YKS: 4 yanlış 1 doğru
      },
      update: {
        name: p.name,
        summary: p.summary,
        examScope: p.scope,
        questionCount: total,
        durationMinutes: p.durationMinutes,
        sortOrder: index,
      },
    });

    // Dağılımı baştan yaz: seed'den konu çıkarıldıysa artık kalmasın.
    await prisma.packageTopic.deleteMany({ where: { packageId: pkg.id } });
    await prisma.packageTopic.createMany({
      data: p.dist.map(([slug, count], i) => ({
        packageId: pkg.id,
        topicId: idBySlug.get(slug)!,
        questionCount: count,
        sortOrder: i,
      })),
    });

    console.log(`  · ${p.name} — ${total} soru / ${p.durationMinutes} dk`);
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  // Bilinen varsayılan parolalı admin hesabı AÇMIYORUZ. Hesap ancak ortam
  // değişkenleri verilirse kurulur.
  if (!email || !password) {
    console.log("\n  (admin atlandı — SEED_ADMIN_EMAIL ve SEED_ADMIN_PASSWORD tanımlı değil)");
    return;
  }

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      name: process.env.SEED_ADMIN_NAME ?? "Yönetici",
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
    update: { role: "ADMIN" },
  });
  console.log(`\n  · admin: ${email}`);
}

async function main() {
  console.log("\nKonular:");
  await seedTopics(TOPICS, null);

  console.log("\nPaketler:");
  await seedPackages();

  await seedAdmin();

  const [topicCount, packageCount] = await Promise.all([
    prisma.topic.count(),
    prisma.package.count(),
  ]);
  console.log(`\nToplam: ${topicCount} konu, ${packageCount} paket.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
