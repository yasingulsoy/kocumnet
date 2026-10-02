import { useId } from "react";
import clsx from "clsx";

/**
 * Koçum.Net marka işareti — tanıtım sitesi ve check-up uygulamasıyla AYNI
 * çizim (design/logo/mark.svg).
 */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={clsx("size-8 shrink-0", className)}>
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
  /** Yalnızca işaret + "Panel" (dar kenar çubuğu). */
  compact?: boolean;
}) {
  const light = tone === "light";
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <Logo light={light} />
      {compact ? null : (
        <span className="flex flex-col leading-none">
          <span
            className={clsx(
              "font-display text-[15px] font-bold tracking-tight",
              light ? "text-white" : "text-brand-deep"
            )}
          >
            Koçum<span className={light ? "text-white/70" : "text-brand-bright"}>.Net</span>
          </span>
          <span
            className={clsx(
              "mt-1 text-[9.5px] font-semibold uppercase tracking-[0.16em]",
              light ? "text-white/70" : "text-ink-faint"
            )}
          >
            Check-up Paneli
          </span>
        </span>
      )}
    </span>
  );
}
