"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — form-elements örneklerindeki
 * <Label> + <Input hint=…> kalıbı, tek sarmalayıcı.
 *
 * Etiket + alan + ipucu/hata. Kit alanları (Input, TextArea, Select,
 * FileInput, DateInput) bağlamdan kendi id'sini, aria-describedby'ını ve
 * hata varken aria-invalid'i alır: alan bir sarmalayıcının içinde olsa da
 * (parola göster düğmesi gibi) bağlantı kopmaz. Hata varken ipucu yerine
 * hata metni görünür.
 *
 *   <Field label="E-posta" hint="Giriş bununla yapılır" error={hatalar.email} required>
 *     <Input name="email" type="email" required />
 *   </Field>
 */
import { createContext, useContext, useId, type AriaAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Label } from "./Label";
import { errorClass, hintClass } from "./styles";

interface FieldBaglami {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldBaglami | null>(null);

/** Kit alanlarının içeride kullandığı bağlama kancası. */
export function useFieldControl(props: {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  error?: boolean;
}) {
  const b = useContext(FieldContext);
  const aciklama = [props["aria-describedby"], b?.describedBy].filter(Boolean).join(" ") || undefined;
  const gecersiz = props.error || b?.invalid ? true : props["aria-invalid"];
  return { id: props.id ?? b?.id, "aria-describedby": aciklama, "aria-invalid": gecersiz };
}

export function FieldHint({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cx(hintClass, className)}>
      {children}
    </p>
  );
}

export function FieldError({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cx(errorClass, className)}>
      {children}
    </p>
  );
}

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  /** "isteğe bağlı" yerine (başka dilde sayfa). */
  optionalText?: string;
  /** Alana kendi id'ni verdiysen. */
  htmlFor?: string;
  /** Etiket satırının sonunda (ör. "Parolamı unuttum" bağlantısı). */
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, required, optional, optionalText, htmlFor, labelAction, className, children }: FieldProps) {
  const otomatik = useId();
  const id = htmlFor ?? otomatik;
  const mesajId = `${id}-mesaj`;
  const mesaj = error || hint;

  return (
    <div className={className}>
      {label ? (
        labelAction ? (
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <Label htmlFor={id} required={required} optional={optional} optionalText={optionalText} spacing={false}>
              {label}
            </Label>
            <span className="text-sm">{labelAction}</span>
          </div>
        ) : (
          <Label htmlFor={id} required={required} optional={optional} optionalText={optionalText}>
            {label}
          </Label>
        )
      ) : null}
      <FieldContext.Provider value={{ id, describedBy: mesaj ? mesajId : undefined, invalid: Boolean(error) }}>
        {children}
      </FieldContext.Provider>
      {error ? <FieldError id={mesajId}>{error}</FieldError> : hint ? <FieldHint id={mesajId}>{hint}</FieldHint> : null}
    </div>
  );
}
