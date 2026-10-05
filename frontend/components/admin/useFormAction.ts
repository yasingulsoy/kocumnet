"use client";

import { startTransition, useActionState, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { unstable_rethrow } from "next/navigation";
import type { FormState } from "@/lib/admin/types";

/**
 * Sunucu action'ına bağlı form — HATADA YAZILANLAR SİLİNMEZ.
 *
 * React 19, `<form action={fn}>` ile gönderilen formu action bittikten sonra
 * KOŞULSUZ sıfırlar (requestFormReset): action hata döndürse bile bütün
 * kontrolsüz alanlar varsayılan değerine döner. Blog editöründe bu, "adres
 * kullanılıyor" ya da "oturum kapanmış" cevabından sonra başlığın, özetin,
 * meta alanlarının ve seçilen kapağın sessizce eski hâline dönmesi demekti.
 *
 * Burada form `onSubmit` ile gönderilir; React sıfırlamaz. Ayrıca:
 *  · `sifirlaBasarida`: başarıda temizlenecek formlar (parola, davet);
 *  · `dogrula`: göndermeden önce istemcide son denetim (ör. toplam boyut);
 *  · action FIRLATIRSA (ağ kopması, gövde sınırı) sayfa hata ekranına
 *    düşmez, form hatayı gösterir ve yazılanlar yerinde kalır. Next'in
 *    yönlendirmeleri (redirect) yine Next'e bırakılır.
 *
 * Kullanım:
 *   const { state, pending, formProps } = useFormAction(saveAction);
 *   <form {...formProps}>…</form>
 */
export function useFormAction(
  action: (prev: FormState, fd: FormData) => Promise<FormState>,
  {
    sifirlaBasarida = false,
    dogrula,
  }: { sifirlaBasarida?: boolean; dogrula?: (fd: FormData) => string | null } = {}
) {
  const korumali = useCallback(
    async (onceki: FormState, fd: FormData): Promise<FormState> => {
      try {
        return await action(onceki, fd);
      } catch (e) {
        unstable_rethrow(e);
        console.error("[admin form]", e);
        return {
          error:
            "İşlem tamamlanamadı: sunucuya ulaşılamadı ya da gönderilen veri çok büyük. Yazdıkların duruyor; biraz sonra tekrar dene.",
        };
      }
    },
    [action]
  );
  const [state, dispatch, pending] = useActionState(korumali, {} as FormState);
  const [yerelHata, setYerelHata] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (sifirlaBasarida && state.ok) formRef.current?.reset();
  }, [state, sifirlaBasarida]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    // Basılan düğmenin name/value'su da gitsin ("Yayınla" / "Taslağa al").
    // FormData(form, submitter) eski Safari'de yok; elle eklemek her yerde çalışır.
    const gonderen = (e.nativeEvent as SubmitEvent).submitter;
    if (gonderen instanceof HTMLButtonElement && gonderen.name) fd.set(gonderen.name, gonderen.value);
    const hata = dogrula ? dogrula(fd) : null;
    setYerelHata(hata);
    if (hata) return;
    startTransition(() => dispatch(fd));
  }

  return {
    state: yerelHata ? ({ error: yerelHata } as FormState) : state,
    pending,
    formRef,
    formProps: { ref: formRef, onSubmit },
  };
}
