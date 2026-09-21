"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, TrendingUp, User } from "lucide-react";
import { cn } from "@/lib/cn";

export const NAV_ITEMS = [
  { href: "/panel", label: "Ana sayfa", icon: LayoutDashboard },
  { href: "/paketler", label: "Testler", icon: ClipboardList },
  { href: "/gelisim", label: "Gelişim", icon: TrendingUp },
  { href: "/profil", label: "Profil", icon: User },
] as const;

/**
 * Etkin sekme: tam eşleşme değil ön ek. /paketler/tyt-ilk-15 açıkken
 * "Testler" yanmaya devam etmeli. Sonuç ekranı gelişimin parçası sayılıyor.
 */
function isActive(pathname: string, href: string) {
  if (href === "/gelisim" && pathname.startsWith("/sonuc")) return true;
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Ana menü" className="space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-brand-wash text-brand"
                : "text-ink-soft hover:bg-surface-hover hover:text-ink"
            )}
          >
            <Icon
              className={cn(
                "size-[18px] shrink-0 transition",
                active ? "text-brand" : "text-ink-faint group-hover:text-ink-soft"
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Ana menü"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 pt-2.5 pb-1 text-[11px] font-medium transition",
                active ? "text-brand" : "text-ink-faint"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition",
                  active && "bg-brand-wash"
                )}
              >
                <Icon className="size-[19px]" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
