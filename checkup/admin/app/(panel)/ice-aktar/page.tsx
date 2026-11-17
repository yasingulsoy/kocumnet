import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { oku } from "@/lib/backend";
import { kimlikAl } from "@/lib/bicim";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Sinav } from "@/lib/tipler";
import { IceAktarma } from "./IceAktarma";

export const metadata: Metadata = { title: "Excel'den içe aktar" };

export default async function IceAktarSayfasi({ searchParams }: PageProps<"/ice-aktar">) {
  await yoneticiGerekli();
  const sp = await searchParams;
  const sinavlar = await oku<Sinav[]>("/admin/sinavlar");
  const istenen = kimlikAl(sp.sinav);
  const varsayilan = sinavlar.find((s) => s.id === istenen) ?? sinavlar.find((s) => s.aktif) ?? sinavlar[0];

  return (
    <>
      <PageBreadcrumb
        pageTitle="Excel'den içe aktar"
        crumbs={[{ href: "/sorular", label: "Sorular" }]}
        currentLabel="İçe aktar"
        description="Çok soruyu tek dosyayla ekleyin. Hatalı satır varsa hiçbir soru yazılmaz; önce denetleyip düzeltin."
      />
      {varsayilan ? (
        <IceAktarma sinavlar={sinavlar.map((s) => ({ id: s.id, ad: s.ad, aktif: s.aktif, dersSayisi: s.dersSayisi }))} varsayilanSinavId={varsayilan.id} />
      ) : (
        <Card>
          <EmptyState
            icon={<GraduationCap />}
            title="Önce bir sınav gerekli"
            description="İçe aktarma sınavın konu ağacıyla eşleşir. Sınavı ve konu ağacını girin."
            action={
              <ButtonLink href="/sinavlar" size="xs">
                Sınavlar
              </ButtonLink>
            }
          />
        </Card>
      )}
    </>
  );
}
