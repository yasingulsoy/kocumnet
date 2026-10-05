"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  ArrowUpRight,
  ChartColumn,
  Database,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Package,
  Target,
  UserRoundX,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutRequest } from "@/lib/api";
import { MANAGE_ROLES, ROLE_LABEL, type Staff, type StaffRole } from "@/lib/checkup/roles";
import { Wordmark } from "@/components/brand/Logo";

/**
 * Panel çerçevesi: masaüstünde sabit sol kenar çubuğu, mobilde üst çubuk +
 * çekmece. Öğrenci uygulamasının çerçevesiyle aynı ölçüler (264px) ve aynı
 * belirteçler — iki ürün yan yana açılınca akraba görünsün.
 *
 * Personel bilgisi sunucudan geliyor ((admin)/layout.tsx → checkStaff);
 * istemci tarafında ayrı bir doğrulama turu YOK. Eskiden istemci düzeni
 * oturumu tarayıcıdan bir kez daha soruyor ve her sayfada önce bir dönen
 * halka gösteriyordu.
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Yalnızca bu roller görür. Yoksa tüm personel. */
  roles?: readonly StaffRole[];
}

const NAV: NavItem[] = [
  { href: "/checkup", label: "Genel bakış", icon: LayoutDashboard },
  { href: "/checkup/sorular", label: "Sorular", icon: ListChecks },
  { href: "/checkup/sorular/analiz", label: "Madde analizi", icon: ChartColumn },
  { href: "/checkup/kazanimlar", label: "Kazanımlar", icon: Target },
  { href: "/checkup/havuz", label: "Havuz durumu", icon: Database },
  { href: "/checkup/paketler", label: "Paketler", icon: Package },
  { href: "/checkup/seviyeli", label: "Seviyeli koşular", icon: Layers },
  // Öğrenci kişisel verisi: editör ve görüntüleyici sayfayı açamıyor (sunucu
  // reddediyor); menüde görmesi yalnızca "yetkin yok" kutusuna götürüyordu.
  { href: "/checkup/ogrenciler", label: "Öğrenciler", icon: Users, roles: MANAGE_ROLES },
  { href: "/checkup/ogrenciler/riskli", label: "Riskli öğrenciler", icon: UserRoundX, roles: MANAGE_ROLES },
];

const SITE_ADMIN_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kocum.net").replace(/\/$/, "") + "/admin";

/**
 * Etkin menü öğesi: adresle eşleşen EN UZUN bağlantı. "/checkup/sorular/analiz"
 * açıkken hem "Sorular" hem "Madde analizi" yanmasın.
 */
function etkinHref(pathname: string, items: NavItem[]): string | null {
  let en: string | null = null;
  for (const { href } of items) {
    const eslesir = pathname === href || pathname.startsWith(href + "/");
    if (eslesir && (!en || href.length > en.length)) en = href;
  }
  return en;
}

