import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CirclePause, Layers, PlayCircle } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { ANY_STAFF, MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { examLabel, trDate } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { MONO } from "@/components/checkup/ui";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Seviyeli koşular" };

const DURUM: Record<string, { etiket: string; renk: BadgeColor }> = {
  IN_PROGRESS: { etiket: "Sürüyor", renk: "primary" },
  COMPLETED: { etiket: "Tamamlandı", renk: "success" },
  STOPPED: { etiket: "Durdu", renk: "warning" },
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
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Seviyeli koşular"
        description="Üç kapılı check-up: Seviye 1 (50 soru) → Seviye 2 → Seviye 3. Kapı kararları app/lib/levels.ts ile verilir."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
        <MetricCard label="Toplam koşu" value={toplam} icon={<Layers />} tone="gray" />
        <MetricCard label="Sürüyor" value={say("IN_PROGRESS")} icon={<PlayCircle />} tone="brand" />
        <MetricCard
          label="Tamamlandı"
          value={say("COMPLETED")}
          icon={<CircleCheck />}
          tone="success"
          hint={toplam ? `Tamamlanma oranı %${Math.round((say("COMPLETED") / toplam) * 100)}` : undefined}
        />
        <MetricCard
          label="Kapıda durdu"
          value={say("STOPPED")}
          icon={<CirclePause />}
          tone="warning"
          hint={`son 100 koşuda ${seviye3} kişi seviye 3'e ulaştı`}
        />
      </div>

      <ComponentCard className="mt-6" title="Son koşular" desc="En yeni 100 koşu." flush>
        {kosular.length === 0 ? (
          <EmptyState icon={<Layers />} title="Henüz koşu yok" description="Öğrenciler seviyeli check-up'ı başlatınca burada görünür." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Öğrenci</TableCell>
                <TableCell isHeader>Sınav</TableCell>
                <TableCell isHeader>Durum</TableCell>
                <TableCell isHeader>Seviye</TableCell>
                <TableCell isHeader>Aşama</TableCell>
                <TableCell isHeader>Başladı</TableCell>
                <TableCell isHeader>Bitti</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kosular.map((k) => {
                const d = DURUM[k.status] ?? { etiket: k.status, renk: "light" as BadgeColor };
                return (
                  <TableRow key={k.id} hover>
                    <TableCell className="min-w-52">
                      {kisisel ? (
                        <Link href={`/checkup/ogrenciler/${k.user.id}`} className="group flex items-center gap-3">
                          <Avatar name={k.user.name} size="small" decorative />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-800 group-hover:text-brand-500">{k.user.name}</span>
                            <span className="block truncate text-theme-xs">{k.user.email}</span>
                          </span>
                        </Link>
                      ) : (
                        // Görüntüleyici ve editör öğrenci adını görmez (KVKK): yalnızca kısa kimlik.
                        <span className={MONO + " text-theme-xs"}>#{k.user.id.slice(-6)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge size="sm" color="light">
                        {examLabel(k.examScope)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge size="sm" color={d.renk}>
                        {d.etiket}
                      </Badge>
                      {k.pendingRemedialIds.length ? (
                        <p className="mt-1 text-theme-xs text-warning-700">Telafi bekliyor: {k.pendingRemedialIds.length} kazanım</p>
                      ) : null}
                    </TableCell>
                    <TableCell nowrap className="tabular">
                      {k.status === "STOPPED" ? `Seviye ${k.stoppedAtLevel} kapısında` : `Ulaştı: ${k.reachedLevel} · Açık: ${k.unlockedLevel}`}
                    </TableCell>
                    <TableCell nowrap className="tabular">
                      {k._count.stages} test
                    </TableCell>
                    <TableCell nowrap>{trDate(k.startedAt, { time: true })}</TableCell>
                    <TableCell nowrap>{k.finishedAt ? trDate(k.finishedAt, { time: true }) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ComponentCard>
    </>
  );
}
