"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/input/InputField.tsx
 *
 * Yerel <input>'un bütün öznitelikleri geçer (name, defaultValue, ref…):
 * kontrolsüz formlar ve sunucu action'ları olduğu gibi çalışır.
 * TailAdmin'deki `hint` artık Field'da (aria-describedby bağlantısıyla).
 * `error` / `success` durumları öznitelikle çizilir; Field hata verince
 * aria-invalid kendiliğinden gelir. startIcon (arama büyüteci gibi) ve
 * endSlot (parola göster düğmesi gibi) için alan sarmalanır; o zaman
 * genişliği sarmalayıcı (wrapperClassName) belirler.
 */
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../cx";
import { useFieldControl } from "./Field";
import { inputClass } from "./styles";

export interface InputProps extends Omit<ComponentProps<"input">, "size"> {
  error?: boolean;
  success?: boolean;
  /** 36px yükseklik: süzgeç ve araç çubukları. */
  compact?: boolean;
  /** 48px yükseklik, büyük yazı (yazı başlığı). */
  large?: boolean;
  /** false: w-full yok; genişliği className verir (ikonsuz alanda). */
  fullWidth?: boolean;
  startIcon?: ReactNode;
  endSlot?: ReactNode;
  wrapperClassName?: string;
}

export function Input({
  error,
  success,
  compact = false,
  large = false,
  fullWidth = true,
  startIcon,
  endSlot,
  wrapperClassName,
  className,
  id,
  type = "text",
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const bag = useFieldControl({ id, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, error });
  const sarili = Boolean(startIcon || endSlot);
  const alan = (
    <input
      type={type}
      {...bag}
      data-state={success ? "success" : undefined}
      className={cx(
        inputClass({ compact, large, fullWidth: sarili || fullWidth }),
        startIcon && (compact ? "ps-9" : "ps-11"),
        endSlot && "pe-12",
        className
      )}
      {...props}
    />
  );
  if (!sarili) return alan;
  return (
    <div className={cx("relative", wrapperClassName)}>
      {startIcon ? (
        <span
          aria-hidden
          className={cx(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-500 [&_svg]:size-4.5",
            compact ? "start-3 [&_svg]:size-4" : "start-4"
          )}
        >
          {startIcon}
        </span>
      ) : null}
      {alan}
      {endSlot ? <span className="absolute inset-y-0 end-0 flex items-center">{endSlot}</span> : null}
    </div>
  );
}
