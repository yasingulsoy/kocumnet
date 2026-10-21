import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { examLabel, percent, trDate, trNumber } from "@/lib/checkup/format";
import { grupListesi, grupSayilari } from "@/lib/checkup/gruplar";
import { GateNotice } from "@/components/checkup/GateNotice";
import { YeniGrupDugmesi } from "@/components/checkup/GrupFormu";
import { Meter } from "@/components/checkup/ui";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Gruplar ve ödevler" };

const BASE = "/checkup/gruplar";

/**
 * Koçluk grupları. Grup bir öğrenci listesi olduğu için yalnızca yönetici ve
 * müdür (KVKK; menüde görünmemek yetki değil). Tamamlanma oranı süresi dolan
 * ödevlerden (lib/checkup/gruplar.ts grupListesi).
 */
export default async function GruplarPage({ searchParams }: PageProps<"/checkup/gruplar">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const sp = await searchParams;
  const arsiv = sp.durum === "arsiv";
  const now = new Date();
  const [gruplar, sayilar] = await Promise.all([grupListesi(arsiv, now), grupSayilari()]);

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Gruplar ve ödevler"
        description="Öğrencileri gruplara topla, gruba test ya da konu alıştırması ver. Tamamlanmayı sistem kayıtlardan çıkarır; öğrencinin işaretlemesi gerekmez."
        actions={<YeniGrupDugmesi />}
      />

      <Card>
        <div className="border-b border-gray-100 px-4 py-3 sm:px-6">
          <SegmentedTabs
            label="Grup durumu"
            items={[
              { key: "etkin", href: BASE, label: "Etkin", active: !arsiv, count: sayilar.etkin },
              { key: "arsiv", href: BASE + "?durum=arsiv", label: "Arşiv", active: arsiv, count: sayilar.arsiv },
            ]}
          />
        </div>

        {gruplar.length === 0 ? (
          <EmptyState
            icon={<UsersRound />}
            title={arsiv ? "Arşivde grup yok" : "Henüz grup yok"}
            description={
              arsiv
                ? "Arşivlenen gruplar burada durur; ödevleri öğrenciye görünmez."
                : "“Yeni grup” ile başla: ad ve sınav yeter, öğrencileri sonra eklersin."
            }
          />
        ) : (
          <Table>
            <caption className="sr-only">{arsiv ? "Arşivlenen gruplar" : "Etkin gruplar"}</caption>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Grup</TableCell>
                <TableCell isHeader>Sınav</TableCell>
                <TableCell isHeader align="end">
                  Üye
                </TableCell>
                <TableCell isHeader align="end" nowrap>
                  Açık ödev
                </TableCell>
                <TableCell isHeader nowrap title="Süresi dolan ödevlerin ortalama tamamlanma oranı (geç tamamlayan dahil)">
                  Tamamlanma
                </TableCell>
                <TableCell isHeader nowrap>
                  {arsiv ? "Arşivlendi" : "Kuruldu"}
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gruplar.map((g) => (
                <TableRow key={g.id} hover className="relative">
                  <TableCell className="w-full max-w-0 min-w-56">
                    <Link
                      href={BASE + "/" + g.id}
                      className="block truncate font-medium text-gray-800 after:absolute after:inset-0 hover:text-brand-500"
                    >
                      {g.name}
                    </Link>
                    {g.note ? <span className="block truncate text-theme-xs">{g.note}</span> : null}
                  </TableCell>
                  <TableCell nowrap>
                    {g.examScope ? (
                      <Badge size="sm" color="light">
                        {examLabel(g.examScope)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell align="end" className="tabular text-gray-800">
                    {trNumber(g.uyeSayisi)}
                  </TableCell>
                  <TableCell align="end" className="tabular text-gray-800">
                    {trNumber(g.acikOdev)}
                  </TableCell>
                  <TableCell className="min-w-40">
                    {g.oran === null ? (
                      <span className="text-theme-xs">Süresi dolan ödev yok</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Meter
                          ratio={g.oran}
                          tone={g.oran >= 0.75 ? "success" : g.oran >= 0.45 ? "warning" : "error"}
                          className="w-20"
                        />
                        <span className="tabular font-medium text-gray-800">{percent(g.oran)}</span>
                        <span className="text-theme-xs whitespace-nowrap">{g.biten} ödev</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell nowrap>{trDate(g.archivedAt ?? g.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
