"use client";

import { useState, useTransition } from "react";
import { abonelikDegistirAction } from "@/lib/actions/abonelik";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

export function AbonelikForm({ token, kapali }: { token: string; kapali: boolean }) {
  const [durum, setDurum] = useState(kapali);
  const [hata, setHata] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function degistir(kapat: boolean) {
    setHata(null);
    start(async () => {
      const r = await abonelikDegistirAction(token, kapat);
      if (r.error) setHata(r.error);
      else setDurum(Boolean(r.kapali));
    });
  }

  return (
    <div className="space-y-4">
      {hata ? (
        <Alert variant="error" compact>
          {hata}
        </Alert>
      ) : null}
      <Alert variant={durum ? "info" : "success"} compact>
        {durum ? "Haftalık posta kapalı. Artık pazartesi postası gelmeyecek." : "Haftalık posta açık."}
      </Alert>
      <Button block size="md" variant={durum ? "outline" : "primary"} loading={pending} onClick={() => degistir(!durum)}>
        {durum ? "Haftalık postayı yeniden aç" : "Haftalık postayı kapat"}
      </Button>
    </div>
  );
}
