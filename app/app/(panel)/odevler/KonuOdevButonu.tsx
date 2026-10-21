"use client";

import { useActionState } from "react";
import { BookOpenCheck } from "lucide-react";
import { odevKonuCalisAction, type AlistirmaBaslatDurumu } from "@/lib/actions/practice";
import { cx } from "@/components/tailadmin/cx";
import { Button } from "@/components/tailadmin/ui/Button";

/*
 * Konu ödevinin "Başla" düğmesi. Alıştırmayı ödevin kendisi açar
 * (lib/practice.ts odevKonuCalismasiBaslat): kaynak test İSTEMEZ, konuyu
 * hiç testte görmemiş öğrenci de ödevini yapar. Aynı konu alıştırması,
 * aynı soru seçimi, yarım kalan alıştırmaya dönüş; günlük sınır ödevin
 * kalan sorusunu engellemez (lib/review.ts odevAlistirmaAdedi).
 *
 * İstemci bileşeni: hata (ör. ödev kaldırıldı, konuda soru kalmadı)
 * düğmenin altında söylensin — ölü düğme yok.
 */

const ilk: AlistirmaBaslatDurumu = {};

export function KonuOdevButonu({
  assignmentId,
  topicName,
  etiket = "Başla",
  block = false,
}: {
  assignmentId: string;
  topicName: string;
  etiket?: string;
  block?: boolean;
}) {
  const [durum, eylem, bekliyor] = useActionState(odevKonuCalisAction, ilk);
  return (
    <form action={eylem} className={cx("space-y-2", block ? "w-full" : "max-sm:w-full")}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Button
        type="submit"
        block
        loading={bekliyor}
        startIcon={<BookOpenCheck />}
        aria-label={`${topicName} konusunda alıştırmaya ${etiket === "Devam et" ? "devam et" : "başla"}`}
      >
        {bekliyor ? "Hazırlanıyor…" : etiket}
      </Button>
      {durum.error ? (
        <p role="alert" className="text-theme-xs font-medium text-error-600">
          {durum.error}
        </p>
      ) : null}
    </form>
  );
}
