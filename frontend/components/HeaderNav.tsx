"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";
import { kaydirmayiBirak, kaydirmayiKilitle } from "@/components/tailadmin/lib/scroll-lock";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { gorunenYol, switchLocalePath } from "@/lib/routes";

export interface HeaderNavItem {
  key: string;
  href: string;
  label: string;
  /** Sunucuda çizilmiş ikon (çekmecede). */
  icon: ReactNode;
  /** Yalnızca tam eşleşmede etkin (ana sayfa). */
  exact?: boolean;
}

/** Çekmecenin klavyeyle gezilen öğeleri (Tab döngüsü için). */
const ODAKLANABILIR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Başlığın istemci parçası: masaüstü menüsü (etkin bağlantı) ve mobil
 * çekmece. Logo, iletişim düğmesi ve çekmecedeki düğmeler sunucuda çizilip
 * prop olarak gelir; burada yalnızca adrese bağlı durum ve çekmece var.
 *
 * Çekmece TailAdmin'in mobil kenar çubuğu: 290px beyaz panel, menu-item
 * öğeleri, gri perde. Bir diyalog: açılınca odak kapatma düğmesine gider,
 * Tab panelde döner, Esc kapatır, kapanınca odak menü düğmesine döner;
 * kapalıyken `inert` (ekran dışındaki bağlantılar sekmeyle gezilmez).
 * Sayfa kaydırması kitin sayaçlı kilidiyle durur. Geçişler CSS; hareket
 * azaltmada tokens.css hepsini sıfırlar.
 */
export function HeaderNav({
  locale,
  items,
  logo,
  homeHref,
  cta,
  drawerActions,
  labels,
}: {
  locale: Locale;
  items: HeaderNavItem[];
  logo: ReactNode;
  homeHref: string;
  /** Masaüstü çubuğundaki düğme (lg altında gizli). */
  cta: ReactNode;
  /** Çekmecede menünün altındaki düğmeler. */
  drawerActions: ReactNode;
  labels: { menu: string; close: string; language: string };
}) {
  // Statik üretimde Türkçe sayfanın yolu içeride /tr/…: görünen yola indir.
  const pathname = gorunenYol(usePathname() || "/");
  const [acik, setAcik] = useState(false);
  const menuDugmesi = useRef<HTMLButtonElement>(null);
  const kapatDugmesi = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const acildi = useRef(false);

  const etkin = (o: HeaderNavItem) => (o.exact ? pathname === o.href : pathname === o.href || pathname.startsWith(`${o.href}/`));

  // Açıkken sayfa kaymasın (kitin sayaçlı kilidi).
  useEffect(() => {
    if (!acik) return;
    kaydirmayiKilitle();
    return () => kaydirmayiBirak();
  }, [acik]);

  // Odak yönetimi, Escape ve Tab döngüsü.
  useEffect(() => {
    if (!acik) {
      if (acildi.current) {
        acildi.current = false;
        menuDugmesi.current?.focus();
      }
      return;
    }
    acildi.current = true;
    kapatDugmesi.current?.focus();

    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setAcik(false);
        return;
      }
      const p = panel.current;
      if (e.key !== "Tab" || !p) return;
      const ogeler = Array.from(p.querySelectorAll<HTMLElement>(ODAKLANABILIR));
      if (ogeler.length === 0) return;
      const ilk = ogeler[0];
      const son = ogeler[ogeler.length - 1];
      const aktif = document.activeElement;
      if (e.shiftKey && (aktif === ilk || !p.contains(aktif))) {
        e.preventDefault();
        son.focus();
      } else if (!e.shiftKey && (aktif === son || !p.contains(aktif))) {
        e.preventDefault();
        ilk.focus();
      }
    };
    document.addEventListener("keydown", tus);
    return () => document.removeEventListener("keydown", tus);
  }, [acik]);

  // Pencere masaüstü genişliğine (lg) çıkınca açık kalan çekmeceyi kapat.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 64rem)");
    const degisti = (e: MediaQueryListEvent) => {
      if (e.matches) setAcik(false);
    };
    mq.addEventListener("change", degisti);
    return () => mq.removeEventListener("change", degisti);
  }, []);

  /** Çekmecedeki herhangi bir bağlantıya tıklanınca kapan (sunucudan gelen düğmeler dahil). */
  function baglantiyaTiklandi(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as Element).closest("a[href]")) setAcik(false);
  }

  return (
    <>
      <nav className="hidden items-center gap-1 lg:flex" aria-label={labels.menu}>
        {items.map((o) => (
          <Link
            key={o.key}
            href={o.href}
            aria-current={etkin(o) ? "page" : undefined}
            className={cx(
              "rounded-lg px-3 py-2 text-theme-sm font-medium transition",
              etkin(o) ? "menu-item-active" : "menu-item-inactive"
            )}
          >
            {o.label}
          </Link>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        {cta}
        <button
          ref={menuDugmesi}
          type="button"
          className="flex size-11 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          aria-controls="site-menu"
          aria-expanded={acik}
          aria-haspopup="dialog"
          aria-label={labels.menu}
          onClick={() => setAcik(true)}
        >
          <Menu className="size-5 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>

      {/* Mobil çekmece */}
      <div id="site-menu" className={cx("fixed inset-0 z-[70] lg:hidden", !acik && "pointer-events-none")} inert={!acik}>
        <div
          aria-hidden
          onClick={() => setAcik(false)}
          className={cx(
            "absolute inset-0 bg-gray-900/50 transition-[opacity,visibility] duration-300",
            acik ? "visible opacity-100" : "invisible opacity-0"
          )}
        />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={labels.menu}
          onClick={baglantiyaTiklandi}
          className={cx(
            "absolute inset-y-0 end-0 flex w-72.5 max-w-[85vw] flex-col border-s border-gray-200 bg-white shadow-theme-xl duration-300 ease-in-out",
            // Görünürlük yalnızca kapanırken geçişli: açılırken anında görünür
            // olmalı, yoksa kapat düğmesine odak verilemez (kitin AppSidebar'ı gibi).
            acik ? "visible translate-x-0 transition-[translate]" : "invisible translate-x-full transition-[translate,visibility] rtl:-translate-x-full"
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-5">
            <Link href={homeHref} aria-label="Koçum.Net" className="rounded-lg">
              {logo}
            </Link>
            <button
              ref={kapatDugmesi}
              type="button"
              className="-me-2 flex size-10 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label={labels.close}
              onClick={() => setAcik(false)}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-5 pt-2 pb-6">
            <nav aria-label={labels.menu}>
              <ul className="flex flex-col gap-1">
                {items.map((o) => (
                  <li key={o.key}>
                    <Link
                      href={o.href}
                      aria-current={etkin(o) ? "page" : undefined}
                      className={cx("group menu-item", etkin(o) ? "menu-item-active" : "menu-item-inactive")}
                    >
                      <span className={cx("shrink-0 [&_svg]:size-5", etkin(o) ? "menu-item-icon-active" : "menu-item-icon-inactive")}>
                        {o.icon}
                      </span>
                      {o.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-6 flex flex-col gap-3">{drawerActions}</div>

            <div className="mt-auto pt-8">
              <p className="mb-3 text-theme-xs font-medium tracking-wide text-gray-500 uppercase">{labels.language}</p>
              <SegmentedTabs
                label={labels.language}
                items={LOCALES.map((dil) => ({
                  key: dil,
                  label: <span lang={dil}>{LOCALE_NAMES[dil]}</span>,
                  href: switchLocalePath(pathname, dil),
                  active: dil === locale,
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
