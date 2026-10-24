import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarCheck, ClipboardX, MessageCircleQuestion, PencilLine } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { buHaftaVerisi } from "@/lib/checkup/bu-hafta";
import { mudahaleGerekir, type BuHaftaSatiri } from "@/lib/checkup/bu-hafta-kurallari";
import { RISK_ESIK } from "@/lib/checkup/risk";
import { percent, relativeDay, trDate, trNumber } from "@/lib/checkup/format";
import { haftaEtiketi } from "@/lib/checkup/shared/coaching";
import { GateNotice } from "@/components/checkup/GateNotice";
import { GrupSuzgeci } from "@/components/checkup/GrupSuzgeci";
import { BULGU_COLOR } from "@/components/checkup/ui";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { MetricCard } from "@/components/tailadmin/ui/MetricCard";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Bu hafta" };

const BASE = "/checkup/bu-hafta";

/*
 * Bu hafta: koçun haftalık bakışı. Satır öğrenci; önce müdahale gerekenler
 * (risk bulgusu ya da yapılmamış ödev), sonra öbürleri ada göre. Kurallar
 * lib/checkup/bu-hafta-kurallari.ts, veri bu-hafta.ts, risk bulguları
 * risk.ts (Riskli öğrenciler ile aynı). Öğrenci kişisel verisi: yalnızca
 * yönetici ve müdür. Telefonda tablo yerine kart.
 */

