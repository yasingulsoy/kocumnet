import { ArrowRight } from "lucide-react";
import type { CheckupOzeti } from "@/lib/tipler";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { ButtonLink } from "@/components/tailadmin/ui/Button";

/**
 * Bitmemiş check-up uyarısı. Aynı anda tek açık check-up olabilir (API.md
 * ACIK_CHECKUP_VAR); yenisini başlatmadan önce öğrenci bunu bilsin.
 */
export function AcikCheckupUyarisi({ checkup, className }: { checkup: Pick<CheckupOzeti, "id" | "sinav" | "tur">; className?: string }) {
  return (
    <Alert
      variant="warning"
      title="Yarım kalan bir check-up'ın var"
      className={className}
      action={
        <ButtonLink href={`/test/${checkup.id}`} size="sm" endIcon={<ArrowRight className="rtl:rotate-180" />}>
          Devam et
        </ButtonLink>
      }
    >
      {checkup.sinav.ad} · {checkup.tur.ad}. Yenisini başlatmadan önce onu bitirmen gerekiyor. Testin içinden
      &quot;Testi bitir&quot; diyebilirsin.
    </Alert>
  );
}
