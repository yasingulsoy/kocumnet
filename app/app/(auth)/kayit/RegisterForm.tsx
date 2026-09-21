"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "@/lib/actions/auth";
import Link from "next/link";
import { Alert, Button, Card, Field, INPUT_CLASS } from "@/components/ui";

const initial: FormState = {};

const GRADES = [
  { value: "GRADE_9", label: "9. sınıf" },
  { value: "GRADE_10", label: "10. sınıf" },
  { value: "GRADE_11", label: "11. sınıf" },
  { value: "GRADE_12", label: "12. sınıf" },
  { value: "GRADUATE", label: "Mezun" },
];

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initial);

  return (
    <Card className="p-6">
      <form action={formAction} className="space-y-4">
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

        <Field
          label="Parola"
          error={state.fields?.password}
          hint="En az 8 karakter."
        >
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={INPUT_CLASS}
            placeholder="••••••••"
          />
        </Field>

        <Field label="Sınıf" error={state.fields?.grade} hint="İsteğe bağlı.">
          <select name="grade" className={INPUT_CLASS} defaultValue="">
            <option value="">Seçmek istemiyorum</option>
            {GRADES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>

        {/* KVKK onayı ZORUNLU: required ile tarayıcı da, sunucu da denetler. */}
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            name="kvkk"
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong"
          />
          <span>
            <Link href="/gizlilik" target="_blank" className="font-semibold text-brand hover:underline">
              Aydınlatma metnini
            </Link>{" "}
            okudum. 18 yaşından küçüksem velimin bilgisi dahilinde kayıt oluyorum.
          </span>
        </label>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Hesap oluşturuluyor…" : "Hesap oluştur"}
        </Button>
      </form>
    </Card>
  );
}
