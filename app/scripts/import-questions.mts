/**
 * SORU-SABLONU.md (v3) biçimindeki markdown dosyasını veritabanına aktarır.
 *
 *   npx tsx scripts/import-questions.mts <dosya.md>                 → yalnızca DENETLE (yazmaz)
 *   npx tsx scripts/import-questions.mts <dosya.md> --uygula         → taslak olarak kaydet
 *   npx tsx scripts/import-questions.mts <dosya.md> --uygula --yayinla   → doğrudan yayına al
 *   npx tsx scripts/import-questions.mts --geri-al <batchId>         → bir içe aktarmayı geri al
 *
 * Seçenekler:
 *   --personel "ad@kocum.net (#3)"   kayıtlara yazılacak personel damgası
 *
 * Kurallar SORU-SABLONU.md §9'dan: reddedilen soru satır numarasıyla raporlanır,
 * geri kalanı girer. Rapor: "42 soru alındı, 3 soru reddedildi".
 *
 * Çözümleme ve denetim lib/question-import.ts'te (saf modül): yönetim
 * panelinin "Toplu içe aktar" ekranı da aynısını kullanıyor. Bu betik dosyayı
 * okur, bağlamı veritabanından kurar ve yazar. Raporda reddedilen her soru
 * için İLK hata yazılır; panel hepsini ve uyarıları da gösterir.
 *
 * Tasarım:
 *  · Önce dosyanın TAMAMI çözümlenir ve denetlenir, sonra yazılır. Yarım
 *    içe aktarma yok: ya hepsi geçerli olanlar girer, ya hiçbiri.
 *  · Her içe aktarma bir ImportBatch kaydı açar; sorular ona bağlanır.
 *    `--geri-al` o partinin HİÇ ÇÖZÜLMEMİŞ sorularını siler (çözülmüş soru
 *    silinmez: öğrenci cevapları ona bağlı).
 *  · Kazanımlar koda göre bulunur; yoksa `Kazanım Adı` ile oluşturulur.
 *    İlk kullanımda ad zorunlu.
 *  · Görseller markdown'ın yanındaki gorseller/ dizininden okunur, MediaAsset
 *    olarak veritabanına yazılır, metindeki dosya adı kimlikle değiştirilir.
 */
