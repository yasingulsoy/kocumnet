import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/tailadmin/layout/AuthLayout";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Wordmark } from "@/components/Logo";
import { guvenliYol } from "@/lib/backend";
import { oturumDurumu } from "@/lib/oturum";
import { GirisFormu } from "./GirisFormu";

export const metadata: Metadata = { title: "Giriş" };

export default async function GirisSayfasi({ searchParams }: PageProps<"/giris">) {
  const sp = await searchParams;
  const sonraki = guvenliYol(sp.sonraki) ?? undefined;

  const d = await oturumDurumu();
  if (d.tur === "var") redirect(sonraki ?? "/");

  return (
    <AuthLayout
      top={
        <div className="lg:hidden">
          <Wordmark size="sm" />
        </div>
      }
      aside={
        <div className="flex max-w-sm flex-col items-center text-center">
          <Wordmark tone="light" size="lg" />
          <p className="mt-8 font-display text-2xl leading-snug font-semibold text-balance text-white">
            Sınavlar, konu ağacı, sorular ve check-up ayarları tek yerde.
          </p>
          <p className="mt-3 text-gray-400">Bu panel yalnızca Koçum.Net ekibi içindir.</p>
          <p className="mt-10 flex items-center gap-2 text-sm text-gray-400">
            <ShieldCheck className="size-4" aria-hidden /> Oturumlar 12 saat sonra kendiliğinden kapanır.
          </p>
        </div>
      }
    >
      <div className="mb-5 sm:mb-8">
        <h1 className="mb-2 font-display text-title-sm font-semibold text-gray-800 sm:text-title-md">Check-up paneli</h1>
        <p className="text-sm text-gray-500">Yönetici hesabınızla giriş yapın.</p>
      </div>

      <div className="space-y-5">
        {d.tur === "ulasilamadi" ? (
          <Alert variant="warning" title="Sunucuya ulaşılamıyor">
            Backend yanıt vermiyor. Birkaç dakika sonra tekrar deneyin; sorun sürerse teknik ekibe haber verin.
          </Alert>
        ) : null}
        {sp.durum === "bitti" ? <Alert variant="info">Oturumunuz kapandı. Devam etmek için yeniden giriş yapın.</Alert> : null}
        {sp.durum === "cikis" ? <Alert variant="success">Çıkış yapıldı.</Alert> : null}
        <GirisFormu sonraki={sonraki} />
      </div>
    </AuthLayout>
  );
}
