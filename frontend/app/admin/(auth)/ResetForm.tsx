"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { resetAction } from "@/lib/admin/actions";
import { Button, Field, INPUT_CLASS, Notice } from "@/components/admin/ui";
import { useFormAction } from "@/components/admin/useFormAction";

/** Davet (ilk parola) ve sıfırlama aynı formu kullanır; fark yalnızca metinde. */
export function ResetForm({ token, email, ilkParola }: { token: string; email: string; ilkParola: boolean }) {
  const { state, pending, formProps } = useFormAction(resetAction);

  return (
    <form {...formProps} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state.error ? <Notice>{state.error}</Notice> : null}

      <Field label="Hesap">
        {/* Parola yöneticileri yeni parolayı doğru hesaba kaydetsin diye username. */}
        <input value={email} readOnly autoComplete="username" className={INPUT_CLASS + " bg-surface-sunk text-ink-soft"} />
      </Field>
      <Field label={ilkParola ? "Parola" : "Yeni parola"} hint="En az 10 karakter. Uzun bir cümle, karmaşık kısa bir paroladan daha güçlüdür.">
        <input name="parola" type="password" autoComplete="new-password" required minLength={10} maxLength={200} autoFocus className={INPUT_CLASS} />
      </Field>
      <Field label="Parola (tekrar)" error={state.fields?.parola2}>
        <input name="parola2" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className={INPUT_CLASS} />
      </Field>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {pending ? "Kaydediliyor…" : ilkParola ? "Parolamı belirle" : "Parolayı değiştir"}
      </Button>
    </form>
  );
}
