import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, NotebookPen, Play } from "lucide-react";
import type { BugunkuTekrar } from "@/lib/practice";
import { GUNLUK_TEKRAR_SORU, vadeMetni } from "@/lib/review";
import { TekrarBaslatButonu } from "@/components/AlistirmaButonlari";
import { cx } from "@/components/tailadmin/cx";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";

/**
 * Yanlış defteri kartı — pano ve defter sayfasının başı (kitin Card'ı).
 *
 * Tek satır, tek eylem: bugün kaç soru, başla. Eylem yoksa nedenini söyler
 * (yarın, benzeri yok, teyit turu bekleniyor); "başla" deyip boş ekran
 * gösteren bir düğme yok.
 */
export function DefterKarti({
  durum,
  now,
  defterSayfasi = false,
}: {
  durum: BugunkuTekrar;
  now: Date;
  /** Defter sayfasında "Deftere bak" bağlantısı gösterilmez. */
  defterSayfasi?: boolean;
}) {
  const { acik, hazir, vadesiGelen, benzeriYok, teyitBekleyen, bugunTekrarlanan, acikMadde, siradakiVade } = durum;

  let baslik: string;
  let metin: string;
  let eylem: ReactNode = null;
  let vurgu = false;

  if (acik) {
    baslik = "Bugünkü tekrar yarım kaldı";
    metin = `${acik.toplam} sorudan ${acik.kalan} soru kaldı. Süre yok, kaldığın yerden devam et.`;
    eylem = (
      <ButtonLink href={`/alistirma/${acik.id}`} startIcon={<Play />} className="max-sm:w-full">
        Devam et
      </ButtonLink>
    );
    vurgu = true;
  } else if (hazir > 0) {
    baslik = `Yanlış defteri: bugün ${hazir} soru${bugunTekrarlanan > 0 ? " daha" : ""}`;
    metin = "Her biri bir yanlışının benzeri. Süre yok; her cevaptan sonra çözümü görürsün.";
    eylem = <TekrarBaslatButonu />;
    vurgu = true;
  } else if (acikMadde === 0) {
    baslik = "Yanlış defterin boş";
    metin =
      "Testlerde yanlış yaptığın ya da boş bıraktığın sorular buraya düşer ve aralıklarla benzerleriyle geri gelir.";
  } else if (bugunTekrarlanan >= GUNLUK_TEKRAR_SORU && vadesiGelen > 0) {
    baslik = "Bugünkü tekrarın tamam";
    metin = `Günde ${GUNLUK_TEKRAR_SORU} soru yeter. Kalan ${vadesiGelen} madde yarın.`;
  } else if (vadesiGelen > 0) {
    baslik = `Yanlış defteri: bugün ${vadesiGelen} madde bekliyor`;
    metin = [
      benzeriYok > 0 ? `${benzeriYok} maddenin şu an havuzda uygun benzeri yok; yeni sorular eklenince gelecek.` : "",
      teyitBekleyen > 0 ? `${teyitBekleyen} madde seviyeli check-up'taki teyit turundan sonra gelecek.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  } else {
    baslik = "Yanlış defteri: bugün tekrar yok";
    metin = `${acikMadde} açık madde${siradakiVade ? ` · sıradaki tekrar ${vadeMetni(siradakiVade, now)}` : ""}.`;
  }

  return (
    <Card tone={vurgu ? "brand" : "default"} className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
      <span
        className={cx(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          vurgu ? "bg-brand-50 text-brand-500" : "bg-gray-100 text-gray-500"
        )}
      >
        <NotebookPen className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-semibold text-balance text-gray-800">{baslik}</h2>
        {metin ? <p className="mt-0.5 text-theme-sm leading-relaxed text-gray-500">{metin}</p> : null}
      </div>
      {eylem}
      {!defterSayfasi && acikMadde > 0 ? (
        <Link
          href="/defter"
          className={cx(
            "inline-flex min-h-9 items-center gap-1 text-theme-sm font-medium text-brand-500 transition hover:text-brand-600",
            // Telefonda kendi satırında: başlığı sıkıştırmasın. Eylem yoksa
            // metnin hizasında (ikon 44 px + boşluk 12 px).
            eylem ? "max-sm:w-full max-sm:justify-center" : "max-sm:w-full max-sm:ps-14"
          )}
        >
          Deftere bak <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      ) : null}
    </Card>
  );
}
