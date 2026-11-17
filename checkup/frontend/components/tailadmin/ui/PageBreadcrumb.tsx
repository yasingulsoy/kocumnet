/*
 * Uyarlama: TailAdmin Free (MIT) — components/common/PageBreadCrumb.tsx
 *
 * TailAdmin'de başlık solda, "Home › Sayfa" izi sağdaydı. Burada iz
 * başlığın üstünde (eylem düğmeleri başlığın yanına sığsın), başlık sayfanın
 * tek h1'i. `badge` başlığın hemen yanında ama h1'in DIŞINDA (ekran okuyucu
 * başlığı rozetle birlikte okumasın). İz yalnızca `crumbs` verilince
 * çizilir; son halka bu sayfa. Ok ikonları RTL'de döner.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cx } from "../cx";

export interface Crumb {
  href: string;
  label: string;
}

export interface PageBreadcrumbProps {
  /** TailAdmin adı: sayfa başlığı (h1). */
  pageTitle: ReactNode;
  /** Başlığın yanında (sınav, durum rozeti). */
  badge?: ReactNode;
  crumbs?: Crumb[];
  /** İzde görünecek kısa ad; başlık uzun ya da metin değilse. */
  currentLabel?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** İz için ekran okuyucu adı. */
  navLabel?: string;
}

export function PageBreadcrumb({ pageTitle, badge, crumbs, currentLabel, description, actions, className, navLabel = "Konum" }: PageBreadcrumbProps) {
  const sonHalka = currentLabel ?? (typeof pageTitle === "string" ? pageTitle : undefined);
  return (
    <div className={cx("mb-6", className)}>
      {crumbs?.length ? (
        <nav aria-label={navLabel} className="mb-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm">
            {crumbs.map((c) => (
              <li key={c.href} className="flex items-center gap-1.5">
                <Link href={c.href} className="text-gray-500 transition hover:text-brand-500">
                  {c.label}
                </Link>
                <ChevronRight className="size-4 text-gray-400 rtl:rotate-180" aria-hidden />
              </li>
            ))}
            {sonHalka ? (
              <li aria-current="page" className="max-w-[16rem] truncate text-gray-800">
                {sonHalka}
              </li>
            ) : null}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {badge ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="font-display text-xl font-semibold text-balance break-words text-gray-800 sm:text-2xl">{pageTitle}</h1>
              {badge}
            </div>
          ) : (
            <h1 className="font-display text-xl font-semibold text-balance break-words text-gray-800 sm:text-2xl">{pageTitle}</h1>
          )}
          {description ? <div className="mt-1 text-sm text-gray-500">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
