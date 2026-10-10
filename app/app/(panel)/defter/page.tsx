import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CircleCheck, NotebookPen } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { defterListesi } from "@/lib/notebook";
import { bugunkuTekrarDurumu, defterBenzerDurumu } from "@/lib/practice";
import { TEKRAR_ARALIKLARI_GUN, vadeMetni } from "@/lib/review";
import { parseQuestionContent } from "@/lib/question-content";
import { MathContent } from "@/components/MathContent";
import { DefterKarti } from "@/components/DefterKarti";
import { cx } from "@/components/tailadmin/cx";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";

export const metadata: Metadata = { title: "Yanlış defteri" };

/** Maddenin kaç tekrarı geçtiği: her aralık için bir çizgi. */
function Asama({ stage }: { stage: number }) {
  const toplam = TEKRAR_ARALIKLARI_GUN.length;
  return (
    <span className="flex items-center gap-1.5" aria-label={`${toplam} tekrardan ${stage} tanesi tamam`}>
      <span className="flex gap-0.5" aria-hidden>
        {TEKRAR_ARALIKLARI_GUN.map((_, i) => (
          <span key={i} className={cx("h-1.5 w-3 rounded-full", i < stage ? "bg-success-500" : "bg-gray-200")} />
        ))}
      </span>
      <span className="tabular">
        {stage}/{toplam} tekrar
      </span>
    </span>
  );
}

/**
 * Yanlış defteri: açık maddeler konuya göre, her birinin sıradaki tekrarı.
 *
 * Konu sırası "en acil önce": en erken vadeli maddesi olan konu üstte.
 * Soru gövdesi sunucuda çizilir (KaTeX istemciye gitmez); öğrenci bu
 * soruların çözümünü zaten sonuç ekranında gördü, defter yalnızca hatırlatır.
 */
export default async function DefterPage() {
  const user = await requirePageUser();
  const now = new Date();

  const [durum, { acik, cozulen }] = await Promise.all([
    bugunkuTekrarDurumu(user.id, now),
    defterListesi(user.id),
  ]);
  const [benzer, oturumlar] = await Promise.all([
    defterBenzerDurumu(user.id, acik),
    prisma.checkupSession.findMany({
      where: { id: { in: [...new Set(acik.map((m) => m.lastSessionId))] }, userId: user.id },
      select: { id: true, kind: true, result: { select: { id: true } } },
    }),
  ]);
  // "Testte gör" yalnızca sonuç ekranı olan testlerde (seviyeli aşamanın yok).
  const sonucuOlan = new Set(
    oturumlar.filter((o) => (o.kind === "PACKAGE" || o.kind === "TOPIC_RETEST") && o.result).map((o) => o.id)
  );

  // Maddeler vadeye göre sıralı geliyor: konunun ilk görüldüğü yer en erken vadesi.
  const gruplar = new Map<string, { ad: string; maddeler: typeof acik }>();
  for (const m of acik) {
    const g = gruplar.get(m.topic.id) ?? { ad: m.topic.name, maddeler: [] };
    g.maddeler.push(m);
    gruplar.set(m.topic.id, g);
  }

  return (
    <div className="mx-auto w-full max-w-4xl animate-rise">
      <PageBreadcrumb
        pageTitle="Yanlış defteri"
        description={`Testlerde yanlış yaptığın ya da boş bıraktığın sorular. Her biri ${TEKRAR_ARALIKLARI_GUN.join(", ")} gün arayla benzer bir soruyla geri gelir; ${TEKRAR_ARALIKLARI_GUN.length} tekrarı da doğru yapınca defterden çıkar.`}
      />

      <div className="space-y-4 md:space-y-6">
        <DefterKarti durum={durum} now={now} defterSayfasi />

        {acik.length === 0 ? (
          <Card>
            <EmptyState
              icon={<NotebookPen />}
              title={cozulen > 0 ? "Açık madde kalmadı" : "Defterin boş"}
              description={
                cozulen > 0
                  ? "Bütün yanlışlarını aralıklı tekrarla kapattın. Yeni bir test çöz, yeni yanlışlar buraya düşsün."
                  : "Bir test çözdüğünde yanlış ve boş bıraktığın sorular buraya düşer."
              }
              action={<ButtonLink href="/paketler">Test çöz</ButtonLink>}
            />
          </Card>
        ) : (
          [...gruplar].map(([topicId, g]) => (
            <ComponentCard key={topicId} title={g.ad} desc={`${g.maddeler.length} madde`} flush>
              <ul className="divide-y divide-gray-100">
                {g.maddeler.map((m) => {
                  const vadesiGeldi = m.dueAt.getTime() <= now.getTime();
                  return (
                    <li key={m.id} className="px-5 py-4 sm:px-6">
                      <div className="line-clamp-2 text-read leading-relaxed text-gray-800">
                        <MathContent content={parseQuestionContent(m.question.stem)} compact />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-theme-xs text-gray-500">
                        <Asama stage={m.stage} />
                        <span className={vadesiGeldi ? "font-semibold text-brand-500" : ""}>
                          Tekrar: {vadeMetni(m.dueAt, now)}
                        </span>
                        {m.wrongCount > 1 ? <span>{m.wrongCount} kez yanlış</span> : null}
                        {benzer.get(m.questionId) === false ? (
                          <span className="font-medium text-warning-700">Şu an uygun benzeri yok</span>
                        ) : null}
                        {sonucuOlan.has(m.lastSessionId) ? (
                          <Link
                            href={`/sonuc/${m.lastSessionId}`}
                            className="ms-auto inline-flex min-h-9 items-center gap-1 font-medium text-brand-500 transition hover:text-brand-600"
                          >
                            Testte gör <ArrowUpRight className="size-3.5" aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ComponentCard>
          ))
        )}

        {cozulen > 0 && acik.length > 0 ? (
          <p className="flex items-center gap-1.5 text-theme-sm text-gray-500">
            <CircleCheck className="size-4 text-success-600" aria-hidden />
            <span className="tabular">{cozulen}</span> madde defterden çıktı.
          </p>
        ) : null}
      </div>
    </div>
  );
}
