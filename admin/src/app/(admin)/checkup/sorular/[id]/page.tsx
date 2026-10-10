import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CopyPlus } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { trDate } from "@/lib/checkup/format";
import { loadQuestionAnalysis } from "@/lib/checkup/item-analysis";
import { listeAdresi, listeSorgusu, soruAdresi } from "@/lib/checkup/question-list";
import { komsular, listeSuzgeciSorgudan } from "@/lib/checkup/question-query";
import { parseQuestionContent } from "@/lib/checkup/shared/question-content";
import { contentToMarkup, hasUneditableBlocks } from "@/lib/checkup/shared/question-markup";
import { GateNotice } from "@/components/checkup/GateNotice";
import { ItemAnalysisCard } from "@/components/checkup/ItemAnalysis";
import { CopyIdButton } from "@/components/checkup/CopyIdButton";
import { QuestionForm } from "@/components/checkup/QuestionForm";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { ButtonLink, buttonClass } from "@/components/tailadmin/ui/Button";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";

export const metadata: Metadata = { title: "Check-up · Soruyu düzenle" };

export default async function EditQuestionPage({ params, searchParams }: PageProps<"/checkup/sorular/[id]">) {
  // Görüntüleyici de açabilir (inceleme); kaydetmeyi form ve sunucu engeller.
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Listeden gelindiyse süzgeç ve sayfa: kaydedince oraya dönülür.
  const listeden = typeof sp.geri === "string";
  const geri = listeSorgusu(listeden ? (sp.geri as string) : "");
  // "Kaydet ve sonrakine geç"ten gelindiyse kaydedilen önceki soru.
  const kaydedilen = typeof sp.kaydedildi === "string" ? sp.kaydedildi.slice(0, 64) : "";
  const crumbs = [
    { href: "/checkup", label: "Check-up" },
    { href: listeAdresi(geri), label: "Sorular" },
  ];

  const [question, topics, objectives] = await Promise.all([
    db.question.findUnique({
      where: { id },
      select: {
        id: true,
        topicId: true,
        stem: true,
        solution: true,
        difficulty: true,
        targetTimeSeconds: true,
        status: true,
        sourceRef: true,
        level: true,
        objectiveId: true,
        examScopes: true,
        version: true,
        shownCount: true,
        createdAt: true,
        updatedAt: true,
        createdByStaff: true,
        updatedByStaff: true,
        choices: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, content: true, isCorrect: true, errorType: true, label: true },
        },
      },
    }),
    db.topic.findMany({
      where: { children: { none: {} } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { id: true, name: true, examScope: true, examScopes: true },
    }),
    db.objective.findMany({
      // Arşivdeki kazanım listeye girmez — ama bu sorunun kazanımıysa girer:
      // yoksa seçim kutusu "Kazanımsız" görünür, gizli alan arşivdeki kimliği
      // taşırdı. Yazar neye bağlı olduğunu görmeli.
      where: { OR: [{ status: { not: "ARCHIVED" } }, { questions: { some: { id } } }] },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, topicId: true, code: true, name: true, status: true },
    }),
  ]);

  if (!question) notFound();

  const stemContent = parseQuestionContent(question.stem);

  // Tablo yazım biçiminde temsil edilemiyor. Bu formda kaydetmek onu sessizce
  // siler — o yüzden düzenlemeye hiç izin vermiyoruz.
  if (hasUneditableBlocks(stemContent)) {
    return (
      <>
        <PageBreadcrumb crumbs={crumbs} pageTitle="Soruyu düzenle" />
        <Alert variant="warning" title="Bu soru metin editöründe düzenlenemiyor">
          Soru, yazım biçiminin temsil edemediği bir blok (tablo ya da altyazılı şekil)
          içeriyor. Bu formda kaydetmek o bloğu silerdi, bu yüzden düzenleme kapalı.
        </Alert>
      </>
    );
  }

  const komsu = listeden ? await komsular(question.id, listeSuzgeciSorgudan(geri)) : null;

  const analysis = await loadQuestionAnalysis({
    id: question.id,
    version: question.version,
    difficulty: question.difficulty,
    targetTimeSeconds: question.targetTimeSeconds,
    choices: question.choices.map((c) => ({
      id: c.id,
      label: c.label,
      isCorrect: c.isCorrect,
      errorType: c.errorType,
    })),
  });

  const initial = {
    id: question.id,
    topicId: question.topicId,
    stem: contentToMarkup(stemContent),
    solution: question.solution ? contentToMarkup(parseQuestionContent(question.solution)) : "",
    choices: question.choices.map((c) => contentToMarkup(parseQuestionContent(c.content))),
    correctIndex: Math.max(0, question.choices.findIndex((c) => c.isCorrect)),
    errorTypes: question.choices.map((c) => c.errorType),
    difficulty: question.difficulty,
    targetTimeSeconds: question.targetTimeSeconds,
    status: question.status,
    sourceRef: question.sourceRef ?? "",
    level: question.level ?? "",
    objectiveId: question.objectiveId ?? "",
    examScopes: question.examScopes as string[],
    version: question.version,
    shownCount: question.shownCount,
  };

  const alt = [
    "Sürüm v" + question.version,
    "eklendi " + trDate(question.createdAt) + (question.createdByStaff ? " · " + question.createdByStaff : ""),
    question.updatedByStaff && question.updatedAt.getTime() !== question.createdAt.getTime()
      ? "son düzenleme " + trDate(question.updatedAt) + " · " + question.updatedByStaff
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageBreadcrumb
        crumbs={crumbs}
        pageTitle="Soruyu düzenle"
        description={alt}
        actions={
          <>
            {komsu ? (
              <nav aria-label="Listede gezinme" className="flex items-center gap-1">
                {komsu.onceki ? (
                  <Link href={soruAdresi(komsu.onceki, geri)} className={buttonClass({ variant: "ghost", size: "xs" })} aria-label="Önceki soru">
                    <ChevronLeft aria-hidden className="rtl:rotate-180" />
                  </Link>
                ) : (
                  <span className={buttonClass({ variant: "ghost", size: "xs" }) + " pointer-events-none opacity-40"} aria-hidden>
                    <ChevronLeft className="rtl:rotate-180" />
                  </span>
                )}
                <span className="tabular min-w-16 text-center text-theme-sm text-gray-500">
                  {komsu.sira ? komsu.sira + " / " + komsu.toplam : komsu.toplam + " soru"}
                </span>
                {komsu.sonraki ? (
                  <Link href={soruAdresi(komsu.sonraki, geri)} className={buttonClass({ variant: "ghost", size: "xs" })} aria-label="Sonraki soru">
                    <ChevronRight aria-hidden className="rtl:rotate-180" />
                  </Link>
                ) : (
                  <span className={buttonClass({ variant: "ghost", size: "xs" }) + " pointer-events-none opacity-40"} aria-hidden>
                    <ChevronRight className="rtl:rotate-180" />
                  </span>
                )}
              </nav>
            ) : null}
            <CopyIdButton id={question.id} />
            {yazabilir ? (
              <ButtonLink
                href={
                  "/checkup/sorular/yeni?kopya=" +
                  encodeURIComponent(question.id) +
                  (geri ? "&geri=" + encodeURIComponent(geri) : "")
                }
                variant="outline"
                size="xs"
                startIcon={<CopyPlus />}
              >
                Benzerini oluştur
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {kaydedilen ? (
        <Alert variant="success" compact className="mb-4">
          Önceki soru kaydedildi —{" "}
          <Link href={soruAdresi(kaydedilen, geri)} className="font-semibold text-gray-800 underline underline-offset-2">
            ona dön
          </Link>
          . Listede sıradaki bu.
        </Alert>
      ) : null}

      <ItemAnalysisCard analysis={analysis} version={question.version} />

      <QuestionForm
        canEdit={yazabilir}
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          scope: t.examScope,
          scopes: t.examScopes as string[],
        }))}
        objectives={objectives.map((o) => ({
          id: o.id,
          topicId: o.topicId,
          code: o.code,
          name: o.name,
          archived: o.status === "ARCHIVED",
        }))}
        question={initial}
        returnQuery={listeden ? geri : undefined}
        sonrakiId={komsu?.sonraki ?? null}
      />
    </>
  );
}
