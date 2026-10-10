"use client";

import { useTransition } from "react";
import { ClipboardCheck } from "lucide-react";
import { konuTekrarBaslat } from "@/lib/actions/plan";
import { Button } from "@/components/tailadmin/ui/Button";

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
    <form action={(fd) => start(() => konuTekrarBaslat(fd))} className="shrink-0">
      <input type="hidden" name="topicId" value={topicId} />
      <Button
        type="submit"
        variant="outline"
        size="xs"
        loading={pending}
        startIcon={<ClipboardCheck />}
        aria-label={`${topicName} konusunda 5 soruluk kontrol testi çöz`}
      >
        {pending ? "Hazırlanıyor…" : "5 soruluk test"}
      </Button>
    </form>
  );
}
