"use client";

import { useMemo } from "react";
import { parolaSifirla } from "@/lib/eylemler/hesap";
import type { FormDurumu } from "@/lib/tipler";
import { useFormEylemi } from "@/components/form-eylemi";
import { FormIletisi } from "@/components/FormIletisi";
import { ParolaAlani } from "@/components/ParolaAlani";
import { Field } from "@/components/tailadmin/form/Field";
import { Button } from "@/components/tailadmin/ui/Button";

const BASLANGIC: FormDurumu = {};

export function YeniParolaFormu({ jeton }: { jeton: string }) {
  const eylem = useMemo(() => parolaSifirla.bind(null, jeton), [jeton]);
  const [durum, onSubmit, bekliyor] = useFormEylemi(eylem, BASLANGIC);
  const a = durum.alanlar ?? {};

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-5">
      <FormIletisi hata={durum.hata} />
      <Field label="Yeni parola" hint="En az 8 karakter." error={a.yeniParola} required>
        <ParolaAlani name="yeniParola" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Yeni parola (tekrar)" error={a.yeniParolaTekrar} required>
        <ParolaAlani name="yeniParolaTekrar" autoComplete="new-password" required minLength={8} />
      </Field>
      <Button type="submit" size="md" block loading={bekliyor}>
        Parolamı yenile
      </Button>
    </form>
  );
}
