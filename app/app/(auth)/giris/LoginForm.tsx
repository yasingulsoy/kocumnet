"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

const initial: FormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="E-posta" error={state.fields?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          // Yanlış parolada e-posta silinmesin (React 19 formu sıfırlıyor).
          defaultValue={state.values?.email}
          placeholder="ornek@eposta.com"
        />
      </Field>

      <Field
        label="Parola"
        error={state.fields?.password}
        labelAction={
          <Link href="/sifremi-unuttum" className="font-medium text-brand-500 hover:text-brand-600">
            Unuttum
          </Link>
        }
      >
        <PasswordInput name="password" autoComplete="current-password" required placeholder="••••••••" />
      </Field>

      <Button type="submit" size="md" block loading={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
