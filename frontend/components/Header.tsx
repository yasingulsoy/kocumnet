"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type SVGProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SITE_BRAND } from "@/lib/site-brand";
import { LogoMark } from "./LogoMark";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import { localizedPath, switchLocalePath, type RouteKey } from "@/lib/routes";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const TOP_BLUE = "#1a5fb4";

function BarDivider() {
  return <span className="hidden h-3 w-px shrink-0 bg-white/45 sm:inline" aria-hidden />;
}

function IconInstagram(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function IconPin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function IconSend(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

function IconGlobe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Küre + ekvator + tam boy meridyen (küçük boyutta net okunur) */}
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3z" />
    </svg>
  );
}

function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

const NAV_KEYS: RouteKey[] = ["home", "about", "services", "blog", "contact"];

const easeOut = [0.22, 1, 0.36, 1] as const;

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const pathname = usePathname() || "/";
  const [panelOpen, setPanelOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    document.body.style.overflow = panelOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!langOpen) return;
    const close = () => setLangOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [langOpen]);

  // Sayfa aşağı kaydırılınca header'a gölge ver (içerikten ayrışsın)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinkClass =
    "flex items-center gap-1 whitespace-nowrap px-1 py-2 text-[15px] font-medium tracking-tight text-[#222] transition-colors hover:text-[#1a5fb4] lg:text-[14px] xl:text-[15px]";

  const navItems = NAV_KEYS.map((key) => ({
    key,
    href: localizedPath(key, locale),
    label: dict.nav[key],
  }));

  return (
    <>
      {/*
        Gölge geçişi bilerek SAF CSS. Sticky bir öğeye kaydırma boyunca JS'ten
        stil yazmak (framer-motion animate) titremeye yol açabiliyor.
      */}
      <header
        className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${
          scrolled
            ? "shadow-[0_12px_40px_-20px_rgba(23,48,94,0.35)]"
            : "shadow-[0_1px_0_0_rgba(0,0,0,0.06)]"
        }`}
      >
        {/*
          Üst bar mobilde de TEK SIRA. 375px'e dört öğenin tam metni sığmadığı için
          mobilde konum metni gizlenir (footer ve iletişim sayfasında zaten var),
          Instagram ikon-only olur. E-posta ve dil seçici her boyutta görünür.
        */}
        <div className="text-[13px] font-normal text-white" style={{ backgroundColor: TOP_BLUE }}>
          <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-4 py-2 sm:gap-4 sm:py-2.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-x-4">
              <span className="hidden items-center gap-2 sm:inline-flex">
                <IconPin className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                <span className="whitespace-nowrap">
                  {SITE_BRAND.addressLocality}, {dict.nav.country}
                </span>
              </span>
              <BarDivider />
              <span className="inline-flex min-w-0 items-center gap-2">
                <IconSend className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
                <a href={`mailto:${SITE_BRAND.email}`} className="truncate hover:underline">
                  {SITE_BRAND.email}
                </a>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-x-3 sm:gap-x-4">
              <a
                href={SITE_BRAND.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition hover:opacity-80"
                aria-label={`Instagram: ${SITE_BRAND.instagramHandle}`}
              >
                <IconInstagram className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{SITE_BRAND.instagramHandle}</span>
              </a>
              <BarDivider />
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 py-1 hover:underline"
                  aria-expanded={langOpen}
                  aria-label={dict.nav.language}
                  onClick={() => setLangOpen((v) => !v)}
                >
                  <IconGlobe className="h-4 w-4" aria-hidden />
                  {LOCALE_NAMES[locale]}
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <AnimatePresence>
                  {langOpen && (
                    <motion.ul
                      className="absolute end-0 top-full z-[60] mt-1 min-w-[9rem] rounded border border-black/10 bg-white py-1 text-sm text-[#222] shadow-lg"
                      initial={reduce ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: easeOut }}
                    >
                      {LOCALES.map((loc) => (
                        <li key={loc}>
                          <Link
                            href={switchLocalePath(pathname, loc)}
                            hrefLang={loc}
                            className={`block w-full px-3 py-2 text-start hover:bg-neutral-100 ${
                              locale === loc ? "font-semibold text-[#1a5fb4]" : ""
                            }`}
                            onClick={() => setLangOpen(false)}
                          >
                            {LOCALE_NAMES[loc]}
                          </Link>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="relative bg-white">
          <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-4 lg:gap-6 lg:px-8 lg:py-5">
            <Link
              href={localizedPath("home", locale)}
              className="flex shrink-0 items-center gap-3"
              onClick={() => setPanelOpen(false)}
            >
              <LogoMark className="h-11 w-11 shrink-0 sm:h-12 sm:w-12" />
              <span className="font-sans text-xl font-bold tracking-tight text-[#1b1b1b] sm:text-2xl">
                Koçum.Net
              </span>
            </Link>

            <nav className="hidden items-center gap-6 xl:gap-8 min-[1100px]:flex" aria-label={dict.nav.menu}>
              {navItems.map((item) => (
                <Link key={item.key} href={item.href} className={navLinkClass}>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Link
                href={localizedPath("contact", locale)}
                className="hidden min-h-11 items-center rounded-[5px] bg-[#1a5fb4] px-5 text-[12px] font-bold uppercase tracking-wider text-white transition hover:bg-[#154a94] min-[1100px]:inline-flex"
              >
                {dict.nav.contact}
              </Link>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center text-[#1a5fb4] transition hover:bg-neutral-50 min-[1100px]:hidden"
                aria-controls="side-panel"
                aria-label={dict.nav.menu}
                onClick={() => setPanelOpen(true)}
              >
                <IconMenu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        id="side-panel"
        className={`fixed inset-0 z-[70] ${panelOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!panelOpen}
      >
        <AnimatePresence>
          {panelOpen && (
            <motion.button
              key="backdrop"
              type="button"
              className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.22, ease: easeOut }}
              aria-label={dict.nav.close}
              onClick={() => setPanelOpen(false)}
            />
          )}
        </AnimatePresence>
        <div
          className={`absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-white shadow-[-8px_0_40px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out ${
            panelOpen ? "translate-x-0" : "ltr:translate-x-full rtl:-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <span className="flex items-center gap-2 font-bold text-[#1b1b1b]">
              <LogoMark className="h-9 w-9" />
              Koçum.Net
            </span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center text-[#1a5fb4] hover:bg-neutral-50"
              aria-label={dict.nav.close}
              onClick={() => setPanelOpen(false)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex flex-1 flex-col overflow-y-auto px-5 py-6 text-[15px]" aria-label={dict.nav.menu}>
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="border-b border-neutral-100 py-4 font-medium text-[#222]"
                onClick={() => setPanelOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={localizedPath("contact", locale)}
              className="mt-6 bg-[#1a5fb4] py-3.5 text-center text-[12px] font-bold uppercase tracking-wider text-white hover:bg-[#154a94]"
              onClick={() => setPanelOpen(false)}
            >
              {dict.nav.contact}
            </Link>

            <div className="mt-8 border-t border-neutral-100 pt-6">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                {dict.nav.language}
              </p>
              <div className="flex flex-wrap gap-2">
                {LOCALES.map((loc) => (
                  <Link
                    key={loc}
                    href={switchLocalePath(pathname, loc)}
                    hrefLang={loc}
                    onClick={() => setPanelOpen(false)}
                    className={`rounded border px-3 py-2 text-sm ${
                      locale === loc
                        ? "border-[#1a5fb4] bg-[#1a5fb4] text-white"
                        : "border-neutral-200 text-[#222] hover:border-[#1a5fb4]"
                    }`}
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
