"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/input/FileInput.tsx
 *
 * Aynı görünüm (solda gri "Dosya seç" bölmesi); yerel <input type="file">
 * öznitelikleri geçer (name, accept, multiple, ref). Sürükle-bırak için
 * extras/dropzone (react-dropzone).
 */
import type { ComponentProps } from "react";
import { cx } from "../cx";
import { useFieldControl } from "./Field";

export interface FileInputProps extends Omit<ComponentProps<"input">, "type" | "size"> {
  error?: boolean;
}

export function FileInput({ error, className, id, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, ...props }: FileInputProps) {
  const bag = useFieldControl({ id, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, error });
  return (
    <input
      type="file"
      {...bag}
      className={cx(
        "h-11 w-full cursor-pointer overflow-hidden rounded-lg border border-gray-300 bg-white text-sm text-gray-500 shadow-theme-xs transition",
        "file:me-5 file:h-full file:cursor-pointer file:border-0 file:border-e file:border-solid file:border-gray-200 file:bg-gray-50 file:ps-3.5 file:pe-3 file:text-sm file:text-gray-700 hover:file:bg-gray-100",
        "focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden!",
        "aria-invalid:border-error-500 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}
