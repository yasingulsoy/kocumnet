"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { abonelikDegistirAction } from "@/lib/actions/abonelik";
import { Alert, Button } from "@/components/ui";

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
      {hata ? <Alert>{hata}</Alert> : null}
      <Alert tone={durum ? "info" : "ok"}>
        {durum ? "Haftalık posta kapalı. Artık pazartesi postası gelmeyecek." : "Haftalık posta açık."}
      </Alert>
      <Button block size="lg" variant={durum ? "secondary" : "primary"} disabled={pending} onClick={() => degistir(!durum)}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        {durum ? "Haftalık postayı yeniden aç" : "Haftalık postayı kapat"}
      </Button>
    </div>
  );
}
