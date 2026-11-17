"use client";

import Link from "next/link";
import { girisYap } from "@/lib/eylemler/hesap";
import type { FormDurumu } from "@/lib/tipler";
import { useFormEylemi } from "@/components/form-eylemi";
import { FormIletisi } from "@/components/FormIletisi";
import { ParolaAlani } from "@/components/ParolaAlani";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Button } from "@/components/tailadmin/ui/Button";

const BASLANGIC: FormDurumu = {};

export function GirisFormu({ donus }: { donus: string }) {
  const [durum, onSubmit, bekliyor] = useFormEylemi(girisYap, BASLANGIC);
  const a = durum.alanlar ?? {};

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="donus" value={donus} />
      <FormIletisi hata={durum.hata} />

      <Field label="E-posta" error={a.eposta} required>
        <Input name="eposta" type="email" autoComplete="email" inputMode="email" required spellCheck={false} />
      </Field>

      <Field
        label="Parola"
        error={a.parola}
        required
        labelAction={
          <Link href="/parolami-unuttum" className="font-medium text-brand-500 hover:text-brand-600 hover:underline">
            Parolamı unuttum
          </Link>
        }
      >
        <ParolaAlani name="parola" autoComplete="current-password" required />
      </Field>

      <Button type="submit" size="md" block loading={bekliyor}>
        Giriş yap
      </Button>
    </form>
  );
}
