"use client";

import { useActionState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { requestResetAction, type ResetState } from "@/lib/actions/password-reset";
import { Alert, Button, Field, INPUT_CLASS } from "@/components/ui";

const initial: ResetState = {};

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, initial);

  // Gönderildikten sonra formu değil sonucu göster — aynı adrese tekrar
  // tekrar istek atıp eski bağlantıları geçersiz kılmasın.
  if (state.ok) {
    return (
      <div className="rounded-2xl bg-ok-wash p-5 ring-1 ring-ok/15">
        <MailCheck className="size-6 text-ok" />
        <p className="mt-3 text-sm font-semibold text-ink">Gelen kutunu kontrol et</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{state.ok}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field label="E-posta" error={state.fields?.email}>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          className={INPUT_CLASS}
          placeholder="ornek@eposta.com"
        />
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
      </Button>
    </form>
  );
}
