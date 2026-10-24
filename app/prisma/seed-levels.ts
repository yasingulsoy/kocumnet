import "dotenv/config";
import { prisma } from "../lib/db";
import { SECILEBILIR_SINAVLAR, EXAMS, type ExamScopeValue } from "../lib/exams";
import { konuSinavdaMi } from "../lib/exam-scope";
import { ayarGetir } from "../lib/levels";
import { seviyeliHazirlik, type SeviyeliHazirlik } from "../lib/level-selection";

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
 *   npm run db:seed:levels              → hepsi (geliştirme; üretimde DURUR)
 *   npm run db:seed:levels -- --yalniz-paket  → yalnızca paketler (üretim)
 */

const YALNIZ_PAKET = process.argv.includes("--yalniz-paket");

/**
 * ÜRETİM KORUMASI — bayraksız kip yalnızca yerel geliştirme veritabanında.
 *
 * Demo kipi GERÇEK soruların seviyesini zorluğa göre yeniden yazıyor ve
 * Seviye 1 sorularını DEMO kazanımlara bağlıyor: üretimde çalışırsa içerik
 * ekibinin kazanım eşlemesi sessizce silinir. Eskiden hiçbir koruma yoktu;
 * dağıtımda `--yalniz-paket` unutulması yetiyordu.
 *
 * @returns Durma sebebi; güvenliyse null. Adres ve sunucu adı YAZILMAZ.
 */
function demoKipiEngeli(): string | null {
  if (process.env.NODE_ENV === "production") return "NODE_ENV=production";
  const adres = process.env.DATABASE_URL;
  if (!adres) return "DATABASE_URL tanımlı değil";
  let sunucu: string;
  try {
    sunucu = new URL(adres).hostname;
  } catch {
    return "DATABASE_URL çözümlenemedi";
  }
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(sunucu)) {
    return "veritabanı sunucusu localhost değil";
  }
  return null;
}

/** Hazırlığın tek satırlık özeti: "S1 32/50 kazanım · S2 96/25 · S3 96/25". */
function hazirlikOzeti(h: SeviyeliHazirlik): string {
  return h.seviyeler
    .map((s) => `S${s.seviye} ${s.mevcut}/${s.gerekli}${s.seviye === 1 ? " kazanım" : ""}`)
    .join(" · ");
}

/**
 * Paketler.
 *
 * YENİ paket, üç seviyenin havuzu yetiyorsa yayında, yetmiyorsa TASLAK
 * açılır: havuzu yetmeyen sınavda öğrenci Seviye 1'i çözüp bir kapıda
 * "havuzda soru yok" diye kalıyordu (koşu da artık hiç açılmıyor:
 * lib/level-run.ts). Yayına almak panelin işi (Paketler › Seviyeli; panel de
 * havuz yetmiyorsa reddeder).
 *
 * VAR OLAN paketin durumuna DOKUNULMAZ. Eskiden her çalıştırma yayına
 * alıyordu: panelden taslağa çekilmiş paket bir sonraki dağıtımda kendiliğinden
 * yeniden yayına çıkıyordu.
 */
async function paketleriKur() {
  console.log("\nSeviyeli check-up paketleri:");

  for (const sinav of SECILEBILIR_SINAVLAR) {
    const bilgi = EXAMS[sinav];
    const ayar = ayarGetir(sinav);
    const toplamSoru =
      ayar.seviye1.soruSayisi + ayar.seviye2.soruSayisi + ayar.seviye3.soruSayisi;
    const toplamDakika = ayar.seviye1.dakika + ayar.seviye2.dakika + ayar.seviye3.dakika;

    const slug = `${sinav.toLowerCase().replace(/_/g, "-")}-seviyeli`;
    const [mevcut, hazirlik] = await Promise.all([
      prisma.package.findUnique({ where: { slug }, select: { status: true } }),
      seviyeliHazirlik(sinav),
    ]);

    if (mevcut) {
      await prisma.package.update({
        where: { slug },
        data: {
          name: `${bilgi.short} Seviyeli Check-up`,
          questionCount: toplamSoru,
          durationMinutes: toplamDakika,
          penaltyRatio: 0,
        },
      });
      const uyari =
        mevcut.status === "PUBLISHED" && !hazirlik.hazir
          ? ` · ⚠️ yayında ama havuz yetmiyor, öğrenci başlatamaz (${hazirlikOzeti(hazirlik)})`
          : "";
      console.log(`  · ${slug} — ${toplamSoru} soru / ~${toplamDakika} dk · ${mevcut.status} (değiştirilmedi)${uyari}`);
      continue;
    }

    await prisma.package.create({
      data: {
        slug,
        name: `${bilgi.short} Seviyeli Check-up`,
        summary: `Üç seviye, ${toplamSoru} soru. Her seviye kendi süresiyle ayrı çözülür; aralarında ara verebilirsin.`,
        examScope: sinav as never,
        kind: "LEVEL",
        status: hazirlik.hazir ? "PUBLISHED" : "DRAFT",
        // Aşamaların kendi süreleri lib/levels.ts'ten geliyor; paketteki bu
        // alanlar yalnızca katalogda "ne kadar sürer" bilgisi için.
        questionCount: toplamSoru,
        durationMinutes: toplamDakika,
        // Seviyeli sınavda net YOK — ham doğru sayısı.
        penaltyRatio: 0,
        isFree: false,
        sortOrder: 0,
      },
    });
    console.log(
      `  · ${slug} — ${toplamSoru} soru / ~${toplamDakika} dk · yeni, ` +
        (hazirlik.hazir ? "yayında" : `TASLAK: havuz yetmiyor (${hazirlikOzeti(hazirlik)})`)
    );
  }
}

