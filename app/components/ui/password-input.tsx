"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/tailadmin/form/Input";

/**
 * Göster/gizle düğmeli parola alanı — kitin Input'u, göz düğmesi `endSlot`ta.
 * Telefonda parolayı yanlış yazmak çok yaygın ve öğrenci neyi yanlış
 * yazdığını göremeyince "şifremi unuttum"a gidiyor; göz ikonu o turu
 * kurtarıyor. Field içinde etiket, ipucu ve hata bağlantısı kitten gelir.
 */
export function PasswordInput(props: Omit<InputProps, "type" | "endSlot">) {
  const [goster, setGoster] = useState(false);

  return (
    <Input
      {...props}
      type={goster ? "text" : "password"}
      endSlot={
        <button
          type="button"
          onClick={() => setGoster((g) => !g)}
          aria-label={goster ? "Parolayı gizle" : "Parolayı göster"}
          aria-pressed={goster}
          className="flex h-full w-12 cursor-pointer items-center justify-center text-gray-500 transition hover:text-gray-700"
        >
          {goster ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      }
    />
  );
}
