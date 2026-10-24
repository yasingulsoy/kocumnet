import type { Metadata } from "next";
import Link from "next/link";
import { Search, UserRoundX, Users } from "lucide-react";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { examLabel, gradeLabel, percent, relativeDay, trDate, trNumber } from "@/lib/checkup/format";
import { listeOzeti, sonGorulme } from "@/lib/checkup/ogrenci-ozeti";
import { loadRiskliOgrenciler } from "@/lib/checkup/risk-data";
import { GateNotice } from "@/components/checkup/GateNotice";
import { qs } from "@/components/checkup/ui";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button, ButtonLink } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { Pagination } from "@/components/tailadmin/ui/Pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export const metadata: Metadata = { title: "Check-up · Öğrenciler" };

const SAYFA_BOYU = 25;

/*
 * "Son etkinlik" sırası: önce lastSeenAt (oturumla son istek), onu hiç
 * yazılmamış (eski) kayıtlar sonra, kendi aralarında son girişe göre.
 * Ekrandaki değer ikisinin yenisi (ogrenci-ozeti.ts sonGorulme); fark
 * en fazla bir saat (lastSeenAt saatte bir yazılıyor).
 */
const SIRALAMA = {
  yeni: { label: "En yeni kayıt", orderBy: [{ createdAt: "desc" as const }] },
  etkinlik: {
    label: "Son etkinlik",
    orderBy: [
      { lastSeenAt: { sort: "desc" as const, nulls: "last" as const } },
      { lastLoginAt: { sort: "desc" as const, nulls: "last" as const } },
    ],
  },
  ad: { label: "Ada göre", orderBy: [{ name: "asc" as const }] },
};
type SiralamaKey = keyof typeof SIRALAMA;
/** Eski adres (?sirala=giris) yeni sıraya düşsün; kaydedilmiş bağlantılar bozulmasın. */
const ESKI_SIRALAMA: Record<string, SiralamaKey> = { giris: "etkinlik" };

