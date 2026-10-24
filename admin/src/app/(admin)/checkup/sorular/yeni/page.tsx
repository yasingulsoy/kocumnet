import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/checkup/db";
import { CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { QUESTION_STATUS_LABEL } from "@/lib/checkup/format";
import { listeAdresi, listeSorgusu, soruAdresi } from "@/lib/checkup/question-list";
import { adrestenDoluMu, yeniSoruVarsayilanlari } from "@/lib/checkup/soru-akisi";
import { MAX_HINTS, parseHints, parseQuestionContent } from "@/lib/checkup/shared/question-content";
import { contentToMarkup, hasUneditableBlocks } from "@/lib/checkup/shared/question-markup";
import { GateNotice } from "@/components/checkup/GateNotice";
import { QuestionForm, type QuestionInitial } from "@/components/checkup/QuestionForm";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";

export const metadata: Metadata = { title: "Check-up · Yeni soru" };

/**
 * Yeni soru. Kısayollar adresten gelir:
 *
 * - Ön dolu sınıflandırma: `?konuId=…&kazanimId=…&seviye=…&hedef=…` (ayrıca
 *   `zorluk`, `sure`, `durum`, `kaynak`). "Kaydet ve yenisini ekle" sonrası
 *   (`kaydedildi=<id>` ile) ve Kazanımlar sayfasının "Bu kazanıma soru yaz"
 *   bağlantısı bu yolu kullanır; kurallar soru-akisi.ts yeniSoruVarsayilanlari.
 *   Durum taşınmaz: yeni soru taslak ya da incelemede başlar.
 * - "Benzerini oluştur": `?kopya=<id>` — kaynak sorunun her şeyi, taslak
 *   olarak. Metin değişmeden kaydedilemez (parmak izi benzersiz).
 */
export default async function NewQuestionPage({ searchParams }: PageProps<"/checkup/sorular/yeni">) {
  const gate = await checkStaff(CONTENT_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={CONTENT_ROLES} />;

  const sp = await searchParams;
  const tek = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const geri = listeSorgusu(tek(sp.geri));
  const kopyaId = tek(sp.kopya);
  const kaydedilen = tek(sp.kaydedildi);

  // Sorular yalnızca yaprak konulara bağlanır: üst konuya bağlanan soru
  // hiçbir pakette seçilemez (seçim tam eşleşme yapıyor).
  const [topics, objectives, kaynak] = await Promise.all([
    db.topic.findMany({
      where: { children: { none: {} } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { id: true, name: true, examScope: true, examScopes: true },
    }),
    db.objective.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, topicId: true, code: true, name: true },
    }),
    kopyaId
      ? db.question.findUnique({
          where: { id: kopyaId },
          select: {
            topicId: true,
            stem: true,
            stemText: true,
            solution: true,
            hints: true,
            difficulty: true,
            targetTimeSeconds: true,
            level: true,
            objectiveId: true,
            examScopes: true,
            choices: { orderBy: { sortOrder: "asc" }, select: { content: true, isCorrect: true, errorType: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  const konuIdleri = new Set(topics.map((t) => t.id));
  const kazanimlar = new Map(objectives.map((o) => [o.id, o]));
  // Adresten gelen sınıflandırma (kaydedildi olmadan da): her alan doğrulanır.
  const adrestenGelen = !kopyaId && (kaydedilen || adrestenDoluMu(sp));

  let defaults: Partial<QuestionInitial> | undefined;
  let kopyaNotu: string | null = null;
  let kopyaHatasi: string | null = null;

  if (kopyaId) {
    const stem = kaynak ? parseQuestionContent(kaynak.stem) : null;
    if (!kaynak || !stem) {
      kopyaHatasi = "Kopyalanacak soru bulunamadı; boş formla başlıyorsun.";
    } else if (hasUneditableBlocks(stem)) {
      kopyaHatasi = "Bu soru tablo ya da altyazılı şekil içerdiği için formda kopyalanamıyor.";
    } else {
      defaults = {
        topicId: kaynak.topicId,
        stem: contentToMarkup(stem),
        solution: kaynak.solution ? contentToMarkup(parseQuestionContent(kaynak.solution)) : "",
        // İpuçları taşınır (çözüm gibi, yeni sayılara göre düzeltilir); video
        // TAŞINMAZ: başka sayılarla çekilmiş video yanlış çözümü gösterirdi ve
        // bağlantının içi önizlemede görünmediği için gözden kaçar.
        hints: parseHints(kaynak.hints).map(contentToMarkup),
        videoUrl: "",
        choices: kaynak.choices.map((c) => contentToMarkup(parseQuestionContent(c.content))),
        correctIndex: Math.max(0, kaynak.choices.findIndex((c) => c.isCorrect)),
        errorTypes: kaynak.choices.map((c) => c.errorType),
        difficulty: kaynak.difficulty,
        targetTimeSeconds: kaynak.targetTimeSeconds,
        // Kopya her zaman taslak başlar; kaynak bilgisi o soruya aitti.
        status: "DRAFT",
        sourceRef: "",
        level: kaynak.level ?? "",
        // Arşivdeki kazanım taşınmaz: yeni soru ona bağlanmamalı.
        objectiveId: kaynak.objectiveId && kazanimlar.has(kaynak.objectiveId) ? kaynak.objectiveId : "",
        // Hedef sınav taşınır: "yalnızca AYT" sorunun benzeri de öyle başlar.
        examScopes: kaynak.examScopes as string[],
      };
      kopyaNotu = kaynak.stemText.slice(0, 90) + (kaynak.stemText.length > 90 ? "…" : "");
    }
  } else if (adrestenGelen) {
    defaults = yeniSoruVarsayilanlari(sp, {
      konular: konuIdleri,
      kazanimKonusu: new Map(objectives.map((o) => [o.id, o.topicId])),
    });
  }
  const seciliKazanim = defaults?.objectiveId ? kazanimlar.get(defaults.objectiveId) : undefined;

  return (
    <>
      <PageBreadcrumb
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: listeAdresi(geri), label: "Sorular" },
        ]}
        pageTitle={kopyaNotu ? "Benzer soru" : "Yeni soru"}
        description="Yayına almadan önce önizlemeyi öğrencinin gözüyle kontrol et."
      />

      {kaydedilen && !kopyaId ? (
        <Alert variant="success" compact className="mb-4">
          Soru kaydedildi —{" "}
          <Link href={soruAdresi(kaydedilen, geri)} className="font-semibold text-gray-800 underline underline-offset-2">
            kaydedileni aç
          </Link>
          . Konu, seviye, kazanım, zorluk, süre ve hedef sınav aynen kaldı
          {defaults?.sourceRef ? ", kaynağın başı da (“" + defaults.sourceRef + "”)" : ""}. Durum taşınmadı: bu soru{" "}
          {QUESTION_STATUS_LABEL[defaults?.status ?? "DRAFT"]} olarak başlıyor. Sıradakini yaz.
        </Alert>
      ) : adrestenGelen && seciliKazanim ? (
        <Alert variant="info" compact className="mb-4">
          Kazanım hazır seçili: <span className="font-medium text-gray-800">{seciliKazanim.code}</span> · {seciliKazanim.name}.
        </Alert>
      ) : null}
      {kopyaNotu ? (
        <Alert variant="info" className="mb-4" title="Kopyadan başlıyorsun">
          Kaynak: “{kopyaNotu}”. Metin aynı kaldıkça kaydedilemez — aynı soru iki kez havuza giremez.
          Sayıları ya da ifadeyi değiştir; şıkları, çözümü ve ipuçlarını buna göre güncelle. Video çözüm
          kopyalanmaz.
        </Alert>
      ) : null}
      {kopyaHatasi ? (
        <Alert variant="warning" compact className="mb-4">
          {kopyaHatasi}
        </Alert>
      ) : null}

      <QuestionForm
        // Aynı adrese yeni parametrelerle dönüldüğünde (kaydet ve yenisi) form
        // sıfırdan kurulsun; yoksa React önceki sorunun metnini durumda tutar.
        key={kopyaId || kaydedilen || (adrestenGelen ? "adres:" + JSON.stringify(defaults) : "bos")}
        canEdit
        maxIpucu={MAX_HINTS}
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          scope: t.examScope,
          scopes: t.examScopes as string[],
        }))}
        objectives={objectives}
        defaults={defaults}
        returnQuery={geri}
      />
    </>
  );
}
