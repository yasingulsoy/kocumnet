"use client";

import { useActionState } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { startCheckupAction, type StartState } from "@/lib/actions/checkup";
import { KonuTekrarButonu } from "@/components/KonuTekrarButonu";
import { Button } from "@/components/tailadmin/ui/Button";

/**
 * "Bu test yarım kaldı" kutusu (sonuç ekranının üstü).
 *
 * Süre dolup ya da test yeniden başlatılıp yarısından azı işaretli kalan test
 * ölçüm sayılmıyor (lib/insights.ts yarimKaldi). Öğrenci %8'lik bir sonuç ve
 * "bütün konular zayıf" görmesin; neyin olmadığını ve tek eylemi görsün.
 *
 * "Yeniden çöz" var olan başlatma yolunu kullanır: paket testinde
 * startCheckupAction (sorular yeniden seçilir, açık test varsa o döner),
 * kontrol testinde konunun kontrol testi (KonuTekrarButonu).
 */
export function YarimTestKutusu({
  toplam,
  isaretli,
  packageSlug,
  kontrolKonusu,
}: {
  toplam: number;
  isaretli: number;
  /** Paket testinde paketin adresi; kontrol testinde null. */
  packageSlug: string | null;
  /** Kontrol testinde konusu; paket testinde null. */
  kontrolKonusu: { id: string; ad: string } | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-4 sm:gap-4 sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-base leading-relaxed text-gray-800">
        Bu test yarım kaldı (<span className="tabular">{toplam}</span> sorudan{" "}
        {isaretli === 0 ? (
          "hiçbiri işaretlenmedi"
        ) : (
          <>
            <span className="tabular">{sayiIyelik(isaretli)}</span> işaretli
          </>
        )}
        ); ölçüm sayılmadı. Konu haritana ve planına girmedi.
      </p>
      <div className="shrink-0 max-sm:w-full print:hidden">
        {kontrolKonusu ? (
          <KonuTekrarButonu topicId={kontrolKonusu.id} topicName={kontrolKonusu.ad} />
        ) : packageSlug ? (
          <YenidenCoz packageSlug={packageSlug} />
        ) : null}
      </div>
    </div>
  );
}

const ilk: StartState = {};

function YenidenCoz({ packageSlug }: { packageSlug: string }) {
  const [durum, eylem, bekliyor] = useActionState(startCheckupAction, ilk);
  return (
    <form action={eylem} className="space-y-2">
      <input type="hidden" name="packageSlug" value={packageSlug} />
      <input type="hidden" name="mode" value="ONLINE" />
      <Button type="submit" loading={bekliyor} startIcon={<RotateCcw />} className="max-sm:w-full">
        {bekliyor ? "Hazırlanıyor…" : "Yeniden çöz"}
      </Button>
      {durum.error ? (
        <p role="alert" className="text-theme-xs font-medium text-error-600">
          {durum.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Sayının iyelik eki: 2'si, 3'ü, 6'sı, 10'u, 40'ı. Ek, sayının okunuşunun
 * son hecesine uyar (iki → -si, üç → -ü, on → -u, kırk → -ı).
 */
function sayiIyelik(n: number): string {
  const BIRLER = ["ı", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"]; // sıfır, bir, iki … dokuz
  const ONLAR = ["", "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"]; // on, yirmi, otuz … doksan
  let ek: string;
  if (n === 0) ek = BIRLER[0];
  else if (n % 10 !== 0) ek = BIRLER[n % 10];
  else if (n % 100 !== 0) ek = ONLAR[(n / 10) % 10];
  else ek = n % 1000 !== 0 ? "ü" : "i"; // yüz, bin
  return `${n}'${ek}`;
}
