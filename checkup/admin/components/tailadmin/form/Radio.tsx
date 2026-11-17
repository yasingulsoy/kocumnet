/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/input/Radio.tsx + RadioSm.tsx
 *
 * TailAdmin'inki görünmez input + çizilmiş halkaydı ve yalnızca
 * denetimliydi. Burada yerel radyo (appearance-none): klavye ve form
 * davranışı tarayıcıdan, iç nokta CSS'le. `card`: etiket kart gibi
 * kenarlıklı kutu; seçilince marka renginde (rol seçimi gibi).
 * `size="sm"`: TailAdmin'in RadioSm'i.
 */
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../cx";

export interface RadioProps extends Omit<ComponentProps<"input">, "type" | "size"> {
  label: ReactNode;
  description?: ReactNode;
  card?: boolean;
  size?: "sm" | "md";
  wrapperClassName?: string;
}

export function Radio({ label, description, card = false, size = "md", disabled, className, wrapperClassName, ...props }: RadioProps) {
  const kucuk = size === "sm";
  return (
    <label
      className={cx(
        "flex items-start gap-3 select-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        card &&
          "rounded-xl border border-gray-200 p-3.5 transition hover:bg-gray-50 has-checked:border-brand-500 has-checked:bg-brand-25",
        wrapperClassName
      )}
    >
      <span className={cx("relative mt-px inline-flex shrink-0 items-center justify-center", kucuk ? "size-4" : "size-5")}>
        <input
          type="radio"
          disabled={disabled}
          className={cx(
            "peer shrink-0 cursor-pointer appearance-none rounded-full border-[1.25px] border-gray-300 bg-white transition",
            "checked:border-brand-500 checked:bg-brand-500 disabled:cursor-not-allowed disabled:bg-gray-100",
            kucuk ? "size-4" : "size-5",
            className
          )}
          {...props}
        />
        <span
          aria-hidden
          className={cx("pointer-events-none absolute hidden rounded-full bg-white peer-checked:block", kucuk ? "size-1.5" : "size-2")}
        />
      </span>
      <span className="min-w-0">
        <span className={cx("block font-medium text-gray-700", kucuk ? "text-theme-sm" : "text-sm")}>{label}</span>
        {description ? <span className="mt-0.5 block text-theme-xs leading-relaxed text-gray-500">{description}</span> : null}
      </span>
    </label>
  );
}
