"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import {
  ArrowRight,
  CircleCheck,
  CircleHelp,
  CircleMinus,
  CircleX,
  Lightbulb,
  ListChecks,
  LogIn,
  TriangleAlert,
  X,
} from "lucide-react";
import { alistirmaCevaplaAction } from "@/lib/actions/practice";
import { Logo } from "@/components/ui/logo";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { cn } from "@/lib/cn";

/*
 * ⚠️ Formüller SUNUCUDA çizilip buraya hazır düğüm olarak geliyor
 * (alıştırma sayfası, MathContent). Geri bildirim de öyle: yalnızca
 * CEVAPLANMIŞ sorunun doğrusu ve çözümü sayfaya girer. Cevap gönderilince
 * eylem sayfayı aynı yanıtla yeniden çizdirir (refresh) ve geri bildirim
 * o zaman gelir.
 */

export interface PracticeChoiceView {
  id: string;
  label: string;
  content: ReactNode;
}

export interface PracticeFeedbackView {
  selectedChoiceId: string | null;
  isCorrect: boolean | null;
  correctChoiceId: string | null;
  errorLabel: string | null;
  errorAdvice: string | null;
  solution: ReactNode | null;
  /** Yanlış defteri: bu cevaptan sonra madde ne oldu (yalnızca tekrarda). */
  note?: string | null;
}

export interface PracticeQuestionView {
  id: string;
  order: number;
  topicName: string;
  stem: ReactNode;
  choices: PracticeChoiceView[];
  feedback: PracticeFeedbackView | null;
}

/** Kararın görünümü: ikon rengi, rozet rengi (kitin Badge'i), başlıktaki nokta. */
const VERDICT: Record<"correct" | "wrong" | "blank" | "open", { label: string; Icon: typeof CircleCheck; cls: string; rozet: BadgeColor; dot: string }> = {
  correct: { label: "Doğru", Icon: CircleCheck, cls: "text-success-600", rozet: "success", dot: "bg-success-500" },
  wrong: { label: "Yanlış", Icon: CircleX, cls: "text-error-600", rozet: "error", dot: "bg-error-500" },
  blank: { label: "Boş", Icon: CircleMinus, cls: "text-gray-500", rozet: "light", dot: "bg-gray-500" },
  open: { label: "Cevaplanmadı", Icon: CircleHelp, cls: "text-gray-400", rozet: "light", dot: "bg-gray-300" },
};

function verdictOf(q: PracticeQuestionView) {
  if (!q.feedback) return VERDICT.open;
  if (q.feedback.isCorrect === null) return VERDICT.blank;
  return q.feedback.isCorrect ? VERDICT.correct : VERDICT.wrong;
}

function ilkCevapsiz(questions: PracticeQuestionView[]): number {
  const i = questions.findIndex((q) => !q.feedback);
  return i === -1 ? 0 : i;
}

/**
 * Alıştırma ekranı — süre yok, her cevaptan sonra geri bildirim.
 *
 * Akış: şık seç → "Kontrol et" (ya da "Bilmiyorum") → doğrusu, hata tipi ve
 * çözüm → sonraki soru. Cevap kilitlidir: geri bildirimden sonra şıklar
 * dokunulmaz olur. Seçim iki adımlı, bilinçli: tek dokunuşla kilitlenen bir
 * cevap, yanlışlıkla dokunan öğrenciye çözümü erken gösterirdi.
 */
