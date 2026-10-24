"use client";

import { useActionState } from "react";
import { Zap } from "lucide-react";
import { konuCalisAction, type AlistirmaBaslatDurumu } from "@/lib/actions/practice";
import { KONU_CALISMA_SORU } from "@/lib/review";
import { cx } from "@/components/tailadmin/cx";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/tailadmin/ui/Button";

/*
 * Ana sayfanın "5 soru çöz" düğmesi: bir konudan KONU_CALISMA_SORU soruluk
 * süresiz alıştırma (lib/practice.ts konuCalismasiBaslat, "Bu konuda çalış"la
 * aynı eylem). Kaynak test, konunun ölçüldüğü test: plan işinde planın
 * kurulduğu test, "Hızlı 5 soru"da konunun son ölçüldüğü test. Hata (günlük
 * hak doldu, havuz bitti) düğmenin altında söylenir; ölü düğme yok.
 */

const ilk: AlistirmaBaslatDurumu = {};

export function KonuBesSoruButonu({
  sessionId,
  topicId,
  topicName,
  etiket = `${KONU_CALISMA_SORU} soru çöz`,
  variant = "primary",
  size = "sm",
  block = false,
  className,
}: {
  sessionId: string;
  topicId: string;
  topicName: string;
  etiket?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}) {
  const [durum, eylem, bekliyor] = useActionState(konuCalisAction, ilk);
  return (
    <form action={eylem} className={cx("space-y-2", block ? "w-full" : "max-sm:w-full", className)}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="topicId" value={topicId} />
      {/* Düğme yalnızca ana sayfada: özet "Sonuca dön" değil "Ana sayfaya dön" desin. */}
      <input type="hidden" name="donus" value="panel" />
      <Button
        type="submit"
        variant={variant}
        size={size}
        block={block}
        loading={bekliyor}
        startIcon={<Zap />}
        aria-label={`${topicName}: ${KONU_CALISMA_SORU} soruluk süresiz alıştırma`}
        className={block ? undefined : "max-sm:w-full"}
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
