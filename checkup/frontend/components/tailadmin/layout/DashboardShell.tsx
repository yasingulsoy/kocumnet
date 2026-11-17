"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — app/[locale]/(admin)/layout.tsx
 * (AppSidebar + Backdrop + AppHeader + içerik kabı, SidebarProvider ile)
 *
 *   <DashboardShell
 *     nav={[{ title: "Menü", items: [{ href: "/admin", label: "Genel bakış", icon: <LayoutDashboard />, exact: true }] }]}
 *     logo={<Wordmark />} logoCollapsed={<LogoMark />} logoHref="/admin"
 *     headerEnd={<UserDropdown … />}
 *   >
 *     {children}
 *   </DashboardShell>
 *
 * Mobil çekmece erişilebilirliği (TailAdmin'de yoktu): açılınca odak
 * kapatma düğmesine gider, Esc kapatır, kapanınca odak menü düğmesine
 * döner; açıkken üst çubuk ve içerik `inert`, arka plan kaymaz.
 * "İçeriğe geç" bağlantısı tokens.css'teki .skip-link.
 *
 * Yapışkan öğeler başlığın altında kalsın diye kök öğe --ta-header-h
 * değişkenini verir: `sticky top-(--ta-header-h)`.
 *
 * İçerik genişliği TailAdmin'deki gibi en fazla 2xl (96rem). Kenar çubuğu
 * üstüne gelince açıldığında içerik kaymaz: çubuk içeriğin üstüne açılır.
 *
 * `bottomNav` (TailAdmin'de yok): telefonda (md altı) alt sekme çubuğu
 * (BottomNav). Verilince menü düğmesi telefonda gizlenir, içerik alttan
 * çubuk kadar boşluk bırakır; tablet ve masaüstünde çekmece/kenar çubuğu.
 * Yazdırmada kenar çubuğu, üst çubuk ve alt çubuk görünmez.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "../cx";
import { kaydirmayiBirak, kaydirmayiKilitle } from "../lib/scroll-lock";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { Backdrop } from "./Backdrop";
import { BottomNav } from "./BottomNav";
import type { NavItem, NavSection } from "./nav";
import { SidebarProvider, useSidebar } from "./SidebarContext";

export interface ShellLabels {
  skip: string;
  openMenu: string;
  closeMenu: string;
  collapse: string;
  expand: string;
  nav: string;
  drawer: string;
}

const ETIKETLER: ShellLabels = {
  skip: "İçeriğe geç",
  openMenu: "Menüyü aç",
  closeMenu: "Menüyü kapat",
  collapse: "Kenar çubuğunu daralt",
  expand: "Kenar çubuğunu genişlet",
  nav: "Ana menü",
  drawer: "Menü",
};

export interface DashboardShellProps {
  nav: NavSection[];
  logo: ReactNode;
  /** Dar kenar çubuğunda (yalnızca ikon) görünen logo. */
  logoCollapsed?: ReactNode;
  logoHref?: string;
  /** Logo bağlantısının adı (logo görselinin kendi adı yoksa). */
  logoLabel?: string;
  /** Üst çubuğun solu (masaüstü): arama, sayfa bağlamı. */
  headerStart?: ReactNode;
  /** Üst çubuğun sağı: bildirimler, kullanıcı menüsü. */
  headerEnd?: ReactNode;
  /** Kenar çubuğunun en altı (TailAdmin'in SidebarWidget yeri). */
  sidebarFooter?: ReactNode;
  /** Telefonda (md altı) alt sekme çubuğu; en fazla beş site içi öğe. */
  bottomNav?: NavItem[];
  children: ReactNode;
  labels?: Partial<ShellLabels>;
  /** İçerik öğesinin id'si ("İçeriğe geç" hedefi). */
  mainId?: string;
  defaultExpanded?: boolean;
}

export function DashboardShell({ defaultExpanded, ...props }: DashboardShellProps) {
  return (
    <SidebarProvider defaultExpanded={defaultExpanded}>
      <Cerceve {...props} />
    </SidebarProvider>
  );
}

const CEKMECE_ID = "ta-sidebar";

function Cerceve({ nav, logo, logoCollapsed, logoHref = "/", logoLabel, headerStart, headerEnd, sidebarFooter, bottomNav, children, labels, mainId = "icerik" }: Omit<DashboardShellProps, "defaultExpanded">) {
  const e = { ...ETIKETLER, ...labels };
  const altCubuk = Boolean(bottomNav?.length);
  const { isExpanded, isMobileOpen, closeMobileSidebar } = useSidebar();
  const menuDugmesi = useRef<HTMLButtonElement>(null);
  const kapatDugmesi = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobileOpen) return;
    const menu = menuDugmesi.current;
    kaydirmayiKilitle();
    kapatDugmesi.current?.focus();
    const tus = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeMobileSidebar();
    };
    document.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("keydown", tus);
      kaydirmayiBirak();
      menu?.focus();
    };
  }, [isMobileOpen, closeMobileSidebar]);

  return (
    <div className="min-h-screen bg-gray-50 [--ta-header-h:4rem] lg:[--ta-header-h:4.5rem] print:bg-white">
      <a href={`#${mainId}`} className="skip-link">
        {e.skip}
      </a>
      <AppSidebar
        id={CEKMECE_ID}
        nav={nav}
        logo={logo}
        logoCollapsed={logoCollapsed}
        logoHref={logoHref}
        logoLabel={logoLabel}
        footer={sidebarFooter}
        closeButtonRef={kapatDugmesi}
        labels={{ nav: e.nav, closeMenu: e.closeMenu, drawer: e.drawer }}
      />
      <Backdrop />
      <div className={cx("flex min-h-screen min-w-0 flex-col transition-[margin] duration-300 ease-in-out print:ms-0", isExpanded ? "lg:ms-72.5" : "lg:ms-22.5")}>
        <AppHeader
          logo={logo}
          logoHref={logoHref}
          logoLabel={logoLabel}
          start={headerStart}
          end={headerEnd}
          menuButtonRef={menuDugmesi}
          sidebarId={CEKMECE_ID}
          mobileMenu={!altCubuk}
          labels={{ openMenu: e.openMenu, collapse: e.collapse, expand: e.expand }}
        />
        <main
          id={mainId}
          inert={isMobileOpen}
          className={cx("mx-auto w-full max-w-(--breakpoint-2xl) flex-1 p-4 md:p-6 print:max-w-none print:p-0", altCubuk && "max-md:pb-28")}
        >
          {children}
        </main>
      </div>
      {altCubuk ? <BottomNav items={bottomNav!} label={e.nav} /> : null}
    </div>
  );
}
