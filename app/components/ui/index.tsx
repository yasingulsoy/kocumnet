import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export { Logo, Wordmark } from "./logo";

// ─────────────────────────────────────────────────────────────
// Buton
// ─────────────────────────────────────────────────────────────

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap " +
  "transition-all duration-150 active:scale-[0.98] " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:size-[1.1em] [&_svg]:shrink-0";

const VARIANTS = {
  primary: "bg-brand text-white shadow-brand hover:bg-brand-hover",
  secondary:
    "bg-surface text-ink border border-line-strong shadow-card hover:bg-surface-hover hover:border-line-strong",
  soft: "bg-brand-wash text-brand hover:bg-brand-wash-strong",
  ghost: "text-ink-soft hover:bg-surface-hover hover:text-ink",
  danger: "bg-bad-wash text-bad hover:bg-bad-fill hover:text-white",
  white: "bg-white text-brand-deep shadow-raised hover:bg-brand-wash",
} as const;

const SIZES = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export function buttonClass({ variant = "primary", size = "md", block }: ButtonStyleProps = {}) {
  return cn(BUTTON_BASE, VARIANTS[variant], SIZES[size], block && "w-full");
}

export function Button({
  variant,
  size,
  block,
  className,
  ...props
}: ComponentProps<"button"> & ButtonStyleProps) {
  return <button className={cn(buttonClass({ variant, size, block }), className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  block,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyleProps) {
  return <Link className={cn(buttonClass({ variant, size, block }), className)} {...props} />;
}

// ─────────────────────────────────────────────────────────────
// Kart
// ─────────────────────────────────────────────────────────────

export function Card({
  className,
  interactive,
  ...props
}: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-card",
        interactive &&
          "transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-wash text-brand [&_svg]:size-[18px]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Rozet
// ─────────────────────────────────────────────────────────────

const BADGE_TONES = {
  neutral: "bg-surface-sunk text-ink-soft ring-line",
  brand: "bg-brand-wash text-brand ring-brand/15",
  ok: "bg-ok-wash text-ok ring-ok/15",
  warn: "bg-warn-wash text-warn ring-warn/15",
  bad: "bg-bad-wash text-bad ring-bad/15",
  dark: "bg-brand-deep text-white ring-transparent",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        "[&_svg]:size-3",
        BADGE_TONES[tone],
        className
      )}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Uyarı
// ─────────────────────────────────────────────────────────────

const ALERT_TONES = {
  bad: { cls: "border-bad/20 bg-bad-wash text-bad", Icon: CircleAlert },
  warn: { cls: "border-warn/20 bg-warn-wash text-warn", Icon: TriangleAlert },
  ok: { cls: "border-ok/20 bg-ok-wash text-ok", Icon: CircleCheck },
  info: { cls: "border-brand/15 bg-brand-wash text-brand", Icon: Info },
} as const;

export function Alert({
  children,
  tone = "bad",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof ALERT_TONES;
  className?: string;
}) {
  const { cls, Icon } = ALERT_TONES[tone];
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm", cls, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Form alanı
// ─────────────────────────────────────────────────────────────

export const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink " +
  "shadow-card placeholder:text-ink-faint transition " +
  "focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

export function Field({
  label,
  error,
  hint,
  children,
  aside,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  /** Etiketin sağındaki bağlantı vb. ("Parolamı unuttum"). */
  aside?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {aside}
      </span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] text-bad">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────

/** Ad soyadın baş harfleri. Türkçe büyük harf dönüşümü: "i" → "İ". */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toLocaleUpperCase("tr");
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// İlerleme çubuğu
// ─────────────────────────────────────────────────────────────

const PROGRESS_TONES = {
  brand: "bg-brand",
  ok: "bg-ok-fill",
  warn: "bg-warn-fill",
  bad: "bg-bad-fill",
  muted: "bg-line-strong",
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
      className={cn("h-2 overflow-hidden rounded-full bg-surface-sunk ring-1 ring-inset ring-line", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", PROGRESS_TONES[tone])}
        style={{ width: v + "%" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sayfa başlığı
// ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[15px] text-ink-soft">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Boş durum
// ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-wash text-brand [&_svg]:size-6">
        {icon}
      </span>
      <h3 className="font-display mt-4 text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// İskelet (yükleniyor)
// ─────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-line/70", className)} />;
}

// ─────────────────────────────────────────────────────────────
// Sayı kartı
// ─────────────────────────────────────────────────────────────

export function Stat({
  icon,
  label,
  value,
  hint,
  tone = "brand",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "brand" | "ok" | "warn" | "bad";
}) {
  const tones = {
    brand: "bg-brand-wash text-brand",
    ok: "bg-ok-wash text-ok",
    warn: "bg-warn-wash text-warn",
    bad: "bg-bad-wash text-bad",
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
            tones[tone]
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-soft">{label}</p>
          <p className="font-display tabular text-xl font-bold leading-tight text-ink">{value}</p>
        </div>
      </div>
      {hint ? <div className="mt-3 text-xs text-ink-faint">{hint}</div> : null}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Biçimlendirme
// ─────────────────────────────────────────────────────────────

export function trNumber(n: number, digits = 2) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function trDate(d: Date, withYear = true) {
  return d.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
}
