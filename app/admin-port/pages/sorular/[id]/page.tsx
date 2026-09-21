import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseQuestionContent } from "@/lib/question-content";
import { contentToMarkup, hasUneditableBlocks } from "@/lib/question-markup";
import { Alert } from "@/components/ui";
import { QuestionForm } from "../QuestionForm";

export const metadata: Metadata = { title: "Soruyu düzenle" };

export default async function EditQuestionPage({
  params,
}: PageProps<"/admin/sorular/[id]">) {
  const { id } = await params;

  const [question, topics] = await Promise.all([
    prisma.question.findUnique({
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
        choices: {
          orderBy: { sortOrder: "asc" },
          select: { content: true, isCorrect: true, errorType: true },
        },
      },
    }),
    prisma.topic.findMany({
      where: { children: { none: {} } },
      orderBy: [{ examScope: "asc" }, { name: "asc" }],
      select: { id: true, name: true, examScope: true },
    }),
  ]);

  if (!question) notFound();

  const stemContent = parseQuestionContent(question.stem);

  // Tablo ve görsel yazım biçiminde temsil edilemiyor. Bu formda kaydetmek
  // onları sessizce siler — o yüzden düzenlemeye hiç izin vermiyoruz.
  if (hasUneditableBlocks(stemContent)) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          Soruyu düzenle
        </h1>
        <div className="mt-6">
          <Alert tone="warn">
            Bu soru tablo veya görsel içeriyor. Metin editörü bunları temsil edemiyor ve
            kaydetmek onları silerdi, bu yüzden düzenleme kapalı. Görsel destekli editör
            geldiğinde açılacak.
          </Alert>
        </div>
      </main>
    );
  }

  const initial = {
    id: question.id,
    topicId: question.topicId,
    stem: contentToMarkup(stemContent),
    solution: question.solution
      ? contentToMarkup(parseQuestionContent(question.solution))
      : "",
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

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
        Soruyu düzenle
      </h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">
        Sürüm v{question.version}
        {question.shownCount > 0 ? " · " + question.shownCount + " kez soruldu" : ""}
      </p>

      <div className="mt-6">
        <QuestionForm
          topics={topics.map((t) => ({ id: t.id, name: t.name, scope: t.examScope }))}
          question={initial}
        />
      </div>
    </main>
  );
}
