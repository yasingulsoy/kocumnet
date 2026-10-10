import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStudentSession, CheckupError } from "@/lib/checkup";
import { MathContent } from "@/components/MathContent";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { CircleAlert } from "lucide-react";
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

  // Alıştırmanın kendi ekranı var (süre yok, her cevaptan sonra geri bildirim).
  if (session.kind === "PRACTICE") redirect(`/alistirma/${sessionId}`);

  // Bitmiş testin ekranını göstermek anlamsız — sonuca gönder. Seviyeli
  // check-up aşaması koçluk sonucuna değil kendi deneme sayfasına döner.
  if (session.status !== "IN_PROGRESS") {
    redirect(session.levelRunId ? `/seviye/${session.levelRunId}` : `/sonuc/${sessionId}`);
  }

  /*
   * Sorusuz oturum (eskiden katalog dışı bir paketle açılabiliyordu, artık
   * startCheckup reddediyor): sınav ekranı ilk soruyu ararken çöküyordu.
   */
  if (session.questions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <EmptyState
            icon={<CircleAlert />}
            title="Bu testte soru yok"
            description="Test hazırlanırken bir sorun çıkmış. Testler sayfasından yeniden başlayabilirsin."
            action={<ButtonLink href="/paketler">Testlere dön</ButtonLink>}
          />
        </Card>
      </main>
    );
  }

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
