import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/checkup/db";
import { CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { QUESTION_LEVELS, isExamScope, isQuestionStatus } from "@/lib/checkup/format";
import { listeAdresi, listeSorgusu, soruAdresi } from "@/lib/checkup/question-list";
import { parseQuestionContent } from "@/lib/checkup/shared/question-content";
import { contentToMarkup, hasUneditableBlocks } from "@/lib/checkup/shared/question-markup";
import { GateNotice } from "@/components/checkup/GateNotice";
import { QuestionForm, type QuestionInitial } from "@/components/checkup/QuestionForm";
import { Notice, PageHeader } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Yeni soru" };

/**
 * Yeni soru. İki kısayol adresten gelir:
 *
 * - "Kaydet ve yenisini ekle" sonrası: `?kaydedildi=<id>&konuId=…&seviye=…`
 *   — sınıflandırma taşınır, içerik boş. Aynı konudan art arda soru girmek
 *   içerik ekibinin asıl işi.
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
  } else if (kaydedilen) {
    // Önceki sorunun sınıflandırması — adres elle kurcalanabilir, her alan doğrulanır.
    const konuId = tek(sp.konuId);
    const seviye = tek(sp.seviye);
    const kazanimId = tek(sp.kazanimId);
    const zorluk = Number(tek(sp.zorluk));
    const sure = Number(tek(sp.sure));
    const durum = tek(sp.durum);
    const konuGecerli = konuIdleri.has(konuId);
    defaults = {
      topicId: konuGecerli ? konuId : "",
      level: (QUESTION_LEVELS as readonly string[]).includes(seviye) ? seviye : "",
      objectiveId: konuGecerli && kazanimlar.get(kazanimId)?.topicId === konuId ? kazanimId : "",
      difficulty: Number.isInteger(zorluk) && zorluk >= 1 && zorluk <= 5 ? zorluk : 3,
      targetTimeSeconds: Number.isInteger(sure) && sure >= 10 && sure <= 600 ? sure : 75,
      status: isQuestionStatus(durum) ? durum : "DRAFT",
      examScopes: tek(sp.hedef).split(",").filter(isExamScope),
    };
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: listeAdresi(geri), label: "Sorular" },
        ]}
        title={kopyaNotu ? "Benzer soru" : "Yeni soru"}
        description="Yayına almadan önce önizlemeyi öğrencinin gözüyle kontrol et."
      />

      {kaydedilen && !kopyaId ? (
        <Notice tone="ok" className="mb-4">
          Soru kaydedildi —{" "}
          <Link href={soruAdresi(kaydedilen, geri)} className="font-semibold underline underline-offset-2">
            kaydedileni aç
          </Link>
          . Konu, seviye, kazanım ve zorluk aynen kaldı; sıradakini yaz.
        </Notice>
      ) : null}
      {kopyaNotu ? (
        <Notice tone="info" className="mb-4" title="Kopyadan başlıyorsun">
          Kaynak: “{kopyaNotu}”. Metin aynı kaldıkça kaydedilemez — aynı soru iki kez havuza giremez.
          Sayıları ya da ifadeyi değiştir; şıkları ve çözümü buna göre güncelle.
        </Notice>
      ) : null}
      {kopyaHatasi ? (
        <Notice tone="warn" className="mb-4">
          {kopyaHatasi}
        </Notice>
      ) : null}

      <QuestionForm
        // Aynı adrese yeni parametrelerle dönüldüğünde (kaydet ve yenisi) form
        // sıfırdan kurulsun; yoksa React önceki sorunun metnini durumda tutar.
        key={kopyaId || kaydedilen || "bos"}
        canEdit
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
