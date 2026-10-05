"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  FileText,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/LogoMark";
import { cn } from "@/components/ui";
import { logoutAction } from "@/lib/admin/actions";
import { MANAGE_ROLES, ROLE_LABEL, type Staff } from "@/lib/admin/types";

/**
 * Site yönetimi çerçevesi — check-up paneliyle (admin/) aynı ölçüler ve aynı
 * belirteçler: 264px kenar çubuğu, mobilde üst çubuk + çekmece. Personel iki
 * panel arasında geçince aynı yerde aynı şeyi bulsun.
 */

const CHECKUP_ADMIN_URL = process.env.NEXT_PUBLIC_CHECKUP_ADMIN_URL ?? "https://admin.kocum.net";

function nav(staff: Staff) {
  const yonetim = MANAGE_ROLES.includes(staff.role);
  return [
    { href: "/admin", label: "Genel bakış", icon: LayoutDashboard, exact: true },
    { href: "/admin/blog", label: "Blog", icon: FileText },
    ...(yonetim ? [{ href: "/admin/mesajlar", label: "Mesajlar", icon: Inbox }] : []),
    ...(yonetim ? [{ href: "/admin/personel", label: "Personel", icon: Users }] : []),
    ...(staff.role === "admin" ? [{ href: "/admin/etkinlik", label: "Etkinlik", icon: History }] : []),
    { href: "/admin/hesabim", label: "Hesabım", icon: UserCircle },
  ];
}

function aktif(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function Nav({ staff, pathname, onNavigate, unread }: { staff: Staff; pathname: string; onNavigate?: () => void; unread?: number }) {
  return (
    <nav aria-label="Ana menü" className="space-y-1">
      {nav(staff).map(({ href, label, icon: Icon, exact }) => {
        const on = aktif(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-caption font-medium transition",
              on ? "bg-brand-wash text-brand" : "text-ink-soft hover:bg-surface-hover hover:text-ink"
            )}
          >
            <Icon className={cn("size-[18px] shrink-0 transition", on ? "text-brand" : "text-ink-faint group-hover:text-ink-soft")} />
            <span className="flex-1">{label}</span>
            {href === "/admin/mesajlar" && unread ? (
              <span className="tabular rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {unread > 99 ? "99+" : unread}
                <span className="sr-only"> okunmamış</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function StaffCard({ staff }: { staff: Staff }) {
  const basHarf = staff.name.trim().charAt(0).toLocaleUpperCase("tr-TR");
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-sunk p-2.5">
      <span aria-hidden className="bg-brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-caption font-semibold text-white">
        {basHarf}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption font-semibold text-ink">{staff.name}</p>
        <p className="truncate text-micro text-ink-faint">{ROLE_LABEL[staff.role]}</p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          aria-label="Çıkış yap"
          title="Çıkış yap"
          className="flex size-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-surface hover:text-bad"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

function Alt({ staff }: { staff: Staff }) {
  return (
    <div className="border-t border-line p-3">
      <a
        href={CHECKUP_ADMIN_URL}
        className="mb-2 flex items-center justify-between rounded-xl px-3 py-2 text-caption text-ink-soft transition hover:bg-surface-hover hover:text-ink"
      >
        Check-up paneli
        <ArrowUpRight className="size-3.5" />
      </a>
      <StaffCard staff={staff} />
    </div>
  );
}

export function AdminShell({ staff, unread, children }: { staff: Staff; unread?: number; children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const [acik, setAcik] = useState(false);
  const menuDugmesi = useRef<HTMLButtonElement>(null);
  const kapatDugmesi = useRef<HTMLButtonElement>(null);
  const actiMi = useRef(false);

  /*
   * Mobil çekmece: açıkken arka plan kaymaz, Escape kapatır, odak çekmeceye
   * girer ve kapanınca menü düğmesine döner. Kapalıyken `inert`: eskiden
   * ekran dışındaki bağlantılar Tab ile odaklanabiliyordu (görünmeyen odak).
   */
  useEffect(() => {
    document.body.style.overflow = acik ? "hidden" : "";
    if (acik) {
      actiMi.current = true;
      kapatDugmesi.current?.focus();
    } else if (actiMi.current) {
      actiMi.current = false;
      menuDugmesi.current?.focus();
    }
    if (!acik) return;
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAcik(false);
    };
    // Açıkken pencere masaüstü genişliğine çıkarsa çekmece (lg:hidden) görünmez
    // olur ama arka plan inert kalırdı: kapat.
    const genis = window.matchMedia("(min-width: 1024px)");
    const boyut = () => {
      if (genis.matches) setAcik(false);
    };
    document.addEventListener("keydown", tus);
    genis.addEventListener("change", boyut);
    return () => {
      document.removeEventListener("keydown", tus);
      genis.removeEventListener("change", boyut);
      document.body.style.overflow = "";
    };
  }, [acik]);

  return (
    <div className="min-h-screen bg-canvas lg:ps-[264px]">
      <a href="#icerik" className="skip-link">
        İçeriğe geç
      </a>

      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[264px] flex-col border-e border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/admin" aria-label="Genel bakış" className="flex flex-col items-start gap-1.5">
            <Wordmark className="h-7" />
            <span className="ps-0.5 text-[9.5px] font-semibold uppercase leading-none tracking-[0.16em] text-ink-faint">
              Site yönetimi
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Nav staff={staff} pathname={pathname} unread={unread} />
        </div>
        <Alt staff={staff} />
      </aside>

      <header inert={acik} className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Link href="/admin" aria-label="Genel bakış" className="flex items-center gap-2">
          <Wordmark className="h-[22px]" />
          <span className="rounded-md bg-surface-sunk px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
            yönetim
          </span>
        </Link>
        <button
          ref={menuDugmesi}
          type="button"
          onClick={() => setAcik(true)}
          aria-label="Menüyü aç"
          aria-expanded={acik}
          aria-controls="mobil-menu"
          className="-me-2 flex size-11 items-center justify-center rounded-xl text-ink transition active:bg-surface-sunk"
        >
          <Menu className="size-6" />
        </button>
      </header>

      <div
        id="mobil-menu"
        className={cn("fixed inset-0 z-50 lg:hidden", acik ? "pointer-events-auto" : "pointer-events-none")}
        inert={!acik}
        role="dialog"
        aria-modal="true"
        aria-label="Menü"
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => setAcik(false)}
          className={cn("absolute inset-0 bg-brand-deep/40 backdrop-blur-[2px] transition-opacity duration-200", acik ? "opacity-100" : "opacity-0")}
        />
        <div
          className={cn(
            "absolute inset-y-0 start-0 flex w-[280px] max-w-[85vw] flex-col bg-surface shadow-pop transition-transform duration-300 ease-out",
            acik ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <Wordmark className="h-[22px]" />
            <button
              ref={kapatDugmesi}
              type="button"
              onClick={() => setAcik(false)}
              aria-label="Menüyü kapat"
              className="flex size-10 items-center justify-center rounded-xl text-ink transition hover:bg-surface-hover"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <Nav staff={staff} pathname={pathname} unread={unread} onNavigate={() => setAcik(false)} />
          </div>
          <Alt staff={staff} />
        </div>
      </div>

      {/* Çekmece açıkken arkası odaklanamaz (odak tuzağı): Tab çekmecede kalır. */}
      <main id="icerik" inert={acik} className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
