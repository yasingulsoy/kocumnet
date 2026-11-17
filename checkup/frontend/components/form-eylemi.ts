"use client";

import { startTransition, useActionState, useCallback, type FormEvent } from "react";

/**
 * Sunucu eylemini formdan gönderir, hata dönerse yazılanlar KAYBOLMAZ.
 *
 * React 19, <form action={…}> ile gönderilen formu eylem bitince sıfırlar:
 * doğrulama hatasında öğrencinin yazdığı ad, e-posta ve parolalar silinirdi.
 * Burada form onSubmit ile gönderiliyor (eylem bir geçiş içinde çağrılır):
 * React formu sıfırlamaz, parolaları sunucudan geri yollamak da gerekmez.
 * Form başarıyla temizlenmeli ise (parola değişti) çağıran reset() yapar.
 *
 * Formlara method="post" verin: JavaScript yüklenmeden gönderilirse
 * parolalar adres çubuğuna (GET) düşmesin.
 */
export function useFormEylemi<S>(eylem: (onceki: Awaited<S>, form: FormData) => Promise<S>, baslangic: Awaited<S>) {
  const [durum, gonder, bekliyor] = useActionState(eylem, baslangic);

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const gonderen = (e.nativeEvent as SubmitEvent).submitter;
      const veri = new FormData(e.currentTarget, gonderen instanceof HTMLElement ? gonderen : undefined);
      startTransition(() => gonder(veri));
    },
    [gonder]
  );

  return [durum, onSubmit, bekliyor] as const;
}
