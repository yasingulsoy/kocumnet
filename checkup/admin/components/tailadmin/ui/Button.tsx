/*
 * Uyarlama: TailAdmin Free (MIT) — components/ui/button/Button.tsx
 *
 * Farklar: varsayılan type="button" (TailAdmin'de tarayıcının "submit"i),
 * yükleniyor durumu, bağlantı biçimi (ButtonLink) ve buttonClass(). Boyutlar
 * TailAdmin'inkiler (sm 44px, md 48px) + panel araç çubukları için xs (36px).
 * Varyantlar: TailAdmin'in primary/outline'ına ek soft, ghost, danger,
 * danger-outline ve outline-light (koyu bantta — Card tone="dark" — ikincil
 * düğme: şeffaf zemin, beyaz yazı, yarı saydam beyaz çerçeve; birincil düğme
 * orada outline, yani beyaz). Koyu tema sınıfları yok.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "../cx";

export type ButtonVariant = "primary" | "outline" | "soft" | "ghost" | "danger" | "danger-outline" | "outline-light";
export type ButtonSize = "xs" | "sm" | "md";

const TABAN =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0";

const VARYANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:hover:bg-brand-500",
  outline: "bg-white text-gray-700 shadow-theme-xs ring-1 ring-gray-300 ring-inset hover:bg-gray-50 hover:text-gray-800",
  soft: "bg-brand-50 text-brand-500 hover:bg-brand-100",
  ghost: "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
  danger: "bg-error-600 text-white shadow-theme-xs hover:bg-error-700 disabled:hover:bg-error-600",
  "danger-outline": "bg-white text-error-700 shadow-theme-xs ring-1 ring-error-300 ring-inset hover:bg-error-50",
  "outline-light": "text-white ring-1 ring-white/40 ring-inset hover:bg-white/10",
};

const BOYUT: Record<ButtonSize, string> = {
  xs: "h-9 px-3 text-theme-sm [&_svg]:size-4",
  sm: "h-11 px-4 text-sm [&_svg]:size-[1.125rem]",
  md: "h-12 px-5 text-sm [&_svg]:size-5",
};

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Tam genişlik. */
  block?: boolean;
}

/** Düğme görünümü; <a>, <Link> ya da <label> için. */
export function buttonClass({ variant = "primary", size = "sm", block }: ButtonStyleProps = {}) {
  return cx(TABAN, VARYANT[variant], BOYUT[size], block && "w-full");
}

interface IcerikProps {
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

export interface ButtonProps extends ComponentProps<"button">, ButtonStyleProps, IcerikProps {
  /** Dönen halka gösterir, düğmeyi kilitler (aria-busy). */
  loading?: boolean;
}

export function Button({
  variant,
  size,
  block,
  startIcon,
  endIcon,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClass({ variant, size, block }), className)}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : startIcon}
      {children}
      {endIcon}
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & ButtonStyleProps & IcerikProps;

/** Düğme görünümlü site içi bağlantı (next/link). */
export function ButtonLink({ variant, size, block, startIcon, endIcon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={cx(buttonClass({ variant, size, block }), className)} {...props}>
      {startIcon}
      {children}
      {endIcon}
    </Link>
  );
}
