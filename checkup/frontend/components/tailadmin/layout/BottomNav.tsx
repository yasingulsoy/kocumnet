"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — TailAdmin'de karşılığı yok; telefon için
 * alt sekme çubuğu, kitin menü renkleri ve etkin bağlantı kuralıyla (nav.ts)
 * yazıldı.
 *
 * Telefonda (md altı) ekranın altında sabit sekmeler: başparmağın ulaştığı
 * yerde en fazla beş birincil adres. Etkin sekme kenar çubuğuyla aynı
 * kuralla seçilir (en uzun eşleşme + `match` önekleri). iPhone ev çubuğunun
 * altında kalmasın diye tokens.css'teki .pb-safe. Yazdırmada gizli.
 * DashboardShell'e `bottomNav` verilince o çizer.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "../cx";
import { enUzunEslesen, type NavItem } from "./nav";

export interface BottomNavProps {
  /** Yalnızca `href`'i olan site içi öğeler çizilir (alt menü yok). */
  items: NavItem[];
  /** Ekran okuyucu için menünün adı. */
  label?: string;
  className?: string;
}

export function BottomNav({ items, label = "Ana menü", className }: BottomNavProps) {
  const pathname = usePathname() ?? "";
  const sekmeler = items.filter((o) => o.href && !o.external);
  const etkin = enUzunEslesen(pathname, sekmeler);

  return (
    <nav
      aria-label={label}
      className={cx(
        "pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden print:hidden",
        className
      )}
    >
      <ul className="mx-auto grid max-w-md auto-cols-fr grid-flow-col">
        {sekmeler.map((o) => {
          const aktif = o.href === etkin;
          return (
            <li key={o.href} className="min-w-0">
              <Link
                href={o.href!}
                aria-current={aktif ? "page" : undefined}
                className={cx(
                  "flex flex-col items-center gap-1 px-1 pt-2 pb-1 text-theme-xs font-medium transition",
                  aktif ? "text-brand-500" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <span
                  className={cx(
                    "relative flex h-7 w-12 items-center justify-center rounded-full transition [&_svg]:size-5",
                    aktif && "bg-brand-50"
                  )}
                >
                  {o.icon}
                  {o.badge !== undefined && o.badge !== null ? (
                    <span className="tabular absolute -top-1 end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[0.625rem] leading-none font-semibold text-white">
                      {o.badge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{o.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
