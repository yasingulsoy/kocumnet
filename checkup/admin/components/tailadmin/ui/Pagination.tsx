/*
 * Uyarlama: TailAdmin Free (MIT) — components/tables/Pagination.tsx
 *
 * İki kip: `href(sayfa)` verilirse bağlantı (sunucu bileşeninde, adres
 * çubuğunda ?sayfa=), `onPageChange` verilirse düğme. Sayfa listesi
 * 1 … (s-1) s (s+1) … N; telefonda yalnızca "s / N". TailAdmin'in
 * ml/mr kenar boşlukları yerine gap; oklar RTL'de döner.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "../cx";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  href?: (sayfa: number) => string;
  onPageChange?: (sayfa: number) => void;
  labels?: { previous?: string; next?: string; nav?: string; page?: (n: number) => string };
  className?: string;
}

const KENAR =
  "flex h-10 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 [&_svg]:size-4";
const SAYI = "flex size-10 items-center justify-center rounded-lg text-sm font-medium transition";

function sayfalar(s: number, n: number): (number | "…")[] {
  const set = new Set([1, n, s - 1, s, s + 1].filter((p) => p >= 1 && p <= n));
  const sirali = [...set].sort((a, b) => a - b);
  const sonuc: (number | "…")[] = [];
  sirali.forEach((p, i) => {
    if (i > 0 && p - sirali[i - 1] > 1) sonuc.push("…");
    sonuc.push(p);
  });
  return sonuc;
}

export function Pagination({ currentPage, totalPages, href, onPageChange, labels = {}, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const { previous = "Önceki", next = "Sonraki", nav = "Sayfalar", page = (n: number) => `${n}. sayfa` } = labels;

  function oge(p: number, icerik: ReactNode, sinif: string, ad?: string, guncel?: boolean) {
    if (href) {
      return (
        <Link href={href(p)} className={sinif} aria-label={ad} aria-current={guncel ? "page" : undefined}>
          {icerik}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => onPageChange?.(p)} className={cx(sinif, "cursor-pointer")} aria-label={ad} aria-current={guncel ? "page" : undefined}>
        {icerik}
      </button>
    );
  }

  const geri = currentPage > 1;
  const ileri = currentPage < totalPages;

  return (
    <nav aria-label={nav} className={cx("mt-5 flex items-center justify-between gap-3", className)}>
      {geri ? (
        oge(currentPage - 1, <><ChevronLeft className="rtl:rotate-180" aria-hidden /> {previous}</>, KENAR)
      ) : (
        <span aria-disabled className={cx(KENAR, "pointer-events-none opacity-50")}>
          <ChevronLeft className="rtl:rotate-180" aria-hidden /> {previous}
        </span>
      )}

      <span className="tabular text-sm text-gray-500 sm:hidden">
        {currentPage} / {totalPages}
      </span>
      <ul className="hidden items-center gap-1 sm:flex">
        {sayfalar(currentPage, totalPages).map((p, i) =>
          p === "…" ? (
            <li key={`b${i}`} aria-hidden className="px-1 text-sm text-gray-500">
              …
            </li>
          ) : (
            <li key={p}>
              {oge(
                p,
                <span className="tabular">{p}</span>,
                cx(SAYI, p === currentPage ? "bg-brand-500 text-white" : "text-gray-700 hover:bg-brand-50 hover:text-brand-500"),
                page(p),
                p === currentPage
              )}
            </li>
          )
        )}
      </ul>

      {ileri ? (
        oge(currentPage + 1, <>{next} <ChevronRight className="rtl:rotate-180" aria-hidden /></>, KENAR)
      ) : (
        <span aria-disabled className={cx(KENAR, "pointer-events-none opacity-50")}>
          {next} <ChevronRight className="rtl:rotate-180" aria-hidden />
        </span>
      )}
    </nav>
  );
}
