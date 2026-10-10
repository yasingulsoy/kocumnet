import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sinirAsildi } from "@/lib/rate-limit";
import { onizleyiciMi } from "@/lib/veli";
import { goruntulenmeKaydet, veliBaglantisiniCoz, veliRaporu } from "@/lib/veli-raporu";
import { BasariEgilimi } from "@/components/BasariGrafikleri";
import { VeliDurumu, VeliKabugu, VeliRaporuGorunumu } from "@/components/VeliRaporu";

/*
 * Başlık ve önizleme GENEL: öğrencinin adı burada geçmez (WhatsApp ve
 * benzerleri bağlantı önizlemesinde başlığı gösterir). Arama motoruna
 * kapalı; Referer gönderilmez (ayrıca next.config.ts başlıkları).
 */
export const metadata: Metadata = {
  title: "Veli raporu",
  description: "Koçum.Net Matematik Check-up: öğrencinin genel durum özeti. Salt okunur, süreli bağlantı.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: {
    title: "Veli raporu · Koçum.Net",
    description: "Öğrencinin matematik check-up özeti. Salt okunur, süreli bağlantı.",
  },
};

/**
 * Veli raporu — girişsiz, salt okunur. Profilden oluşturulan bağlantıyla açılır.
 *
 * Sıra bilinçli: önce IP sınırı (veritabanına gitmeden), sonra önizleme
 * botları (veri görmez, sayılmaz), sonra jeton. Geçersiz, süresi dolmuş ve
 * kaldırılmış bağlantı aynı sayfayı görür; hiçbir veri yok.
 */
export default async function VeliRaporuSayfasi({ params }: PageProps<"/veli/[token]">) {
  const { token } = await params;

  if (await sinirAsildi("veli-raporu", 60, 10 * 60_000)) {
    return (
      <VeliKabugu>
        <VeliDurumu tur="sinir" />
      </VeliKabugu>
    );
  }

  if (onizleyiciMi((await headers()).get("user-agent"))) {
    return (
      <VeliKabugu>
        <VeliDurumu tur="onizleme" />
      </VeliKabugu>
    );
  }

  const erisim = await veliBaglantisiniCoz(token);
  if (erisim.durum !== "GECERLI") {
    return (
      <VeliKabugu>
        <VeliDurumu tur="kapali" />
      </VeliKabugu>
    );
  }

  const [rapor, ziyaretci] = await Promise.all([veliRaporu(erisim.userId), getCurrentUser()]);

  // Açılma sayacı yanıttan sonra. Öğrencinin kendi açması sayılmaz:
  // "son açılma" velinin açıp açmadığını söylesin.
  if (ziyaretci?.id !== erisim.userId) {
    after(() => goruntulenmeKaydet(erisim.baglantiId).catch(() => undefined));
  }

  return (
    <VeliKabugu>
      <VeliRaporuGorunumu
        rapor={rapor}
        bitis={erisim.expiresAt}
        grafik={
          rapor.egilim.length >= 2 ? (
            <BasariEgilimi noktalar={rapor.egilim} ariaLabel="Check-up başarı oranı, eskiden yeniye" />
          ) : null
        }
      />
    </VeliKabugu>
  );
}
