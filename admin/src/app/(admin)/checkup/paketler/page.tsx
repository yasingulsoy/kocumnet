import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
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
import {
  Card,
  CardHeader,
  EmptyState,
  FilterTabs,
  Notice,
  PACKAGE_STATE_TONE,
  PageHeader,
  Pill,
  ProgressLine,
  QUESTION_STATUS_TONE,
  qs,
} from "@/components/checkup/ui";

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

  const [health, testSayilari] = await Promise.all([
    loadPackageHealth(),
    db.checkupSession.groupBy({
      by: ["packageId"],
      where: { status: "SUBMITTED" },
      _count: { _all: true },
    }),
  ]);
  const testMap = new Map(testSayilari.map((t) => [t.packageId, t._count._all]));

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
      <Pill tone={QUESTION_STATUS_TONE[p.status]}>{QUESTION_STATUS_LABEL[p.status]}</Pill>
    );
  const erisimHucresi = (p: PackageHealth) =>
    yonetebilir ? (
      <PackageFreeToggle id={p.id} isFree={p.isFree} name={p.name} />
    ) : (
      <Pill tone={p.isFree ? "neutral" : "brand"}>{p.isFree ? "Ücretsiz" : "Ücretli"}</Pill>
    );

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        title="Paketler"
        description={
          health.length +
          " paket · " +
          (ucretliSayisi ? ucretliSayisi + " ücretli" : "hepsi ücretsiz") +
          ". Paket içeriği (konular, soru dağılımı) şimdilik seed'den geliyor."
        }
      />

      {!yonetebilir ? (
        <Notice tone="info" className="mb-4">
          Yayın durumu ve ücret ayarını yalnızca yönetici ve müdür değiştirebilir.
        </Notice>
      ) : null}
      {yayindaSorunlu > 0 ? (
        <Notice tone="bad" className="mb-4" title={`Yayındaki ${yayindaSorunlu} paket başlatılamıyor`}>
          Öğrenci bu paketleri katalogda görüyor ama &quot;Başla&quot;ya bastığında hata alır. Eksik
          konulara soru ekleyin ya da paketi taslağa çekin.
        </Notice>
      ) : null}

      {/* ── Katalog ─────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Katalog paketleri"
          description="Öğrencinin katalogda gördüğü testler. Sayılar paketin sınavında sorulabilen yayındaki sorular — başka sınava kısıtlanmış sorular sayılmaz."
        />
        <div className="border-b border-line px-4 py-2 sm:px-5">
          <FilterTabs
            label="Sınav süzgeci"
            items={[
              { href: "/checkup/paketler", label: "Tüm sınavlar", active: !sinav, count: katalogTumu.length },
              ...EXAM_SCOPES.filter((s) => katalogTumu.some((p) => p.examScope === s)).map((s) => ({
                href: qs("/checkup/paketler", { sinav: s }),
                label: examLabel(s),
                active: s === sinav,
                count: katalogTumu.filter((p) => p.examScope === s).length,
              })),
            ]}
          />
        </div>
        {katalog.length === 0 ? (
          <EmptyState title="Bu sınavda katalog paketi yok" />
        ) : (
          <div className="scroll-x">
            <table className="data-table min-w-[56rem]">
              <thead>
                <tr>
                  <th scope="col">Paket</th>
                  <th scope="col">Kapsam</th>
                  <th scope="col">Havuz</th>
                  <th scope="col" className="text-end">
                    Tamamlanan
                  </th>
                  <th scope="col">Yayın</th>
                  <th scope="col">Erişim</th>
                </tr>
              </thead>
              <tbody>
                {katalog.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="min-w-56">
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-micro text-ink-faint">
                        {p.kind === "INTRO" ? <Pill tone="info">Tanışma</Pill> : null}
                        {p.slug}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      {examLabel(p.examScope)} · {p.questionCount} soru · {p.durationMinutes} dk
                    </td>
                    <td className="min-w-72">
                      <Pill tone={PACKAGE_STATE_TONE[p.state]}>{PACKAGE_STATE_LABEL[p.state]}</Pill>
                      {p.state !== "ready" ? (
                        <p className={clsx("mt-1 max-w-80 text-micro", p.state === "blocked" ? "text-bad" : "text-warn")}>
                          {p.summary}
                        </p>
                      ) : null}
                      <Dagilim paket={p} />
                    </td>
                    <td className="text-end tabular text-ink">{trNumber(testMap.get(p.id) ?? 0)}</td>
                    <td>{yayinHucresi(p)}</td>
                    <td>{erisimHucresi(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Seviyeli ────────────────────────────────────── */}
      {seviyeli.length > 0 ? (
        <Card className="mt-6">
          <CardHeader
            title="Seviyeli check-up"
            description={
              <>
                Konu dağılımı yok: seviye 1 her kazanımdan bir soru, seviye 2-3 seviyeli sorulardan
                seçer. Kazanım hazırlığı:{" "}
                <Link href="/checkup/kazanimlar" className="font-medium text-brand hover:text-brand-hover">
                  Kazanımlar
                </Link>
                .
              </>
            }
          />
          <div className="scroll-x">
            <table className="data-table min-w-[52rem]">
              <thead>
                <tr>
                  <th scope="col">Paket</th>
                  <th scope="col">Hazırlık</th>
                  <th scope="col" className="text-end" title="Tamamlanan aşama (seviye testi) sayısı">
                    Aşama
                  </th>
                  <th scope="col">Yayın</th>
                  <th scope="col">Erişim</th>
                </tr>
              </thead>
              <tbody>
                {seviyeli.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="min-w-52">
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="mt-0.5 text-micro text-ink-faint">
                        <Link
                          href={qs("/checkup/kazanimlar", { sinav: p.examScope })}
                          className="hover:text-brand"
                        >
                          {examLabel(p.examScope)} kazanımları
                        </Link>
                      </p>
                    </td>
                    <td className="min-w-80">
                      {p.level ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          <ProgressLine label="S1 kazanım" value={p.level.l1Ready} target={p.level.l1Need} />
                          <ProgressLine label="S2 soru" value={p.level.l2} target={p.level.l2Need} />
                          <ProgressLine label="S3 soru" value={p.level.l3} target={p.level.l3Need} />
                        </div>
                      ) : null}
                      {p.state === "blocked" ? (
                        <p className="mt-1.5 text-micro text-bad">
                          Bir seviyede hiç soru yok: öğrenci o kapıda &quot;havuzda soru yok&quot; hatası alır.
                        </p>
                      ) : null}
                      {p.level && p.level.l1Total > p.level.l1Need ? (
                        <p className="mt-1.5 text-micro text-ink-faint">
                          Sınavda {p.level.l1Total} yayında kazanım var; seviye 1 konu sırasına göre ilk{" "}
                          {p.level.l1Need} tanesini sorar, kalanı hiç sorulmaz.
                        </p>
                      ) : null}
                    </td>
                    <td className="text-end tabular text-ink">{trNumber(testMap.get(p.id) ?? 0)}</td>
                    <td>{yayinHucresi(p)}</td>
                    <td>{erisimHucresi(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-micro text-ink-faint sm:px-6">
            S1: yayında, bu sınavda ölçülen ve en az 2 yayında L1 sorusu olan kazanım. Hedef sayılar
            app/lib/levels.ts&apos;teki seviye ayarları.
          </p>
        </Card>
      ) : null}

      {/* ── Konu tekrar testleri ────────────────────────── */}
      {tekrar.length > 0 ? (
        <Card className="mt-6">
          <CardHeader
            title="Konu tekrar testleri"
            description="Katalogda görünmez; öğrenci çalışma planındaki konudan başlatır. Her sınav için bir tane."
          />
          <div className="scroll-x">
            <table className="data-table min-w-[48rem]">
              <thead>
                <tr>
                  <th scope="col">Paket</th>
                  <th scope="col">Hazırlık</th>
                  <th scope="col" className="text-end">
                    Tamamlanan
                  </th>
                  <th scope="col">Yayın</th>
                  <th scope="col">Erişim</th>
                </tr>
              </thead>
              <tbody>
                {tekrar.map((p) => (
                  <tr key={p.id}>
                    <td className="min-w-52">
                      <p className="font-medium text-ink">{p.name}</p>
                      <p className="mt-0.5 text-micro text-ink-faint">
                        {p.questionCount} soru · {p.durationMinutes} dk
                      </p>
                    </td>
                    <td className="min-w-64">
                      {p.retest ? (
                        <ProgressLine
                          label={"Konu (en az " + p.questionCount + " soru)"}
                          value={p.retest.ready}
                          target={p.retest.total}
                        />
                      ) : null}
                    </td>
                    <td className="text-end tabular text-ink">{trNumber(testMap.get(p.id) ?? 0)}</td>
                    <td>{yayinHucresi(p)}</td>
                    <td>{erisimHucresi(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <p className="mt-4 text-micro text-ink-faint">
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
      <summary className="cursor-pointer select-none text-micro font-medium text-ink-soft hover:text-brand">
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
            <li key={k.topicId} className="text-micro">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={qs("/checkup/sorular", { konu: k.slug, durum: "PUBLISHED" })}
                  className="truncate text-ink-soft hover:text-brand"
                >
                  {k.name}
                </Link>
                <span
                  className={clsx(
                    "tabular shrink-0 font-semibold",
                    k.have < k.need ? "text-bad" : k.have < k.need * 2 ? "text-warn" : "text-ink"
                  )}
                  title={"Yayında " + k.have + " soru; paket " + k.need + " istiyor, sağlıklı havuz " + k.need * 2}
                >
                  {k.have}
                  <span className="font-normal text-ink-faint"> / {k.need}</span>
                </span>
              </div>
              <p className="tabular text-ink-faint">
                kolay {k.easy} · orta {k.medium} · zor {k.hard}
                {bantEksik.length ? <span className="text-warn"> · {bantEksik.join(", ")} bandı eksik</span> : null}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
