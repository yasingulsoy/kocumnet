"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { registerAction, type FormState } from "@/lib/actions/auth";
import { Alert, Button, Field, INPUT_CLASS } from "@/components/ui";
import { PasswordInput } from "@/components/ui/password-input";

const initial: FormState = {};

/*
 * Sınıf burada SORULMUYOR: tanışma ekranı sınavı seçtirdikten sonra o sınava
 * uygun aşamaları soruyor ve bu alanın üstüne yazıyordu. Kayıtta ikinci kez
 * sormak yalnızca bir adım daha demekti; üstelik listede LGS adayının 8. sınıfı
 * yoktu, KPSS/ALES adayına 9-12 gösteriyordu.
 *
 * Hata dönüşünde ad, e-posta ve onay geri yazılıyor (React 19 formu sıfırlıyor);
 * parola bilerek geri yazılmaz.
 */
export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initial);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field label="Ad soyad" error={state.fields?.name}>
        <input
          name="name"
          type="text"
          autoComplete="name"
          required
          autoFocus
          defaultValue={state.values?.name}
          className={INPUT_CLASS}
          placeholder="Adın ve soyadın"
        />
      </Field>

      <Field label="E-posta" error={state.fields?.email}>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          className={INPUT_CLASS}
          placeholder="ornek@eposta.com"
        />
      </Field>

      <Field label="Parola" error={state.fields?.password} hint="En az 8 karakter.">
        <PasswordInput
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
        />
      </Field>

      {/* KVKK onayı zorunlu: required ile tarayıcı, sunucuda da ayrıca denetleniyor. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-sunk p-3.5 text-[13px] leading-relaxed text-ink-soft ring-1 ring-line">
        <input
          type="checkbox"
          name="kvkk"
          required
          defaultChecked={state.values?.kvkk === "on"}
          className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
        />
        <span>
          <Link href="/gizlilik" target="_blank" className="font-semibold text-brand hover:underline">
            Aydınlatma metnini
          </Link>{" "}
          okudum. 18 yaşından küçüksem velimin bilgisi dahilinde kayıt oluyorum.
        </span>
      </label>

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? "Hesap oluşturuluyor…" : "Hesap oluştur"}
      </Button>
    </form>
  );
}
