import { ClipboardCheck } from "lucide-react";
import type { VeliOdevi } from "@/lib/veli-raporu";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";

/*
 * Veli raporu: koçun ödevleri (app/veli/[token]). Yalnızca ödevin adı, son
 * tarihi ve tamamlanıp tamamlanmadığı; koçun notu, grup, soru ve sonuç yok
 * (lib/veli-raporu.ts VeliOdevi). Öğrencinin grubu ya da ödevi yoksa hiç
 * çizilmez. `npm run test:veli` ve scripts/ekran-test.mts HTML'ini tarar.
 */

/** "28 Ekim Çarşamba, 23:59" — Türkiye saatiyle (ödevler sayfasıyla aynı biçim). */
function sonTarih(d: Date): string {
  return d.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VeliOdevleri({ odevler, now }: { odevler: readonly VeliOdevi[]; now: Date }) {
  if (odevler.length === 0) return null;
  return (
    <ComponentCard
      icon={<ClipboardCheck aria-hidden />}
      title="Koçun verdiği ödevler"
      desc="Açık olanlar ve son 7 günde tamamlananlar, son tarihe göre"
      flush
    >
      <ul className="divide-y divide-gray-100">
        {odevler.map((o, i) => {
          const gecikti = !o.tamamlandi && o.sonTarih.getTime() < now.getTime();
          return (
            <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-5 py-3.5 sm:px-6">
              <div className="min-w-0 flex-[1_1_14rem]">
                <p className="text-theme-sm font-medium break-words text-gray-800">{o.ad}</p>
                <p className="mt-0.5 text-theme-xs text-gray-500">Son tarih: {sonTarih(o.sonTarih)}</p>
              </div>
              <Badge size="sm" color={o.tamamlandi ? "success" : gecikti ? "error" : "light"}>
                {o.tamamlandi ? "Tamamlandı" : gecikti ? "Gecikti" : "Devam ediyor"}
              </Badge>
            </li>
          );
        })}
      </ul>
    </ComponentCard>
  );
}
