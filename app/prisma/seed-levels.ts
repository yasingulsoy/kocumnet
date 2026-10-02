import "dotenv/config";
import { prisma } from "../lib/db";
import { SECILEBILIR_SINAVLAR, EXAMS } from "../lib/exams";
import { ayarGetir } from "../lib/levels";

/**
 * Seviyeli check-up için tohum — İKİ parçası var.
 *
 *  1. KALICI: her sınav için gizli LEVEL paketi. Üretimde de çalışır,
 *     idempotent. Erişim hakkı ve ad bu satırdan geliyor.
 *
 *  2. SADECE GELİŞTİRME: demo kazanımlar + demo soruların seviye/kazanım
 *     etiketlenmesi. Gerçek kazanım listesi içerik ekibinden gelecek
 *     (SORU-SABLONU.md). Bu kısım yalnızca sistemi çalıştırıp görebilmek
 *     için var ve `--yalniz-paket` ile atlanabilir.
 *
 *   npm run db:seed:levels              → hepsi (geliştirme)
 *   npm run db:seed:levels -- --yalniz-paket  → yalnızca paketler (üretim)
 */

const YALNIZ_PAKET = process.argv.includes("--yalniz-paket");

async function paketleriKur() {
  console.log("\nSeviyeli check-up paketleri:");

  for (const sinav of SECILEBILIR_SINAVLAR) {
    const bilgi = EXAMS[sinav];
    const ayar = ayarGetir(sinav);
    const toplamSoru =
      ayar.seviye1.soruSayisi + ayar.seviye2.soruSayisi + ayar.seviye3.soruSayisi;
    const toplamDakika = ayar.seviye1.dakika + ayar.seviye2.dakika + ayar.seviye3.dakika;

    const slug = `${sinav.toLowerCase().replace(/_/g, "-")}-seviyeli`;

    await prisma.package.upsert({
      where: { slug },
      create: {
        slug,
        name: `${bilgi.short} Seviyeli Check-up`,
        summary: `Üç seviye, ${toplamSoru} soru. Her seviye kendi süresiyle ayrı çözülür; aralarında ara verebilirsin.`,
        examScope: sinav as never,
        kind: "LEVEL",
        status: "PUBLISHED",
        // Aşamaların kendi süreleri lib/levels.ts'ten geliyor; paketteki bu
        // alanlar yalnızca katalogda "ne kadar sürer" bilgisi için.
        questionCount: toplamSoru,
        durationMinutes: toplamDakika,
        // Seviyeli sınavda net YOK — ham doğru sayısı.
        penaltyRatio: 0,
        isFree: false,
        sortOrder: 0,
      },
      update: {
        name: `${bilgi.short} Seviyeli Check-up`,
        questionCount: toplamSoru,
        durationMinutes: toplamDakika,
        penaltyRatio: 0,
        status: "PUBLISHED",
      },
    });

    console.log(`  · ${slug} — ${toplamSoru} soru / ~${toplamDakika} dk`);
  }
}

/**
 * Demo kazanımlar: her yaprak konuya bir kazanım.
 *
 * ⚠️ GERÇEK DEĞİL. Gerçekte bir konunun birden fazla kazanımı olur
 * ("Bölme ve Bölünebilme" konusunun 3 ile, 9 ile, 11 ile bölünebilme
 * kuralları ayrı kazanımlardır). Burada 1-1 eşleme yapılıyor çünkü amaç
 * akışı çalıştırmak, içerik üretmek değil.
 */
