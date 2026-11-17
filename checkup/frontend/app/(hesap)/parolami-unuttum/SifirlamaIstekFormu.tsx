"use client";

import { parolaSifirlamaIste } from "@/lib/eylemler/hesap";
import type { FormDurumu } from "@/lib/tipler";
import { useFormEylemi } from "@/components/form-eylemi";
import { FormIletisi } from "@/components/FormIletisi";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Button } from "@/components/tailadmin/ui/Button";

const BASLANGIC: FormDurumu = {};

export function SifirlamaIstekFormu() {
  const [durum, onSubmit, bekliyor] = useFormEylemi(parolaSifirlamaIste, BASLANGIC);

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-5">
      <FormIletisi hata={durum.hata} basari={durum.basari} />
      <Field label="E-posta" error={durum.alanlar?.eposta} required>
        <Input name="eposta" type="email" autoComplete="email" inputMode="email" required spellCheck={false} />
      </Field>
      <Button type="submit" size="md" block loading={bekliyor}>
        {durum.basari ? "Yeniden gönder" : "Bağlantı gönder"}
      </Button>
    </form>
  );
}
