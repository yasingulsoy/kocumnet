"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type ResetState } from "@/lib/actions/password-reset";
import { Alert, Button, Card, Field, INPUT_CLASS } from "@/components/ui";

const initial: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        {state.error ? (
          <div className="space-y-3">
            <Alert>{state.error}</Alert>
            <Link
              href="/sifremi-unuttum"
              className="block text-center text-sm font-semibold text-brand hover:underline"
            >
              Yeni bağlantı iste
            </Link>
          </div>
        ) : null}

        <Field label="Yeni parola" error={state.fields?.password} hint="En az 8 karakter.">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            autoFocus
            className={INPUT_CLASS}
            placeholder="••••••••"
          />
        </Field>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Kaydediliyor…" : "Parolayı değiştir"}
        </Button>
      </form>
    </Card>
  );
}
