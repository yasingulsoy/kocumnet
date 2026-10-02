import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Koçum.Net marka işareti — tanıtım sitesi ve yönetim paneliyle AYNI çizim
 * (design/logo/mark.svg). K'nın üst kolu yükselen bir çizgiye dönüşüp bir
 * noktayla bitiyor: koç yön gösterir ve yükseltir.
 *
 * Eskiden burada ayrı bir "✓" işareti vardı; üç yüzey üç farklı logo
 * taşıyordu. Ürün adı ("Check-up") artık yazıda, işarette değil.
 */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
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
      {light ? (
        <rect
          x="0.5"
          y="0.5"
          width="31"
          height="31"
          rx="8.5"
          fill="rgb(255 255 255 / 0.14)"
          stroke="rgb(255 255 255 / 0.28)"
        />
      ) : (
        <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      )}
      <g stroke="#ffffff" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M11 8.8 V 23.2" />
        <path d="M12.8 16 L 21.4 23.2" />
        <path d="M12.8 16 L 19.8 10.2" />
      </g>
      <circle cx="22.4" cy="8.6" r="2.4" fill="#ffffff" />
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
      <Logo light={light} />
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
