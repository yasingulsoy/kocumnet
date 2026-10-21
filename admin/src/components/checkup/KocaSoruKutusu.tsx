import { MessageCircleQuestion } from "lucide-react";
import { relativeDay, trNumber } from "@/lib/checkup/format";
import { bekleyenOzeti } from "@/lib/checkup/koca-sorular";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { ButtonLink } from "@/components/tailadmin/ui/Button";

/**
 * Genel bakıştaki küçük kutu: cevap bekleyen öğrenci sorusu. Kendi sorgusunu
 * yapan sunucu bileşeni; genel bakış sayfası yalnızca soruyu cevaplayabilen
 * rollere (CONTENT) çizer. Bekleyen yoksa hiçbir şey çizmez.
 */
export async function KocaSoruKutusu() {
  const { sayi, enEski } = await bekleyenOzeti();
  if (sayi === 0) return null;
  return (
    <Alert
      variant="info"
      className="mb-6"
      title={`${trNumber(sayi)} öğrenci sorusu cevap bekliyor`}
      action={
        <ButtonLink href="/checkup/koca-sorular" variant="outline" size="xs" startIcon={<MessageCircleQuestion />}>
          Gelen kutusuna git
        </ButtonLink>
      }
    >
      {enEski ? "En eskisi " + relativeDay(enEski, new Date()) + " soruldu." : null}
    </Alert>
  );
}
