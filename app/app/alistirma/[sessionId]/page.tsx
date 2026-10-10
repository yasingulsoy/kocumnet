import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CheckupError } from "@/lib/checkup";
import { alistirmaHakki, benzerDurumlari, getPracticeSession } from "@/lib/practice";
import { examShort } from "@/lib/exams";
import { MathContent } from "@/components/MathContent";
import { BenzeriniCozButonu } from "@/components/AlistirmaButonlari";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { vadeMetni } from "@/lib/review";
import { PracticeRunner, type PracticeQuestionView } from "./PracticeRunner";

export const metadata: Metadata = { title: "Alıştırma" };

/**
 * Alıştırma ekranı — sınav modu gibi çerçevesiz, ama süre yok.
 *
 * Formüller ve geri bildirim BURADA, sunucuda çiziliyor. Cevaplanmamış
 * sorunun doğrusu ve çözümü bu sayfaya hiç girmez (lib/practice.ts); cevap
 * gönderilince eylem sayfayı yeniden çizdirir ve geri bildirim o zaman gelir.
 */
export default async function AlistirmaPage({ params }: PageProps<"/alistirma/[sessionId]">) {
  const { sessionId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/giris");

  const tur = await prisma.checkupSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, kind: true },
  });
  // Başkasının oturumu: "yok" diyoruz, "yetkin yok" değil.
  if (!tur || tur.userId !== user.id) notFound();
  // Sınav oturumu bu ekranda açılmaz (geri bildirim test sürerken cevabı gösterirdi).
  if (tur.kind !== "PRACTICE") redirect(`/checkup/${sessionId}`);

  let view;
  try {
    view = await getPracticeSession(sessionId, user.id);
  } catch (e) {
    if (e instanceof CheckupError) notFound();
    throw e;
  }

  const closed = view.status !== "IN_PROGRESS";

  const baslik =
    view.mode === "SIMILAR"
      ? "Benzer soru"
      : view.mode === "REVIEW"
        ? "Bugünkü tekrar"
        : `${view.topicName ?? "Konu"} alıştırması`;
  const altBaslik =
    view.mode === "SIMILAR"
      ? `${view.topicName ?? ""}${view.topicName ? " · " : ""}yanlışının benzeri`
      : view.mode === "REVIEW"
        ? `Yanlış defteri · ${view.questions.length} benzer soru`
        : `${examShort(view.examScope)} · ${view.questions.length} soru, süre yok`;
  const cikis =
    view.mode === "REVIEW"
      ? { href: "/defter", label: "Deftere dön" }
      : view.sourceSessionId
        ? { href: `/sonuc/${view.sourceSessionId}`, label: "Sonuca dön" }
        : { href: "/panel", label: "Ana sayfa" };

  /*
   * Benzer alıştırma bittiyse "bir benzerini daha" — yalnızca havuzda gerçekten
   * bir benzeri daha varsa ve günlük hak bitmediyse (ölü düğme yok).
   */
  let ekEylem: ReactNode = null;
  if (view.mode === "SIMILAR" && closed && view.sourceSessionId && view.sourceQuestionId) {
    const [durumlar, hak] = await Promise.all([
      benzerDurumlari(user.id, view.sourceSessionId).catch(() => null),
      alistirmaHakki(user.id),
    ]);
    const var_ = durumlar?.get(view.sourceQuestionId) === true;
    ekEylem = (
      <Card className="p-4 sm:p-5">
        {var_ && hak > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-theme-sm leading-relaxed text-gray-500">
              Aynı tipten bir soru daha çözmek istersen havuzda bir benzeri daha var.
            </p>
            <BenzeriniCozButonu
              sessionId={view.sourceSessionId}
              questionId={view.sourceQuestionId}
              etiket="Bir benzerini daha çöz"
            />
          </div>
        ) : (
          <p className="text-theme-sm leading-relaxed text-gray-500">
            {hak > 0
              ? "Bu sorunun havuzda başka benzeri yok. Çözümü bir kez daha oku, birkaç gün sonra yeniden dene."
              : "Bugünlük alıştırma hakkın doldu. Yarın devam edelim."}
          </p>
        )}
      </Card>
    );
  }

  // Bugünkü tekrar bittiyse defterin durumu: kaç madde kaldı, sıradaki ne zaman.
  if (view.mode === "REVIEW" && closed) {
    const simdi = new Date();
    const [acikMadde, siradaki] = await Promise.all([
      prisma.notebookItem.count({ where: { userId: user.id, resolvedAt: null } }),
      prisma.notebookItem.findFirst({
        where: { userId: user.id, resolvedAt: null, dueAt: { gt: simdi } },
        orderBy: { dueAt: "asc" },
        select: { dueAt: true },
      }),
    ]);
    ekEylem = (
      <Card className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <p className="min-w-0 flex-1 text-theme-sm leading-relaxed text-gray-500">
          {acikMadde === 0
            ? "Yanlış defterin boşaldı. Yeni yanlışların test çözdükçe buraya düşer."
            : `Defterinde ${acikMadde} açık madde var${siradaki ? `; sıradaki tekrar ${vadeMetni(siradaki.dueAt, simdi)}` : ""}.`}
        </p>
        <ButtonLink href="/defter" variant="outline" size="xs" className="max-sm:w-full">
          Deftere git
        </ButtonLink>
      </Card>
    );
  }

  const questions: PracticeQuestionView[] = view.questions.map((q) => ({
    id: q.id,
    order: q.order,
    topicName: q.topicName,
    stem: <MathContent content={q.stem} />,
    choices: q.choices.map((c) => ({
      id: c.id,
      label: c.label,
      content: <MathContent content={c.content} compact />,
    })),
    feedback: q.feedback
      ? {
          selectedChoiceId: q.feedback.selectedChoiceId,
          isCorrect: q.feedback.isCorrect,
          correctChoiceId: q.feedback.correctChoiceId,
          errorLabel: q.feedback.errorLabel,
          errorAdvice: q.feedback.errorAdvice,
          solution: q.feedback.solution ? <MathContent content={q.feedback.solution} /> : null,
          note: q.feedback.defterNotu,
        }
      : null,
  }));

  return (
    <main className="min-h-screen">
      <PracticeRunner
        sessionId={view.id}
        title={baslik}
        subtitle={altBaslik}
        closed={closed}
        exitHref={cikis.href}
        exitLabel={cikis.label}
        questions={questions}
        summaryExtra={ekEylem}
      />
    </main>
  );
}
