import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { oku } from "@/lib/backend";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Sinav } from "@/lib/tipler";
import { SinavTablosu } from "./SinavTablosu";

export const metadata: Metadata = { title: "Sınavlar" };

export default async function SinavlarSayfasi() {
  const { yonetici } = await yoneticiGerekli();
  const sinavlar = await oku<Sinav[]>("/admin/sinavlar");

  return (
    <>
      <PageBreadcrumb
        pageTitle="Sınavlar"
        description="Öğrenci yalnızca aktif sınavları görür. Her sınavın kendi konu ağacı, soruları ve check-up ayarları vardır."
      />
      <SinavTablosu sinavlar={sinavlar} duzenleyebilir={yonetici.rol === "YONETICI"} />
    </>
  );
}
