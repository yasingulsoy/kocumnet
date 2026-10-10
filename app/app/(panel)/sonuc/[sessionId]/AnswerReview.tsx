"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  CircleCheck,
  CircleMinus,
  CircleX,
  Lightbulb,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { ERROR_TYPE_LABELS } from "@/lib/error-types";
import { BenzeriniCozButonu } from "@/components/AlistirmaButonlari";
import { cx } from "@/components/tailadmin/cx";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";

/*
 * ⚠️ Formüller SUNUCUDA çizilip buraya hazır düğüm olarak geliyor (sonuç
 * sayfası, MathContent). Bu dosya istemci bileşeni: MathContent'i burada
 * import etmek KaTeX'in ~270 KB'lık JS'ini sonuç sayfasına indiriyordu ve
 * telefon her formülü hidrasyon sırasında yeniden çiziyordu. smoke testi
 * istemci bileşenlerinden katex'e giden import zincirini yakalar.
 */
export interface ReviewChoiceView {
  id: string;
  label: string;
  content: ReactNode;
  isCorrect: boolean;
  errorType: string | null;
}

export interface ReviewItemView {
  questionId: string;
  /**
   * Yanlış/boş soruda havuzda benzeri var mı ("Benzerini çöz"). Doğru
   * cevaplanan soruda null.
   */
  benzer: boolean | null;
  order: number;
  topicName: string;
  stem: ReactNode;
  solution: ReactNode | null;
  choices: ReviewChoiceView[];
  selectedChoiceId: string | null;
  isCorrect: boolean | null;
  timeSpentMs: number;
  targetTimeSeconds: number;
}

/**
 * Cevap incelemesi — test BİTTİKTEN sonra.
 *
 * Neden hepsi kapalı başlıyor: 25 sorunun yanlışlarını otomatik açmak
 * telefonda metrelerce uzunlukta bir sayfa üretiyordu; öğrenci kaydırmaktan
 * vazgeçiyor. Bunun yerine liste varsayılan olarak SADECE yanlış ve boşları
 * gösteriyor (asıl bakılması gereken yer orası), ilki açık geliyor ve üstteki
 * soru şeridinden tek dokunuşla istenen soruya gidiliyor.
 */

/*
 * Karar renkleri kitin anlam renkleri: doğru success, yanlış error, boş gri.
 * Boyutlar her yerde açık yazılı (eski cn() özel boyutu renk sanıp siliyordu).
 */
const VERDICT = {
  correct: {
    label: "Doğru",
    Icon: CircleCheck,
    ikon: "text-success-600",
    cip: "bg-success-50 text-success-700 hover:bg-success-100",
    rozet: "success",
  },
  wrong: {
    label: "Yanlış",
    Icon: CircleX,
    ikon: "text-error-600",
    cip: "bg-error-50 text-error-700 hover:bg-error-100",
    rozet: "error",
  },
  blank: {
    label: "Boş",
    Icon: CircleMinus,
    ikon: "text-gray-400",
    cip: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    rozet: "light",
  },
} as const satisfies Record<string, { label: string; Icon: typeof CircleCheck; ikon: string; cip: string; rozet: BadgeColor }>;

function verdictOf(item: ReviewItemView) {
  if (item.isCorrect === null) return VERDICT.blank;
  return item.isCorrect ? VERDICT.correct : VERDICT.wrong;
}