export function PracticeRunner({
  sessionId,
  title,
  subtitle,
  closed,
  exitHref,
  exitLabel,
  questions,
  summaryExtra,
}: {
  sessionId: string;
  title: string;
  subtitle?: string;
  /** Oturum kapandı (bitti ya da süresi doldu): yalnızca özet ve inceleme. */
  closed: boolean;
  exitHref: string;
  exitLabel: string;
  questions: PracticeQuestionView[];
  /** Özetin altındaki ek eylem (ör. "Bir benzerini daha çöz"). */
  summaryExtra?: ReactNode;
}) {
  const baslikId = useId();
  const herSeyCevapli = questions.every((q) => q.feedback);

  const [index, setIndex] = useState(() => ilkCevapsiz(questions));
  const [ozet, setOzet] = useState(() => closed || herSeyCevapli);
  const [secim, setSecim] = useState<Record<string, string | null>>({});
  const [hata, setHata] = useState<string | null>(null);
  const [oturumYok, setOturumYok] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = questions[index];
  const cevapli = Boolean(current?.feedback);
  const kilitli = cevapli || closed || pending;
  const secili = current ? (secim[current.id] ?? null) : null;

  // ── süre (yalnızca kayıt için; ekranda sayaç yok) ──────────
  const gosterildiRef = useRef(0);
  useEffect(() => {
    gosterildiRef.current = Date.now();
  }, [index]);

  // ── geri bildirim gelince odağı karara taşı ────────────────
  const kararRef = useRef<HTMLHeadingElement>(null);
  const oncekiCevapli = useRef(cevapli);
  useEffect(() => {
    if (cevapli && !oncekiCevapli.current) kararRef.current?.focus({ preventScroll: false });
    oncekiCevapli.current = cevapli;
  }, [cevapli, index]);

  const git = useCallback((i: number) => {
    setHata(null);
    setOzet(false);
    setIndex(i);
    window.scrollTo({ top: 0 });
  }, []);

  /** Sıradaki cevapsız soru; yoksa özet. */
  const sonraki = useCallback(() => {
    for (let k = 1; k <= questions.length; k++) {
      const j = (index + k) % questions.length;
      if (!questions[j].feedback && !closed) {
        git(j);
        return;
      }
    }
    setHata(null);
    setOzet(true);
    window.scrollTo({ top: 0 });
  }, [closed, git, index, questions]);

  const gonder = useCallback(
    (choiceId: string | null) => {
      if (!current || kilitli) return;
      setHata(null);
      const timeSpentMs = Math.min(24 * 3600_000, Math.max(0, Date.now() - gosterildiRef.current));
      startTransition(async () => {
        try {
          const r = await alistirmaCevaplaAction({ sessionId, questionId: current.id, choiceId, timeSpentMs });
          if (!r.ok) {
            if (r.oturumYok) setOturumYok(true);
            setHata(r.error ?? "Cevap kaydedilemedi.");
          }
        } catch {
          setHata("Bağlantı koptu, cevabın kaydedilmedi. İnternetin gelince tekrar dene.");
        }
      });
    },
    [current, kilitli, sessionId]
  );

  const sec = useCallback(
    (choiceId: string) => {
      if (!current || kilitli) return;
      setSecim((s) => ({ ...s, [current.id]: s[current.id] === choiceId ? null : choiceId }));
    },
    [current, kilitli]
  );

  // ── klavye: harfle seç, Enter ile kontrol et, → ile geç ────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (ozet || !current) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const hedef = e.target;
      if (hedef instanceof HTMLElement && (hedef.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(hedef.tagName))) {
        return;
      }
      if (cevapli) {
        if (e.key === "ArrowRight" || e.key === "Enter") {
          // Odak bir bağlantıdaysa Enter onun işi.
          if (e.key === "Enter" && hedef instanceof HTMLAnchorElement) return;
          e.preventDefault();
          sonraki();
        }
        return;
      }
      if (e.key === "Enter" && secili && !(hedef instanceof HTMLButtonElement)) {
        e.preventDefault();
        gonder(secili);
        return;
      }
      const key = e.key.toUpperCase();
      const sik = current.choices.find((c) => c.label === key);
      if (sik) {
        e.preventDefault();
        sec(sik.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cevapli, current, gonder, ozet, sec, secili, sonraki]);

  const cevaplanan = questions.filter((q) => q.feedback).length;
  const dogru = questions.filter((q) => q.feedback?.isCorrect === true).length;
  const sonSoru = questions.every((q, i) => i === index || q.feedback);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Üst çubuk: süre yok, yalnızca ilerleme. */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-3 sm:h-16 sm:gap-4 sm:px-6">
          <Link
            href={exitHref}
            aria-label={exitLabel}
            className="-ms-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="size-5" />
          </Link>
          <Logo className="hidden size-7 sm:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-theme-sm font-semibold text-gray-800">{title}</p>
            {subtitle ? <p className="truncate text-[11px] text-gray-500 sm:text-theme-xs">{subtitle}</p> : null}
          </div>
          {/* Telefonda noktalar başlığı sıkıştırıyor; orada sayaç ve özet listesi yeter. */}
          {questions.length > 1 ? (
            <ol className="hidden shrink-0 items-center gap-1 sm:flex" aria-label="Sorular">
              {questions.map((q, i) => {
                const v = verdictOf(q);
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => git(i)}
                      aria-label={`Soru ${i + 1}: ${v.label}`}
                      aria-current={!ozet && i === index ? "step" : undefined}
                      className={cn(
                        "flex size-7 cursor-pointer items-center justify-center rounded-full transition hover:bg-gray-100",
                        !ozet && i === index ? "ring-2 ring-brand-500 ring-offset-1 ring-offset-white" : ""
                      )}
                    >
                      <span className={cn("size-2.5 rounded-full", v.dot)} />
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : null}
          <span className="tabular shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-[12px] font-semibold text-gray-700 ring-1 ring-gray-200 ring-inset">
            {cevaplanan}/{questions.length}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-36 pt-5 sm:px-6 sm:pt-6 lg:pb-16">
        {oturumYok ? (
          <Alert variant="error" compact className="mb-4">
            Oturumun kapanmış.{" "}
            <Link href="/giris" className="inline-flex items-center gap-1 font-semibold text-error-700 underline">
              <LogIn className="size-3.5" /> Giriş yap
            </Link>
          </Alert>
        ) : null}

        {ozet ? (
          <Ozet
            questions={questions}
            closed={closed}
            dogru={dogru}
            cevaplanan={cevaplanan}
            exitHref={exitHref}
            exitLabel={exitLabel}
            onAc={git}
            extra={summaryExtra}
          />
        ) : current ? (
          <>
            <article
              key={current.id}
              aria-labelledby={baslikId}
              className="animate-rise rounded-2xl border border-gray-200 bg-white p-4 sm:p-8"
            >
              <div className="flex items-center gap-2">
                <h1
                  id={baslikId}
                  className="tabular flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500 px-2 font-display text-[13px] font-bold text-white sm:h-8 sm:min-w-8 sm:text-sm"
                >
                  <span className="sr-only">Soru </span>
                  {index + 1}
                  <span className="sr-only"> / {questions.length}</span>
                </h1>
                <span className="min-w-0 truncate rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-700 sm:py-1 sm:text-theme-xs">
                  {current.topicName}
                </span>
                <span className="ms-auto shrink-0 text-[11px] font-medium text-gray-500 sm:text-theme-xs">Süre yok</span>
              </div>

              <div className="mt-4 text-read leading-relaxed text-gray-800 sm:mt-5">{current.stem}</div>

              <div
                role={cevapli ? "list" : "radiogroup"}
                aria-label={`Soru ${index + 1} şıkları`}
                className="mt-5 space-y-2 sm:mt-6 sm:space-y-2.5"
              >
                {current.choices.map((c) => {
                  const fb = current.feedback;
                  if (fb) {
                    const dogruSik = c.id === fb.correctChoiceId;
                    const benim = c.id === fb.selectedChoiceId;
                    return (
                      <div
                        key={c.id}
                        role="listitem"
                        className={cn(
                          "flex min-h-[var(--tap-comfort)] items-center gap-3 rounded-xl border-2 px-3 py-3 sm:gap-4 sm:px-4",
                          dogruSik
                            ? "border-success-500 bg-success-50"
                            : benim
                              ? "border-error-300 bg-error-50"
                              : "border-transparent bg-gray-50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            dogruSik
                              ? "bg-success-600 text-white"
                              : benim
                                ? "bg-error-600 text-white"
                                : "bg-white text-gray-500 ring-1 ring-gray-200 ring-inset"
                          )}
                        >
                          {c.label}
                        </span>
                        <span className="min-w-0 flex-1 text-body text-gray-800 sm:text-base">{c.content}</span>
                        {dogruSik ? (
                          <Badge size="sm" color="success">
                            Doğru
                          </Badge>
                        ) : benim ? (
                          <Badge size="sm" color="error">
                            Seninki
                          </Badge>
                        ) : null}
                      </div>
                    );
                  }
                  const bu = secili === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={bu}
                      disabled={kilitli}
                      onClick={() => sec(c.id)}
                      className={cn(
                        "group flex w-full cursor-pointer touch-manipulation items-center gap-3 rounded-xl border-2 px-3 py-3 text-start transition sm:gap-4 sm:px-4",
                        "min-h-[var(--tap-comfort)] disabled:cursor-default",
                        bu
                          ? "border-brand-500 bg-brand-25"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 active:bg-gray-50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                          bu
                            ? "bg-brand-500 text-white"
                            : "bg-gray-100 text-gray-700 ring-1 ring-gray-300 ring-inset group-hover:ring-gray-400"
                        )}
                      >
                        {c.label}
                      </span>
                      <span className="min-w-0 flex-1 text-body text-gray-800 sm:text-base">{c.content}</span>
                      {bu ? <CircleCheck className="size-5 shrink-0 text-brand-500" /> : null}
                    </button>
                  );
                })}
              </div>

              {current.feedback ? (
                <GeriBildirim fb={current.feedback} choices={current.choices} kararRef={kararRef} />
              ) : closed ? (
                <p className="mt-5 rounded-xl bg-gray-50 px-3.5 py-3 text-theme-sm text-gray-500">
                  Alıştırma kapandı; bu soru cevaplanmadı. Çözümü, soruyu denemeden açılmaz.
                </p>
              ) : null}
            </article>

            {hata ? (
              <Alert variant="error" compact className="mt-4">
                {hata}
              </Alert>
            ) : null}

            {/* Masaüstü eylemler */}
            <div className="mt-5 hidden items-center justify-between gap-3 lg:flex">
              <p className="text-theme-xs text-gray-500">
                {cevapli ? "→ ya da Enter: sonraki" : "Harfle seç · Enter ile kontrol et"}
              </p>
              <Eylemler
                cevapli={cevapli}
                closed={closed}
                pending={pending}
                secili={secili}
                sonSoru={sonSoru}
                onGonder={gonder}
                onSonraki={sonraki}
              />
            </div>
          </>
        ) : null}
      </div>

      {/* Mobil alt çubuk — başparmak bölgesi */}
      {!ozet && current ? (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pt-2.5 sm:px-4">
            <Eylemler
              cevapli={cevapli}
              closed={closed}
              pending={pending}
              secili={secili}
              sonSoru={sonSoru}
              onGonder={gonder}
              onSonraki={sonraki}
              mobil
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Eylemler({
  cevapli,
  closed,
  pending,
  secili,
  sonSoru,
  onGonder,
  onSonraki,
  mobil = false,
}: {
  cevapli: boolean;
  closed: boolean;
  pending: boolean;
  secili: string | null;
  sonSoru: boolean;
  onGonder: (choiceId: string | null) => void;
  onSonraki: () => void;
  mobil?: boolean;
}) {
  if (cevapli || closed) {
    return (
      <Button
        onClick={onSonraki}
        className={mobil ? "flex-1" : undefined}
        startIcon={sonSoru || closed ? <ListChecks /> : undefined}
        endIcon={sonSoru || closed ? undefined : <ArrowRight />}
      >
        {sonSoru || closed ? "Özeti gör" : "Sonraki soru"}
      </Button>
    );
  }
  return (
    <div className={cn("flex gap-2", mobil && "w-full")}>
      <Button variant="outline" onClick={() => onGonder(null)} disabled={pending} className={mobil ? "flex-1" : undefined}>
        Bilmiyorum
      </Button>
      <Button
        onClick={() => onGonder(secili)}
        disabled={!secili}
        loading={pending}
        startIcon={<CircleCheck />}
        className={mobil ? "flex-[2]" : undefined}
      >
        {pending ? "Bakılıyor…" : "Kontrol et"}
      </Button>
    </div>
  );
}

function GeriBildirim({
  fb,
  choices,
  kararRef,
}: {
  fb: PracticeFeedbackView;
  choices: PracticeChoiceView[];
  kararRef: RefObject<HTMLHeadingElement | null>;
}) {
  const dogruHarf = choices.find((c) => c.id === fb.correctChoiceId)?.label ?? null;
  const ton = fb.isCorrect === true ? "ok" : fb.isCorrect === false ? "bad" : "neutral";
  const baslik =
    fb.isCorrect === true
      ? "Doğru."
      : fb.isCorrect === false
        ? `Yanlış. Doğrusu ${dogruHarf ?? "işaretli şık"}.`
        : `Boş bıraktın. Doğrusu ${dogruHarf ?? "işaretli şık"}.`;
  const Icon = fb.isCorrect === true ? CircleCheck : fb.isCorrect === false ? CircleX : CircleMinus;

  return (
    <section aria-live="polite" className="mt-5 space-y-3 sm:mt-6">
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-xl border px-3.5 py-3",
          ton === "ok" && "border-success-200 bg-success-50 text-success-700",
          ton === "bad" && "border-error-200 bg-error-50 text-error-700",
          ton === "neutral" && "border-gray-200 bg-gray-50 text-gray-700"
        )}
      >
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h2 ref={kararRef} tabIndex={-1} className="text-base font-semibold">
            {baslik}
          </h2>
          {fb.isCorrect === true ? (
            <p className="mt-0.5 text-theme-sm text-gray-600">Çözüme yine de göz at: yolun aynı mı?</p>
          ) : null}
          {fb.note ? <p className="mt-0.5 text-theme-sm text-gray-600">{fb.note}</p> : null}
        </div>
      </div>

      {/* Hata tipi: "yanlış yaptın" demekten çok daha işe yarar. */}
      {fb.errorLabel ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-3 text-theme-sm text-gray-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-600" aria-hidden />
          <div className="min-w-0">
            <p>
              Bu şık genellikle{" "}
              <strong className="font-semibold text-gray-800">{fb.errorLabel.toLocaleLowerCase("tr-TR")}</strong> yüzünden
              seçilir.
            </p>
            {fb.errorAdvice ? <p className="mt-1">{fb.errorAdvice}</p> : null}
          </div>
        </div>
      ) : null}

      {fb.solution ? (
        <div className="rounded-xl border border-brand-100 bg-brand-25 p-3.5 sm:p-5">
          <p className="flex items-center gap-2 text-theme-xs font-semibold tracking-wide text-brand-500 uppercase">
            <Lightbulb className="size-4" aria-hidden /> Çözüm
          </p>
          <div className="mt-2.5 text-body leading-relaxed text-gray-800">{fb.solution}</div>
        </div>
      ) : (
        <p className="text-theme-xs text-gray-500">Bu soruya henüz çözüm eklenmemiş.</p>
      )}
    </section>
  );
}

function Ozet({
  questions,
  closed,
  dogru,
  cevaplanan,
  exitHref,
  exitLabel,
  onAc,
  extra,
}: {
  questions: PracticeQuestionView[];
  closed: boolean;
  dogru: number;
  cevaplanan: number;
  exitHref: string;
  exitLabel: string;
  onAc: (i: number) => void;
  extra?: ReactNode;
}) {
  const tek = questions.length === 1;
  return (
    <div className="animate-rise space-y-4">
      <Card className="p-5 sm:p-7">
        <p className="text-theme-xs font-semibold tracking-[0.14em] text-brand-500 uppercase">Alıştırma özeti</p>
        <h1 className="tabular mt-1.5 font-display text-2xl font-semibold text-gray-800 sm:text-title-sm">
          {questions.length} soruda {dogru} doğru
        </h1>
        <p className="mt-1.5 text-theme-sm leading-relaxed text-gray-500">
          {cevaplanan < questions.length
            ? `${questions.length - cevaplanan} soru cevaplanmadan ${closed ? "kaldı" : "duruyor"}. `
            : ""}
          Alıştırma ölçüm değil: sonuçların gelişim grafiğine ve haftalık plana girmez.
        </p>
        {!tek ? (
          <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {questions.map((q, i) => {
              const v = verdictOf(q);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onAc(i)}
                    className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-3.5 py-2.5 text-start transition hover:bg-gray-50"
                  >
                    <v.Icon className={cn("size-5 shrink-0", v.cls)} aria-hidden />
                    <span className="tabular shrink-0 font-display text-theme-sm font-bold text-gray-800">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-500">{q.topicName}</span>
                    <Badge size="sm" color={v.rozet}>
                      {v.label}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {tek ? (
            <Button variant="outline" onClick={() => onAc(0)} className="max-sm:w-full">
              Soruya ve çözüme dön
            </Button>
          ) : null}
          <ButtonLink href={exitHref} endIcon={<ArrowRight />} className="max-sm:w-full">
            {exitLabel}
          </ButtonLink>
        </div>
      </Card>
      {extra}
    </div>
  );
}
