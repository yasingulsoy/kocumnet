import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Gösterilecek sayfa numaraları: ilk, son, bulunulan ve iki komşusu; aralar
 * "…". En fazla yedi öğe — telefonda tek satıra sığsın.
 *   sayfaNumaralari(5, 10) -> [1, "…", 4, 5, 6, "…", 10]
 */
export function sayfaNumaralari(mevcut: number, toplam: number): (number | "…")[] {
  if (toplam <= 7) return Array.from({ length: toplam }, (_, i) => i + 1);
  const secili = new Set([1, toplam, mevcut - 1, mevcut, mevcut + 1]);
  if (mevcut <= 3) [2, 3, 4].forEach((n) => secili.add(n));
  if (mevcut >= toplam - 2) [toplam - 3, toplam - 2, toplam - 1].forEach((n) => secili.add(n));
  const liste = [...secili].filter((n) => n >= 1 && n <= toplam).sort((a, b) => a - b);

  const sonuc: (number | "…")[] = [];
  liste.forEach((n, i) => {
    if (i > 0 && n - liste[i - 1] > 1) sonuc.push("…");
    sonuc.push(n);
  });
  return sonuc;
}

const TEMEL =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-body font-medium transition";

/**
 * Sayfa gezinme çubuğu. İlk sayfada "Önceki", son sayfada "Sonraki" HİÇ
 * çizilmez (ölü düğme yerine yokluk); bulunulan sayfa aria-current="page".
 * Tek sayfa varsa hiçbir şey çizmez.
 */
export function Pagination({
  mevcut,
  toplam,
  href,
  etiketler,
}: {
  mevcut: number;
  toplam: number;
  href: (sayfa: number) => string;
  etiketler: { nav: string; onceki: string; sonraki: string; sayfa: (n: number) => string };
}) {
  if (toplam <= 1) return null;

  return (
    <nav aria-label={etiketler.nav} className="mt-14 flex flex-wrap items-center justify-center gap-2">
      {mevcut > 1 ? (
        <Link
          href={href(mevcut - 1)}
          rel="prev"
          className={cn(TEMEL, "text-ink-soft ring-1 ring-inset ring-line hover:bg-surface-hover hover:text-ink")}
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {etiketler.onceki}
        </Link>
      ) : null}

      <ol className="flex flex-wrap items-center gap-1">
        {sayfaNumaralari(mevcut, toplam).map((n, i) =>
          n === "…" ? (
            <li key={`bosluk-${i}`} aria-hidden className="px-1 text-ink-faint">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={href(n)}
                aria-label={etiketler.sayfa(n)}
                aria-current={n === mevcut ? "page" : undefined}
                className={cn(
                  TEMEL,
                  "tabular",
                  n === mevcut ? "bg-brand text-white" : "text-ink-soft hover:bg-surface-hover hover:text-ink"
                )}
              >
                {n}
              </Link>
            </li>
          )
        )}
      </ol>

      {mevcut < toplam ? (
        <Link
          href={href(mevcut + 1)}
          rel="next"
          className={cn(TEMEL, "text-ink-soft ring-1 ring-inset ring-line hover:bg-surface-hover hover:text-ink")}
        >
          {etiketler.sonraki}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
