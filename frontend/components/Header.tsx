"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Globe, Mail, MapPin, Menu, X } from "lucide-react";
import { SITE_BRAND } from "@/lib/site-brand";
import { CHECKUP_URL } from "@/lib/site";
import { Wordmark } from "./LogoMark";
import { InstagramIcon } from "./icons";
import { buttonClass, cn } from "./ui";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { localizedPath, switchLocalePath, type RouteKey } from "@/lib/routes";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const NAV_KEYS: RouteKey[] = ["home", "about", "services", "products", "blog", "contact"];

/** Panelin klavyeyle gezilen öğeleri (Tab döngüsü için). */
const ODAKLANABILIR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Site başlığı: ince marka şeridi (konum · e-posta · Instagram · dil) ve
 * ana çubuk (logo · menü · iletişim düğmesi). 1100px altında menü yan
 * panele iner.
 *
 * Gölge geçişi bilerek SAF CSS: sticky bir öğeye kaydırma boyunca JS'ten
 * stil yazmak titremeye yol açabiliyor.
 *
 * Dil menüsü ve arka perde de CSS geçişiyle açılıp kapanıyor (eskiden
 * framer-motion AnimatePresence). İkisi de hep DOM'da; kapalıyken
 * `invisible`: odaklanılamaz, ekran okuyucu görmez. visibility geçişi
 * kapanırken sona kadar "görünür" kaldığı için çıkış animasyonu da oynar.
 * Hareket azaltmada tokens.css bütün geçişleri sıfırlıyor.
 *
 * Yan panel bir diyalog: açılınca odak içine girer, Tab panelde döner,
 * Escape kapatır, kapanınca odak menü düğmesine döner. Kapalıyken `inert`:
 * eskiden yalnızca aria-hidden idi ve ekran dışındaki 11 bağlantı sekmeyle
 * geziliyordu — masaüstünde bile, görünmeyen menüde.
 */
