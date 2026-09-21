import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Marka işareti: onay işaretinin sağ kolu yükselen bir grafik çizgisine
 * dönüşüyor — "check-up" ile "gelişim" aynı çizgide. Küçük boyutta
 * (sekme ikonu, mobil üst çubuk) da okunsun diye tek hat, kalın çizgi.
 */
export function Logo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17305e" />
          <stop offset="0.55" stopColor="#1a5fb4" />
          <stop offset="1" stopColor="#0e90d5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <polyline
        points="7.5,17.5 12.5,22 19,14 24.5,8.5"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="8.5" r="2.2" fill="white" />
    </svg>
  );
}

export function Wordmark({
  className,
  tone = "dark",
  compact,
}: {
  className?: string;
  tone?: "dark" | "light";
  /** Yalnızca işaret + "Check-up" (dar mobil çubuk). */
  compact?: boolean;
}) {
  const light = tone === "light";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Logo />
      <span className="flex flex-col leading-none">
        {compact ? null : (
          <span
            className={cn(
              "font-display text-[15px] font-bold tracking-tight",
              light ? "text-white" : "text-brand-deep"
            )}
          >
            Koçum<span className={light ? "text-white/70" : "text-brand-bright"}>.Net</span>
          </span>
        )}
        <span
          className={cn(
            "font-semibold uppercase tracking-[0.16em]",
            compact ? "font-display text-sm tracking-tight normal-case" : "mt-1 text-[9.5px]",
            light ? "text-white/70" : compact ? "text-brand-deep" : "text-ink-faint"
          )}
        >
          {compact ? "Check-up" : "Matematik Check-up"}
        </span>
      </span>
    </span>
  );
}
