"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction, type FormState } from "@/lib/actions/auth";
import { Alert, Button, Field, INPUT_CLASS } from "@/components/ui";
import { PasswordInput } from "@/components/ui/password-input";

const initial: FormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-5">
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

      <Field
        label="Parola"
        error={state.fields?.password}
        aside={
          <Link href="/sifremi-unuttum" className="text-[13px] font-medium text-brand hover:underline">
            Unuttum
          </Link>
        }
      >
        <PasswordInput
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
