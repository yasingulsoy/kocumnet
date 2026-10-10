/*
 * Uyarlama: TailAdmin Free (MIT) — components/common/ComponentCard.tsx
 *
 * Card: TailAdmin'in kart kabı (rounded-2xl, gray-200 kenar, beyaz).
 * ComponentCard: başlıklı kart. Eklenenler: başlığın yanında eylem alanı
 * (actions), başlık düzeyi (sayfada h1 varsa kart h2), `flush` (gövde
 * dolgusuz: liste/tablo için) ve `tone="danger"` (tehlikeli bölge).
 *
 * `tone` (kenar ve zemin): className'le `border-*`/`bg-*` vermek işe
 * yaramaz — Tailwind aynı özelliği yazan iki sınıfı kendi sırasıyla dizer,
 * kartın gray-200/beyazı kazanabilir. Vurgulu kart `tone="brand"` (marka
 * kenarı), koyu bant `tone="dark"` (logodaki lacivert, beyaz yazı; içine
 * GridShape konacaksa className'e `relative z-1 overflow-hidden`).
 */
import type { ComponentProps, ReactNode } from "react";
import { cx } from "../cx";

export type CardTone = "default" | "brand" | "dark";

const KART_TONU: Record<CardTone, string> = {
  default: "border-gray-200 bg-white",
  brand: "border-brand-200 bg-white",
  dark: "border-brand-950 bg-brand-950 text-white",
};

export function Card({ className, tone = "default", ...props }: ComponentProps<"div"> & { tone?: CardTone }) {
  return <div className={cx("min-w-0 rounded-2xl border", KART_TONU[tone], className)} {...props} />;
}

export interface ComponentCardProps {
  title: ReactNode;
  /** TailAdmin adı; açıklama. */
  desc?: ReactNode;
  /** Başlığın hemen yanında (durum rozeti gibi); dar kartta da aynı satırda kalır. */
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** true: gövde dolgusuz ve aralıksız (tablo, liste). */
  flush?: boolean;
  titleAs?: "h2" | "h3";
  /** danger: tehlikeli bölge (kırmızı kenar, başlık); brand: vurgulu (marka kenarı). */
  tone?: "default" | "danger" | "brand";
  className?: string;
  /** Başlık sırasının yanına ikon. */
  icon?: ReactNode;
  id?: string;
}

export function ComponentCard({
  title,
  desc,
  badge,
  actions,
  children,
  flush = false,
  titleAs: Baslik = "h2",
  tone = "default",
  className,
  icon,
  id,
}: ComponentCardProps) {
  return (
    <section
      id={id}
      className={cx(
        "min-w-0 rounded-2xl border bg-white",
        tone === "danger" ? "border-error-200" : tone === "brand" ? "border-brand-200" : "border-gray-200",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Baslik
              className={cx(
                "flex items-center gap-2 font-display text-base font-semibold [&_svg]:size-4.5 [&_svg]:shrink-0",
                tone === "danger" ? "text-error-700" : "text-gray-800"
              )}
            >
              {icon ? <span className="text-gray-500">{icon}</span> : null}
              {title}
            </Baslik>
            {badge}
          </div>
          {desc ? <div className="mt-1 text-sm text-gray-500">{desc}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children !== undefined && children !== null ? (
        <div className={cx("border-t", tone === "danger" ? "border-error-100" : "border-gray-100", !flush && "space-y-6 p-4 sm:p-6")}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
