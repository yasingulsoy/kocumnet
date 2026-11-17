import type { Metadata } from "next";
import { KeyRound, LogOut, Trash2, UserRound } from "lucide-react";
import { girisliOgrenci } from "@/lib/backend";
import { cikisYap } from "@/lib/eylemler/hesap";
import { tarih } from "@/lib/bicim";
import { SayfaBasligi } from "@/components/SayfaBasligi";
import { Button } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { AdSoyadFormu, HesapSilmeFormu, ParolaFormu } from "./ProfilFormlari";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilSayfasi() {
  const ogrenci = await girisliOgrenci();

  return (
    <>
      <SayfaBasligi baslik="Profil" aciklama={`${ogrenci.eposta} · ${tarih(ogrenci.olusturuldu)} tarihinden beri üyesin.`} />

      <div className="grid gap-6">
        <ComponentCard title="Ad soyad" icon={<UserRound />} desc="Raporlarında ve selamlamada bu ad görünür.">
          <AdSoyadFormu adSoyad={ogrenci.adSoyad} />
        </ComponentCard>

        <ComponentCard title="Parola" icon={<KeyRound />} desc="Parolanı değiştirince başka cihazlardaki oturumların kapanır.">
          <ParolaFormu eposta={ogrenci.eposta} />
        </ComponentCard>

        <ComponentCard title="Oturum" icon={<LogOut />} desc="Bu cihazdan çıkış yap.">
          <form action={cikisYap}>
            <Button type="submit" variant="outline" startIcon={<LogOut className="rtl:rotate-180" />}>
              Çıkış yap
            </Button>
          </form>
        </ComponentCard>

        <ComponentCard
          title="Hesabı sil"
          icon={<Trash2 />}
          tone="danger"
          desc="Hesabın ve bütün check-up'ların, raporların kalıcı olarak silinir. Geri alınamaz."
        >
          <HesapSilmeFormu />
        </ComponentCard>
      </div>
    </>
  );
}