export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const pathname = usePathname() || "/";
  const [panelOpen, setPanelOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelAcikti = useRef(false);
  const langWrapRef = useRef<HTMLDivElement>(null);
  const langButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.style.overflow = panelOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [panelOpen]);

  // Yan panel: odak yönetimi, Escape ve Tab döngüsü.
  useEffect(() => {
    if (!panelOpen) {
      if (panelAcikti.current) {
        panelAcikti.current = false;
        menuButtonRef.current?.focus();
      }
      return;
    }
    panelAcikti.current = true;
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPanelOpen(false);
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const ogeler = Array.from(panel.querySelectorAll<HTMLElement>(ODAKLANABILIR));
      if (ogeler.length === 0) return;
      const ilk = ogeler[0];
      const son = ogeler[ogeler.length - 1];
      const aktif = document.activeElement;
      if (e.shiftKey && (aktif === ilk || !panel.contains(aktif))) {
        e.preventDefault();
        son.focus();
      } else if (!e.shiftKey && (aktif === son || !panel.contains(aktif))) {
        e.preventDefault();
        ilk.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelOpen]);

  // Pencere masaüstü genişliğine çıkınca açık kalan paneli kapat.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setPanelOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Dil menüsü: dışarı tıklayınca ya da Escape ile kapanır.
  useEffect(() => {
    if (!langOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!langWrapRef.current?.contains(e.target as Node)) setLangOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLangOpen(false);
        langButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [langOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = NAV_KEYS.map((key) => ({
    key,
    href: localizedPath(key, locale),
    label: dict.nav[key],
    active:
      key === "home"
        ? pathname === localizedPath("home", locale)
        : pathname.startsWith(localizedPath(key, locale)),
  }));

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 bg-surface transition-shadow duration-300",
          scrolled ? "shadow-raised" : "shadow-[0_1px_0_0_var(--line)]"
        )}
      >
        {/* Marka şeridi — mobilde tek sıra: konum gizlenir, Instagram ikon kalır. */}
        <div className="bg-brand-deep text-caption text-white/85">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-2 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <MapPin className="size-3.5 shrink-0 text-white/60" aria-hidden />
                {SITE_BRAND.addressLocality}, {dict.nav.country}
              </span>
              <a
                href={`mailto:${SITE_BRAND.email}`}
                className="inline-flex min-w-0 items-center gap-1.5 transition hover:text-white"
              >
                <Mail className="size-3.5 shrink-0 text-white/60" aria-hidden />
                <span className="truncate">{SITE_BRAND.email}</span>
              </a>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {/* Check-up uygulaması adresi tanımlıysa her sayfadan bir tık uzakta. */}
              {CHECKUP_URL ? (
                <a
                  href={CHECKUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden items-center gap-1 font-semibold text-white transition hover:underline md:inline-flex"
                >
                  {dict.nav.checkup}
                  <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                  <span className="sr-only"> ({dict.nav.opensInNewTab})</span>
                </a>
              ) : null}
              <a
                href={SITE_BRAND.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition hover:text-white"
                aria-label={`Instagram: ${SITE_BRAND.instagramHandle}`}
              >
                <InstagramIcon className="size-3.5" />
                <span className="hidden sm:inline">{SITE_BRAND.instagramHandle}</span>
              </a>
              <div
                ref={langWrapRef}
                className="relative"
                onBlur={(e) => {
                  // Tab ile menünün dışına geçilince kapan. relatedTarget boşsa
                  // (Safari tıklanan bağlantıya odak vermez) dışarı tıklamayı
                  // pointerdown dinleyicisi zaten yakalıyor.
                  const sonraki = e.relatedTarget as Node | null;
                  if (langOpen && sonraki && !e.currentTarget.contains(sonraki)) setLangOpen(false);
                }}
              >
                <button
                  ref={langButtonRef}
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-1.5 transition hover:text-white"
                  aria-expanded={langOpen}
                  aria-controls="dil-menusu"
                  aria-label={`${dict.nav.language}: ${LOCALE_NAMES[locale]}`}
                  onClick={() => setLangOpen((v) => !v)}
                >
                  <Globe className="size-3.5" aria-hidden />
                  {LOCALE_NAMES[locale]}
                  <ChevronDown
                    className={cn("size-3 transition-transform", langOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
                <ul
                  id="dil-menusu"
                  className={cn(
                    "absolute end-0 top-full z-[60] mt-1.5 min-w-[9.5rem] rounded-xl border border-line bg-surface p-1 text-body text-ink shadow-raised",
                    "transition-[opacity,translate,visibility] duration-[180ms] ease-out",
                    langOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1.5 opacity-0"
                  )}
                >
                  {LOCALES.map((loc) => (
                    <li key={loc}>
                      <Link
                        href={switchLocalePath(pathname, loc)}
                        hrefLang={loc}
                        lang={loc}
                        aria-current={locale === loc ? "true" : undefined}
                        className={cn(
                          "block w-full rounded-lg px-3 py-2 text-start transition hover:bg-surface-hover",
                          locale === loc && "bg-brand-wash font-semibold text-brand"
                        )}
                        onClick={() => setLangOpen(false)}
                      >
                        {LOCALE_NAMES[loc]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Ana çubuk */}
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:h-20">
          <Link
            href={localizedPath("home", locale)}
            className="shrink-0 rounded-xl"
            aria-label="Koçum.Net"
            onClick={() => setPanelOpen(false)}
          >
            <Wordmark size="lg" />
          </Link>

          <nav className="hidden items-center gap-1 min-[1100px]:flex" aria-label={dict.nav.menu}>
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-body font-medium transition",
                  item.active
                    ? "bg-brand-wash text-brand"
                    : "text-ink-soft hover:bg-surface-hover hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={localizedPath("contact", locale)}
              className={cn(buttonClass({ size: "md" }), "max-[1099px]:hidden")}
            >
              {dict.nav.contact}
            </Link>
            <button
              ref={menuButtonRef}
              type="button"
              className="flex size-11 items-center justify-center rounded-xl text-ink transition hover:bg-surface-hover min-[1100px]:hidden"
              aria-controls="side-panel"
              aria-expanded={panelOpen}
              aria-haspopup="dialog"
              aria-label={dict.nav.menu}
              onClick={() => setPanelOpen(true)}
            >
              <Menu className="size-6" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      {/* Mobil yan panel */}
      <div
        id="side-panel"
        className={cn("fixed inset-0 z-[70]", panelOpen ? "pointer-events-auto" : "pointer-events-none")}
        inert={!panelOpen}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className={cn(
            "absolute inset-0 bg-brand-deep/40 backdrop-blur-[2px] transition-[opacity,visibility] duration-[220ms] ease-out",
            panelOpen ? "visible opacity-100" : "invisible opacity-0"
          )}
          onClick={() => setPanelOpen(false)}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={dict.nav.menu}
          className={cn(
            "absolute inset-y-0 end-0 flex w-full max-w-sm flex-col bg-surface shadow-pop transition-transform duration-300 ease-out",
            panelOpen ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
          )}
        >
          <div className="flex h-[4.5rem] items-center justify-between border-b border-line px-5">
            <Wordmark />
            <button
              ref={closeButtonRef}
              type="button"
              className="flex size-11 items-center justify-center rounded-xl text-ink transition hover:bg-surface-hover"
              aria-label={dict.nav.close}
              onClick={() => setPanelOpen(false)}
            >
              <X className="size-6" aria-hidden />
            </button>
          </div>
          <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4" aria-label={dict.nav.menu}>
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-3.5 text-lead font-medium transition",
                  item.active ? "bg-brand-wash text-brand" : "text-ink hover:bg-surface-hover"
                )}
                onClick={() => setPanelOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={localizedPath("contact", locale)}
              className={cn(buttonClass({ size: "lg", block: true }), "mt-6")}
              onClick={() => setPanelOpen(false)}
            >
              {dict.nav.contact}
            </Link>
            {CHECKUP_URL ? (
              <a
                href={CHECKUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonClass({ variant: "soft", size: "lg", block: true }), "mt-3")}
                onClick={() => setPanelOpen(false)}
              >
                {dict.nav.checkup}
                <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
                <span className="sr-only"> ({dict.nav.opensInNewTab})</span>
              </a>
            ) : null}

            <div className="mt-8 border-t border-line px-3 pt-6">
              <p className="mb-3 text-micro font-semibold uppercase tracking-[0.18em] text-ink-faint">
                {dict.nav.language}
              </p>
              <div className="flex flex-wrap gap-2">
                {LOCALES.map((loc) => (
                  <Link
                    key={loc}
                    href={switchLocalePath(pathname, loc)}
                    hrefLang={loc}
                    lang={loc}
                    aria-current={locale === loc ? "true" : undefined}
                    onClick={() => setPanelOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-caption font-medium ring-1 ring-inset transition",
                      locale === loc
                        ? "bg-brand text-white ring-brand"
                        : "text-ink ring-line-strong hover:bg-surface-hover"
                    )}
                  >
                    {LOCALE_NAMES[loc]}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
