import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { buttonClass, type ButtonStyleProps } from "@/components/tailadmin/ui/Button";

/*
 * Tanıtım sitesinin yerleşim parçaları — TailAdmin kitinin üstünde.
 *
 * Düğme, rozet, kart, form alanı, uyarı, sekme, avatar, sayı kartı, görsel
 * ve hata sayfası kitten gelir (components/tailadmin; kaynak
 * design/tailadmin, README'si orada). Burada yalnızca kitte olmayan
 * pazarlama düzeni var: sayfa genişliği, bölüm ritmi, bölüm başlığı, site
 * dışı düğme bağlantısı, ikon kutusu ve "tamamı tıklanan kart" sınıfları.
 *
 * Kural: ham hex yok; renk ve gölge kitin ölçeklerinden (gray-*, brand-*,
 * shadow-theme-*). Fosfor sarısı yalnızca `.marker` vurgusu, metin rengi
 * değil. Kitte tailwind-merge yok: className yalnızca ekler, çatışan sınıf
 * (ikinci bir renk, boyut) verme.
 */

// ─────────────────────────────────────────────────────────────
// Yerleşim
// ─────────────────────────────────────────────────────────────

/** Sayfa genişliği. Tek yerde tanımlı: içerik ölçüsü her sayfada aynı. */
export function Container({ className, wide, ...props }: ComponentProps<"div"> & { wide?: boolean }) {
  return <div className={cx("mx-auto w-full px-5 sm:px-6", wide ? "max-w-7xl" : "max-w-6xl", className)} {...props} />;
}

/**
 * Dikey ritim: bölümler arası tek ölçek. `sunk`: TailAdmin'in gri tuvali
 * (gray-50); beyaz kartlar onun üstünde durur.
 */
export function Section({ className, tone = "default", ...props }: ComponentProps<"section"> & { tone?: "default" | "sunk" }) {
  return <section className={cx("py-16 sm:py-20 lg:py-24", tone === "sunk" && "bg-gray-50", className)} {...props} />;
}

// ─────────────────────────────────────────────────────────────
// Tipografi
// ─────────────────────────────────────────────────────────────

/** Bölüm üstü etiket: kitin rozeti. Koyu zeminde dolu rozet. */
export function Eyebrow({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <p className={className}>
      <Badge size="sm" variant={dark ? "solid" : "light"} className="tracking-wider uppercase">
        {children}
      </Badge>
    </p>
  );
}

/**
 * Bölüm başlığı + açıklama. Her sayfada aynı hiyerarşi. `center` yalnızca
 * gerçekten ortalanması gereken yerlerde — sola hizalı metin daha hızlı okunur.
 */
export function SectionHead({
  eyebrow,
  title,
  description,
  center,
  dark,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  center?: boolean;
  /** Koyu zemin (lacivert kart). */
  dark?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("max-w-3xl", center && "mx-auto text-center", className)}>
      {eyebrow ? <Eyebrow dark={dark}>{eyebrow}</Eyebrow> : null}
      <h2
        className={cx(
          "font-display text-title-sm font-semibold tracking-tight text-balance sm:text-title-md",
          eyebrow ? "mt-4" : undefined,
          dark ? "text-white" : "text-gray-800"
        )}
      >
        {title}
      </h2>
      {description ? <p className={cx("mt-4 text-base sm:text-lg", dark ? "text-gray-300" : "text-gray-600")}>{description}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Düğme bağlantısı (site dışı), ikon kutusu, kart
// ─────────────────────────────────────────────────────────────

/**
 * Site dışına (check-up uygulaması) giden, kitin düğmesi görünümlü bağlantı.
 * Yeni sekmede açılır; ekran okuyucuya bu söylenir.
 */
export function ExternalButton({
  href,
  newTabLabel,
  endIcon,
  className,
  children,
  ...stil
}: ButtonStyleProps & { href: string; newTabLabel: string; endIcon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cx(buttonClass(stil), className)}>
      {children}
      {endIcon}
      <span className="sr-only"> ({newTabLabel})</span>
    </a>
  );
}

/** Kartlardaki ikon kutusu — kitin MetricCard kutusuyla aynı ölçü. */
export function IconBox({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "flex size-12 shrink-0 items-center justify-center rounded-xl [&_svg]:size-6",
        dark ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-500",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Kitin kartına eklenen hafif gölge (TailAdmin'in theme-xs'i). */
export const KART_GOLGE = "shadow-theme-xs";

/**
 * Tamamı tıklanan kart: Card'a `LINK_KART`, karttaki TEK bağlantıya (başlık)
 * `UZANAN_BAGLANTI`. Bağlantının ::after katmanı kartı kaplar; ekran
 * okuyucuda adı yalnızca başlık olur, klavyede kart başına tek durak.
 * Odak halkası kartın kendisinde; bağlantının çerçevesi `!` ile kapalı
 * (tokens.css'teki genel :focus-visible katmansız, yoksa yardımcıyı ezer).
 */
export const LINK_KART =
  "group relative transition hover:border-gray-300 hover:shadow-theme-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500";
export const UZANAN_BAGLANTI = "after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-hidden!";