export function AnswerReview({
  items,
  sessionId,
  alistirmaAcik,
}: {
  items: ReviewItemView[];
  sessionId: string;
  /** Günlük alıştırma hakkı kaldı mı (yoksa düğme yerine bunu söylüyoruz). */
  alistirmaAcik: boolean;
}) {
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
      <div className="flex flex-wrap gap-1.5 px-5 pt-4 sm:px-6 sm:pt-5">
        {items.map((item) => {
          const v = verdictOf(item);
          return (
            <button
              key={item.order}
              type="button"
              onClick={() => ac(item.order)}
              aria-label={"Soru " + (item.order + 1) + ": " + v.label}
              className={cx(
                "tabular flex size-9 cursor-pointer items-center justify-center rounded-lg text-theme-sm font-semibold transition active:scale-95",
                v.cip
              )}
            >
              {item.order + 1}
            </button>
          );
        })}
      </div>

      {hatalilar.length > 0 && hatalilar.length < items.length ? (
        <SegmentedTabs
          label="Gösterilen sorular"
          size="md"
          className="mt-4 px-5 sm:px-6"
          items={[
            {
              key: "hatali",
              label: "Yanlış ve boş",
              count: hatalilar.length,
              active: !hepsi,
              onClick: () => setHepsi(false),
            },
            { key: "hepsi", label: "Tümü", count: items.length, active: hepsi, onClick: () => setHepsi(true) },
          ]}
        />
      ) : null}

      <div className="mt-4 space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
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
              // Şeritten gidilen soru yapışkan üst çubuğun altında kalmasın.
              className="group scroll-mt-[calc(var(--ta-header-h)+1rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 px-4 py-3 transition hover:bg-gray-50 sm:gap-3 sm:px-5 [&::-webkit-details-marker]:hidden">
                <v.Icon className={cx("size-5 shrink-0", v.ikon)} aria-hidden />
                <span className="tabular shrink-0 font-display text-theme-sm font-semibold text-gray-800">
                  {item.order + 1}.
                </span>
                <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-500">{item.topicName}</span>
                {yavas ? (
                  <span className="flex shrink-0 items-center gap-1 text-theme-xs font-medium text-warning-700">
                    <Timer className="size-3.5" aria-hidden />
                    {/* Telefonda yalnızca simge görünür; ekran okuyucu yine okur. */}
                    <span className="max-sm:sr-only">yavaş</span>
                  </span>
                ) : null}
                <Badge size="sm" color={v.rozet} className="max-sm:sr-only">
                  {v.label}
                </Badge>
                <ChevronDown className="size-4 shrink-0 text-gray-400 transition group-open:rotate-180" aria-hidden />
              </summary>

              <div className="border-t border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
                <div className="text-read leading-relaxed text-gray-800">{item.stem}</div>

                <ul className="mt-4 space-y-2 sm:mt-5">
                  {item.choices.map((c) => {
                    const bu = c.id === item.selectedChoiceId;
                    return (
                      <li
                        key={c.id}
                        className={cx(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                          c.isCorrect
                            ? "border-success-200 bg-success-50"
                            : bu
                              ? "border-error-200 bg-error-50"
                              : "border-gray-200 bg-white"
                        )}
                      >
                        <span
                          className={cx(
                            "flex size-7 shrink-0 items-center justify-center rounded-full text-theme-xs font-bold",
                            c.isCorrect
                              ? "bg-success-700 text-white"
                              : bu
                                ? "bg-error-600 text-white"
                                : "bg-gray-100 text-gray-700"
                          )}
                        >
                          {c.label}
                        </span>
                        <span className="min-w-0 flex-1 text-body text-gray-800 sm:text-base">{c.content}</span>
                        {c.isCorrect ? (
                          <span className="shrink-0 text-theme-xs font-semibold text-success-700">Doğru</span>
                        ) : bu ? (
                          <span className="shrink-0 text-theme-xs font-semibold text-error-700">Seninki</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {/* Hata tipi: "yanlış yaptın" demekten çok daha işe yarar. */}
                {secilen && !secilen.isCorrect && secilen.errorType ? (
                  <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-3 text-theme-sm text-gray-700">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-600" aria-hidden />
                    <span>
                      Bu şıkkı seçmek genellikle{" "}
                      <strong className="font-semibold text-gray-800">
                        {ERROR_TYPE_LABELS[secilen.errorType as keyof typeof ERROR_TYPE_LABELS] ??
                          secilen.errorType}
                      </strong>{" "}
                      anlamına gelir.
                    </span>
                  </p>
                ) : null}

                {item.isCorrect === null && dogru ? (
                  <p className="mt-4 text-theme-sm text-gray-700">
                    Bu soruyu boş bıraktın. Doğru cevap{" "}
                    <strong className="font-semibold text-gray-800">{dogru.label}</strong>.
                  </p>
                ) : null}

                {item.solution ? (
                  <div className="mt-4 rounded-xl border border-brand-100 bg-brand-25 p-3.5 sm:mt-5 sm:p-5">
                    <p className="flex items-center gap-2 text-theme-xs font-semibold tracking-wide text-brand-500 uppercase">
                      <Lightbulb className="size-4" aria-hidden /> Çözüm
                    </p>
                    <div className="mt-2.5 text-body leading-relaxed text-gray-800">{item.solution}</div>
                  </div>
                ) : (
                  <p className="mt-4 text-theme-xs text-gray-500">Bu soruya henüz çözüm eklenmemiş.</p>
                )}

                {/* Öğrenme döngüsü: yanlışın hemen ardından aynı tipten bir soru.
                    Benzeri yoksa düğme değil açıklama — ölü düğme yok. */}
                {item.benzer !== null ? (
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 pt-4 print:hidden">
                    {item.benzer && alistirmaAcik ? (
                      <>
                        <p className="min-w-0 flex-1 text-theme-sm text-gray-500">
                          Çözümü okudun; şimdi aynı tipten bir soruyla dene. Süre yok.
                        </p>
                        <BenzeriniCozButonu sessionId={sessionId} questionId={item.questionId} />
                      </>
                    ) : (
                      <p className="text-theme-sm text-gray-500">
                        {!item.benzer
                          ? "Bu sorunun benzeri havuzda henüz yok."
                          : "Bugünlük alıştırma hakkın doldu; benzer soruyu yarın çözebilirsin."}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
