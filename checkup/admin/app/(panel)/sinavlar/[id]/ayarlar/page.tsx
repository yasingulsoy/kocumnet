import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolderTree, ListChecks } from "lucide-react";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { oku } from "@/lib/backend";
import { kimlikMi } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Agac, CheckupAyari } from "@/lib/tipler";
import { CheckupAyarlari } from "./CheckupAyarlari";

export const metadata: Metadata = { title: "Check-up ayarları" };

export default async function AyarlarSayfasi({ params }: PageProps<"/sinavlar/[id]/ayarlar">) {
  await yoneticiGerekli();
  const { id } = await params;
  if (!kimlikMi(id)) notFound();
  const [agac, ayarlar] = await Promise.all([oku<Agac>(`/admin/sinavlar/${id}/agac`), oku<CheckupAyari[]>(`/admin/sinavlar/${id}/ayarlar`)]);

  return (
    <>
      <PageBreadcrumb
        pageTitle={`${agac.sinav.ad} — check-up ayarları`}
        crumbs={[{ href: "/sinavlar", label: "Sınavlar" }]}
        currentLabel="Check-up ayarları"
        description="Her tür için soruların nasıl seçileceği: Karma (reçeteye göre havuzdan rastgele) ya da Sabit (tek tek seçilmiş liste). Eksik ayar da kaydedilir ama öğrenci başlatamaz."
        actions={
          <>
            <ButtonLink href={`/sinavlar/${agac.sinav.id}/konular`} size="xs" variant="outline" startIcon={<FolderTree />}>
              Konu ağacı
            </ButtonLink>
            <ButtonLink href={`/sorular?sinav=${agac.sinav.id}`} size="xs" variant="outline" startIcon={<ListChecks />}>
              Sorular
            </ButtonLink>
          </>
        }
      />
      <CheckupAyarlari agac={agac} ayarlar={ayarlar} />
    </>
  );
}