import "dotenv/config";
import { readFileSync, existsSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { prisma } from "../lib/db";
import {
  GORSEL_MIME,
  dosyayiCozumle,
  dosyayiDenetle,
  gorselleriYerlestir,
  seviye1Sayilari,
  tekSoruluKazanimlar,
  type HazirSoru,
  type IceAktarmaBaglami,
  type IceAktarmaKazanimi,
} from "../lib/question-import";

// ─────────────────────────────────────────────────────────────
// Komut satırı
// ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const opt = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const UYGULA = flag("--uygula");
const YAYINLA = flag("--yayinla");
const GERI_AL = opt("--geri-al");
const PERSONEL = opt("--personel") ?? "ice-aktarma (betik)";
const DOSYA = argv.find((a) => !a.startsWith("--") && a.endsWith(".md"));

/** Raporun ve ImportBatch.errors'un satırı: reddedilen soru + ilk hatası. */
interface Hata {
  satir: number;
  id: string;
  sebep: string;
}

// ─────────────────────────────────────────────────────────────
// Yazma
// ─────────────────────────────────────────────────────────────

async function uygula(
  hazir: HazirSoru[],
  hatalar: Hata[],
  dosyaAdi: string,
  kazanimlar: Map<string, IceAktarmaKazanimi>,
  gorselDizini: string
) {
  const batch = await prisma.importBatch.create({
    data: {
      filename: dosyaAdi,
      format: "md",
      status: "PENDING",
      totalRows: hazir.length + hatalar.length,
      createdByStaff: PERSONEL,
    },
  });

  let yazilan = 0;
  const yeniKazanim: string[] = [];
  const gorselOnbellek = new Map<string, string>(); // dosya → mediaId

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const q of hazir) {
          // Kazanım: varsa bul, yoksa oluştur (yayında — içerik ekibinin listesi).
          let objectiveId: string | null = null;
          if (q.kazanimKodu) {
            const mevcut = kazanimlar.get(q.kazanimKodu);
            if (mevcut) {
              objectiveId = mevcut.id;
            } else {
              const adi = q.kazanimAdi ?? hazir.find((x) => x.kazanimKodu === q.kazanimKodu && x.kazanimAdi)?.kazanimAdi ?? q.kazanimKodu;
              const o = await tx.objective.create({
                data: { topicId: q.topicId, code: q.kazanimKodu, name: adi, status: "PUBLISHED", examScopes: q.examScopes },
                select: { id: true },
              });
              kazanimlar.set(q.kazanimKodu, { id: o.id, topicId: q.topicId });
              yeniKazanim.push(q.kazanimKodu);
              objectiveId = o.id;
            }
          }

          // Görseller: dosya adı → MediaAsset kimliği.
          let stem = q.stem;
          if (q.gorseller.length) {
            const kimlikler = new Map<string, string>();
            for (const g of q.gorseller) {
              let mediaId = gorselOnbellek.get(g.dosya);
              if (!mediaId) {
                const yol = join(gorselDizini, g.dosya);
                const data = readFileSync(yol);
                const m = await tx.mediaAsset.create({
                  data: {
                    storageKey: `import/${batch.id}/${g.dosya}`,
                    mimeType: GORSEL_MIME[extname(g.dosya).toLowerCase()] ?? "application/octet-stream",
                    byteSize: statSync(yol).size,
                    data,
                    alt: g.alt,
                    uploadedByStaff: PERSONEL,
                  },
                  select: { id: true },
                });
                mediaId = m.id;
                gorselOnbellek.set(g.dosya, mediaId);
              }
              kimlikler.set(g.dosya, mediaId);
            }
            stem = gorselleriYerlestir(stem, kimlikler);
          }

          await tx.question.create({
            data: {
              topicId: q.topicId,
              stem,
              stemText: q.stemText,
              fingerprint: q.fingerprint,
              solution: q.solution ?? undefined,
              difficulty: q.difficulty,
              targetTimeSeconds: q.targetTimeSeconds,
              status: YAYINLA ? "PUBLISHED" : "DRAFT",
              sourceRef: q.sourceRef,
              importBatchId: batch.id,
              examScopes: q.examScopes,
              level: q.level,
              objectiveId,
              createdByStaff: PERSONEL,
              updatedByStaff: PERSONEL,
              choices: {
                create: q.drafts.map((d, i) => ({
                  label: d.label,
                  content: d.content,
                  isCorrect: d.isCorrect,
                  errorType: (q.errorTypes[i] as never) ?? null,
                  sortOrder: i,
                })),
              },
            },
          });
          yazilan++;
        }
      },
      { timeout: 120_000 }
    );

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "DONE",
        createdCount: yazilan,
        skippedCount: hatalar.length,
        errors: hatalar.map((h) => ({ row: h.satir, reason: h.sebep, detail: h.id })),
        completedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "FAILED", errors: [{ row: 0, reason: (e as Error).message, detail: "transaction" }], completedAt: new Date() },
    });
    throw e;
  }

  return { batchId: batch.id, yazilan, yeniKazanim };
}

