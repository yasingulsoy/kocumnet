import {
  HARITA_EN_AZ_SORU,
  HARITA_GUCLU_ORAN,
  HARITA_ORTA_ORAN,
  type AggregateTopic,
} from "@/lib/checkup/shared/insights";
import type { RaporKonusu } from "@/lib/checkup/gruplar";
import { LEVEL_LABEL, percent } from "@/lib/checkup/format";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { levelColor } from "./ui";

/*
 * Grup raporu: konu × öğrenci ısı haritası. Tablo, grafik değil: hücre
 * sayısını okumak gerekiyor ve telefonda yatay kayıyor; ApexCharts'ın
 * ısı haritası ne ekran okuyucuya ne 360 px'e uyuyordu.
 *
 * Oran ve seviye öğrenci panosunun kuralı (shared/insights.ts aggregateTopics;
 * lejanttaki eşikler de oradan, HARITA_*). Eşiğin altındaki soru sayısında
 * seviye yok: hücre gri ve oran yerine "doğru/soru" yazar — iki sorudan
 * "%0, zayıf" demek yazı-turadır.
 *
 * Sunucu bileşeni (hook yok); Map'ler sayfadan gelir, istemciye gitmez.
 */

const ZEMIN: Record<string, string> = {
  STRONG: "bg-success-50 text-success-700",
  MEDIUM: "bg-warning-50 text-warning-700",
  WEAK: "bg-error-50 text-error-700",
};

/** Lejant: "(%75+)", "(%45-74)", "(%45 altı)" — eşikler shared/insights.ts'ten. */
const ESIK_METNI: Record<"STRONG" | "MEDIUM" | "WEAK", string> = {
  STRONG: `(${percent(HARITA_GUCLU_ORAN)}+)`,
  MEDIUM: `(${percent(HARITA_ORTA_ORAN)}-${Math.round(HARITA_GUCLU_ORAN * 100) - 1})`,
  WEAK: `(${percent(HARITA_ORTA_ORAN)} altı)`,
};

/** Sütun başlığı: "Ayşe Y." — tam ad üstüne gelince. */
function kisaAd(ad: string): string {
  const parcalar = ad.trim().split(/\s+/);
  if (parcalar.length < 2) return parcalar[0] ?? ad;
  return parcalar[0] + " " + parcalar[parcalar.length - 1].charAt(0).toLocaleUpperCase("tr-TR") + ".";
}

function Hucre({ h, ad, konu }: { h: AggregateTopic | undefined; ad: string; konu: string }) {
  if (!h || h.asked === 0) {
    return (
      <td className="border-b border-gray-100 px-1 py-1">
        <span className="flex h-9 items-center justify-center rounded-md bg-gray-25 text-theme-xs text-gray-300" title={`${ad} · ${konu}: son 30 günde sorulmadı`}>
          <span aria-hidden>·</span>
          <span className="sr-only">sorulmadı</span>
        </span>
      </td>
    );
  }
  const aciklama = `${ad} · ${konu}: ${h.correct}/${h.asked} doğru` + (h.level ? ` (${percent(h.ratio)}, ${LEVEL_LABEL[h.level].toLocaleLowerCase("tr-TR")})` : ` — seviye için en az ${HARITA_EN_AZ_SORU} soru gerekir`);
  return (
    <td className="border-b border-gray-100 px-1 py-1">
      <span
        className={cx(
          "tabular flex h-9 min-w-12 items-center justify-center rounded-md px-1.5 text-theme-xs font-semibold",
          h.level ? ZEMIN[h.level] : "bg-gray-50 font-normal text-gray-500"
        )}
        title={aciklama}
      >
        <span aria-hidden>{h.level ? percent(h.ratio) : `${h.correct}/${h.asked}`}</span>
        <span className="sr-only">{aciklama}</span>
      </span>
    </td>
  );
}

export function GrupIsiHaritasi({
  konular,
  uyeler,
  hucreler,
}: {
  konular: RaporKonusu[];
  uyeler: { userId: string; name: string }[];
  hucreler: Map<string, Map<string, AggregateTopic>>;
}) {
  return (
    <div>
      <div className="max-w-full overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-start text-theme-sm">
          <caption className="sr-only">
            Konu × öğrenci: son 30 günün testlerinde doğru oranı; en zayıf konu en üstte
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky start-0 z-1 min-w-44 border-b border-gray-100 bg-white px-3 py-2 text-start text-theme-xs font-medium text-gray-500 sm:px-6"
              >
                Konu
              </th>
              <th scope="col" className="border-b border-gray-100 px-2 py-2 text-center text-theme-xs font-medium text-gray-500">
                Grup
              </th>
              {uyeler.map((u) => (
                <th
                  key={u.userId}
                  scope="col"
                  title={u.name}
                  className="max-w-24 border-b border-gray-100 px-1 py-2 text-center text-theme-xs font-medium whitespace-nowrap text-gray-500"
                >
                  <span className="block truncate">{kisaAd(u.name)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {konular.map((k) => (
              <tr key={k.topicId}>
                <th
                  scope="row"
                  className="sticky start-0 z-1 max-w-56 border-b border-gray-100 bg-white px-3 py-1 text-start font-medium text-gray-800 sm:px-6"
                >
                  <span className="line-clamp-2 break-words">{k.name}</span>
                </th>
                <td className="border-b border-gray-100 px-2 py-1 text-center">
                  {k.level ? (
                    <Badge size="sm" color={levelColor(k.level)}>
                      <span className="tabular">{percent(k.ratio)}</span>
                    </Badge>
                  ) : (
                    <span className="tabular text-theme-xs text-gray-500" title={`Seviye için grup toplamında en az ${HARITA_EN_AZ_SORU} soru gerekir`}>
                      {k.correct}/{k.asked}
                    </span>
                  )}
                </td>
                {uyeler.map((u) => (
                  <Hucre key={u.userId} h={hucreler.get(u.userId)?.get(k.topicId)} ad={u.name} konu={k.name} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 px-5 py-3 text-theme-xs text-gray-500 sm:px-6">
        {(["STRONG", "MEDIUM", "WEAK"] as const).map((l) => (
          <li key={l} className="flex items-center gap-1.5">
            <span aria-hidden className={cx("size-3 rounded-sm", ZEMIN[l])} />
            {LEVEL_LABEL[l]} {ESIK_METNI[l]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-gray-50 ring-1 ring-gray-200" />
          {HARITA_EN_AZ_SORU} sorudan az: doğru/soru
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="text-gray-300">·</span> sorulmadı
        </li>
      </ul>
    </div>
  );
}
