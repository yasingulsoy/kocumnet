import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Check-up ekranlarının yapı taşları — TailAdmin'in görsel dilinde
 * (gri tonlar, brand-500, rounded-2xl kartlar, koyu tema).
 *
 * Hook kullanmıyorlar: hem sunucu hem istemci bileşenlerinden çağrılabilir.
 * Sınıf birleştirme için yalnızca clsx — tailwind-merge v2, TailAdmin'in
 * `text-theme-xs` gibi v4 belirteçlerini renk sanıp siliyor.
 */

/** Panel temasında `font-mono` tanımsız (`--font-*: initial`); açıkça veriyoruz. */
export const MONO = "[font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";

// ─── Kart ──────────────────────────────────────────────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ─── Sayfa başlığı ─────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Üstte küçük gezinti izi: [{ href, label }] — son öğe bulunulan sayfa değil, üst sayfalar. */
  crumbs?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs?.length ? (
          <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-theme-sm text-gray-500 dark:text-gray-400">
            {crumbs.map((c) => (
              <span key={c.href} className="flex items-center gap-1.5">
                <Link href={c.href} className="hover:text-brand-500">
                  {c.label}
                </Link>
                <span aria-hidden className="text-gray-300 dark:text-gray-600">
                  /
                </span>
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ─── Düğme ─────────────────────────────────────────────────────

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "xs" | "sm" | "md";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
    {
      xs: "h-8 px-3 text-theme-xs",
      sm: "h-10 px-4 text-sm",
      md: "h-11 px-5 text-sm",
    }[size],
    {
      primary: "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600",
      outline:
        "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/[0.03]",
      ghost:
        "text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200",
      danger:
        "text-error-600 hover:bg-error-50 dark:text-error-500 dark:hover:bg-error-500/15",
    }[variant]
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      {children}
    </Link>
  );
}

// ─── Rozet ─────────────────────────────────────────────────────

export type Tone = "neutral" | "brand" | "ok" | "warn" | "bad" | "info";

const PILL_TONE: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80",
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  ok: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  warn: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-orange-400",
  bad: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500",
  info: "bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-500",
};

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-theme-xs font-medium",
        PILL_TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export const QUESTION_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  REVIEW: "warn",
  PUBLISHED: "ok",
  ARCHIVED: "neutral",
};

// ─── Uyarı kutusu ──────────────────────────────────────────────

const NOTICE_TONE: Record<"ok" | "warn" | "bad" | "info", string> = {
  ok: "border-success-500/40 bg-success-50 text-success-800 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-500",
  warn: "border-warning-500/40 bg-warning-50 text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-orange-300",
  bad: "border-error-500/40 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400",
  info: "border-blue-light-500/40 bg-blue-light-50 text-blue-light-800 dark:border-blue-light-500/30 dark:bg-blue-light-500/15 dark:text-blue-light-400",
};

export function Notice({
  tone = "bad",
  title,
  children,
  className,
}: {
  tone?: "ok" | "warn" | "bad" | "info";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={clsx("rounded-xl border px-4 py-3 text-sm", NOTICE_TONE[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={clsx(title && "mt-0.5", "leading-relaxed opacity-90")}>{children}</div> : null}
    </div>
  );
}

// ─── Form ──────────────────────────────────────────────────────

export const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";

export const TEXTAREA_CLASS =
  "w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800";

export const SELECT_CLASS = INPUT_CLASS + " appearance-auto pe-9";

/** Küçük satır içi denetimler (liste satırlarındaki select'ler). */
export const SMALL_SELECT_CLASS =
  "h-8 rounded-lg border border-gray-300 bg-white px-2 text-theme-xs text-gray-700 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300";

export function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-theme-xs text-error-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

// ─── Göstergeler ───────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">{label}</p>
        {icon ? (
          <span
            className={clsx(
              "flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
              PILL_TONE[tone]
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-800 dark:text-white/90">
        {value}
      </p>
      {sub ? <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{sub}</p> : null}
    </Card>
  );
}

/** Yatay oran çubuğu (0-1). */
export function Meter({ ratio, tone = "brand" }: { ratio: number; tone?: Tone }) {
  const renk = {
    neutral: "bg-gray-400",
    brand: "bg-brand-500",
    ok: "bg-success-500",
    warn: "bg-warning-500",
    bad: "bg-error-500",
    info: "bg-blue-light-500",
  }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <div
        className={clsx("h-full rounded-full", renk)}
        style={{ width: Math.max(0, Math.min(1, ratio)) * 100 + "%" }}
      />
    </div>
  );
}

export function levelTone(level: string | null | undefined): Tone {
  return level === "STRONG" ? "ok" : level === "MEDIUM" ? "warn" : level === "WEAK" ? "bad" : "neutral";
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-theme-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ─── Sayfalama ─────────────────────────────────────────────────

export function Pagination({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  /** Sayfa numarasından adres üretir (süzgeçler korunarak). */
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-5 flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass("outline", "sm")}>
          ← Önceki
        </Link>
      ) : (
        <span />
      )}
      <span className="tabular-nums text-gray-500 dark:text-gray-400">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonClass("outline", "sm")}>
          Sonraki →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Adres çubuğu için sorgu dizesi — boş değerleri atar. */
export function qs(base: string, params: Record<string, string | number | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  }
  const s = u.toString();
  return s ? base + "?" + s : base;
}
