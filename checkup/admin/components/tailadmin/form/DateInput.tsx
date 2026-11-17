"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/date-picker.tsx (görünüm)
 *
 * flatpickr yerine tarayıcının yerel tarih alanı, kitin görünümüyle:
 * sağda takvim simgesi, alana tıklayınca takvim açılır (showPicker).
 * Chrome'un kendi simgesi gizlenir; Firefox kendi simgesini çizdiği için
 * bizimki orada gizli (çift simge olmasın). Değer biçimi yyyy-aa-gg.
 * Aralık, çoklu seçim ya da Türkçe takvim başlığı gerekirse:
 * extras/datepicker (flatpickr).
 */
import type { ComponentProps, MouseEvent } from "react";
import { CalendarDays } from "lucide-react";
import { cx } from "../cx";
import { useFieldControl } from "./Field";
import { inputClass } from "./styles";

export interface DateInputProps extends Omit<ComponentProps<"input">, "type" | "size"> {
  type?: "date" | "datetime-local" | "month" | "time";
  error?: boolean;
  compact?: boolean;
  wrapperClassName?: string;
}

function takvimiAc(e: MouseEvent<HTMLInputElement>) {
  const alan = e.currentTarget;
  if (alan.readOnly || alan.disabled) return;
  try {
    alan.showPicker?.();
  } catch {
    /* eski tarayıcı ya da kullanıcı etkileşimi sayılmadı: yerel davranış kalır */
  }
}

export function DateInput({
  type = "date",
  error,
  compact = false,
  wrapperClassName,
  className,
  onClick,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: DateInputProps) {
  const bag = useFieldControl({ id, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, error });
  return (
    <div className={cx("relative", wrapperClassName)}>
      <input
        type={type}
        {...bag}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) takvimiAc(e);
        }}
        className={cx(
          inputClass({ compact }),
          "cursor-pointer pe-11 [&::-webkit-calendar-picker-indicator]:hidden",
          className
        )}
        {...props}
      />
      <CalendarDays
        aria-hidden
        className="pointer-events-none absolute end-3.5 top-1/2 size-5 -translate-y-1/2 text-gray-500 supports-[-moz-appearance:none]:hidden"
      />
    </div>
  );
}
