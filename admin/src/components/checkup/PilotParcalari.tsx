import type { ReactNode } from "react";
import { GIZLI_ORAN, GIZLI_SAYI, oranGosterilir, oranMetni, sayiMetni } from "@/lib/checkup/pilot-kurallari";
import type { Tanim } from "@/lib/checkup/pilot-tanimlar";
import { cx } from "@/components/tailadmin/cx";
import { ComponentCard } from "@/components/tailadmin/ui/Card";

/*
 * Pilot ölçümü ekranının parçaları (sunucu bileşenleri). Sayılar yalnızca
 * pilot-kurallari.ts'in metin fonksiyonlarıyla yazılır: küçük sayı kuralı
 * ekranda ve raporda aynı yerden gelsin, bir bileşen ham sayıyı yanlışlıkla
 * basmasın.
 */

/** Kişi ya da test sayısı; gizliyse ekran okuyucuya ne demek olduğu söylenir. */
export function PilotSayi({ n, className }: { n: number; className?: string }) {
  const metin = sayiMetni(n);
  return (
    <span className={cx("tabular", className)} title={metin === GIZLI_SAYI ? "Beşten az: küçük sayılar yazılmaz" : undefined}>
      {metin}
    </span>
  );
}

/** Oran ve ince çubuk; küçük sayıda yalnızca "—". */
export function PilotOran({ pay, payda, cubuk = false }: { pay: number; payda: number; cubuk?: boolean }) {
  if (!oranGosterilir(pay, payda)) {
    return (
      <span className="tabular text-gray-400" title="Küçük sayıdan oran yazılmaz">
        {GIZLI_ORAN}
      </span>
    );
  }
  const yuzde = Math.min(100, Math.round((pay / payda) * 100));
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {cubuk ? (
        <span aria-hidden className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 sm:inline-block">
          <span className="block h-full rounded-full bg-brand-500" style={{ width: yuzde + "%" }} />
        </span>
      ) : null}
      <span className="tabular font-medium text-gray-800">{oranMetni(pay, payda)}</span>
    </span>
  );
}

/** Bir bölümün altındaki tanım listesi: hoca her sayının neyi saydığını ekranda okusun. */
export function PilotTanimlar({ tanimlar, baslik = "Tanımlar" }: { tanimlar: readonly Tanim[]; baslik?: string }) {
  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:px-6">
      <p className="text-theme-xs font-semibold tracking-wide text-gray-500 uppercase">{baslik}</p>
      <dl className="mt-2 grid gap-x-6 gap-y-2 text-theme-xs text-gray-600 lg:grid-cols-2">
        {tanimlar.map((t) => (
          <div key={t.ad} className="min-w-0">
            <dt className="inline font-semibold text-gray-700">{t.ad}: </dt>
            <dd className="inline">{t.metin}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Bölüm kartı: başlık, kaç kişiden hesaplandığı, içerik (tablo) ve tanımlar. */
export function PilotBolum({
  id,
  baslik,
  aciklama,
  taban,
  tanimlar,
  children,
}: {
  id: string;
  baslik: string;
  aciklama?: ReactNode;
  /** "Kaç kişiden" rozeti: "38 öğrenci". */
  taban?: ReactNode;
  tanimlar: readonly Tanim[];
  children: ReactNode;
}) {
  return (
    <ComponentCard
      id={id}
      title={baslik}
      desc={aciklama}
      badge={
        taban ? (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-700">{taban}</span>
        ) : undefined
      }
      flush
      className="scroll-mt-24"
    >
      {children}
      <PilotTanimlar tanimlar={tanimlar} />
    </ComponentCard>
  );
}
