"use client";

import { useActionState } from "react";
import { BookOpenCheck, Play, Shuffle } from "lucide-react";
import {
  benzeriniCozAction,
  konuCalisAction,
  tekrarBaslatAction,
  type AlistirmaBaslatDurumu,
} from "@/lib/actions/practice";
import { cx } from "@/components/tailadmin/cx";
import { Button } from "@/components/tailadmin/ui/Button";

/*
 * Alıştırma açan düğmeler (kitin Button'ı). İstemci bileşeni çünkü bekleme
 * durumu ve hata aynı yerde görünmeli: soru seçimi birkaç yüz milisaniye
 * sürüyor, hata (ör. günlük hak doldu) düğmenin altında söyleniyor — ölü
 * düğme yok.
 */

const ilk: AlistirmaBaslatDurumu = {};

function Hata({ metin, className }: { metin?: string; className?: string }) {
  if (!metin) return null;
  return (
    <p role="alert" className={cx("text-theme-xs font-medium text-error-600", className)}>
      {metin}
    </p>
  );
}

/** "Benzerini çöz" — sonuçtaki bir yanlışın (ya da boşun) benzeri, tek soru. */
export function BenzeriniCozButonu({
  sessionId,
  questionId,
  etiket = "Benzerini çöz",
  className,
}: {
  sessionId: string;
  questionId: string;
  etiket?: string;
  className?: string;
}) {
  const [durum, eylem, bekliyor] = useActionState(benzeriniCozAction, ilk);
  return (
    <form action={eylem} className={cx("space-y-2", className)}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="questionId" value={questionId} />
      <Button type="submit" variant="soft" size="xs" loading={bekliyor} startIcon={<Shuffle />}>
        {bekliyor ? "Hazırlanıyor…" : etiket}
      </Button>
      <Hata metin={durum.error} />
    </form>
  );
}

/** "Tekrara başla" — yanlış defterinden bugünkü tekrar. */
export function TekrarBaslatButonu({ etiket = "Tekrara başla", block = false }: { etiket?: string; block?: boolean }) {
  const [durum, eylem, bekliyor] = useActionState(tekrarBaslatAction, ilk);
  return (
    <form action={eylem} className={cx("space-y-2", block ? "w-full" : "max-sm:w-full")}>
      <Button type="submit" block loading={bekliyor} startIcon={<Play />}>
        {bekliyor ? "Hazırlanıyor…" : etiket}
      </Button>
      <Hata metin={durum.error} />
    </form>
  );
}

/** "Bu konuda çalış" — zayıf konudan birkaç soruluk süresiz alıştırma. */
export function KonuCalisButonu({
  sessionId,
  topicId,
  topicName,
  soruSayisi,
}: {
  sessionId: string;
  topicId: string;
  topicName: string;
  soruSayisi: number;
}) {
  const [durum, eylem, bekliyor] = useActionState(konuCalisAction, ilk);
  return (
    <form action={eylem} className="shrink-0">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="topicId" value={topicId} />
      <Button
        type="submit"
        variant="soft"
        size="xs"
        loading={bekliyor}
        startIcon={<BookOpenCheck />}
        aria-label={`${topicName} konusunda en fazla ${soruSayisi} soruluk süresiz alıştırma`}
      >
        {bekliyor ? "Hazırlanıyor…" : "Bu konuda çalış"}
      </Button>
      <Hata metin={durum.error} className="mt-1.5 max-w-xs" />
    </form>
  );
}
