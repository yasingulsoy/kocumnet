import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { YetkiYok } from "@/components/YetkiYok";
import { oku } from "@/lib/backend";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Yonetici } from "@/lib/tipler";
import { YoneticiTablosu } from "./YoneticiTablosu";

export const metadata: Metadata = { title: "Yöneticiler" };

export default async function YoneticilerSayfasi() {
  const { yonetici, yetkili } = await yoneticiGerekli("YONETICI");
  if (!yetkili) return <YetkiYok />;
  const yoneticiler = await oku<Yonetici[]>("/admin/yoneticiler");

  return (
    <>
      <PageBreadcrumb
        pageTitle="Yöneticiler"
        description="Panel hesapları. YÖNETİCİ her şeyi yapar; EDİTÖR konu ağacı, sorular, içe aktarma ve check-up ayarlarıyla çalışır."
      />
      <YoneticiTablosu yoneticiler={yoneticiler} benId={yonetici.id} />
    </>
  );
}
