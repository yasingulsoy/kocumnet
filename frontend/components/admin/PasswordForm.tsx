"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { changePasswordAction } from "@/lib/admin/actions";
import { Button, Field, INPUT_CLASS, Notice } from "./ui";
import { useFormAction } from "./useFormAction";

export function PasswordForm() {
  // Başarıda alanlar temizlenir; hatada (ör. "mevcut parola hatalı") yeni parola silinmez.
  const { state, pending, formProps } = useFormAction(changePasswordAction, { sifirlaBasarida: true });

  return (
    <form {...formProps} className="space-y-4">
      {state.error ? <Notice>{state.error}</Notice> : null}
      {state.ok ? <Notice tone="ok">{state.message}</Notice> : null}
      <Field label="Mevcut parola">
        <input name="mevcut" type="password" autoComplete="current-password" required className={INPUT_CLASS} />
      </Field>
      <Field label="Yeni parola" hint="En az 10 karakter. Uzun bir cümle, karmaşık kısa bir paroladan daha güçlüdür.">
        <input name="yeni" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className={INPUT_CLASS} />
      </Field>
      <Field label="Yeni parola (tekrar)" error={state.fields?.yeni2}>
        <input name="yeni2" type="password" autoComplete="new-password" required minLength={10} maxLength={200} className={INPUT_CLASS} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {pending ? "Değiştiriliyor…" : "Parolayı değiştir"}
      </Button>
    </form>
  );
}
