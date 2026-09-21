"use client";

import { useActionState } from "react";
import { startCheckupAction, type StartState } from "@/lib/actions/checkup";
import { Alert, Button } from "@/components/ui";

const initial: StartState = {};

export function PackageCard({
  slug,
  name,
  summary,
  questionCount,
  durationMinutes,
  examScope,
  topicCount,
  resumable,
  locked,
}: {
  slug: string;
  name: string;
  summary: string | null;
  questionCount: number;
  durationMinutes: number;
  examScope: string;
  topicCount: number;
  resumable: boolean;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(startCheckupAction, initial);

  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-5 transition hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[17px] font-bold leading-snug text-ink">{name}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {locked ? (
            <span className="rounded-md bg-surface-sunk px-2 py-1 text-[11px] font-semibold text-ink-faint">
              kilitli
            </span>
          ) : null}
          <span className="rounded-md bg-brand-wash px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
            {examScope}
          </span>
        </div>
      </div>

      {summary ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{summary}</p> : null}

      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-soft">
        <div className="flex items-center gap-1.5">
          <dt className="text-ink-faint">Soru</dt>
          <dd className="font-mono font-semibold text-ink">{questionCount}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-ink-faint">Süre</dt>
          <dd className="font-mono font-semibold text-ink">{durationMinutes} dk</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-ink-faint">Konu</dt>
          <dd className="font-mono font-semibold text-ink">{topicCount}</dd>
        </div>
      </dl>

      {state.error ? (
        <div className="mt-4">
          <Alert>{state.error}</Alert>
        </div>
      ) : null}

      {locked ? (
        <div className="mt-5 rounded-lg border border-line bg-surface-sunk px-4 py-3 text-center">
          <p className="text-sm font-semibold text-ink-soft">Bu paket kilitli</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Erişim için Koçum.Net ile iletişime geç.
          </p>
        </div>
      ) : (
        <form action={formAction} className="mt-5">
          <input type="hidden" name="packageSlug" value={slug} />
          <Button
            type="submit"
            disabled={pending}
            variant={resumable ? "ghost" : "primary"}
            className="w-full"
          >
            {pending ? "Hazırlanıyor…" : resumable ? "Devam et" : "Teste başla"}
          </Button>
        </form>
      )}
    </div>
  );
}