async function demoKazanimlar() {
  const konular = await prisma.topic.findMany({
    select: { id: true, slug: true, name: true, parentId: true, sortOrder: true, examScopes: true },
    orderBy: { sortOrder: "asc" },
  });
  const ustler = new Set(konular.map((k) => k.parentId).filter(Boolean));
  const yapraklar = konular.filter((k) => !ustler.has(k.id));

  console.log(`\nDemo kazanımlar (${yapraklar.length} yaprak konu):`);

  let sayac = 0;
  for (const konu of yapraklar) {
    const code = `DEMO-${konu.slug.toUpperCase().slice(0, 28)}`;
    await prisma.objective.upsert({
      where: { code },
      create: {
        code,
        topicId: konu.id,
        name: `${konu.name} temel kazanımı`,
        examScopes: konu.examScopes,
        sortOrder: konu.sortOrder,
        status: "PUBLISHED",
      },
      update: { status: "PUBLISHED", examScopes: konu.examScopes, sortOrder: konu.sortOrder },
    });
    sayac += 1;
  }
  console.log(`  · ${sayac} kazanım yazıldı`);
}

/**
 * Demo soruları seviyelere dağıtır.
 *
 * Dağıtım zorluğa göre: 1-2 → Seviye 1, 3 → Seviye 2, 4-5 → Seviye 3.
 * Gerçekte seviye zorluktan BAĞIMSIZ bir eksen (temel bir soru da zor
 * olabilir) ve içerik ekibi elle işaretleyecek — burada demo veriyi
 * anlamlı dağıtmanın en ucuz yolu bu.
 *
 * Seviye 1 soruları ayrıca kazanıma bağlanıyor: telafi turu bunu kullanıyor.
 */
async function demoSorulariEtiketle() {
  const kazanimlar = await prisma.objective.findMany({
    where: { code: { startsWith: "DEMO-" } },
    select: { id: true, topicId: true },
  });
  const konuyaKazanim = new Map(kazanimlar.map((k) => [k.topicId, k.id]));

  console.log("\nDemo soruların seviye etiketleri:");

  // Seviye 1: kolay sorular, kazanıma bağlı.
  let s1 = 0;
  for (const [topicId, objectiveId] of konuyaKazanim) {
    const r = await prisma.question.updateMany({
      where: { topicId, difficulty: { lte: 2 }, status: "PUBLISHED" },
      data: { level: "L1_TEMEL", objectiveId },
    });
    s1 += r.count;
  }

  const s2 = await prisma.question.updateMany({
    where: { difficulty: 3, status: "PUBLISHED", level: null },
    data: { level: "L2_ORTA" },
  });

  const s3 = await prisma.question.updateMany({
    where: { difficulty: { gte: 4 }, status: "PUBLISHED", level: null },
    data: { level: "L3_ANALIZ" },
  });

  console.log(`  · Seviye 1: ${s1} soru (kazanıma bağlandı)`);
  console.log(`  · Seviye 2: ${s2.count} soru`);
  console.log(`  · Seviye 3: ${s3.count} soru`);

  /*
   * Telafi turu kontrolü: her kazanımın EN AZ İKİ Seviye 1 sorusu olmalı.
   * Biri ana turda, öteki telafi turunda. Tek sorusu olan kazanım telafi
   * turunda boş kalır ve öğrenci o kazanımı teyit etme şansı bulamaz.
   */
  const sayimlar = await prisma.question.groupBy({
    by: ["objectiveId"],
    where: { level: "L1_TEMEL", status: "PUBLISHED", objectiveId: { not: null } },
    _count: { _all: true },
  });
  const yedeksiz = sayimlar.filter((s) => s._count._all < 2);
  if (yedeksiz.length > 0) {
    console.log(
      `  ⚠️ ${yedeksiz.length} kazanımın yedek sorusu yok (telafi turunda boş kalır).`
    );
  } else {
    console.log(`  · ${sayimlar.length} kazanımın hepsinde yedek soru var ✓`);
  }
}

async function main() {
  await paketleriKur();

  if (YALNIZ_PAKET) {
    console.log("\n--yalniz-paket verildi, demo içerik atlandı.\n");
    return;
  }

  await demoKazanimlar();
  await demoSorulariEtiketle();
  console.log("\nTamam.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
