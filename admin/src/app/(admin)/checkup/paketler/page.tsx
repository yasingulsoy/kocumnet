import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import {
  BLUEPRINT_KINDS,
  PACKAGE_STATE_LABEL,
  bandTargets,
  loadPackageHealth,
  type PackageHealth,
} from "@/lib/checkup/pool";
import { EXAM_SCOPES, QUESTION_STATUS_LABEL, examLabel, isExamScope, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { PackageFreeToggle, PackageStatusSelect } from "@/components/checkup/PackageControls";
import { PACKAGE_STATE_COLOR, ProgressLine, QUESTION_STATUS_COLOR, qs } from "@/components/checkup/ui";
import { cx } from "@/components/tailadmin/cx";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Paketler" };

/**
 * Paketler, türüne göre üç bölümde: katalog (öğrencinin gördüğü), seviyeli
 * check-up ve gizli konu tekrar testleri. Üçünün "hazır" ölçüsü farklı —
 * tek tabloda aynı rozetle gösterilince tekrar testleri "0 konu · Hazır"
 * görünüyordu (bkz. lib/checkup/pool.ts).
 */
export default async function PackagesPage({ searchParams }: PageProps<"/checkup/paketler">) {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yonetebilir = MANAGE_ROLES.includes(gate.staff.role);

  const sp = await searchParams;
  const sinav = isExamScope(sp.sinav) ? sp.sinav : "";

  const [tumPaketler, testSayilari] = await Promise.all([
    loadPackageHealth(),
    db.checkupSession.groupBy({
      by: ["packageId"],
      where: { status: "SUBMITTED" },
      _count: { _all: true },
    }),
  ]);
  const testMap = new Map(testSayilari.map((t) => [t.packageId, t._count._all]));

  // Gizli alıştırma paketleri (PRACTICE, sınav başına bir tane) bu sayfanın hiçbir
  // bölümünde yok ve panelden yönetilmiyor; toplam sayıya da girmesinler.
  const health = tumPaketler.filter((p) => (p.kind as string) !== "PRACTICE");

  const katalogTumu = health.filter((p) => BLUEPRINT_KINDS.includes(p.kind));
  const katalog = katalogTumu.filter((p) => !sinav || p.examScope === sinav);
  const seviyeli = health.filter((p) => p.kind === "LEVEL");
  const tekrar = health.filter((p) => p.kind === "RETEST");

  const ucretliSayisi = health.filter((p) => !p.isFree).length;
  const yayindaSorunlu = katalogTumu.filter((p) => p.status === "PUBLISHED" && p.state === "blocked").length;

  const yayinHucresi = (p: PackageHealth) =>
    yonetebilir ? (
      <PackageStatusSelect id={p.id} status={p.status} name={p.name} kind={p.kind} />
    ) : (
      <Badge size="sm" color={QUESTION_STATUS_COLOR[p.status]}>
        {QUESTION_STATUS_LABEL[p.status]}
      </Badge>
    );
  const erisimHucresi = (p: PackageHealth) =>
    yonetebilir ? (
      <PackageFreeToggle id={p.id} isFree={p.isFree} name={p.name} />
    ) : (
      <Badge size="sm" color={p.isFree ? "light" : "primary"}>
        {p.isFree ? "Ücretsiz" : "Ücretli"}
      </Badge>
    );

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Paketler"
        description={
          health.length +
          " paket · " +
          (ucretliSayisi ? ucretliSayisi + " ücretli" : "hepsi ücretsiz") +
          ". Katalog paketleri panelden düzenlenir; tanışma, seviyeli ve tekrar paketleri sistemindir."
        }
        actions={
          yonetebilir ? (
            <ButtonLink href="/checkup/paketler/yeni" size="xs" startIcon={<Plus />}>
              Yeni paket
            </ButtonLink>
          ) : null
        }
      />

      {!yonetebilir ? (
        <Alert variant="info" compact className="mb-4">
          Yayın durumu ve ücret ayarını yalnızca yönetici ve müdür değiştirebilir.
        </Alert>
      ) : null}
      {yayindaSorunlu > 0 ? (
        <Alert variant="error" className="mb-4" title={`Yayındaki ${yayindaSorunlu} paket başlatılamıyor`}>
          Öğrenci bu paketleri katalogda görüyor ama &quot;Başla&quot;ya bastığında hata alır. Eksik
          konulara soru ekleyin ya da paketi taslağa çekin.
        </Alert>
      ) : null}

      <div className="space-y-4 md:space-y-6">
        {/* ── Katalog ─────────────────────────────────────── */}
        <ComponentCard
          title="Katalog paketleri"
          desc="Öğrencinin katalogda gördüğü testler. Sayılar paketin sınavında sorulabilen yayındaki sorular — başka sınava kısıtlanmış sorular sayılmaz."
          flush
        >
          <div className="border-b border-gray-100 px-4 py-3 sm:px-6">
            <SegmentedTabs
              label="Sınav süzgeci"
              items={[
                { key: "hepsi", href: "/checkup/paketler", label: "Tüm sınavlar", active: !sinav, count: katalogTumu.length },
                ...EXAM_SCOPES.filter((s) => katalogTumu.some((p) => p.examScope === s)).map((s) => ({
                  key: s,
                  href: qs("/checkup/paketler", { sinav: s }),
                  label: examLabel(s),
                  active: s === sinav,
                  count: katalogTumu.filter((p) => p.examScope === s).length,
                })),
              ]}
            />
          </div>
          {katalog.length === 0 ? (
            <EmptyState icon={<Package />} title="Bu sınavda katalog paketi yok" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Paket</TableCell>
                  <TableCell isHeader>Kapsam</TableCell>
                  <TableCell isHeader>Havuz</TableCell>
                  <TableCell isHeader align="end">
                    Tamamlanan
                  </TableCell>
                  <TableCell isHeader>Yayın</TableCell>
                  <TableCell isHeader>Erişim</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {katalog.map((p) => (
                  <TableRow key={p.id} className="align-top">
                    <TableCell className="min-w-48">
                      {yonetebilir && p.kind === "STANDARD" ? (
                        <Link href={"/checkup/paketler/" + p.id} className="font-medium text-gray-800 hover:text-brand-500">
                          {p.name}
                        </Link>
                      ) : (
                        <p className="font-medium text-gray-800">{p.name}</p>
                      )}
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-theme-xs text-gray-500">
                        {p.kind === "INTRO" ? (
                          <Badge size="sm" color="info">
                            Tanışma
                          </Badge>
                        ) : null}
                        {p.slug}
                        {yonetebilir && p.kind === "STANDARD" ? (
                          <Link
                            href={"/checkup/paketler/" + p.id}
                            className="font-medium text-brand-500 hover:text-brand-600"
                            aria-label={p.name + " paketini düzenle"}
                          >
                            Düzenle
                          </Link>
                        ) : null}
                      </p>
                    </TableCell>
                    <TableCell className="min-w-36">
                      {examLabel(p.examScope)} · {p.questionCount} soru · {p.durationMinutes} dk
                    </TableCell>
                    <TableCell className="min-w-60">
                      <Badge size="sm" color={PACKAGE_STATE_COLOR[p.state]}>
                        {PACKAGE_STATE_LABEL[p.state]}
                      </Badge>
                      {p.state !== "ready" ? (
                        <p className={cx("mt-1 max-w-80 text-theme-xs", p.state === "blocked" ? "text-error-600" : "text-warning-700")}>
                          {p.summary}
                        </p>
                      ) : null}
                      <Dagilim paket={p} />
                    </TableCell>
                    <TableCell align="end">
                      <span className="tabular text-gray-800">{trNumber(testMap.get(p.id) ?? 0)}</span>
                    </TableCell>
                    <TableCell>{yayinHucresi(p)}</TableCell>
                    <TableCell>{erisimHucresi(p)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ComponentCard>

        {/* ── Seviyeli ────────────────────────────────────── */}
        {seviyeli.length > 0 ? (
          <ComponentCard
            title="Seviyeli check-up"
            desc={
              <>
                Konu dağılımı yok: seviye 1 her kazanımdan bir soru, seviye 2-3 seviyeli sorulardan seçer. Kazanım
                hazırlığı:{" "}
                <Link href="/checkup/kazanimlar" className="font-medium text-brand-500 hover:text-brand-600">
                  Kazanımlar
                </Link>
                .
              </>
            }
            flush
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Paket</TableCell>
                  <TableCell isHeader>Hazırlık</TableCell>
                  <TableCell isHeader align="end" title="Tamamlanan aşama (seviye testi) sayısı">
                    Aşama
                  </TableCell>
                  <TableCell isHeader>Yayın</TableCell>
                  <TableCell isHeader>Erişim</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seviyeli.map((p) => (
                  <TableRow key={p.id} className="align-top">
                    <TableCell className="min-w-52">
                      <p className="font-medium text-gray-800">{p.name}</p>
                      <p className="mt-0.5 text-theme-xs">
                        <Link href={qs("/checkup/kazanimlar", { sinav: p.examScope })} className="hover:text-brand-500">
                          {examLabel(p.examScope)} kazanımları
                        </Link>
                      </p>
                    </TableCell>
                    <TableCell className="min-w-80">
                      {p.level ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <ProgressLine label="S1 kazanım" value={p.level.l1Ready} target={p.level.l1Need} />
                          <ProgressLine label="S2 soru" value={p.level.l2} target={p.level.l2Need} />
                          <ProgressLine label="S3 soru" value={p.level.l3} target={p.level.l3Need} />
                        </div>
                      ) : null}
                      {p.state === "blocked" ? (
                        <p className="mt-1.5 text-theme-xs text-error-600">
                          Bir seviyede hiç soru yok: öğrenci o kapıda &quot;havuzda soru yok&quot; hatası alır.
                        </p>
                      ) : null}
                      {p.level && p.level.l1Total > p.level.l1Need ? (
                        <p className="mt-1.5 text-theme-xs">
                          Sınavda {p.level.l1Total} yayında kazanım var; seviye 1 konu sırasına göre ilk{" "}
                          {p.level.l1Need} tanesini sorar, kalanı hiç sorulmaz.
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell align="end">
                      <span className="tabular text-gray-800">{trNumber(testMap.get(p.id) ?? 0)}</span>
                    </TableCell>
                    <TableCell>{yayinHucresi(p)}</TableCell>
                    <TableCell>{erisimHucresi(p)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="border-t border-gray-100 px-4 py-3 text-theme-xs text-gray-500 sm:px-6">
              S1: yayında, bu sınavda ölçülen ve en az 2 yayında L1 sorusu olan kazanım. Hedef sayılar
              app/lib/levels.ts&apos;teki seviye ayarları.
            </p>
          </ComponentCard>
        ) : null}

        {/* ── Konu tekrar testleri ────────────────────────── */}
        {tekrar.length > 0 ? (
          <ComponentCard
            title="Konu tekrar testleri"
            desc="Katalogda görünmez; öğrenci çalışma planındaki konudan başlatır. Her sınav için bir tane."
            flush
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell isHeader>Paket</TableCell>
                  <TableCell isHeader>Hazırlık</TableCell>
                  <TableCell isHeader align="end">
                    Tamamlanan
                  </TableCell>
                  <TableCell isHeader>Yayın</TableCell>
                  <TableCell isHeader>Erişim</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tekrar.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="min-w-52">
                      <p className="font-medium text-gray-800">{p.name}</p>
                      <p className="mt-0.5 text-theme-xs">
                        {p.questionCount} soru · {p.durationMinutes} dk
                      </p>
                    </TableCell>
                    <TableCell className="min-w-64">
                      {p.retest ? (
                        <ProgressLine
                          label={"Konu (en az " + p.questionCount + " soru)"}
                          value={p.retest.ready}
                          target={p.retest.total}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell align="end">
                      <span className="tabular text-gray-800">{trNumber(testMap.get(p.id) ?? 0)}</span>
                    </TableCell>
                    <TableCell>{yayinHucresi(p)}</TableCell>
                    <TableCell>{erisimHucresi(p)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ComponentCard>
        ) : null}
      </div>

      <p className="mt-4 text-theme-xs text-gray-500">
        Havuzu yetmeyen paket yayına alınamaz — öğrencinin katalogda görüp &quot;Başla&quot;ya
        bastığında hata alması, hiç görmemesinden kötü. Ücretliye çevrilen pakette erişim hakkı
        olmayan öğrenci yeni test başlatamaz; tamamlanmış sonuçları durur.
      </p>
    </>
  );
}

/**
 * Konu konu havuz: istenen, sınavda sorulabilen yayındaki soru ve zorluk
 * bantları. Bant eksiği engel değil (seçim gevşer) ama testin zorluğu kayar.
 */
function Dagilim({ paket }: { paket: PackageHealth }) {
  if (paket.blueprint.length === 0) return null;
  return (
    <details className="group mt-2">
      <summary className="cursor-pointer text-theme-xs font-medium text-gray-600 select-none hover:text-brand-500">
        {paket.blueprint.length} konu
      </summary>
      <ul className="mt-2 space-y-1.5">
        {paket.blueprint.map((k) => {
          const hedef = bandTargets(k.need);
          const bantEksik = [
            k.easy < hedef.easy ? "kolay" : null,
            k.medium < hedef.medium ? "orta" : null,
            k.hard < hedef.hard ? "zor" : null,
          ].filter(Boolean);
          return (
            <li key={k.topicId} className="text-theme-xs">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={qs("/checkup/sorular", { konu: k.slug, durum: "PUBLISHED" })}
                  className="truncate text-gray-600 hover:text-brand-500"
                >
                  {k.name}
                </Link>
                <span
                  className={cx(
                    "tabular shrink-0 font-semibold",
                    k.have < k.need ? "text-error-600" : k.have < k.need * 2 ? "text-warning-700" : "text-gray-800"
                  )}
                  title={"Yayında " + k.have + " soru; paket " + k.need + " istiyor, sağlıklı havuz " + k.need * 2}
                >
                  {k.have}
                  <span className="font-normal text-gray-500"> / {k.need}</span>
                </span>
              </div>
              <p className="tabular text-gray-500">
                kolay {k.easy} · orta {k.medium} · zor {k.hard}
                {bantEksik.length ? <span className="text-warning-700"> · {bantEksik.join(", ")} bandı eksik</span> : null}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