/** Demo kazanımın kodu: yaprağın ilk kazanımı eski kodu korur (DEMO-<SLUG>). */
function demoKodu(slug: string, sira: number): string {
  const kok = `DEMO-${slug.toUpperCase().slice(0, 28)}`;
  return sira === 0 ? kok : `${kok}-${sira + 1}`;
}

/**
 * Demo kazanımlar: her yaprak konuya bir ya da birkaç kazanım.
 *
 * ⚠️ GERÇEK DEĞİL. Gerçekte bir konunun birden fazla kazanımı olur
 * ("Bölme ve Bölünebilme" konusunun 3 ile, 9 ile, 11 ile bölünebilme
 * kuralları ayrı kazanımlardır). Amaç akışı çalıştırmak, içerik üretmek değil.
 *
 * Yaprak başına kazanım sayısı, sınavın Seviye 1'i TAM sayıyla açılabilsin
 * diye hesaplanır: Seviye 1 artık eksik soruyla açılmıyor (TYT 50 kazanım
 * ister, demo ağacında 32 TYT yaprağı var). Yaprağın geçtiği sınavlardan en
 * çok isteyenin ihtiyacı alınır (LGS 35 / 12 yaprak → 3), yaprağın temel
 * sorusundan fazla olmaz. Sorular kazanımlara sırayla dağıtılır (seviyeyi
 * etiketleyen demoSorulariEtiketle): tek sorulu kazanımlar da çıkar, teyit
 * turunun kısmi açılması geliştirmede de görülsün.
 */
async function demoKazanimlar(): Promise<Map<string, string[]>> {
  const konular = await prisma.topic.findMany({
    select: { id: true, slug: true, name: true, parentId: true, sortOrder: true, examScope: true, examScopes: true },
    orderBy: { sortOrder: "asc" },
  });
  const ustler = new Set(konular.map((k) => k.parentId).filter(Boolean));
  const yapraklar = konular.filter((k) => !ustler.has(k.id));

  const temelSayilari = await prisma.question.groupBy({
    by: ["topicId"],
    where: { status: "PUBLISHED", difficulty: { lte: 2 } },
    _count: { _all: true },
  });
  const temel = new Map(temelSayilari.map((s) => [s.topicId, s._count._all]));

  // Sınav başına yaprak başına gereken kazanım.
  const sinavIhtiyaci = new Map<ExamScopeValue, number>();
  for (const sinav of SECILEBILIR_SINAVLAR) {
    const yaprakSayisi = yapraklar.filter((k) => konuSinavdaMi(k, sinav)).length;
    if (yaprakSayisi > 0) {
      sinavIhtiyaci.set(sinav, Math.ceil(ayarGetir(sinav).seviye1.soruSayisi / yaprakSayisi));
    }
  }

  console.log(`\nDemo kazanımlar (${yapraklar.length} yaprak konu):`);

  const konuyaKazanimlar = new Map<string, string[]>();
  let sayac = 0;
  for (const konu of yapraklar) {
    const istenen = Math.max(
      1,
      ...SECILEBILIR_SINAVLAR.filter((s) => konuSinavdaMi(konu, s)).map((s) => sinavIhtiyaci.get(s) ?? 1)
    );
    const adet = Math.max(1, Math.min(istenen, temel.get(konu.id) ?? 1));
    const idler: string[] = [];
    for (let i = 0; i < adet; i++) {
      const code = demoKodu(konu.slug, i);
      const k = await prisma.objective.upsert({
        where: { code },
        create: {
          code,
          topicId: konu.id,
          name: adet === 1 ? `${konu.name} temel kazanımı` : `${konu.name} temel kazanımı ${i + 1}`,
          examScopes: konu.examScopes,
          sortOrder: konu.sortOrder,
          status: "PUBLISHED",
        },
        update: { status: "PUBLISHED", examScopes: konu.examScopes, sortOrder: konu.sortOrder },
        select: { id: true },
      });
      idler.push(k.id);
      sayac += 1;
    }
    konuyaKazanimlar.set(konu.id, idler);
  }
  console.log(`  · ${sayac} kazanım yazıldı`);
  return konuyaKazanimlar;
}

