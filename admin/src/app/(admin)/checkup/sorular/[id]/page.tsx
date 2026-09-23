import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { percent, trDate } from "@/lib/checkup/format";
import { parseQuestionContent } from "@/lib/checkup/shared/question-content";
import { contentToMarkup, hasUneditableBlocks } from "@/lib/checkup/shared/question-markup";
import { GateNotice } from "@/components/checkup/GateNotice";
import { QuestionForm } from "@/components/checkup/QuestionForm";
import { Notice, PageHeader } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Soruyu düzenle" };

const CRUMBS = [
  { href: "/checkup", label: "Check-up" },
  { href: "/checkup/sorular", label: "Sorular" },
];

export default async function EditQuestionPage({ params }: PageProps<"/checkup/sorular/[id]">) {
  // Görüntüleyici de açabilir (inceleme); kaydetmeyi form ve sunucu engeller.
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yazabilir = CONTENT_ROLES.includes(gate.staff.role);

  const { id } = await params;

  const [question, topics] = await Promise.all([
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
        version: true,
        shownCount: true,
        correctCount: true,
        createdAt: true,
        updatedAt: true,
        createdByStaff: true,
        updatedByStaff: true,
        choices: {
          orderBy: { sortOrder: "asc" },
          select: { content: true, isCorrect: true, errorType: true, label: true, chosenCount: true },
        },
      },
    }),
    db.topic.findMany({
      where: { children: { none: {} } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { id: true, name: true, examScope: true },
    }),
  ]);

  if (!question) notFound();

  const stemContent = parseQuestionContent(question.stem);

  // Tablo yazım biçiminde temsil edilemiyor. Bu formda kaydetmek onu sessizce
  // siler — o yüzden düzenlemeye hiç izin vermiyoruz.
  if (hasUneditableBlocks(stemContent)) {
    return (
      <>
        <PageHeader crumbs={CRUMBS} title="Soruyu düzenle" />
        <Notice tone="warn" title="Bu soru metin editöründe düzenlenemiyor">
          Soru, yazım biçiminin temsil edemediği bir blok (tablo ya da altyazılı şekil)
          içeriyor. Bu formda kaydetmek o bloğu silerdi, bu yüzden düzenleme kapalı.
        </Notice>
      </>
    );
  }

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
    version: question.version,
    shownCount: question.shownCount,
  };

  // Şık dağılımı: hangi çeldirici çalışıyor, hangisi hiç seçilmiyor?
  const secimToplam = question.choices.reduce((s, c) => s + c.chosenCount, 0);

  const alt = [
    "Sürüm v" + question.version,
    question.shownCount > 0
      ? question.shownCount + " kez soruldu · " + percent(question.correctCount / question.shownCount) + " doğru"
      : "henüz sorulmadı",
    "eklendi " + trDate(question.createdAt) + (question.createdByStaff ? " · " + question.createdByStaff : ""),
    question.updatedByStaff && question.updatedAt.getTime() !== question.createdAt.getTime()
      ? "son düzenleme " + trDate(question.updatedAt) + " · " + question.updatedByStaff
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader crumbs={CRUMBS} title="Soruyu düzenle" description={alt} />

      {secimToplam > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {question.choices.map((c) => (
            <span
              key={c.label}
              className={
                "rounded-lg border px-3 py-1.5 text-theme-xs tabular-nums " +
                (c.isCorrect
                  ? "border-success-500/50 bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500"
                  : "border-gray-200 text-gray-600 dark:border-gray-800 dark:text-gray-400")
              }
              title={c.chosenCount + " öğrenci bu şıkkı seçti"}
            >
              <strong className="font-semibold">{c.label}</strong> {percent(c.chosenCount / secimToplam)}
            </span>
          ))}
          <span className="self-center text-theme-xs text-gray-500 dark:text-gray-400">
            şık seçilme oranları ({secimToplam} cevap)
          </span>
        </div>
      ) : null}

      <QuestionForm
        canEdit={yazabilir}
        topics={topics.map((t) => ({ id: t.id, name: t.name, scope: t.examScope }))}
        question={initial}
      />
    </>
  );
}
