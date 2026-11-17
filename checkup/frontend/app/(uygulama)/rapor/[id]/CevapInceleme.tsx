"use client";

import { useState } from "react";
import { CircleCheck, CircleDashed, CircleX, Lightbulb, PartyPopper } from "lucide-react";
import type { IncelemeSorusu } from "@/lib/tipler";
import { HtmlIcerik } from "@/components/HtmlIcerik";
import { SoruGorseli } from "@/components/SoruGorseli";
import { cx } from "@/components/tailadmin/cx";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";

type Suzgec = "tumu" | "yanlis" | "bos";

const SONUC = {
  dogru: { etiket: "Doğru", Ikon: CircleCheck, sinif: "bg-success-50 text-success-700" },
  yanlis: { etiket: "Yanlış", Ikon: CircleX, sinif: "bg-error-50 text-error-700" },
  bos: { etiket: "Boş", Ikon: CircleDashed, sinif: "bg-gray-100 text-gray-700" },
} as const;

function SoruKarti({ s }: { s: IncelemeSorusu }) {
  const sonuc = SONUC[s.sonuc];
  const baslikId = `inceleme-${s.sira}`;
  return (
    <article aria-labelledby={baslikId} className="yazdir-bolunmesin rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={baslikId} className="font-display text-base font-semibold text-gray-800">
          {s.sira}. soru
        </h3>
        <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-theme-xs font-semibold", sonuc.sinif)}>
          <sonuc.Ikon className="size-3.5" aria-hidden />
          {sonuc.etiket}
        </span>
        <p className="w-full text-caption text-gray-500">
          {[s.ders, s.konu, s.kazanim, s.altKazanim].filter(Boolean).join(" · ")}
        </p>
      </header>

      <HtmlIcerik html={s.metinHtml} className="mt-4 text-read text-gray-900" />
      {s.gorselId != null ? <SoruGorseli id={s.gorselId} className="mt-4" /> : null}

      <ul className="mt-5 space-y-2" aria-label="Şıklar">
        {s.siklar.map((k) => {
          const secilen = s.secilenSikId === k.id;
          const etiketler: string[] = [];
          if (secilen) etiketler.push("Senin cevabın");
          if (k.dogru) etiketler.push("Doğru cevap");
          return (
            <li
              key={k.id}
              className={cx(
                "rounded-xl border px-3 py-2.5 sm:px-4",
                k.dogru ? "border-success-500 bg-success-50" : secilen ? "border-error-500 bg-error-50" : "border-gray-200 bg-white"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cx(
                    "flex h-7 min-w-9 shrink-0 items-center justify-center rounded-lg px-1 font-display text-sm font-bold",
                    k.dogru ? "bg-success-600 text-white" : secilen ? "bg-error-600 text-white" : "text-gray-700"
                  )}
                >
                  {k.harf})
                </span>
                <HtmlIcerik as="span" html={k.metinHtml} className="block min-w-0 flex-1 pt-0.5 text-body text-gray-900" />
                {etiketler.length ? (
                  <span
                    className={cx(
                      "flex shrink-0 items-center gap-1 pt-0.5 text-theme-xs font-semibold",
                      k.dogru ? "text-success-700" : "text-error-700"
                    )}
                  >
                    {k.dogru ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
                    <span className="max-sm:sr-only">{etiketler.join(" · ")}</span>
                  </span>
                ) : null}
              </div>
              {k.aciklama && !k.dogru ? (
                <div className={cx("mt-2 ms-12 text-sm", secilen ? "text-error-700" : "text-gray-600")}>
                  <span className="font-semibold">Neden yanlış: </span>
                  {k.aciklamaHtml ? (
                    <HtmlIcerik as="span" html={k.aciklamaHtml} />
                  ) : (
                    <span className="whitespace-pre-line">{k.aciklama}</span>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {s.sonuc === "bos" ? <p className="mt-3 text-sm text-gray-600">Bu soruyu boş bıraktın.</p> : null}

      <div className="mt-5 rounded-xl bg-brand-25 p-4 ring-1 ring-brand-100 ring-inset">
        <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-brand-700">
          <Lightbulb className="size-4" aria-hidden />
          Çözüm
        </p>
        <HtmlIcerik html={s.cozumHtml} className="mt-2 text-body text-gray-800" />
      </div>
    </article>
  );
}

/** "Cevaplarını incele": her soru, öğrencinin şıkkı, doğru şık ve çözüm; süzgeçli. */
export function CevapInceleme({ inceleme }: { inceleme: IncelemeSorusu[] }) {
  const [suzgec, setSuzgec] = useState<Suzgec>("tumu");
  const yanlislar = inceleme.filter((s) => s.sonuc === "yanlis");
  const boslar = inceleme.filter((s) => s.sonuc === "bos");
  const liste = suzgec === "yanlis" ? yanlislar : suzgec === "bos" ? boslar : inceleme;

  return (
    <section aria-labelledby="inceleme-baslik">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="inceleme-baslik" className="font-display text-h2 font-semibold text-gray-800">
          Cevaplarını incele
        </h2>
        <SegmentedTabs
          label="Soruları süz"
          size="md"
          className="print:hidden"
          items={[
            { key: "tumu", label: "Tümü", count: inceleme.length, active: suzgec === "tumu", onClick: () => setSuzgec("tumu") },
            { key: "yanlis", label: "Yanlışlar", count: yanlislar.length, active: suzgec === "yanlis", onClick: () => setSuzgec("yanlis") },
            { key: "bos", label: "Boşlar", count: boslar.length, active: suzgec === "bos", onClick: () => setSuzgec("bos") },
          ]}
        />
      </div>

      {liste.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center">
          <PartyPopper className="size-8 text-brand-500" aria-hidden />
          <p className="mt-3 font-display text-base font-semibold text-gray-800">
            {suzgec === "yanlis" ? "Hiç yanlışın yok!" : suzgec === "bos" ? "Boş bıraktığın soru yok." : "Gösterilecek soru yok."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {liste.map((s) => (
            <SoruKarti key={s.sira} s={s} />
          ))}
        </div>
      )}
    </section>
  );
}
