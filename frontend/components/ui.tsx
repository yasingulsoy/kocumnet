import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/*
 * Tasarım sistemi — tanıtım sitesi.
 *
 * Neden var: eski kodda birincil düğme 8 ayrı yerde, 4'ü birebir aynı
 * string olarak elle yazılmıştı; gradyan hero bloğu 6 dosyada kopyaydı;
 * "eyebrow" etiketi 17 kez, beş farklı harf aralığı değeriyle geçiyordu.
 * Tek bir rengi değiştirmek 150 satıra dokunmak demekti.
 *
 * Kural: bileşenlerde ham hex YOK. Renk, boyut ve gölge yalnızca
 * globals.css'teki belirteçlerden gelir.
 */

/** Tailwind sınıflarını birleştirir. Son gelen kazanır kuralı YOK —
 *  çakışma olmaması için varyantlar birbirini dışlayacak şekilde yazıldı. */
export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────
// Yerleşim
// ─────────────────────────────────────────────────────────────

/** Sayfa genişliği. Tek yerde tanımlı: içerik ölçüsü her sayfada aynı. */
export function Container({
  className,
  wide,
  ...props
}: ComponentProps<"div"> & { wide?: boolean }) {
  return (
    <div
      className={cn("mx-auto w-full px-5 sm:px-6", wide ? "max-w-7xl" : "max-w-6xl", className)}
      {...props}
    />
  );
}

/**
 * Dikey ritim. Bölüm arası boşluk üç ayrı sayfada üç farklı değerdeydi
 * (py-16, py-20, py-24); artık tek ölçek.
 */
export function Section({
  className,
  tone = "default",
  ...props
}: ComponentProps<"section"> & { tone?: "default" | "sunk" | "deep" }) {
  return (
    <section
      className={cn(
        "py-16 sm:py-20 lg:py-24",
        tone === "sunk" && "bg-surface-sunk",
        tone === "deep" && "bg-brand-deep text-white",
        className
      )}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Tipografi
// ─────────────────────────────────────────────────────────────

/** Bölüm üstü küçük etiket. Tek harf aralığı değeri — eskiden beş vardı. */
export function Eyebrow({
  className,
  tone = "brand",
  ...props
}: ComponentProps<"p"> & { tone?: "brand" | "light" }) {
  return (
    <p
      className={cn(
        "text-micro font-semibold uppercase tracking-[0.18em]",
        tone === "brand" ? "text-brand" : "text-white/70",
        className
      )}
      {...props}
    />
  );
}

/**
 * Bölüm başlığı + açıklama. Her sayfada aynı hiyerarşi.
 * `center` yalnızca gerçekten ortalanması gereken yerlerde — sola hizalı
 * metin daha hızlı okunuyor.
 */
export function SectionHead({
  eyebrow,
  title,
  description,
  center,
  light,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  center?: boolean;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", center && "mx-auto text-center", className)}>
      {eyebrow ? <Eyebrow tone={light ? "light" : "brand"}>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          "font-display text-h2 font-semibold tracking-tight text-balance sm:text-[2.25rem]",
          eyebrow ? "mt-3" : undefined,
          light ? "text-white" : "text-ink"
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn("mt-4 text-lead", light ? "text-white/75" : "text-ink-soft")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Düğmeler
// ─────────────────────────────────────────────────────────────

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition " +
  "disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-[1.1em] [&_svg]:shrink-0";

const BUTTON_VARIANTS = {
  primary: "bg-brand text-white shadow-brand hover:bg-brand-hover active:bg-brand-hover",
  secondary: "bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-surface-hover",
  soft: "bg-brand-wash text-brand hover:bg-brand-wash-strong",
  ghost: "text-brand hover:bg-brand-wash",
  /** Koyu zemin üstünde (hero, CTA bandı). */
  white: "bg-white text-brand-deep hover:bg-white/90",
  outlineLight: "text-white ring-1 ring-inset ring-white/40 hover:bg-white/10",
} as const;

const BUTTON_SIZES = {
  sm: "min-h-9 px-3.5 text-caption",
  md: "min-h-11 px-5 text-body",
  lg: "min-h-13 px-7 text-body sm:text-lead",
} as const;

export interface ButtonStyleProps {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  block?: boolean;
}

export function buttonClass({ variant = "primary", size = "md", block }: ButtonStyleProps = {}) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], block && "w-full");
}

export function Button({
  variant,
  size,
  block,
  className,
  ...props
}: ComponentProps<"button"> & ButtonStyleProps) {
  return (
    <button className={cn(buttonClass({ variant, size, block }), className)} {...props} />
  );
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

/** Site dışına giden bağlantı (ürün sayfası, sosyal medya). */
export function ExternalButton({
  variant,
  size,
  block,
  className,
  ...props
}: ComponentProps<"a"> & ButtonStyleProps) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonClass({ variant, size, block }), className)}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Kart ve rozet
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

const BADGE_TONES = {
  neutral: "bg-surface-sunk text-ink-soft ring-line",
  brand: "bg-brand-wash text-brand ring-brand/15",
  ok: "bg-ok-wash text-ok ring-ok/15",
  warn: "bg-warn-wash text-warn ring-warn/15",
  light: "bg-white/12 text-white ring-white/25",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: keyof typeof BADGE_TONES }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-micro font-semibold ring-1 ring-inset",
        "[&_svg]:size-3.5",
        BADGE_TONES[tone],
        className
      )}
      {...props}
    />
  );
}

/** Boş liste durumu — blog yazısı yokken, arama sonucu boşken. */
export function EmptyStateBox({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line bg-surface-sunk px-6 py-16 text-center">
      {icon ? (
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand-wash text-brand [&_svg]:size-7">
          {icon}
        </span>
      ) : null}
      <h2 className="font-display text-h3 font-semibold text-ink">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-body text-ink-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Form alanı
// ─────────────────────────────────────────────────────────────

/*
 * Tek input sınıfı. Eskiden iki ayrı form kendi `inputClass` sabitini
 * tanımlıyordu ve değerleri birbirinden farklıydı (biri rounded-xl +
 * ring-2, öteki rounded-md + ring-1): aynı sitede iki farklı form dili.
 */
export const INPUT_CLASS =
  "w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-body text-ink " +
  "placeholder:text-ink-faint transition focus:border-brand focus:outline-none " +
  "focus:ring-4 focus:ring-brand/12 disabled:bg-surface-sunk disabled:text-ink-faint";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-caption font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-caption text-bad">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-caption text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}
