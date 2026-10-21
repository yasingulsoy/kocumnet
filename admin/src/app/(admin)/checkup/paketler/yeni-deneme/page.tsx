import type { Metadata } from "next";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { denemeHedefleri, konuSirasi, sinavVarsayilanlari } from "@/lib/checkup/mock";
import { GateNotice } from "@/components/checkup/GateNotice";
import { MockEditor } from "@/components/checkup/MockEditor";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";

export const metadata: Metadata = { title: "Check-up · Yeni deneme" };

/**
 * Yeni deneme (MOCK paket; yalnızca yönetici ve müdür — paket ayarı). Sınav
 * seçilince soru sayısı, süre ve yanlış götürme sınavdan dolar
 * (shared/exams.ts); taslak başlar, liste tamamlanınca yayına alınır.
 */
export default async function NewMockPage() {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const [hedefler, sira] = await Promise.all([denemeHedefleri(), konuSirasi()]);

  return (
    <>
      <PageBreadcrumb
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/paketler", label: "Paketler" },
        ]}
        pageTitle="Yeni deneme"
        description="Gerçek sınavın provası: sınavın soru sayısı, süresi ve yanlış götürme kuralıyla, herkese aynı sabit soru listesi."
      />
      <MockEditor sorular={[]} hedefler={hedefler} konuSirasi={sira} varsayilanlar={sinavVarsayilanlari()} />
    </>
  );
}
