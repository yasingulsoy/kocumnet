import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { oku } from "@/lib/backend";
import { kimlikAl } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Agac, Sinav } from "@/lib/tipler";
import { SoruFormu } from "../SoruFormu";

export const metadata: Metadata = { title: "Yeni soru" };

/**
 * Yeni soru. Adresteki sınav/ders/konu/kazanım/alt kazanım seçimleri forma
 * dolu gelir ("Aynı konuya yeni soru" kısayolu ve soru listesinin süzgeci).
 */
export default async function YeniSoruSayfasi({ searchParams }: PageProps<"/sorular/yeni">) {
  await yoneticiGerekli();
  const sp = await searchParams;
  const sinavlar = await oku<Sinav[]>("/admin/sinavlar");

  const baslik = (
    <PageBreadcrumb
      pageTitle="Yeni soru"
      crumbs={[{ href: "/sorular", label: "Sorular" }]}
      description="Kaydetmek için Ctrl+S; aynı konuya hemen yenisini girmek için Ctrl+Enter."
    />
  );

  if (sinavlar.length === 0) {
    return (
      <>
        {baslik}
        <Card>
          <EmptyState
            icon={<GraduationCap />}
            title="Önce bir sınav gerekli"
            description="Sorular bir sınavın konu ağacına bağlanır."
            action={
              <ButtonLink href="/sinavlar" size="xs">
                Sınavlar
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  }

  const istenen = kimlikAl(sp.sinav);
  const sinav = sinavlar.find((s) => s.id === istenen) ?? sinavlar.find((s) => s.aktif) ?? sinavlar[0];
  const agac = await oku<Agac>(`/admin/sinavlar/${sinav.id}/agac`);

  return (
    <>
      {baslik}
      <SoruFormu
        sinavlar={sinavlar.map((s) => ({ id: s.id, ad: s.ad, aktif: s.aktif }))}
        agac={agac}
        baslangic={{
          sinavId: sinav.id,
          dersId: kimlikAl(sp.ders),
          konuId: kimlikAl(sp.konu),
          kazanimId: kimlikAl(sp.kazanim),
          altKazanimId: kimlikAl(sp.altKazanim),
        }}
      />
    </>
  );
}
