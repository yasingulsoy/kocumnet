import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { trDate } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { EXAM_SCOPE_LABEL } from "@/components/checkup/ObjectiveForms";
import { Card, EmptyState, PageHeader, Pill, StatCard, type Tone } from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Seviyeli koşular" };

const DURUM: Record<string, { etiket: string; ton: Tone }> = {
  IN_PROGRESS: { etiket: "Sürüyor", ton: "brand" },
  COMPLETED: { etiket: "Tamamlandı", ton: "ok" },
  STOPPED: { etiket: "Durdu", ton: "warn" },
};

/**
 * Seviyeli check-up izleme: kim hangi seviyede, nerede durdu, kaç kişi
 * üç seviyeyi tamamladı. Kapı kararlarının toplu görünümü — ayar
 * (geçme oranı, telafi eşiği) değiştirilecekse önce buraya bakılır.
 */
export default async function SeviyeliPage() {
  const gate = await checkStaff(ANY_STAFF);
  if (!gate.ok) return <GateNotice gate={gate} roles={ANY_STAFF} />;
  const kisisel = MANAGE_ROLES.includes(gate.staff.role);

  const [kosular, ozet] = await Promise.all([
    db.levelRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 100,
      select: {
        id: true,
        examScope: true,
        status: true,
        reachedLevel: true,
        unlockedLevel: true,
        stoppedAtLevel: true,
        pendingRemedialIds: true,
        startedAt: true,
        finishedAt: true,
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { stages: true } },
      },
    }),
    db.levelRun.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const say = (s: string) => ozet.find((o) => o.status === s)?._count._all ?? 0;
  const toplam = ozet.reduce((a, o) => a + o._count._all, 0);
  const seviye3 = kosular.filter((k) => k.reachedLevel >= 3).length;

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        title="Seviyeli koşular"
        description="Üç kapılı check-up: Seviye 1 (50 soru) → Seviye 2 → Seviye 3. Kapı kararları app/lib/levels.ts ile verilir."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam koşu" value={toplam} tone="neutral" />
        <StatCard label="Sürüyor" value={say("IN_PROGRESS")} tone="brand" />
        <StatCard label="Tamamlandı" value={say("COMPLETED")} tone="ok" sub={toplam ? `%${Math.round((say("COMPLETED") / toplam) * 100)}` : undefined} />
        <StatCard label="Kapıda durdu" value={say("STOPPED")} tone="warn" sub={`son 100 koşuda ${seviye3} kişi seviye 3'e ulaştı`} />
      </div>

      <Card className="mt-6">
        {kosular.length === 0 ? (
          <EmptyState title="Henüz koşu yok" description="Öğrenciler seviyeli check-up'ı başlatınca burada görünür." />
        ) : (
          <div className="scroll-x">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Öğrenci</th>
                  <th>Sınav</th>
                  <th>Durum</th>
                  <th>Seviye</th>
                  <th>Aşama</th>
                  <th>Başladı</th>
                  <th>Bitti</th>
                </tr>
              </thead>
              <tbody>
                {kosular.map((k) => {
                  const d = DURUM[k.status] ?? { etiket: k.status, ton: "neutral" as Tone };
                  return (
                    <tr key={k.id}>
                      <td>
                        {kisisel ? (
                          <Link href={`/checkup/ogrenciler/${k.user.id}`} className="font-medium text-ink hover:text-brand">
                            {k.user.name}
                          </Link>
                        ) : (
                          <span className="font-mono text-micro text-ink-faint">#{k.user.id.slice(-6)}</span>
                        )}
                        {kisisel ? <p className="text-micro text-ink-faint">{k.user.email}</p> : null}
                      </td>
                      <td><Pill>{EXAM_SCOPE_LABEL[k.examScope] ?? k.examScope}</Pill></td>
                      <td>
                        <Pill tone={d.ton}>{d.etiket}</Pill>
                        {k.pendingRemedialIds.length ? (
                          <p className="mt-1 text-micro text-warn">Telafi bekliyor: {k.pendingRemedialIds.length} kazanım</p>
                        ) : null}
                      </td>
                      <td className="tabular">
                        {k.status === "STOPPED" ? `Seviye ${k.stoppedAtLevel} kapısında` : `Ulaştı: ${k.reachedLevel} · Açık: ${k.unlockedLevel}`}
                      </td>
                      <td className="tabular">{k._count.stages} test</td>
                      <td className="whitespace-nowrap">{trDate(k.startedAt, { time: true })}</td>
                      <td className="whitespace-nowrap">{k.finishedAt ? trDate(k.finishedAt, { time: true }) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
