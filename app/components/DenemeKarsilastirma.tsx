import { FileText, Info, Users } from "lucide-react";
import { denemeKarsilastirmasi } from "@/lib/checkup";
import { yuzdeSinden } from "@/lib/deneme";
import { trNumber } from "@/components/ui";
import { cx } from "@/components/tailadmin/cx";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";

/**
 * Sonuç ekranı, yalnızca deneme sınavında: netin, bu denemeyi çözenler
 * arasında nerede. Havuz ve eşik kuralları lib/checkup.ts denemeHavuzu ve
 * lib/deneme.ts karsilastir'da.
 *
 * Başkalarının adı, kimliği, sırası hiçbir yerde yok: yalnızca bir yüzde ve
 * net aralıklarına düşen kişi SAYILARI. Deneme değilse hiçbir şey çizmez.
 */
export async function DenemeKarsilastirmaKarti({ sessionId, userId }: { sessionId: string; userId: string }) {
  const k = await denemeKarsilastirmasi(sessionId, userId);
  if (!k) return null;

  // Bu sonuç neden havuzda değil — öğrenci "beni saymamışlar" sanmasın.
  const not = k.kagit
    ? "Kâğıtta çözdüğün için bu sonuç karşılaştırmaya girmedi; yerin, denemeyi ekranda çözenlere göre."
    : !k.havuzda
      ? "Bu denemeyi daha önce çözdüğün için bu sonuç karşılaştırmaya girmedi; yalnızca ilk denemen sayılıyor."
      : null;

  /*
   * Denemenin soruları sabit: sayfanın genel "10 gün sonra tekrar çöz"
   * cümlesi denemede yanlış (aynı sorular gelir). Burada açıkça söylüyoruz.
   */
  const sabit = "Denemenin soruları sabit: tekrar çözersen aynı soruları görürsün. Sonraki provan için başka bir deneme seç.";

  if (!k.acik) {
    return (
      <Card className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
          <Users className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-theme-sm leading-relaxed text-gray-700">
            <span className="tabular font-semibold text-gray-800">{k.katilimci}</span> kişi çözdü; karşılaştırma{" "}
            <span className="tabular">{k.esik}</span> kişiden sonra açılır.
          </p>
          {not ? <p className="mt-1 text-theme-xs leading-relaxed text-gray-500">{not}</p> : null}
          <p className="mt-1 text-theme-xs leading-relaxed text-gray-500">{sabit}</p>
        </div>
      </Card>
    );
  }

  const enCok = Math.max(1, ...k.araliklar.map((a) => a.sayi));

  return (
    <ComponentCard
      title="Bu denemeyi çözenler arasında"
      desc={`${k.katilimci} kişi çözdü · kişi başına yalnızca ilk deneme sayılır`}
      icon={<Users aria-hidden />}
    >
      <p className="font-display text-base font-semibold text-balance text-gray-800 sm:text-lg">
        {k.yuzdelik > 0
          ? `Netin, bu denemeyi çözenlerin ${yuzdeSinden(k.yuzdelik)} yüksek.`
          : "Bu denemede netin, çözenlerin hiçbirinden yüksek değil."}
      </p>
      {k.esitYuzde > 0 ? (
        <p className="tabular mt-1 text-theme-sm text-gray-500">
          Çözenlerin %{k.esitYuzde} kadarı seninle aynı neti yaptı.
        </p>
      ) : null}

      {/* Dağılım: net aralığı başına kişi sayısı; senin aralığın vurgulu. */}
      <figure className="mt-5">
        <figcaption className="text-theme-xs font-semibold tracking-wider text-gray-500 uppercase">
          Net dağılımı
        </figcaption>
        <ul className="mt-3 space-y-1.5">
          {k.araliklar.map((a) => (
            <li key={a.alt} className="flex items-center gap-2.5 text-theme-sm">
              <span
                className={cx(
                  "tabular w-14 shrink-0 text-end",
                  a.benim ? "font-semibold text-brand-500" : "text-gray-500"
                )}
              >
                {a.alt}–{a.ust}
              </span>
              <span className="relative h-5 min-w-0 flex-1 rounded bg-gray-100" aria-hidden>
                <span
                  className={cx("absolute inset-y-0 start-0 rounded", a.benim ? "bg-brand-500" : "bg-gray-300")}
                  style={{ width: `${(a.sayi / enCok) * 100}%` }}
                />
              </span>
              <span className={cx("tabular w-16 shrink-0", a.benim ? "font-semibold text-gray-800" : "text-gray-500")}>
                {a.sayi} kişi
                {a.benim ? <span className="sr-only"> (senin netin bu aralıkta)</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-theme-xs text-gray-500">
          <span className="size-2.5 rounded-sm bg-brand-500" aria-hidden />
          Senin netin: <span className="tabular font-semibold text-gray-800">{trNumber(k.net, 2)}</span>
        </p>
      </figure>

      {not ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 text-theme-sm leading-relaxed text-gray-600">
          {k.kagit ? (
            <FileText className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden />
          )}
          {not}
        </p>
      ) : null}
      <p className="mt-3 text-theme-xs leading-relaxed text-gray-500">{sabit}</p>
    </ComponentCard>
  );
}
