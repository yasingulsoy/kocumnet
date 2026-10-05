"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginAction } from "@/lib/admin/actions";
import { Button, Field, INPUT_CLASS, Notice } from "@/components/admin/ui";
import { useFormAction } from "@/components/admin/useFormAction";

export function LoginForm({ next }: { next?: string }) {
  // Yanlış parolada e-posta alanı silinmesin (useFormAction).
  const { state, pending, formProps } = useFormAction(loginAction);
  const [goster, setGoster] = useState(false);

  return (
    <form {...formProps} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? <Notice>{state.error}</Notice> : null}

      <Field label="E-posta veya kullanıcı adı">
        <input
          name="kimlik"
          type="text"
          autoComplete="username"
          required
          autoFocus
          className={INPUT_CLASS}
          placeholder="ad@kocum.net"
        />
      </Field>

      <Field label="Parola">
        <div className="relative">
          <input
            name="parola"
            type={goster ? "text" : "password"}
            autoComplete="current-password"
            required
            className={INPUT_CLASS + " pe-12"}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setGoster((v) => !v)}
            aria-label={goster ? "Parolayı gizle" : "Parolayı göster"}
            aria-pressed={goster}
            className="absolute inset-y-0 end-0 flex w-12 items-center justify-center text-ink-faint transition hover:text-ink"
          >
            {goster ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </Field>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>

      <p className="text-center text-caption">
        <Link href="/admin/sifremi-unuttum" className="font-medium text-brand hover:underline">
          Parolamı unuttum
        </Link>
      </p>
    </form>
  );
}