function Nav({ pathname, role, onNavigate }: { pathname: string; role: StaffRole; onNavigate?: () => void }) {
  const items = NAV.filter((i) => !i.roles || i.roles.includes(role));
  const etkin = etkinHref(pathname, items);
  return (
    <nav aria-label="Ana menü" className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const on = href === etkin;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            className={clsx(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-caption font-medium transition",
              on ? "bg-brand-wash text-brand" : "text-ink-soft hover:bg-surface-hover hover:text-ink"
            )}
          >
            <Icon
              className={clsx(
                "size-[18px] shrink-0 transition",
                on ? "text-brand" : "text-ink-faint group-hover:text-ink-soft"
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function StaffCard({ staff }: { staff: Staff }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const basHarf = staff.name.trim().charAt(0).toLocaleUpperCase("tr-TR");

  async function cikis() {
    setPending(true);
    await logoutRequest();
    router.push("/signin");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-sunk p-2.5">
      <span
        aria-hidden
        className="bg-brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-caption font-semibold text-white"
      >
        {basHarf}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption font-semibold text-ink">{staff.name}</p>
        <p className="truncate text-micro text-ink-faint">{ROLE_LABEL[staff.role]}</p>
      </div>
      <button
        type="button"
        onClick={cikis}
        disabled={pending}
        aria-label="Çıkış yap"
        title="Çıkış yap"
        className="flex size-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-surface hover:text-bad disabled:opacity-50"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

export function AdminShell({ staff, children }: { staff: Staff; children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [acik, setAcik] = useState(false);
  const menuDugmesi = useRef<HTMLButtonElement>(null);
  const kapatDugmesi = useRef<HTMLButtonElement>(null);

  /*
   * Çekmece bağlantıya tıklanınca kapanır (onNavigate). Adres değişimini
   * efektte izleyip setState çağırmak React Compiler kuralına takılıyor ve
   * fazladan bir çizim turu demek; onNavigate aynı işi tıklama anında yapar.
   *
   * Açıkken: gövde kaydırması kilitli, odak çekmecede, Escape kapatır.
   * Kapanınca odak menü düğmesine döner — klavye ve ekran okuyucu
   * kullanıcısı sayfanın başına fırlamasın.
   */
  useEffect(() => {
    if (!acik) return;
    document.body.style.overflow = "hidden";
    const geriOdak = menuDugmesi.current;
    kapatDugmesi.current?.focus();
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAcik(false);
    };
    window.addEventListener("keydown", tus);
    return () => {
      window.removeEventListener("keydown", tus);
      document.body.style.overflow = "";
      geriOdak?.focus({ preventScroll: true });
    };
  }, [acik]);

  return (
    <div className="min-h-screen lg:ps-[264px]">
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-brand-deep focus:px-4 focus:py-2.5 focus:text-caption focus:font-semibold focus:text-white"
      >
        İçeriğe geç
      </a>

      {/* Masaüstü kenar çubuğu */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[264px] flex-col border-e border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/checkup" aria-label="Genel bakış">
            <Wordmark />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Nav pathname={pathname} role={staff.role} />
        </div>
        <div className="border-t border-line p-3">
          <a
            href={SITE_ADMIN_URL}
            className="mb-2 flex items-center justify-between rounded-xl px-3 py-2 text-caption text-ink-soft transition hover:bg-surface-hover hover:text-ink"
          >
            Site yönetimi (blog, mesajlar)
            <ArrowUpRight className="size-3.5" />
          </a>
          <StaffCard staff={staff} />
        </div>
      </aside>

      {/* Mobil üst çubuk */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Link href="/checkup" aria-label="Genel bakış" className="flex items-center gap-2">
          <Wordmark compact />
          <span className="rounded-md bg-surface-sunk px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wider text-ink-soft">
            panel
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

      {/* Mobil çekmece */}
      <div
        id="mobil-menu"
        className={clsx("fixed inset-0 z-50 lg:hidden", acik ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!acik}
        // Kapalı çekmecedeki bağlantılar Tab ile odaklanmasın (görünmez odak tuzağı).
        inert={!acik}
      >
        <button
          type="button"
          aria-hidden
          // Yalnızca fareyle/dokunarak kapatmak için; klavyede X düğmesi ve Escape var.
          tabIndex={-1}
          onClick={() => setAcik(false)}
          className={clsx(
            "absolute inset-0 bg-brand-deep/40 backdrop-blur-[2px] transition-opacity duration-200",
            acik ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menü"
          className={clsx(
            "absolute inset-y-0 start-0 flex w-[280px] max-w-[85vw] flex-col bg-surface shadow-pop transition-transform duration-300 ease-out",
            acik ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <Wordmark compact />
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
            <Nav pathname={pathname} role={staff.role} onNavigate={() => setAcik(false)} />
          </div>
          <div className="border-t border-line p-3">
            <a
              href={SITE_ADMIN_URL}
              className="mb-2 flex items-center justify-between rounded-xl px-3 py-2 text-caption text-ink-soft transition hover:bg-surface-hover hover:text-ink"
            >
              Site yönetimi
              <ArrowUpRight className="size-3.5" />
            </a>
            <StaffCard staff={staff} />
          </div>
        </div>
      </div>

      <main id="icerik" className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
