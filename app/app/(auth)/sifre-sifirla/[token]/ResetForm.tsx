"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetState } from "@/lib/actions/password-reset";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/tailadmin/form/Field";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";

const initial: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <Alert
          variant="error"
          action={
            <ButtonLink href="/sifremi-unuttum" variant="outline" size="xs">
              Yeni bağlantı iste
            </ButtonLink>
          }
        >
          {state.error}
        </Alert>
      ) : null}

      <Field label="Yeni parola" error={state.fields?.password} hint="En az 8 karakter.">
        <PasswordInput
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          placeholder="••••••••"
        />
      </Field>

      <Button type="submit" size="md" block loading={pending}>
        {pending ? "Kaydediliyor…" : "Parolayı değiştir"}
      </Button>
    </form>
  );
}
