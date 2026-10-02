import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/checkup/db";
import { MANAGE_ROLES, checkStaff } from "@/lib/checkup/staff";
import { GRADE_LABEL, percent, relativeDay, trDate, trNumber } from "@/lib/checkup/format";
import { GateNotice } from "@/components/checkup/GateNotice";
import {
  Card,
  EmptyState,
  INPUT_CLASS,
  PageHeader,
  Pagination,
  Pill,
  SELECT_CLASS,
  buttonClass,
  qs,
} from "@/components/checkup/ui";

export const metadata: Metadata = { title: "Check-up · Öğrenciler" };

const SAYFA_BOYU = 25;

const SIRALAMA = {
  yeni: { label: "En yeni kayıt", orderBy: { createdAt: "desc" as const } },
  giris: { label: "Son giriş", orderBy: { lastLoginAt: { sort: "desc" as const, nulls: "last" as const } } },
  ad: { label: "Ada göre", orderBy: { name: "asc" as const } },
};
type SiralamaKey = keyof typeof SIRALAMA;

export default async function StudentsPage({ searchParams }: PageProps<"/checkup/ogrenciler">) {
  const gate = await checkStaff(MANAGE_ROLES);
  if (!gate.ok) return <GateNotice gate={gate} roles={MANAGE_ROLES} />;

  const sp = await searchParams;
  const ara = typeof sp.ara === "string" ? sp.ara.trim().slice(0, 100) : "";
  const sirala: SiralamaKey =
    typeof sp.sirala === "string" && sp.sirala in SIRALAMA ? (sp.sirala as SiralamaKey) : "yeni";
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

  const [toplam, ogrenciler] = await Promise.all([
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
        _count: { select: { checkupSessions: { where: { status: "SUBMITTED" } } } },
        checkupSessions: {
          where: { status: "SUBMITTED" },
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            submittedAt: true,
            result: { select: { correctCount: true, wrongCount: true, blankCount: true } },
          },
        },
        entitlements: {
          where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          select: { id: true },
        },
      },
    }),
  ]);

  const sonSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/checkup", label: "Check-up" }]}
        title="Öğrenciler"
        description={
          trNumber(toplam) + (ara ? " öğrenci aramaya uyuyor." : " kayıtlı öğrenci.") +
          " Kişisel veri: yalnızca yönetici ve müdür görür."
        }
      />

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-line p-5 sm:px-6">
          <label className="min-w-0 flex-1 basis-64">
            <span className="mb-1.5 block text-micro font-medium text-ink-faint">Ara</span>
            <input name="ara" defaultValue={ara} placeholder="Ad veya e-posta…" className={INPUT_CLASS} />
          </label>
          <label className="min-w-0 basis-48">
            <span className="mb-1.5 block text-micro font-medium text-ink-faint">Sırala</span>
            <select name="sirala" defaultValue={sirala} className={SELECT_CLASS}>
              {Object.entries(SIRALAMA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("outline", "md")}>
              Uygula
            </button>
            {ara || sirala !== "yeni" ? (
              <Link href="/checkup/ogrenciler" className={buttonClass("ghost", "md")}>
                Temizle
              </Link>
            ) : null}
          </div>
        </form>

        {ogrenciler.length === 0 ? (
          <EmptyState
            title={ara ? "Aramaya uyan öğrenci yok" : "Henüz kayıtlı öğrenci yok"}
            description={ara ? "Ad ya da e-postanın bir kısmını yazmayı dene." : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-sunk text-left text-micro text-ink-faint">
                  <th className="px-5 py-3 font-medium sm:px-6">Öğrenci</th>
                  <th className="px-3 py-3 font-medium">Sınıf</th>
                  <th className="px-3 py-3 font-medium">Kayıt</th>
                  <th className="px-3 py-3 font-medium">Son giriş</th>
                  <th className="px-3 py-3 text-end font-medium">Test</th>
                  <th className="px-3 py-3 text-end font-medium">Son başarı</th>
                  <th className="px-5 py-3 font-medium sm:px-6">Erişim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ogrenciler.map((o) => {
                  const son = o.checkupSessions[0]?.result;
                  const sonToplam = son ? son.correctCount + son.wrongCount + son.blankCount : 0;
                  return (
                    <tr key={o.id} className="group hover:bg-surface-hover">
                      <td className="px-5 py-3 sm:px-6">
                        <Link href={"/checkup/ogrenciler/" + o.id} className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-wash text-micro font-semibold text-brand">
                            {o.name.trim().charAt(0).toLocaleUpperCase("tr-TR")}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink group-hover:text-brand">
                              {o.name}
                            </span>
                            <span className="block truncate text-micro text-ink-faint">{o.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-soft">
                        {o.grade ? GRADE_LABEL[o.grade] : "—"}
                        {o.targetExam ? <span className="text-ink-faint"> · {o.targetExam}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-soft" title={trDate(o.createdAt, { time: true })}>
                        {trDate(o.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-soft">
                        {o.lastLoginAt ? relativeDay(o.lastLoginAt, now) : <span className="text-ink-faint">hiç girmedi</span>}
                      </td>
                      <td className="px-3 py-3 text-end tabular text-ink">
                        {o._count.checkupSessions}
                      </td>
                      <td className="px-3 py-3 text-end tabular text-ink">
                        {son && sonToplam > 0 ? percent(son.correctCount / sonToplam) : <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-5 py-3 sm:px-6">
                        {o.entitlements.length > 0 ? (
                          <Pill tone="brand">{o.entitlements.length} aktif hak</Pill>
                        ) : (
                          <span className="text-micro text-ink-faint">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination
        page={Math.min(sayfa, sonSayfa)}
        pages={sonSayfa}
        href={(p) =>
          qs("/checkup/ogrenciler", { ara, sirala: sirala !== "yeni" ? sirala : undefined, sayfa: p > 1 ? p : undefined })
        }
      />
    </>
  );
}
