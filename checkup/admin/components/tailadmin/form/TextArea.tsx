"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — components/form/input/TextArea.tsx
 *
 * TailAdmin'inki denetimliydi (value + onChange(metin)) ve yer tutucu
 * dışında öznitelik geçirmiyordu. Burada yerel <textarea>: name,
 * defaultValue, ref, maxLength, dir… hepsi geçer. İpucu ve hata Field'da.
 */
import type { ComponentProps } from "react";
import { cx } from "../cx";
import { useFieldControl } from "./Field";
import { textareaClass } from "./styles";

export interface TextAreaProps extends ComponentProps<"textarea"> {
  error?: boolean;
  /** false: w-full yok; genişliği className verir. */
  fullWidth?: boolean;
}

export function TextArea({
  error,
  fullWidth = true,
  className,
  id,
  rows = 3,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: TextAreaProps) {
  const bag = useFieldControl({ id, "aria-describedby": describedBy, "aria-invalid": ariaInvalid, error });
  return <textarea rows={rows} {...bag} className={cx(textareaClass({ fullWidth }), className)} {...props} />;
}
