import type { Metadata } from "next";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { PACKAGE_STATE_LABEL, loadPackageHealth } from "@/lib/checkup/pool";
import { QUESTION_STATUS_LABEL, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { PackageFreeToggle, PackageStatusSelect } from "@/components/checkup/PackageControls";
import { Card, Notice, PageHeader, Pill, QUESTION_STATUS_TONE, type Tone } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Paketler" };

const STATE_TONE: Record<string, Tone> = { ready: "ok", narrow: "warn", blocked: "bad" };

export default async function PackagesPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const yonetebilir = MANAGE_ROLES.includes(gate.staff.role);

  const [health, testSayilari] = await Promise.all([
    loadPackageHealth(),
    db.checkupSession.groupBy({
      by: ["packageId"],
      where: { status: "SUBMITTED" },
      _count: { _all: true },
    }),
  ]);
  const testMap = new Map(testSayilari.map((t) => [t.packageId, t._count._all]));
  const ucretliSayisi = health.filter((p) => !p.isFree).length;

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        title="Paketler"
        description={
          health.length +
          " paket · " +
          (ucretliSayisi ? ucretliSayisi + " ücretli" : "hepsi ücretsiz") +
          ". Paketin içeriğini (konular ve soru dağılımı) değiştirmek şimdilik geliştirici işi."
        }
      />

      {!yonetebilir ? (
        <Notice tone="info" className="mb-4">
          Yayın durumu ve ücret ayarını yalnızca yönetici ve müdür değiştirebilir.
        </Notice>
      ) : null}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-theme-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                <th className="px-5 py-3 font-medium sm:px-6">Paket</th>
                <th className="px-3 py-3 font-medium">Kapsam</th>
                <th className="px-3 py-3 font-medium">Havuz</th>
                <th className="px-3 py-3 text-end font-medium">Tamamlanan</th>
                <th className="px-3 py-3 font-medium">Yayın</th>
                <th className="px-5 py-3 font-medium sm:px-6">Erişim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {health.map((p) => (
                <tr key={p.id} className="align-middle">
                  <td className="px-5 py-3.5 sm:px-6">
                    <p className="font-medium text-gray-800 dark:text-white/90">{p.name}</p>
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">{p.slug}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-gray-600 dark:text-gray-400">
                    {p.examScope} · {p.questionCount} soru · {p.durationMinutes} dk · {p.topicCount} konu
                  </td>
                  <td className="px-3 py-3.5">
                    <Pill tone={STATE_TONE[p.state]}>{PACKAGE_STATE_LABEL[p.state]}</Pill>
                    {p.blocking.length > 0 ? (
                      <p className="mt-1 max-w-56 truncate text-theme-xs text-error-600 dark:text-error-500" title={p.blocking.map((b) => b.name + " " + b.have + "/" + b.need).join(", ")}>
                        eksik: {p.blocking.map((b) => b.name).join(", ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3.5 text-end tabular-nums text-gray-800 dark:text-white/90">
                    {trNumber(testMap.get(p.id) ?? 0)}
                  </td>
                  <td className="px-3 py-3.5">
                    {yonetebilir ? (
                      <PackageStatusSelect id={p.id} status={p.status} name={p.name} />
                    ) : (
                      <Pill tone={QUESTION_STATUS_TONE[p.status]}>{QUESTION_STATUS_LABEL[p.status]}</Pill>
                    )}
                  </td>
                  <td className="px-5 py-3.5 sm:px-6">
                    {yonetebilir ? (
                      <PackageFreeToggle id={p.id} isFree={p.isFree} name={p.name} />
                    ) : (
                      <Pill tone={p.isFree ? "neutral" : "brand"}>{p.isFree ? "Ücretsiz" : "Ücretli"}</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 text-theme-xs text-gray-500 dark:text-gray-400">
        Havuzu yetmeyen paket yayına alınamaz — öğrencinin kataloğda görüp &quot;Başla&quot;ya
        bastığında hata alması, hiç görmemesinden kötü. Ücretliye çevrilen pakette erişim hakkı
        olmayan öğrenci yeni test başlatamaz; tamamlanmış sonuçları durur.
      </p>
    </>
  );
}
