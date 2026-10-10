"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, FileText, History, Inbox, LayoutDashboard, LogOut, UserRound, Users } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/LogoMark";
import { NotificationDropdown, type NotificationItem } from "@/components/tailadmin/header/NotificationDropdown";
import { UserDropdown } from "@/components/tailadmin/header/UserDropdown";
import { DashboardShell } from "@/components/tailadmin/layout/DashboardShell";
import type { NavSection } from "@/components/tailadmin/layout/nav";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { DropdownItem } from "@/components/tailadmin/ui/Dropdown";
import { logoutAction } from "@/lib/admin/actions";
import { CONTENT_ROLES, MANAGE_ROLES, ROLE_LABEL, type Staff } from "@/lib/admin/types";

/**
 * Site yönetimi çerçevesi — TailAdmin kitinin DashboardShell'i: masaüstünde
 * daraltılabilir kenar çubuğu (290/90px), üstte çubuk (bildirim + kullanıcı
 * menüsü), mobilde çekmece. Menü role göre: mesajlar ve personel yönetime,
 * etkinlik yalnızca yöneticiye.
 */

const CHECKUP_ADMIN_URL = process.env.NEXT_PUBLIC_CHECKUP_ADMIN_URL ?? "https://admin.kocum.net";

function menu(staff: Staff, unread?: number): NavSection[] {
  const yonetim = MANAGE_ROLES.includes(staff.role);
  const yazar = CONTENT_ROLES.includes(staff.role);
  const sayi = unread ? (
    <>
      {unread > 99 ? "99+" : unread}
      <span className="sr-only"> okunmamış</span>
    </>
  ) : undefined;

  return [
    { title: "Menü", items: [{ href: "/admin", label: "Genel bakış", icon: <LayoutDashboard />, exact: true }] },
    {
      title: "İçerik",
      items: [
        {
          label: "Blog",
          icon: <FileText />,
          children: [
            { href: "/admin/blog", label: "Yazılar" },
            ...(yazar ? [{ href: "/admin/blog/yeni", label: "Yeni yazı" }] : []),
          ],
        },
      ],
    },
    ...(yonetim
      ? [
          {
            title: "İletişim",
            items: [
              {
                label: "Mesajlar",
                icon: <Inbox />,
                badge: sayi,
                children: [
                  { href: "/admin/mesajlar", label: "Gelen kutusu", badge: sayi },
                  { href: "/admin/mesajlar/sablonlar", label: "Hazır yanıtlar" },
                ],
              },
            ],
          },
          {
            title: "Ekip",
            items: [
              { href: "/admin/personel", label: "Personel", icon: <Users /> },
              ...(staff.role === "admin" ? [{ href: "/admin/etkinlik", label: "Etkinlik", icon: <History /> }] : []),
            ],
          },
        ]
      : []),
    { title: "Hesap", items: [{ href: "/admin/hesabim", label: "Hesabım", icon: <UserRound /> }] },
  ];
}

/** Kenar çubuğunun altı (TailAdmin'in SidebarWidget yeri). */
function CheckupKutusu() {
  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-5 text-center">
      <p className="font-display text-sm font-semibold text-gray-800">Check-up paneli</p>
      <p className="mt-1 mb-4 text-theme-xs text-gray-500">Soru havuzu, paketler ve öğrenciler ayrı panelde; aynı hesapla girilir.</p>
      <ButtonLink href={CHECKUP_ADMIN_URL} variant="outline" size="xs" block endIcon={<ArrowUpRight />}>
        admin.kocum.net
      </ButtonLink>
    </div>
  );
}

function Logo() {
  return (
    <span className="flex flex-col items-start gap-1.5">
      <Wordmark size="sm" />
      <span className="ps-0.5 text-[0.625rem] leading-none font-semibold tracking-[0.16em] text-gray-500 uppercase">Site yönetimi</span>
    </span>
  );
}

export function AdminShell({
  staff,
  unread,
  notifications,
  children,
}: {
  staff: Staff;
  unread?: number;
  /** Okunmamış son mesajlar (yalnızca yönetim rolleri; sunucuda hazırlanır). */
  notifications?: NotificationItem[];
  children: ReactNode;
}) {
  const yonetim = MANAGE_ROLES.includes(staff.role);

  return (
    <DashboardShell
      nav={menu(staff, unread)}
      logo={<Logo />}
      logoCollapsed={<LogoMark />}
      logoHref="/admin"
      logoLabel="Genel bakış"
      sidebarFooter={<CheckupKutusu />}
      headerEnd={
        <>
          {yonetim ? (
            <NotificationDropdown
              items={notifications ?? []}
              count={unread}
              title="Yeni mesajlar"
              label="Yeni mesajlar"
              emptyText="Okunmamış mesaj yok."
              viewAllHref="/admin/mesajlar"
              viewAllLabel="Gelen kutusuna git"
            />
          ) : null}
          <UserDropdown
            name={staff.name}
            detail={`${ROLE_LABEL[staff.role]} · ${staff.email}`}
            footer={
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="xs" block startIcon={<LogOut />}>
                  Çıkış yap
                </Button>
              </form>
            }
          >
            <DropdownItem tag="a" href="/admin/hesabim" icon={<UserRound />}>
              Hesabım
            </DropdownItem>
            <DropdownItem tag="a" href={CHECKUP_ADMIN_URL} external icon={<ArrowUpRight />}>
              Check-up paneli
            </DropdownItem>
          </UserDropdown>
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}
