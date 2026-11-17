import { RotateCcw } from "lucide-react";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { PanelCercevesi } from "@/components/PanelCercevesi";
import { oturumuSonlandir } from "@/lib/backend";
import { oturumDurumu } from "@/lib/oturum";

/**
 * Panel düzeni: oturumu sunucuda doğrular (GET /api/admin/ben, istek başına
 * bir kez) ve yöneticiyi çerçeveye verir. Sayfalar da kendi denetimini
 * yapar (yoneticiGerekli): istemci içi gezinmede düzen yeniden çizilmez.
 */
export default async function PanelDuzeni({ children }: LayoutProps<"/">) {
  const d = await oturumDurumu();
  if (d.tur === "yok") await oturumuSonlandir();
  if (d.tur === "ulasilamadi") {
    return (
      <main id="icerik" className="mx-auto max-w-xl px-4 py-16">
        <Alert
          variant="warning"
          title="Sunucuya ulaşılamıyor"
          action={
            <ButtonLink href="/" size="xs" variant="outline" startIcon={<RotateCcw />}>
              Yeniden dene
            </ButtonLink>
          }
        >
          Oturum doğrulanamadığı için hiçbir veri gösterilmiyor. Birkaç dakika sonra sayfayı yenileyin; sorun sürerse teknik
          ekibe haber verin. ({d.mesaj})
        </Alert>
      </main>
    );
  }
  if (d.tur !== "var") return null;

  return <PanelCercevesi yonetici={d.yonetici}>{children}</PanelCercevesi>;
}
