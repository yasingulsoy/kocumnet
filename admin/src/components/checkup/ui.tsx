import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Check-up panelinin yapı taşları — ortak tasarım belirteçleri üstünde
 * (tokens.css: ink/surface/line/brand/ok/warn/bad). Tanıtım sitesi ve
 * öğrenci uygulamasıyla aynı renk, köşe ve gölge dili.
 *
 * Hook kullanmıyorlar: hem sunucu hem istemci bileşenlerinden çağrılabilir.
 */

/** Tablo kimlikleri, kod parçaları. tokens.css --font-mono'yu okur. */
export const MONO = "font-mono";

// ─── Kart ──────────────────────────────────────────────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-2xl border border-line bg-surface shadow-card", className)}>
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
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-h2 font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-caption text-ink-soft">{description}</p> : null}
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
          <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-caption text-ink-faint">
            {crumbs.map((c) => (
              <span key={c.href} className="flex items-center gap-1.5">
                <Link href={c.href} className="transition hover:text-brand">
                  {c.label}
                </Link>
                <span aria-hidden className="text-ink-muted">
                  /
                </span>
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="font-display text-h1 font-bold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-body text-ink-soft">{description}</p> : null}
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
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
    {
      xs: "h-8 px-3 text-micro",
      sm: "h-9 px-3.5 text-caption",
      md: "h-11 px-5 text-body",
    }[size],
    {
      primary: "bg-brand text-white shadow-brand hover:bg-brand-hover",
      outline: "bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-surface-hover",
      ghost: "text-ink-soft hover:bg-surface-hover hover:text-ink",
      danger: "bg-bad-wash text-bad hover:bg-bad-fill hover:text-white",
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
  neutral: "bg-surface-sunk text-ink-soft ring-line",
  brand: "bg-brand-wash text-brand ring-brand/15",
  ok: "bg-ok-wash text-ok ring-ok/15",
  warn: "bg-warn-wash text-warn ring-warn/15",
  bad: "bg-bad-wash text-bad ring-bad/15",
  info: "bg-brand-wash text-brand-deep ring-brand/15",
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
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-micro font-semibold ring-1 ring-inset",
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
  ok: "border-ok/20 bg-ok-wash text-ok",
  warn: "border-warn/20 bg-warn-wash text-warn",
  bad: "border-bad/20 bg-bad-wash text-bad",
  info: "border-brand/15 bg-brand-wash text-brand-deep",
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
      className={clsx("rounded-xl border px-4 py-3 text-caption", NOTICE_TONE[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? (
        <div className={clsx(title && "mt-0.5", "leading-relaxed opacity-90")}>{children}</div>
      ) : null}
    </div>
  );
}

// ─── Form ──────────────────────────────────────────────────────

export const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-body text-ink shadow-card " +
  "placeholder:text-ink-faint transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 " +
  "disabled:bg-surface-sunk disabled:text-ink-faint";

export const TEXTAREA_CLASS =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-body text-ink shadow-card " +
  "placeholder:text-ink-faint transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

export const SELECT_CLASS = INPUT_CLASS + " appearance-auto pe-9";

/** Küçük satır içi denetimler (liste satırlarındaki select'ler). */
export const SMALL_SELECT_CLASS =
  "h-8 rounded-lg border border-line-strong bg-surface px-2 text-micro text-ink shadow-card " +
  "focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 disabled:opacity-50";

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
      <label htmlFor={htmlFor} className="mb-1.5 block text-caption font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-micro text-bad">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-micro text-ink-faint">{hint}</p>
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
        <p className="text-caption text-ink-soft">{label}</p>
        {icon ? (
          <span
            className={clsx(
              "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset [&_svg]:size-5",
              PILL_TONE[tone]
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="font-display tabular mt-2 text-num-sm font-bold text-ink">{value}</p>
      {sub ? <p className="mt-1.5 text-micro text-ink-faint">{sub}</p> : null}
    </Card>
  );
}

/** Yatay oran çubuğu (0-1). */
export function Meter({ ratio, tone = "brand" }: { ratio: number; tone?: Tone }) {
  const renk = {
    neutral: "bg-line-strong",
    brand: "bg-brand",
    ok: "bg-ok-fill",
    warn: "bg-warn-fill",
    bad: "bg-bad-fill",
    info: "bg-brand-bright",
  }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk ring-1 ring-inset ring-line">
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
      <p className="font-display text-body font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-caption text-ink-soft">{description}</p>
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
    <nav className="mt-5 flex items-center justify-between gap-4 text-caption">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass("outline", "sm")}>
          ← Önceki
        </Link>
      ) : (
        <span />
      )}
      <span className="tabular text-ink-faint">
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
