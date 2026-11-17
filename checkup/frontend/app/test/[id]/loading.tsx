import { Loader2 } from "lucide-react";

/** Sınav ekranı açılırken: sade, dikkat dağıtmayan bekleme. */
export default function SinavYukleniyor() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <Loader2 className="size-8 animate-spin text-brand-500" aria-hidden />
      <p className="font-display text-base font-semibold text-gray-800">Check-up hazırlanıyor…</p>
      <p className="text-sm text-gray-500">Sorular ve kayıtlı cevapların yükleniyor.</p>
    </div>
  );
}
