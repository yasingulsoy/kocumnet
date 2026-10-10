"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ChartColumn,
  Database,
  FileUp,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Package,
  Search,
  Target,
  UserRoundX,
  Users,
} from "lucide-react";
import { logoutRequest } from "@/lib/api";
import { CONTENT_ROLES, MANAGE_ROLES, ROLE_LABEL, type Staff, type StaffRole } from "@/lib/checkup/roles";
import { Logo, Wordmark } from "@/components/brand/Logo";
import { OnayProvider } from "@/components/checkup/Onay";
import { Input } from "@/components/tailadmin/form/Input";
import { UserDropdown } from "@/components/tailadmin/header/UserDropdown";
import { DashboardShell } from "@/components/tailadmin/layout/DashboardShell";
import type { NavSection } from "@/components/tailadmin/layout/nav";
import { Button, buttonClass } from "@/components/tailadmin/ui/Button";
import { DropdownItem } from "@/components/tailadmin/ui/Dropdown";

/**
 * Panel çerçevesi — TailAdmin kitinin DashboardShell'i: masaüstünde
 * daraltılabilir kenar çubuğu (290/90 px), üstte çubuk (soru arama +
 * kullanıcı menüsü), telefonda çekmece. Menü role göre: toplu içe aktarma
 * yazma rollerine, öğrenciler yönetime.
 *
 * Personel bilgisi sunucudan geliyor ((admin)/layout.tsx → checkStaff);
 * istemci tarafında ayrı bir doğrulama turu YOK. Menüde görünmemek yetki
 * değildir: her sayfa ve eylem sunucuda yeniden denetler.
 */

const SITE_ADMIN_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kocum.net").replace(/\/$/, "") + "/admin";

function menu(role: StaffRole): NavSection[] {
  const yazar = CONTENT_ROLES.includes(role);
  const yonetim = MANAGE_ROLES.includes(role);
  return [
    { title: "Menü", items: [{ href: "/checkup", label: "Genel bakış", icon: <LayoutDashboard />, exact: true }] },
    {
      title: "Soru havuzu",
      items: [
        { href: "/checkup/sorular", label: "Sorular", icon: <ListChecks /> },
        { href: "/checkup/sorular/analiz", label: "Madde analizi", icon: <ChartColumn /> },
        // Görüntüleyici içe aktaramıyor; geçmişe soru listesindeki bağlantıdan ulaşır.
        ...(yazar ? [{ href: "/checkup/sorular/ice-aktar", label: "Toplu içe aktar", icon: <FileUp /> }] : []),
        { href: "/checkup/kazanimlar", label: "Kazanımlar", icon: <Target /> },
        { href: "/checkup/havuz", label: "Havuz durumu", icon: <Database /> },
      ],
    },
    {
      title: "Testler",
      items: [
        { href: "/checkup/paketler", label: "Paketler", icon: <Package /> },
        { href: "/checkup/seviyeli", label: "Seviyeli koşular", icon: <Layers /> },
      ],
    },
    // Öğrenci kişisel verisi: editör ve görüntüleyici sayfayı açamıyor (sunucu
    // reddediyor); menüde görmesi yalnızca "yetkin yok" kutusuna götürürdü.
    ...(yonetim
      ? [
          {
            title: "Öğrenciler",
            items: [
              { href: "/checkup/ogrenciler", label: "Tüm öğrenciler", icon: <Users /> },
              { href: "/checkup/ogrenciler/riskli", label: "Riskli öğrenciler", icon: <UserRoundX /> },
            ],
          },
        ]
      : []),
  ];
}

/** Kenar çubuğunun altı (TailAdmin'in SidebarWidget yeri): öbür panel. */
function SiteKutusu() {
  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-5 text-center">
      <p className="font-display text-sm font-semibold text-gray-800">Site yönetimi</p>
      <p className="mt-1 mb-4 text-theme-xs text-gray-500">Blog, iletişim mesajları ve personel ayrı panelde; aynı hesapla girilir.</p>
      <a href={SITE_ADMIN_URL} className={buttonClass({ variant: "outline", size: "xs", block: true })}>
        kocum.net/admin <ArrowUpRight aria-hidden />
      </a>
    </div>
  );
}

/**
 * Üst çubukta soru arama (masaüstü). Düz GET formu: tam sayfa geçişi, yani
 * kaydedilmemiş soru varken tarayıcının ayrılma uyarısı yine çıkar.
 */
function SoruArama() {
  return (
    <form action="/checkup/sorular" method="get" role="search" className="max-w-md">
      <Input
        type="search"
        name="ara"
        aria-label="Soru ara"
        placeholder="Soru ara: metin, kaynak ya da #kimlik"
        startIcon={<Search />}
        autoComplete="off"
      />
    </form>
  );
}

export function AdminShell({ staff, children }: { staff: Staff; children: ReactNode }) {
  const router = useRouter();
  const [cikiliyor, setCikiliyor] = useState(false);

  async function cikis() {
    setCikiliyor(true);
    await logoutRequest();
    router.push("/signin");
    router.refresh();
  }

  return (
    <DashboardShell
      nav={menu(staff.role)}
      logo={<Wordmark />}
      logoCollapsed={<Logo className="size-10" />}
      logoHref="/checkup"
      logoLabel="Genel bakış"
      sidebarFooter={<SiteKutusu />}
      headerStart={<SoruArama />}
      headerEnd={
        <UserDropdown
          name={staff.name}
          detail={ROLE_LABEL[staff.role] + " · " + staff.email}
          footer={
            <Button variant="outline" size="xs" block startIcon={<LogOut />} loading={cikiliyor} onClick={cikis}>
              Çıkış yap
            </Button>
          }
        >
          <DropdownItem tag="a" href={SITE_ADMIN_URL} external icon={<ArrowUpRight />}>
            Site yönetimi (kocum.net/admin)
          </DropdownItem>
        </UserDropdown>
      }
    >
      <OnayProvider>{children}</OnayProvider>
    </DashboardShell>
  );
}
