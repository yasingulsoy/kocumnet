import Link from "next/link";
import { RISK_META, type RiskBulgusu } from "@/lib/checkup/risk";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { BULGU_COLOR } from "./ui";

/*
 * Öğrenci ayrıntısındaki risk kutusu: Riskli öğrenciler listesiyle AYNI
 * bulgular (lib/checkup/risk.ts riskBulgulari; veri risk-data.ts
 * riskSatirlari, tek öğrenci kapsamı). Her bulgunun yanında önerilen adım.
 * Sunucu bileşeni, hook yok.
 */
export function RiskKutusu({ bulgular }: { bulgular: RiskBulgusu[] }) {
  return (
    <ComponentCard
      title="Dikkat"
      desc={
        <>
          Riskli öğrenciler listesindeki kurallarla.{" "}
          <Link href="/checkup/ogrenciler/riskli" className="font-medium text-brand-500 hover:text-brand-600">
            Listeye git
          </Link>
        </>
      }
      tone={bulgular.some((b) => b.ton === "bad") ? "danger" : "default"}
    >
      {bulgular.length === 0 ? (
        <p className="text-theme-sm text-gray-500">Şu an bir risk bulgusu yok.</p>
      ) : (
        <ul className="space-y-3">
          {bulgular.map((b) => (
            <li key={b.key} className="text-theme-sm">
              <Badge size="sm" color={BULGU_COLOR[b.ton]}>
                {b.baslik}
                <span className="font-normal opacity-80">· {b.ayrinti}</span>
              </Badge>
              <p className="mt-1 text-gray-600">{RISK_META[b.key].eylem}</p>
            </li>
          ))}
        </ul>
      )}
    </ComponentCard>
  );
}
