import { MathContent } from "@/components/MathContent";
import { ERROR_TYPE_LABELS } from "@/lib/error-types";
import type { ReviewItem } from "@/lib/checkup";

/**
 * Cevap incelemesi — test BİTTİKTEN sonra.
 *
 * Yanlış ve boş sorular varsayılan olarak AÇIK geliyor: öğrencinin bakması
 * gereken yer orası. Doğrular kapalı duruyor, çünkü 25 sorunun tamamını açmak
 * sayfayı okunmaz yapıyor ve doğru yaptığı soruyu kimse tekrar okumuyor.
 */

const VERDICT = {
  correct: { label: "doğru", cls: "bg-ok-wash text-ok" },
  wrong: { label: "yanlış", cls: "bg-bad-wash text-bad" },
  blank: { label: "boş", cls: "bg-surface-sunk text-ink-faint" },
} as const;

function verdictOf(item: ReviewItem) {
  if (item.isCorrect === null) return VERDICT.blank;
  return item.isCorrect ? VERDICT.correct : VERDICT.wrong;
}

export function AnswerReview({ items }: { items: ReviewItem[] }) {
  const yanlisVeBos = items.filter((i) => i.isCorrect !== true).length;

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold text-ink">Cevaplarını incele</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {yanlisVeBos > 0
          ? `Yanlış ve boş bıraktığın ${yanlisVeBos} soru açık geliyor. Doğru yaptıklarına tıklayarak bakabilirsin.`
          : "Hepsini doğru yaptın. Sorulara tıklayarak çözümlere bakabilirsin."}
      </p>

      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const v = verdictOf(item);
          const dogruSik = item.choices.find((c) => c.isCorrect);
          const secilen = item.choices.find((c) => c.id === item.selectedChoiceId);
          const yavas = item.timeSpentMs > item.targetTimeSeconds * 1000 * 1.3;

          return (
            <details
              key={item.order}
              // Yanlış ve boşlar açık — öğrenci bunlara bakmalı.
              open={item.isCorrect !== true}
              className="group rounded-xl border border-line bg-surface"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5">
                <span className="font-mono text-sm font-bold text-ink-faint">
                  {item.order + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
                  {item.topicName}
                </span>
                {yavas ? (
                  <span className="shrink-0 text-[11px] text-warn" title="Hedef sürenin üstünde">
                    yavaş
                  </span>
                ) : null}
                <span
                  className={"shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold " + v.cls}
                >
                  {v.label}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-ink-faint transition group-open:rotate-90"
                >
                  ›
                </span>
              </summary>

              <div className="border-t border-line px-5 py-4">
                <div className="text-[15px] text-ink">
                  <MathContent content={item.stem} />
                </div>

                <ul className="mt-4 space-y-1.5">
                  {item.choices.map((c) => {
                    const bu = c.id === item.selectedChoiceId;
                    const stil = c.isCorrect
                      ? "border-ok bg-ok-wash/50"
                      : bu
                        ? "border-bad bg-bad-wash/50"
                        : "border-line";

                    return (
                      <li
                        key={c.id}
                        className={"flex items-center gap-3 rounded-lg border px-3 py-2 " + stil}
                      >
                        <span
                          className={
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold " +
                            (c.isCorrect
                              ? "border-ok bg-ok text-white"
                              : bu
                                ? "border-bad bg-bad text-white"
                                : "border-line-strong text-ink-faint")
                          }
                        >
                          {c.label}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-ink">
                          <MathContent content={c.content} compact />
                        </span>
                        {c.isCorrect ? (
                          <span className="shrink-0 text-[11px] font-medium text-ok">doğru cevap</span>
                        ) : bu ? (
                          <span className="shrink-0 text-[11px] font-medium text-bad">senin işaretin</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {/* Hata tipi: çeldiricinin hangi hatayı yakaladığını söyler.
                    "Yanlış yaptın" demekten çok daha işe yarar. */}
                {secilen && !secilen.isCorrect && secilen.errorType ? (
                  <p className="mt-3 rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">
                    Bu şıkkı seçmek genelde{" "}
                    <strong className="font-semibold">
                      {ERROR_TYPE_LABELS[secilen.errorType as keyof typeof ERROR_TYPE_LABELS] ??
                        secilen.errorType}
                    </strong>{" "}
                    anlamına gelir.
                  </p>
                ) : null}

                {item.isCorrect === null ? (
                  <p className="mt-3 text-sm text-ink-soft">
                    Bu soruyu boş bıraktın. Doğru cevap{" "}
                    <strong className="font-semibold text-ink">{dogruSik?.label}</strong>.
                  </p>
                ) : null}

                {item.solution ? (
                  <div className="mt-4 rounded-lg border border-line bg-surface-sunk p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                      Çözüm
                    </p>
                    <div className="text-[15px] text-ink">
                      <MathContent content={item.solution} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-ink-faint">Bu soruya henüz çözüm eklenmemiş.</p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
