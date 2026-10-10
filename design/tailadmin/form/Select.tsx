"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/Select.tsx
 *
 * TailAdmin'inki denetimli bir sarmalayıcıydı (options + onChange(değer)).
 * Burada yerel <select>: name/defaultValue ile formda doğrudan çalışır,
 * seçenekler `options` ile ya da <option> çocuklarıyla verilir.
 * `placeholder`: seçilemeyen ilk seçenek; seçiliyken metin gri.
 */
import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "../cx";
import { useFieldControl } from "./Field";
import { selectClass } from "./styles";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentProps<"select">, "size"> {
  options?: SelectOption[];
  placeholder?: string;
  error?: boolean;
  compact?: boolean;
  wrapperClassName?: string;
}

export function Select({
  options,
  placeholder,
  error,
  compact = false,
  wrapperClassName,
  className,
  children,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: SelectProps) {
  const bag = useFieldControl({ id, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, error });
  return (
    <div className={cx("relative", wrapperClassName)}>
      <select {...bag} className={cx(selectClass({ compact }), className)} {...props}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={cx("pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-500", compact ? "end-2.5 size-4" : "end-3.5 size-5")}
      />
    </div>
  );
}
