"use client";

import { Loader2, Send } from "lucide-react";
import { forgotAction } from "@/lib/admin/actions";
import { Button, Field, INPUT_CLASS, Notice } from "@/components/admin/ui";
import { useFormAction } from "@/components/admin/useFormAction";

export function ForgotForm() {
  const { state, pending, formProps } = useFormAction(forgotAction);

  if (state.ok) {
    return (
      <Notice tone="ok" title="Bağlantı yola çıktı">
        {state.message} Posta birkaç dakika içinde gelmezse spam klasörüne bak.
      </Notice>
    );
  }

  return (
    <form {...formProps} className="space-y-5">
      {state.error ? <Notice>{state.error}</Notice> : null}
      <Field label="E-posta" error={state.fields?.email}>
        <input name="email" type="email" autoComplete="email" required autoFocus className={INPUT_CLASS} placeholder="ad@kocum.net" />
      </Field>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />}
        {pending ? "Gönderiliyor…" : "Bağlantı gönder"}
      </Button>
    </form>
  );
}
