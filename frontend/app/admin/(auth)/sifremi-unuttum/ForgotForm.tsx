"use client";

import { Send } from "lucide-react";
import { forgotAction } from "@/lib/admin/actions";
import { useFormAction } from "@/components/admin/useFormAction";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

export function ForgotForm() {
  const { state, pending, formProps } = useFormAction(forgotAction);

  if (state.ok) {
    return (
      <Alert variant="success" title="Bağlantı yola çıktı">
        {state.message} Posta birkaç dakika içinde gelmezse spam klasörüne bak.
      </Alert>
    );
  }

  return (
    <form {...formProps} className="space-y-6">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      <Field label="E-posta" error={state.fields?.email} required>
        <Input name="email" type="email" autoComplete="email" required autoFocus placeholder="ad@kocum.net" />
      </Field>
      <Button type="submit" block loading={pending} startIcon={<Send />}>
        {pending ? "Gönderiliyor…" : "Bağlantı gönder"}
      </Button>
    </form>
  );
}