async function geriAl(batchId: string) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    select: { id: true, filename: true, createdCount: true, createdAt: true, completedAt: true },
  });
  if (!batch) throw new Error("Parti bulunamadı: " + batchId);

  const sorular = await prisma.question.findMany({
    where: { importBatchId: batchId },
    select: { id: true, _count: { select: { items: true } } },
  });
  const cozulmus = sorular.filter((s) => s._count.items > 0);
  const silinecek = sorular.filter((s) => s._count.items === 0).map((s) => s.id);

  if (silinecek.length) {
    await prisma.$transaction([
      prisma.choice.deleteMany({ where: { questionId: { in: silinecek } } }),
      prisma.question.deleteMany({ where: { id: { in: silinecek } } }),
    ]);
  }

  /*
   * Görseller: yalnızca artık HİÇBİR soruda geçmeyenler silinir. Korunan
   * (çözülmüş) soru ya da panelde "benzerini oluştur" ile yapılmış kopyası aynı
   * görseli gösteriyor olabilir. Eskiden partinin bütün görselleri siliniyordu
   * ve korunan sorular öğrenci ekranında kırık görselle kalıyordu. Panelin geri
   * alması da aynı sorguyu kullanıyor (admin/src/lib/checkup/question-import.ts).
   */
  const adaylar = await prisma.mediaAsset.findMany({
    where: { storageKey: { startsWith: `import/${batchId}/` } },
    select: { id: true },
  });
  let korunanGorsel = 0;
  if (adaylar.length) {
    const kullanilan = await prisma.$queryRaw<{ id: string }[]>`
      SELECT m.id FROM unnest(${adaylar.map((a) => a.id)}::text[]) AS m(id)
      WHERE EXISTS (SELECT 1 FROM "Question" q WHERE strpos(q.stem::text, m.id) > 0 OR strpos(coalesce(q.solution::text, ''), m.id) > 0)
         OR EXISTS (SELECT 1 FROM "Choice" c WHERE strpos(c.content::text, m.id) > 0)`;
    const kalsin = new Set(kullanilan.map((r) => r.id));
    korunanGorsel = kalsin.size;
    await prisma.mediaAsset.deleteMany({ where: { id: { in: adaylar.map((a) => a.id).filter((id) => !kalsin.has(id)) } } });
  }

  // Bu partiyle AÇILAN ve artık sorusu kalmayan kazanımlar da gider: parti
  // başlangıcı ile bitişi arasında oluşturulmuş, boş kalmış kazanımlar.
  const bitis = batch.completedAt ?? new Date();
  const bosKazanimlar = await prisma.objective.deleteMany({
    where: {
      createdAt: { gte: new Date(batch.createdAt.getTime() - 1000), lte: new Date(bitis.getTime() + 1000) },
      questions: { none: {} },
    },
  });
  if (bosKazanimlar.count) console.log(`Bu partiyle açılan ${bosKazanimlar.count} boş kazanım silindi.`);
  if (korunanGorsel) console.log(`${korunanGorsel} görsel, hâlâ bir soruda kullanıldığı için silinmedi.`);

  if (cozulmus.length === 0) await prisma.importBatch.delete({ where: { id: batchId } });
  else await prisma.importBatch.update({ where: { id: batchId }, data: { status: "REVERTED_PARTIAL" } });

  console.log(`Geri alındı: ${batch.filename} — ${silinecek.length} soru silindi` + (cozulmus.length ? `, ${cozulmus.length} soru öğrenciler çözdüğü için korundu (arşivle).` : "."));
}

// ─────────────────────────────────────────────────────────────
// Ana akış
// ─────────────────────────────────────────────────────────────

