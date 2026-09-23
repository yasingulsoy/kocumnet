"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  CircleCheck,
  CircleMinus,
  CircleX,
  Lightbulb,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { MathContent } from "@/components/MathContent";
import { ERROR_TYPE_LABELS } from "@/lib/error-types";
import type { ReviewItem } from "@/lib/checkup";
import { cn } from "@/lib/cn";

/**
 * Cevap incelemesi — test BİTTİKTEN sonra.
 *
 * Neden hepsi kapalı başlıyor: 25 sorunun yanlışlarını otomatik açmak
 * telefonda metrelerce uzunlukta bir sayfa üretiyordu; öğrenci kaydırmaktan
 * vazgeçiyor. Bunun yerine liste varsayılan olarak SADECE yanlış ve boşları
 * gösteriyor (asıl bakılması gereken yer orası), ilki açık geliyor ve üstteki
 * soru şeridinden tek dokunuşla istenen soruya gidiliyor.
 */

const VERDICT = {
  correct: { label: "Doğru", Icon: CircleCheck, cls: "text-ok", chip: "bg-ok-wash text-ok" },
  wrong: { label: "Yanlış", Icon: CircleX, cls: "text-bad", chip: "bg-bad-wash text-bad" },
  blank: {
    label: "Boş",
    Icon: CircleMinus,
    cls: "text-ink-faint",
    chip: "bg-surface-sunk text-ink-soft",
  },
} as const;

function verdictOf(item: ReviewItem) {
  if (item.isCorrect === null) return VERDICT.blank;
  return item.isCorrect ? VERDICT.correct : VERDICT.wrong;
}

