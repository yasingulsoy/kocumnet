"use client";

import { useActionState } from "react";
import { ArrowRight, UserPlus } from "lucide-react";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { katilAction, type KatilDurumu } from "./actions";

const ilk: KatilDurumu = {};

/** "Gruba katıl" düğmesi ve sonucu. Kod gizli alanda; eylem yeniden doğrular. */
export function KatilFormu({ kod }: { kod: string }) {
  const [durum, eylem, bekliyor] = useActionState(katilAction, ilk);

  if (durum.sonuc === "KATILDI" || durum.sonuc === "ZATEN_UYE") {
    return (
      <div className="space-y-5">
        <Alert variant="success">
          {durum.sonuc === "KATILDI" ? "Gruba katıldın." : "Zaten bu gruptasın."} Koçunun verdiği ödevler ana
          sayfanda görünecek.
        </Alert>
        <ButtonLink href="/panel" size="md" block endIcon={<ArrowRight className="rtl:rotate-180" />}>
          Ana sayfaya git
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={eylem} className="space-y-5">
      <input type="hidden" name="kod" value={kod} />
      {durum.sonuc === "GECERSIZ" ? (
        <Alert variant="error">Bu bağlantı geçersiz ya da kapatılmış. Koçundan yeni bağlantı iste.</Alert>
      ) : durum.sonuc === "SINIR" ? (
        <Alert variant="error">Çok fazla deneme yapıldı. Bir saat sonra tekrar dene.</Alert>
      ) : durum.sonuc === "OTURUM" ? (
        <Alert variant="error">Oturumun kapanmış. Sayfayı yenileyip yeniden giriş yap.</Alert>
      ) : null}
      <Button type="submit" size="md" block loading={bekliyor} startIcon={<UserPlus />}>
        {bekliyor ? "Katılıyorsun…" : "Gruba katıl"}
      </Button>
    </form>
  );
}
