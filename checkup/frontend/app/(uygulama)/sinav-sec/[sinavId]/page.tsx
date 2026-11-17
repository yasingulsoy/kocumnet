import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, sayfaVerisi } from "@/lib/backend";
import { ucret } from "@/lib/bicim";
import type { CheckupOzeti, KatalogSinavi } from "@/lib/tipler";
import { AcikCheckupUyarisi } from "@/components/AcikCheckupUyarisi";
import { SayfaBasligi } from "@/components/SayfaBasligi";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { TurSecimi } from "./TurSecimi";

export const metadata: Metadata = { title: "Check-up türünü seç" };

export default async function TurSecSayfasi({ params }: PageProps<"/sinav-sec/[sinavId]">) {
  const { sinavId } = await params;
  const id = Number(sinavId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const [katalog, liste] = await Promise.all([
    api<KatalogSinavi[]>("/ogrenci/sinavlar"),
    api<CheckupOzeti[]>("/ogrenci/checkuplar"),
  ]);
  // Katalog yalnızca aktif sınavları verir: pasif ya da olmayan sınav 404.
  const sinav = sayfaVerisi(katalog).find((s) => s.id === id);
  if (!sinav) notFound();
  const devam = liste.ok ? liste.veri.find((c) => c.durum === "DEVAM") : undefined;

  return (
    <>
      <SayfaBasligi
        baslik={
          <span className="inline-flex flex-wrap items-center gap-3">
            {sinav.ad}
            <Badge color={sinav.ucretKurus > 0 ? "info" : "success"} size="sm">
              {ucret(sinav.ucretKurus)}
            </Badge>
          </span>
        }
        aciklama={sinav.aciklama ?? "Check-up türünü seç."}
        geri={{ href: "/sinav-sec", etiket: "Sınavlar" }}
      />

      {devam ? <AcikCheckupUyarisi checkup={devam} className="mb-6" /> : null}

      <TurSecimi
        sinavId={sinav.id}
        sinavAd={sinav.ad}
        yanlisGoturme={typeof sinav.yanlisGoturme === "number" ? sinav.yanlisGoturme : null}
        turler={sinav.turler}
      />
    </>
  );
}