export default async function StudentsPage({ searchParams }: PageProps<"/checkup/ogrenciler">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const sp = await searchParams;
  const ara = typeof sp.ara === "string" ? sp.ara.trim().slice(0, 100) : "";
  const istenenSira = typeof sp.sirala === "string" ? (ESKI_SIRALAMA[sp.sirala] ?? sp.sirala) : "";
  const sirala: SiralamaKey = Object.hasOwn(SIRALAMA, istenenSira) ? (istenenSira as SiralamaKey) : "yeni";
  const sayfa = Math.max(1, Math.floor(Number(typeof sp.sayfa === "string" ? sp.sayfa : 1)) || 1);

  const where = {
    role: "STUDENT" as const,
    ...(ara
      ? {
          OR: [
            { email: { contains: ara, mode: "insensitive" as const } },
            { name: { contains: ara, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const now = new Date();

  const [toplam, ogrenciler, risk] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: SIRALAMA[sirala].orderBy,
      skip: (sayfa - 1) * SAYFA_BOYU,
      take: SAYFA_BOYU,
      select: {
        id: true,
        email: true,
        name: true,
        grade: true,
        targetExam: true,
        createdAt: true,
        lastLoginAt: true,
        lastSeenAt: true,
        /*
         * "Test" ve "Son başarı" ayrıntı sayfasıyla AYNI kuraldan
         * (ogrenci-ozeti.ts listeOzeti → shared/insights.ts egilimeGirer):
         * yalnızca ölçüm sayılan paket testleri, tek sınavdan. Kontrol testi,
         * seviyeli aşama, boş gönderilen ve yarım kalan test sayılmaz; bu
         * yüzden sonuçlar geliyor, sayım burada yapılıyor. Yarım test kuralı
         * için endedBy ve blankCount seçili. Sayfa başına 25 öğrenci.
         */
        checkupSessions: {
          where: { status: "SUBMITTED", kind: { not: "PRACTICE" }, result: { isNot: null } },
          orderBy: { startedAt: "desc" },
          take: 100,
          select: {
            kind: true,
            endedBy: true,
            package: { select: { examScope: true } },
            result: { select: { correctCount: true, wrongCount: true, blankCount: true, examScope: true } },
          },
        },
        entitlements: {
          where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: { id: true },
        },
      },
    }),
    loadRiskliOgrenciler(now),
  ]);

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));

  return (
    <>
      <PageBreadcrumb
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        pageTitle="Öğrenciler"
        description={
          trNumber(toplam) + (ara ? " öğrenci aramaya uyuyor." : " kayıtlı öğrenci.") +
          " Kişisel veri: yalnızca yönetici ve müdür görür."
        }
        actions={
          <ButtonLink
            href="/checkup/ogrenciler/riskli"
            variant="outline"
            size="xs"
            startIcon={<UserRoundX />}
            endIcon={
              <Badge size="sm" color={risk.liste.length ? "warning" : "light"} className="tabular">
                {trNumber(risk.liste.length)}
              </Badge>
            }
          >
            Riskli öğrenciler
          </ButtonLink>
        }
      />

      <Card>
        <form method="get" role="search" className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-4 sm:px-6 sm:py-5">
          <Field label="Ara" className="min-w-0 grow basis-64">
            <Input name="ara" type="search" defaultValue={ara} placeholder="Ad veya e-posta…" compact startIcon={<Search />} />
          </Field>
          <Field label="Sırala" className="min-w-0 grow basis-48">
            <Select
              name="sirala"
              defaultValue={sirala}
              compact
              options={Object.entries(SIRALAMA).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" size="xs">
              Uygula
            </Button>
            {ara || sirala !== "yeni" ? (
              <ButtonLink href="/checkup/ogrenciler" variant="ghost" size="xs">
                Temizle
              </ButtonLink>
            ) : null}
          </div>
        </form>

        {ogrenciler.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={ara ? "Aramaya uyan öğrenci yok" : "Henüz kayıtlı öğrenci yok"}
            description={ara ? "Ad ya da e-postanın bir kısmını yazmayı dene." : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell isHeader>Öğrenci</TableCell>
                <TableCell isHeader>Sınıf</TableCell>
                <TableCell isHeader>Kayıt</TableCell>
                <TableCell isHeader nowrap>
                  Son etkinlik
                </TableCell>
                <TableCell isHeader align="end" title="Ölçüm sayılan paket testleri; boş ve yarım kalanlar hariç">
                  Test
                </TableCell>
                <TableCell isHeader align="end" nowrap title="Ölçüm sayılan son paket testinin başarısı">
                  Son başarı
                </TableCell>
                <TableCell isHeader>Erişim</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ogrenciler.map((o) => {
                const ozet = listeOzeti(
                  o.checkupSessions.flatMap((s) =>
                    s.result
                      ? [{ kind: s.kind, endedBy: s.endedBy, ...s.result, examScope: s.result.examScope ?? s.package.examScope }]
                      : []
                  ),
                  o.targetExam
                );
                const etkinlik = sonGorulme(o);
                return (
                  <TableRow key={o.id} hover className="relative">
                    <TableCell className="w-full max-w-0 min-w-60">
                      <Link href={"/checkup/ogrenciler/" + o.id} className="group flex items-center gap-3 after:absolute after:inset-0">
                        <Avatar name={o.name} size="medium" decorative />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-gray-800 group-hover:text-brand-500">{o.name}</span>
                          <span className="block truncate text-theme-xs">{o.email}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell nowrap>
                      {gradeLabel(o.grade) ?? "—"}
                      {o.targetExam ? <span> · {examLabel(o.targetExam)}</span> : null}
                    </TableCell>
                    <TableCell nowrap title={trDate(o.createdAt, { time: true })}>
                      {trDate(o.createdAt)}
                    </TableCell>
                    <TableCell nowrap title={etkinlik ? trDate(etkinlik, { time: true }) : undefined}>
                      {etkinlik ? relativeDay(etkinlik, now) : "hiç girmedi"}
                    </TableCell>
                    <TableCell align="end">
                      <span className="tabular text-gray-800">{ozet.test}</span>
                    </TableCell>
                    <TableCell align="end">
                      <span className="tabular text-gray-800">{ozet.sonBasari === null ? "—" : percent(ozet.sonBasari)}</span>
                    </TableCell>
                    <TableCell nowrap>
                      {o.entitlements.length > 0 ? (
                        <Badge size="sm" color="primary">
                          {o.entitlements.length} aktif hak
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Pagination
        currentPage={Math.min(sayfa, sonSayfa)}
        totalPages={sonSayfa}
        href={(p) => qs("/checkup/ogrenciler", { ara, sirala: sirala !== "yeni" ? sirala : undefined, sayfa: p > 1 ? p : undefined })}
      />
    </>
  );
}
