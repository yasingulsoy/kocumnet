import type { ReactNode } from "react";
import { ArrowUpRight, LogOut, UserRound } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { SITE_URL } from "@/lib/products";
import { Logo, Wordmark } from "@/components/ui/logo";
import { UserDropdown } from "@/components/tailadmin/header/UserDropdown";
import { DashboardShell } from "@/components/tailadmin/layout/DashboardShell";
import { Button, buttonClass } from "@/components/tailadmin/ui/Button";
import { DropdownItem } from "@/components/tailadmin/ui/Dropdown";
import { altMenu, menu } from "./nav";

/**
 * Öğrenci uygulamasının çerçevesi — TailAdmin kitinin DashboardShell'i.
 *
 * Masaüstü: daraltılabilir kenar çubuğu + üst çubuk (kullanıcı menüsü).
 * Tablet: üst çubuktaki menü düğmesi çekmeceyi açar. Telefon: alt sekme
 * çubuğu — öğrencilerin çoğu telefondan giriyor, ana gezinme başparmağın
 * ulaştığı yerde olmalı; orada menü düğmesi yok (iki ayrı menü olmasın).
 *
 * Sınav ve alıştırma ekranları BU ÇERÇEVEYİ KULLANMIYOR: test sırasında
 * menü, dikkat dağıtan her şey kaldırılıyor. Yazdırmada (sonuç → PDF)
 * kenar çubuğu, üst çubuk ve alt çubuk görünmez.
 */
export function StudentShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <DashboardShell
      nav={menu}
      bottomNav={altMenu}
      logo={<Wordmark />}
      logoCollapsed={<Logo className="size-9" />}
      logoHref="/panel"
      logoLabel="Ana sayfa"
      sidebarFooter={<SiteKutusu />}
      headerEnd={
        <UserDropdown
          name={user.name}
          detail={user.email}
          footer={
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="xs" block startIcon={<LogOut />}>
                Çıkış yap
              </Button>
            </form>
          }
        >
          <DropdownItem tag="a" href="/profil" icon={<UserRound />}>
            Profil ve hedefin
          </DropdownItem>
          <DropdownItem tag="a" href={SITE_URL} external target="_blank" icon={<ArrowUpRight />}>
            kocum.net
          </DropdownItem>
        </UserDropdown>
      }
    >
      {children}
    </DashboardShell>
  );
}

/** Kenar çubuğunun altı (TailAdmin'in SidebarWidget yeri): yayınlara giden yol. */
function SiteKutusu() {
  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-5 text-center">
      <p className="font-display text-sm font-semibold text-gray-800">Koçum.Net yayınları</p>
      <p className="mt-1 mb-4 text-theme-xs text-gray-500">
        Zayıf çıkan konular için soru bankaları ve fasiküller.
      </p>
      <a href={SITE_URL} target="_blank" rel="noopener" className={buttonClass({ variant: "outline", size: "xs", block: true })}>
        kocum.net <ArrowUpRight aria-hidden />
      </a>
    </div>
  );
}
