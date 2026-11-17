import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { oku } from "@/lib/backend";
import { kimlikMi } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Agac, Sinav, SoruAyrintisi } from "@/lib/tipler";
import { SoruFormu } from "../SoruFormu";

export async function generateMetadata({ params }: PageProps<"/sorular/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Soru #${id}` };
}

export default async function SoruSayfasi({ params, searchParams }: PageProps<"/sorular/[id]">) {
  await yoneticiGerekli();
  const { id } = await params;
  if (!kimlikMi(id)) notFound();
  const sp = await searchParams;

  const [soru, sinavlar] = await Promise.all([oku<SoruAyrintisi>(`/admin/sorular/${id}`), oku<Sinav[]>("/admin/sinavlar")]);
  const agac = await oku<Agac>(`/admin/sinavlar/${soru.sinavId}/agac`);

  return (
    <>
      <PageBreadcrumb
        pageTitle={`Soru #${soru.id}`}
        crumbs={[{ href: `/sorular?sinav=${soru.sinavId}`, label: "Sorular" }]}
        currentLabel={`#${soru.id}`}
        description="Kaydetmek için Ctrl+S."
      />
      <SoruFormu
        sinavlar={sinavlar.map((s) => ({ id: s.id, ad: s.ad, aktif: s.aktif }))}
        agac={agac}
        soru={soru}
        yeniKaydedildi={sp.kaydedildi === "1"}
      />
    </>
  );
}
