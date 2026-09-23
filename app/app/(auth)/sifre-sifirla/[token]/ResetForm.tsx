"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { resetPasswordAction, type ResetState } from "@/lib/actions/password-reset";
import { Alert, Button, Field } from "@/components/ui";
import { PasswordInput } from "@/components/ui/password-input";

const initial: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <Alert>
          {state.error}{" "}
          <Link href="/sifremi-unuttum" className="font-semibold underline">
            Yeni bağlantı iste
          </Link>
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

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Kaydediliyor…" : "Parolayı değiştir"}
      </Button>
    </form>
  );
}
