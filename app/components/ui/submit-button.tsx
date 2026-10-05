"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "./index";

/**
 * Sunucu eylemine giden formun gönder düğmesi: gönderim sürerken dönen simge
 * ve bekleme metni gösterir, ikinci dokunuşu engeller.
 *
 * Neden: test başlatan formlar soru seçimi yüzünden bir iki saniye sürüyor.
 * Düğme tepkisiz kalınca öğrenci ya tekrar dokunuyor (ikinci istek) ya da
 * "çalışmıyor" sanıp sayfadan çıkıyordu. Sunucu bileşeninin içindeki düz bir
 * <form action={...}> içinde de çalışır (useFormStatus en yakın formu okur).
 */
export function SubmitButton({
  children,
  pendingText = "Hazırlanıyor…",
  disabled,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { pendingText?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
