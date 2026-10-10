"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginAction } from "@/lib/admin/actions";
import { useFormAction } from "@/components/admin/useFormAction";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

export function LoginForm({ next }: { next?: string }) {
  // Yanlış parolada e-posta alanı silinmesin (useFormAction).
  const { state, pending, formProps } = useFormAction(loginAction);
  const [goster, setGoster] = useState(false);

  return (
    <form {...formProps} className="space-y-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="E-posta veya kullanıcı adı" required>
        <Input name="kimlik" type="text" autoComplete="username" required autoFocus placeholder="ad@kocum.net" />
      </Field>

      <Field
        label="Parola"
        required
        labelAction={
          <Link href="/admin/sifremi-unuttum" className="text-brand-500 hover:text-brand-600">
            Parolamı unuttum
          </Link>
        }
      >
        <Input
          name="parola"
          type={goster ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="••••••••"
          endSlot={
            <button
              type="button"
              onClick={() => setGoster((v) => !v)}
              aria-label={goster ? "Parolayı gizle" : "Parolayı göster"}
              aria-pressed={goster}
              className="flex h-full w-12 cursor-pointer items-center justify-center text-gray-500 transition hover:text-gray-700"
            >
              {goster ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          }
        />
      </Field>

      <Button type="submit" block loading={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