function Rozetler({ s }: { s: BuHaftaSatiri }) {
  if (s.bulgular.length === 0) return <span className="text-theme-xs text-gray-400">—</span>;
  return (
    <ul className="flex flex-wrap gap-1">
      {s.bulgular.map((b) => (
        <li key={b.key}>
          <Badge size="sm" color={BULGU_COLOR[b.ton]}>
            {b.baslik}
            <span className="font-normal opacity-80">· {b.ayrinti}</span>
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function OdevOrani({ s }: { s: BuHaftaSatiri }) {
  const { tamamlayan, sayilan } = s.gecenOdev;
  if (sayilan === 0) return <span className="text-gray-400">—</span>;
  return <span className={tamamlayan < sayilan ? "font-semibold text-error-600" : "text-gray-800"}>{tamamlayan + "/" + sayilan}</span>;
}

function AcikOdev({ s }: { s: BuHaftaSatiri }) {
  const { toplam, bekleyen } = s.acikOdev;
  if (toplam === 0) return <span className="text-gray-400">—</span>;
  return (
    <span title={toplam - bekleyen + " tanesini bitirdi"}>
      <span className="text-gray-800">{bekleyen}</span>
      <span className="text-theme-xs text-gray-500"> / {toplam} bekliyor</span>
    </span>
  );
}

function Plan({ s }: { s: BuHaftaSatiri }) {
  if (!s.plan || s.plan.toplam === 0) return <span className="text-gray-400">plan yok</span>;
  return <span title={s.plan.biten + "/" + s.plan.toplam + " iş"}>{percent(s.plan.biten / s.plan.toplam)}</span>;
}

function Soru({ n }: { n: number }) {
  return n > 0 ? (
    <Badge size="sm" color="warning">
      {n}
    </Badge>
  ) : (
    <span className="text-gray-400">—</span>
  );
}

export default async function BuHaftaPage({ searchParams }: PageProps<"/checkup/bu-hafta">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const sp = await searchParams;
  const now = new Date();
  const gruplar = await db.studyGroup.findMany({
    where: { archivedAt: null },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, _count: { select: { members: true } } },
  });
  // Bilinmeyen ya da arşivdeki grup kimliği süzgeçsiz sayılır.
  const grup = typeof sp.grup === "string" ? (gruplar.find((g) => g.id === sp.grup) ?? null) : null;
  const { satirlar, hafta } = await buHaftaVerisi(now, grup?.id ?? null);

  const mudahale = satirlar.filter(mudahaleGerekir).length;
  const cozen = satirlar.filter((s) => s.haftaSoru > 0).length;
  const yapilmayan = satirlar.reduce((t, s) => t + (s.gecenOdev.sayilan - s.gecenOdev.tamamlayan), 0);
  const bekleyenSoru = satirlar.reduce((t, s) => t + s.bekleyenSoru, 0);

  const kart = (etiket: string, deger: ReactNode) => (
    <div className="min-w-0">
      <dt className="text-theme-xs text-gray-500">{etiket}</dt>
      <dd className="tabular text-theme-sm">{deger}</dd>
    </div>
  );

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Bu hafta"
        description={
          "Hafta: " +
          haftaEtiketi(hafta) +
          " (pazartesi başlar, Türkiye saati)" +
          (grup ? " · " + grup.name : "") +
          ". Önce müdahale gerekenler. Kişisel veri: yalnızca yönetici ve müdür görür."
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 md:mb-6 md:gap-6 xl:grid-cols-4">
        <MetricCard
          compact
          label="Müdahale gereken"
          value={trNumber(mudahale)}
          icon={<CalendarCheck />}
          tone={mudahale > 0 ? "warning" : "success"}
          hint={trNumber(satirlar.length) + " öğrenciden"}
        />
        <MetricCard
          compact
          label="Bu hafta soru çözen"
          value={trNumber(cozen)}
          icon={<PencilLine />}
          tone="brand"
          hint={"en az bir soru · " + trNumber(satirlar.length) + " öğrenciden"}
        />
        <MetricCard
          compact
          label="Yapılmayan ödev"
          value={trNumber(yapilmayan)}
          icon={<ClipboardX />}
          tone={yapilmayan > 0 ? "error" : "gray"}
          hint={"son " + RISK_ESIK.odevPencereGun + " günde süresi dolan"}
        />
        <MetricCard
          compact
          label="Bekleyen koça soru"
          value={trNumber(bekleyenSoru)}
          icon={<MessageCircleQuestion />}
          tone={bekleyenSoru > 0 ? "warning" : "gray"}
          href={bekleyenSoru > 0 ? "/checkup/koca-sorular" : undefined}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
          <p className="max-w-prose text-theme-xs text-gray-500">
            Soru: bu hafta işaretlediği soru, her türden testte ve alıştırmada (“Bilmiyorum” sayılmaz). Ödev: son{" "}
            {RISK_ESIK.odevPencereGun} günde süresi dolanlardan tamamladığı. Plan: bu haftanın işleri.
          </p>
          <GrupSuzgeci action={BASE} gruplar={gruplar} secili={grup?.id ?? null} />
        </div>

        {satirlar.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck />}
            title={grup ? "Bu grupta öğrenci yok" : "Henüz kayıtlı öğrenci yok"}
            description={grup ? "Grup sayfasından üye ekle ya da davet bağlantısını gönder." : undefined}
          />
        ) : (
          <>
            {/* ── Geniş ekran: tablo ─────────────────── */}
            <div className="hidden md:block">
              <Table>
                <caption className="sr-only">Öğrenciler, müdahale gerekenler en üstte</caption>
                <TableHeader>
                  <TableRow>
                    <TableCell isHeader>Öğrenci</TableCell>
                    <TableCell isHeader nowrap>
                      Son etkinlik
                    </TableCell>
                    <TableCell isHeader align="end" nowrap title="Bu hafta işaretlediği soru; “Bilmiyorum” sayılmaz">
                      Bu hafta soru
                    </TableCell>
                    <TableCell isHeader align="end" nowrap title={"Son " + RISK_ESIK.odevPencereGun + " günde süresi dolan ödevler: tamamlanan / hepsi"}>
                      Son {RISK_ESIK.odevPencereGun} gün ödev
                    </TableCell>
                    <TableCell isHeader nowrap title="Son tarihi gelmemiş ödevlerden bitirmedikleri">
                      Açık ödev
                    </TableCell>
                    <TableCell isHeader align="end" nowrap title="Bu haftanın planında tamamlanan iş">
                      Plan
                    </TableCell>
                    <TableCell isHeader>Risk</TableCell>
                    <TableCell isHeader align="end" nowrap title="Cevap bekleyen “Koça sor” soruları">
                      Koça soru
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {satirlar.map((s) => (
                    <TableRow key={s.id} hover className="relative align-top">
                      <TableCell className="w-full max-w-0 min-w-52">
                        <Link href={"/checkup/ogrenciler/" + s.id} className="group flex items-center gap-3 after:absolute after:inset-0">
                          <Avatar name={s.name} size="small" decorative />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-800 group-hover:text-brand-500">{s.name}</span>
                            <span className="block truncate text-theme-xs">{s.email}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell nowrap title={trDate(s.sonEtkinlik, { time: true })}>
                        {relativeDay(s.sonEtkinlik, now)}
                      </TableCell>
                      <TableCell align="end" className="tabular text-gray-800">
                        {s.haftaSoru > 0 ? trNumber(s.haftaSoru) : <span className="text-gray-400">0</span>}
                      </TableCell>
                      <TableCell align="end" className="tabular">
                        <OdevOrani s={s} />
                      </TableCell>
                      <TableCell nowrap className="tabular">
                        <AcikOdev s={s} />
                      </TableCell>
                      <TableCell align="end" className="tabular">
                        <Plan s={s} />
                      </TableCell>
                      <TableCell className="min-w-56">
                        <Rozetler s={s} />
                      </TableCell>
                      <TableCell align="end">
                        <Soru n={s.bekleyenSoru} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* ── Telefon: kart ──────────────────────── */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {satirlar.map((s) => (
                <li key={s.id} className="relative px-4 py-4 transition hover:bg-gray-50">
                  <Link href={"/checkup/ogrenciler/" + s.id} className="group flex items-center gap-3 after:absolute after:inset-0">
                    <Avatar name={s.name} size="small" decorative />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-theme-sm font-medium text-gray-800 group-hover:text-brand-500">{s.name}</span>
                      <span className="block truncate text-theme-xs text-gray-500">son etkinlik {relativeDay(s.sonEtkinlik, now)}</span>
                    </span>
                  </Link>
                  {s.bulgular.length > 0 ? (
                    <div className="mt-2">
                      <Rozetler s={s} />
                    </div>
                  ) : null}
                  <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2">
                    {kart("Bu hafta soru", s.haftaSoru)}
                    {kart("Son " + RISK_ESIK.odevPencereGun + " gün ödev", <OdevOrani s={s} />)}
                    {kart("Açık ödev", <AcikOdev s={s} />)}
                    {kart("Plan", <Plan s={s} />)}
                    {kart("Koça soru", <Soru n={s.bekleyenSoru} />)}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
