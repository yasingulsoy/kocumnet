import type { Metadata } from "next";
import Link from "next/link";
import { ANY_STAFF, checkStaff } from "@/lib/checkup/staff";
import {
  BLUEPRINT_KINDS,
  HAVUZ_TUKENME_GUN,
  PACKAGE_STATE_LABEL,
  loadHavuzTukenmesi,
  loadPackageHealth,
  loadTopicPool,
} from "@/lib/checkup/pool";
import { TEKRAR_PENCERESI_GUN, onceYazilacaklar } from "@/lib/checkup/pilot-kurallari";
import { HAVUZ_TUKENME_TANIMI } from "@/lib/checkup/pilot-tanimlar";
import { QUESTION_STATUS_LABEL, examLabel, percent, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { PACKAGE_STATE_COLOR, qs } from "@/components/checkup/ui";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Havuz durumu" };

/**
 * Havuz panosu. Tek bir soruya cevap verir: hangi paket gerçekten
 * başlatılabiliyor? Toplam soru sayısı yanıltıcı olduğu için kırılım
 * paket × konu (bkz. lib/checkup/pool.ts).
 */
export default async function PoolPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;

  const [topicRows, health, tukenme] = await Promise.all([
    loadTopicPool(),
    loadPackageHealth(),
    loadHavuzTukenmesi(new Date(), TEKRAR_PENCERESI_GUN),
  ]);
  // Konu tekrar testi ve seviyeli paketin konu dağılımı yok; onların hazırlığı Paketler'de.
  const packages = health.filter((p) => BLUEPRINT_KINDS.includes(p.kind));

  // Havuzun tükenmesi: konu başına tekrar soru oranı ve "önce yazılacaklar" (kural pilot-kurallari.ts).
  const konular = topicRows.map((r) => ({ ...r, yayinda: r.published, ...(tukenme.get(r.topicId) ?? { oturum: 0, tekrarli: 0 }) }));
  const oncelikli = onceYazilacaklar(konular);

  const toplamYayinda = topicRows.reduce((s, r) => s + r.published, 0);
  const toplamTaslak = topicRows.reduce((s, r) => s + r.draft, 0);

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Havuz durumu"
        description={trNumber(toplamYayinda) + " soru yayında, " + trNumber(toplamTaslak) + " taslak / incelemede."}
      />

      <section aria-labelledby="havuz-paketler">
        <h2 id="havuz-paketler" className="font-display text-lg font-semibold text-gray-800">
          Katalog paketleri
        </h2>
        <p className="mt-1 max-w-3xl text-theme-sm text-gray-500">
          Bir paket, istediği her konuda paketin sınavında sorulabilen yeterli yayında soru yoksa
          başlatılamaz. Tekrar engeli yüzünden ihtiyacın 2 katı sağlıklı sayılır — öğrenci aynı paketi
          ikinci kez çözebilsin. Seviyeli check-up ve konu tekrar testlerinin hazırlığı{" "}
          <Link href="/checkup/paketler" className="font-medium text-brand-500 hover:text-brand-600">
            Paketler
          </Link>{" "}
          sayfasında.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6 2xl:grid-cols-3">
          {packages.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">{p.name}</p>
                  <p className="mt-0.5 text-theme-xs text-gray-500">
                    {examLabel(p.examScope)} · {p.questionCount} soru · {p.topicCount} konu · {QUESTION_STATUS_LABEL[p.status]}
                  </p>
                </div>
                <Badge size="sm" color={PACKAGE_STATE_COLOR[p.state]}>
                  {PACKAGE_STATE_LABEL[p.state]}
                </Badge>
              </div>

              {p.gaps.length > 0 ? (
                <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-theme-sm">
                  {p.gaps.map((g) => (
                    <li key={g.name} className="flex justify-between gap-3">
                      <span className="truncate text-gray-600">{g.name}</span>
                      <span
                        className={cx("tabular shrink-0 font-medium", g.have < g.need ? "text-error-600" : "text-warning-700")}
                        title={"Yayında " + g.have + ", sağlıklı havuz için " + g.need * 2}
                      >
                        {g.have}/{g.need * 2}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={cx("mt-4 border-t border-gray-100 pt-3 text-theme-sm", p.topicCount === 0 ? "text-error-600" : "text-success-700")}>
                  {p.topicCount === 0 ? "Pakette konu tanımlı değil." : "Her konuda yeterli soru var."}
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>

      <ComponentCard
        className="mt-8"
        title="Önce yazılacak konular"
        desc={HAVUZ_TUKENME_TANIMI}
        flush
      >
        {oncelikli.length === 0 ? (
          <p className="px-5 py-4 text-theme-sm text-gray-500 sm:px-6">
            Son {HAVUZ_TUKENME_GUN} günde hiçbir konuda öğrenciye tekrar soru gösterilmek zorunda kalınmadı.
          </p>
        ) : (
          <ol className="divide-y divide-gray-100">
            {oncelikli.map((r, i) => (
              <li key={r.topicId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 sm:px-6">
                <span className="tabular w-5 text-theme-sm font-semibold text-gray-400">{i + 1}.</span>
                <span className="min-w-0 flex-1">
                  <Badge size="sm" color="light" className="me-2">
                    {examLabel(r.examScope)}
                  </Badge>
                  <span className="font-medium text-gray-800">{r.name}</span>
                </span>
                <span className="tabular text-theme-sm text-error-600" title={r.tekrarli + " / " + r.oturum + " oturum"}>
                  {percent(r.tekrarli / r.oturum)} tekrar soru
                </span>
                <span className="tabular text-theme-sm text-gray-500">{r.published} yayında</span>
                <Link
                  href={qs("/checkup/sorular", { konu: r.slug })}
                  className="text-theme-sm font-medium text-brand-500 hover:text-brand-600"
                >
                  Sorular
                </Link>
              </li>
            ))}
          </ol>
        )}
      </ComponentCard>

      <ComponentCard
        className="mt-8"
        title="Konular"
        desc="Seçim algoritması kolay %30 · orta %50 · zor %20 dağılımı arar; her bantta yayında soru olmalı."
        flush
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell isHeader>Konu</TableCell>
              <TableCell isHeader align="end">
                Yayında
              </TableCell>
              <TableCell isHeader align="end">
                Kolay
              </TableCell>
              <TableCell isHeader align="end">
                Orta
              </TableCell>
              <TableCell isHeader align="end">
                Zor
              </TableCell>
              <TableCell isHeader align="end">
                Taslak
              </TableCell>
              <TableCell isHeader align="end" nowrap>
                <span title={HAVUZ_TUKENME_TANIMI}>Tekrar soru · {HAVUZ_TUKENME_GUN} gün</span>
              </TableCell>
              <TableCell isHeader align="end">
                <span className="sr-only">Durum ve bağlantı</span>
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {konular.map((r) => {
              const eksikBant = r.published > 0 && (r.easy === 0 || r.medium === 0 || r.hard === 0);
              return (
                <TableRow key={r.topicId} hover>
                  <TableCell>
                    <Badge size="sm" color="light" className="me-2">
                      {examLabel(r.examScope)}
                    </Badge>
                    <span className="font-medium text-gray-800">{r.name}</span>
                  </TableCell>
                  <TableCell align="end">
                    <span className={cx("tabular font-medium", r.published === 0 ? "text-error-600" : "text-gray-800")}>{r.published}</span>
                  </TableCell>
                  <NumCell value={r.easy} />
                  <NumCell value={r.medium} />
                  <NumCell value={r.hard} />
                  <TableCell align="end" className="tabular">
                    {r.draft || ""}
                  </TableCell>
                  <TableCell align="end" nowrap className="tabular">
                    {r.oturum === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span
                        className={cx(r.tekrarli > 0 ? "text-error-600" : "text-gray-500")}
                        title={r.tekrarli + " / " + r.oturum + " oturum"}
                      >
                        {percent(r.tekrarli / r.oturum)}
                        <span className="ms-1 text-theme-xs text-gray-400">({r.oturum})</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell align="end" nowrap>
                    {eksikBant ? (
                      <Badge size="sm" color="warning">
                        zorluk dengesiz
                      </Badge>
                    ) : null}
                    <Link
                      href={qs("/checkup/sorular", { konu: r.slug })}
                      className="ms-3 text-theme-sm font-medium text-brand-500 hover:text-brand-600"
                    >
                      Sorular
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ComponentCard>
    </>
  );
}

function NumCell({ value }: { value: number }) {
  return (
    <TableCell align="end">
      <span className={cx("tabular", value === 0 && "text-error-600")}>{value}</span>
    </TableCell>
  );
}
