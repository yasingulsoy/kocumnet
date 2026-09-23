"use client";

import { useActionState } from "react";
import { Loader2, Play } from "lucide-react";
import { startCheckupAction, type StartState } from "@/lib/actions/checkup";
import { Alert, Button } from "@/components/ui";

const initial: StartState = {};

export function StartButton({
  slug,
  resume,
  durationMinutes,
}: {
  slug: string;
  resume: boolean;
  durationMinutes: number;
}) {
  const [state, formAction, pending] = useActionState(startCheckupAction, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="packageSlug" value={slug} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Play />}
        {pending ? "Hazırlanıyor…" : resume ? "Kaldığın yerden devam et" : "Teste başla"}
      </Button>
      {!resume ? (
        <p className="text-center text-xs text-ink-faint">
          Başladığında {durationMinutes} dakikalık süre işlemeye başlar.
        </p>
      ) : null}
    </form>
  );
}
