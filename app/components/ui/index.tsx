import { cn } from "@/lib/cn";

/*
 * Uygulamaya özgü küçük parçalar. Düğme, kart, rozet, uyarı, form alanı,
 * pencere, sayı kartı ve grafikler TailAdmin kitinden gelir
 * (components/tailadmin/, kaynak design/tailadmin/ — README'si orada);
 * burada yalnızca kitte olmayanlar kaldı.
 */

export { Logo, LogoYazi, Wordmark } from "./logo";

// ─────────────────────────────────────────────────────────────
// İlerleme çubuğu (kitte yok)
// ─────────────────────────────────────────────────────────────

const PROGRESS_TONES = {
  brand: "bg-brand-500",
  ok: "bg-success-500",
  warn: "bg-warning-500",
  bad: "bg-error-500",
  muted: "bg-gray-300",
} as const;

export function Progress({
  value,
  tone = "brand",
  className,
  label,
}: {
  /** 0-100 */
  value: number;
  tone?: keyof typeof PROGRESS_TONES;
  className?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 overflow-hidden rounded-full bg-gray-200", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", PROGRESS_TONES[tone])}
        style={{ width: v + "%" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// İskelet (yükleniyor; kitte yok)
// ─────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-gray-200/70", className)} />;
}

// ─────────────────────────────────────────────────────────────
// Biçimlendirme
// ─────────────────────────────────────────────────────────────

export function trNumber(n: number, digits = 2) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function trDate(d: Date, withYear = true) {
  // Sunucu UTC'de çalışıyor; saat dilimi verilmezse gece 00:00-03:00 arası
  // testler bir önceki güne yazılıyordu.
  return d.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
}
