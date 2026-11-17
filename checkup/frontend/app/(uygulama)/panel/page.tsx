import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, Clock, Plus, Timer } from "lucide-react";
import { api, girisliOgrenci, sayfaVerisi } from "@/lib/backend";
import { ilkAd, kisaTarih, net, sayacMetni } from "@/lib/bicim";
import type { CheckupOzeti } from "@/lib/tipler";
import { SayfaBasligi } from "@/components/SayfaBasligi";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";

export const metadata: Metadata = { title: "Panel" };

/** Kalan süre (ms). Saat render anında okunur; sayfa her istekte yeniden çizilir. */
function kalanMs(bitisSiniri: string): number {
  return Math.max(0, new Date(bitisSiniri).getTime() - Date.now());
}

function DevamKarti({ c }: { c: CheckupOzeti }) {
  const yuzde = c.soruSayisi > 0 ? Math.round((c.cevaplanan / c.soruSayisi) * 100) : 0;
  return (
    <Card tone="brand" className="relative overflow-hidden p-5 sm:p-6">
      <div aria-hidden className="absolute inset-y-0 start-0 w-1.5 bg-highlight" />
      <p className="flex items-center gap-2 text-caption font-semibold tracking-wide text-brand-600 uppercase">
        <Timer className="size-4" aria-hidden />
        Devam eden check-up
      </p>
      <h2 className="mt-2 font-display text-h3 font-semibold text-gray-800">
        {c.sinav.ad} · {c.tur.ad}
      </h2>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700">
        <span className="tabular">
          <strong className="font-semibold text-gray-800">{c.cevaplanan}</strong> / {c.soruSayisi} soru cevaplandı
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4 text-gray-500" aria-hidden />
          Yaklaşık {sayacMetni(kalanMs(c.bitisSiniri))} kaldı
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label="Cevaplanan soru oranı"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={yuzde}
      >
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${yuzde}%` }} />
      </div>
      <p className="mt-3 text-caption text-gray-500">Süre sen ekranda olmasan da işliyor.</p>
      <div className="mt-5">
        <ButtonLink href={`/test/${c.id}`} size="md" endIcon={<ArrowRight className="rtl:rotate-180" />}>
          Devam et
        </ButtonLink>
      </div>
    </Card>
  );
}

function GecmisSatiri({ c }: { c: CheckupOzeti }) {
  return (
    <li className="relative flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-gray-50 sm:px-6">
      <div className="min-w-0 flex-[1_1_14rem]">
        <Link
          href={`/rapor/${c.id}`}
          className="block truncate font-medium text-gray-800 after:absolute after:inset-0 after:content-['']"
        >
          {c.sinav.ad} · {c.tur.ad}
        </Link>
        <p className="mt-0.5 text-caption text-gray-500">
          {kisaTarih(c.bitis ?? c.baslangic)}
          <span className="tabular">
            {" "}
            · {c.dogru ?? 0} doğru, {c.yanlis ?? 0} yanlış, {c.bos ?? 0} boş
          </span>
        </p>
      </div>
      <div className="flex items-center gap-4">
        <p className="text-end">
          <span className="tabular block font-display text-num-sm font-semibold text-gray-800">{net(c.net)}</span>
          <span className="text-micro text-gray-500">net</span>
        </p>
        <span className="hidden items-center gap-1 text-sm font-medium text-brand-500 sm:inline-flex">
          Rapor
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </span>
      </div>
    </li>
  );
}

export default async function PanelSayfasi() {
  const [ogrenci, liste] = await Promise.all([girisliOgrenci(), api<CheckupOzeti[]>("/ogrenci/checkuplar")]);
  const checkuplar = sayfaVerisi(liste);
  const devam = checkuplar.find((c) => c.durum === "DEVAM");
  const bitenler = checkuplar.filter((c) => c.durum === "BITTI");

  return (
    <>
      <SayfaBasligi
        baslik={`Merhaba ${ilkAd(ogrenci.adSoyad)}!`}
        aciklama={devam ? "Yarım kalan check-up'ın seni bekliyor." : "Bugün hangi sınava bakalım?"}
        eylemler={
          checkuplar.length > 0 ? (
            <ButtonLink href="/sinav-sec" variant={devam ? "outline" : "primary"} startIcon={<Plus />}>
              Yeni check-up başlat
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="space-y-8">
        {devam ? <DevamKarti c={devam} /> : null}

        {checkuplar.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ClipboardList />}
              title="Henüz bir check-up çözmedin"
              description="Sınavını ve check-up türünü seç, testi çöz. Bitince netini, konu konu başarını ve önce neye çalışman gerektiğini görürsün."
              action={
                <ButtonLink href="/sinav-sec" size="md" startIcon={<Plus />}>
                  İlk check-up&apos;ını başlat
                </ButtonLink>
              }
            />
          </Card>
        ) : null}

        {bitenler.length > 0 ? (
          <section aria-labelledby="gecmis-baslik">
            <h2 id="gecmis-baslik" className="mb-3 font-display text-h3 font-semibold text-gray-800">
              Geçmiş check-up&apos;ların
            </h2>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {bitenler.map((c) => (
                  <GecmisSatiri key={c.id} c={c} />
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </div>
    </>
  );
}
