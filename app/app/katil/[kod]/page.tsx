import type { Metadata } from "next";
import { ArrowRight, Link2Off, LogIn, UserPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DAVET_HATA_PENCERESI_MS,
  DAVET_HATA_SINIRI_IP,
  DAVET_HATA_SINIRI_KULLANICI,
  davetiBul,
  kodNormalize,
} from "@/lib/grup-katilim";
import { kimlikAdresi } from "@/lib/hesap-kurallari";
import { denemeYaz, denemeYazKullanici, sinirDolu, sinirDoluKullanici } from "@/lib/rate-limit";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { AuthHeading } from "../../(auth)/AuthHeading";
import { KatilFormu } from "./KatilFormu";

export const metadata: Metadata = {
  title: "Gruba katıl",
  // Kod adreste: arama motoruna girmesin, başka siteye Referer'la gitmesin.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Davet bağlantısı: /katil/<kod>. Kural ve kod biçimi lib/grup-katilim.ts.
 *
 *  - Kod geçersiz, kapatılmış ya da grup arşivde: aynı sade sayfa (hangisi
 *    olduğunu söylemek tahmine ipucu verir).
 *  - Giriş yapılmamış: "Hesap aç" (/kayit?grup=<kod>, hesap açılınca gruba
 *    girer) ve "Giriş yap" (girişten sonra buraya döner). Grubun adı
 *    gösterilmez: kodu bilen girişsiz biri grubun adını öğrenmesin.
 *  - Giriş yapılmış: grubun adı ve "Gruba katıl"; zaten üyeyse söylenir.
 *
 * Hız sınırı yalnızca GEÇERSİZ koda: girişsizde IP, girişlide öğrenci başına
 * (aynı Wi-Fi'daki sınıf doğru bağlantıyla sınıra hiç değmez).
 */
export default async function KatilPage({ params }: PageProps<"/katil/[kod]">) {
  const { kod: ham } = await params;
  const kod = kodNormalize(ham);
  const user = await getCurrentUser();

  const sinirDoldu = user
    ? sinirDoluKullanici(user.id, "davet-hata", DAVET_HATA_SINIRI_KULLANICI)
    : await sinirDolu("davet-hata", DAVET_HATA_SINIRI_IP);
  if (sinirDoldu) {
    return (
      <Bos
        baslik="Çok fazla deneme yapıldı"
        aciklama="Bir saat sonra tekrar dene. Bağlantıya koçunun gönderdiği mesajdan dokunduğundan emin ol."
      />
    );
  }

  const davet = await davetiBul(prisma, kod, user?.id);
  if (davet.durum === "GECERSIZ") {
    if (user) denemeYazKullanici(user.id, "davet-hata", DAVET_HATA_PENCERESI_MS);
    else await denemeYaz("davet-hata", DAVET_HATA_PENCERESI_MS);
    return (
      <Bos
        baslik="Bu bağlantı geçersiz ya da kapatılmış"
        aciklama="Koçundan yeni bir davet bağlantısı iste."
        girisli={Boolean(user)}
      />
    );
  }

  if (!user) {
    return (
      <>
        <AuthHeading
          title="Gruba davet edildin"
          description="Gruba katılmak için hesabını aç ya da hesabınla giriş yap. Bir dakika sürer."
        />
        <div className="space-y-3">
          <ButtonLink href={kimlikAdresi("/kayit", { grup: kod })} size="md" block startIcon={<UserPlus />}>
            Hesap aç
          </ButtonLink>
          <ButtonLink
            href={kimlikAdresi("/giris", { sonra: `/katil/${kod}` })}
            variant="outline"
            size="md"
            block
            startIcon={<LogIn />}
          >
            Giriş yap
          </ButtonLink>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading title={davet.grupAdi} description="Koçunun çalışma grubu" />
      {davet.uye ? (
        <div className="space-y-5">
          <Alert variant="success">Bu gruptasın. Koçunun verdiği ödevler ana sayfanda görünür.</Alert>
          <ButtonLink href="/panel" size="md" block endIcon={<ArrowRight className="rtl:rotate-180" />}>
            Ana sayfaya git
          </ButtonLink>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-theme-sm leading-relaxed text-gray-500">
            Katılınca koçun bu gruba verdiği ödevleri görürsün; koçun da çözdüğün testleri ve gelişimini görür.
          </p>
          <KatilFormu kod={kod} />
        </div>
      )}
    </>
  );
}

function Bos({ baslik, aciklama, girisli = false }: { baslik: string; aciklama: string; girisli?: boolean }) {
  return (
    <EmptyState
      icon={<Link2Off />}
      title={baslik}
      description={aciklama}
      action={
        <ButtonLink href={girisli ? "/panel" : "/"} variant="outline">
          {girisli ? "Ana sayfaya git" : "Ana sayfa"}
        </ButtonLink>
      }
    />
  );
}
