import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChevronDown, CircleCheck, CircleDashed, CircleX, Clock, Hourglass, Plus, Target } from "lucide-react";
import { api, sayfaVerisi } from "@/lib/backend";
import { goturmeMetni, net, sure, tarihSaat } from "@/lib/bicim";
import type { Rapor, TestEkrani } from "@/lib/tipler";
import { BasariCubugu } from "@/components/BasariCubugu";
import { GrupTablosu } from "@/components/GrupTablosu";
import { SayfaBasligi } from "@/components/SayfaBasligi";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { CevapInceleme } from "./CevapInceleme";
import { YazdirDugmesi } from "./YazdirDugmesi";

export const metadata: Metadata = { title: "Rapor" };

function Sayi({
  etiket,
  deger,
  Ikon,
  ikonSinifi,
}: {
  etiket: string;
  deger: string | number;
  Ikon: typeof CircleCheck;
  ikonSinifi: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-caption font-medium text-gray-600">
        <Ikon className={`size-4 ${ikonSinifi}`} aria-hidden />
        {etiket}
      </dt>
      <dd className="tabular mt-1 font-display text-num-sm font-semibold text-gray-800">{deger}</dd>
    </div>
  );
}

export default async function RaporSayfasi({ params }: PageProps<"/rapor/[id]">) {
  const { id } = await params;
  const checkupId = Number(id);
  if (!Number.isSafeInteger(checkupId) || checkupId <= 0) notFound();

  const sonuc = await api<Rapor>(`/ogrenci/checkuplar/${checkupId}/rapor`);

  if (!sonuc.ok && sonuc.hata.kod === "HAZIR_DEGIL") {
    // Check-up sürüyorsa teste dön. Bitmiş ama rapor yoksa (olmamalı) döngüye girmeden haber ver.
    const durum = await api<TestEkrani>(`/ogrenci/checkuplar/${checkupId}`);
    if (durum.ok && durum.veri.durum === "DEVAM") redirect(`/test/${checkupId}`);
    return (
      <Card>
        <EmptyState
          icon={<Hourglass />}
          title="Raporun hazırlanıyor"
          description="Birkaç saniye sonra sayfayı yenile."
          action={<ButtonLink href={`/rapor/${checkupId}`}>Yenile</ButtonLink>}
        />
      </Card>
    );
  }

  const r = sayfaVerisi(sonuc);
  const o = r.ozet;

  return (
    <>
      <SayfaBasligi
        baslik={
          <>
            {r.sinav.ad} · {r.tur.ad}
            <span className="sr-only"> raporu</span>
          </>
        }
        aciklama={`${tarihSaat(r.bitis)} · ${sure(r.sureSaniye)} sürdü`}
        geri={{ href: "/panel", etiket: "Panel" }}
        eylemler={<YazdirDugmesi />}
      />

      <div className="space-y-8">
        {/* ── Özet ── */}
        <Card className="yazdir-bolunmesin p-5 sm:p-6">
          <h2 className="sr-only">Özet</h2>
          <div className="grid gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-center">
            <div className="rounded-2xl bg-brand-950 p-5 text-white">
              <p className="text-caption font-medium text-white/75">Netin</p>
              <p className="tabular mt-1 font-display text-num-lg font-bold">{net(o.net)}</p>
              <p className="mt-2 text-caption text-white/75">
                {o.soruSayisi} soruda. {goturmeMetni(o.yanlisGoturme)}
              </p>
            </div>
            <div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Sayi etiket="Doğru" deger={o.dogru} Ikon={CircleCheck} ikonSinifi="text-success-600" />
                <Sayi etiket="Yanlış" deger={o.yanlis} Ikon={CircleX} ikonSinifi="text-error-600" />
                <Sayi etiket="Boş" deger={o.bos} Ikon={CircleDashed} ikonSinifi="text-gray-500" />
                <Sayi etiket="Süre" deger={sure(r.sureSaniye)} Ikon={Clock} ikonSinifi="text-gray-500" />
              </dl>
              <div className="mt-4">
                <p className="mb-1.5 text-caption font-medium text-gray-600">Başarı (doğru / soru)</p>
                <BasariCubugu yuzde={o.basari} />
              </div>
            </div>
          </div>
        </Card>

        {/* ── Önce bunlara çalış ── */}
        <ComponentCard
          title="Önce bunlara çalış"
          icon={<Target />}
          tone="brand"
          desc="En az iki sorusu olup yarısından azını doğru yaptığın kazanımlar, en zayıftan başlayarak."
          className="yazdir-bolunmesin"
        >
          {r.zayiflar.length === 0 ? (
            <p className="text-body text-gray-700">
              Bu check-up&apos;ta belirgin bir zayıf kazanımın çıkmadı: en az iki sorusu olan hiçbir kazanımda başarın %50&apos;nin
              altına düşmedi. Yine de aşağıdaki konu tablosunda başarısı en düşük olanlara göz at.
            </p>
          ) : (
            <ol className="space-y-4">
              {r.zayiflar.map((z, i) => (
                <li key={`${z.seviye}-${z.id}`} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-highlight font-display text-sm font-bold text-highlight-ink">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800">
                      {z.kod ? <span className="me-1.5 font-mono text-caption text-gray-500">{z.kod}</span> : null}
                      {z.ad}
                    </p>
                    <p className="mt-0.5 text-caption text-gray-500">
                      {z.seviye === "altKazanim" ? "Alt kazanım" : "Kazanım"} · {z.ustAd}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="tabular text-sm text-gray-700">
                        {z.soru} sorudan {z.dogru} doğru
                      </span>
                      <BasariCubugu yuzde={z.basari} className="w-48" />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ComponentCard>

        {/* ── Dersler ── */}
        <ComponentCard title="Derslere göre" flush className="yazdir-bolunmesin">
          <GrupTablosu
            baslik="Ders"
            satirlar={r.dersler.map((d) => ({ ...d, anahtar: d.id }))}
          />
        </ComponentCard>

        {/* ── Konular ── */}
        <ComponentCard title="Konulara göre" flush>
          <GrupTablosu
            baslik="Konu"
            satirlar={r.konular.map((k) => ({ ...k, anahtar: k.id, alt: r.dersler.length > 1 ? k.dersAd : undefined }))}
          />
        </ComponentCard>

        {/* ── Kazanım ayrıntısı ── */}
        {r.kazanimlar.length > 0 || r.altKazanimlar.length > 0 ? (
          <details className="group rounded-2xl border border-gray-200 bg-white">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-display text-base font-semibold text-gray-800">Kazanım ve alt kazanım ayrıntısı</span>
                <span className="mt-0.5 block text-sm text-gray-500">Her kazanımda kaç soru çıktı, kaçını doğru yaptın.</span>
              </span>
              <ChevronDown className="size-5 shrink-0 text-gray-500 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="space-y-6 border-t border-gray-100 pb-2">
              {r.kazanimlar.length > 0 ? (
                <div>
                  <h3 className="px-5 pt-5 font-display text-sm font-semibold text-gray-800 sm:px-6">Kazanımlar</h3>
                  <GrupTablosu
                    baslik="Kazanım"
                    satirlar={r.kazanimlar.map((k) => ({
                      anahtar: k.id,
                      ad: (
                        <>
                          {k.kod ? <span className="me-1.5 font-mono text-theme-xs text-gray-500">{k.kod}</span> : null}
                          {k.ad}
                        </>
                      ),
                      alt: k.konuAd,
                      soru: k.soru,
                      dogru: k.dogru,
                      yanlis: k.yanlis,
                      bos: k.bos,
                      net: k.net,
                      basari: k.basari,
                    }))}
                  />
                </div>
              ) : null}
              {r.altKazanimlar.length > 0 ? (
                <div>
                  <h3 className="px-5 pt-2 font-display text-sm font-semibold text-gray-800 sm:px-6">Alt kazanımlar</h3>
                  <GrupTablosu
                    baslik="Alt kazanım"
                    satirlar={r.altKazanimlar.map((k) => ({
                      anahtar: k.id,
                      ad: (
                        <>
                          {k.kod ? <span className="me-1.5 font-mono text-theme-xs text-gray-500">{k.kod}</span> : null}
                          {k.ad}
                        </>
                      ),
                      alt: k.kazanimAd,
                      soru: k.soru,
                      dogru: k.dogru,
                      yanlis: k.yanlis,
                      bos: k.bos,
                      net: k.net,
                      basari: k.basari,
                    }))}
                  />
                </div>
              ) : null}
            </div>
          </details>
        ) : null}

        <CevapInceleme inceleme={r.inceleme} />

        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-gray-200 pt-8 print:hidden">
          <ButtonLink href="/sinav-sec" size="md" startIcon={<Plus />}>
            Yeni check-up
          </ButtonLink>
          <ButtonLink href="/panel" size="md" variant="outline">
            Panele dön
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