export function AnswerReview({ items }: { items: ReviewItem[] }) {
  const hatalilar = useMemo(() => items.filter((i) => i.isCorrect !== true), [items]);
  const [hepsi, setHepsi] = useState(hatalilar.length === 0);
  const [acik, setAcik] = useState<Set<number>>(
    () => new Set(hatalilar.length > 0 ? [hatalilar[0].order] : [])
  );

  const gosterilen = hepsi ? items : hatalilar;

  function ac(order: number) {
    setAcik((prev) => {
      const s = new Set(prev);
      s.add(order);
      return s;
    });
    // Kapalı bir soruya şeritten dokunulduysa önce görünür olmalı.
    if (!hepsi && items.find((i) => i.order === order)?.isCorrect === true) setHepsi(true);
    requestAnimationFrame(() => {
      document.getElementById("soru-" + order)?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <section>
      {/* Soru şeridi: tek bakışta hangi sorular yanlış, dokununca o soru açılır. */}
      <div className="flex flex-wrap gap-1 px-4 sm:px-6">
        {items.map((item) => {
          const v = verdictOf(item);
          return (
            <button
              key={item.order}
              type="button"
              onClick={() => ac(item.order)}
              aria-label={"Soru " + (item.order + 1) + ": " + v.label}
              className={cn(
                "tabular flex size-7 items-center justify-center rounded-md text-[11px] font-semibold transition active:scale-95",
                v.chip
              )}
            >
              {item.order + 1}
            </button>
          );
        })}
      </div>

      {hatalilar.length > 0 && hatalilar.length < items.length ? (
        <div className="mt-3 flex items-center gap-2 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setHepsi(false)}
            aria-pressed={!hepsi}
            className={cn(
              "min-h-9 rounded-lg px-3 text-caption font-semibold transition",
              !hepsi
                ? "bg-brand-deep text-white"
                : "bg-surface-sunk text-ink-soft ring-1 ring-inset ring-line"
            )}
          >
            Yanlış ve boş ({hatalilar.length})
          </button>
          <button
            type="button"
            onClick={() => setHepsi(true)}
            aria-pressed={hepsi}
            className={cn(
              "min-h-9 rounded-lg px-3 text-caption font-semibold transition",
              hepsi
                ? "bg-brand-deep text-white"
                : "bg-surface-sunk text-ink-soft ring-1 ring-inset ring-line"
            )}
          >
            Tümü ({items.length})
          </button>
        </div>
      ) : null}

      <div className="mt-3 space-y-2.5 px-4 pb-4 sm:px-6 sm:pb-6">
        {gosterilen.map((item) => {
          const v = verdictOf(item);
          const secilen = item.choices.find((c) => c.id === item.selectedChoiceId);
          const dogru = item.choices.find((c) => c.isCorrect);
          const yavas = item.timeSpentMs > item.targetTimeSeconds * 1000 * 1.3;

          return (
            <details
              key={item.order}
              id={"soru-" + item.order}
              open={acik.has(item.order)}
              onToggle={(e) => {
                const open = e.currentTarget.open;
                setAcik((prev) => {
                  const s = new Set(prev);
                  if (open) s.add(item.order);
                  else s.delete(item.order);
                  return s;
                });
              }}
              className="group scroll-mt-4 overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 transition hover:bg-surface-sunk sm:gap-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                <v.Icon className={cn("size-5 shrink-0", v.cls)} />
                <span className="font-display tabular shrink-0 text-caption font-bold text-ink">
                  {item.order + 1}.
                </span>
                <span className="min-w-0 flex-1 truncate text-caption text-ink-soft">
                  {item.topicName}
                </span>
                {yavas ? (
                  <span className="flex shrink-0 items-center gap-1 text-micro font-medium text-warn">
                    <Timer className="size-3.5" />
                    <span className="max-sm:hidden">yavaş</span>
                  </span>
                ) : null}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-micro font-semibold max-sm:hidden",
                    v.chip
                  )}
                >
                  {v.label}
                </span>
                <ChevronDown className="size-4 shrink-0 text-ink-faint transition group-open:rotate-180" />
              </summary>

              <div className="border-t border-line px-3.5 py-4 sm:px-5 sm:py-5">
                <div className="text-read leading-relaxed text-ink">
                  <MathContent content={item.stem} />
                </div>

                <ul className="mt-4 space-y-2 sm:mt-5">
                  {item.choices.map((c) => {
                    const bu = c.id === item.selectedChoiceId;
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5",
                          c.isCorrect
                            ? "border-ok-fill/60 bg-ok-wash/60"
                            : bu
                              ? "border-bad-fill/50 bg-bad-wash/60"
                              : "border-transparent bg-surface-sunk"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full text-micro font-bold",
                            c.isCorrect
                              ? "bg-ok-fill text-white"
                              : bu
                                ? "bg-bad-fill text-white"
                                : "bg-surface text-ink-faint ring-1 ring-inset ring-line"
                          )}
                        >
                          {c.label}
                        </span>
                        <span className="min-w-0 flex-1 text-body text-ink">
                          <MathContent content={c.content} compact />
                        </span>
                        {c.isCorrect ? (
                          <span className="shrink-0 text-micro font-semibold text-ok">Doğru</span>
                        ) : bu ? (
                          <span className="shrink-0 text-micro font-semibold text-bad">Seninki</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {/* Hata tipi: "yanlış yaptın" demekten çok daha işe yarar. */}
                {secilen && !secilen.isCorrect && secilen.errorType ? (
                  <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-warn-wash px-3.5 py-3 text-caption text-ink-soft">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
                    <span>
                      Bu şıkkı seçmek genellikle{" "}
                      <strong className="font-semibold text-ink">
                        {ERROR_TYPE_LABELS[secilen.errorType as keyof typeof ERROR_TYPE_LABELS] ??
                          secilen.errorType}
                      </strong>{" "}
                      anlamına gelir.
                    </span>
                  </p>
                ) : null}

                {item.isCorrect === null && dogru ? (
                  <p className="mt-4 text-caption text-ink-soft">
                    Bu soruyu boş bıraktın. Doğru cevap{" "}
                    <strong className="font-semibold text-ink">{dogru.label}</strong>.
                  </p>
                ) : null}

                {item.solution ? (
                  <div className="mt-4 rounded-xl border border-brand/15 bg-brand-wash/50 p-3.5 sm:mt-5 sm:p-5">
                    <p className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wide text-brand">
                      <Lightbulb className="size-4" /> Çözüm
                    </p>
                    <div className="mt-2.5 text-body leading-relaxed text-ink">
                      <MathContent content={item.solution} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-micro text-ink-faint">
                    Bu soruya henüz çözüm eklenmemiş.
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