/**
 * Demo soruları seviyelere dağıtır.
 *
 * Dağıtım zorluğa göre: 1-2 → Seviye 1, 3 → Seviye 2, 4-5 → Seviye 3.
 * Gerçekte seviye zorluktan BAĞIMSIZ bir eksen (temel bir soru da zor
 * olabilir) ve içerik ekibi elle işaretleyecek — burada demo veriyi
 * anlamlı dağıtmanın en ucuz yolu bu.
 *
 * Seviye 1 soruları ayrıca kazanıma bağlanıyor (yaprağın kazanımlarına
 * sırayla, kimlik sırasına göre: her çalıştırmada aynı dağılım); telafi
 * turu bunu kullanıyor.
 */
async function demoSorulariEtiketle(konuyaKazanimlar: Map<string, string[]>) {
  console.log("\nDemo soruların seviye etiketleri:");

  // Seviye 1: kolay sorular, kazanıma bağlı.
  let s1 = 0;
  for (const [topicId, kazanimlar] of konuyaKazanimlar) {
    const sorular = await prisma.question.findMany({
      where: { topicId, difficulty: { lte: 2 }, status: "PUBLISHED" },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    for (const [sira, objectiveId] of kazanimlar.entries()) {
      const idler = sorular.filter((_, j) => j % kazanimlar.length === sira).map((q) => q.id);
      if (idler.length === 0) continue;
      const r = await prisma.question.updateMany({
        where: { id: { in: idler } },
        data: { level: "L1_TEMEL", objectiveId },
      });
      s1 += r.count;
    }
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
   * Telafi turu kontrolü: kazanımın İKİNCİ bir Seviye 1 sorusu yoksa telafi
   * turunda o kazanım sorulamaz (tur kısmi açılır ya da hiç açılmaz, karar
   * ilk turla verilir). Hata değil, ama içerik ekibinin bilmesi gereken bir
   * darlık.
   */
  const sayimlar = await prisma.question.groupBy({
    by: ["objectiveId"],
    where: { level: "L1_TEMEL", status: "PUBLISHED", objectiveId: { not: null } },
    _count: { _all: true },
  });
  const yedeksiz = sayimlar.filter((s) => s._count._all < 2);
  if (yedeksiz.length > 0) {
    console.log(
      `  · ${yedeksiz.length}/${sayimlar.length} kazanımın yedek sorusu yok (teyit turunda sorulamaz).`
    );
  } else {
    console.log(`  · ${sayimlar.length} kazanımın hepsinde yedek soru var ✓`);
  }
}

async function main() {
  if (!YALNIZ_PAKET) {
    const engel = demoKipiEngeli();
    if (engel) {
      console.error(
        `\nDemo kipi DURDURULDU (${engel}). Bu kip gerçek soruların seviyesini yeniden ` +
          "yazıp onları DEMO kazanımlara bağlar. Üretimde yalnızca paketler kurulur:\n" +
          "  npm run db:seed:levels -- --yalniz-paket\n"
      );
      process.exitCode = 1;
      return;
    }
    // Önce demo içerik, sonra paketler: yeni paketin yayında mı taslakta mı
    // açılacağı havuza bakıyor.
    const konuyaKazanimlar = await demoKazanimlar();
    await demoSorulariEtiketle(konuyaKazanimlar);
  }

  await paketleriKur();

  console.log(YALNIZ_PAKET ? "\n--yalniz-paket verildi, demo içerik atlandı.\n" : "\nTamam.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
