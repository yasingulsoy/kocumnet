import { useId } from "react";
import { cn } from "@/components/ui";

/*
 * Koçum.Net marka işareti.
 *
 * K'nın üst kolu yükselen bir çizgiye dönüşüp ucunda bir noktayla bitiyor:
 * koç yön gösterir ve yükseltir. Kaynak çizim design/logo/mark.svg —
 * check-up uygulaması ve yönetim paneli aynı yolları kullanır, üç yüzeyde
 * tek işaret.
 *
 * `light`: koyu/gradyan zemin üstünde — kare yarı saydam beyaz, gradyan yok.
 */
export function LogoMark({ className, light }: { className?: string; light?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-9 shrink-0", className)}>
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

/**
 * İşaret + yazı kilitlenmesi. ".Net" camgöbeği: nokta alan adının parçası,
 * marka adı "Koçum Net" değil "Koçum.Net".
 */
export function Wordmark({
  className,
  tone = "dark",
  size = "md",
}: {
  className?: string;
  tone?: "dark" | "light";
  size?: "md" | "lg";
}) {
  const light = tone === "light";
  return (
    <span className={cn("inline-flex items-center", size === "lg" ? "gap-3" : "gap-2.5", className)}>
      <LogoMark light={light} className={size === "lg" ? "size-11" : "size-9"} />
      <span
        className={cn(
          "font-display font-bold leading-none tracking-tight",
          size === "lg" ? "text-[1.375rem]" : "text-[1.125rem]",
          light ? "text-white" : "text-brand-deep"
        )}
      >
        Koçum
        <span className={light ? "text-white/70" : "text-brand-bright"}>.Net</span>
      </span>
    </span>
  );
}
