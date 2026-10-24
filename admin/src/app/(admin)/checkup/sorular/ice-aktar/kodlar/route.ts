import { db } from "@/lib/checkup/db";
import { QUESTION_STATUS_LABEL, examLabel, trDate } from "@/lib/checkup/format";
import { MD_TURU, dosyaYaniti, indirmeYetkisi } from "@/lib/checkup/indirme";

/**
 * "Konu ve kazanım kodları": soru dosyasına yazılacak kodlar, veritabanından
 * o an üretilir (hep güncel). Eskiden ekran "konu kodları Havuz durumu
 * ekranında" diyordu; orada kod yazmıyordu.
 *
 * Konu: yalnızca yaprak konular (soru yalnızca onlara bağlanır), ana sınava
 * göre gruplu, geçtiği bütün sınavlarla. Kazanım: konusuna göre gruplu,
 * arşivdekiler ayrı işaretli (seviye 1 onları sormaz), yayındaki seviye 1
 * soru sayısıyla (kazanım başına en az 2 hedef, SORU-SABLONU §3).
 */

/** Tablo hücresi: dikey çizgi tabloyu bölmesin, satır sonu tek satıra insin. */
const hucre = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

export async function GET() {
  const yetkisiz = await indirmeYetkisi();
  if (yetkisiz) return yetkisiz;

  const [tumKonular, kazanimlar, l1] = await Promise.all([
    // Bütün konular: kazanım üst konuya da bağlı olabilir (adı lazım); soru yalnızca yapraklara.
    db.topic.findMany({
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, examScope: true, examScopes: true, _count: { select: { children: true } } },
    }),
    db.objective.findMany({
      orderBy: [{ topic: { name: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, status: true, topicId: true, examScopes: true },
    }),
    db.question.groupBy({
      by: ["objectiveId"],
      where: { level: "L1_TEMEL", status: "PUBLISHED", objectiveId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const l1Sayisi = new Map(l1.map((r) => [r.objectiveId, r._count._all]));
  const konuAdi = new Map(tumKonular.map((k) => [k.id, k]));
  const konular = tumKonular.filter((k) => k._count.children === 0);

  const satirlar: string[] = [
    "# Konu ve kazanım kodları",
    "",
    `Üretildi: ${trDate(new Date(), { time: true })} (Türkiye saati). Bu dosya veritabanından o an üretilir;`,
    "eskiyebilir, soru dosyası hazırlarken yenisini indir (Check-up → Sorular → Toplu içe aktar).",
    "",
    "## Konu kodları",
    "",
    "Soru dosyasında `Konu Kodu` alanına yazılır. Soru yalnızca en alt konulara bağlanır; listede olmayan kod reddedilir.",
    "`Hedef Sınav` (isteğe bağlı) konunun sınavlarından biri olmalı.",
  ];

  const anaSinavlar = [...new Set(konular.map((k) => k.examScope))];
  for (const s of anaSinavlar) {
    satirlar.push("", `### ${examLabel(s)}`, "", "| Konu Kodu | Konu | Sorulduğu sınavlar |", "| --- | --- | --- |");
    for (const k of konular.filter((x) => x.examScope === s)) {
      const sinavlar = (k.examScopes.length ? k.examScopes : [k.examScope]).join(", ");
      satirlar.push(`| \`${k.slug}\` | ${hucre(k.name)} | ${sinavlar} |`);
    }
  }

  satirlar.push(
    "",
    "## Kazanım kodları",
    "",
    "Seviye 1 sorusunda `Kazanım Kodu` zorunlu (Seviye 2-3'te yazılmaz). Listede olmayan yeni bir kod yazarsan",
    "ilk kullanımda `Kazanım Adı` da yazılır, kazanım içe aktarmada açılır. Arşivdeki kazanımı seviye 1 sormaz:",
    "ona bağlanan soru yayına alınamaz. \"L1 soru\": kazanımın yayındaki seviye 1 sorusu (en az 2 olmalı).",
  );
  if (kazanimlar.length === 0) satirlar.push("", "Henüz kazanım yok.");

  const konuIdleri = [...new Set(kazanimlar.map((o) => o.topicId))];
  for (const id of konuIdleri) {
    const k = konuAdi.get(id);
    satirlar.push(
      "",
      k ? `### ${hucre(k.name)} (\`${k.slug}\`)` : "### (konu bulunamadı)",
      "",
      "| Kazanım Kodu | Kazanım | Sınav | L1 soru | Durum |",
      "| --- | --- | --- | ---: | --- |"
    );
    for (const o of kazanimlar.filter((x) => x.topicId === id)) {
      satirlar.push(
        `| \`${o.code}\` | ${hucre(o.name)} | ${o.examScopes.length ? o.examScopes.join(", ") : "konunun sınavları"} | ${l1Sayisi.get(o.id) ?? 0} | ${QUESTION_STATUS_LABEL[o.status] ?? o.status} |`
      );
    }
  }

  return dosyaYaniti(satirlar.join("\n") + "\n", "konu-ve-kazanim-kodlari.md", MD_TURU);
}
