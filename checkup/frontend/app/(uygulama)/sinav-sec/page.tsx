import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { api, sayfaVerisi } from "@/lib/backend";
import { ucret } from "@/lib/bicim";
import type { CheckupOzeti, KatalogSinavi } from "@/lib/tipler";
import { AcikCheckupUyarisi } from "@/components/AcikCheckupUyarisi";
import { SayfaBasligi } from "@/components/SayfaBasligi";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";

export const metadata: Metadata = { title: "Sınavını seç" };

export default async function SinavSecSayfasi() {
  const [katalog, liste] = await Promise.all([
    api<KatalogSinavi[]>("/ogrenci/sinavlar"),
    api<CheckupOzeti[]>("/ogrenci/checkuplar"),
  ]);
  const sinavlar = sayfaVerisi(katalog);
  // Liste alınamazsa uyarıyı göstermemek yeterli; asıl engel başlatırken backend'de.
  const devam = liste.ok ? liste.veri.find((c) => c.durum === "DEVAM") : undefined;

  return (
    <>
      <SayfaBasligi
        baslik="Hangi sınava hazırlanıyorsun?"
        aciklama="Sınavını seç, sonra check-up türünü belirle."
        geri={{ href: "/panel", etiket: "Panel" }}
      />

      {devam ? <AcikCheckupUyarisi checkup={devam} className="mb-6" /> : null}

      {sinavlar.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpenCheck />}
            title="Şu an açık sınav yok"
            description="Sınavlar hazırlanıyor. Kısa süre sonra yeniden bak."
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {sinavlar.map((s) => {
            const hazirTur = s.turler.filter((t) => t.hazir).length;
            return (
              <li key={s.id}>
                <Card className="group relative flex h-full flex-col p-5 transition hover:border-brand-300 hover:shadow-theme-md sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-h3 font-semibold text-gray-800">
                      <Link href={`/sinav-sec/${s.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
                        {s.ad}
                      </Link>
                    </h2>
                    <Badge color={s.ucretKurus > 0 ? "info" : "success"} size="sm">
                      {ucret(s.ucretKurus)}
                    </Badge>
                  </div>
                  {s.aciklama ? <p className="mt-2 text-body text-gray-600">{s.aciklama}</p> : null}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-sm">
                    <span className="text-gray-500">
                      {s.turler.length === 0
                        ? "Check-up türleri hazırlanıyor"
                        : hazirTur === 0
                          ? `${s.turler.length} tür · hazırlanıyor`
                          : `${hazirTur} check-up türü`}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-brand-500 group-hover:text-brand-600">
                      Seç
                      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                    </span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
