import type { Metadata } from "next";
import Link from "next/link";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { loadRiskliOgrenciler } from "@/lib/checkup/risk-data";
import { RISK_ESIK, RISK_META, RISK_SIRASI, type RiskKey } from "@/lib/checkup/risk";
import { examLabel, gradeLabel, percent, relativeDay, trDate, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { Card, EmptyState, FilterTabs, PageHeader, Pill, qs, type Tone } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Riskli öğrenciler" };

const BASE = "/checkup/ogrenciler/riskli";
const TON: Record<string, Tone> = { bad: "bad", warn: "warn", info: "info" };

/**
 * Koçun "bu hafta kimi aramalıyım" listesi. Kurallar ve eşikler tek dosyada:
 * lib/checkup/risk.ts. Öğrenci kişisel verisi: yalnızca yönetici ve müdür.
 */
export default async function RiskliOgrencilerPage({ searchParams }: PageProps<"/checkup/ogrenciler/riskli">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const sp = await searchParams;
  const tur = typeof sp.tur === "string" && (RISK_SIRASI as string[]).includes(sp.tur) ? (sp.tur as RiskKey) : null;

  const now = new Date();
  const { liste, toplam } = await loadRiskliOgrenciler(now);
  const gorunen = tur ? liste.filter((o) => o.bulgular.some((b) => b.key === tur)) : liste;

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/ogrenciler", label: "Öğrenciler" },
        ]}
        title="Riskli öğrenciler"
        description={
          (liste.length
            ? trNumber(liste.length) + " öğrenci dikkat istiyor (" + trNumber(toplam) + " kayıtlı öğrenciden). "
            : "") + "Kişisel veri: yalnızca yönetici ve müdür görür."
        }
      />

      <Card>
        <div className="border-b border-line px-4 py-2 sm:px-5">
          <FilterTabs
            label="Bulgu süzgeci"
            items={[
              { href: BASE, label: "Tümü", active: !tur, count: liste.length },
              ...RISK_SIRASI.map((k) => ({
                href: qs(BASE, { tur: k }),
                label: RISK_META[k].baslik,
                active: tur === k,
                count: liste.filter((o) => o.bulgular.some((b) => b.key === k)).length,
                tone: TON[RISK_META[k].ton],
              })),
            ]}
          />
        </div>

        {gorunen.length === 0 ? (
          <EmptyState
            title={liste.length === 0 ? "Şu an riskli öğrenci yok" : "Bu bulguda öğrenci yok"}
            description={
              liste.length === 0
                ? "Herkes son " + RISK_ESIK.pasifGun + " günde etkin, planını büyük ölçüde yapıyor ve son testinde düşmemiş."
                : undefined
            }
          />
        ) : (
          <div className="scroll-x">
            <table className="data-table min-w-[56rem]">
              <caption className="sr-only">Riskli öğrenciler, en ciddi bulgusu olan en üstte</caption>
              <thead>
                <tr>
                  <th scope="col">Öğrenci</th>
                  <th scope="col">Sınıf · hedef</th>
                  <th scope="col">Son etkinlik</th>
                  <th scope="col" className="text-end" title="Son iki paket testinin başarı oranı">
                    Son iki test
                  </th>
                  <th scope="col" className="text-end" title="Geçen haftanın planında tamamlanan iş">
                    Geçen hafta planı
                  </th>
                  <th scope="col">Bulgular</th>
                </tr>
              </thead>
              <tbody>
                {gorunen.map((o) => {
                  const [son, onceki] = o.sonIkiPaket;
                  const sinif = [gradeLabel(o.grade), o.targetExam ? examLabel(o.targetExam) : null].filter(Boolean);
                  return (
                    <tr key={o.id}>
                      <td className="min-w-56">
                        <Link href={"/checkup/ogrenciler/" + o.id} className="group flex items-center gap-3">
                          <span
                            aria-hidden
                            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-wash text-micro font-semibold text-brand"
                          >
                            {o.name.trim().charAt(0).toLocaleUpperCase("tr-TR")}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink group-hover:text-brand">{o.name}</span>
                            <span className="block truncate text-micro text-ink-faint">{o.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{sinif.length ? sinif.join(" · ") : "—"}</td>
                      <td className="whitespace-nowrap" title={trDate(o.sonEtkinlik, { time: true })}>
                        {relativeDay(o.sonEtkinlik, now)}
                        <span className="block text-micro text-ink-faint">{o.testSayisi} test</span>
                      </td>
                      <td className="whitespace-nowrap text-end tabular">
                        {son === null ? (
                          <span className="text-ink-faint">—</span>
                        ) : onceki === null ? (
                          percent(son)
                        ) : (
                          <>
                            {percent(onceki)} → <span className="font-semibold text-ink">{percent(son)}</span>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-end tabular">
                        {o.gecenHaftaPlan ? (
                          o.gecenHaftaPlan.biten + "/" + o.gecenHaftaPlan.toplam
                        ) : (
                          <span className="text-ink-faint">plan yok</span>
                        )}
                      </td>
                      <td className="min-w-64">
                        <ul className="flex flex-wrap gap-1">
                          {o.bulgular.map((b) => (
                            <li key={b.key}>
                              <Pill tone={TON[b.ton]}>
                                {b.baslik}
                                <span className="font-normal opacity-80">· {b.ayrinti}</span>
                              </Pill>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <details className="mt-6 rounded-2xl border border-line bg-surface p-5 text-caption text-ink-soft shadow-card sm:px-6">
        <summary className="cursor-pointer select-none font-display text-body font-semibold text-ink">
          Kurallar ve önerilen adım
        </summary>
        <ul className="mt-3 space-y-2.5">
          {RISK_SIRASI.map((k) => (
            <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Pill tone={TON[RISK_META[k].ton]}>{RISK_META[k].baslik}</Pill>
              <span>{RISK_META[k].aciklama}</span>
              <span className="text-ink-faint">— {RISK_META[k].eylem}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3 text-micro text-ink-faint">
          Eşikler araç içindir ve tek dosyada durur (lib/checkup/risk.ts). Son etkinlik: son giriş, son test ve
          kayıt tarihinin en yenisi. Hafta, öğrenci uygulamasındaki gibi pazartesi başlar (Türkiye saati).
        </p>
      </details>
    </>
  );
}
