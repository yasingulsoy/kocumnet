import type { Metadata } from "next";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { paketHavuzu, paketKonulari } from "@/lib/checkup/pool";
import { GateNotice } from "@/components/checkup/GateNotice";
import { PackageEditor } from "@/components/checkup/PackageEditor";
import { PageHeader } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Yeni paket" };

/**
 * Yeni katalog paketi (yalnızca yönetici ve müdür). Taslak olarak başlar;
 * havuz yetiyorsa doğrudan yayında da kaydedilebilir.
 */
export default async function NewPackagePage() {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const [konular, havuz] = await Promise.all([paketKonulari(), paketHavuzu()]);

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/paketler", label: "Paketler" },
        ]}
        title="Yeni paket"
        description="Katalogda görünen bir check-up: sınav, konular ve her konudan kaç soru."
      />
      <PackageEditor konular={konular} havuz={havuz} />
    </>
  );
}
