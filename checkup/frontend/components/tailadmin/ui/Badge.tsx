/*
 * Uyarlama: TailAdmin Free (MIT) — components/ui/badge/Badge.tsx
 *
 * Aynı API (variant light|solid, size sm|md, color, startIcon, endIcon).
 * Fark: açık rozet metni bir koyu adım (…-700): TailAdmin'in …-600 metni
 * açık zeminde 4.5:1'in altında kalıyordu; dolu rozetler de beyaz metinle
 * 4.5:1'i geçen adımda. className yalnızca ek sınıf içindir.
 */
import type { ReactNode } from "react";
import { cx } from "../cx";

export type BadgeVariant = "light" | "solid";
export type BadgeSize = "sm" | "md";
export type BadgeColor = "primary" | "success" | "error" | "warning" | "info" | "light" | "dark";

const RENK: Record<BadgeVariant, Record<BadgeColor, string>> = {
  light: {
    primary: "bg-brand-50 text-brand-500",
    success: "bg-success-50 text-success-700",
    error: "bg-error-50 text-error-700",
    warning: "bg-warning-50 text-warning-700",
    info: "bg-blue-light-50 text-blue-light-700",
    light: "bg-gray-100 text-gray-700",
    dark: "bg-gray-500 text-white",
  },
  solid: {
    primary: "bg-brand-500 text-white",
    success: "bg-success-700 text-white",
    error: "bg-error-600 text-white",
    warning: "bg-warning-700 text-white",
    info: "bg-blue-light-700 text-white",
    light: "bg-gray-500 text-white",
    dark: "bg-gray-700 text-white",
  },
};

const BOYUT: Record<BadgeSize, string> = {
  sm: "text-theme-xs [&_svg]:size-3",
  md: "text-sm [&_svg]:size-3.5",
};

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  color?: BadgeColor;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ variant = "light", color = "primary", size = "md", startIcon, endIcon, children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-0.5 font-medium whitespace-nowrap",
        BOYUT[size],
        RENK[variant][color],
        className
      )}
    >
      {startIcon}
      {children}
      {endIcon}
    </span>
  );
}