async function main() {
  if (GERI_AL) {
    await geriAl(GERI_AL);
    return;
  }
  if (!DOSYA) {
    console.error("Kullanım: npx tsx scripts/import-questions.mts <dosya.md> [--uygula] [--yayinla] [--personel \"ad (#id)\"]");
    process.exit(2);
  }
  const yol = resolve(DOSYA);
  const metin = readFileSync(yol, "utf8");
  const ham = dosyayiCozumle(metin);
  if (ham.length === 0) {
    console.error("Dosyada '### Soru …' başlığı bulunamadı.");
    process.exit(2);
  }

  const [konular, sorular, kazanimSatirlari] = await Promise.all([
    prisma.topic.findMany({ where: { children: { none: {} } }, select: { id: true, slug: true, examScope: true, examScopes: true } }),
    // TÜM sorular: panelde elle girilen (kaynağı boş) sorunun metni de çift sayılır.
    prisma.question.findMany({ select: { id: true, sourceRef: true, fingerprint: true } }),
    prisma.objective.findMany({ select: { id: true, code: true, topicId: true, name: true } }),
  ]);

  const gorselDizini = join(dirname(yol), "gorseller");
  const kazanimlar = new Map<string, IceAktarmaKazanimi>(
    kazanimSatirlari.map((k) => [k.code, { id: k.id, topicId: k.topicId, name: k.name }])
  );
  const b: IceAktarmaBaglami = {
    konular: new Map(konular.map((k) => [k.slug, { id: k.id, examScope: k.examScope, examScopes: k.examScopes }])),
    // sourceRef "ID · kaynak" biçiminde; ID kısmı karşılaştırılır.
    mevcutIdler: new Set(sorular.map((q) => (q.sourceRef ?? "").split(" · ")[0]).filter(Boolean)),
    mevcutParmakIzleri: new Map(sorular.map((q) => [q.fingerprint, q.id])),
    kazanimlar,
    gorselVar: (dosya) => existsSync(join(gorselDizini, dosya)),
  };

  const { sorular: rapor, hazir } = dosyayiDenetle(ham, b);
  const hatalar: Hata[] = rapor
    .filter((r) => r.hatalar.length > 0)
    .map((r) => ({ satir: r.satir, id: r.id || r.baslik, sebep: r.hatalar[0] }));

  // Uyarı: tek seviye-1 sorusu kalan kazanımlar (telafi turunda boş kalır).
  const l1Sayac = seviye1Sayilari(hazir);
  const havuzdaL1 = new Map<string, number>();
  if (l1Sayac.size) {
    const mevcutL1 = await prisma.question.groupBy({
      by: ["objectiveId"],
      where: { level: "L1_TEMEL", objectiveId: { not: null } },
      _count: { _all: true },
    });
    const idToCode = new Map([...kazanimlar.entries()].map(([code, v]) => [v.id, code]));
    for (const r of mevcutL1) {
      const code = idToCode.get(r.objectiveId!);
      if (code) havuzdaL1.set(code, r._count._all);
    }
  }
  const tekSoruluKazanimListesi = tekSoruluKazanimlar(l1Sayac, havuzdaL1);

  console.log(`\n${basename(yol)}: ${ham.length} soru bulundu`);
  console.log(`  ✓ ${hazir.length} soru geçerli`);
  console.log(`  ✗ ${hatalar.length} soru reddedildi`);
  for (const h of hatalar) console.log(`    satır ${h.satir} · ${h.id}: ${h.sebep}`);
  if (tekSoruluKazanimListesi.length) {
    console.log(`  ⚠ Tek seviye-1 sorusu olan kazanımlar (telafi turunda boş kalır): ${tekSoruluKazanimListesi.join(", ")}`);
  }

  if (!UYGULA) {
    console.log("\nYalnızca denetlendi, hiçbir şey yazılmadı. Kaydetmek için --uygula ekle.");
    return;
  }
  if (hazir.length === 0) {
    console.log("\nGeçerli soru yok, yazılacak bir şey yok.");
    return;
  }

  const sonuc = await uygula(hazir, hatalar, basename(yol), kazanimlar, gorselDizini);
  console.log(`\n${sonuc.yazilan} soru alındı (${YAYINLA ? "YAYINDA" : "taslak"}), ${hatalar.length} soru reddedildi.`);
  if (sonuc.yeniKazanim.length) console.log(`Yeni kazanımlar: ${sonuc.yeniKazanim.join(", ")}`);
  console.log(`Parti kimliği: ${sonuc.batchId}  (geri almak için: --geri-al ${sonuc.batchId})`);
}

main()
  .catch((e) => {
    console.error("\nİçe aktarma başarısız:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
