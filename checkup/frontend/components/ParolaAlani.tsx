"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/tailadmin/form/Input";

/** Göster/gizle düğmeli parola alanı. Field içinde kullanılır (etiket ve hata oradan). */
export function ParolaAlani(props: Omit<ComponentProps<typeof Input>, "type" | "endSlot">) {
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
          className="me-1 flex size-10 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        >
          {goster ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      }
    />
  );
}
