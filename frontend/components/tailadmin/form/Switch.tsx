/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/switch/Switch.tsx
 *
 * TailAdmin'in anahtarı bir <label>'a tıklama dinleyicisiydi: içinde input
 * yoktu, klavyeyle açılıp kapanmıyor, formla gitmiyordu. Burada gizli bir
 * onay kutusu (role="switch") + çizilmiş ray: Boşluk tuşu, name/defaultChecked
 * ve odak çerçevesi çalışır. Topuz RTL'de ters yöne kayar.
 */
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../cx";

export interface SwitchProps extends Omit<ComponentProps<"input">, "type" | "role" | "size"> {
  label?: ReactNode;
  description?: ReactNode;
  /** TailAdmin: mavi ya da gri. */
  color?: "blue" | "gray";
  wrapperClassName?: string;
}

export function Switch({ label, description, color = "blue", disabled, className, wrapperClassName, ...props }: SwitchProps) {
  return (
    <label
      className={cx(
        "inline-flex items-start gap-3 text-sm font-medium select-none",
        disabled ? "cursor-not-allowed text-gray-400" : "cursor-pointer text-gray-700",
        wrapperClassName
      )}
    >
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" disabled={disabled} className={cx("peer sr-only", className)} {...props} />
        <span
          aria-hidden
          className={cx(
            "block h-6 w-11 rounded-full bg-gray-200 transition duration-150 ease-linear",
            "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500",
            "peer-disabled:bg-gray-100",
            color === "blue" ? "peer-checked:bg-brand-500" : "peer-checked:bg-gray-800"
          )}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow-theme-sm transition duration-150 ease-linear peer-checked:translate-x-full rtl:peer-checked:-translate-x-full"
        />
      </span>
      {label || description ? (
        <span className="min-w-0 pt-0.5">
          {label ? <span className="block">{label}</span> : null}
          {description ? <span className="mt-0.5 block text-theme-xs font-normal text-gray-500">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
