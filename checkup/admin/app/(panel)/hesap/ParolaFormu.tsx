"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { useBildirim } from "@/components/Bildirim";
import { parolaDegistir } from "@/lib/eylemler/oturum";

/** Kendi parolasını değiştirme. Alanlar denetimli; eylem elle çağrılır. */
export function ParolaFormu() {
  const [mevcut, setMevcut] = useState("");
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [hata, setHata] = useState<{ mesaj?: string; alanlar: Record<string, string> }>({ alanlar: {} });
  const [bekliyor, gecis] = useTransition();
  const bildir = useBildirim();

  function gonder(e: FormEvent) {
    e.preventDefault();
    const alanlar: Record<string, string> = {};
    if (!mevcut) alanlar.mevcutParola = "Şu anki parolanızı yazın.";
    if (yeni.length < 8) alanlar.yeniParola = "En az 8 karakter.";
    else if (yeni === mevcut) alanlar.yeniParola = "Yeni parola eskisiyle aynı olamaz.";
    if (tekrar !== yeni) alanlar.tekrar = "İki parola aynı değil.";
    if (Object.keys(alanlar).length) return setHata({ alanlar });
    setHata({ alanlar: {} });
    gecis(async () => {
      const r = await parolaDegistir(mevcut, yeni);
      if (r.ok) {
        setMevcut("");
        setYeni("");
        setTekrar("");
        bildir.basari("Parolanız değiştirildi.");
      } else setHata({ mesaj: r.mesaj, alanlar: r.alanlar ?? {} });
    });
  }

  return (
    <form method="post" onSubmit={gonder} className="max-w-md space-y-5" noValidate>
      {hata.mesaj ? <Alert variant="error">{hata.mesaj}</Alert> : null}
      <Field label="Şu anki parola" required error={hata.alanlar.mevcutParola}>
        <Input type="password" value={mevcut} onChange={(e) => setMevcut(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="Yeni parola" required error={hata.alanlar.yeniParola}>
        <Input type="password" value={yeni} onChange={(e) => setYeni(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label="Yeni parola (tekrar)" required error={hata.alanlar.tekrar}>
        <Input type="password" value={tekrar} onChange={(e) => setTekrar(e.target.value)} autoComplete="new-password" />
      </Field>
      <Button type="submit" loading={bekliyor}>
        Parolayı değiştir
      </Button>
    </form>
  );
}
