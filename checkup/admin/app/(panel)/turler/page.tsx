import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { oku } from "@/lib/backend";
import { yoneticiGerekli } from "@/lib/oturum";
import type { Tur } from "@/lib/tipler";
import { TurTablosu } from "./TurTablosu";

export const metadata: Metadata = { title: "Check-up türleri" };

export default async function TurlerSayfasi() {
  const { yonetici } = await yoneticiGerekli();
  const turler = await oku<Tur[]>("/admin/turler");

  return (
    <>
      <PageBreadcrumb
        pageTitle="Check-up türleri"
        description="Hızlı, Kapsamlı gibi türler bütün sınavlarda ortaktır. Her sınav için hangi soruların geleceği o sınavın check-up ayarlarından belirlenir."
      />
      <TurTablosu turler={turler} duzenleyebilir={yonetici.rol === "YONETICI"} />
    </>
  );
}
