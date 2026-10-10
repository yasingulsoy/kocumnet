"use client";

import { useActionState } from "react";
import { Play } from "lucide-react";
import { startCheckupAction, type StartState } from "@/lib/actions/checkup";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

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
      {state.error ? (
        <Alert variant="error" compact>
          {state.error}
        </Alert>
      ) : null}
      {/* Bekleme halkası ve kilit kitin Button'ında (loading): ikinci dokunuş istek açmaz. */}
      <Button type="submit" size="md" block loading={pending} startIcon={<Play aria-hidden />}>
        {pending ? "Hazırlanıyor…" : resume ? "Kaldığın yerden devam et" : "Teste başla"}
      </Button>
      {!resume ? (
        <p className="text-center text-theme-xs text-gray-500">
          Başladığında {durationMinutes} dakikalık süre işlemeye başlar.
        </p>
      ) : null}
    </form>
  );
}
