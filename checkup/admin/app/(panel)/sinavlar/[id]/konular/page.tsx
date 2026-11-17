import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListChecks, Settings2 } from "lucide-react";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { oku } from "@/lib/backend";
import { kimlikMi } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Agac } from "@/lib/tipler";
import { KonuAgaci } from "./KonuAgaci";

export const metadata: Metadata = { title: "Konu ağacı" };

export default async function KonularSayfasi({ params }: PageProps<"/sinavlar/[id]/konular">) {
  await yoneticiGerekli();
  const { id } = await params;
  if (!kimlikMi(id)) notFound();
  const agac = await oku<Agac>(`/admin/sinavlar/${id}/agac`);

  return (
    <>
      <PageBreadcrumb
        pageTitle={`${agac.sinav.ad} — konu ağacı`}
        crumbs={[{ href: "/sinavlar", label: "Sınavlar" }]}
        currentLabel="Konu ağacı"
        description="Ders → Konu → Kazanım → Alt kazanım. Her soru dördüne de bağlanır; Excel içe aktarma da bu adlarla eşleşir."
        actions={
          <>
            <ButtonLink href={`/sorular?sinav=${agac.sinav.id}`} size="xs" variant="outline" startIcon={<ListChecks />}>
              Sorular
            </ButtonLink>
            <ButtonLink href={`/sinavlar/${agac.sinav.id}/ayarlar`} size="xs" variant="outline" startIcon={<Settings2 />}>
              Check-up ayarları
            </ButtonLink>
          </>
        }
      />
      <KonuAgaci agac={agac} />
    </>
  );
}
