import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStudentSession, CheckupError } from "@/lib/checkup";
import { MathContent } from "@/components/MathContent";
import { CheckupRunner } from "./CheckupRunner";

export const metadata: Metadata = { title: "Check-up" };

export default async function CheckupPage({ params }: PageProps<"/checkup/[sessionId]">) {
  const { sessionId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  let session;
  try {
    session = await getStudentSession(sessionId, user.id);
  } catch (e) {
    if (e instanceof CheckupError) notFound();
    throw e;
  }

  // Bitmiş testin ekranını göstermek anlamsız — sonuca gönder.
  if (session.status !== "IN_PROGRESS") redirect(`/sonuc/${sessionId}`);

  /*
   * Formüller BURADA, sunucuda render ediliyor ve React elemanı olarak
   * istemci bileşenine geçiyor. Böylece KaTeX'in JS'i tarayıcıya hiç inmiyor;
   * istemci yalnızca hangi şıkkın seçili olduğunu ve süreyi yönetiyor.
   */
  const questions = session.questions.map((q) => ({
    id: q.id,
    order: q.order,
    topicName: q.topicName,
    stem: <MathContent content={q.stem} />,
    choices: q.choices.map((c) => ({
      id: c.id,
      label: c.label,
      content: <MathContent content={c.content} compact />,
    })),
    selectedChoiceId: q.selectedChoiceId,
  }));

  return (
    <main className="min-h-screen">
      <CheckupRunner
        sessionId={session.id}
        packageName={session.packageName}
        questions={questions}
        remainingMs={session.remainingMs}
      />
    </main>
  );
}
