"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/input/Checkbox.tsx
 *
 * TailAdmin'inki yalnızca denetimliydi (checked + onChange(boolean)) ve tik
 * simgesini `checked` prop'una göre çiziyordu. Burada yerel onay kutusu:
 * name/defaultChecked ile formda çalışır, tik CSS'le (peer-checked) çizilir.
 * `indeterminate`: bir kısmı seçili ("hepsini seç" kutusu). Etiket yoksa
 * aria-label ver. Odak çerçevesi tokens.css'in genel :focus-visible'ı.
 */
import { useCallback, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { cx } from "../cx";

export interface CheckboxProps extends Omit<ComponentProps<"input">, "type" | "size"> {
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  /** Etiketli sürümde dış <label>'a ek sınıf. */
  wrapperClassName?: string;
}

export function Checkbox({ label, description, indeterminate = false, wrapperClassName, className, disabled, ref, ...props }: CheckboxProps) {
  const yerel = useRef<HTMLInputElement | null>(null);

  // Dışarıdan verilen ref ile kendi ref'imizi birleştir (indeterminate DOM özelliği için).
  const bagla = useCallback(
    (d: HTMLInputElement | null) => {
      yerel.current = d;
      if (typeof ref === "function") ref(d);
      else if (ref) ref.current = d;
    },
    [ref]
  );

  useEffect(() => {
    if (yerel.current) yerel.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const kutu = (
    <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        ref={bagla}
        disabled={disabled}
        className={cx(
          "peer size-5 shrink-0 cursor-pointer appearance-none rounded-md border border-gray-300 bg-white transition",
          "checked:border-brand-500 checked:bg-brand-500 indeterminate:border-brand-500 indeterminate:bg-brand-500",
          "hover:border-gray-400 checked:hover:border-brand-600 checked:hover:bg-brand-600",
          "disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:checked:bg-gray-300",
          className
        )}
        {...props}
      />
      <Check aria-hidden strokeWidth={3} className="pointer-events-none absolute hidden size-3.5 text-white peer-checked:block" />
      <Minus aria-hidden strokeWidth={3} className="pointer-events-none absolute hidden size-3.5 text-white peer-indeterminate:block" />
    </span>
  );

  if (!label) return kutu;

  return (
    <label
      className={cx(
        "inline-flex items-start gap-3",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        wrapperClassName
      )}
    >
      <span className="mt-px flex">{kutu}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {description ? <span className="mt-0.5 block text-theme-xs text-gray-500">{description}</span> : null}
      </span>
    </label>
  );
}
