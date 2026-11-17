"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import { adSoyadGuncelle, hesabiSil, parolaDegistir } from "@/lib/eylemler/profil";
import type { FormDurumu } from "@/lib/tipler";
import { useFormEylemi } from "@/components/form-eylemi";
import { FormIletisi } from "@/components/FormIletisi";
import { ParolaAlani } from "@/components/ParolaAlani";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Button } from "@/components/tailadmin/ui/Button";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";

const BASLANGIC: FormDurumu = {};

export function AdSoyadFormu({ adSoyad }: { adSoyad: string }) {
  const [durum, onSubmit, bekliyor] = useFormEylemi(adSoyadGuncelle, BASLANGIC);
  return (
    <form method="post" onSubmit={onSubmit} className="max-w-md space-y-4">
      <FormIletisi hata={durum.hata} basari={durum.basari} />
      <Field label="Ad soyad" error={durum.alanlar?.adSoyad} required>
        <Input name="adSoyad" defaultValue={adSoyad} autoComplete="name" required minLength={2} maxLength={80} />
      </Field>
      <Button type="submit" loading={bekliyor} startIcon={<Save />}>
        Kaydet
      </Button>
    </form>
  );
}

export function ParolaFormu({ eposta }: { eposta: string }) {
  const [durum, onSubmit, bekliyor] = useFormEylemi(parolaDegistir, BASLANGIC);
  const form = useRef<HTMLFormElement>(null);
  const a = durum.alanlar ?? {};

  // Parola değişince alanlar temizlensin (hata dönünce yazılanlar kalır).
  useEffect(() => {
    if (durum.basari) form.current?.reset();
  }, [durum]);

  return (
    <form ref={form} method="post" onSubmit={onSubmit} className="max-w-md space-y-4">
      {/* Parola yöneticisi yeni parolayı doğru hesaba kaydetsin. */}
      <input type="email" value={eposta} autoComplete="username" readOnly hidden />
      <FormIletisi hata={durum.hata} basari={durum.basari} />
      <Field label="Şu anki parola" error={a.mevcutParola} required>
        <ParolaAlani name="mevcutParola" autoComplete="current-password" required />
      </Field>
      <Field label="Yeni parola" hint="En az 8 karakter." error={a.yeniParola} required>
        <ParolaAlani name="yeniParola" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Yeni parola (tekrar)" error={a.yeniParolaTekrar} required>
        <ParolaAlani name="yeniParolaTekrar" autoComplete="new-password" required minLength={8} />
      </Field>
      <Button type="submit" loading={bekliyor} startIcon={<Save />}>
        Parolayı değiştir
      </Button>
    </form>
  );
}

/**
 * Hesap silme: parola ister, sonra onay penceresi. Onaylanınca eylem
 * hesabı siler, çerezi temizler ve ana sayfaya gider.
 */
export function HesapSilmeFormu() {
  const [durum, gonder, bekliyor] = useActionState(hesabiSil, BASLANGIC);
  const [onayPenceresi, onayla] = useConfirm();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const veri = new FormData(e.currentTarget);
    const tamam = await onayla({
      title: "Hesabın silinsin mi?",
      description: "Hesabın, bütün check-up'ların ve raporların kalıcı olarak silinir. Bu işlem geri alınamaz.",
      confirmLabel: "Evet, hesabımı sil",
      cancelLabel: "Vazgeç",
      tone: "danger",
    });
    if (!tamam) return;
    startTransition(() => gonder(veri));
  }

  return (
    <>
      {onayPenceresi}
      <form method="post" onSubmit={onSubmit} className="max-w-md space-y-4">
        <FormIletisi hata={durum.hata} />
        <Field label="Parolan" hint="Silmek için parolanı yeniden yaz." error={durum.alanlar?.parola} required>
          <ParolaAlani name="parola" autoComplete="current-password" required />
        </Field>
        <Button type="submit" variant="danger" loading={bekliyor} startIcon={<Trash2 />}>
          Hesabımı sil
        </Button>
      </form>
    </>
  );
}
