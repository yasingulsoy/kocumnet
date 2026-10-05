import Link from "next/link";
import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Card, buttonClass, cn } from "@/components/ui";

/**
 * Site yönetimi yapı taşları — components/ui.tsx üstüne panel yoğunluğu.
 * Check-up paneliyle (admin/) aynı adlar ve aynı görünüm: iki panel arasında
 * geçen personel yeni bir dil öğrenmesin.
 */

export { Card, Badge, Button, LinkButton, Field, INPUT_CLASS, buttonClass, cn } from "@/components/ui";

export const TEXTAREA_CLASS =
  "w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-body text-ink " +
  "placeholder:text-ink-faint transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/12";

export const SELECT_CLASS =
  "h-11 w-full appearance-auto rounded-xl border border-line-strong bg-surface px-3.5 pe-9 text-body text-ink " +
  "transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/12";

export const CHECKBOX_CLASS = "size-4 rounded border-line-strong text-brand accent-brand focus:ring-brand/20";

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
  crumbs?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs?.length ? (
          <nav className="mb-1.5 flex flex-wrap items-center gap-1.5 text-caption text-ink-faint" aria-label="Konum">
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
        <h1 className="font-display text-h3 font-bold tracking-tight text-ink sm:text-[1.5rem]">{title}</h1>
        {description ? <p className="mt-1 text-body text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ─── Rozet (durum) ─────────────────────────────────────────────

export type Tone = "neutral" | "brand" | "ok" | "warn" | "bad";

const PILL: Record<Tone, string> = {
  neutral: "bg-surface-sunk text-ink-soft ring-line",
  brand: "bg-brand-wash text-brand ring-brand/15",
  ok: "bg-ok-wash text-ok ring-ok/15",
  warn: "bg-warn-wash text-warn ring-warn/15",
  bad: "bg-bad-wash text-bad ring-bad/15",
};

export function Pill({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-micro font-semibold ring-1 ring-inset",
        PILL[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Uyarı kutusu ──────────────────────────────────────────────

const NOTICE = {
  bad: { cls: "border-bad/20 bg-bad-wash text-bad", Icon: CircleAlert },
  warn: { cls: "border-warn/20 bg-warn-wash text-warn", Icon: TriangleAlert },
  ok: { cls: "border-ok/20 bg-ok-wash text-ok", Icon: CircleCheck },
  info: { cls: "border-brand/15 bg-brand-wash text-brand-deep", Icon: Info },
} as const;

export function Notice({
  tone = "bad",
  title,
  children,
  className,
}: {
  tone?: keyof typeof NOTICE;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { cls, Icon } = NOTICE[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-caption", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title ? "mt-0.5" : undefined, "opacity-90")}>{children}</div> : null}
      </div>
    </div>
  );
}

// ─── Sayı kartı ────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  href?: string;
}) {
  const ic = (
    <Card className={cn("p-5", href && "transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption text-ink-soft">{label}</p>
        {icon ? (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset [&_svg]:size-5", PILL[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="font-display tabular mt-2 text-num-sm font-bold text-ink">{value}</p>
      {sub ? <p className="mt-1.5 text-micro text-ink-faint">{sub}</p> : null}
    </Card>
  );
  return href ? <Link href={href}>{ic}</Link> : ic;
}

// ─── Boş durum ─────────────────────────────────────────────────

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-display text-body font-semibold text-ink">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-caption text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ─── Sayfalama ─────────────────────────────────────────────────

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-5 flex items-center justify-between gap-4 text-caption" aria-label="Sayfalar">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass({ variant: "secondary", size: "sm" })}>
          ← Önceki
        </Link>
      ) : (
        <span />
      )}
      <span className="tabular text-ink-faint">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonClass({ variant: "secondary", size: "sm" })}>
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
  return s ? `${base}?${s}` : base;
}

// ─── Biçimlendirme ─────────────────────────────────────────────

export function trDate(v: string | Date | null | undefined, opts: { time?: boolean } = {}) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(opts.time ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** "3 saat önce", "2 gün önce" — son 7 gün için; sonrası tarih. */
export function relative(v: string | Date | null | undefined) {
  if (!v) return "—";
  const ms = Date.now() - new Date(v).getTime();
  const dk = Math.round(ms / 60_000);
  if (dk < 1) return "şimdi";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.round(dk / 60);
  if (saat < 24) return `${saat} saat önce`;
  const gun = Math.round(saat / 24);
  if (gun < 7) return `${gun} gün önce`;
  return trDate(v);
}

/** Bitişe kalan süre: "2 gün kaldı", "5 saat kaldı"; geçmişse null. */
export function remaining(v: string | Date | null | undefined) {
  if (!v) return null;
  const ms = new Date(v).getTime() - Date.now();
  if (ms <= 0) return null;
  const saat = Math.floor(ms / 3_600_000);
  if (saat < 1) return "1 saatten az kaldı";
  if (saat < 24) return `${saat} saat kaldı`;
  return `${Math.floor(saat / 24)} gün kaldı`;
}

/** Bir sayfanın tamamını kaplayan "yetkin yok" kutusu. */
export function Forbidden({ roles }: { roles: string }) {
  return (
    <Card className="mx-auto mt-6 max-w-xl p-6 sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-xl bg-warn-wash text-warn">
        <TriangleAlert className="size-6" />
      </span>
      <h1 className="font-display mt-4 text-h3 font-semibold text-ink">Bu bölüm için yetkin yok</h1>
      <p className="mt-2 text-caption leading-relaxed text-ink-soft">
        Bu sayfayı yalnızca şu roller açabilir: {roles}. Kişisel veri ve hesap işlemleri, ihtiyacı olan en az
        kişiye açık tutuluyor.
      </p>
      <div className="mt-5">
        <Link href="/admin" className={buttonClass({ variant: "secondary", size: "sm" })}>
          Panele dön
        </Link>
      </div>
    </Card>
  );
}
