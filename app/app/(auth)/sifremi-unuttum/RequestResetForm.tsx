"use client";

import { useActionState } from "react";
import { requestResetAction, type ResetState } from "@/lib/actions/password-reset";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

const initial: ResetState = {};

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, initial);

  // Gönderildikten sonra formu değil sonucu göster — aynı adrese tekrar
  // tekrar istek atıp eski bağlantıları geçersiz kılmasın.
  if (state.ok) {
    return (
      <Alert variant="success" title="Gelen kutunu kontrol et">
        {state.ok}
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="E-posta" error={state.fields?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="ornek@eposta.com"
        />
      </Field>

      <Button type="submit" size="md" block loading={pending}>
        {pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
      </Button>
    </form>
  );
}
