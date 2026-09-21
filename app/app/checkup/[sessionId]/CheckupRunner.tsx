"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { saveAnswerAction, submitCheckupAction } from "@/lib/actions/checkup";
import { Alert, Button } from "@/components/ui";

export interface RunnerChoice {
  id: string;
  label: string;
  content: ReactNode;
}

export interface RunnerQuestion {
  id: string;
  order: number;
  topicName: string;
  stem: ReactNode;
  choices: RunnerChoice[];
  selectedChoiceId: string | null;
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CheckupRunner({
  sessionId,
  packageName,
  questions,
  remainingMs,
}: {
  sessionId: string;
  packageName: string;
  questions: RunnerQuestion[];
  remainingMs: number;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.selectedChoiceId]))
  );
  const [remaining, setRemaining] = useState(remainingMs);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const current = questions[index];

  // ── süre ölçümü ────────────────────────────────────────────
  // Soru başına harcanan süre konu bazlı hız analizinin girdisi. Soru
  // değiştikçe biriktiriyoruz; tek soru ekranda olduğu için ölçüm temiz.
  const spentRef = useRef<Record<string, number>>({});
  // Date.now() render sırasında çağrılamaz (saflık kuralı) — bağlandıktan
  // sonra kuruyoruz. Efektler her kullanıcı etkileşiminden önce çalışır,
  // dolayısıyla ilk flushTime'a kadar değer hazır.
  const shownAtRef = useRef(0);

  useEffect(() => {
    shownAtRef.current = Date.now();
  }, []);

  const flushTime = useCallback(() => {
    const qid = questions[index]?.id;
    if (!qid) return;
    const now = Date.now();
    spentRef.current[qid] = (spentRef.current[qid] ?? 0) + (now - shownAtRef.current);
    shownAtRef.current = now;
  }, [index, questions]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= questions.length) return;
      flushTime();
      setIndex(next);
    },
    [flushTime, questions.length]
  );

  // ── geri sayım ─────────────────────────────────────────────
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      setRemaining(Math.max(0, remainingMs - (Date.now() - started)));
    }, 500);
    return () => clearInterval(id);
  }, [remainingMs]);

  const doSubmit = useCallback(() => {
    flushTime();
    startSubmit(async () => {
      const res = await submitCheckupAction(sessionId);
      // Yönlendirme olduysa buraya hiç gelinmez.
      if (res?.error) setError(res.error);
    });
  }, [flushTime, sessionId]);

  useEffect(() => {
    if (remaining > 0 || autoSubmittedRef.current) return;
    // Süre bitti: otomatik bitir. Sunucu zaten süreyi denetliyor, bu sadece
    // öğrenciyi boş ekranda bırakmamak için.
    autoSubmittedRef.current = true;
    doSubmit();
  }, [remaining, doSubmit]);

  // ── cevap kaydı ────────────────────────────────────────────
  const select = useCallback(
    (choiceId: string) => {
      const q = questions[index];
      // Aynı şıkka tekrar tıklamak işareti kaldırır — optik formda silgiyle
      // aynı davranış, öğrenci bunu bekliyor.
      const next = answers[q.id] === choiceId ? null : choiceId;

      setAnswers((prev) => ({ ...prev, [q.id]: next }));
      flushTime();

      void saveAnswerAction({
        sessionId,
        questionId: q.id,
        choiceId: next,
        timeSpentMs: Math.round(spentRef.current[q.id] ?? 0),
      }).then((res) => {
        if (!res.ok && res.error) setError(res.error);
      });
    },
    [answers, flushTime, index, questions, sessionId]
  );

  // ── klavye ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      const q = questions[index];
      const key = e.key.toUpperCase();
      const byLabel = q.choices.find((c) => c.label === key);
      const byNumber = /^[1-5]$/.test(key) ? q.choices[Number(key) - 1] : undefined;

      if (byLabel || byNumber) {
        e.preventDefault();
        select((byLabel ?? byNumber)!.id);
      } else if (e.key === "ArrowRight") {
        goTo(index + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(index - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, questions, select]);

  const answeredCount = Object.values(answers).filter(Boolean).length;
  const blankCount = questions.length - answeredCount;
  const lowTime = remaining < 120_000;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-32 pt-5">
      {/* Üst bilgi */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{packageName}</p>
          <p className="text-xs text-ink-faint">
            {answeredCount}/{questions.length} işaretlendi
          </p>
        </div>
        <div
          className={`rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${
            lowTime ? "bg-bad-wash text-[color:var(--bad)]" : "bg-surface-sunk text-ink"
          }`}
          aria-live={lowTime ? "polite" : "off"}
        >
          {formatClock(remaining)}
        </div>
      </div>

      {/* İlerleme */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-brand transition-[width] duration-300"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }}
        />
      </div>

      {/* Soru gezgini */}
      <nav aria-label="Soru listesi" className="mt-4 flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const marked = Boolean(answers[q.id]);
          const active = i === index;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={active ? "true" : undefined}
              aria-label={`Soru ${i + 1}${marked ? ", işaretli" : ", boş"}`}
              className={`h-8 w-8 rounded-md border font-mono text-xs font-semibold transition ${
                active
                  ? "border-brand bg-brand text-white"
                  : marked
                    ? "border-brand/30 bg-brand-wash text-brand"
                    : "border-line bg-surface text-ink-faint hover:border-line-strong"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {/* Soru */}
      <article className="mt-5 rounded-xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-2xl font-bold text-brand">{index + 1}</span>
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            {current.topicName}
          </span>
        </div>

        <div className="mt-4 text-[16px] text-ink">{current.stem}</div>

        <div role="radiogroup" aria-label="Şıklar" className="mt-6 space-y-2">
          {current.choices.map((choice) => {
            const selected = answers[current.id] === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => select(choice.id)}
                className={`flex w-full items-center gap-3.5 rounded-lg border px-4 py-3 text-start transition ${
                  selected
                    ? "border-brand bg-brand-wash"
                    : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunk"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    selected
                      ? "border-brand bg-brand text-white"
                      : "border-line-strong text-ink-soft"
                  }`}
                >
                  {choice.label}
                </span>
                <span className="min-w-0 flex-1 text-[15px] text-ink">{choice.content}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-xs text-ink-faint">
          İpucu: şıkları <kbd className="font-mono font-semibold">A–E</kbd> tuşlarıyla
          işaretleyebilir, <kbd className="font-mono font-semibold">←</kbd>{" "}
          <kbd className="font-mono font-semibold">→</kbd> ile sorular arasında gezebilirsin.
          Aynı şıkka tekrar basmak işareti kaldırır.
        </p>
      </article>

      {/* Alt çubuk */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <Button variant="ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
            ← Önceki
          </Button>

          {index === questions.length - 1 ? (
            <Button onClick={() => setConfirming(true)} disabled={submitting}>
              Testi bitir
            </Button>
          ) : (
            <Button onClick={() => goTo(index + 1)}>Sonraki →</Button>
          )}
        </div>
      </div>

      {/* Bitirme onayı */}
      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bitir-baslik"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-5"
        >
          <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
            <h2 id="bitir-baslik" className="font-display text-lg font-bold text-ink">
              Testi bitir
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {blankCount > 0 ? (
                <>
                  <strong className="font-semibold text-[color:var(--warn)]">
                    {blankCount} soru boş.
                  </strong>{" "}
                  Boş sorular net hesabına girmez ama konu haritanda eksik bilgi olarak sayılır.
                </>
              ) : (
                "Tüm soruları işaretledin."
              )}{" "}
              Bitirdikten sonra cevaplarını değiştiremezsin.
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)} className="flex-1">
                Geri dön
              </Button>
              <Button onClick={doSubmit} disabled={submitting} className="flex-1">
                {submitting ? "Hesaplanıyor…" : "Bitir"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
