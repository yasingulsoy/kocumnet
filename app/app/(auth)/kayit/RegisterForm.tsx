"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { registerAction, type FormState } from "@/lib/actions/auth";
import { Alert, Button, Field, INPUT_CLASS } from "@/components/ui";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/cn";

const initial: FormState = {};

const GRADES = [
  { value: "GRADE_9", label: "9" },
  { value: "GRADE_10", label: "10" },
  { value: "GRADE_11", label: "11" },
  { value: "GRADE_12", label: "12" },
  { value: "GRADUATE", label: "Mezun" },
];

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

      {/* Sınıf: açılır liste yerine tek dokunuşluk seçenekler — telefonda
          açılır listeyle uğraşmak kayıt formunun en sinir bozucu kısmı. */}
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink">
          Sınıfın <span className="font-normal text-ink-faint">(isteğe bağlı)</span>
        </legend>
        <div className="grid grid-cols-5 gap-2">
          {GRADES.map((g) => (
            <label key={g.value} className="cursor-pointer">
              <input type="radio" name="grade" value={g.value} className="peer sr-only" />
              <span
                className={cn(
                  "flex h-10 items-center justify-center rounded-xl border border-line-strong text-sm font-medium text-ink-soft transition",
                  "peer-checked:border-brand peer-checked:bg-brand-wash peer-checked:text-brand",
                  "peer-focus-visible:ring-4 peer-focus-visible:ring-brand/15 hover:border-ink-faint"
                )}
              >
                {g.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* KVKK onayı zorunlu: required ile tarayıcı, sunucuda da ayrıca denetleniyor. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-sunk p-3.5 text-[13px] leading-relaxed text-ink-soft ring-1 ring-line">
        <input
          type="checkbox"
          name="kvkk"
          required
          className="mt-0.5 size-4 shrink-0 accent-[#1a5fb4]"
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
