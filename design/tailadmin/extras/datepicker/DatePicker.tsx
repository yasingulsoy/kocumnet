"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/date-picker.tsx
 * Bağımlılık: flatpickr (MIT) — `npx npm@10.9.4 install flatpickr`
 *
 * Yerel tarih alanı (form/DateInput) yetmediğinde: aralık (range), çoklu
 * gün, Türkçe takvim başlığı, sınır tarihleri. Farklar:
 *  · Türkçe yerel ayar, görünen biçim gg.aa.yyyy; forma giden değer
 *    yyyy-aa-gg (flatpickr altInput: asıl alan gizli, `name` onda).
 *  · Field ile çalışır: etiket, ipucu ve hata görünen alana bağlanır.
 *  · onChange en son prop'u çağırır (TailAdmin'de her değişimde takvim
 *    baştan kuruluyordu).
 *  · Ok simgeleri TailAdmin'in StatisticsChart'ındaki SVG'ler.
 */
import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import { Turkish } from "flatpickr/dist/l10n/tr.js";
import type { Instance } from "flatpickr/dist/types/instance";
import type { DateOption, Hook } from "flatpickr/dist/types/options";
import { CalendarDays } from "lucide-react";
import { cx } from "../../cx";
import { useFieldControl } from "../../form/Field";
import { inputClass } from "../../form/styles";
import "flatpickr/dist/flatpickr.css";
import "./datepicker.css";

const GERI =
  '<svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 15L7.5 10L12.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ILERI =
  '<svg class="stroke-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 15L12.5 10L7.5 5" stroke="" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export interface DatePickerProps {
  id?: string;
  name?: string;
  mode?: "single" | "multiple" | "range" | "time";
  /** yyyy-aa-gg ya da Date; aralıkta iki değer. */
  defaultDate?: DateOption | DateOption[];
  onChange?: Hook;
  placeholder?: string;
  minDate?: DateOption;
  maxDate?: DateOption;
  /** Forma giden biçim (flatpickr biçim dizgesi). */
  dateFormat?: string;
  /** Görünen biçim. */
  displayFormat?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  "aria-describedby"?: string;
}

export function DatePicker({
  id,
  name,
  mode = "single",
  defaultDate,
  onChange,
  placeholder,
  minDate,
  maxDate,
  dateFormat = "Y-m-d",
  displayFormat = "d.m.Y",
  required,
  disabled,
  error,
  className,
  "aria-describedby": describedBy,
}: DatePickerProps) {
  const alan = useRef<HTMLInputElement>(null);
  const degisim = useRef(onChange);
  const bag = useFieldControl({ id, "aria-describedby": describedBy, error });
  // Kurulumu yalnızca gerçekten değişen ayarlar yeniler (dizi kimliği her çizimde değişir).
  const ilkTarih = JSON.stringify(defaultDate ?? null);
  const sinir = JSON.stringify([minDate ?? null, maxDate ?? null]);

  useEffect(() => {
    degisim.current = onChange;
  });

  useEffect(() => {
    const el = alan.current;
    if (!el) return;
    const [enAz, enCok] = JSON.parse(sinir) as [DateOption | null, DateOption | null];
    const fp: Instance = flatpickr(el, {
      mode,
      static: true,
      monthSelectorType: "static",
      dateFormat,
      altInput: true,
      altFormat: displayFormat,
      altInputClass: cx(inputClass(), "cursor-pointer pe-11"),
      locale: Turkish,
      defaultDate: JSON.parse(ilkTarih) ?? undefined,
      minDate: enAz ?? undefined,
      maxDate: enCok ?? undefined,
      prevArrow: GERI,
      nextArrow: ILERI,
      onChange: (tarihler, metin, ornek) => degisim.current?.(tarihler, metin, ornek),
    });
    // Etiket ve açıklama görünen alana bağlansın.
    const gorunen = fp.altInput;
    if (gorunen) {
      if (el.id) {
        gorunen.id = el.id;
        el.removeAttribute("id");
      }
      for (const ad of ["aria-describedby", "aria-invalid"]) {
        const v = el.getAttribute(ad);
        if (v) gorunen.setAttribute(ad, v);
      }
      if (required) gorunen.required = true;
    }
    return () => fp.destroy();
  }, [mode, dateFormat, displayFormat, ilkTarih, sinir, required]);

  return (
    <div className={cx("relative", className)}>
      <input ref={alan} {...bag} name={name} placeholder={placeholder} disabled={disabled} className={inputClass()} />
      <CalendarDays aria-hidden className="pointer-events-none absolute end-3.5 top-1/2 size-5 -translate-y-1/2 text-gray-500" />
    </div>
  );
}
