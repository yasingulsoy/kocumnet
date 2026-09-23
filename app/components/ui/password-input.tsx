"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { INPUT_CLASS } from "./index";

/**
 * Göster/gizle düğmeli parola alanı. Telefonda parolayı yanlış yazmak çok
 * yaygın ve öğrenci neyi yanlış yazdığını göremeyince "şifremi unuttum"a
 * gidiyor; göz ikonu o turu kurtarıyor.
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [goster, setGoster] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={goster ? "text" : "password"}
        className={cn(INPUT_CLASS, "pe-11", className)}
      />
      <button
        type="button"
        onClick={() => setGoster((g) => !g)}
        aria-label={goster ? "Parolayı gizle" : "Parolayı göster"}
        aria-pressed={goster}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-ink-faint transition hover:text-ink"
      >
        {goster ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}
