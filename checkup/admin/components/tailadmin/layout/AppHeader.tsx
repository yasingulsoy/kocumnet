"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — layout/AppHeader.tsx
 *
 * Aynı çubuk: solda kenar çubuğu düğmesi, mobilde logo, sağda araçlar.
 * Farklar: iki ayrı düğme — mobilde çekmeceyi açan (aria-expanded,
 * aria-controls), masaüstünde daraltıp genişleten — böylece ekran
 * genişliğini JS ile sormaya gerek yok. Arama kutusu, tema düğmesi ve
 * "uygulama menüsü" yok: sol ve sağ içerik prop'la gelir (headerStart,
 * headerEnd). Simgeler RTL'de aynalanır. `mobileMenu={false}`: telefonda
 * (md altı) menü düğmesi yok — alt sekme çubuğu varken (DashboardShell
 * `bottomNav`). Yazdırmada gizli.
 */
import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cx } from "../cx";
import { useSidebar } from "./SidebarContext";

export interface AppHeaderProps {
  logo?: ReactNode;
  logoHref?: string;
  logoLabel?: string;
  start?: ReactNode;
  end?: ReactNode;
  menuButtonRef?: RefObject<HTMLButtonElement | null>;
  sidebarId: string;
  /** false: telefonda (md altı) menü düğmesi gizli (alt sekme çubuğu varken). */
  mobileMenu?: boolean;
  labels: { openMenu: string; collapse: string; expand: string };
}

export function AppHeader({ logo, logoHref = "/", logoLabel, start, end, menuButtonRef, sidebarId, mobileMenu = true, labels }: AppHeaderProps) {
  const { isExpanded, isMobileOpen, toggleSidebar, openMobileSidebar } = useSidebar();
  return (
    <header inert={isMobileOpen} className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center border-b border-gray-200 bg-white lg:h-18 print:hidden">
      <div className="flex w-full min-w-0 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={openMobileSidebar}
          aria-label={labels.openMenu}
          aria-controls={sidebarId}
          aria-expanded={isMobileOpen}
          className={cx(
            "flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 lg:hidden",
            !mobileMenu && "max-md:hidden"
          )}
        >
          <Menu className="size-6 rtl:-scale-x-100" aria-hidden />
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isExpanded ? labels.collapse : labels.expand}
          aria-controls={sidebarId}
          aria-expanded={isExpanded}
          className="hidden size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 lg:flex"
        >
          {isExpanded ? (
            <PanelLeftClose className="size-5 rtl:-scale-x-100" aria-hidden />
          ) : (
            <PanelLeftOpen className="size-5 rtl:-scale-x-100" aria-hidden />
          )}
        </button>
        {logo ? (
          <Link href={logoHref} aria-label={logoLabel} className="flex min-w-0 items-center lg:hidden">
            {logo}
          </Link>
        ) : null}
        <div className={cx("min-w-0 flex-1", start ? "hidden lg:block" : undefined)}>{start}</div>
        {end ? <div className="ms-auto flex shrink-0 items-center gap-2 2xsm:gap-3">{end}</div> : null}
      </div>
    </header>
  );
}
