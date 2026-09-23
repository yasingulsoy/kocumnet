"use client";

import { useTransition } from "react";
import { ClipboardCheck } from "lucide-react";
import { konuTekrarBaslat } from "@/lib/actions/plan";

/**
 * "Kontrol testi" düğmesi — bir konuda 5 soruluk kısa test başlatır.
 *
 * Neden ayrı bir bileşen: sunucu bileşeni içinden form action'ı çağırmak
 * mümkün ama bekleme durumunu göstermek istiyoruz. Öğrenci dokunduktan
 * sonra soru seçimi birkaç yüz milisaniye sürebiliyor ve düğme ölü
 * görünüyordu.
 */
export function KonuTekrarButonu({
  topicId,
  topicName,
}: {
  topicId: string;
  topicName: string;
}) {
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) => start(() => konuTekrarBaslat(fd))}
      className="shrink-0"
    >
      <input type="hidden" name="topicId" value={topicId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`${topicName} konusunda 5 soruluk kontrol testi çöz`}
        className="flex min-h-9 items-center gap-1.5 rounded-lg bg-surface-sunk px-3 text-micro font-semibold text-brand ring-1 ring-inset ring-line transition active:bg-brand-wash disabled:opacity-60"
      >
        <ClipboardCheck className="size-3.5" />
        {pending ? "Hazırlanıyor…" : "5 soruluk test"}
      </button>
    </form>
  );
}
