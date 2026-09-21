"use client";

import { useActionState } from "react";
import { requestResetAction, type ResetState } from "@/lib/actions/password-reset";
import { Alert, Button, Card, Field, INPUT_CLASS } from "@/components/ui";

const initial: ResetState = {};

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, initial);

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.ok ? <Alert tone="ok">{state.ok}</Alert> : null}

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

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
        </Button>
      </form>
    </Card>
  );
}
