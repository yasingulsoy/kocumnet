"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { seviyeliBirakAction } from "@/lib/actions/levels";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";

/**
 * Karnedeki "Bu denemeyi bırak" düğmesi.
 *
 * Onaysız bırakmak geri alınamaz bir tıklama olurdu: koşu kapanır, kaldığı
 * yerden devam edilemez. Bu yüzden kitin onay penceresi (tehlikeli işlem:
 * odak "Vazgeç"te başlar). Bırakılan koşu silinmez; karnede "bırakıldı"
 * olarak kalır ve öğrenci yenisini başlatabilir.
 */
export function DenemeyiBirak({ runId, sinav }: { runId: string; sinav: string }) {
  const [onayPenceresi, onayla] = useConfirm();
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  async function birak() {
    const evet = await onayla({
      title: "Bu deneme bırakılsın mı?",
      description: `${sinav} seviyeli check-up'ın burada kapanır ve kaldığın yerden devam edemezsin. Çözdüğün aşamalar karnende "bırakıldı" olarak kalır; istediğin zaman yeni bir deneme başlatabilirsin.`,
      confirmLabel: "Denemeyi bırak",
      tone: "danger",
    });
    if (!evet) return;
    setHata(null);
    basla(async () => {
      try {
        const r = await seviyeliBirakAction(runId);
        if (!r.ok) setHata(r.error ?? "Deneme bırakılamadı.");
      } catch {
        setHata("Deneme bırakılamadı. Sayfayı yenileyip tekrar dene.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {hata ? (
        <Alert variant="error" compact>
          {hata}
        </Alert>
      ) : null}
      <Button
        variant="danger-outline"
        size="sm"
        onClick={birak}
        loading={bekliyor}
        startIcon={<LogOut aria-hidden />}
        className="max-sm:w-full"
      >
        Bu denemeyi bırak
      </Button>
      {onayPenceresi}
    </div>
  );
}
