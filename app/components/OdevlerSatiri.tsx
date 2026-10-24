import { ArrowRight, ClipboardCheck } from "lucide-react";
import { kalanGunMetni } from "@/lib/odev";
import type { OgrenciOdevi } from "@/lib/odev-sorgu";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";

/**
 * Ana sayfa: koçun açık ödevleri, tek satır. Yoksa hiç çizilmez.
 *
 * Ödevler telefonda alt menüde yok (beş sekme) ve "Bugün" kartına yalnızca
 * son tarihi 3 gün içinde kalan ödev geliyor (lib/odev.ts BUGUN_ESIGI_GUN).
 * Bu satır olmadan öğrenci bir hafta sonraki ödevi son üç güne kadar
 * görmüyordu. Satır sayıyı ve son tarihi en yakın ödevi söyler; liste
 * ödevler sayfasında.
 */
export function OdevlerSatiri({ odevler, now }: { odevler: readonly OgrenciOdevi[]; now: Date }) {
  if (odevler.length === 0) return null;
  // Liste son tarihe göre sıralı geliyor (lib/odev-sorgu.ts): ilki en yakını.
  const ilk = odevler[0];
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <ClipboardCheck className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-[1_1_12rem]">
        <h2 className="font-display text-base font-semibold text-gray-800">
          Ödevlerin · <span className="tabular">{odevler.length}</span> açık
        </h2>
        <p className="mt-0.5 truncate text-theme-sm text-gray-500">
          {odevler.length > 1 ? "En yakını: " : ""}
          {ilk.title} · {ilk.gecikti ? "gecikti" : kalanGunMetni(ilk.dueAt, now)}
        </p>
      </div>
      <ButtonLink
        href="/odevler"
        variant="outline"
        endIcon={<ArrowRight className="rtl:rotate-180" />}
        className="max-sm:w-full"
      >
        Ödevlere git
      </ButtonLink>
    </Card>
  );
}
