"use client";

import type { ReactNode } from "react";
import {
  BookOpenCheck,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { UserDropdown } from "@/components/tailadmin/header/UserDropdown";
import { DashboardShell } from "@/components/tailadmin/layout/DashboardShell";
import type { NavSection } from "@/components/tailadmin/layout/nav";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { DropdownItem } from "@/components/tailadmin/ui/Dropdown";
import { BildirimSaglayici } from "@/components/Bildirim";
import { LogoMark, PanelLogosu } from "@/components/Logo";
import { ROL_ADI } from "@/lib/bicim";
import { cikisYap } from "@/lib/eylemler/oturum";
import type { Yonetici } from "@/lib/tipler";

/**
 * Panel çerçevesi: TailAdmin DashboardShell (masaüstünde daraltılabilir
 * kenar çubuğu, 1024px altında çekmece). Menü role göre: Öğrenciler ve
 * Yöneticiler yalnızca YONETICI'ye görünür. Asıl yetki backend'de.
 */
function menu(y: Yonetici): NavSection[] {
  const yonetici = y.rol === "YONETICI";
  return [
    { items: [{ href: "/", label: "Pano", icon: <LayoutDashboard />, exact: true }] },
    {
      title: "İçerik",
      items: [
        { href: "/sinavlar", label: "Sınavlar", icon: <GraduationCap /> },
        { href: "/turler", label: "Check-up türleri", icon: <Layers /> },
        {
          label: "Sorular",
          icon: <ListChecks />,
          children: [
            { href: "/sorular", label: "Soru listesi" },
            { href: "/sorular/yeni", label: "Yeni soru", exact: true },
          ],
        },
        { href: "/ice-aktar", label: "Excel'den içe aktar", icon: <FileSpreadsheet /> },
      ],
    },
    ...(yonetici
      ? [
          {
            title: "Yönetim",
            items: [
              { href: "/ogrenciler", label: "Öğrenciler", icon: <BookOpenCheck />, match: ["/checkuplar"] },
              { href: "/yoneticiler", label: "Yöneticiler", icon: <ShieldCheck /> },
            ],
          },
        ]
      : []),
    { title: "Hesap", items: [{ href: "/hesap", label: "Hesabım", icon: <UserRound /> }] },
  ];
}

export function PanelCercevesi({ yonetici, children }: { yonetici: Yonetici; children: ReactNode }) {
  return (
    <DashboardShell
      nav={menu(yonetici)}
      logo={<PanelLogosu />}
      logoCollapsed={<LogoMark />}
      logoHref="/"
      logoLabel="Pano"
      headerEnd={
        <>
          <Badge size="sm" color={yonetici.rol === "YONETICI" ? "primary" : "info"} className="hidden sm:inline-flex">
            {ROL_ADI[yonetici.rol]}
          </Badge>
          <UserDropdown
            name={yonetici.adSoyad}
            detail={`${ROL_ADI[yonetici.rol]} · ${yonetici.eposta}`}
            footer={
              <form action={cikisYap}>
                <Button type="submit" variant="outline" size="xs" block startIcon={<LogOut />}>
                  Çıkış yap
                </Button>
              </form>
            }
          >
            <DropdownItem tag="a" href="/hesap" icon={<UserRound />}>
              Hesabım
            </DropdownItem>
          </UserDropdown>
        </>
      }
    >
      <BildirimSaglayici>{children}</BildirimSaglayici>
    </DashboardShell>
  );
}
