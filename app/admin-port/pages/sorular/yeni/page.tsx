import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { QuestionForm } from "../QuestionForm";

export const metadata: Metadata = { title: "Yeni soru" };

export default async function NewQuestionPage() {
  // Sorular yalnızca yaprak konulara bağlanır: üst konuya bağlanan soru
  // hiçbir pakette seçilemez (seçim tam eşleşme yapıyor).
  const topics = await prisma.topic.findMany({
    where: { children: { none: {} } },
    orderBy: [{ examScope: "asc" }, { name: "asc" }],
    select: { id: true, name: true, examScope: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Yeni soru</h1>
      <p className="mt-1.5 text-[15px] text-ink-soft">
        Formülleri <code className="font-mono text-sm">$…$</code> içine yaz; önizleme anında
        güncellenir.
      </p>

      <div className="mt-6">
        <QuestionForm
          topics={topics.map((t) => ({ id: t.id, name: t.name, scope: t.examScope }))}
        />
      </div>
    </main>
  );
}
