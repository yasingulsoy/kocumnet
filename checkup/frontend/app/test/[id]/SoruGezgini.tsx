"use client";

import type { TestSorusu } from "@/lib/tipler";
import { cx } from "@/components/tailadmin/cx";

export type KayitDurumu = "bekliyor" | "tamam" | "hata";

export interface Bolum {
  ders: string;
  /** Bölümün ilk ve son sorusunun dizindeki yeri (0'dan). */
  ilk: number;
  son: number;
}

/** Ardışık aynı dersten sorular bir bölüm olur (backend dersi ve konuyu sıralı verir). */
export function bolumlereAyir(sorular: TestSorusu[]): Bolum[] {
  const liste: Bolum[] = [];
  sorular.forEach((s, i) => {
    const son = liste[liste.length - 1];
    if (son && son.ders === s.ders) son.son = i;
    else liste.push({ ders: s.ders, ilk: i, son: i });
  });
  return liste;
}

/**
 * Numaralı soru ızgarası. Ayrım yalnızca renkle değil:
 *  · cevaplanan: dolu kutu ve altında seçilen şıkkın harfi,
 *  · boş: çerçeveli beyaz kutu,
 *  · şu anki: kalın dış halka ve aria-current,
 *  · kaydedilemeyen: köşede ünlem rozeti.
 */
export function SoruGezgini({
  sorular,
  bolumler,
  cevaplar,
  kayit,
  indeks,
  onSec,
}: {
  sorular: TestSorusu[];
  bolumler: Bolum[];
  cevaplar: Record<number, number | null>;
  kayit: Record<number, KayitDurumu>;
  indeks: number;
  onSec: (i: number) => void;
}) {
  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-caption text-gray-600" aria-label="İşaretlerin anlamı">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded bg-brand-500 text-micro leading-none font-bold text-white">
            A
          </span>
          Cevaplandı
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-5 w-5 rounded bg-white ring-1 ring-gray-300 ring-inset" />
          Boş
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-5 w-5 rounded bg-white ring-2 ring-gray-800 ring-offset-1" />
          Şu anki
        </li>
      </ul>

      <div className="space-y-4">
        {bolumler.map((b) => (
          <section key={`${b.ders}-${b.ilk}`} aria-label={`${b.ders}, soru ${b.ilk + 1}–${b.son + 1}`}>
            {bolumler.length > 1 ? (
              <h3 className="mb-2 text-micro font-semibold tracking-wide text-gray-500 uppercase">{b.ders}</h3>
            ) : null}
            <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
              {sorular.slice(b.ilk, b.son + 1).map((s, j) => {
                const i = b.ilk + j;
                const secilen = cevaplar[s.sira];
                const harf = secilen != null ? s.siklar.find((k) => k.id === secilen)?.harf : undefined;
                const dolu = secilen != null;
                const aktif = i === indeks;
                const hata = kayit[s.sira] === "hata";
                return (
                  <li key={s.sira}>
                    <button
                      type="button"
                      onClick={() => onSec(i)}
                      aria-current={aktif ? "step" : undefined}
                      aria-label={`Soru ${i + 1}, ${dolu ? `cevap ${harf ?? ""}` : "boş"}${hata ? ", kaydedilemedi" : ""}`}
                      className={cx(
                        "tabular relative flex h-11 w-full cursor-pointer touch-manipulation flex-col items-center justify-center rounded-lg text-sm leading-none font-semibold transition",
                        dolu ? "bg-brand-500 text-white hover:bg-brand-600" : "bg-white text-gray-700 hover:bg-gray-50",
                        aktif ? "ring-2 ring-gray-800 ring-offset-2 ring-offset-white" : !dolu && "ring-1 ring-gray-300 ring-inset"
                      )}
                    >
                      {i + 1}
                      {dolu && harf ? <span className="mt-0.5 text-micro leading-none font-bold opacity-90">{harf}</span> : null}
                      {hata ? (
                        <span
                          aria-hidden
                          className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-error-600 text-micro leading-none font-bold text-white ring-2 ring-white"
                        >
                          !
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
