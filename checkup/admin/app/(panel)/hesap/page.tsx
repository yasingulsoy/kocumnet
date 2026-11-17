import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { ProfileCard } from "@/components/tailadmin/profile/ProfileCard";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { ROL_ADI } from "@/lib/bicim";
import { cikisYap } from "@/lib/eylemler/oturum";
import { yoneticiGerekli } from "@/lib/oturum";
import { ParolaFormu } from "./ParolaFormu";

export const metadata: Metadata = { title: "Hesabım" };

export default async function HesapSayfasi() {
  const { yonetici } = await yoneticiGerekli();

  return (
    <>
      <PageBreadcrumb pageTitle="Hesabım" />
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <ProfileCard
            name={yonetici.adSoyad}
            meta={[yonetici.eposta]}
            badges={
              <Badge size="sm" color={yonetici.rol === "YONETICI" ? "primary" : "info"}>
                {ROL_ADI[yonetici.rol]}
              </Badge>
            }
          />
          <ComponentCard title="Oturum" desc="Oturum 12 saat sonra kendiliğinden kapanır.">
            <form action={cikisYap}>
              <Button type="submit" variant="outline" startIcon={<LogOut />}>
                Çıkış yap
              </Button>
            </form>
          </ComponentCard>
        </div>
        <ComponentCard title="Parolayı değiştir" desc="En az 8 karakter. Ad, e-posta ya da kolay tahmin edilen sözcükler kullanmayın.">
          <ParolaFormu />
        </ComponentCard>
      </div>
    </>
  );
}
