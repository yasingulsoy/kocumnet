import type { Metadata } from "next";
import Link from "next/link";
import { UserRoundCheck } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { loadRiskliOgrenciler } from "@/lib/checkup/risk-data";
import { RISK_ESIK, RISK_META, RISK_SIRASI, type RiskKey } from "@/lib/checkup/risk";
import { examLabel, gradeLabel, percent, relativeDay, trDate, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import { GrupSuzgeci } from "@/components/checkup/GrupSuzgeci";
import { BULGU_COLOR, qs } from "@/components/checkup/ui";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { SegmentedTabs } from "@/components/tailadmin/ui/SegmentedTabs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Riskli öğrenciler" };

const BASE = "/checkup/ogrenciler/riskli";

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
  // Grup süzgeci (?grup=): yalnızca etkin gruplar; bilinmeyen kimlik süzgeçsiz sayılır.
  const gruplar = await db.studyGroup.findMany({
    where: { archivedAt: null },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, _count: { select: { members: true } } },
  });
  const grup = typeof sp.grup === "string" ? (gruplar.find((g) => g.id === sp.grup) ?? null) : null;
  const { liste, toplam } = await loadRiskliOgrenciler(now, { grupId: grup?.id });
  const gorunen = tur ? liste.filter((o) => o.bulgular.some((b) => b.key === tur)) : liste;

  return (
    <>
      <PageBreadcrumb
        crumbs={[
          { href: "/checkup", label: "Check-up" },
          { href: "/checkup/ogrenciler", label: "Öğrenciler" },
        ]}
        pageTitle="Riskli öğrenciler"
        description={
          (liste.length
            ? trNumber(liste.length) +
              " öğrenci dikkat istiyor (" +
              (grup ? grup.name + " grubunun " + trNumber(toplam) + " öğrencisinden" : trNumber(toplam) + " kayıtlı öğrenciden") +
              "). "
            : "") + "Kişisel veri: yalnızca yönetici ve müdür görür."
        }
      />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
          <SegmentedTabs
            label="Bulgu süzgeci"
            items={[
              { key: "hepsi", href: qs(BASE, { grup: grup?.id }), label: "Tümü", active: !tur, count: liste.length },
              ...RISK_SIRASI.map((k) => ({
                key: k,
                href: qs(BASE, { tur: k, grup: grup?.id }),
                label: RISK_META[k].baslik,
                active: tur === k,
                count: liste.filter((o) => o.bulgular.some((b) => b.key === k)).length,
              })),
            ]}
          />
          <GrupSuzgeci action={BASE} gruplar={gruplar} secili={grup?.id ?? null} gizli={{ tur: tur ?? undefined }} />
        </div>

        {gorunen.length === 0 ? (
          <EmptyState
            icon={<UserRoundCheck />}
            title={liste.length === 0 ? (grup ? "Bu grupta riskli öğrenci yok" : "Şu an riskli öğrenci yok") : "Bu bulguda öğrenci yok"}
            description={
              liste.length === 0
                ? "Herkes son " +
                  RISK_ESIK.pasifGun +
                  " günde etkin, ödevlerini yapmış, planını büyük ölçüde yapıyor ve son testinde düşmemiş."
                : undefined
            }
          />
        ) : (
          <Table>
            <caption className="sr-only">Riskli öğrenciler, en ciddi bulgusu olan en üstte</caption>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Öğrenci</TableCell>
                <TableCell isHeader>Sınıf · hedef</TableCell>
                <TableCell isHeader>Son etkinlik</TableCell>
                <TableCell isHeader align="end" nowrap title="Son iki paket testinin başarı oranı">
                  Son iki test
                </TableCell>
                <TableCell isHeader align="end" nowrap title="Geçen haftanın planında tamamlanan iş">
                  Geçen hafta planı
                </TableCell>
                <TableCell isHeader>Bulgular</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((o) => {
                const [son, onceki] = o.sonIkiPaket;
                const sinif = [gradeLabel(o.grade), o.targetExam ? examLabel(o.targetExam) : null].filter(Boolean);
                return (
                  <TableRow key={o.id} hover className="align-top">
                    <TableCell className="min-w-56">
                      <Link href={"/checkup/ogrenciler/" + o.id} className="group flex items-center gap-3">
                        <Avatar name={o.name} size="medium" decorative />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-gray-800 group-hover:text-brand-500">{o.name}</span>
                          <span className="block truncate text-theme-xs">{o.email}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell nowrap>{sinif.length ? sinif.join(" · ") : "—"}</TableCell>
                    <TableCell nowrap title={trDate(o.sonEtkinlik, { time: true })}>
                      {relativeDay(o.sonEtkinlik, now)}
                      <span className="block text-theme-xs" title="Ölçüm sayılan test; boş ve yarım kalanlar hariç">
                        {o.testSayisi} test
                      </span>
                    </TableCell>
                    <TableCell align="end" nowrap className="tabular">
                      {son === null ? (
                        "—"
                      ) : onceki === null ? (
                        percent(son)
                      ) : (
                        <>
                          {percent(onceki)} → <span className="font-semibold text-gray-800">{percent(son)}</span>
                        </>
                      )}
                    </TableCell>
                    <TableCell align="end" nowrap className="tabular">
                      {o.gecenHaftaPlan ? o.gecenHaftaPlan.biten + "/" + o.gecenHaftaPlan.toplam : "plan yok"}
                    </TableCell>
                    <TableCell className="min-w-64">
                      <ul className="flex flex-wrap gap-1">
                        {o.bulgular.map((b) => (
                          <li key={b.key}>
                            <Badge size="sm" color={BULGU_COLOR[b.ton]}>
                              {b.baslik}
                              <span className="font-normal opacity-80">· {b.ayrinti}</span>
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <details className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-theme-sm text-gray-500 sm:px-6">
        <summary className="cursor-pointer font-display text-base font-semibold text-gray-800 select-none">
          Kurallar ve önerilen adım
        </summary>
        <ul className="mt-3 space-y-2.5">
          {RISK_SIRASI.map((k) => (
            <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Badge size="sm" color={BULGU_COLOR[RISK_META[k].ton]}>
                {RISK_META[k].baslik}
              </Badge>
              <span className="text-gray-600">{RISK_META[k].aciklama}</span>
              <span>— {RISK_META[k].eylem}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-gray-100 pt-3 text-theme-xs">
          Eşikler araç içindir ve tek dosyada durur (lib/checkup/risk.ts). Son etkinlik: uygulamada son görülme, son
          giriş, son başlatılan test ya da alıştırma ve kayıt tarihinin en yenisi. Ödev yalnızca etkin gruplardan ve
          öğrenci gruba son tarihten önce katıldıysa sayılır. Hafta, öğrenci uygulamasındaki gibi pazartesi başlar
          (Türkiye saati).
        </p>
      </details>
    </>
  );
}
