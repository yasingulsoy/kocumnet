import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ANY_STAFF, checkStaff } from "@/lib/checkup/staff";
import { PACKAGE_STATE_LABEL, loadPackageHealth, loadTopicPool } from "@/lib/checkup/pool";
import { QUESTION_STATUS_LABEL, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { Card, CardHeader, PageHeader, Pill, type Tone } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Havuz durumu" };

const STATE_TONE: Record<string, Tone> = { ready: "ok", narrow: "warn", blocked: "bad" };

/**
 * Havuz panosu. Tek bir soruya cevap verir: hangi paket gerçekten
 * başlatılabiliyor? Toplam soru sayısı yanıltıcı olduğu için kırılım
 * paket × konu (bkz. lib/checkup/pool.ts).
 */
export default async function PoolPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;

  const topicRows = await loadTopicPool();
  const packages = await loadPackageHealth(topicRows);

  const toplamYayinda = topicRows.reduce((s, r) => s + r.published, 0);
  const toplamTaslak = topicRows.reduce((s, r) => s + r.draft, 0);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        title="Havuz durumu"
        description={
          trNumber(toplamYayinda) + " soru yayında, " + trNumber(toplamTaslak) + " taslak / incelemede."
        }
      />

      <section>
        <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Paketler</h2>
        <p className="mt-0.5 text-theme-sm text-gray-500 dark:text-gray-400">
          Bir paket, istediği her konuda yeterli yayında soru yoksa başlatılamaz. Tekrar engeli
          yüzünden ihtiyacın 2 katı sağlıklı sayılır — öğrenci aynı paketi ikinci kez çözebilsin.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {packages.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{p.name}</p>
                  <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                    {p.examScope} · {p.questionCount} soru · {p.topicCount} konu ·{" "}
                    {QUESTION_STATUS_LABEL[p.status]}
                  </p>
                </div>
                <Pill tone={STATE_TONE[p.state]}>{PACKAGE_STATE_LABEL[p.state]}</Pill>
              </div>

              {p.gaps.length > 0 ? (
                <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-theme-sm dark:border-gray-800">
                  {p.gaps.map((g) => (
                    <li key={g.name} className="flex justify-between gap-3">
                      <span className="truncate text-gray-600 dark:text-gray-400">{g.name}</span>
                      <span
                        className={clsx(
                          "shrink-0 tabular-nums font-medium",
                          g.have < g.need ? "text-error-600 dark:text-error-500" : "text-warning-600 dark:text-orange-400"
                        )}
                        title={"Yayında " + g.have + ", sağlıklı havuz için " + g.need * 2}
                      >
                        {g.have}/{g.need * 2}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 border-t border-gray-100 pt-3 text-theme-sm text-success-600 dark:border-gray-800 dark:text-success-500">
                  Her konuda yeterli soru var.
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>

      <Card className="mt-8">
        <CardHeader
          title="Konular"
          description="Seçim algoritması kolay %30 · orta %50 · zor %20 dağılımı arar; her bantta yayında soru olmalı."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                <th className="px-5 py-3 font-medium sm:px-6">Konu</th>
                <th className="px-3 py-3 text-end font-medium">Yayında</th>
                <th className="px-3 py-3 text-end font-medium">Kolay</th>
                <th className="px-3 py-3 text-end font-medium">Orta</th>
                <th className="px-3 py-3 text-end font-medium">Zor</th>
                <th className="px-3 py-3 text-end font-medium">Taslak</th>
                <th className="px-5 py-3 sm:px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {topicRows.map((r) => {
                const eksikBant = r.published > 0 && (r.easy === 0 || r.medium === 0 || r.hard === 0);
                return (
                  <tr key={r.topicId} className="hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-3 sm:px-6">
                      <span className="me-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-white/5 dark:text-gray-400">
                        {r.examScope}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-white/90">{r.name}</span>
                    </td>
                    <td
                      className={clsx(
                        "px-3 py-3 text-end tabular-nums font-medium",
                        r.published === 0 ? "text-error-600 dark:text-error-500" : "text-gray-800 dark:text-white/90"
                      )}
                    >
                      {r.published}
                    </td>
                    <NumCell value={r.easy} />
                    <NumCell value={r.medium} />
                    <NumCell value={r.hard} />
                    <td className="px-3 py-3 text-end tabular-nums text-gray-400">{r.draft || ""}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-end sm:px-6">
                      {eksikBant ? <Pill tone="warn">zorluk dengesiz</Pill> : null}
                      <Link
                        href={"/checkup/sorular?konu=" + encodeURIComponent(r.slug)}
                        className="ms-3 text-theme-sm font-medium text-brand-500 hover:text-brand-600"
                      >
                        Sorular
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function NumCell({ value }: { value: number }) {
  return (
    <td
      className={clsx(
        "px-3 py-3 text-end tabular-nums",
        value === 0 ? "text-error-600 dark:text-error-500" : "text-gray-600 dark:text-gray-400"
      )}
    >
      {value}
    </td>
  );
}
