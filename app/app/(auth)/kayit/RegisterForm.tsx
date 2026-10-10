"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

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
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}

      <Field label="Ad soyad" error={state.fields?.name}>
        <Input
          name="name"
          type="text"
          autoComplete="name"
          required
          autoFocus
          defaultValue={state.values?.name}
          placeholder="Adın ve soyadın"
        />
      </Field>

      <Field label="E-posta" error={state.fields?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          placeholder="ornek@eposta.com"
        />
      </Field>

      <Field label="Parola" error={state.fields?.password} hint="En az 8 karakter.">
        <PasswordInput name="password" autoComplete="new-password" required minLength={8} placeholder="••••••••" />
      </Field>

      {/* KVKK onayı zorunlu: required ile tarayıcı, sunucuda da ayrıca denetleniyor.
          Kutunun tamamı etiket: telefonda dokunma alanı geniş. */}
      <Checkbox
        name="kvkk"
        required
        defaultChecked={state.values?.kvkk === "on"}
        wrapperClassName="w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5"
        label={
          <>
            <Link href="/gizlilik" target="_blank" className="text-brand-500 hover:underline">
              Aydınlatma metnini
            </Link>{" "}
            okudum.
          </>
        }
        description="18 yaşından küçüksem velimin bilgisi dahilinde kayıt oluyorum."
      />

      <Button type="submit" size="md" block loading={pending}>
        {pending ? "Hesap oluşturuluyor…" : "Hesap oluştur"}
      </Button>
    </form>
  );
}
