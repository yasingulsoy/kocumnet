"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/tailadmin/ui/Button";

/**
 * Sunucu eylemine giden formun gönder düğmesi (kitin Button'ı): gönderim
 * sürerken dönen halka ve bekleme metni gösterir, ikinci dokunuşu engeller.
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
  startIcon,
  endIcon,
  ...props
}: Omit<ButtonProps, "type" | "loading"> & { pendingText?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button
      {...props}
      type="submit"
      loading={pending}
      disabled={disabled}
      startIcon={pending ? undefined : startIcon}
      endIcon={pending ? undefined : endIcon}
    >
      {pending ? pendingText : children}
    </Button>
  );
}
