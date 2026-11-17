/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/Label.tsx
 *
 * Fark: tailwind-merge yok; alt boşluk `spacing` ile kapatılır. Zorunlu (*)
 * ve "isteğe bağlı" işareti. Yıldız ekran okuyucudan gizli: alanın kendi
 * `required` özniteliği söyler.
 */
import type { ReactNode } from "react";
import { cx } from "../cx";
import { labelClass } from "./styles";

export interface LabelProps {
  htmlFor?: string;
  id?: string;
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
  optionalText?: string;
  /** false: alttaki 6px boşluk yok (etiket bir satırın içindeyse). */
  spacing?: boolean;
  className?: string;
}

export function Label({ htmlFor, id, children, required, optional, optionalText = "isteğe bağlı", spacing = true, className }: LabelProps) {
  return (
    <label htmlFor={htmlFor} id={id} className={cx(labelClass, spacing && "mb-1.5", className)}>
      {children}
      {required ? (
        <span aria-hidden className="ms-0.5 text-error-500">
          *
        </span>
      ) : null}
      {optional ? <span className="ms-1.5 font-normal text-gray-500">({optionalText})</span> : null}
    </label>
  );
}
