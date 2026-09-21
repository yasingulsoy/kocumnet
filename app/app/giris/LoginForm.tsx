"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/lib/actions/auth";
import { Alert, Button, Card, Field, INPUT_CLASS } from "@/components/ui";

const initial: FormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
        {state.error ? <Alert>{state.error}</Alert> : null}

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

        <Field label="Parola" error={state.fields?.password}>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={INPUT_CLASS}
            placeholder="••••••••"
          />
        </Field>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </Button>
      </form>
    </Card>
  );
}
