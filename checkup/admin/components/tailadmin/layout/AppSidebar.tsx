"use client";

/*
 * Uyarlama: TailAdmin Free (MIT) — layout/AppSidebar.tsx (+ SidebarWidget yeri)
 *
 * Aynı yapı: üstte logo, büyük harfli bölüm başlıkları, menu-item sınıfları,
 * alt menü akordeonu, dar kipte ikon rayı (üstüne gelince/odaklanınca
 * açılır), en altta isteğe bağlı kutu (sidebarFooter). Farklar:
 *  · Menü, logo ve alt kutu prop'la gelir (next-intl ve sabit liste yok).
 *  · Dar kipte etiket DOM'da kalır (sr-only) + title: ekran okuyucu ve
 *    fare ipucu adı bilir. Sayı rozeti dar kipte noktaya döner.
 *  · Mobil çekmece kapalıyken `invisible`: ekran dışındaki bağlantılar Tab
 *    ile odaklanmaz. Açıkken role="dialog" (DashboardShell odağı yönetir).
 *  · Alt menü yüksekliği ölçülmez; grid-rows geçişi (0fr → 1fr). Kapalı alt
 *    menü odaklanamaz (invisible).
 *  · Sol/sağ yerine start/end ve rtl: — Arapça sayfada ayna görünür.
 *  · Yazdırmada gizli.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type FocusEvent, type ReactNode, type RefObject } from "react";
import { ArrowUpRight, ChevronDown, Ellipsis, X } from "lucide-react";
import { cx } from "../cx";
import { etkinBaglanti, type NavItem, type NavSection } from "./nav";
import { useSidebar } from "./SidebarContext";

export interface AppSidebarProps {
  nav: NavSection[];
  logo: ReactNode;
  logoCollapsed?: ReactNode;
  logoHref?: string;
  logoLabel?: string;
  footer?: ReactNode;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
  labels: { nav: string; closeMenu: string; drawer: string };
  id?: string;
}

function Rozet({ badge, aktif, genis }: { badge: ReactNode; aktif: boolean; genis: boolean }) {
  return (
    <>
      <span
        className={cx(
          "menu-dropdown-badge ms-auto",
          aktif ? "menu-dropdown-badge-active" : "menu-dropdown-badge-inactive",
          !genis && "lg:sr-only"
        )}
      >
        {badge}
      </span>
      {!genis ? <span aria-hidden className="absolute end-2.5 top-2 hidden size-2 rounded-full bg-brand-500 lg:block" /> : null}
    </>
  );
}

function Baglanti({
  href,
  external,
  className,
  title,
  current,
  children,
}: {
  href: string;
  external?: boolean;
  className: string;
  title?: string;
  current?: boolean;
  children: ReactNode;
}) {
  if (external) {
    return (
      <a href={href} className={className} title={title}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} title={title} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

export function AppSidebar({
  nav,
  logo,
  logoCollapsed,
  logoHref = "/",
  logoLabel,
  footer,
  closeButtonRef,
  labels,
  id = "ta-sidebar",
}: AppSidebarProps) {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, closeMobileSidebar } = useSidebar();
  const pathname = usePathname() ?? "";
  const etkin = etkinBaglanti(pathname, nav);
  const genis = isExpanded || isHovered || isMobileOpen;
  const kok = useId();
  /** Kullanıcının açıp kapattığı alt menüler; dokunulmayan, içinde etkin bağlantı varsa açık. */
  const [altMenu, setAltMenu] = useState<Record<string, boolean>>({});

  function odakCikti(e: FocusEvent<HTMLElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsHovered(false);
  }

  function oge(o: NavItem, anahtar: string) {
    const ikon = o.icon ? (
      <span className={cx("shrink-0 [&_svg]:size-6", o.href === etkin ? "menu-item-icon-active" : "menu-item-icon-inactive")}>
        {o.icon}
      </span>
    ) : null;

    if (o.children?.length) {
      const icindeEtkin = o.children.some((a) => a.href === etkin);
      const acik = (altMenu[anahtar] ?? icindeEtkin) && genis;
      const altId = `${kok}-${anahtar}`;
      return (
        <li key={anahtar}>
          <button
            type="button"
            aria-expanded={acik}
            aria-controls={altId}
            title={!genis ? o.label : undefined}
            onClick={() => setAltMenu((m) => ({ ...m, [anahtar]: !(m[anahtar] ?? icindeEtkin) }))}
            className={cx("group menu-item cursor-pointer", icindeEtkin ? "menu-item-active" : "menu-item-inactive", !genis && "lg:justify-center")}
          >
            <span className={cx("shrink-0 [&_svg]:size-6", icindeEtkin ? "menu-item-icon-active" : "menu-item-icon-inactive")}>{o.icon}</span>
            <span className={cx("min-w-0 flex-1 truncate text-start", !genis && "lg:sr-only")}>{o.label}</span>
            {o.badge !== undefined && o.badge !== null ? <Rozet badge={o.badge} aktif={icindeEtkin} genis={genis} /> : null}
            <ChevronDown
              aria-hidden
              className={cx("size-5 shrink-0 transition-transform duration-200", acik && "rotate-180 text-brand-500", !genis && "lg:hidden")}
            />
          </button>
          <div
            id={altId}
            className={cx(
              "grid transition-[grid-template-rows,visibility] duration-300 ease-in-out",
              acik ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
            )}
          >
            <ul className="ms-9 min-h-0 space-y-1 overflow-hidden pt-1">
              {o.children.map((a) => {
                const aktif = a.href === etkin;
                return (
                  <li key={a.href}>
                    <Baglanti
                      href={a.href}
                      external={a.external}
                      current={aktif}
                      className={cx("menu-dropdown-item", aktif ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive")}
                    >
                      <span className="min-w-0 flex-1 truncate">{a.label}</span>
                      {a.badge !== undefined && a.badge !== null ? (
                        <span className={cx("menu-dropdown-badge", aktif ? "menu-dropdown-badge-active" : "menu-dropdown-badge-inactive")}>
                          {a.badge}
                        </span>
                      ) : null}
                      {a.external ? <ArrowUpRight className="size-4 shrink-0 text-gray-500" aria-hidden /> : null}
                    </Baglanti>
                  </li>
                );
              })}
            </ul>
          </div>
        </li>
      );
    }

    if (!o.href) return null;
    const aktif = o.href === etkin;
    return (
      <li key={anahtar}>
        <Baglanti
          href={o.href}
          external={o.external}
          current={aktif}
          title={!genis ? o.label : undefined}
          className={cx("group menu-item", aktif ? "menu-item-active" : "menu-item-inactive", !genis && "lg:justify-center")}
        >
          {ikon}
          <span className={cx("min-w-0 flex-1 truncate", !genis && "lg:sr-only")}>{o.label}</span>
          {o.badge !== undefined && o.badge !== null ? <Rozet badge={o.badge} aktif={aktif} genis={genis} /> : null}
          {o.external ? <ArrowUpRight className={cx("size-4 shrink-0 text-gray-500", !genis && "lg:hidden")} aria-hidden /> : null}
        </Baglanti>
      </li>
    );
  }

  return (
    <aside
      id={id}
      role={isMobileOpen ? "dialog" : undefined}
      aria-modal={isMobileOpen || undefined}
      aria-label={isMobileOpen ? labels.drawer : undefined}
      onMouseEnter={() => {
        if (!isExpanded) setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => {
        if (!isExpanded) setIsHovered(true);
      }}
      onBlur={odakCikti}
      className={cx(
        "fixed inset-y-0 start-0 z-50 flex flex-col border-e border-gray-200 bg-white px-5 text-gray-900 duration-300 ease-in-out print:hidden",
        // Görünürlük yalnızca kapanırken geçişli (kayma bitince gizlenir); açılırken
        // anında görünür olmalı, yoksa kapat düğmesine odak verilemiyordu.
        isMobileOpen ? "transition-[width,translate]" : "transition-[width,translate,visibility]",
        genis ? "w-72.5 max-w-[85vw] lg:max-w-none" : "w-22.5",
        isMobileOpen
          ? "visible translate-x-0 shadow-theme-xl lg:shadow-none"
          : "invisible -translate-x-full rtl:translate-x-full lg:visible lg:translate-x-0 lg:rtl:translate-x-0",
        isHovered && !isExpanded && "lg:shadow-theme-xl"
      )}
    >
      <div className={cx("flex h-16 shrink-0 items-center gap-3 lg:h-18", genis ? "justify-between" : "lg:justify-center")}>
        <Link href={logoHref} aria-label={logoLabel} className="flex min-w-0 items-center">
          {genis || !logoCollapsed ? logo : logoCollapsed}
        </Link>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={closeMobileSidebar}
          aria-label={labels.closeMenu}
          className="-me-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 lg:hidden"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="no-scrollbar -mx-5 flex flex-1 flex-col overflow-y-auto px-5 pt-2 pb-6">
        <nav aria-label={labels.nav} className="flex flex-col gap-6">
          {nav.map((b, i) => (
            <div key={b.title ?? i}>
              {b.title ? (
                <h2
                  className={cx(
                    "mb-3 flex h-5 items-center text-theme-xs font-medium tracking-wide text-gray-500 uppercase",
                    genis ? "justify-start" : "lg:justify-center"
                  )}
                >
                  <span className={cx(!genis && "lg:sr-only")}>{b.title}</span>
                  {!genis ? <Ellipsis aria-hidden className="hidden size-5 text-gray-400 lg:block" /> : null}
                </h2>
              ) : null}
              <ul className="flex flex-col gap-1">{b.items.map((o, j) => oge(o, `${i}-${j}`))}</ul>
            </div>
          ))}
        </nav>
        {footer && genis ? <div className="mt-auto pt-8">{footer}</div> : null}
      </div>
    </aside>
  );
}
