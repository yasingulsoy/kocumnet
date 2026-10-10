"use client";

import { KeyRound } from "lucide-react";
import { resetAction } from "@/lib/admin/actions";
import { useFormAction } from "@/components/admin/useFormAction";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

/** Davet (ilk parola) ve sıfırlama aynı formu kullanır; fark yalnızca metinde. */
export function ResetForm({ token, email, ilkParola }: { token: string; email: string; ilkParola: boolean }) {
  const { state, pending, formProps } = useFormAction(resetAction);

  return (
    <form {...formProps} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="Hesap">
        {/* Parola yöneticileri yeni parolayı doğru hesaba kaydetsin diye username. */}
        <Input value={email} readOnly autoComplete="username" />
      </Field>
      <Field
        label={ilkParola ? "Parola" : "Yeni parola"}
        hint="En az 10 karakter. Uzun bir cümle, karmaşık kısa bir paroladan daha güçlüdür."
        required
      >
        <Input name="parola" type="password" autoComplete="new-password" required minLength={10} maxLength={200} autoFocus />
      </Field>
      <Field label="Parola (tekrar)" error={state.fields?.parola2} required>
        <Input name="parola2" type="password" autoComplete="new-password" required minLength={10} maxLength={200} />
      </Field>
      <Button type="submit" block loading={pending} startIcon={<KeyRound />}>
        {pending ? "Kaydediliyor…" : ilkParola ? "Parolamı belirle" : "Parolayı değiştir"}
      </Button>
    </form>
  );
}
