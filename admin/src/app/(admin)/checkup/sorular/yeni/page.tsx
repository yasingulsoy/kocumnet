import type { Metadata } from "next";
import { db } from "@/lib/checkup/db";
import { CONTENT_ROLES, checkStaff } from "@/lib/checkup/staff";
import { GateNotice } from "@/components/checkup/GateNotice";
import { QuestionForm } from "@/components/checkup/QuestionForm";
import { PageHeader } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Yeni soru" };

export default async function NewQuestionPage() {
  const gate = await checkStaff(CONTENT_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={CONTENT_ROLES} />;

  // Sorular yalnızca yaprak konulara bağlanır: üst konuya bağlanan soru
  // hiçbir pakette seçilemez (seçim tam eşleşme yapıyor).
  const topics = await db.topic.findMany({
    where: { children: { none: {} } },
    orderBy: [{ examScope: "asc" }, { name: "asc" }],
    select: { id: true, name: true, examScope: true },
  });

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/sorular", label: "Sorular" },
        ]}
        title="Yeni soru"
        description="Yayına almadan önce önizlemeyi öğrencinin gözüyle kontrol et."
      />
      <QuestionForm
        canEdit
        topics={topics.map((t) => ({ id: t.id, name: t.name, scope: t.examScope }))}
      />
    </>
  );
}
