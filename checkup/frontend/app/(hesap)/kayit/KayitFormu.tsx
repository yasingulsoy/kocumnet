"use client";

import Link from "next/link";
import { kayitOl } from "@/lib/eylemler/hesap";
import type { FormDurumu } from "@/lib/tipler";
import { useFormEylemi } from "@/components/form-eylemi";
import { FormIletisi } from "@/components/FormIletisi";
import { ParolaAlani } from "@/components/ParolaAlani";
import { Field, FieldError } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Button } from "@/components/tailadmin/ui/Button";

const BASLANGIC: FormDurumu = {};

export function KayitFormu() {
  const [durum, onSubmit, bekliyor] = useFormEylemi(kayitOl, BASLANGIC);
  const a = durum.alanlar ?? {};

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-5">
      <FormIletisi hata={durum.hata} />

      <Field label="Ad soyad" error={a.adSoyad} required>
        <Input name="adSoyad" autoComplete="name" required minLength={2} maxLength={80} />
      </Field>

      <Field label="E-posta" error={a.eposta} required>
        <Input name="eposta" type="email" autoComplete="email" inputMode="email" required spellCheck={false} />
      </Field>

      <Field label="Parola" hint="En az 8 karakter." error={a.parola} required>
        <ParolaAlani name="parola" autoComplete="new-password" required minLength={8} />
      </Field>

      <div>
        <Checkbox
          name="kvkkOnay"
          required
          aria-invalid={a.kvkkOnay ? true : undefined}
          aria-describedby={a.kvkkOnay ? "kvkk-hata" : undefined}
          label={
            <>
              <Link href="/gizlilik" target="_blank" className="text-brand-500 underline underline-offset-2 hover:text-brand-600">
                Gizlilik ve KVKK aydınlatma metnini
              </Link>{" "}
              okudum, kabul ediyorum.
            </>
          }
          description="Bilgilerin yalnızca hesabın, check-up'ların ve raporların için kullanılır."
        />
        {a.kvkkOnay ? <FieldError id="kvkk-hata">{a.kvkkOnay}</FieldError> : null}
      </div>

      <Button type="submit" size="md" block loading={bekliyor}>
        Kayıt ol
      </Button>
    </form>
  );
}
