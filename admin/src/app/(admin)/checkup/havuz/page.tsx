import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ANY_STAFF, checkStaff } from "@/lib/checkup/staff";
import { BLUEPRINT_KINDS, PACKAGE_STATE_LABEL, loadPackageHealth, loadTopicPool } from "@/lib/checkup/pool";
import { QUESTION_STATUS_LABEL, examLabel, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { Card, CardHeader, PACKAGE_STATE_TONE, PageHeader, Pill, qs } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Havuz durumu" };

/**
 * Havuz panosu. Tek bir soruya cevap verir: hangi paket gerçekten
 * başlatılabiliyor? Toplam soru sayısı yanıltıcı olduğu için kırılım
 * paket × konu (bkz. lib/checkup/pool.ts).
 */
export default async function PoolPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;

  const [topicRows, health] = await Promise.all([loadTopicPool(), loadPackageHealth()]);
  // Konu tekrar testi ve seviyeli paketin konu dağılımı yok; onların hazırlığı Paketler'de.
  const packages = health.filter((p) => BLUEPRINT_KINDS.includes(p.kind));

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

      <section aria-labelledby="havuz-paketler">
        <h2 id="havuz-paketler" className="font-display text-h2 font-semibold text-ink">
          Katalog paketleri
        </h2>
        <p className="mt-0.5 max-w-3xl text-caption text-ink-faint">
          Bir paket, istediği her konuda paketin sınavında sorulabilen yeterli yayında soru yoksa
          başlatılamaz. Tekrar engeli yüzünden ihtiyacın 2 katı sağlıklı sayılır — öğrenci aynı paketi
          ikinci kez çözebilsin. Seviyeli check-up ve konu tekrar testlerinin hazırlığı{" "}
          <Link href="/checkup/paketler" className="font-medium text-brand hover:text-brand-hover">
            Paketler
          </Link>{" "}
          sayfasında.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {packages.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold text-ink">{p.name}</p>
                  <p className="mt-0.5 text-micro text-ink-faint">
                    {examLabel(p.examScope)} · {p.questionCount} soru · {p.topicCount} konu ·{" "}
                    {QUESTION_STATUS_LABEL[p.status]}
                  </p>
                </div>
                <Pill tone={PACKAGE_STATE_TONE[p.state]}>{PACKAGE_STATE_LABEL[p.state]}</Pill>
              </div>

              {p.gaps.length > 0 ? (
                <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-caption">
                  {p.gaps.map((g) => (
                    <li key={g.name} className="flex justify-between gap-3">
                      <span className="truncate text-ink-soft">{g.name}</span>
                      <span
                        className={clsx(
                          "shrink-0 tabular font-medium",
                          g.have < g.need ? "text-bad" : "text-warn"
                        )}
                        title={"Yayında " + g.have + ", sağlıklı havuz için " + g.need * 2}
                      >
                        {g.have}/{g.need * 2}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 border-t border-line pt-3 text-caption text-ok">
                  {p.topicCount === 0 ? "Pakette konu tanımlı değil." : "Her konuda yeterli soru var."}
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
        <div className="scroll-x">
          <table className="data-table min-w-[44rem]">
            <thead>
              <tr>
                <th scope="col">Konu</th>
                <th scope="col" className="text-end">
                  Yayında
                </th>
                <th scope="col" className="text-end">
                  Kolay
                </th>
                <th scope="col" className="text-end">
                  Orta
                </th>
                <th scope="col" className="text-end">
                  Zor
                </th>
                <th scope="col" className="text-end">
                  Taslak
                </th>
                <th scope="col">
                  <span className="sr-only">Durum ve bağlantı</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {topicRows.map((r) => {
                const eksikBant = r.published > 0 && (r.easy === 0 || r.medium === 0 || r.hard === 0);
                return (
                  <tr key={r.topicId}>
                    <td>
                      <span className="me-2 rounded bg-surface-sunk px-1.5 py-0.5 text-micro font-semibold text-ink-faint">
                        {examLabel(r.examScope)}
                      </span>
                      <span className="font-medium text-ink">{r.name}</span>
                    </td>
                    <td
                      className={clsx(
                        "text-end tabular font-medium",
                        r.published === 0 ? "text-bad" : "text-ink"
                      )}
                    >
                      {r.published}
                    </td>
                    <NumCell value={r.easy} />
                    <NumCell value={r.medium} />
                    <NumCell value={r.hard} />
                    <td className="text-end tabular text-ink-faint">{r.draft || ""}</td>
                    <td className="whitespace-nowrap text-end">
                      {eksikBant ? <Pill tone="warn">zorluk dengesiz</Pill> : null}
                      <Link
                        href={qs("/checkup/sorular", { konu: r.slug })}
                        className="ms-3 text-caption font-medium text-brand hover:text-brand-hover"
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
  return <td className={clsx("text-end tabular", value === 0 ? "text-bad" : "text-ink-soft")}>{value}</td>;
}
