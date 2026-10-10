/*
 * Uyarlama: TailAdmin Free (MIT) — components/ui/alert/Alert.tsx
 *
 * Farklar: ileti `children` olarak da verilebilir (message hâlâ çalışır),
 * isteğe bağlı eylem alanı ve kapatma düğmesi, sıkı (compact) boyut,
 * lucide ikonları. Hata role="alert", diğerleri role="status". İkon ve
 * metin tonları açık zeminde okunur adımlarda (…-600 ikon, gray-600 metin).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cx } from "../cx";

export type AlertVariant = "success" | "error" | "warning" | "info";

const TON: Record<AlertVariant, { kutu: string; ikon: string; Ikon: typeof Info }> = {
  success: { kutu: "border-success-500 bg-success-50", ikon: "text-success-600", Ikon: CircleCheck },
  error: { kutu: "border-error-500 bg-error-50", ikon: "text-error-600", Ikon: CircleAlert },
  warning: { kutu: "border-warning-500 bg-warning-50", ikon: "text-warning-600", Ikon: TriangleAlert },
  info: { kutu: "border-blue-light-500 bg-blue-light-50", ikon: "text-blue-light-600", Ikon: Info },
};

export interface AlertProps {
  variant: AlertVariant;
  title?: ReactNode;
  /** TailAdmin uyumu; `children` ile aynı yere çizilir. */
  message?: ReactNode;
  children?: ReactNode;
  /** İletinin altında: düğmeler, bağlantılar. */
  action?: ReactNode;
  showLink?: boolean;
  linkHref?: string;
  linkText?: string;
  /** Verilirse sağ üstte kapatma düğmesi çıkar. */
  onClose?: () => void;
  closeLabel?: string;
  /** Daha az dolgu, küçük ikon: form içi uyarılar için. */
  compact?: boolean;
  className?: string;
}

export function Alert({
  variant,
  title,
  message,
  children,
  action,
  showLink = false,
  linkHref = "#",
  linkText = "Ayrıntılar",
  onClose,
  closeLabel = "Uyarıyı kapat",
  compact = false,
  className,
}: AlertProps) {
  const { kutu, ikon, Ikon } = TON[variant];
  const ileti = children ?? message;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cx("rounded-xl border", compact ? "p-3" : "p-4", kutu, className)}
    >
      <div className={cx("flex items-start", compact ? "gap-2.5" : "gap-3")}>
        <Ikon aria-hidden className={cx("shrink-0", compact ? "mt-px size-5" : "-mt-0.5 size-6", ikon)} />
        <div className="min-w-0 flex-1">
          {title ? <p className="mb-1 text-sm font-semibold text-gray-800">{title}</p> : null}
          {ileti ? <div className="text-sm leading-relaxed text-gray-600">{ileti}</div> : null}
          {showLink ? (
            <Link href={linkHref} className="mt-3 inline-block text-sm font-medium text-gray-600 underline hover:text-gray-800">
              {linkText}
            </Link>
          ) : null}
          {action ? <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-me-1 -mt-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-900/5 hover:text-gray-700"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
