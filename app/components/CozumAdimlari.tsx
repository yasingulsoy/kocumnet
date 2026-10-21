"use client";

import { useState, type ReactNode } from "react";
import { ChevronsDown, ListOrdered, ScrollText } from "lucide-react";
import { cx } from "@/components/tailadmin/cx";
import { Button } from "@/components/tailadmin/ui/Button";

/*
 * ⚠️ Adımlar SUNUCUDA çizilip buraya hazır düğüm olarak geliyor (MathContent,
 * çözüm splitSolutionSteps ile bölünmüş). Bu dosya istemci bileşeni; KaTeX'i
 * import etmez (smoke testi istemciden katex'e giden zinciri yakalar).
 */

/**
 * Adım adım çözüm. İlk adım görünür; "Sonraki adım (2/4)" bir adım daha
 * açar, "Tümünü göster" hepsini. Amaç: takılan öğrenci çözümün tamamını
 * okumadan, yalnızca bir sonraki adımı görüp kendisi devam etmeyi denesin.
 *
 * Tek adımlı çözüm bugünkü gibi düz görünür (düğme yok). Yazdırırken bütün
 * adımlar basılır: kâğıtta "sonraki adım" düğmesi yok.
 */
export function CozumAdimlari({ adimlar, className }: { adimlar: ReactNode[]; className?: string }) {
  const [gorunen, setGorunen] = useState(1);
  const toplam = adimlar.length;
  if (toplam === 0) return null;
  const cokAdimli = toplam > 1;

  return (
    <div className={cx("rounded-xl border border-brand-100 bg-brand-25 p-3.5 sm:p-5", className)}>
      <p className="flex items-center gap-2 text-theme-xs font-semibold tracking-wide text-brand-500 uppercase">
        {cokAdimli ? <ListOrdered className="size-4" aria-hidden /> : <ScrollText className="size-4" aria-hidden />}
        {cokAdimli ? `Çözüm · ${toplam} adım` : "Çözüm"}
      </p>

      {cokAdimli ? (
        <ol className="mt-2.5 space-y-3" aria-live="polite">
          {adimlar.map((adim, i) => (
            <li
              key={i}
              className={cx(
                "border-brand-100 [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-3",
                // Kapalı adım ekranda yok, kâğıtta var.
                i >= gorunen && "hidden print:block"
              )}
            >
              <p className="tabular text-theme-xs font-semibold text-gray-500">
                {i + 1}. adım
              </p>
              <div className="okuma mt-1 text-body leading-relaxed text-gray-800">{adim}</div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="okuma mt-2.5 text-body leading-relaxed text-gray-800">{adimlar[0]}</div>
      )}

      {cokAdimli && gorunen < toplam ? (
        <div className="mt-3.5 flex flex-wrap gap-2 print:hidden">
          <Button size="xs" variant="soft" startIcon={<ChevronsDown />} onClick={() => setGorunen((n) => Math.min(toplam, n + 1))}>
            <span className="tabular">
              Sonraki adım ({gorunen + 1}/{toplam})
            </span>
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setGorunen(toplam)}>
            Tümünü göster
          </Button>
        </div>
      ) : null}
    </div>
  );
}
